"""Doble candado compartido por los scripts de seed de desarrollo.

Extraído de `seed_dev_users.py` (`drop-static-exercise-catalog`, design D4): dos
scripts (`seed_dev_users.py` y `seed_dev_exercises.py`) necesitan la misma negativa
a correr fuera de desarrollo, y una guarda de seguridad copiada dos veces es una
guarda que diverge — la copia que alguien se olvida de actualizar es la que corre
contra producción.
"""

import sys
from urllib.parse import urlsplit

from app.config import settings

ALLOWED_ENVIRONMENTS = {"development", "local", "test"}
# "" cubre SQLite de archivo (`sqlite:///ruta`), que no tiene host.
ALLOWED_DB_HOSTS = {"localhost", "127.0.0.1", "db", ""}


def check_environment_guards(what: str) -> None:
    """Doble candado antes de abrir cualquier conexión.

    `what` es el sujeto que aparece en los mensajes ("usuarios de desarrollo",
    "ejercicios de desarrollo"). Sale con código 1 (no `return`): una negativa
    que termina en 0 se ve como éxito desde `make` y desde CI.
    """
    environment = settings.ENVIRONMENT.strip().lower()
    if environment not in ALLOWED_ENVIRONMENTS:
        print(
            f"Me niego a seedear {what}: ENVIRONMENT="
            f"{settings.ENVIRONMENT!r} no es de desarrollo "
            f"(esperaba uno de {sorted(ALLOWED_ENVIRONMENTS)}).\n"
            "Declará ENVIRONMENT=development en backend/.env si esta base es local."
        )
        sys.exit(1)

    db_host = (urlsplit(settings.DATABASE_URL).hostname or "").lower()
    if db_host not in ALLOWED_DB_HOSTS:
        print(
            f"Me niego a seedear {what}: el host de DATABASE_URL es "
            f"{db_host!r}, no una base local "
            f"(esperaba uno de {sorted(h or '<sin host>' for h in ALLOWED_DB_HOSTS)})."
        )
        sys.exit(1)
