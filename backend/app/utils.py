# app/utils.py
from datetime import datetime
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import case, literal

from . import models

AR_TZ = ZoneInfo("America/Argentina/Buenos_Aires")

def now_ar() -> datetime:
    """
    Devuelve la fecha/hora actual de Buenos Aires (con zona horaria).
    """
    return datetime.now(AR_TZ)

def current_period():
    now = now_ar()
    return now.month, now.year


MembershipIndicator = Literal["none", "up_to_date", "overdue", "suspended"]


def membership_indicator(
    status: "models.MembershipStatus | str",
    last_month: Optional[int],
    last_year: Optional[int],
    ref: Optional[tuple[int, int]] = None,
) -> MembershipIndicator:
    """Deriva el indicador de 3 colores (`payment-status-indicator`) para un usuario.

    Pura y sin mirar el rol a propósito (ver design.md, decision 4): el rojo
    ("suspended") es de "estado de membresía", no de "acceso" — esa otra regla vive
    separada en `app/auth.py::is_membership_blocking_login`.

    `status` puede ser el enum `MembershipStatus` o su valor string equivalente.
    `ref` es el período de referencia `(month, year)`; por default el actual.
    """
    status_value = status.value if hasattr(status, "value") else status

    if status_value == models.MembershipStatus.cancelled.value:
        return "suspended"
    if status_value == models.MembershipStatus.none.value:
        return "none"

    # membership_status == active: al día si el último pago es del período actual
    # o posterior, en mora si no hay pago o es de un período anterior.
    cur_month, cur_year = ref if ref is not None else current_period()
    if last_month is None or last_year is None:
        return "overdue"
    is_up_to_date = (last_year, last_month) >= (cur_year, cur_month)
    return "up_to_date" if is_up_to_date else "overdue"


def membership_indicator_sql_case(
    payment_last_period_expr,
    *,
    ref: Optional[tuple[int, int]] = None,
):
    """Expresión SQL equivalente a `membership_indicator`, para usarla en el listado.

    `payment_last_period_expr` es una expresión escalar (subconsulta correlacionada)
    que devuelve `period_year * 12 + period_month` del último pago del usuario, o
    NULL si no tiene ninguno. Aritmética entera a propósito: funciona igual en
    SQLite (tests) y Postgres, sin usar `date_trunc` (ver backend/AGENTS.md).
    """
    cur_month, cur_year = ref if ref is not None else current_period()
    current_period_value = cur_year * 12 + cur_month

    return case(
        (models.User.membership_status == models.MembershipStatus.cancelled, literal("suspended")),
        (models.User.membership_status == models.MembershipStatus.none, literal("none")),
        (
            payment_last_period_expr.isnot(None)
            & (payment_last_period_expr >= current_period_value),
            literal("up_to_date"),
        ),
        else_=literal("overdue"),
    )
