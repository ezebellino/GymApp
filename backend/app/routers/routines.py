from collections import defaultdict
from datetime import date, datetime
import textwrap
import unicodedata
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..auth import get_current_user, require_role
from ..deps import get_db
from ..models import UserRole
from ..progression import plan_sets
from ..routine_days import day_title, serialize_day
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


def _get_active_assignment(db: Session, user_id: str) -> models.RoutineAssignment | None:
    """La copia **Activa** del Miembro, con sus días precargados
    (`member-routine-copies`, design D9): el overview y `GET /my/days` siguen
    siempre esta asignación, nunca una Alternativa — a diferencia de la
    pantalla de ejecución (D9, ver `routine_assignments.py`), que se alimenta
    de `GET /routines/my/templates` y puede ser cualquier copia."""
    return (
        db.query(models.RoutineAssignment)
        .options(
            joinedload(models.RoutineAssignment.days).joinedload(models.RoutineAssignmentDay.muscle_groups),
            joinedload(models.RoutineAssignment.days)
            .joinedload(models.RoutineAssignmentDay.exercises)
            .joinedload(models.RoutineAssignmentDayExercise.exercise),
        )
        .filter(
            models.RoutineAssignment.user_id == user_id,
            models.RoutineAssignment.status == models.RoutineAssignmentStatus.active,
        )
        .first()
    )


def _get_member_day_or_400(db: Session, user_id: str, day_id: str) -> models.RoutineAssignmentDay:
    """El día tiene que pertenecer a **alguna** copia (Activa o Alternativa —
    la Alternativa existe para poder entrenarla) del Miembro (design D6,
    invariante I10). Pedir el día de otro Miembro es indistinguible de pedir
    uno inexistente."""
    day = (
        db.query(models.RoutineAssignmentDay)
        .join(
            models.RoutineAssignment,
            models.RoutineAssignmentDay.assignment_id == models.RoutineAssignment.id,
        )
        .filter(
            models.RoutineAssignmentDay.id == day_id,
            models.RoutineAssignment.user_id == user_id,
        )
        .first()
    )
    if not day:
        raise HTTPException(status_code=400, detail="Ese día no pertenece a una rutina asignada")
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
    session_count: int,
    unique_exercises: int,
    total_volume: float,
    last_training: datetime | None,
    best_log: models.WorkoutSetLog | None,
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
        ("SERIES", str(log_count), "marcadas"),
        ("SESIONES", str(session_count), "jornadas entrenadas"),
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
# `_motivation_for_metrics` ("excelente constancia" = 4 sesiones y 8 asistencias, "gran
# momento" = 3 mejoras) para que el numero y el texto del PDF cuenten la misma historia.
#
# `member-routine-copies` (design D14): el componente de "entrenamientos" se cuenta en
# **sesiones** (`performed_on` distintos), no en filas de `WorkoutSetLog`. Con D3 cada
# fila es una serie, no un ejercicio: contar filas hacía que una sola sesión de
# 4 ejercicios x 3 series (12 filas) saturara un componente que antes pedía 3-4
# sesiones. `_SCORE_LOG_GOAL = 12` queda reemplazada por `_SCORE_SESSION_GOAL = 4`,
# la lectura fiel de "constancia": cuántas veces vino a entrenar.
_SCORE_SESSION_GOAL = 4
_SCORE_ATTENDANCE_GOAL = 8
_SCORE_IMPROVEMENT_GOAL = 3


def _progress_score(session_count: int, attendance_count: int, improvements: int) -> int:
    """Puntaje 0-100 del reporte de progreso: 40 pts por sesiones entrenadas
    (design D14), 30 por asistencia, 30 por ejercicios con mejora. Cada
    componente satura en su meta."""
    session_points = 40 * min(max(session_count, 0), _SCORE_SESSION_GOAL) / _SCORE_SESSION_GOAL
    attendance_points = 30 * min(max(attendance_count, 0), _SCORE_ATTENDANCE_GOAL) / _SCORE_ATTENDANCE_GOAL
    improvement_points = 30 * min(max(improvements, 0), _SCORE_IMPROVEMENT_GOAL) / _SCORE_IMPROVEMENT_GOAL
    return min(100, round(session_points + attendance_points + improvement_points))


