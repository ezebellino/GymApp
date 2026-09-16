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
from app.models import (
    DEFAULT_EXERCISE_BASE_REPS,
    DEFAULT_EXERCISE_BASE_SETS,
    DEFAULT_EXERCISE_BASE_WEIGHT_KG,
    ProgressionStrategy,
)
from app.routers.routine_templates import _normalize_name as _normalize_template_name

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


def assign_plan_to_member(db_session, member, *, amount=10000, name=None):
    """Asigna un plan directo en la base, sin pasar por la API (sin `client`/
    `headers` a mano). Reactivar la membresía exige plan (`membership-plans`,
    invariante I2); tests que no ejercitan esa regla de por sí necesitan uno
    igual para poder activar/reactivar. Hallazgo 10 de verification.md: antes
    vivía copiado en `test_membership.py` y `test_routine_assignments.py`.

    Devuelve el `MembershipPlan` creado (`rebuild-payments-with-plan-pricing`,
    tarea 3.1): los tests de la foto de plan lo necesitan para agregarle un
    precio nuevo, renombrarlo o desactivarlo después del alta de un pago."""
    plan_name = name or f"Plan {member.id}"
    plan = models.MembershipPlan(
        name=plan_name, name_normalized=plan_name.strip().casefold(), is_active=True
    )
    db_session.add(plan)
    db_session.flush()
    db_session.add(
        models.MembershipPlanPrice(plan_id=plan.id, amount=amount, effective_from=date.today())
    )
    # I12: las tres columnas de plan se escriben siempre juntas — ningún
    # camino de la API deja `plan_since` en `NULL` con plan asignado, así que
    # este helper tampoco (hallazgo 4 de la segunda pasada de verification.md).
    member.membership_plan_id = plan.id
    member.plan_since = date.today()
    db_session.commit()
    db_session.refresh(plan)
    return plan


def _normalize_exercise_name(name: str) -> str:
    """NFC + strip + casefold, mismo criterio que `routers/exercises.py`."""
    import unicodedata

    return unicodedata.normalize("NFC", name).strip().casefold()


def create_exercise(
    db_session,
    *,
    id,
    name,
    muscle_group,
    description=None,
):
    """Crea un `Exercise` directo en la base (`exercise-catalog`).

    `template-owned-routine-days` (design D7): el catálogo ya no tiene base
    propia (`base_sets`/`base_reps`/`base_weight_kg` se dropearon de
    `Exercise`) ni ningún vínculo automático a un día — un ejercicio deja de
    "pertenecer" a un día por su grupo muscular. La base y la estrategia son
    ahora atributos de `(día de plantilla, ejercicio)`, ver
    `create_template_with_days`. Devuelve el `Exercise` creado."""
    exercise = models.Exercise(
        id=id,
        name=name,
        name_normalized=_normalize_exercise_name(name),
        muscle_group=muscle_group,
        description=description,
        is_active=True,
    )
    db_session.add(exercise)
    db_session.commit()
    db_session.refresh(exercise)
    return exercise


def create_template_with_days(
    db_session,
    *,
    name,
    days=None,
    tag=None,
):
    """Arma una `RoutineTemplate` con sus días propios directo en la base
    (`template-owned-routine-days`, design D13): reemplaza al viejo seed de
    `day-1..day-4` del catálogo global para los tests que solo necesitan una
    plantilla con contenido, sin ejercitar el `PUT` de guardado del borrador.

    `days` es una lista de dicts, cada uno con:
      - `muscle_groups`: list[str] (valores de `MuscleGroup`), default `[]`.
      - `exercises`: list[dict] con `exercise_id` (obligatorio, ya tiene que
        existir en `exercises`), `strategy` (default `constant`), `base_sets`/
        `base_reps`/`base_weight_kg` (default las constantes de `models.py`).

    Sin `days`, crea el Día 1 vacío (el estado de una plantilla recién creada
    por la API). Devuelve la `RoutineTemplate` creada, con `.days` cargados."""
    name_normalized = _normalize_template_name(name)
    template = models.RoutineTemplate(
        name=name,
        name_normalized=name_normalized,
        tag=tag,
    )
    db_session.add(template)
    db_session.flush()

    days_input = days if days is not None else [{}]
    for position, day_input in enumerate(days_input, start=1):
        day = models.RoutineTemplateDay(template_id=template.id, position=position)
        db_session.add(day)
        db_session.flush()

        for sort_order, muscle_group in enumerate(day_input.get("muscle_groups", [])):
            db_session.add(
                models.RoutineTemplateDayMuscleGroup(
                    template_day_id=day.id, muscle_group=muscle_group, sort_order=sort_order
                )
            )

        for sort_order, exercise_input in enumerate(day_input.get("exercises", [])):
            strategy = ProgressionStrategy(exercise_input.get("strategy", ProgressionStrategy.constant))
            db_session.add(
                models.RoutineTemplateDayExercise(
                    template_day_id=day.id,
                    exercise_id=exercise_input["exercise_id"],
                    sort_order=sort_order,
                    strategy=strategy,
                    base_sets=exercise_input.get("base_sets", DEFAULT_EXERCISE_BASE_SETS),
                    base_reps=exercise_input.get("base_reps", DEFAULT_EXERCISE_BASE_REPS),
                    base_weight_kg=exercise_input.get("base_weight_kg", DEFAULT_EXERCISE_BASE_WEIGHT_KG),
                )
            )

    db_session.commit()
    db_session.refresh(template)
    return template


def assign_template_copy(
    client,
    headers,
    user_id,
    template_id,
    *,
    status="active",
    starts_on=None,
):
    """Copia una plantilla a un Miembro pasando por el **mismo** endpoint que
    usa la UI (`POST /routines/users/{user_id}/templates`,
    `member-routine-copies`, design D5/D12): nunca arma la copia a mano — si el
    copiado (días, grupos musculares, ejercicios) se rompe, cualquier test que
    dependa de esto (progreso, guardado de la copia, etc.) tiene que
    enterarse. Devuelve el `RoutineAssignmentOut` ya parseado."""
    payload = {"template_id": template_id, "status": status}
    if starts_on is not None:
        payload["starts_on"] = starts_on
    response = client.post(
        f"/routines/users/{user_id}/templates",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def mark_set(
    client,
    headers,
    day_id,
    exercise_id,
    set_index,
    *,
    weight_kg,
    reps,
    note=None,
):
    """`PUT /routines/my/days/{day_id}/exercises/{exercise_id}/sets/{set_index}`
    (`routine-progress-tracking`, design D6) desde el propio Miembro. Devuelve
    el `WorkoutSetLogOut` ya parseado."""
    response = client.put(
        f"/routines/my/days/{day_id}/exercises/{exercise_id}/sets/{set_index}",
        json={"weight_kg": weight_kg, "reps": reps, "note": note},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()
