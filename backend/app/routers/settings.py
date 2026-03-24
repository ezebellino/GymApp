from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..deps import get_db
from ..models import AppSettings
from ..schemas import Settings, SettingsBase, SettingsOut, SettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULTS = SettingsBase(
    gym_name="Mini Espacio",
    admin_name="Fabian Aguirre (Manga)",
    theme_preference="dark-gold",
    currency="ARS",
    default_fee=30000,
    address="Av. San Martin 325 - Dolores",
    contact_email="owner@miniespacio.com",
    contact_phone="11 5555 5555",
    whatsapp_phone="11 5555 5555",
    business_hours="Lunes a viernes de 7 a 22 hs. Sabados de 9 a 13 hs.",
    payment_alias="MINI.ESPACIO.GYM",
    payment_notes="Aceptamos efectivo y transferencia. Confirmar pagos con comprobante.",
    payment_reminder_message="Hola {client_name}, te recordamos con cariño la cuota mensual de {gym_name}. El valor actual es {amount} y contamos con {grace_days} días de tolerancia para abonarla. Podés transferir al alias {payment_alias}. Si ya pagaste, podés ignorar este mensaje. ¡Gracias!",
    payment_reminder_last_sent_at=None,
    late_fee_grace_days=5,
    allow_cash=True,
    allow_transfer=True,
    onboarding_message="Bienvenido a Mini Espacio. Ante dudas sobre pagos, asistencias o rutinas, consulta en recepción.",
)


def _apply_brand_refresh(settings: AppSettings) -> AppSettings:
    updates = {}

    if settings.gym_name == "Libre Funcional":
        updates["gym_name"] = DEFAULTS.gym_name
    if not settings.admin_name:
        updates["admin_name"] = DEFAULTS.admin_name
    if not settings.theme_preference:
        updates["theme_preference"] = DEFAULTS.theme_preference
    if settings.contact_email == "owner@librefuncional.com":
        updates["contact_email"] = DEFAULTS.contact_email
    if settings.payment_alias == "LIBRE.FUNCIONAL.GYM":
        updates["payment_alias"] = DEFAULTS.payment_alias
    if not settings.payment_reminder_message:
        updates["payment_reminder_message"] = DEFAULTS.payment_reminder_message
    if (
        settings.onboarding_message
        == "Bienvenido a Libre Funcional. Ante dudas sobre pagos o asistencias, consulta en recepcion."
    ):
        updates["onboarding_message"] = DEFAULTS.onboarding_message

    for field, value in updates.items():
        setattr(settings, field, value)

    return settings


def _ensure_settings(db: Session) -> AppSettings:
    settings = db.query(AppSettings).first()

    if settings:
        settings = _apply_brand_refresh(settings)
        if db.is_modified(settings):
            db.commit()
            db.refresh(settings)
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
