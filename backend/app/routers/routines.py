from collections import defaultdict
from datetime import datetime, timedelta
import textwrap
import unicodedata
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..auth import get_current_user, require_role
from ..deps import get_db
from ..models import UserRole
from ..progression import plan_sets
from ..utils import now_ar


router = APIRouter(
    prefix="/routines",
    tags=["routines"],
)

log = logging.getLogger("request")


def _normalize_exercise_name(name: str) -> str:
    """NFC + strip + casefold, mismo criterio que `_normalize_name` de
    `membership_plans.py` (`exercise-catalog`, design D7). Necesario acá porque
    `Exercise.name_normalized` es NOT NULL + UNIQUE (design D9): todo camino que
    inserta un `Exercise` tiene que completarla, incluidos los dos que ya existían
    antes del router nuevo del catálogo (el seed y `POST /routines/exercises`)."""
    return unicodedata.normalize("NFC", name).strip().casefold()


def _require_member(user: models.User) -> models.User:
    """El propio miembro autenticado. Ya no hay un `Client` separado que resolver
    (design.md, decision 5: el miembro *es* el usuario, no hace falta buscar nada)."""
    if user.role != UserRole.member:
        raise HTTPException(status_code=403, detail="Solo disponible para miembros")
    return user


def _day_title(day: models.RoutineTemplateDay, muscle_groups: list[str]) -> str:
    """"Día N" o "Día N - <grupos unidos por '/'>" (`template-owned-routine-days`,
    design D1): una sola fuente de verdad del título, acá y en
    `routers/routine_templates.py` (duplicado a propósito: son dos módulos sin
    dependencia entre sí, ver design D7)."""
    suffix = f" - {'/'.join(muscle_groups)}" if muscle_groups else ""
    return f"Día {day.position}{suffix}"


def _resolve_plan_base(
    link: models.RoutineTemplateDayExercise, overrides: dict[str, models.RoutineAssignmentBase]
) -> tuple[int, int, float]:
    override = overrides.get(link.exercise_id)
    if override is not None:
        return override.sets, override.reps, override.weight_kg
    return link.base_sets, link.base_reps, link.base_weight_kg


def _serialize_plan_exercise(
    link: models.RoutineTemplateDayExercise, overrides: dict[str, models.RoutineAssignmentBase]
) -> schemas.RoutineTemplateExerciseOut:
    exercise = link.exercise
    sets, reps, weight_kg = _resolve_plan_base(link, overrides)
    planned = plan_sets(link.strategy, sets=sets, reps=reps, weight_kg=weight_kg)
    return schemas.RoutineTemplateExerciseOut(
        exercise_id=exercise.id,
        name=exercise.name,
        muscle_group=exercise.muscle_group,
        base=schemas.ExerciseBaseOut(sets=sets, reps=reps, weight_kg=weight_kg),
        strategy=link.strategy.value,
        planned_sets=[
            schemas.PlannedSetOut(index=item.index, weight_kg=item.weight_kg, reps=item.reps, note=item.note)
            for item in planned
        ],
    )


def _serialize_plan_day(
    day: models.RoutineTemplateDay, overrides: dict[str, models.RoutineAssignmentBase]
) -> schemas.RoutineTemplateDayOut:
    muscle_groups = [item.muscle_group for item in sorted(day.muscle_groups, key=lambda m: m.sort_order)]
    return schemas.RoutineTemplateDayOut(
        day_id=day.id,
        name=_day_title(day, muscle_groups),
        muscle_groups=muscle_groups,
        position=day.position,
        exercises=[
            _serialize_plan_exercise(link, overrides)
            for link in sorted(day.exercises, key=lambda item: item.sort_order)
        ],
    )


def _get_active_assignment(db: Session, user_id: str) -> models.RoutineAssignment | None:
    """La asignación **Activa** del Miembro, con la plantilla y sus días
    precargados (`template-owned-routine-days`, design D10): el overview, "Mi
    rutina" (días) y el progreso siguen siempre esta asignación, nunca una
    Alternativa."""
    return (
        db.query(models.RoutineAssignment)
        .options(
            joinedload(models.RoutineAssignment.template)
            .joinedload(models.RoutineTemplate.days)
            .joinedload(models.RoutineTemplateDay.muscle_groups),
            joinedload(models.RoutineAssignment.template)
            .joinedload(models.RoutineTemplate.days)
            .joinedload(models.RoutineTemplateDay.exercises)
            .joinedload(models.RoutineTemplateDayExercise.exercise),
        )
        .filter(
            models.RoutineAssignment.user_id == user_id,
            models.RoutineAssignment.status == models.RoutineAssignmentStatus.active,
        )
        .first()
    )


def _get_member_day_or_400(db: Session, user_id: str, day_id: str) -> models.RoutineTemplateDay:
    """El día tiene que pertenecer a **alguna** asignación (Activa o
    Alternativa — la Alternativa existe para poder entrenarla) del Miembro
    (design D10, invariante I12)."""
    day = (
        db.query(models.RoutineTemplateDay)
        .join(models.RoutineTemplate, models.RoutineTemplateDay.template_id == models.RoutineTemplate.id)
        .join(models.RoutineAssignment, models.RoutineAssignment.template_id == models.RoutineTemplate.id)
        .filter(
            models.RoutineTemplateDay.id == day_id,
            models.RoutineAssignment.user_id == user_id,
        )
        .first()
    )
    if not day:
        raise HTTPException(status_code=400, detail="Ese día no pertenece a una plantilla asignada")
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
        .options(joinedload(models.WorkoutLog.exercise))
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
    # `day_id` distintos **no nulos** (design D7): un log de un día ya borrado
    # queda con `day_id IS NULL` (D3) y no debe contarse como un día distinto.
    unique_days = len({log.day_id for log in logs if log.day_id is not None})
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
    "/users/{user_id}/overview",
    response_model=list[schemas.RoutineDayProgress],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
def user_routine_overview(user_id: str, db: Session = Depends(get_db)):
    """Días de la asignación **Activa** del usuario (`template-owned-routine-
    days`, design D10). Sin asignación Activa: lista vacía con 200 (aunque
    tenga Alternativas) — nunca 404, la UI ya tiene el estado "Todavía no
    tenés una plantilla asignada"."""
    _get_user_or_404(db, user_id)
    assignment = _get_active_assignment(db, user_id)
    if assignment is None:
        return []

    days = sorted(assignment.template.days, key=lambda item: item.position)
    day_ids = [day.id for day in days]
    logs = (
        db.query(models.WorkoutLog)
        .filter(models.WorkoutLog.user_id == user_id, models.WorkoutLog.day_id.in_(day_ids))
        .all()
    )

    by_day: dict[str, list[models.WorkoutLog]] = defaultdict(list)
    for log in logs:
        by_day[log.day_id].append(log)

    result: list[schemas.RoutineDayProgress] = []
    for day in days:
        muscle_groups = [item.muscle_group for item in sorted(day.muscle_groups, key=lambda m: m.sort_order)]
        day_logs = by_day.get(day.id, [])
        last_performed_at = max((log.performed_at for log in day_logs), default=None)
        result.append(
            schemas.RoutineDayProgress(
                day_id=day.id,
                day_name=_day_title(day, muscle_groups),
                muscle_groups=muscle_groups,
                active_exercise_count=len(day.exercises),
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
    _get_user_or_404(db, user_id)

    query = (
        db.query(models.WorkoutLog)
        .options(joinedload(models.WorkoutLog.exercise))
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
            day_name=log.day_name,
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

    # `member-routine-view`, requirement "El overview y el progreso siguen
    # siempre la asignación Activa" (design D10): `None` cuando el Miembro no
    # tiene ninguna Activa, aunque tenga Alternativas.
    active_assignment = _get_active_assignment(db, user_id)

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
        active_assignment=schemas.ActiveAssignmentSummary(
            assignment_id=active_assignment.id, template_name=active_assignment.template.name
        )
        if active_assignment
        else None,
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
    target = _get_user_or_404(db, user_id)
    if target.membership_status != models.MembershipStatus.active:
        raise HTTPException(
            status_code=400, detail="El usuario no tiene una membresía activa"
        )
    # El día tiene que pertenecer a alguna plantilla asignada al Miembro
    # (Activa o Alternativa), y el ejercicio tiene que estar en ese día
    # (`template-owned-routine-days`, design D10, invariante I12). Un
    # ejercicio inactivo en el catálogo pero ya presente en el día sigue
    # siendo registrable (D9): no se vuelve a chequear `Exercise.is_active`
    # acá, solo pertenencia al día.
    day = _get_member_day_or_400(db, user_id, payload.day_id)

    link = (
        db.query(models.RoutineTemplateDayExercise)
        .options(joinedload(models.RoutineTemplateDayExercise.exercise))
        .filter(
            models.RoutineTemplateDayExercise.template_day_id == payload.day_id,
            models.RoutineTemplateDayExercise.exercise_id == payload.exercise_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=400, detail="Ese ejercicio no esta en el dia seleccionado")

    log = models.WorkoutLog(
        user_id=user_id,
        day_id=payload.day_id,
        day_name=f"Día {day.position}",
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
        day_name=log.day_name,
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
    _get_user_or_404(db, user_id)

    log = (
        db.query(models.WorkoutLog)
        .options(joinedload(models.WorkoutLog.exercise))
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
        day_name=log.day_name,
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
    response_model=list[schemas.RoutineTemplateDayOut],
    dependencies=[Depends(require_role(UserRole.member))],
)
def my_routine_days(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Días de la asignación **Activa** del Miembro (design D10). Sin
    asignación Activa: lista vacía con 200."""
    member = _require_member(current_user)
    assignment = _get_active_assignment(db, member.id)
    if assignment is None:
        return []

    overrides = {
        override.exercise_id: override
        for override in db.query(models.RoutineAssignmentBase)
        .filter(models.RoutineAssignmentBase.assignment_id == assignment.id)
        .all()
    }
    days = sorted(assignment.template.days, key=lambda item: item.position)
    return [_serialize_plan_day(day, overrides) for day in days]


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