def _motivation_for_metrics(session_count: int, attendance_count: int, improvements: int) -> str:
    if improvements >= 3:
        return "Gran momento: ya se nota una evolucion clara en varios ejercicios. Segui asi."
    if session_count >= 4 and attendance_count >= 8:
        return "Excelente constancia. La disciplina que estas sosteniendo ya esta dando resultados."
    if session_count >= 2:
        return "Muy buen avance. Cada registro suma y hace visible el progreso real."
    return "Buen comienzo. Lo importante es sostener el ritmo y seguir registrando cada entrenamiento."


def _collect_progress_snapshot(
    db: Session, user_id: str
) -> tuple[
    models.User,
    list[models.WorkoutSetLog],
    int,
    models.Payment | None,
    str,
    list[tuple[str, float, float, float]],
    models.WorkoutSetLog | None,
    list[models.WorkoutSetLog],
    float,
    int,
    int,
    datetime | None,
    str,
]:
    """Agregados en el grano nuevo de `WorkoutSetLog` (`member-routine-copies`,
    design D3): `total_volume` es `Σ reps × weight_kg` (ya no hay `sets_count`
    que multiplicar), `session_count` cuenta `performed_on` distintos (design
    D14: el componente de "entrenamientos" del score se mide en sesiones, no
    en filas), e `improvements` compara el peso **máximo de la primera y la
    última sesión** de cada ejercicio (una sesión = `performed_on`), no la
    primera y la última fila."""
    client = _get_user_or_404(db, user_id)
    logs = (
        db.query(models.WorkoutSetLog)
        .options(joinedload(models.WorkoutSetLog.exercise))
        .filter(models.WorkoutSetLog.user_id == user_id)
        .order_by(models.WorkoutSetLog.performed_at.asc())
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

    exercise_histories: dict[str, list[models.WorkoutSetLog]] = defaultdict(list)
    for log in logs:
        exercise_histories[log.exercise_id].append(log)

    improvements: list[tuple[str, float, float, float]] = []
    for history in exercise_histories.values():
        sessions_by_date: dict[date, float] = defaultdict(float)
        for log in history:
            sessions_by_date[log.performed_on] = max(sessions_by_date[log.performed_on], log.weight_kg)
        if len(sessions_by_date) < 2:
            continue
        ordered_dates = sorted(sessions_by_date)
        first_weight = sessions_by_date[ordered_dates[0]]
        last_weight = sessions_by_date[ordered_dates[-1]]
        delta = last_weight - first_weight
        if delta > 0:
            improvements.append((history[-1].exercise.name, first_weight, last_weight, delta))

    improvements.sort(key=lambda item: item[3], reverse=True)
    best_log = max(logs, key=lambda item: item.weight_kg, default=None)
    recent_logs = list(reversed(logs[-5:]))
    total_volume = sum(log.reps * log.weight_kg for log in logs)
    # Sesiones distintas (design D14): agregar series dentro de una misma
    # sesión no mueve este número. Reemplaza a `unique_days`, que contaba
    # `assignment_day_id` distintos, saturaba en 5 (a lo sumo 5 días por
    # copia) y era ciego a repetir el mismo día muchas veces.
    session_count = len({log.performed_on for log in logs})
    unique_exercises = len(exercise_histories)
    last_training = logs[-1].performed_at if logs else None
    motivation = _motivation_for_metrics(session_count, attendance_count, len(improvements[:3]))

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
        session_count,
        unique_exercises,
        last_training,
        motivation,
    )


