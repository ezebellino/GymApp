"""Plantillas de rutina (`routine-templates`, `progression-strategies`).

Capa sobre el catálogo compartido de días y ejercicios (design.md decisión D1): no
duplica `TrainingDay` ni `Exercise`, solo referencia un subconjunto ordenado de días
(`RoutineTemplateDay`) y guarda, por combinación (plantilla, día, ejercicio), si está
activo y qué estrategia de progresión tiene (`RoutineTemplateExercise`, filas ralas
con fallback — design D2).
"""

import unicodedata
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..auth import require_role
from ..deps import get_db
from ..models import ProgressionStrategy, UserRole
from ..progression import plan_sets
from .routines import _ensure_seed_data

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
        .options(joinedload(models.RoutineTemplate.days).joinedload(models.RoutineTemplateDay.day))
        .filter(models.RoutineTemplate.id == template_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return template


def _assignment_count(db: Session, template_id: str) -> int:
    return (
        db.query(models.RoutineAssignment)
        .filter(models.RoutineAssignment.template_id == template_id)
        .count()
    )


def _delete_rejected_detail(count: int) -> str:
    noun = "miembro" if count == 1 else "miembros"
    verb = "la tiene" if count == 1 else "la tienen"
    return f"No se puede eliminar: {count} {noun} {verb} asignada"


def _existing_day_ids(db: Session, day_ids: list[str]) -> set[str]:
    return {
        day.id
        for day in db.query(models.TrainingDay).filter(models.TrainingDay.id.in_(day_ids)).all()
    }


def _validate_day_ids_exist(db: Session, day_ids: list[str]) -> None:
    missing = set(day_ids) - _existing_day_ids(db, day_ids)
    if missing:
        raise HTTPException(
            status_code=400, detail=f"Día(s) inexistente(s): {', '.join(sorted(missing))}"
        )


# --- Resolución de configuración por ejercicio (design D2) ------------------


def _resolve_exercise_config(
    configs_by_key: dict[tuple[str, str], models.RoutineTemplateExercise],
    day_id: str,
    link: models.TrainingDayExercise,
) -> tuple[bool, ProgressionStrategy]:
    """Fila de `routine_template_exercises` si existe; si no, fallback a
    `TrainingDayExercise.is_active` + estrategia Constante (requirement "un
    ejercicio nuevo dentro de una plantilla arranca en Constante")."""
    config = configs_by_key.get((day_id, link.exercise_id))
    if config is not None:
        return config.is_active, config.strategy
    return link.is_active, ProgressionStrategy.constant


def _serialize_exercise(
    link: models.TrainingDayExercise,
    is_active: bool,
    strategy: ProgressionStrategy,
    *,
    base_override: tuple[int, int, float] | None = None,
) -> schemas.RoutineTemplateExerciseOut:
    """`base_override` lo usa la vista del miembro (`routine_assignments.py`,
    `_resolve_base`): la base ajustada por cliente tiene precedencia sobre la del
    catálogo (design D7, invariante I10). El detalle admin no lo pasa nunca."""
    exercise = link.exercise
    sets, reps, weight_kg = base_override or (
        exercise.base_sets, exercise.base_reps, exercise.base_weight_kg
    )
    planned = plan_sets(strategy, sets=sets, reps=reps, weight_kg=weight_kg)
    return schemas.RoutineTemplateExerciseOut(
        exercise_id=exercise.id,
        name=exercise.name,
        muscle_group=exercise.muscle_group,
        base=schemas.ExerciseBaseOut(sets=sets, reps=reps, weight_kg=weight_kg),
        is_active=is_active,
        strategy=strategy.value,
        planned_sets=[
            schemas.PlannedSetOut(index=item.index, weight_kg=item.weight_kg, reps=item.reps, note=item.note)
            for item in planned
        ],
    )


def _split_muscle_groups(raw: str) -> list[str]:
    return [part.strip() for part in raw.split(",") if part.strip()]


def _serialize_detail(db: Session, template: models.RoutineTemplate) -> schemas.RoutineTemplateDetail:
    days = sorted(template.days, key=lambda item: item.position)
    day_ids = [template_day.day_id for template_day in days]

    configs = (
        db.query(models.RoutineTemplateExercise)
        .filter(models.RoutineTemplateExercise.template_id == template.id)
        .all()
    )
    configs_by_key = {(config.day_id, config.exercise_id): config for config in configs}

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

    return schemas.RoutineTemplateDetail(
        id=template.id,
        name=template.name,
        tag=template.tag or "",
        created_at=template.created_at,
        updated_at=template.updated_at,
        days=[
            schemas.RoutineTemplateDayOut(
                day_id=template_day.day.id,
                name=template_day.day.name,
                muscle_groups=_split_muscle_groups(template_day.day.muscle_groups),
                position=template_day.position,
                exercises=[
                    _serialize_exercise(link, *_resolve_exercise_config(configs_by_key, template_day.day_id, link))
                    for link in links_by_day.get(template_day.day_id, [])
                ],
            )
            for template_day in days
        ],
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
    _ensure_seed_data(db)
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
    _ensure_seed_data(db)

    name_normalized = _normalize_name(payload.name)
    _check_name_collision(db, name_normalized)
    _validate_day_ids_exist(db, payload.day_ids)

    template = models.RoutineTemplate(
        name=payload.name,
        name_normalized=name_normalized,
        tag=payload.tag or None,
        created_by_user_id=current_user.id,
    )
    db.add(template)
    db.flush()
    for position, day_id in enumerate(payload.day_ids, start=1):
        db.add(models.RoutineTemplateDay(template_id=template.id, day_id=day_id, position=position))
    db.commit()

    return _serialize_detail(db, _get_template_or_404(db, template.id))


@router.get("/{template_id}", response_model=schemas.RoutineTemplateDetail)
def get_template(template_id: str, db: Session = Depends(get_db)):
    _ensure_seed_data(db)
    template = _get_template_or_404(db, template_id)
    return _serialize_detail(db, template)


@router.patch("/{template_id}", response_model=schemas.RoutineTemplateDetail)
def update_template(
    template_id: str,
    payload: schemas.RoutineTemplateUpdate,
    db: Session = Depends(get_db),
):
    _ensure_seed_data(db)
    template = _get_template_or_404(db, template_id)

    updates = payload.model_dump(exclude_unset=True)

    if updates.get("name") is not None:
        name_normalized = _normalize_name(updates["name"])
        _check_name_collision(db, name_normalized, exclude_id=template.id)
        template.name = updates["name"]
        template.name_normalized = name_normalized

    if "tag" in updates:
        template.tag = updates["tag"] or None

    if updates.get("day_ids") is not None:
        day_ids = updates["day_ids"]
        _validate_day_ids_exist(db, day_ids)
        # Reemplaza la selección de días SIN tocar `routine_template_exercises`
        # (invariante I1): quitar y volver a agregar un día conserva su config.
        db.query(models.RoutineTemplateDay).filter(
            models.RoutineTemplateDay.template_id == template.id
        ).delete()
        db.flush()
        for position, day_id in enumerate(day_ids, start=1):
            db.add(models.RoutineTemplateDay(template_id=template.id, day_id=day_id, position=position))

    template.updated_at = datetime.utcnow()
    db.commit()

    return _serialize_detail(db, _get_template_or_404(db, template.id))


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: str, db: Session = Depends(get_db)):
    template = _get_template_or_404(db, template_id)
    count = _assignment_count(db, template.id)
    if count > 0:
        raise HTTPException(status_code=409, detail=_delete_rejected_detail(count))
    db.delete(template)  # cascade: routine_template_days + routine_template_exercises
    db.commit()


@router.put(
    "/{template_id}/days/{day_id}/exercises/{exercise_id}",
    response_model=schemas.RoutineTemplateExerciseOut,
)
def update_template_exercise(
    template_id: str,
    day_id: str,
    exercise_id: str,
    payload: schemas.RoutineTemplateExerciseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(UserRole.owner, UserRole.coach)),
):
    template = _get_template_or_404(db, template_id)

    if not any(template_day.day_id == day_id for template_day in template.days):
        raise HTTPException(status_code=400, detail="Ese día no pertenece a la plantilla")

    link = (
        db.query(models.TrainingDayExercise)
        .options(joinedload(models.TrainingDayExercise.exercise))
        .filter(
            models.TrainingDayExercise.day_id == day_id,
            models.TrainingDayExercise.exercise_id == exercise_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=400, detail="Ese ejercicio no pertenece al día")

    config = (
        db.query(models.RoutineTemplateExercise)
        .filter(
            models.RoutineTemplateExercise.template_id == template_id,
            models.RoutineTemplateExercise.day_id == day_id,
            models.RoutineTemplateExercise.exercise_id == exercise_id,
        )
        .first()
    )
    if config is None:
        # Upsert: primera vez que se toca este ejercicio en esta plantilla, parte
        # del estado por defecto del catálogo (design D2).
        config = models.RoutineTemplateExercise(
            template_id=template_id,
            day_id=day_id,
            exercise_id=exercise_id,
            is_active=link.is_active,
            strategy=ProgressionStrategy.constant,
        )
        db.add(config)

    if payload.is_active is not None:
        config.is_active = payload.is_active
    if payload.strategy is not None:
        config.strategy = ProgressionStrategy(payload.strategy)

    config.updated_at = datetime.utcnow()
    config.updated_by_user_id = current_user.id

    db.commit()
    db.refresh(config)

    # El chip guarda y devuelve el plan recalculado (autosave, design D5): el
    # frontend nunca reimplementa las fórmulas de progresión (invariante I6).
    return _serialize_exercise(link, config.is_active, config.strategy)
