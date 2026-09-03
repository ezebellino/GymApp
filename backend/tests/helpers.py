"""Constantes y helpers compartidos por la suite.

Viven acá y **no** en `conftest.py` a proposito: pytest importa el conftest como
modulo top-level `conftest`, asi que un `from tests.conftest import ...` desde un
test crea un **segundo objeto modulo** (`tests.conftest`) y vuelve a ejecutar el
`mkdtemp()` y el seteo de `os.environ["DATABASE_URL"]` de nivel de modulo. Este
archivo, en cambio, lo importa solo quien lo pide: se carga una sola vez.
"""

OWNER_EMAIL = "owner@example.com"
COACH_EMAIL = "coach@example.com"
CLIENT_EMAIL = "cliente@example.com"
PASSWORD = "test-password-123"


def login(client, email, password=PASSWORD):
    """Hace `POST /auth/token` (form data) y devuelve el header Authorization."""
    response = client.post(
        "/auth/token",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