@router.get(
    "/progression/preview",
    response_model=schemas.PlannedSetsPreviewOut,
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
def preview_planned_sets(
    strategy: schemas.ProgressionStrategyLiteral,
    sets: int = Query(ge=1, le=10),
    reps: int = Query(ge=1, le=100),
    weight_kg: float = Query(ge=0, le=500),
):
    """`member-routine-copies`, design D13: previsualización **sin estado** del
    plan de series — no recibe `template_id`, `assignment_id`, `day_id` ni
    `exercise_id`, así sirve igual al editor de plantilla y al de la copia
    (D8) y funciona sobre un día o un ejercicio que todavía no existen en la
    base. Función pura sobre `plan_sets`: el handler no recibe `Session`."""
    planned = plan_sets(
        models.ProgressionStrategy(strategy), sets=sets, reps=reps, weight_kg=weight_kg
    )
    return schemas.PlannedSetsPreviewOut(
        planned_sets=[
            schemas.PlannedSetOut(index=item.index, weight_kg=item.weight_kg, reps=item.reps, note=item.note)
            for item in planned
        ]
    )


@router.get(
    "/users/{user_id}/overview",
    response_model=list[schemas.RoutineDayProgress],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
def user_routine_overview(user_id: str, db: Session = Depends(get_db)):
    """Días de la copia **Activa** del usuario (`member-routine-copies`,
    design D6, D9 — requirement vigente de `member-routine-view`, no tocado
    por este change). Sin copia Activa: lista vacía con 200 (aunque tenga
    Alternativas) — nunca 404. `log_count` pasa a ser **series marcadas**
    (design D6), no ejercicios cargados."""
    _get_user_or_404(db, user_id)
    assignment = _get_active_assignment(db, user_id)
    if assignment is None:
        return []

    days = sorted(assignment.days, key=lambda item: item.position)
    day_ids = [day.id for day in days]
    logs = (
        db.query(models.WorkoutSetLog)
        .filter(models.WorkoutSetLog.user_id == user_id, models.WorkoutSetLog.assignment_day_id.in_(day_ids))
        .all()
    )

    by_day: dict[str, list[models.WorkoutSetLog]] = defaultdict(list)
    for log in logs:
        by_day[log.assignment_day_id].append(log)

    result: list[schemas.RoutineDayProgress] = []
    for day in days:
        muscle_groups = [item.muscle_group for item in sorted(day.muscle_groups, key=lambda m: m.sort_order)]
        day_logs = by_day.get(day.id, [])
        last_performed_at = max((log.performed_at for log in day_logs), default=None)
        result.append(
            schemas.RoutineDayProgress(
                day_id=day.id,
                day_name=day_title(day, muscle_groups),
                muscle_groups=muscle_groups,
                active_exercise_count=len(day.exercises),
                log_count=len(day_logs),
                last_performed_at=last_performed_at,
            )
        )
    return result


@router.get(
    "/users/{user_id}/logs",
    response_model=list[schemas.WorkoutSetLogOut],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
def user_workout_logs(
    user_id: str,
    day_id: str | None = Query(default=None),
    exercise_id: str | None = Query(default=None),
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    limit: int = Query(default=40, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Histórico de marcas de serie (`member-routine-copies`, design D6): sirve
    tanto al Coach/Dueño (vista de Progreso) como al propio Miembro (panel
    "Historial" de "Mi rutina", vía `my_workout_logs`). Filtros sobre
    `performed_on`, además del `day_id` que ya existía."""
    _get_user_or_404(db, user_id)

    query = (
        db.query(models.WorkoutSetLog)
        .options(joinedload(models.WorkoutSetLog.exercise))
        .filter(models.WorkoutSetLog.user_id == user_id)
    )
    if day_id:
        query = query.filter(models.WorkoutSetLog.assignment_day_id == day_id)
    if exercise_id:
        query = query.filter(models.WorkoutSetLog.exercise_id == exercise_id)
    if from_date:
        query = query.filter(models.WorkoutSetLog.performed_on >= from_date)
    if to_date:
        query = query.filter(models.WorkoutSetLog.performed_on <= to_date)

    logs = query.order_by(models.WorkoutSetLog.performed_at.desc()).limit(limit).all()
    return [
        schemas.WorkoutSetLogOut(
            id=log.id,
            user_id=log.user_id,
            assignment_day_id=log.assignment_day_id,
            day_name=log.day_name,
            exercise_id=log.exercise_id,
            exercise_name=log.exercise.name,
            muscle_group=log.exercise.muscle_group,
            set_index=log.set_index,
            reps=log.reps,
            weight_kg=log.weight_kg,
            note=log.note,
            performed_on=log.performed_on,
            performed_at=log.performed_at,
        )
        for log in logs
    ]


@router.get(
    "/users/{user_id}/logged-exercises",
    response_model=list[schemas.LoggedExerciseOut],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
def user_logged_exercises(user_id: str, db: Session = Depends(get_db)):
    """Ejercicios **con registros** de este Miembro (design D6, D10): alimenta
    el filtro de la vista de Progreso. Alimentado por el histórico, no por la
    copia vigente — un ejercicio ya quitado de la copia sigue siendo
    filtrable."""
    _get_user_or_404(db, user_id)
    exercises = (
        db.query(models.Exercise)
        .join(models.WorkoutSetLog, models.WorkoutSetLog.exercise_id == models.Exercise.id)
        .filter(models.WorkoutSetLog.user_id == user_id)
        .distinct()
        .order_by(models.Exercise.name)
        .all()
    )
    return [
        schemas.LoggedExerciseOut(exercise_id=exercise.id, name=exercise.name, muscle_group=exercise.muscle_group)
        for exercise in exercises
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
        session_count,
        unique_exercises,
        last_training,
        motivation,
    ) = _collect_progress_snapshot(db, user_id)
    top_improvements = improvements[:3]
    score = _progress_score(session_count, attendance_count, len(top_improvements))

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
    add_line(f"- Series marcadas: {len(logs)}")
    add_line(f"- Asistencias acumuladas: {attendance_count}")
    add_line(f"- Sesiones entrenadas: {session_count}")
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
                f"- {log.performed_at.strftime('%d/%m/%Y')}: {log.exercise.name} | serie #{log.set_index} | {log.weight_kg:g} kg | {log.reps} reps"
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
            session_count=session_count,
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
        session_count,
        unique_exercises,
        last_training,
        motivation,
    ) = _collect_progress_snapshot(db, user_id)

    top_improvement = improvements[0] if improvements else None
    score = _progress_score(session_count, attendance_count, len(improvements[:3]))

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
        session_count=session_count,
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
        score=score,
        active_assignment=schemas.ActiveAssignmentSummary(
            assignment_id=active_assignment.id, template_name=active_assignment.template_name
        )
        if active_assignment
        else None,
    )


@router.put(
    "/my/days/{day_id}/exercises/{exercise_id}/sets/{set_index}",
    response_model=schemas.WorkoutSetLogOut,
    dependencies=[Depends(require_role(UserRole.member))],
)
def mark_set(
    day_id: str,
    exercise_id: str,
    set_index: int,
    payload: schemas.WorkoutSetMarkIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """`PUT /routines/my/days/{day_id}/exercises/{exercise_id}/sets/{set_index}`
    (`routine-progress-tracking`, design D6): marca o corrige una serie.
    Upsert idempotente por `(user, day, exercise, set_index, hoy)` — el mismo
    verbo sirve para marcar y para corregir, sin que un doble tap duplique la
    serie (I9). **No** toca `models.Attendance`: marcar progreso no registra
    asistencia (design D6, requirement explícito)."""
    member = _require_member(current_user)

    # 1) El día pertenece a alguna copia (Activa o Alternativa) del propio
    # Miembro (I10): pedir el día de otro Miembro es indistinguible de pedir
    # uno inexistente.
    day = _get_member_day_or_400(db, member.id, day_id)

    # 2) El par (día, ejercicio) existe en la copia.
    link = (
        db.query(models.RoutineAssignmentDayExercise)
        .options(joinedload(models.RoutineAssignmentDayExercise.exercise))
        .filter(
            models.RoutineAssignmentDayExercise.assignment_day_id == day_id,
            models.RoutineAssignmentDayExercise.exercise_id == exercise_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=400, detail="Ese ejercicio no está en el día seleccionado")

    # 3) `set_index` dentro del plan vigente, recalculado en el momento (I8):
    # esconder el botón en la UI no alcanza, la defensa real es acá.
    planned = plan_sets(link.strategy, sets=link.base_sets, reps=link.base_reps, weight_kg=link.base_weight_kg)
    if not (1 <= set_index <= len(planned)):
        raise HTTPException(status_code=400, detail="Ese número de serie no está planificado")

    today = now_ar().date()

    def _find_existing() -> models.WorkoutSetLog | None:
        return (
            db.query(models.WorkoutSetLog)
            .filter(
                models.WorkoutSetLog.user_id == member.id,
                models.WorkoutSetLog.assignment_day_id == day_id,
                models.WorkoutSetLog.exercise_id == exercise_id,
                models.WorkoutSetLog.set_index == set_index,
                models.WorkoutSetLog.performed_on == today,
            )
            .first()
        )

    existing = _find_existing()
    if existing is None:
        # `day_name` es el snapshot de "Día {position}" a secas (design D3,
        # corrección post-gate): el título con grupos musculares no es
        # estable — si el Coach los cambia entre dos sesiones, el mismo día
        # aparecería en el histórico bajo dos etiquetas distintas.
        existing = models.WorkoutSetLog(
            user_id=member.id,
            assignment_day_id=day_id,
            day_name=f"Día {day.position}",
            exercise_id=exercise_id,
            set_index=set_index,
            weight_kg=payload.weight_kg,
            reps=payload.reps,
            note=payload.note,
            performed_on=today,
            performed_at=datetime.utcnow(),
            created_by_user_id=member.id,
        )
        db.add(existing)
        try:
            db.flush()
        except IntegrityError:
            # I23: dos requests solapados del mismo `(user, day, exercise,
            # set_index, hoy)` (reintento con mala señal, o reenvío desde
            # otra pestaña) pisan el `UNIQUE` — el segundo corrige la fila
            # que el primero ya insertó, en vez de un 500.
            db.rollback()
            existing = _find_existing()
            if existing is None:
                raise

    existing.weight_kg = payload.weight_kg
    existing.reps = payload.reps
    existing.note = payload.note
    existing.performed_at = datetime.utcnow()

    db.commit()
    db.refresh(existing)

    exercise = link.exercise
    return schemas.WorkoutSetLogOut(
        id=existing.id,
        user_id=existing.user_id,
        assignment_day_id=existing.assignment_day_id,
        day_name=existing.day_name,
        exercise_id=existing.exercise_id,
        exercise_name=exercise.name,
        muscle_group=exercise.muscle_group,
        set_index=existing.set_index,
        reps=existing.reps,
        weight_kg=existing.weight_kg,
        note=existing.note,
        performed_on=existing.performed_on,
        performed_at=existing.performed_at,
    )


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
    """Días de la copia **Activa** del Miembro (`member-routine-copies`,
    design D9 — requirement vigente de `member-routine-view`, no tocado por
    este change). Sin copia Activa: lista vacía con 200. **No** es la fuente
    de la pantalla de ejecución (D9): esa se alimenta de
    `GET /routines/my/templates`, que puede ser cualquier copia."""
    member = _require_member(current_user)
    assignment = _get_active_assignment(db, member.id)
    if assignment is None:
        return []

    days = sorted(assignment.days, key=lambda item: item.position)
    return [serialize_day(day) for day in days]


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
    response_model=list[schemas.WorkoutSetLogOut],
    dependencies=[Depends(require_role(UserRole.member))],
)
def my_workout_logs(
    day_id: str | None = Query(default=None),
    exercise_id: str | None = Query(default=None),
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    limit: int = Query(default=40, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Histórico propio del Miembro (design D6, D9): mismo endpoint que el del
    staff, resuelto sobre el propio `user_id` — es la fuente del panel
    "Historial" de "Mi rutina", que hace consultable el registro de un
    ejercicio ya quitado de la copia."""
    member = _require_member(current_user)
    return user_workout_logs(member.id, day_id, exercise_id, from_date, to_date, limit, db)


@router.get(
    "/my/logged-exercises",
    response_model=list[schemas.LoggedExerciseOut],
    dependencies=[Depends(require_role(UserRole.member))],
)
def my_logged_exercises(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Ejercicios **con registros** del propio Miembro (`member-routine-copies`,
    design D15): espejo exacto de `GET /users/{user_id}/logged-exercises`,
    resuelto sobre el `user_id` del token — misma delegación de tres líneas
    que `/my/logs`, `/my/overview` y `/my/days`. Alimenta el filtro del panel
    "Historial" desde el **histórico completo**, no de una ventana ni de la
    copia vigente: un ejercicio ya quitado de la copia sigue siendo
    filtrable. El scope `/my` no es un atajo para leer a otro Miembro (I10):
    no acepta ningún `user_id` de la URL."""
    member = _require_member(current_user)
    return user_logged_exercises(member.id, db)
