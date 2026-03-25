from collections import defaultdict
from datetime import datetime, timedelta
import textwrap
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..auth import get_current_user, require_role
from ..deps import get_db
from ..models import UserRole
from ..routine_catalog import EXERCISE_LIBRARY, TRAINING_DAYS
from ..utils import now_ar


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


def _pdf_escape(text: str) -> str:
    normalized = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return normalized.encode("latin-1", "replace").decode("latin-1")


def _build_simple_pdf(lines: list[str]) -> bytes:
    content_lines = ["BT", "/F1 12 Tf", "50 790 Td", "16 TL"]
    for line in lines:
        content_lines.append(f"({_pdf_escape(line)}) Tj")
        content_lines.append("T*")
    content_lines.append("ET")
    content_stream = "\n".join(content_lines).encode("latin-1", "replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(content_stream)} >>\nstream\n".encode("latin-1")
        + content_stream
        + b"\nendstream",
    ]

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode("latin-1"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))
    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF".encode(
            "latin-1"
        )
    )
    return bytes(pdf)


def _motivation_for_metrics(log_count: int, attendance_count: int, improvements: int) -> str:
    if improvements >= 3:
        return "Gran momento: ya se nota una evolucion clara en varios ejercicios. Segui asi."
    if log_count >= 12 and attendance_count >= 8:
        return "Excelente constancia. La disciplina que estas sosteniendo ya esta dando resultados."
    if log_count >= 6:
        return "Muy buen avance. Cada registro suma y hace visible el progreso real."
    return "Buen comienzo. Lo importante es sostener el ritmo y seguir registrando cada entrenamiento."


def _collect_progress_snapshot(
    db: Session, client_id: str
) -> tuple[
    models.Client,
    list[models.WorkoutLog],
    int,
    models.Payment | None,
    str,
    list[tuple[str, float, float, float]],
    models.WorkoutLog | None,
    list[models.WorkoutLog],
    float,
    int,
    int,
    datetime | None,
    str,
]:
    client = _get_client_or_404(db, client_id)
    logs = (
        db.query(models.WorkoutLog)
        .options(joinedload(models.WorkoutLog.day), joinedload(models.WorkoutLog.exercise))
        .filter(models.WorkoutLog.client_id == client_id)
        .order_by(models.WorkoutLog.performed_at.asc())
        .all()
    )
    attendance_count = (
        db.query(models.Attendance)
        .filter(models.Attendance.client_id == client_id)
        .count()
    )
    latest_payment = (
        db.query(models.Payment)
        .filter(models.Payment.client_id == client_id)
        .order_by(models.Payment.created_at.desc())
        .first()
    )
    settings = db.query(models.AppSettings).first()
    gym_name = settings.gym_name if settings and settings.gym_name else "Mini Espacio"

    exercise_histories: dict[str, list[models.WorkoutLog]] = defaultdict(list)
    for log in logs:
        exercise_histories[log.exercise_id].append(log)

    improvements: list[tuple[str, float, float, float]] = []
    for history in exercise_histories.values():
        if len(history) < 2:
            continue
        first_weight = history[0].weight_kg or 0
        last_weight = history[-1].weight_kg or 0
        delta = last_weight - first_weight
        if delta > 0:
            improvements.append(
                (
                    history[-1].exercise.name,
                    first_weight,
                    last_weight,
                    delta,
                )
            )

    improvements.sort(key=lambda item: item[3], reverse=True)
    best_log = max(logs, key=lambda item: item.weight_kg, default=None)
    recent_logs = list(reversed(logs[-5:]))
    total_volume = sum((log.sets_count or 0) * (log.reps or 0) * log.weight_kg for log in logs)
    unique_days = len({log.day_id for log in logs})
    unique_exercises = len(exercise_histories)
    last_training = logs[-1].performed_at if logs else None
    motivation = _motivation_for_metrics(len(logs), attendance_count, len(improvements[:3]))

    return (
        client,
        logs,
        attendance_count,
        latest_payment,
        gym_name,
        improvements,
        best_log,
        recent_logs,
        total_volume,
        unique_days,
        unique_exercises,
        last_training,
        motivation,
    )


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


