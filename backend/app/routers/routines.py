from collections import defaultdict
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..auth import get_current_user, require_role
from ..deps import get_db
from ..models import UserRole
from ..routine_catalog import EXERCISE_LIBRARY, TRAINING_DAYS


router = APIRouter(
    prefix="/routines",
    tags=["routines"],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)


def _day_ids_for_muscle_group(muscle_group: str) -> list[str]:
    return [
        day["id"]
        for day in TRAINING_DAYS
        if muscle_group in day["muscle_groups"]
    ]


def _serialize_day(day: models.TrainingDay) -> schemas.RoutineDayOut:
    return schemas.RoutineDayOut(
        id=day.id,
        name=day.name,
        muscle_groups=[part.strip() for part in day.muscle_groups.split(",") if part.strip()],
        day_order=day.day_order,
        exercises=[
            schemas.RoutineExerciseOption(
                exercise_id=link.exercise.id,
                name=link.exercise.name,
                muscle_group=link.exercise.muscle_group,
                description=link.exercise.description,
                is_active=link.is_active,
                sort_order=link.sort_order,
            )
            for link in sorted(day.exercises, key=lambda item: item.sort_order)
        ],
    )


def _serialize_manage_exercise(exercise: models.Exercise) -> schemas.RoutineExerciseManageOut:
    return schemas.RoutineExerciseManageOut(
        id=exercise.id,
        name=exercise.name,
        muscle_group=exercise.muscle_group,
        description=exercise.description,
        is_active=exercise.is_active,
        day_ids=sorted(link.day_id for link in exercise.day_links),
    )


def _sync_exercise_day_links(
    db: Session,
    exercise_id: str,
    muscle_group: str,
    *,
    preserve_active: bool = True,
) -> None:
    desired_day_ids = set(_day_ids_for_muscle_group(muscle_group))
    existing_links = (
        db.query(models.TrainingDayExercise)
        .filter(models.TrainingDayExercise.exercise_id == exercise_id)
        .all()
    )
    existing_by_day = {link.day_id: link for link in existing_links}

    for day_id in desired_day_ids:
        if day_id in existing_by_day:
            continue

        sort_order = (
            db.query(models.TrainingDayExercise)
            .filter(models.TrainingDayExercise.day_id == day_id)
            .count()
            + 1
        )
        db.add(
            models.TrainingDayExercise(
                day_id=day_id,
                exercise_id=exercise_id,
                sort_order=sort_order,
                is_active=not preserve_active,
            )
        )

    for day_id, link in existing_by_day.items():
        if day_id not in desired_day_ids:
            db.delete(link)


def _ensure_seed_data(db: Session) -> None:
    existing_days = {item.id: item for item in db.query(models.TrainingDay).all()}
    for index, day in enumerate(TRAINING_DAYS, start=1):
        existing_day = existing_days.get(day["id"])
        if existing_day:
            existing_day.name = day["name"]
            existing_day.muscle_groups = ", ".join(day["muscle_groups"])
            existing_day.day_order = index
        else:
            db.add(
                models.TrainingDay(
                    id=day["id"],
                    name=day["name"],
                    muscle_groups=", ".join(day["muscle_groups"]),
                    day_order=index,
                )
            )

    existing_exercises = {item.id: item for item in db.query(models.Exercise).all()}
    for exercise in EXERCISE_LIBRARY:
        if exercise["id"] not in existing_exercises:
            db.add(
                models.Exercise(
                    id=exercise["id"],
                    name=exercise["name"],
                    muscle_group=exercise["muscle_group"],
                    description=exercise.get("description"),
                    is_active=True,
                )
            )

    db.flush()

    existing_links_by_key = {
        (item.day_id, item.exercise_id): item
        for item in db.query(models.TrainingDayExercise).all()
    }
    desired_link_keys: set[tuple[str, str]] = set()

    for day in TRAINING_DAYS:
        allowed_groups = set(day["muscle_groups"])
        eligible_exercises = [
            exercise
            for exercise in EXERCISE_LIBRARY
            if exercise["muscle_group"] in allowed_groups
        ]
        for sort_order, exercise in enumerate(eligible_exercises, start=1):
            key = (day["id"], exercise["id"])
            desired_link_keys.add(key)
            existing_link = existing_links_by_key.get(key)
            if existing_link:
                existing_link.sort_order = sort_order
            else:
                db.add(
                    models.TrainingDayExercise(
                        day_id=day["id"],
                        exercise_id=exercise["id"],
                        sort_order=sort_order,
                        is_active=exercise["id"] in day["default_active_ids"],
                    )
                )

    seeded_exercise_ids = {exercise["id"] for exercise in EXERCISE_LIBRARY}
    for key, link in existing_links_by_key.items():
        if key not in desired_link_keys and link.exercise_id in seeded_exercise_ids:
            db.delete(link)

    db.commit()


