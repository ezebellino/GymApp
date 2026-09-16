"""Copia de plantillas a Miembros (`routine-assignment`) y ejecución del
Miembro (`member-routine-view`, `routine-progress-tracking`).

Dos routers en el mismo módulo (design D9 de `add-routine-templates`, vigente):
- `router` (`/routines/users/{user_id}/templates`, Dueño/Coach): copiar,
  cambiar de estado, quitar y editar la copia de un Miembro.
- `my_router` (`/routines/my/templates`, rol member): lectura de las propias
  copias y el plan ya calculado, con la marca de hoy adjunta.

`member-routine-copies` (design D2): asignar deja de ser una referencia y pasa
a ser una **copia** independiente y editable (D5, D8). El ajuste de base por
cliente (`RoutineAssignmentBase`) se retiró entero (D4): la base de un
ejercicio de la copia se edita directo en `RoutineAssignmentDayExercise`.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..auth import get_current_user, require_role
from ..deps import get_db, require_can_manage_user
from ..models import UserRole
from ..routine_days import ASSIGNMENT_DESCRIPTOR, copy_days, replace_days, serialize_day
from ..utils import now_ar
from .routines import _get_user_or_404, _require_member

router = APIRouter(
    prefix="/routines/users/{user_id}/templates",
    tags=["routines"],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)

my_router = APIRouter(
    prefix="/routines/my/templates",
    tags=["routines"],
    dependencies=[Depends(require_role(UserRole.member))],
)


# --- Helpers compartidos -----------------------------------------------------


def _get_template_with_days(db: Session, template_id: str) -> models.RoutineTemplate:
    template = (
        db.query(models.RoutineTemplate)
        .options(
            joinedload(models.RoutineTemplate.days).joinedload(models.RoutineTemplateDay.muscle_groups),
            joinedload(models.RoutineTemplate.days)
            .joinedload(models.RoutineTemplateDay.exercises)
            .joinedload(models.RoutineTemplateDayExercise.exercise),
        )
        .filter(models.RoutineTemplate.id == template_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return template


def _get_assignment_with_days(db: Session, user_id: str, assignment_id: str) -> models.RoutineAssignment:
    assignment = (
        db.query(models.RoutineAssignment)
        .options(
            joinedload(models.RoutineAssignment.days).joinedload(models.RoutineAssignmentDay.muscle_groups),
            joinedload(models.RoutineAssignment.days)
            .joinedload(models.RoutineAssignmentDay.exercises)
            .joinedload(models.RoutineAssignmentDayExercise.exercise),
        )
        .filter(
            models.RoutineAssignment.id == assignment_id,
            models.RoutineAssignment.user_id == user_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    return assignment


def _get_assignment_or_404(db: Session, user_id: str, assignment_id: str) -> models.RoutineAssignment:
    assignment = (
        db.query(models.RoutineAssignment)
        .filter(
            models.RoutineAssignment.id == assignment_id,
            models.RoutineAssignment.user_id == user_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    return assignment


def _degrade_active_assignment(db: Session, user_id: str) -> None:
    """Cualquier Activa previa del Miembro pasa a Alternativa. `flush()` antes
    del insert/update de la nueva fila para no chocar contra el índice único
    parcial dentro de la misma transacción."""
    db.query(models.RoutineAssignment).filter(
        models.RoutineAssignment.user_id == user_id,
        models.RoutineAssignment.status == models.RoutineAssignmentStatus.active,
    ).update({"status": models.RoutineAssignmentStatus.alternative})
    db.flush()


def _serialize_assignment(assignment: models.RoutineAssignment) -> schemas.RoutineAssignmentOut:
    """La etiqueta de origen sale **siempre** del snapshot (`template_name`/
    `template_tag`), nunca de la relación viva con `RoutineTemplate` (design
    D2b): una copia huérfana (plantilla borrada) sigue mostrando su nombre de
    origen tal cual estaba al momento de copiar."""
    return schemas.RoutineAssignmentOut(
        id=assignment.id,
        user_id=assignment.user_id,
        template_id=assignment.template_id,
        template_name=assignment.template_name,
        template_tag=assignment.template_tag or "",
        status=assignment.status.value,
        starts_on=assignment.starts_on,
        created_at=assignment.created_at,
    )


# --- Endpoints Dueño/Coach ----------------------------------------------------


@router.get("", response_model=list[schemas.RoutineAssignmentOut])
def list_user_assignments(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(UserRole.owner, UserRole.coach)),
):
    target = _get_user_or_404(db, user_id)
    require_can_manage_user(current_user, target.role)

    # Sin filtrar por `membership_status`: dar de baja la membresía no oculta
    # las asignaciones existentes.
    assignments = (
        db.query(models.RoutineAssignment)
        .filter(models.RoutineAssignment.user_id == target.id)
        .order_by(models.RoutineAssignment.created_at.desc())
        .all()
    )
    return [_serialize_assignment(assignment) for assignment in assignments]


@router.post("", response_model=schemas.RoutineAssignmentOut, status_code=status.HTTP_201_CREATED)
def create_assignment(
    user_id: str,
    payload: schemas.RoutineAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(UserRole.owner, UserRole.coach)),
):
    """Asignar **copia** la plantilla (design D5): `create_assignment` siempre
    inserta una fila nueva — nunca un upsert (D2, se cayó el
    `UniqueConstraint(user_id, template_id)`) —, y recién después de validar
    membresía y rol copia días, grupos musculares y ejercicios en una sola
    transacción."""
    target = _get_user_or_404(db, user_id)
    require_can_manage_user(current_user, target.role)

    # La membresía activa condiciona solo el alta. Mismo código (409) para
    # "no es Miembro" y "sin membresía activa" — la spec exige ambas cosas a
    # la vez y el design las resuelve con un único chequeo.
    if target.role != UserRole.member or target.membership_status != models.MembershipStatus.active:
        raise HTTPException(
            status_code=409,
            detail="Solo se puede asignar una plantilla a un Miembro con membresía activa",
        )

    template = _get_template_with_days(db, payload.template_id)
    status_value = models.RoutineAssignmentStatus(payload.status)

    if status_value == models.RoutineAssignmentStatus.active:
        _degrade_active_assignment(db, target.id)

    assignment = models.RoutineAssignment(
        user_id=target.id,
        template_id=template.id,
        template_name=template.name,
        template_tag=template.tag,
        status=status_value,
        starts_on=payload.starts_on or date.today(),
        created_by_user_id=current_user.id,
    )
    db.add(assignment)
    db.flush()

    copy_days(db, source_template=template, assignment_id=assignment.id, current_user_id=current_user.id)

    db.commit()
    db.refresh(assignment)
    return _serialize_assignment(assignment)


@router.patch("/{assignment_id}", response_model=schemas.RoutineAssignmentOut)
def update_assignment_status(
    user_id: str,
    assignment_id: str,
    payload: schemas.RoutineAssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(UserRole.owner, UserRole.coach)),
):
    target = _get_user_or_404(db, user_id)
    require_can_manage_user(current_user, target.role)
    assignment = _get_assignment_or_404(db, user_id, assignment_id)

    status_value = models.RoutineAssignmentStatus(payload.status)
    if status_value == models.RoutineAssignmentStatus.active:
        _degrade_active_assignment(db, target.id)
    assignment.status = status_value

    db.commit()
    db.refresh(assignment)
    return _serialize_assignment(assignment)


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    user_id: str,
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(UserRole.owner, UserRole.coach)),
):
    target = _get_user_or_404(db, user_id)
    require_can_manage_user(current_user, target.role)
    assignment = _get_assignment_or_404(db, user_id, assignment_id)

    # Borra la copia y sus días/ejercicios por cascade. Las marcas de progreso
    # que la referencian quedan con `assignment_day_id IS NULL` (`SET NULL`,
    # design D3/D7): no se tocan acá. NO promueve ninguna Alternativa a Activa
    # (requirement explícito): quitar es lo único que pasa, sin efecto
    # secundario sobre otras asignaciones.
    db.delete(assignment)
    db.commit()


@router.get("/{assignment_id}", response_model=schemas.MemberRoutineTemplateOut)
def get_assignment_detail(
    user_id: str,
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(UserRole.owner, UserRole.coach)),
):
    """Detalle de la copia para el editor de Dueño/Coach (design D6, D8):
    mismo shape que `MemberRoutineTemplateOut`, sin marca de hoy adjunta
    (`logged` queda `None`: eso es exclusivo del plan del propio Miembro)."""
    target = _get_user_or_404(db, user_id)
    require_can_manage_user(current_user, target.role)
    assignment = _get_assignment_with_days(db, user_id, assignment_id)

    days = sorted(assignment.days, key=lambda item: item.position)
    days_out = [serialize_day(day) for day in days]

    assignment_out = _serialize_assignment(assignment)
    return schemas.MemberRoutineTemplateOut(**assignment_out.model_dump(), days=days_out)


@router.put("/{assignment_id}/days", response_model=schemas.MemberRoutineTemplateOut)
def save_assignment_days(
    user_id: str,
    assignment_id: str,
    payload: schemas.RoutineTemplateDaysUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(UserRole.owner, UserRole.coach)),
):
    """Guardado de la copia de un Miembro por Dueño o Coach (design D6, D8):
    mismo contrato de reemplazo completo con identidad explícita que el `PUT`
    de plantillas, delegado en `routine_days.replace_days` — afecta
    **únicamente** a esta copia (I3): ni a la plantilla origen ni a ninguna
    otra copia."""
    target = _get_user_or_404(db, user_id)
    require_can_manage_user(current_user, target.role)
    assignment = _get_assignment_or_404(db, user_id, assignment_id)

    replace_days(
        db,
        assignment.id,
        payload.days,
        descriptor=ASSIGNMENT_DESCRIPTOR,
        current_user_id=current_user.id,
    )

    db.commit()

    assignment = _get_assignment_with_days(db, user_id, assignment_id)
    days_out = [serialize_day(day) for day in sorted(assignment.days, key=lambda item: item.position)]
    assignment_out = _serialize_assignment(assignment)
    return schemas.MemberRoutineTemplateOut(**assignment_out.model_dump(), days=days_out)


# --- Endpoints del Miembro (`member-routine-view`, `routine-progress-tracking`) --


@my_router.get("", response_model=list[schemas.RoutineAssignmentOut])
def list_my_templates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Todas las copias del Miembro (Activas y Alternativas), ordenadas por
    `created_at desc` (design D6, D9): un Miembro sin ninguna Activa puede
    elegir y entrenar cualquiera de sus Alternativas."""
    member = _require_member(current_user)
    assignments = (
        db.query(models.RoutineAssignment)
        .filter(models.RoutineAssignment.user_id == member.id)
        .order_by(models.RoutineAssignment.created_at.desc())
        .all()
    )
    return [_serialize_assignment(assignment) for assignment in assignments]


