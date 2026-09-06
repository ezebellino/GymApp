"""Asignación de plantillas a Miembros (`routine-assignment`) y vista del cliente
(`member-routine-view`).

Dos routers en el mismo módulo (design D9):
- `router` (`/routines/users/{user_id}/templates`, Dueño/Coach): alta, cambio de
  estado, baja y ajuste de base por cliente.
- `my_router` (`/routines/my/templates`, Miembro): solo lectura de las propias
  asignaciones y el plan ya calculado.
"""

from collections import defaultdict
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..auth import get_current_user, require_role
from ..deps import get_db, require_can_manage_user
from ..models import UserRole
from .routine_templates import _resolve_exercise_config, _serialize_exercise, _split_muscle_groups
from .routines import _ensure_seed_data, _get_user_or_404, _require_member

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
        .options(joinedload(models.RoutineTemplate.days))
        .filter(models.RoutineTemplate.id == template_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return template


def _validate_exercise_in_template(db: Session, template: models.RoutineTemplate, exercise_id: str) -> None:
    day_ids = [template_day.day_id for template_day in template.days]
    exists = (
        db.query(models.TrainingDayExercise)
        .filter(
            models.TrainingDayExercise.day_id.in_(day_ids),
            models.TrainingDayExercise.exercise_id == exercise_id,
        )
        .first()
    )
    if not exists:
        raise HTTPException(status_code=400, detail="Ese ejercicio no pertenece a la plantilla asignada")


def _get_assignment_or_404(db: Session, user_id: str, assignment_id: str) -> models.RoutineAssignment:
    assignment = (
        db.query(models.RoutineAssignment)
        .options(joinedload(models.RoutineAssignment.template))
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
    """Cualquier Activa previa del Miembro pasa a Alternativa (design D6). `flush()`
    antes del insert/update de la nueva fila para no chocar contra el índice único
    parcial dentro de la misma transacción."""
    db.query(models.RoutineAssignment).filter(
        models.RoutineAssignment.user_id == user_id,
        models.RoutineAssignment.status == models.RoutineAssignmentStatus.active,
    ).update({"status": models.RoutineAssignmentStatus.alternative})
    db.flush()


def _upsert_base_override(
    db: Session,
    assignment_id: str,
    exercise_id: str,
    sets: int,
    reps: int,
    weight_kg: float,
    adjusted_by_user_id: str,
) -> models.RoutineAssignmentBase:
    override = (
        db.query(models.RoutineAssignmentBase)
        .filter(
            models.RoutineAssignmentBase.assignment_id == assignment_id,
            models.RoutineAssignmentBase.exercise_id == exercise_id,
        )
        .first()
    )
    if override is None:
        override = models.RoutineAssignmentBase(assignment_id=assignment_id, exercise_id=exercise_id)
        db.add(override)
    override.sets = sets
    override.reps = reps
    override.weight_kg = weight_kg
    override.adjusted_by_user_id = adjusted_by_user_id
    override.adjusted_at = datetime.utcnow()
    return override


def _resolve_base(
    exercise: models.Exercise, overrides: dict[str, models.RoutineAssignmentBase]
) -> tuple[int, int, float]:
    """Única precedencia del sistema (design D7, invariante I10): el ajuste de base
    por cliente si existe, si no la base del catálogo."""
    override = overrides.get(exercise.id)
    if override is not None:
        return override.sets, override.reps, override.weight_kg
    return exercise.base_sets, exercise.base_reps, exercise.base_weight_kg


def _serialize_assignment(db: Session, assignment: models.RoutineAssignment) -> schemas.RoutineAssignmentOut:
    template = assignment.template
    overrides = (
        db.query(models.RoutineAssignmentBase)
        .filter(models.RoutineAssignmentBase.assignment_id == assignment.id)
        .order_by(models.RoutineAssignmentBase.adjusted_at.desc())
        .all()
    )
    last_adjustment = None
    if overrides:
        latest = overrides[0]
        adjuster = db.get(models.User, latest.adjusted_by_user_id) if latest.adjusted_by_user_id else None
        last_adjustment = schemas.LastAdjustmentOut(
            by_name=adjuster.full_name if adjuster else "—",
            at=latest.adjusted_at,
        )
    return schemas.RoutineAssignmentOut(
        id=assignment.id,
        user_id=assignment.user_id,
        template_id=assignment.template_id,
        template_name=template.name,
        template_tag=template.tag or "",
        status=assignment.status.value,
        starts_on=assignment.starts_on,
        created_at=assignment.created_at,
        adjustments_count=len(overrides),
        last_adjustment=last_adjustment,
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

    # Sin filtrar por `membership_status` (invariante I13): dar de baja la
    # membresía no oculta las asignaciones existentes.
    assignments = (
        db.query(models.RoutineAssignment)
        .options(joinedload(models.RoutineAssignment.template))
        .filter(models.RoutineAssignment.user_id == target.id)
        .order_by(models.RoutineAssignment.created_at.desc())
        .all()
    )
    return [_serialize_assignment(db, assignment) for assignment in assignments]


@router.post("", response_model=schemas.RoutineAssignmentOut, status_code=status.HTTP_201_CREATED)
def create_assignment(
    user_id: str,
    payload: schemas.RoutineAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(UserRole.owner, UserRole.coach)),
):
    _ensure_seed_data(db)
    target = _get_user_or_404(db, user_id)
    require_can_manage_user(current_user, target.role)

    # Design D8: la membresía activa condiciona solo el alta. Mismo código (409)
    # para "no es Miembro" y "sin membresía activa" — la spec exige ambas cosas
    # a la vez y el design las resuelve con un único chequeo.
    if target.role != UserRole.member or target.membership_status != models.MembershipStatus.active:
        raise HTTPException(
            status_code=409,
            detail="Solo se puede asignar una plantilla a un Miembro con membresía activa",
        )

    template = _get_template_with_days(db, payload.template_id)
    status_value = models.RoutineAssignmentStatus(payload.status)

    if status_value == models.RoutineAssignmentStatus.active:
        _degrade_active_assignment(db, target.id)

    assignment = (
        db.query(models.RoutineAssignment)
        .filter(
            models.RoutineAssignment.user_id == target.id,
            models.RoutineAssignment.template_id == template.id,
        )
        .first()
    )
    if assignment is None:
        assignment = models.RoutineAssignment(
            user_id=target.id,
            template_id=template.id,
            status=status_value,
            starts_on=payload.starts_on or date.today(),
            created_by_user_id=current_user.id,
        )
        db.add(assignment)
    else:
        # Reasignar la misma plantilla al mismo miembro es un upsert (design D6):
        # actualiza estado (y fecha si se indicó) en vez de un 409 o una fila
        # duplicada — `UniqueConstraint(user_id, template_id)` es la red de
        # seguridad, no el camino esperado.
        assignment.status = status_value
        if payload.starts_on:
            assignment.starts_on = payload.starts_on
    db.flush()

    for override in payload.base_overrides:
        _validate_exercise_in_template(db, template, override.exercise_id)
        _upsert_base_override(
            db,
            assignment.id,
            override.exercise_id,
            override.sets,
            override.reps,
            override.weight_kg,
            current_user.id,
        )

    db.commit()
    db.refresh(assignment)
    return _serialize_assignment(db, assignment)


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
    return _serialize_assignment(db, assignment)


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

    # Borra la asignación y sus ajustes de base por cascade. NO promueve ninguna
    # Alternativa a Activa (requirement explícito, invariante I12): quitar es lo
    # único que pasa acá, sin ningún efecto secundario sobre otras asignaciones.
    db.delete(assignment)
    db.commit()


@router.put("/{assignment_id}/bases/{exercise_id}", response_model=schemas.RoutineAssignmentOut)
def upsert_assignment_base(
    user_id: str,
    assignment_id: str,
    exercise_id: str,
    payload: schemas.RoutineAssignmentBaseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(UserRole.owner, UserRole.coach)),
):
    _ensure_seed_data(db)
    target = _get_user_or_404(db, user_id)
    require_can_manage_user(current_user, target.role)
    assignment = _get_assignment_or_404(db, user_id, assignment_id)
    template = _get_template_with_days(db, assignment.template_id)
    _validate_exercise_in_template(db, template, exercise_id)

    _upsert_base_override(
        db, assignment.id, exercise_id, payload.sets, payload.reps, payload.weight_kg, current_user.id
    )

    db.commit()
    db.refresh(assignment)
    return _serialize_assignment(db, assignment)


@router.delete("/{assignment_id}/bases/{exercise_id}", response_model=schemas.RoutineAssignmentOut)
def remove_assignment_base(
    user_id: str,
    assignment_id: str,
    exercise_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(UserRole.owner, UserRole.coach)),
):
    target = _get_user_or_404(db, user_id)
    require_can_manage_user(current_user, target.role)
    assignment = _get_assignment_or_404(db, user_id, assignment_id)

    override = (
        db.query(models.RoutineAssignmentBase)
        .filter(
            models.RoutineAssignmentBase.assignment_id == assignment.id,
            models.RoutineAssignmentBase.exercise_id == exercise_id,
        )
        .first()
    )
    if not override:
        raise HTTPException(status_code=404, detail="No hay un ajuste de base para ese ejercicio")
    db.delete(override)

    db.commit()
    db.refresh(assignment)
    return _serialize_assignment(db, assignment)


