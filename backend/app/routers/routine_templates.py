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
from ..models import (
    DEFAULT_EXERCISE_BASE_REPS,
    DEFAULT_EXERCISE_BASE_SETS,
    DEFAULT_EXERCISE_BASE_WEIGHT_KG,
    ProgressionStrategy,
    UserRole,
)
from ..progression import plan_sets

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
    return (
        db.query(models.RoutineAssignment)
        .filter(models.RoutineAssignment.template_id == template_id)
        .count()
    )


def _delete_rejected_detail(count: int) -> str:
    noun = "miembro" if count == 1 else "miembros"
    verb = "la tiene" if count == 1 else "la tienen"
    return f"No se puede eliminar: {count} {noun} {verb} asignada"


# --- Serialización -----------------------------------------------------------


def _serialize_exercise(link: models.RoutineTemplateDayExercise) -> schemas.RoutineTemplateExerciseOut:
    exercise = link.exercise
    planned = plan_sets(
        link.strategy, sets=link.base_sets, reps=link.base_reps, weight_kg=link.base_weight_kg
    )
    return schemas.RoutineTemplateExerciseOut(
        exercise_id=exercise.id,
        name=exercise.name,
        muscle_group=exercise.muscle_group,
        base=schemas.ExerciseBaseOut(
            sets=link.base_sets, reps=link.base_reps, weight_kg=link.base_weight_kg
        ),
        strategy=link.strategy.value,
        planned_sets=[
            schemas.PlannedSetOut(index=item.index, weight_kg=item.weight_kg, reps=item.reps, note=item.note)
            for item in planned
        ],
    )


def _serialize_day(day: models.RoutineTemplateDay) -> schemas.RoutineTemplateDayOut:
    muscle_groups = [item.muscle_group for item in sorted(day.muscle_groups, key=lambda m: m.sort_order)]
    return schemas.RoutineTemplateDayOut(
        day_id=day.id,
        name=f"Día {day.position}" + (f" - {'/'.join(muscle_groups)}" if muscle_groups else ""),
        muscle_groups=muscle_groups,
        position=day.position,
        exercises=[
            _serialize_exercise(link)
            for link in sorted(day.exercises, key=lambda item: item.sort_order)
        ],
    )


def _serialize_detail(template: models.RoutineTemplate) -> schemas.RoutineTemplateDetail:
    days = sorted(template.days, key=lambda item: item.position)
    return schemas.RoutineTemplateDetail(
        id=template.id,
        name=template.name,
        tag=template.tag or "",
        created_at=template.created_at,
        updated_at=template.updated_at,
        days=[_serialize_day(day) for day in days],
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
    explícita (design D5). `day_id` presente conserva la fila (I2, así los
    `WorkoutLog` que la referencian no se rompen); `null` crea un día nuevo. El
    orden de las listas **es** el dato: la posición del día es su índice + 1 y
    el `sort_order` del ejercicio es su índice. Todo en una sola transacción
    (I11): un payload inválido no persiste nada."""
    template = _get_template_or_404(db, template_id)
    existing_days_by_id = {day.id: day for day in template.days}

    payload_day_ids = {day.day_id for day in payload.days if day.day_id is not None}
    unknown_ids = payload_day_ids - set(existing_days_by_id.keys())
    if unknown_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Día(s) que no pertenecen a esta plantilla: {', '.join(sorted(unknown_ids))}",
        )

    # Días ausentes del payload se borran (cascade: sus grupos musculares y
    # ejercicios se van con ellos).
    for day_id, day in existing_days_by_id.items():
        if day_id not in payload_day_ids:
            db.delete(day)
    db.flush()

    for position, day_input in enumerate(payload.days, start=1):
        if day_input.day_id is not None:
            day = existing_days_by_id[day_input.day_id]
            day.position = position
        else:
            day = models.RoutineTemplateDay(template_id=template.id, position=position)
            db.add(day)
            db.flush()

        _replace_muscle_groups(db, day, day_input.muscle_groups)
        _replace_exercises(db, day, day_input.exercises, current_user_id=current_user.id)

    template.updated_at = datetime.utcnow()
    db.commit()

    return _serialize_detail(_get_template_or_404(db, template.id))


def _replace_muscle_groups(
    db: Session, day: models.RoutineTemplateDay, muscle_groups: list
) -> None:
    db.query(models.RoutineTemplateDayMuscleGroup).filter(
        models.RoutineTemplateDayMuscleGroup.template_day_id == day.id
    ).delete()
    for index, muscle_group in enumerate(muscle_groups):
        db.add(
            models.RoutineTemplateDayMuscleGroup(
                template_day_id=day.id, muscle_group=muscle_group.value, sort_order=index
            )
        )


def _replace_exercises(
    db: Session,
    day: models.RoutineTemplateDay,
    exercises_input: list,
    *,
    current_user_id: str,
) -> None:
    """Reglas de base y estrategia (design D5/D9): un par nuevo sin `base` toma
    la constante por defecto (I5); un par existente sin `base` conserva la
    suya. `strategy` ausente en un par nuevo es `constant`. Un ejercicio
    inactivo no se puede **agregar** (400), pero uno ya existente sobrevive
    (I10)."""
    existing_by_exercise_id = {link.exercise_id: link for link in day.exercises}
    kept_exercise_ids: set[str] = set()

    for index, exercise_input in enumerate(exercises_input):
        existing_link = existing_by_exercise_id.get(exercise_input.exercise_id)
        kept_exercise_ids.add(exercise_input.exercise_id)

        if existing_link is None:
            exercise = db.get(models.Exercise, exercise_input.exercise_id)
            if exercise is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Ejercicio inexistente: {exercise_input.exercise_id}",
                )
            if not exercise.is_active:
                raise HTTPException(
                    status_code=400,
                    detail=f"El ejercicio '{exercise.name}' está inactivo y no se puede agregar",
                )
            strategy = (
                ProgressionStrategy(exercise_input.strategy)
                if exercise_input.strategy
                else ProgressionStrategy.constant
            )
            base = exercise_input.base
            link = models.RoutineTemplateDayExercise(
                template_day_id=day.id,
                exercise_id=exercise_input.exercise_id,
                sort_order=index,
                strategy=strategy,
                base_sets=base.sets if base else DEFAULT_EXERCISE_BASE_SETS,
                base_reps=base.reps if base else DEFAULT_EXERCISE_BASE_REPS,
                base_weight_kg=base.weight_kg if base else DEFAULT_EXERCISE_BASE_WEIGHT_KG,
                updated_by_user_id=current_user_id,
            )
            db.add(link)
        else:
            existing_link.sort_order = index
            if exercise_input.strategy is not None:
                existing_link.strategy = ProgressionStrategy(exercise_input.strategy)
            if exercise_input.base is not None:
                existing_link.base_sets = exercise_input.base.sets
                existing_link.base_reps = exercise_input.base.reps
                existing_link.base_weight_kg = exercise_input.base.weight_kg
            existing_link.updated_at = datetime.utcnow()
            existing_link.updated_by_user_id = current_user_id

    for exercise_id, link in existing_by_exercise_id.items():
        if exercise_id not in kept_exercise_ids:
            db.delete(link)
