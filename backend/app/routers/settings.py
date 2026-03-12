from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..deps import get_db
from ..models import AppSettings
from ..schemas import Settings, SettingsBase, SettingsOut, SettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULTS = SettingsBase(
    gym_name="Libre Funcional",
    currency="ARS",
    default_fee=24000,
    address="Av. San Martin 325 - Dolores",
    contact_email="owner@librefuncional.com",
    contact_phone="11 5555 5555",
    whatsapp_phone="11 5555 5555",
    business_hours="Lunes a viernes de 7 a 22 hs. Sabados de 9 a 13 hs.",
    payment_alias="LIBRE.FUNCIONAL.GYM",
    payment_notes="Aceptamos efectivo y transferencia. Confirmar pagos con comprobante.",
    late_fee_grace_days=5,
    allow_cash=True,
    allow_transfer=True,
    onboarding_message="Bienvenido a Libre Funcional. Ante dudas sobre pagos o asistencias, consulta en recepcion.",
)


def _ensure_settings(db: Session) -> AppSettings:
    settings = db.query(AppSettings).first()

    if settings:
        return settings

    settings = AppSettings(**DEFAULTS.model_dump())
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return _ensure_settings(db)


@router.put("", response_model=SettingsOut)
def put_settings(payload: Settings, db: Session = Depends(get_db)):
    settings = _ensure_settings(db)

    for field, value in payload.model_dump().items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings


@router.patch("", response_model=SettingsOut)
def patch_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    settings = _ensure_settings(db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings
