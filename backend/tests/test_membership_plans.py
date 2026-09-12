"""Tests de `backend/app/routers/membership_plans.py` (capability `membership-plans`).

Cubre el CRUD de planes para staff: alta con precio inicial, nombre único, historial
de precios append-only, retroactividad rechazada, regla de "al menos un plan
activo" y autorización de rol (401/403, `staff-endpoint-authorization`).
"""

from datetime import date, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as SQLAlchemySession

from app import models
from app.routers import membership_plans as membership_plans_router
from tests.helpers import OWNER_EMAIL, CLIENT_EMAIL, create_plan, create_user


def test_crear_plan_devuelve_201_con_precio_inicial(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)

    response = client.post(
        "/membership-plans/",
        json={"name": "Estudiante", "description": "Descuento estudiantil", "amount": 8000},
        headers=headers,
    )

    assert response.status_code == 201, response.text
    assert "Location" in response.headers
    body = response.json()
    assert body["name"] == "Estudiante"
    assert body["is_active"] is True
    assert body["current_price"]["amount"] == 8000
    assert body["current_price"]["effective_from"] == date.today().isoformat()
    assert body["members_count"] == 0


def test_crear_plan_con_nombre_duplicado_devuelve_409(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    create_plan(client, headers, name="General")

    response = client.post(
        "/membership-plans/",
        json={"name": "  GENERAL  ", "amount": 10000},
        headers=headers,
    )

    assert response.status_code == 409, response.text
    assert db_session.query(models.MembershipPlan).count() == 1


def test_nombre_duplicado_concurrente_devuelve_409_no_500(
    client, owner_user, auth_header, db_session, monkeypatch
):
    """Hallazgo 3 de verification.md: dos `POST /membership-plans/` con el
    mismo nombre que pasan el chequeo previo (`_check_name_collision`) a la
    vez tienen que perder contra el índice único en el `commit`, no romper con
    un 500 sin `detail`. Se simula la carrera dejando pasar el chequeo previo
    (monkeypatch a no-op) para que la segunda creación llegue al `commit` con
    el nombre ya tomado, como pasaría si dos requests lo evaluaran a la vez."""
    headers = auth_header(OWNER_EMAIL)
    create_plan(client, headers, name="General")

    monkeypatch.setattr(membership_plans_router, "_check_name_collision", lambda *a, **k: None)

    response = client.post(
        "/membership-plans/",
        json={"name": "General", "amount": 10000},
        headers=headers,
    )

    assert response.status_code == 409, response.text
    assert response.json()["detail"]
    assert db_session.query(models.MembershipPlan).count() == 1


def test_nuevo_precio_inserta_fila_y_no_modifica_la_anterior(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers, amount=10000)
    future = (date.today() + timedelta(days=7)).isoformat()

    response = client.post(
        f"/membership-plans/{plan['id']}/prices",
        json={"amount": 12000, "effective_from": future},
        headers=headers,
    )

    assert response.status_code == 201, response.text
    prices = (
        db_session.query(models.MembershipPlanPrice)
        .filter(models.MembershipPlanPrice.plan_id == plan["id"])
        .order_by(models.MembershipPlanPrice.effective_from.asc())
        .all()
    )
    assert len(prices) == 2
    assert prices[0].amount == 10000  # el precio original sigue intacto
    assert prices[1].amount == 12000

    # Hallazgo 5 de verification.md: dos filas no alcanza — el filtro
    # `effective_from <= on` (`current_price_for`) tiene que seguir eligiendo
    # el precio viejo hasta la fecha de vigencia del nuevo.
    detail = client.get(f"/membership-plans/{plan['id']}", headers=headers)
    assert detail.status_code == 200, detail.text
    assert detail.json()["current_price"]["amount"] == 10000


def test_nuevo_precio_retroactivo_devuelve_400(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers, amount=10000)
    past = (date.today() - timedelta(days=1)).isoformat()

    response = client.post(
        f"/membership-plans/{plan['id']}/prices",
        json={"amount": 9000, "effective_from": past},
        headers=headers,
    )

    assert response.status_code == 400, response.text
    assert (
        db_session.query(models.MembershipPlanPrice)
        .filter(models.MembershipPlanPrice.plan_id == plan["id"])
        .count()
        == 1
    )


def test_desactivar_el_ultimo_plan_activo_devuelve_409(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers, name="Único")

    response = client.post(f"/membership-plans/{plan['id']}/deactivate", headers=headers)

    assert response.status_code == 409, response.text
    detail = client.get(f"/membership-plans/{plan['id']}", headers=headers).json()
    assert detail["is_active"] is True


def test_desactivar_con_otro_plan_activo_funciona(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    create_plan(client, headers, name="General")
    otro = create_plan(client, headers, name="Estudiante")

    response = client.post(f"/membership-plans/{otro['id']}/deactivate", headers=headers)

    assert response.status_code == 200, response.text
    assert response.json()["is_active"] is False


def test_listado_filtra_por_activo_y_expone_total_count(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    activo = create_plan(client, headers, name="Activo")
    inactivo = create_plan(client, headers, name="Inactivo")
    client.post(f"/membership-plans/{inactivo['id']}/deactivate", headers=headers)

    response = client.get("/membership-plans/", params={"is_active": True}, headers=headers)

    assert response.status_code == 200, response.text
    assert response.headers["X-Total-Count"] == "1"
    body = response.json()
    assert [plan["id"] for plan in body] == [activo["id"]]


def test_planes_sin_sesion_devuelve_401_y_con_rol_member_403(client, owner_user, auth_header, db_session):
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers)
    create_user(
        db_session,
        email=CLIENT_EMAIL,
        first_name="Cliente",
        last_name="de Test",
        role=models.UserRole.member,
    )
    member_headers = auth_header(CLIENT_EMAIL)

    no_token = client.get("/membership-plans/")
    assert no_token.status_code == 401, no_token.text

    as_member = client.get("/membership-plans/", headers=member_headers)
    assert as_member.status_code == 403, as_member.text

    as_member_detail = client.get(f"/membership-plans/{plan['id']}", headers=member_headers)
    assert as_member_detail.status_code == 403, as_member_detail.text


def test_resto_de_endpoints_de_planes_sin_sesion_devuelve_401_y_con_rol_member_403(
    client, owner_user, auth_header, db_session
):
    """Hallazgo 4 de verification.md: `test_planes_sin_sesion_...` de arriba
    solo cubría los dos `GET`. `POST /`, `PATCH`, `/prices`, `/deactivate` y
    `/activate` están protegidos a nivel router (`dependencies=[Depends(
    require_role(...))]` en `membership_plans.py`), así que esto es brecha de
    cobertura, no agujero real — pero si alguien mueve un endpoint fuera de
    ese router, nada más lo detecta."""
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers)
    client.post(f"/membership-plans/{plan['id']}/deactivate", headers=headers)
    create_user(
        db_session,
        email=CLIENT_EMAIL,
        first_name="Cliente",
        last_name="de Test",
        role=models.UserRole.member,
    )
    member_headers = auth_header(CLIENT_EMAIL)

    requests = [
        ("post", "/membership-plans/", {"name": "Nuevo", "amount": 1000}),
        ("patch", f"/membership-plans/{plan['id']}", {"description": "x"}),
        (
            "post",
            f"/membership-plans/{plan['id']}/prices",
            {"amount": 5000, "effective_from": date.today().isoformat()},
        ),
        ("post", f"/membership-plans/{plan['id']}/deactivate", None),
        ("post", f"/membership-plans/{plan['id']}/activate", None),
    ]

    for method, url, json_body in requests:
        no_token = getattr(client, method)(url, json=json_body)
        assert no_token.status_code == 401, f"{method} {url}: {no_token.text}"

        as_member = getattr(client, method)(url, json=json_body, headers=member_headers)
        assert as_member.status_code == 403, f"{method} {url}: {as_member.text}"


def test_patch_de_solo_descripcion_no_traduce_cualquier_integrityerror_a_409(
    client, owner_user, auth_header, monkeypatch
):
    """Hallazgo 2 de la segunda pasada de verification.md:
    `_commit_or_conflict_on_name` traducía CUALQUIER `IntegrityError` a 409
    "Ya existe un plan con ese nombre", sin inspeccionar la constraint, y
    `update_membership_plan` la invocaba incluso en un `PATCH` que no toca
    `name`. Se simula un `IntegrityError` ajeno al nombre (una constraint
    inventada) en el único `commit` de este `PATCH`. Los dos caminos
    devuelven 409 (`main.py` tiene un handler global de `IntegrityError` que
    cae atrás de cualquiera no capturado), así que lo que distingue el bug
    del arreglo es el **mensaje**: con el bug, cualquier `IntegrityError` sale
    disfrazada del 409 de nombre duplicado; arreglado, un error ajeno al
    nombre llega sin traducir al handler genérico, con su detail genérico.
    Falla con el bug presente (el detail sería el de nombre duplicado)."""
    headers = auth_header(OWNER_EMAIL)
    plan = create_plan(client, headers, name="General")

    def fake_commit(self):
        raise IntegrityError(
            "UPDATE membership_plans SET description=?",
            {},
            Exception("NOT NULL constraint failed: membership_plans.some_other_column"),
        )

    monkeypatch.setattr(SQLAlchemySession, "commit", fake_commit)

    response = client.patch(
        f"/membership-plans/{plan['id']}",
        json={"description": "Nueva descripción"},
        headers=headers,
    )

    assert response.status_code == 409, response.text
    assert response.json()["detail"] != "Ya existe un plan con ese nombre"
