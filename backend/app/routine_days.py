"""Lógica de días/ejercicios compartida entre plantilla y copia
(`member-routine-copies`, design D8).

`RoutineTemplate` → `RoutineTemplateDay` → `RoutineTemplateDayMuscleGroup` /
`RoutineTemplateDayExercise` y `RoutineAssignment` → `RoutineAssignmentDay` →
`RoutineAssignmentDayMuscleGroup` / `RoutineAssignmentDayExercise` son dos
subárboles estructuralmente idénticos, con las mismas reglas: 1..5 días,
posiciones contiguas por índice, `sort_order` por índice, `exercise_id` único
por día, `day_id: null` = día nuevo, base por defecto 3×10×0 kg, estrategia por
defecto `constant`, ejercicio inactivo no agregable pero conservable. Este
módulo es la **única** implementación de esas reglas — tanto el reemplazo
completo (`PUT .../days`) como la serialización con `planned_sets` —,
parametrizada por un descriptor de los cuatro modelos involucrados. Sin esto,
el serializador de día/ejercicio quedaría triplicado (hallazgo del review de
`template-owned-routine-days`, ya duplicado entre `routine_templates.py`,
`routines.py` y `routine_assignments.py`).
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models, schemas
from .models import (
    DEFAULT_EXERCISE_BASE_REPS,
    DEFAULT_EXERCISE_BASE_SETS,
    DEFAULT_EXERCISE_BASE_WEIGHT_KG,
    ProgressionStrategy,
)
from .progression import plan_sets

# `exercise_id, set_index -> LoggedSetOut | None` (design D6): quien serializa
# el plan del Miembro le engancha esta función para adjuntar la marca de hoy a
# cada `PlannedSetOut`; el resto de los llamadores (plantilla, editor de la
# copia) no la pasa y `logged` queda `None`.
LoggedProvider = Callable[[str, int], Optional["schemas.LoggedSetOut"]]


@dataclass(frozen=True)
class DayOwnerDescriptor:
    """Describe qué modelos y qué columnas usar para un subárbol de días.

    `day_model` tiene una columna `owner_fk` que apunta al dueño (la
    plantilla o la asignación). `muscle_group_model` y `exercise_model` tienen
    una columna `day_fk` que apunta a `day_model`.
    """

    day_model: type
    muscle_group_model: type
    exercise_model: type
    owner_fk: str
    day_fk: str


TEMPLATE_DESCRIPTOR = DayOwnerDescriptor(
    day_model=models.RoutineTemplateDay,
    muscle_group_model=models.RoutineTemplateDayMuscleGroup,
    exercise_model=models.RoutineTemplateDayExercise,
    owner_fk="template_id",
    day_fk="template_day_id",
)

ASSIGNMENT_DESCRIPTOR = DayOwnerDescriptor(
    day_model=models.RoutineAssignmentDay,
    muscle_group_model=models.RoutineAssignmentDayMuscleGroup,
    exercise_model=models.RoutineAssignmentDayExercise,
    owner_fk="assignment_id",
    day_fk="assignment_day_id",
)


# --- Serialización -----------------------------------------------------------


def day_title(day, muscle_groups: list[str]) -> str:
    """"Día N" o "Día N - <grupos unidos por '/'>": una sola fuente de verdad
    del título, para plantilla y copia."""
    suffix = f" - {'/'.join(muscle_groups)}" if muscle_groups else ""
    return f"Día {day.position}{suffix}"


def serialize_exercise(
    link,
    *,
    logged_provider: LoggedProvider | None = None,
) -> schemas.RoutineTemplateExerciseOut:
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
        rir=link.rir,
        rest_seconds=link.rest_seconds,
        planned_sets=[
            schemas.PlannedSetOut(
                index=item.index,
                weight_kg=item.weight_kg,
                reps=item.reps,
                note=item.note,
                logged=logged_provider(exercise.id, item.index) if logged_provider else None,
            )
            for item in planned
        ],
    )


def serialize_day(
    day,
    *,
    logged_provider_factory: Callable[[str], LoggedProvider] | None = None,
) -> schemas.RoutineTemplateDayOut:
    muscle_groups = [item.muscle_group for item in sorted(day.muscle_groups, key=lambda m: m.sort_order)]
    logged_provider = logged_provider_factory(day.id) if logged_provider_factory else None
    return schemas.RoutineTemplateDayOut(
        day_id=day.id,
        name=day_title(day, muscle_groups),
        muscle_groups=muscle_groups,
        position=day.position,
        exercises=[
            serialize_exercise(link, logged_provider=logged_provider)
            for link in sorted(day.exercises, key=lambda item: item.sort_order)
        ],
    )


# --- Reemplazo completo con identidad explícita -------------------------------


def replace_days(
    db: Session,
    owner_id: str,
    days_payload: list,
    *,
    descriptor: DayOwnerDescriptor,
    current_user_id: str,
) -> list:
    """Reemplazo completo del borrador de días/ejercicios, con identidad
    explícita: `day_id` presente conserva la fila (I2, así lo que la referencia
    no queda huérfano), `None` crea un día nuevo. El orden de las listas **es**
    el dato: la posición del día es su índice + 1 y el `sort_order` del
    ejercicio es su índice. Todo en una sola transacción del llamador: esta
    función no hace `commit()`."""
    existing_days = (
        db.query(descriptor.day_model)
        .filter(getattr(descriptor.day_model, descriptor.owner_fk) == owner_id)
        .all()
    )
    existing_days_by_id = {day.id: day for day in existing_days}

    payload_day_ids = {day.day_id for day in days_payload if day.day_id is not None}
    unknown_ids = payload_day_ids - set(existing_days_by_id.keys())
    if unknown_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Día(s) que no pertenecen a esta rutina: {', '.join(sorted(unknown_ids))}",
        )

    # Días ausentes del payload se borran (cascade: sus grupos musculares y
    # ejercicios se van con ellos).
    for day_id, day in existing_days_by_id.items():
        if day_id not in payload_day_ids:
            db.delete(day)
    db.flush()

    result_days = []
    for position, day_input in enumerate(days_payload, start=1):
        if day_input.day_id is not None:
            day = existing_days_by_id[day_input.day_id]
            day.position = position
        else:
            day = descriptor.day_model(**{descriptor.owner_fk: owner_id, "position": position})
            db.add(day)
            db.flush()

        _replace_muscle_groups(db, day, day_input.muscle_groups, descriptor)
        _replace_exercises(db, day, day_input.exercises, descriptor, current_user_id=current_user_id)
        result_days.append(day)

    return result_days


def _replace_muscle_groups(
    db: Session, day, muscle_groups: list, descriptor: DayOwnerDescriptor
) -> None:
    db.query(descriptor.muscle_group_model).filter(
        getattr(descriptor.muscle_group_model, descriptor.day_fk) == day.id
    ).delete()
    for index, muscle_group in enumerate(muscle_groups):
        db.add(
            descriptor.muscle_group_model(
                **{descriptor.day_fk: day.id, "muscle_group": muscle_group.value, "sort_order": index}
            )
        )


def _replace_exercises(
    db: Session,
    day,
    exercises_input: list,
    descriptor: DayOwnerDescriptor,
    *,
    current_user_id: str,
) -> None:
    """Reglas de base y estrategia: un par nuevo sin `base` toma la constante
    por defecto; un par existente sin `base` conserva la suya. `strategy`
    ausente en un par nuevo es `constant`. Un ejercicio inactivo no se puede
    **agregar** (400), pero uno ya existente sobrevive."""
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
            link = descriptor.exercise_model(
                **{
                    descriptor.day_fk: day.id,
                    "exercise_id": exercise_input.exercise_id,
                    "sort_order": index,
                    "strategy": strategy,
                    "base_sets": base.sets if base else DEFAULT_EXERCISE_BASE_SETS,
                    "base_reps": base.reps if base else DEFAULT_EXERCISE_BASE_REPS,
                    "base_weight_kg": base.weight_kg if base else DEFAULT_EXERCISE_BASE_WEIGHT_KG,
                    "rir": exercise_input.rir,
                    "rest_seconds": exercise_input.rest_seconds,
                    "updated_by_user_id": current_user_id,
                }
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
            # Reemplazo directo (a diferencia de `strategy`/`base`): el
            # borrador manda siempre el estado completo, así que un `None` acá
            # es "le quitaron la prescripción", no "no vino en el request".
            existing_link.rir = exercise_input.rir
            existing_link.rest_seconds = exercise_input.rest_seconds
            existing_link.updated_at = datetime.utcnow()
            existing_link.updated_by_user_id = current_user_id

    for exercise_id, link in existing_by_exercise_id.items():
        if exercise_id not in kept_exercise_ids:
            db.delete(link)


# --- Copia inicial (design D5) -----------------------------------------------


def copy_days(
    db: Session,
    *,
    source_template: models.RoutineTemplate,
    assignment_id: str,
    current_user_id: str,
) -> None:
    """Copia día por día, grupo por grupo y ejercicio por ejercicio de
    `source_template` hacia la copia `assignment_id` (design D5). Fiel: un día
    sin ejercicios o sin grupos musculares se copia igual (vacío). Un
    ejercicio inactivo en el catálogo que ya estaba en la plantilla se copia
    igual (no se puede *agregar*, pero si ya estaba no se cae)."""
    for source_day in sorted(source_template.days, key=lambda item: item.position):
        new_day = models.RoutineAssignmentDay(assignment_id=assignment_id, position=source_day.position)
        db.add(new_day)
        db.flush()

        for muscle_group in sorted(source_day.muscle_groups, key=lambda item: item.sort_order):
            db.add(
                models.RoutineAssignmentDayMuscleGroup(
                    assignment_day_id=new_day.id,
                    muscle_group=muscle_group.muscle_group,
                    sort_order=muscle_group.sort_order,
                )
            )

        for source_link in sorted(source_day.exercises, key=lambda item: item.sort_order):
            db.add(
                models.RoutineAssignmentDayExercise(
                    assignment_day_id=new_day.id,
                    exercise_id=source_link.exercise_id,
                    sort_order=source_link.sort_order,
                    strategy=source_link.strategy,
                    base_sets=source_link.base_sets,
                    base_reps=source_link.base_reps,
                    base_weight_kg=source_link.base_weight_kg,
                    rir=source_link.rir,
                    rest_seconds=source_link.rest_seconds,
                    updated_by_user_id=current_user_id,
                )
            )