def _get_day_or_404(db: Session, day_id: str) -> models.TrainingDay:
    day = db.get(models.TrainingDay, day_id)
    if not day:
        raise HTTPException(status_code=404, detail="Dia de rutina no encontrado")
    return day


def _get_client_or_404(db: Session, client_id: str) -> models.Client:
    client = db.get(models.Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return client


@router.get("/catalog", response_model=list[schemas.RoutineCatalogGroup])
def routine_catalog(db: Session = Depends(get_db)):
    _ensure_seed_data(db)

    groups: dict[str, list[schemas.RoutineCatalogExercise]] = defaultdict(list)
    exercises = (
        db.query(models.Exercise)
        .filter(models.Exercise.is_active.is_(True))
        .order_by(models.Exercise.muscle_group.asc(), models.Exercise.name.asc())
        .all()
    )
    for exercise in exercises:
        groups[exercise.muscle_group].append(
            schemas.RoutineCatalogExercise(
                id=exercise.id,
                name=exercise.name,
                muscle_group=exercise.muscle_group,
                description=exercise.description,
            )
        )

    return [
        schemas.RoutineCatalogGroup(muscle_group=muscle_group, exercises=items)
        for muscle_group, items in sorted(groups.items(), key=lambda item: item[0])
    ]


@router.get("/days", response_model=list[schemas.RoutineDayOut])
def routine_days(db: Session = Depends(get_db)):
    _ensure_seed_data(db)

    days = (
        db.query(models.TrainingDay)
        .options(joinedload(models.TrainingDay.exercises).joinedload(models.TrainingDayExercise.exercise))
        .order_by(models.TrainingDay.day_order.asc())
        .all()
    )
    return [_serialize_day(day) for day in days]


@router.get("/exercises", response_model=list[schemas.RoutineExerciseManageOut])
def routine_exercises(db: Session = Depends(get_db)):
    _ensure_seed_data(db)

    exercises = (
        db.query(models.Exercise)
        .options(joinedload(models.Exercise.day_links))
        .order_by(models.Exercise.muscle_group.asc(), models.Exercise.name.asc())
        .all()
    )
    return [_serialize_manage_exercise(exercise) for exercise in exercises]


@router.post(
    "/exercises",
    response_model=schemas.RoutineExerciseManageOut,
    status_code=status.HTTP_201_CREATED,
)
def create_routine_exercise(
    payload: schemas.RoutineExerciseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(UserRole.owner)),
):
    _ensure_seed_data(db)

    exercise = models.Exercise(
        id=f"custom-{uuid4()}",
        name=payload.name,
        muscle_group=payload.muscle_group,
        description=payload.description,
        is_active=payload.is_active,
    )
    db.add(exercise)
    db.flush()
    _sync_exercise_day_links(db, exercise.id, exercise.muscle_group, preserve_active=True)
    db.commit()

    created = (
        db.query(models.Exercise)
        .options(joinedload(models.Exercise.day_links))
        .filter(models.Exercise.id == exercise.id)
        .first()
    )
    return _serialize_manage_exercise(created)


@router.put("/exercises/{exercise_id}", response_model=schemas.RoutineExerciseManageOut)
def update_routine_exercise(
    exercise_id: str,
    payload: schemas.RoutineExerciseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role(UserRole.owner)),
):
    _ensure_seed_data(db)

    exercise = (
        db.query(models.Exercise)
        .options(joinedload(models.Exercise.day_links))
        .filter(models.Exercise.id == exercise_id)
        .first()
    )
    if not exercise:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(exercise, field, value)

    if "muscle_group" in updates:
        _sync_exercise_day_links(db, exercise.id, exercise.muscle_group, preserve_active=True)
    if updates.get("is_active") is False:
        for link in exercise.day_links:
            link.is_active = False

    db.commit()
    refreshed = (
        db.query(models.Exercise)
        .options(joinedload(models.Exercise.day_links))
        .filter(models.Exercise.id == exercise.id)
        .first()
    )
    return _serialize_manage_exercise(refreshed)


