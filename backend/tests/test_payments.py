"""Tests de pagos: creación, lectura, borrado y foto de plan/precio.

Cobertura de las líneas partidas en el bloque 1 de `add-verification-gates-to-opsx-flow`
(`db.add(x); db.commit(); db.refresh(x)` -> tres líneas) y de la foto de plan/precio de
`rebuild-payments-with-plan-pricing` (design D1-D4, invariantes I1-I9). No usa
`date_trunc` (los reportes por bucket de `payments_timeseries` no corren en SQLite, ver
`backend/AGENTS.md`); `/reports/kpis`, `/by_method` y `/by_channel` sí corren, y
`test_reportes_suman_el_monto_pagado_y_no_el_de_referencia` depende de eso.
"""

from datetime import date, datetime, timedelta

from app import models
from app.utils import current_period
from tests.helpers import assign_plan_to_member, create_user


def _create_member(db_session, email="miembro-pagos@example.com"):
    return create_user(
        db_session,
        email=email,
        first_name="Miembro",
        last_name="Pagos",
        role=models.UserRole.member,
        membership_status=models.MembershipStatus.active,
    )


def _create_member_with_plan(db_session, email="miembro-pagos@example.com", *, amount=15000, name=None):
    member = _create_member(db_session, email=email)
    plan = assign_plan_to_member(db_session, member, amount=amount, name=name)
    return member, plan


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
    member, _plan = _create_member_with_plan(db_session)
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
    member, _plan = _create_member_with_plan(
        db_session, email="otro.miembro-pagos@example.com"
    )
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
    member, plan = _create_member_with_plan(db_session)
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
    assert create_response.json()["plan"] == {
        "id": plan.id,
        "name": plan.name,
        "reference_amount": 15000,
    }

    list_response = client.get("/payments/", headers=headers)
    assert list_response.status_code == 200, list_response.text
    assert list_response.json()[0]["plan"]["name"] == plan.name

    get_response = client.get(f"/payments/{payment_id}", headers=headers)
    assert get_response.status_code == 200, get_response.text
    assert get_response.json()["id"] == payment_id
    assert get_response.json()["plan"]["reference_amount"] == 15000


def test_coach_no_puede_anular_un_pago(client, coach_user, auth_header, db_session):
    member, _plan = _create_member_with_plan(db_session)
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
    member, _plan = _create_member_with_plan(db_session)
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


# --- Foto de plan y precio (D1/D2/D3, `rebuild-payments-with-plan-pricing`) --------


def test_alta_congela_plan_y_precio_vigente_del_miembro(
    client, owner_user, auth_header, db_session
):
    member, plan = _create_member_with_plan(db_session, amount=30000, name="Plan Congelado")
    headers = auth_header(owner_user.email)

    response = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "cash",
            "period_month": 1,
            "period_year": 2026,
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["amount"] == 30000
    assert body["plan"] == {"id": plan.id, "name": "Plan Congelado", "reference_amount": 30000}


def test_alta_sin_amount_usa_el_precio_de_referencia_del_plan(
    client, owner_user, auth_header, db_session
):
    member, _plan = _create_member_with_plan(db_session, amount=25000)
    headers = auth_header(owner_user.email)

    # El payload ni siquiera declara `amount` (no solo `null`): D3.1 la vuelve
    # opcional en el request.
    response = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "cash",
            "period_month": 2,
            "period_year": 2026,
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    assert response.json()["amount"] == 25000
    assert response.json()["plan"]["reference_amount"] == 25000


def test_alta_con_amount_editado_guarda_lo_pagado_y_la_referencia(
    client, owner_user, auth_header, db_session
):
    member, _plan = _create_member_with_plan(db_session, amount=34000)
    headers = auth_header(owner_user.email)

    response = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "amount": 30000,
            "method": "cash",
            "note": "Descuento puntual",
            "period_month": 3,
            "period_year": 2026,
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["amount"] == 30000
    assert body["plan"]["reference_amount"] == 34000


def test_alta_ignora_plan_y_precio_enviados_en_el_payload(
    client, owner_user, auth_header, db_session
):
    member, plan = _create_member_with_plan(db_session, amount=20000, name="Plan Real")
    headers = auth_header(owner_user.email)

    response = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "cash",
            "period_month": 4,
            "period_year": 2026,
            # Campos que `PaymentCreate` no declara: tienen que ser ignorados,
            # nunca escritos (invariante I4).
            "membership_plan_id": "otro-plan-inventado",
            "plan_name_at_payment": "Plan Falso",
            "plan_amount_at_payment": 999999,
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["plan"] == {"id": plan.id, "name": "Plan Real", "reference_amount": 20000}
    assert body["amount"] == 20000


def test_alta_de_miembro_sin_plan_responde_400_y_no_crea_el_pago(
    client, owner_user, auth_header, db_session
):
    member = _create_member(db_session)
    headers = auth_header(owner_user.email)

    response = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "cash",
            "period_month": 5,
            "period_year": 2026,
        },
        headers=headers,
    )

    assert response.status_code == 400, response.text
    assert "plan" in response.json()["detail"].lower()
    assert db_session.query(models.Payment).count() == 0


def test_alta_de_miembro_dado_de_baja_responde_400(
    client, owner_user, auth_header, db_session
):
    member = _create_member(db_session)
    # Aunque tenga plan asignado, la membresía dada de baja se chequea primero
    # (D2: orden 404 -> membresía -> plan -> período).
    assign_plan_to_member(db_session, member)
    member.membership_status = models.MembershipStatus.cancelled
    db_session.commit()
    headers = auth_header(owner_user.email)

    response = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "cash",
            "period_month": 6,
            "period_year": 2026,
        },
        headers=headers,
    )

    assert response.status_code == 400, response.text
    assert db_session.query(models.Payment).count() == 0


def test_alta_de_periodo_futuro_se_acepta(client, owner_user, auth_header, db_session):
    member, _plan = _create_member_with_plan(db_session)
    headers = auth_header(owner_user.email)

    response = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "cash",
            "period_month": 12,
            "period_year": 2099,
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text


def test_segundo_pago_del_mismo_periodo_responde_409(
    client, owner_user, auth_header, db_session
):
    member, _plan = _create_member_with_plan(db_session)
    headers = auth_header(owner_user.email)

    first = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "cash",
            "period_month": 7,
            "period_year": 2026,
        },
        headers=headers,
    )
    assert first.status_code == 201, first.text

    second = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "cash",
            "period_month": 7,
            "period_year": 2026,
        },
        headers=headers,
    )

    assert second.status_code == 409, second.text
    assert db_session.query(models.Payment).count() == 1


def test_listado_tolera_pagos_previos_sin_foto_de_plan(
    client, owner_user, auth_header, db_session
):
    # Simula un pago anterior a la migración (D4, sin backfill): insertado
    # directo en la base, sin ninguna de las tres columnas de foto.
    member = _create_member(db_session)
    legacy_payment = models.Payment(
        user_id=member.id,
        amount=12000,
        method="cash",
        period_month=1,
        period_year=2025,
    )
    db_session.add(legacy_payment)
    db_session.commit()

    response = client.get("/payments/", headers=auth_header(owner_user.email))

    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 1
    assert body[0]["plan"] is None


def test_cambiar_el_precio_del_plan_no_reescribe_pagos_registrados(
    client, owner_user, auth_header, db_session
):
    member, plan = _create_member_with_plan(db_session, amount=30000)
    headers = auth_header(owner_user.email)

    created = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "cash",
            "period_month": 8,
            "period_year": 2026,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    payment_id = created.json()["id"]

    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    new_price = client.post(
        f"/membership-plans/{plan.id}/prices",
        json={"amount": 99999, "effective_from": tomorrow},
        headers=headers,
    )
    assert new_price.status_code == 201, new_price.text

    response = client.get(f"/payments/{payment_id}", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["plan"]["reference_amount"] == 30000
    assert body["amount"] == 30000


def test_renombrar_o_desactivar_el_plan_no_cambia_la_foto_del_pago(
    client, owner_user, auth_header, db_session
):
    member, plan = _create_member_with_plan(db_session, amount=18000, name="Plan Original")
    headers = auth_header(owner_user.email)

    # `deactivate_membership_plan` rechaza desactivar el último plan activo:
    # crea uno segundo para poder desactivar el que nos interesa.
    other_member = _create_member(db_session, email="otro-titular@example.com")
    assign_plan_to_member(db_session, other_member, amount=10000, name="Otro plan")

    created = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "cash",
            "period_month": 9,
            "period_year": 2026,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    payment_id = created.json()["id"]

    rename = client.patch(
        f"/membership-plans/{plan.id}",
        json={"name": "Plan Renombrado"},
        headers=headers,
    )
    assert rename.status_code == 200, rename.text

    deactivate = client.post(f"/membership-plans/{plan.id}/deactivate", headers=headers)
    assert deactivate.status_code == 200, deactivate.text

    response = client.get(f"/payments/{payment_id}", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["plan"]["name"] == "Plan Original"
    assert body["plan"]["reference_amount"] == 18000


def test_listado_devuelve_la_foto_del_plan_de_cada_pago(
    client, owner_user, auth_header, db_session
):
    member, plan = _create_member_with_plan(db_session, amount=22000, name="Plan Listado")
    headers = auth_header(owner_user.email)

    created = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "cash",
            "period_month": 10,
            "period_year": 2026,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text

    response = client.get("/payments/", headers=headers)

    assert response.status_code == 200, response.text
    item = response.json()[0]
    assert item["plan"] == {"id": plan.id, "name": "Plan Listado", "reference_amount": 22000}


def test_listado_filtra_por_periodo_y_por_metodo(
    client, owner_user, auth_header, db_session
):
    member_a, _plan_a = _create_member_with_plan(db_session, email="a@example.com")
    member_b, _plan_b = _create_member_with_plan(db_session, email="b@example.com")
    headers = auth_header(owner_user.email)

    client.post(
        "/payments/",
        json={
            "user_id": str(member_a.id),
            "method": "cash",
            "period_month": 1,
            "period_year": 2026,
        },
        headers=headers,
    )
    client.post(
        "/payments/",
        json={
            "user_id": str(member_b.id),
            "method": "transfer",
            "period_month": 2,
            "period_year": 2026,
        },
        headers=headers,
    )

    response = client.get(
        "/payments/",
        params={"period_month": 1, "period_year": 2026, "method": "cash"},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 1
    assert body[0]["user"]["id"] == str(member_a.id)
    assert body[0]["method"] == "cash"


# --- Resumen del período (D3.4) -----------------------------------------------


def test_resumen_del_periodo_devuelve_cobrado_pagados_y_pendientes(
    client, owner_user, auth_header, db_session
):
    paid_member, _plan_1 = _create_member_with_plan(
        db_session, email="pago@example.com", amount=15000
    )
    _pending_member = _create_member(db_session, email="pendiente@example.com")
    headers = auth_header(owner_user.email)

    created = client.post(
        "/payments/",
        json={
            "user_id": str(paid_member.id),
            "method": "cash",
            "period_month": 9,
            "period_year": 2026,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text

    response = client.get(
        "/payments/summary",
        params={"period_year": 2026, "period_month": 9},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["period_year"] == 2026
    assert body["period_month"] == 9
    assert body["payments_count"] == 1
    assert body["amount_sum"] == 15000
    assert body["members_active"] == 2
    assert body["members_paid"] == 1
    assert body["members_pending"] == 1


def test_resumen_del_periodo_con_miembro_responde_403(client, client_user):
    response = client.get(
        "/payments/summary",
        params={"period_year": 2026, "period_month": 9},
        headers={"Authorization": f"Bearer {client_user['token']}"},
    )

    assert response.status_code == 403


def test_reportes_suman_el_monto_pagado_y_no_el_de_referencia(
    client, owner_user, auth_header, db_session
):
    """Invariante I1: los reportes agregan `Payment.amount` (lo efectivamente
    pagado), no `plan_amount_at_payment` (la referencia). Un descuento puntual
    tiene que reflejarse en el KPI del Dashboard, no la referencia sugerida."""
    member, _plan = _create_member_with_plan(db_session, amount=34000)
    headers = auth_header(owner_user.email)

    created = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "amount": 30000,
            "method": "cash",
            "period_month": 11,
            "period_year": 2026,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text

    # `created_at` se escribe con `datetime.utcnow()`: el rango del reporte
    # tiene que ser el día UTC de hoy, no el día local (pueden diferir cerca de
    # medianoche).
    today_utc = datetime.utcnow().date().isoformat()
    response = client.get(
        "/payments/reports/kpis",
        params={"start": today_utc, "end": today_utc},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["amount_sum"] == 30000
    assert body["n_payments"] == 1


def test_alta_con_method_cash_y_method_channel_responde_422(
    client, owner_user, auth_header, db_session
):
    """Corrección `verification.md` hallazgo 3: `method_channel` es un sub-canal
    de transferencia (mercadopago, cuentadni, etc.); con `method="cash"` no
    tiene sentido y antes se aceptaba sin validar."""
    member, _plan = _create_member_with_plan(db_session, amount=15000)
    headers = auth_header(owner_user.email)

    response = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "cash",
            "method_channel": "mercadopago",
            "period_month": 4,
            "period_year": 2026,
        },
        headers=headers,
    )

    assert response.status_code == 422, response.text


def test_alta_con_method_transfer_y_method_channel_responde_201(
    client, owner_user, auth_header, db_session
):
    """Corrección `verification.md` (segunda pasada) hallazgo 5: el validador
    de `method_channel` del hallazgo 3 solo tenía cubierto el caso inválido
    (422). El caso válido —`transfer` CON canal— es justo el que un
    `model_validator(mode="after")` puede romper al retocarse."""
    member, _plan = _create_member_with_plan(db_session, amount=15000)
    headers = auth_header(owner_user.email)

    response = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "transfer",
            "method_channel": "mercadopago",
            "period_month": 4,
            "period_year": 2026,
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    assert response.json()["method_channel"] == "mercadopago"


def test_anular_pago_recalcula_el_indicador_de_cuota_a_mora(
    client, owner_user, auth_header, db_session
):
    """Invariante I9: anular un pago no deja estado derivado obsoleto — el
    indicador de cuota se recalcula solo (no hay nada que persistir)."""
    member, _plan = _create_member_with_plan(db_session, amount=15000)
    headers = auth_header(owner_user.email)
    cur_month, cur_year = current_period()

    created = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "cash",
            "period_month": cur_month,
            "period_year": cur_year,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text

    before = client.get(f"/users/{member.id}", headers=headers)
    assert before.json()["membership_indicator"] == "up_to_date"

    payment_id = created.json()["id"]
    deleted = client.delete(f"/payments/{payment_id}", headers=headers)
    assert deleted.status_code == 204, deleted.text

    after = client.get(f"/users/{member.id}", headers=headers)
    assert after.json()["membership_indicator"] == "overdue"


def test_cambiar_el_plan_del_miembro_no_cambia_la_foto_del_pago_ya_registrado(
    client, owner_user, auth_header, db_session
):
    """I2/I3: cambiar el plan de un miembro con `POST /users/{id}/plan` no
    reescribe la foto (nombre/precio) de un pago ya registrado con el plan
    anterior."""
    member, plan = _create_member_with_plan(db_session, amount=20000, name="Plan Viejo")
    headers = auth_header(owner_user.email)

    created = client.post(
        "/payments/",
        json={
            "user_id": str(member.id),
            "method": "cash",
            "period_month": 5,
            "period_year": 2026,
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    payment_id = created.json()["id"]

    new_plan = models.MembershipPlan(
        name="Plan Nuevo", name_normalized="plan nuevo", is_active=True
    )
    db_session.add(new_plan)
    db_session.flush()
    db_session.add(
        models.MembershipPlanPrice(plan_id=new_plan.id, amount=40000, effective_from=date.today())
    )
    db_session.commit()

    change = client.post(
        f"/users/{member.id}/plan",
        json={"membership_plan_id": new_plan.id},
        headers=headers,
    )
    assert change.status_code == 200, change.text

    payment = client.get(f"/payments/{payment_id}", headers=headers)
    assert payment.status_code == 200, payment.text
    assert payment.json()["plan"] == {
        "id": plan.id,
        "name": "Plan Viejo",
        "reference_amount": 20000,
    }
