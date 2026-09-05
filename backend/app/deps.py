from fastapi import HTTPException, status

from .database import SessionLocal
from . import models


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def require_can_manage_user(
    current_user: models.User, target_role: "models.UserRole | str"
) -> None:
    """Regla de permisos de ABM (`user-management`, "Permisos de gestión por rol").

    Owner: gestiona cualquier rol. Coach: solo puede crear/editar usuarios cuyo rol
    (el actual y, si lo cambia, el nuevo) sea Miembro. Centralizada acá para no
    reimplementar el chequeo endpoint por endpoint (convención de `backend/AGENTS.md`).

    No es una dependencia inyectable (`Depends(...)`) porque el rol objetivo casi
    siempre depende del body de la request (a quién se crea/edita, o a qué rol se lo
    quiere cambiar) y no está disponible al momento de declarar la ruta. Se llama
    explícitamente desde el endpoint, una sola vez por regla.
    """
    if current_user.role == models.UserRole.owner:
        return
    if current_user.role == models.UserRole.coach:
        role_value = target_role.value if hasattr(target_role, "value") else target_role
        if role_value == models.UserRole.member.value:
            return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions",
    )