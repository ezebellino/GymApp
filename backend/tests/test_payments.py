"""Tests de pagos: creación, lectura y borrado.

Cobertura de las líneas partidas en el bloque 1 de `add-verification-gates-to-opsx-flow`
(`db.add(x); db.commit(); db.refresh(x)` -> tres líneas). No usa `date_trunc` (los reportes de
KPIs no corren en SQLite, ver `backend/AGENTS.md`).
"""

from app import models
from tests.helpers import create_user


def _create_member(db_session, email="miembro-pagos@example.com"):
    return create_user(
        db_session,
        email=email,
        first_name="Miembro",
        last_name="Pagos",
        role=models.UserRole.member,
        membership_status=models.MembershipStatus.active,
    )


def test_list_payments_sin_token_responde_401(client):
    response = client.get("/payments/")

    assert response.status_code == 401


def test_list_payments_con_miembro_responde_403(client, client_user):
    response = client.get(
        "/payments/", headers={"Authorization": f"Bearer {client_user['token']}"}
    )

    assert response.status_code == 403


def test_get_payment_sin_token_responde_401(
    client, owner_user, auth_header, db_session
):
    member = _create_member(db_session)
    created = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "amount": 15000,
            "method": "cash",
            "period_month": 1,
            "period_year": 2026,
        },
        headers=auth_header(owner_user.email),
    )
    assert created.status_code == 201, created.text

    response = client.get(f"/payments/{created.json()['id']}")

    assert response.status_code == 401


def test_get_payment_con_miembro_responde_403(
    client, owner_user, client_user, auth_header, db_session
):
    member = _create_member(db_session, email="otro.miembro-pagos@example.com")
    created = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "amount": 15000,
            "method": "cash",
            "period_month": 1,
            "period_year": 2026,
        },
        headers=auth_header(owner_user.email),
    )
    assert created.status_code == 201, created.text

    response = client.get(
        f"/payments/{created.json()['id']}",
        headers={"Authorization": f"Bearer {client_user['token']}"},
    )

    assert response.status_code == 403


def test_coach_lista_y_lee_un_pago(client, coach_user, auth_header, db_session):
    member = _create_member(db_session)
    headers = auth_header(coach_user.email)

    create_response = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "amount": 15000,
            "method": "cash",
            "period_month": 1,
            "period_year": 2026,
        },
        headers=headers,
    )
    assert create_response.status_code == 201, create_response.text
    payment_id = create_response.json()["id"]

    list_response = client.get("/payments/", headers=headers)
    assert list_response.status_code == 200, list_response.text

    get_response = client.get(f"/payments/{payment_id}", headers=headers)
    assert get_response.status_code == 200, get_response.text
    assert get_response.json()["id"] == payment_id


def test_coach_no_puede_anular_un_pago(client, coach_user, auth_header, db_session):
    member = _create_member(db_session)
    headers = auth_header(coach_user.email)

    create_response = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "amount": 15000,
            "method": "cash",
            "period_month": 1,
            "period_year": 2026,
        },
        headers=headers,
    )
    assert create_response.status_code == 201, create_response.text
    payment_id = create_response.json()["id"]

    response = client.delete(f"/payments/{payment_id}", headers=headers)

    assert response.status_code == 403


def test_crear_leer_y_borrar_un_pago(client, owner_user, auth_header, db_session):
    member = _create_member(db_session)
    headers = auth_header(owner_user.email)

    create_response = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "amount": 15000,
            "method": "cash",
            "period_month": 1,
            "period_year": 2026,
        },
        headers=headers,
    )
    assert create_response.status_code == 201, create_response.text
    payment_id = create_response.json()["id"]

    get_response = client.get(f"/payments/{payment_id}", headers=headers)
    assert get_response.status_code == 200, get_response.text
    assert get_response.json()["id"] == payment_id

    delete_response = client.delete(f"/payments/{payment_id}", headers=headers)
    assert delete_response.status_code == 204, delete_response.text

    missing_response = client.get(f"/payments/{payment_id}", headers=headers)
    assert missing_response.status_code == 404