# --- Endpoints del Miembro (`member-routine-view`) --------------------------


@my_router.get("", response_model=list[schemas.RoutineAssignmentOut])
def list_my_templates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    member = _require_member(current_user)
    assignments = (
        db.query(models.RoutineAssignment)
        .options(joinedload(models.RoutineAssignment.template))
        .filter(models.RoutineAssignment.user_id == member.id)
        .order_by(models.RoutineAssignment.created_at.desc())
        .all()
    )
    return [_serialize_assignment(db, assignment) for assignment in assignments]


@my_router.get("/{assignment_id}", response_model=schemas.MemberRoutineTemplateOut)
def get_my_template(
    assignment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    member = _require_member(current_user)
    _ensure_seed_data(db)

    assignment = (
        db.query(models.RoutineAssignment)
        .options(
            joinedload(models.RoutineAssignment.template)
            .joinedload(models.RoutineTemplate.days)
            .joinedload(models.RoutineTemplateDay.day)
        )
        .filter(
            models.RoutineAssignment.id == assignment_id,
            models.RoutineAssignment.user_id == member.id,
        )
        .first()
    )
    if not assignment:
        # 404, no 403: pedir la asignación de otro Miembro no filtra existencia
        # (invariante I7).
        raise HTTPException(status_code=404, detail="Asignación no encontrada")

    template = assignment.template
    days = sorted(template.days, key=lambda item: item.position)
    day_ids = [template_day.day_id for template_day in days]

    configs = (
        db.query(models.RoutineTemplateExercise)
        .filter(models.RoutineTemplateExercise.template_id == template.id)
        .all()
    )
    configs_by_key = {(config.day_id, config.exercise_id): config for config in configs}

    overrides = {
        override.exercise_id: override
        for override in db.query(models.RoutineAssignmentBase)
        .filter(models.RoutineAssignmentBase.assignment_id == assignment.id)
        .all()
    }

    links = (
        db.query(models.TrainingDayExercise)
        .options(joinedload(models.TrainingDayExercise.exercise))
        .filter(models.TrainingDayExercise.day_id.in_(day_ids))
        .order_by(models.TrainingDayExercise.sort_order.asc())
        .all()
    )
    links_by_day: dict[str, list[models.TrainingDayExercise]] = defaultdict(list)
    for link in links:
        links_by_day[link.day_id].append(link)

    days_out = []
    for template_day in days:
        exercises_out = []
        for link in links_by_day.get(template_day.day_id, []):
            is_active, strategy = _resolve_exercise_config(configs_by_key, template_day.day_id, link)
            if not is_active:
                # Un ejercicio desactivado para la plantilla NO aparece en el plan
                # del Miembro (spec `member-routine-view`).
                continue
            base_override = _resolve_base(link.exercise, overrides)
            exercises_out.append(_serialize_exercise(link, True, strategy, base_override=base_override))
        days_out.append(
            schemas.RoutineTemplateDayOut(
                day_id=template_day.day.id,
                name=template_day.day.name,
                muscle_groups=_split_muscle_groups(template_day.day.muscle_groups),
                position=template_day.position,
                exercises=exercises_out,
            )
        )

    assignment_out = _serialize_assignment(db, assignment)
    return schemas.MemberRoutineTemplateOut(**assignment_out.model_dump(), days=days_out)