@router.put("/days/{day_id}/selection", response_model=schemas.RoutineDayOut)
def update_day_selection(
    day_id: str,
    payload: schemas.RoutineDaySelectionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_seed_data(db)
    day = (
        db.query(models.TrainingDay)
        .options(joinedload(models.TrainingDay.exercises).joinedload(models.TrainingDayExercise.exercise))
        .filter(models.TrainingDay.id == day_id)
        .first()
    )
    if not day:
        raise HTTPException(status_code=404, detail="Dia de rutina no encontrado")

    selected = payload.exercise_ids
    available_ids = {link.exercise_id for link in day.exercises}
    invalid = [exercise_id for exercise_id in selected if exercise_id not in available_ids]
    if invalid:
        raise HTTPException(status_code=400, detail="Hay ejercicios invalidos para este dia")

    selected_order = {exercise_id: index for index, exercise_id in enumerate(selected, start=1)}
    remainder = len(selected) + 1
    for link in day.exercises:
        link.is_active = link.exercise_id in selected_order
        link.assigned_by_user_id = current_user.id
        if link.exercise_id in selected_order:
            link.sort_order = selected_order[link.exercise_id]
        else:
            link.sort_order = remainder
            remainder += 1

    db.commit()

    refreshed_day = (
        db.query(models.TrainingDay)
        .options(joinedload(models.TrainingDay.exercises).joinedload(models.TrainingDayExercise.exercise))
        .filter(models.TrainingDay.id == day_id)
        .first()
    )
    return _serialize_day(refreshed_day)


@router.get("/clients/{client_id}/overview", response_model=list[schemas.RoutineDayProgress])
def client_routine_overview(client_id: str, db: Session = Depends(get_db)):
    _ensure_seed_data(db)
    _get_client_or_404(db, client_id)

    days = (
        db.query(models.TrainingDay)
        .options(joinedload(models.TrainingDay.exercises))
        .order_by(models.TrainingDay.day_order.asc())
        .all()
    )
    logs = db.query(models.WorkoutLog).filter(models.WorkoutLog.client_id == client_id).all()

    by_day: dict[str, list[models.WorkoutLog]] = defaultdict(list)
    for log in logs:
        by_day[log.day_id].append(log)

    result: list[schemas.RoutineDayProgress] = []
    for day in days:
        day_logs = by_day.get(day.id, [])
        last_performed_at = max((log.performed_at for log in day_logs), default=None)
        result.append(
            schemas.RoutineDayProgress(
                day_id=day.id,
                day_name=day.name,
                muscle_groups=[part.strip() for part in day.muscle_groups.split(",") if part.strip()],
                active_exercise_count=sum(1 for link in day.exercises if link.is_active),
                log_count=len(day_logs),
                last_performed_at=last_performed_at,
            )
        )
    return result


@router.get("/clients/{client_id}/logs", response_model=list[schemas.WorkoutLogOut])
def client_workout_logs(
    client_id: str,
    day_id: str | None = Query(default=None),
    limit: int = Query(default=40, ge=1, le=200),
    db: Session = Depends(get_db),
):
    _ensure_seed_data(db)
    _get_client_or_404(db, client_id)

    query = (
        db.query(models.WorkoutLog)
        .options(joinedload(models.WorkoutLog.day), joinedload(models.WorkoutLog.exercise))
        .filter(models.WorkoutLog.client_id == client_id)
    )
    if day_id:
        query = query.filter(models.WorkoutLog.day_id == day_id)

    logs = query.order_by(models.WorkoutLog.performed_at.desc()).limit(limit).all()
    return [
        schemas.WorkoutLogOut(
            id=log.id,
            client_id=log.client_id,
            day_id=log.day_id,
            day_name=log.day.name,
            exercise_id=log.exercise_id,
            exercise_name=log.exercise.name,
            muscle_group=log.exercise.muscle_group,
            sets_count=log.sets_count,
            reps=log.reps,
            weight_kg=log.weight_kg,
            note=log.note,
            performed_at=log.performed_at,
        )
        for log in logs
    ]


@router.post(
    "/clients/{client_id}/logs",
    response_model=schemas.WorkoutLogOut,
    status_code=status.HTTP_201_CREATED,
)
def create_workout_log(
    client_id: str,
    payload: schemas.WorkoutLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_seed_data(db)
    _get_client_or_404(db, client_id)
    day = _get_day_or_404(db, payload.day_id)

    link = (
        db.query(models.TrainingDayExercise)
        .options(joinedload(models.TrainingDayExercise.exercise))
        .filter(
            models.TrainingDayExercise.day_id == payload.day_id,
            models.TrainingDayExercise.exercise_id == payload.exercise_id,
        )
        .first()
    )
    if not link or not link.is_active:
        raise HTTPException(status_code=400, detail="Ese ejercicio no esta activo para el dia seleccionado")

    log = models.WorkoutLog(
        client_id=client_id,
        day_id=payload.day_id,
        exercise_id=payload.exercise_id,
        sets_count=payload.sets_count,
        reps=payload.reps,
        weight_kg=payload.weight_kg,
        note=payload.note,
        performed_at=datetime.utcnow(),
        created_by_user_id=current_user.id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    exercise = db.get(models.Exercise, payload.exercise_id)
    return schemas.WorkoutLogOut(
        id=log.id,
        client_id=log.client_id,
        day_id=log.day_id,
        day_name=day.name,
        exercise_id=log.exercise_id,
        exercise_name=exercise.name,
        muscle_group=exercise.muscle_group,
        sets_count=log.sets_count,
        reps=log.reps,
        weight_kg=log.weight_kg,
        note=log.note,
        performed_at=log.performed_at,
    )
