# app/utils.py
from datetime import datetime
from zoneinfo import ZoneInfo

AR_TZ = ZoneInfo("America/Argentina/Buenos_Aires")

def now_ar() -> datetime:
    """
    Devuelve la fecha/hora actual de Buenos Aires (con zona horaria).
    """
    return datetime.now(AR_TZ)

def current_period():
    now = now_ar()
    return now.month, now.year
