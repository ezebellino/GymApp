# routers/settings.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..models import AppSettings
from ..schemas import SettingsBase, SettingsOut, SettingsUpdate, Settings
from ..deps import get_db

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULTS = SettingsBase(
    gym_name="Libre Funcional",
    currency="ARS",
    default_fee=24000,
    address="Av. San Martín 325 - Dolores",
)


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(AppSettings).first()

    if not settings:
        # Crear la fila inicial en DB con valores por defecto
        settings = AppSettings(
            gym_name=DEFAULTS.gym_name,
            currency=DEFAULTS.currency,
            default_fee=int(DEFAULTS.default_fee),
            address=DEFAULTS.address,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


@router.put("", response_model=SettingsOut)
def put_settings(payload: Settings, db: Session = Depends(get_db)):
    settings = db.query(AppSettings).first()

    if not settings:
        settings = AppSettings(**payload.model_dump())
        db.add(settings)
    else:
        data = payload.model_dump()
        for field, value in data.items():
            setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings


@router.patch("", response_model=SettingsOut)
def patch_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    settings = db.query(AppSettings).first()

    if not settings:
        # Si nunca existió, crearla mezclando defaults + patch
        data = DEFAULTS.model_dump()
        patch_data = payload.model_dump(exclude_unset=True)
        data.update(patch_data)
        settings = AppSettings(**data)
        db.add(settings)
    else:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings
