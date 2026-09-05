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
