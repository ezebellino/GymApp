"""Constantes y helpers compartidos por la suite.

Viven acá y **no** en `conftest.py` a proposito: pytest importa el conftest como
modulo top-level `conftest`, asi que un `from tests.conftest import ...` desde un
test crea un **segundo objeto modulo** (`tests.conftest`) y vuelve a ejecutar el
`mkdtemp()` y el seteo de `os.environ["DATABASE_URL"]` de nivel de modulo. Este
archivo, en cambio, lo importa solo quien lo pide: se carga una sola vez. Por eso
`_create_user` vive acá (no en `conftest.py`) aunque solo lo usen las fixtures y los
tests que necesitan crear usuarios ad-hoc además de los fixtures estándar.
"""

from datetime import date, datetime

from app import models
from app.auth import hash_password

OWNER_EMAIL = "owner@example.com"
COACH_EMAIL = "coach@example.com"
CLIENT_EMAIL = "cliente@example.com"
PASSWORD = "test-password-123"

_UNSET = object()


def login(client, email, password=PASSWORD):
    """Hace `POST /auth/token` (form data) y devuelve el header Authorization."""
    response = client.post(
        "/auth/token",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_user(
    session,
    *,
    email,
    first_name,
    last_name=None,
    role,
    membership_status=None,
    password_hash=_UNSET,
):
    """Crea un `User` directo en la base, con el password de test ya hasheado.

    Reemplaza el registro vía endpoint público (`/auth/client-register` ya no
    existe: el alta de un Miembro la inicia siempre un admin/coach vía
    `member-invitation`); para la suite alcanza con seedear la fila.
    """
    is_member = role == models.UserRole.member
    user = models.User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password_hash=hash_password(PASSWORD) if password_hash is _UNSET else password_hash,
        email_verified=True,
        phone_verified=False,
        role=role,
        is_active=True,
        membership_status=(
            membership_status
            if membership_status is not None
            else (models.MembershipStatus.active if is_member else models.MembershipStatus.none)
        ),
        membership_start_date=datetime.utcnow() if is_member else None,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def create_plan(client, headers, *, name="General", description=None, amount=15000):
    """Crea un plan de membresía vía API (`membership-plans`) y devuelve el body ya
    parseado. Helper reutilizable por `test_membership_plans.py` y
    `test_user_plan.py`."""
    response = client.post(
        "/membership-plans/",
        json={"name": name, "description": description, "amount": amount},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def assign_plan_to_member(db_session, member):
    """Asigna un plan directo en la base, sin pasar por la API (sin `client`/
    `headers` a mano). Reactivar la membresía exige plan (`membership-plans`,
    invariante I2); tests que no ejercitan esa regla de por sí necesitan uno
    igual para poder activar/reactivar. Hallazgo 10 de verification.md: antes
    vivía copiado en `test_membership.py` y `test_routine_assignments.py`."""
    plan = models.MembershipPlan(
        name=f"Plan {member.id}", name_normalized=f"plan {member.id}", is_active=True
    )
    db_session.add(plan)
    db_session.flush()
    db_session.add(models.MembershipPlanPrice(plan_id=plan.id, amount=10000, effective_from=date.today()))
    # I12: las tres columnas de plan se escriben siempre juntas — ningún
    # camino de la API deja `plan_since` en `NULL` con plan asignado, así que
    # este helper tampoco (hallazgo 4 de la segunda pasada de verification.md).
    member.membership_plan_id = plan.id
    member.plan_since = date.today()
    db_session.commit()
