# routers/settings.py
from fastapi import APIRouter
from ..schemas import SettingsBase, SettingsOut, SettingsUpdate, Settings
from pydantic import BaseModel, Field

router = APIRouter(prefix="/settings", tags=["settings"])

CURRENT_SETTINGS = SettingsBase(
    gym_name="Libre Funcional",
    currency="ARS",
    default_fee=24000,  # ver nota sobre Decimal más abajo
    address="Av. San Martín 325 - Dolores",
)

@router.get("", response_model=SettingsOut)
def get_settings():
    return CURRENT_SETTINGS

@router.put("", response_model=SettingsOut)
def put_settings(payload: Settings):
    global CURRENT_SETTINGS
    CURRENT_SETTINGS = payload
    return CURRENT_SETTINGS

@router.patch("", response_model=SettingsOut)
def patch_settings(payload: SettingsUpdate):
    global CURRENT_SETTINGS
    data = CURRENT_SETTINGS.model_dump()
    # solo pisa campos presentes (no None)
    for k, v in payload.model_dump(exclude_unset=True).items():
        data[k] = v
    CURRENT_SETTINGS = Settings(**data)
    return CURRENT_SETTINGS
