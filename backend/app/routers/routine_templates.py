"""Plantillas de rutina (`routine-templates`, `progression-strategies`).

Cada plantilla es dueña de sus propios días (`RoutineTemplateDay`), y cada día
es dueño de su grupo muscular (`RoutineTemplateDayMuscleGroup`) y de sus
ejercicios (`RoutineTemplateDayExercise`, con base y estrategia propias) —
design.md decisión D1 de `template-owned-routine-days`. Sin catálogo global de
días ni filas ralas con fallback: estar en `routine_template_day_exercises`
**es** estar en la plantilla.
"""

import unicodedata
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..auth import require_role
from ..deps import get_db
from ..models import UserRole
from ..routine_days import TEMPLATE_DESCRIPTOR, replace_days, serialize_day

router = APIRouter(
    prefix="/routines/templates",
    tags=["routines"],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)


# --- Helpers de nombre único (design D1, invariante I11) --------------------


def _normalize_name(name: str) -> str:
    """NFC + strip + casefold, hecho en Python (no `lower()` de SQL: `lower()` de
    SQLite es ASCII-only y se comportaría distinto de Postgres, ver design D1)."""
    return unicodedata.normalize("NFC", name).strip().casefold()


def _check_name_collision(db: Session, name_normalized: str, *, exclude_id: str | None = None) -> None:
    query = db.query(models.RoutineTemplate).filter(
        models.RoutineTemplate.name_normalized == name_normalized
    )
    if exclude_id:
        query = query.filter(models.RoutineTemplate.id != exclude_id)
    if query.first() is not None:
        raise HTTPException(status_code=409, detail="Ya existe una plantilla con ese nombre")


def _get_template_or_404(db: Session, template_id: str) -> models.RoutineTemplate:
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


def _assignment_count(db: Session, template_id: str) -> int:
    """Miembros que la tienen **Activa** (`member-routine-copies`, design D2):
    sin el `UniqueConstraint(user_id, template_id)` que se cae, un mismo
    Miembro puede tener varias copias del mismo origen — `DISTINCT user_id`
    evita contar dos veces al mismo Miembro, y el filtro por `status='active'`
    es la política de bloqueo de borrado (I16): una plantilla con solo copias
    Alternativas se puede eliminar."""
    return (
        db.query(models.RoutineAssignment.user_id)
        .filter(
            models.RoutineAssignment.template_id == template_id,
            models.RoutineAssignment.status == models.RoutineAssignmentStatus.active,
        )
        .distinct()
        .count()
    )


def _delete_rejected_detail(count: int) -> str:
    noun = "miembro" if count == 1 else "miembros"
    verb = "la tiene" if count == 1 else "la tienen"
    return f"No se puede eliminar: {count} {noun} {verb} asignada como Activa"


# --- Serialización -----------------------------------------------------------


def _serialize_detail(template: models.RoutineTemplate) -> schemas.RoutineTemplateDetail:
    days = sorted(template.days, key=lambda item: item.position)
    return schemas.RoutineTemplateDetail(
        id=template.id,
        name=template.name,
        tag=template.tag or "",
        created_at=template.created_at,
        updated_at=template.updated_at,
        days=[serialize_day(day) for day in days],
    )


def _serialize_summary(db: Session, template: models.RoutineTemplate) -> schemas.RoutineTemplateSummary:
    return schemas.RoutineTemplateSummary(
        id=template.id,
        name=template.name,
        tag=template.tag or "",
        day_count=len(template.days),
        assignment_count=_assignment_count(db, template.id),
        created_at=template.created_at,
    )


# --- Endpoints ---------------------------------------------------------------


@router.get("", response_model=list[schemas.RoutineTemplateSummary])
def list_templates(db: Session = Depends(get_db)):
    templates = (
        db.query(models.RoutineTemplate)
        .options(joinedload(models.RoutineTemplate.days))
        .order_by(models.RoutineTemplate.created_at.desc())
        .all()
    )
    return [_serialize_summary(db, template) for template in templates]


@router.post("", response_model=schemas.RoutineTemplateDetail, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: schemas.RoutineTemplateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(UserRole.owner, UserRole.coach)),
):
    """Crea la plantilla **y** su Día 1 en la misma transacción (design D6,
    invariante I1): la invariante "toda plantilla tiene ≥1 día" vale desde el
    instante del `INSERT`, sin depender de un `PUT` encadenado del frontend."""
    name_normalized = _normalize_name(payload.name)
    _check_name_collision(db, name_normalized)

    template = models.RoutineTemplate(
        name=payload.name,
        name_normalized=name_normalized,
        tag=payload.tag or None,
        created_by_user_id=current_user.id,
    )
    db.add(template)
    db.flush()
    db.add(models.RoutineTemplateDay(template_id=template.id, position=1))
    db.commit()

    return _serialize_detail(_get_template_or_404(db, template.id))


@router.get("/{template_id}", response_model=schemas.RoutineTemplateDetail)
def get_template(template_id: str, db: Session = Depends(get_db)):
    template = _get_template_or_404(db, template_id)
    return _serialize_detail(template)


@router.patch("/{template_id}", response_model=schemas.RoutineTemplateDetail)
def update_template(
    template_id: str,
    payload: schemas.RoutineTemplateUpdate,
    db: Session = Depends(get_db),
):
    """Solo `name`/`tag` (design D6): toda la edición de días pasa por
    `PUT /routines/templates/{id}/days`."""
    template = _get_template_or_404(db, template_id)

    updates = payload.model_dump(exclude_unset=True)

    if updates.get("name") is not None:
        name_normalized = _normalize_name(updates["name"])
        _check_name_collision(db, name_normalized, exclude_id=template.id)
        template.name = updates["name"]
        template.name_normalized = name_normalized

    if "tag" in updates:
        template.tag = updates["tag"] or None

    template.updated_at = datetime.utcnow()
    db.commit()

    return _serialize_detail(_get_template_or_404(db, template.id))


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: str, db: Session = Depends(get_db)):
    template = _get_template_or_404(db, template_id)
    count = _assignment_count(db, template.id)
    if count > 0:
        raise HTTPException(status_code=409, detail=_delete_rejected_detail(count))
    db.delete(template)  # cascade: días -> grupos musculares + ejercicios
    db.commit()


@router.put("/{template_id}/days", response_model=schemas.RoutineTemplateDetail)
def save_template_days(
    template_id: str,
    payload: schemas.RoutineTemplateDaysUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(UserRole.owner, UserRole.coach)),
):
    """Reemplazo completo del borrador de días/ejercicios, con identidad
    explícita (design D5, delegado en `routine_days.replace_days` — design D8
    de `member-routine-copies`). `day_id` presente conserva la fila (I2, así lo
    que la referencia no se rompe); `null` crea un día nuevo. El orden de las
    listas **es** el dato: la posición del día es su índice + 1 y el
    `sort_order` del ejercicio es su índice. Todo en una sola transacción
    (I11): un payload inválido no persiste nada."""
    template = _get_template_or_404(db, template_id)

    replace_days(
        db,
        template.id,
        payload.days,
        descriptor=TEMPLATE_DESCRIPTOR,
        current_user_id=current_user.id,
    )

    template.updated_at = datetime.utcnow()
    db.commit()

    return _serialize_detail(_get_template_or_404(db, template.id))