def _logged_sets_today(
    db: Session, *, user_id: str, assignment_day_ids: list[str]
) -> dict[tuple[str, str, int], schemas.LoggedSetOut]:
    """Marcas de **hoy** (`performed_on = now_ar().date()`) de los días de esta
    copia, indexadas por `(assignment_day_id, exercise_id, set_index)` (design
    D6): un solo query para toda la pantalla de ejecución."""
    if not assignment_day_ids:
        return {}
    today = now_ar().date()
    logs = (
        db.query(models.WorkoutSetLog)
        .filter(
            models.WorkoutSetLog.user_id == user_id,
            models.WorkoutSetLog.assignment_day_id.in_(assignment_day_ids),
            models.WorkoutSetLog.performed_on == today,
        )
        .all()
    )
    return {
        (log.assignment_day_id, log.exercise_id, log.set_index): schemas.LoggedSetOut(
            weight_kg=log.weight_kg, reps=log.reps, performed_at=log.performed_at
        )
        for log in logs
    }


@my_router.get("/{assignment_id}", response_model=schemas.MemberRoutineTemplateOut)
def get_my_template(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Lee la **copia** del Miembro (design D6, ya no la plantilla): los
    ejercicios que ve son exactamente los de `routine_assignment_day_exercises`
    de esta copia (I14), sin importar qué le haya pasado desde entonces a la
    plantilla origen (I4). Cada `PlannedSetOut` gana `logged` con la marca de
    **hoy** del mismo `set_index`, solo para índices dentro del plan vigente."""
    member = _require_member(current_user)
    assignment = _get_assignment_with_days(db, member.id, assignment_id)

    days = sorted(assignment.days, key=lambda item: item.position)
    logged = _logged_sets_today(db, user_id=member.id, assignment_day_ids=[day.id for day in days])

    def _logged_provider_factory(day_id: str):
        def _provider(exercise_id: str, set_index: int) -> schemas.LoggedSetOut | None:
            return logged.get((day_id, exercise_id, set_index))

        return _provider

    days_out = [
        serialize_day(day, logged_provider_factory=_logged_provider_factory) for day in days
    ]

    assignment_out = _serialize_assignment(assignment)
    return schemas.MemberRoutineTemplateOut(**assignment_out.model_dump(), days=days_out)
