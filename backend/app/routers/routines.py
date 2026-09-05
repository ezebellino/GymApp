from collections import defaultdict
from datetime import datetime, timedelta
import textwrap
from uuid import uuid4
import logging

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
)

log = logging.getLogger("request")


def _require_member(user: models.User) -> models.User:
    """El propio miembro autenticado. Ya no hay un `Client` separado que resolver
    (design.md, decision 5: el miembro *es* el usuario, no hace falta buscar nada)."""
    if user.role != UserRole.member:
        raise HTTPException(status_code=403, detail="Solo disponible para miembros")
    return user


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


def _get_user_or_404(db: Session, user_id: str) -> models.User:
    obj = db.get(models.User, user_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return obj


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


def _pdf_text(
    commands: list[str],
    *,
    x: float,
    y: float,
    size: int,
    text: str,
    color: tuple[float, float, float] = (1, 1, 1),
    font: str = "F1",
):
    commands.append(
        f"BT /{font} {size} Tf {color[0]:.3f} {color[1]:.3f} {color[2]:.3f} rg 1 0 0 1 {x:.1f} {y:.1f} Tm ({_pdf_escape(text)}) Tj ET"
    )


def _pdf_rect(
    commands: list[str],
    *,
    x: float,
    y: float,
    w: float,
    h: float,
    fill: tuple[float, float, float],
):
    commands.append(f"{fill[0]:.3f} {fill[1]:.3f} {fill[2]:.3f} rg {x:.1f} {y:.1f} {w:.1f} {h:.1f} re f")


def _build_styled_progress_pdf(
    *,
    gym_name: str,
    client_name: str,
    join_date: datetime,
    attendance_count: int,
    log_count: int,
    unique_days: int,
    unique_exercises: int,
    total_volume: float,
    last_training: datetime | None,
    best_log: models.WorkoutLog | None,
    top_improvements: list[tuple[str, float, float, float]],
    motivation: str,
    score: int,
    chart_title: str,
    chart_points: list[tuple[str, float]],
) -> bytes:
    commands: list[str] = []

    amber = (0.980, 0.800, 0.082)
    cream = (1.000, 0.969, 0.929)
    orange = (0.976, 0.451, 0.086)
    emerald = (0.204, 0.827, 0.600)
    white = (0.980, 0.980, 0.980)
    zinc_950 = (0.043, 0.043, 0.043)
    zinc_900 = (0.090, 0.090, 0.102)
    zinc_800 = (0.145, 0.145, 0.165)
    zinc_500 = (0.635, 0.635, 0.659)

    _pdf_rect(commands, x=0, y=0, w=595, h=842, fill=zinc_950)
    _pdf_rect(commands, x=44, y=770, w=110, h=26, fill=amber)
    _pdf_text(commands, x=58, y=779, size=11, text="REPORTE GYM", color=zinc_950, font="F1")
    _pdf_text(commands, x=44, y=732, size=24, text=gym_name[:32], color=white, font="F1")
    _pdf_text(commands, x=44, y=707, size=17, text="PROGRESO Y CRECIMIENTO", color=cream, font="F1")
    _pdf_text(
        commands,
        x=44,
        y=688,
        size=10,
        text=f"Cliente: {client_name} | Alta: {join_date.strftime('%d/%m/%Y')} | Emitido: {now_ar().strftime('%d/%m/%Y %H:%M')}",
        color=zinc_500,
        font="F1",
    )

    cards = [
        ("ASISTENCIAS", str(attendance_count), "presencias registradas"),
        ("RUTINAS", str(log_count), "cargas acumuladas"),
        ("DIAS ACTIVOS", str(unique_days), "jornadas con avances"),
        ("VOLUMEN", f"{int(total_volume):,}".replace(",", "."), "carga total estimada"),
    ]
    start_x = 44
    start_y = 595
    card_w = 118
    card_h = 70
    gap = 14
    for index, (label, value, hint) in enumerate(cards):
        x = start_x + index * (card_w + gap)
        _pdf_rect(commands, x=x, y=start_y, w=card_w, h=card_h, fill=zinc_800)
        _pdf_text(commands, x=x + 10, y=start_y + 50, size=8, text=label, color=zinc_500, font="F1")
        _pdf_text(commands, x=x + 10, y=start_y + 28, size=18, text=value[:12], color=white, font="F1")
        _pdf_text(commands, x=x + 10, y=start_y + 11, size=8, text=hint[:22], color=zinc_500, font="F1")

    _pdf_rect(commands, x=44, y=505, w=507, h=72, fill=zinc_800)
    _pdf_text(commands, x=58, y=553, size=13, text="INDICE GENERAL DE PROGRESO", color=white, font="F1")
    _pdf_text(
        commands,
        x=58,
        y=537,
        size=9,
        text="Una lectura simple del momento actual: constancia, asistencia y mejoras de carga.",
        color=zinc_500,
        font="F1",
    )
    _pdf_rect(commands, x=58, y=518, w=320, h=10, fill=zinc_900)
    _pdf_rect(
        commands,
        x=58,
        y=518,
        w=max(26, 3.2 * score),
        h=10,
        fill=emerald if score >= 65 else amber,
    )
    _pdf_text(commands, x=465, y=535, size=24, text=f"{score}/100", color=white, font="F1")

    _pdf_rect(commands, x=44, y=278, w=507, h=205, fill=zinc_800)
    _pdf_text(commands, x=58, y=455, size=13, text="METRICA DE CRECIMIENTO", color=white, font="F1")
    _pdf_text(commands, x=58, y=439, size=9, text=chart_title[:84], color=zinc_500, font="F1")

    graph_x = 62
    graph_y = 306
    graph_w = 470
    graph_h = 102
    commands.append(f"0.250 0.250 0.270 RG {graph_x:.1f} {graph_y:.1f} m {graph_x:.1f} {graph_y + graph_h:.1f} l S")
    commands.append(f"0.250 0.250 0.270 RG {graph_x:.1f} {graph_y:.1f} m {graph_x + graph_w:.1f} {graph_y:.1f} l S")

    if chart_points:
        max_value = max(point[1] for point in chart_points) or 1
        step = graph_w / max(len(chart_points), 1)
        bar_w = min(38, step * 0.56)
        for index, (label, value) in enumerate(chart_points):
            bar_h = max(8, (value / max_value) * graph_h)
            x = graph_x + index * step + (step - bar_w) / 2
            fill = amber if index % 2 == 0 else orange
            _pdf_rect(commands, x=x, y=graph_y, w=bar_w, h=bar_h, fill=fill)
            _pdf_text(commands, x=x + 2, y=graph_y - 12, size=8, text=label[:8], color=zinc_500, font="F1")
            _pdf_text(commands, x=x + 2, y=graph_y + bar_h + 5, size=8, text=f"{value:g}", color=white, font="F1")
    else:
        _pdf_text(
            commands,
            x=74,
            y=354,
            size=10,
            text="Todavia no hay suficientes datos para graficar un crecimiento confiable.",
            color=zinc_500,
            font="F1",
        )

    _pdf_rect(commands, x=44, y=104, w=247, h=150, fill=zinc_800)
    _pdf_text(commands, x=58, y=228, size=13, text="DESTACADOS DE FUERZA", color=white, font="F1")
    if best_log:
        _pdf_text(
            commands,
            x=58,
            y=204,
            size=10,
            text=f"Mejor marca: {best_log.exercise.name[:22]} - {best_log.weight_kg:g} kg",
            color=cream,
            font="F1",
        )
    else:
        _pdf_text(commands, x=58, y=204, size=10, text="Mejor marca: sin registros todavia", color=cream, font="F1")
    if top_improvements:
        for index, (name, start_weight, end_weight, delta) in enumerate(top_improvements[:3]):
            _pdf_text(
                commands,
                x=58,
                y=178 - index * 18,
                size=9,
                text=f"+{delta:g} kg en {name[:18]} ({start_weight:g} -> {end_weight:g})",
                color=zinc_500,
                font="F1",
            )
    else:
        _pdf_text(
            commands,
            x=58,
            y=178,
            size=9,
            text="Aun no hay mejoras comparativas suficientes.",
            color=zinc_500,
            font="F1",
        )
    _pdf_text(
        commands,
        x=58,
        y=124,
        size=9,
        text=f"Ejercicios trabajados: {unique_exercises} | Ultimo entreno: {last_training.strftime('%d/%m/%Y') if last_training else 'sin datos'}",
        color=zinc_500,
        font="F1",
    )

    _pdf_rect(commands, x=304, y=104, w=247, h=150, fill=zinc_800)
    _pdf_text(commands, x=318, y=228, size=13, text="MENSAJE DE ALIENTO", color=white, font="F1")
    wrapped = textwrap.wrap(motivation, width=32)[:4]
    for index, line in enumerate(wrapped):
        _pdf_text(commands, x=318, y=198 - index * 16, size=10, text=line, color=cream if index == 0 else zinc_500, font="F1")
    _pdf_text(
        commands,
        x=318,
        y=124,
        size=9,
        text="Cada carga registrada convierte el esfuerzo en avance visible.",
        color=zinc_500,
        font="F1",
    )

    _pdf_text(
        commands,
        x=44,
        y=78,
        size=8,
        text="Mini Espacio | Seguimiento de progreso | Entrenamiento, constancia y evolucion real.",
        color=zinc_500,
        font="F1",
    )

    content_stream = "\n".join(commands).encode("latin-1", "replace")
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


# Metas que completan cada componente del score. Coinciden con los umbrales de
# `_motivation_for_metrics` ("excelente constancia" = 12 registros y 8 asistencias, "gran
# momento" = 3 mejoras) para que el numero y el texto del PDF cuenten la misma historia.
_SCORE_LOG_GOAL = 12
_SCORE_ATTENDANCE_GOAL = 8
_SCORE_IMPROVEMENT_GOAL = 3


def _progress_score(log_count: int, attendance_count: int, improvements: int) -> int:
    """Puntaje 0-100 del reporte de progreso: 40 pts por registros, 30 por asistencia,
    30 por ejercicios con mejora. Cada componente satura en su meta."""
    log_points = 40 * min(max(log_count, 0), _SCORE_LOG_GOAL) / _SCORE_LOG_GOAL
    attendance_points = 30 * min(max(attendance_count, 0), _SCORE_ATTENDANCE_GOAL) / _SCORE_ATTENDANCE_GOAL
    improvement_points = 30 * min(max(improvements, 0), _SCORE_IMPROVEMENT_GOAL) / _SCORE_IMPROVEMENT_GOAL
    return min(100, round(log_points + attendance_points + improvement_points))


def _motivation_for_metrics(log_count: int, attendance_count: int, improvements: int) -> str:
    if improvements >= 3:
        return "Gran momento: ya se nota una evolucion clara en varios ejercicios. Segui asi."
    if log_count >= 12 and attendance_count >= 8:
        return "Excelente constancia. La disciplina que estas sosteniendo ya esta dando resultados."
    if log_count >= 6:
        return "Muy buen avance. Cada registro suma y hace visible el progreso real."
    return "Buen comienzo. Lo importante es sostener el ritmo y seguir registrando cada entrenamiento."


def _collect_progress_snapshot(
    db: Session, user_id: str
) -> tuple[
    models.User,
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
    client = _get_user_or_404(db, user_id)
    logs = (
        db.query(models.WorkoutLog)
        .options(joinedload(models.WorkoutLog.day), joinedload(models.WorkoutLog.exercise))
        .filter(models.WorkoutLog.user_id == user_id)
        .order_by(models.WorkoutLog.performed_at.asc())
        .all()
    )
    attendance_count = (
        db.query(models.Attendance)
        .filter(models.Attendance.user_id == user_id)
        .count()
    )
    latest_payment = (
        db.query(models.Payment)
        .filter(models.Payment.user_id == user_id)
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


@router.get(
    "/catalog",
    response_model=list[schemas.RoutineCatalogGroup],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
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


@router.get(
    "/days",
    response_model=list[schemas.RoutineDayOut],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
def routine_days(db: Session = Depends(get_db)):
    _ensure_seed_data(db)

    days = (
        db.query(models.TrainingDay)
        .options(joinedload(models.TrainingDay.exercises).joinedload(models.TrainingDayExercise.exercise))
        .order_by(models.TrainingDay.day_order.asc())
        .all()
    )
    return [_serialize_day(day) for day in days]


@router.get(
    "/exercises",
    response_model=list[schemas.RoutineExerciseManageOut],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
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
    dependencies=[Depends(require_role(UserRole.owner))],
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


@router.put(
    "/exercises/{exercise_id}",
    response_model=schemas.RoutineExerciseManageOut,
    dependencies=[Depends(require_role(UserRole.owner))],
)
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


@router.put(
    "/days/{day_id}/selection",
    response_model=schemas.RoutineDayOut,
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
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


@router.get(
    "/users/{user_id}/overview",
    response_model=list[schemas.RoutineDayProgress],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
def user_routine_overview(user_id: str, db: Session = Depends(get_db)):
    _ensure_seed_data(db)
    _get_user_or_404(db, user_id)

    days = (
        db.query(models.TrainingDay)
        .options(joinedload(models.TrainingDay.exercises))
        .order_by(models.TrainingDay.day_order.asc())
        .all()
    )
    logs = db.query(models.WorkoutLog).filter(models.WorkoutLog.user_id == user_id).all()

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


@router.get(
    "/users/{user_id}/logs",
    response_model=list[schemas.WorkoutLogOut],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
def user_workout_logs(
    user_id: str,
    day_id: str | None = Query(default=None),
    limit: int = Query(default=40, ge=1, le=200),
    db: Session = Depends(get_db),
):
    _ensure_seed_data(db)
    _get_user_or_404(db, user_id)

    query = (
        db.query(models.WorkoutLog)
        .options(joinedload(models.WorkoutLog.day), joinedload(models.WorkoutLog.exercise))
        .filter(models.WorkoutLog.user_id == user_id)
    )
    if day_id:
        query = query.filter(models.WorkoutLog.day_id == day_id)

    logs = query.order_by(models.WorkoutLog.performed_at.desc()).limit(limit).all()
    return [
        schemas.WorkoutLogOut(
            id=log.id,
            user_id=log.user_id,
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


@router.get(
    "/users/{user_id}/progress-report",
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
def user_progress_report(
    user_id: str,
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
    ) = _collect_progress_snapshot(db, user_id)
    top_improvements = improvements[:3]
    score = _progress_score(len(logs), attendance_count, len(top_improvements))

    if top_improvements:
        target_name = top_improvements[0][0]
        chart_history = [
            log for log in logs if log.exercise.name == target_name
        ][-6:]
        chart_title = f"Crecimiento reciente en {target_name}"
        chart_points = [
            (log.performed_at.strftime("%d/%m"), log.weight_kg) for log in chart_history
        ]
    else:
        recent_chart_logs = logs[-6:]
        chart_title = "Ultimas cargas registradas"
        chart_points = [
            (log.performed_at.strftime("%d/%m"), log.weight_kg) for log in recent_chart_logs
        ]

    lines: list[str] = []

    def add_line(text: str = ""):
        if not text:
            lines.append(" ")
            return
        wrapped = textwrap.wrap(text, width=82) or [text]
        lines.extend(wrapped)

    add_line(f"{gym_name} - Reporte de progreso")
    member_since = client.membership_start_date or client.created_at
    add_line(f"Cliente: {client.full_name}")
    add_line(
        f"Emitido: {now_ar().strftime('%d/%m/%Y %H:%M')}  |  Alta: {member_since.strftime('%d/%m/%Y')}"
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

    try:
        pdf_bytes = _build_styled_progress_pdf(
            gym_name=gym_name,
            client_name=client.full_name,
            join_date=client.membership_start_date or client.created_at,
            attendance_count=attendance_count,
            log_count=len(logs),
            unique_days=unique_days,
            unique_exercises=unique_exercises,
            total_volume=total_volume,
            last_training=last_training,
            best_log=best_log,
            top_improvements=top_improvements,
            motivation=motivation,
            score=score,
            chart_title=chart_title,
            chart_points=chart_points,
        )
        if not pdf_bytes:
            pdf_bytes = _build_simple_pdf(lines)
    except Exception:
        log.exception("Error generando PDF enriquecido de progreso para user_id=%s", user_id)
        pdf_bytes = _build_simple_pdf(lines)
    filename = f"progreso-{client.full_name.lower().replace(' ', '-')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/users/{user_id}/progress-summary",
    response_model=schemas.UserProgressSummary,
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
def user_progress_summary(
    user_id: str,
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
    ) = _collect_progress_snapshot(db, user_id)

    top_improvement = improvements[0] if improvements else None

    return schemas.UserProgressSummary(
        user_id=client.id,
        user_name=client.full_name,
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
    "/users/{user_id}/logs",
    response_model=schemas.WorkoutLogOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
def create_workout_log(
    user_id: str,
    payload: schemas.WorkoutLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_seed_data(db)
    target = _get_user_or_404(db, user_id)
    if target.membership_status != models.MembershipStatus.active:
        raise HTTPException(
            status_code=400, detail="El usuario no tiene una membresía activa"
        )
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
        user_id=user_id,
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
            models.Attendance.user_id == user_id,
            models.Attendance.checkin_at >= today_start,
            models.Attendance.checkin_at < tomorrow_start,
        )
        .first()
    )
    if not existing_attendance:
        db.add(
            models.Attendance(
                user_id=user_id,
                coach_id=current_user.id if current_user.role == models.UserRole.coach else None,
                checkin_at=now_ar().replace(tzinfo=None),
            )
        )

    db.commit()
    db.refresh(log)

    exercise = db.get(models.Exercise, payload.exercise_id)
    return schemas.WorkoutLogOut(
        id=log.id,
        user_id=log.user_id,
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


@router.patch(
    "/users/{user_id}/logs/{log_id}",
    response_model=schemas.WorkoutLogOut,
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
def update_workout_log(
    user_id: str,
    log_id: str,
    payload: schemas.WorkoutLogUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_seed_data(db)
    _get_user_or_404(db, user_id)

    log = (
        db.query(models.WorkoutLog)
        .options(joinedload(models.WorkoutLog.day), joinedload(models.WorkoutLog.exercise))
        .filter(
            models.WorkoutLog.id == log_id,
            models.WorkoutLog.user_id == user_id,
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
        user_id=log.user_id,
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


@router.delete(
    "/users/{user_id}/logs/{log_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
def delete_workout_log(
    user_id: str,
    log_id: str,
    db: Session = Depends(get_db),
):
    _ensure_seed_data(db)
    _get_user_or_404(db, user_id)

    log = (
        db.query(models.WorkoutLog)
        .filter(
            models.WorkoutLog.id == log_id,
            models.WorkoutLog.user_id == user_id,
        )
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Registro de rutina no encontrado")

    db.delete(log)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/my/profile",
    response_model=schemas.UserOut,
    dependencies=[Depends(require_role(UserRole.member))],
)
def my_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    member = _require_member(current_user)
    from .users import _serialize_user_single  # import diferido: evita ciclo de módulos

    return _serialize_user_single(db, member)


@router.get(
    "/my/days",
    response_model=list[schemas.RoutineDayOut],
    dependencies=[Depends(require_role(UserRole.member))],
)
def my_routine_days(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_member(current_user)
    _ensure_seed_data(db)

    days = (
        db.query(models.TrainingDay)
        .options(joinedload(models.TrainingDay.exercises).joinedload(models.TrainingDayExercise.exercise))
        .order_by(models.TrainingDay.day_order.asc())
        .all()
    )
    return [_serialize_day(day) for day in days]


@router.get(
    "/my/overview",
    response_model=list[schemas.RoutineDayProgress],
    dependencies=[Depends(require_role(UserRole.member))],
)
def my_routine_overview(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    member = _require_member(current_user)
    return user_routine_overview(member.id, db)


@router.get(
    "/my/logs",
    response_model=list[schemas.WorkoutLogOut],
    dependencies=[Depends(require_role(UserRole.member))],
)
def my_workout_logs(
    day_id: str | None = Query(default=None),
    limit: int = Query(default=40, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    member = _require_member(current_user)
    return user_workout_logs(member.id, day_id, limit, db)


@router.post(
    "/my/logs",
    response_model=schemas.WorkoutLogOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.member))],
)
def create_my_workout_log(
    payload: schemas.WorkoutLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    member = _require_member(current_user)
    return create_workout_log(member.id, payload, db, current_user)


@router.patch(
    "/my/logs/{log_id}",
    response_model=schemas.WorkoutLogOut,
    dependencies=[Depends(require_role(UserRole.member))],
)
def update_my_workout_log(
    log_id: str,
    payload: schemas.WorkoutLogUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    member = _require_member(current_user)
    return update_workout_log(member.id, log_id, payload, db, current_user)


@router.delete(
    "/my/logs/{log_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(UserRole.member))],
)
def delete_my_workout_log(
    log_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    member = _require_member(current_user)
    return delete_workout_log(member.id, log_id, db)