@router.get("/clients/{client_id}/progress-report")
def client_progress_report(
    client_id: str,
    db: Session = Depends(get_db),
):
    _ensure_seed_data(db)
    (
        client,
        logs,
        attendance_count,
        latest_payment,
        gym_name,
        improvements,
        best_log,
        recent_logs,
        total_volume,
        unique_days,
        unique_exercises,
        last_training,
        motivation,
    ) = _collect_progress_snapshot(db, client_id)
    top_improvements = improvements[:3]

    lines: list[str] = []

    def add_line(text: str = ""):
        if not text:
            lines.append(" ")
            return
        wrapped = textwrap.wrap(text, width=82) or [text]
        lines.extend(wrapped)

    add_line(f"{gym_name} - Reporte de progreso")
    add_line(f"Cliente: {client.full_name}")
    add_line(
        f"Emitido: {now_ar().strftime('%d/%m/%Y %H:%M')}  |  Alta: {client.join_date.strftime('%d/%m/%Y')}"
    )
    add_line()
    add_line("Resumen general")
    add_line(f"- Registros de rutina: {len(logs)}")
    add_line(f"- Asistencias acumuladas: {attendance_count}")
    add_line(f"- Dias entrenados con registros: {unique_days}")
    add_line(f"- Ejercicios con historial: {unique_exercises}")
    add_line(f"- Volumen acumulado estimado: {int(total_volume):,}".replace(",", "."))
    add_line(
        f"- Ultimo entrenamiento registrado: {last_training.strftime('%d/%m/%Y %H:%M') if last_training else 'Sin registros todavia'}"
    )
    add_line(
        f"- Ultimo pago: {latest_payment.period_month:02d}/{latest_payment.period_year} por ${latest_payment.amount:,.0f}".replace(
            ",", "."
        )
        if latest_payment
        else "- Ultimo pago: sin pagos registrados"
    )
    add_line()

    add_line("Mejor marca actual")
    if best_log:
        add_line(
            f"- {best_log.exercise.name}: {best_log.weight_kg:g} kg el {best_log.performed_at.strftime('%d/%m/%Y')}"
        )
    else:
        add_line("- Aun no hay registros de cargas para mostrar una mejor marca.")
    add_line()

    add_line("Ejercicios con mejor crecimiento")
    if top_improvements:
        for name, start_weight, end_weight, delta in top_improvements:
            add_line(f"- {name}: de {start_weight:g} kg a {end_weight:g} kg (+{delta:g} kg)")
    else:
        add_line("- Todavia no hay suficiente historial para mostrar mejoras comparativas.")
    add_line()

    add_line("Ultimos avances")
    if recent_logs:
        for log in recent_logs:
            add_line(
                f"- {log.performed_at.strftime('%d/%m/%Y')}: {log.exercise.name} | {log.weight_kg:g} kg | {log.reps or '-'} reps | {log.sets_count or '-'} series"
            )
    else:
        add_line("- Sin avances cargados todavia.")
    add_line()

    add_line("Mensaje de aliento")
    add_line(motivation)
    add_line("Segui registrando cada entrenamiento: ver el progreso ayuda a sostener la motivacion.")

    pdf_bytes = _build_simple_pdf(lines)
    filename = f"progreso-{client.full_name.lower().replace(' ', '-')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/clients/{client_id}/progress-summary", response_model=schemas.ClientProgressSummary)
def client_progress_summary(
    client_id: str,
    db: Session = Depends(get_db),
):
    _ensure_seed_data(db)
    (
        client,
        logs,
        attendance_count,
        _latest_payment,
        gym_name,
        improvements,
        best_log,
        _recent_logs,
        total_volume,
        unique_days,
        unique_exercises,
        last_training,
        motivation,
    ) = _collect_progress_snapshot(db, client_id)

    top_improvement = improvements[0] if improvements else None

    return schemas.ClientProgressSummary(
        client_id=client.id,
        client_name=client.full_name,
        gym_name=gym_name,
        log_count=len(logs),
        attendance_count=attendance_count,
        unique_days=unique_days,
        unique_exercises=unique_exercises,
        total_volume=total_volume,
        last_training=last_training,
        best_exercise_name=best_log.exercise.name if best_log else None,
        best_weight_kg=best_log.weight_kg if best_log else None,
        top_improvement=schemas.ProgressImprovement(
            exercise_name=top_improvement[0],
            start_weight=top_improvement[1],
            end_weight=top_improvement[2],
            delta_weight=top_improvement[3],
        )
        if top_improvement
        else None,
        motivation=motivation,
    )


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

    today_start = now_ar().replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    tomorrow_start = today_start + timedelta(days=1)
    existing_attendance = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.client_id == client_id,
            models.Attendance.checkin_at >= today_start,
            models.Attendance.checkin_at < tomorrow_start,
        )
        .first()
    )
    if not existing_attendance:
        db.add(
            models.Attendance(
                client_id=client_id,
                coach_id=current_user.id if current_user.role == models.UserRole.coach else None,
                checkin_at=now_ar().replace(tzinfo=None),
            )
        )

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


@router.patch("/clients/{client_id}/logs/{log_id}", response_model=schemas.WorkoutLogOut)
def update_workout_log(
    client_id: str,
    log_id: str,
    payload: schemas.WorkoutLogUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_seed_data(db)
    _get_client_or_404(db, client_id)

    log = (
        db.query(models.WorkoutLog)
        .options(joinedload(models.WorkoutLog.day), joinedload(models.WorkoutLog.exercise))
        .filter(
            models.WorkoutLog.id == log_id,
            models.WorkoutLog.client_id == client_id,
        )
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Registro de rutina no encontrado")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(log, field, value)
    log.created_by_user_id = current_user.id

    db.commit()
    db.refresh(log)

    return schemas.WorkoutLogOut(
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


@router.delete("/clients/{client_id}/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout_log(
    client_id: str,
    log_id: str,
    db: Session = Depends(get_db),
):
    _ensure_seed_data(db)
    _get_client_or_404(db, client_id)

    log = (
        db.query(models.WorkoutLog)
        .filter(
            models.WorkoutLog.id == log_id,
            models.WorkoutLog.client_id == client_id,
        )
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Registro de rutina no encontrado")

    db.delete(log)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
