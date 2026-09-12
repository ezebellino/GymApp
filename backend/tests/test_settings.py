"""Tests de `/settings`: autorización y forma del recurso de configuración.

Los tres endpoints (`GET`/`PUT`/`PATCH /settings`) requieren sesión para leer y Dueño o
Coach para escribir. Además, desde `simplify-settings-view`, `AppSettings` ya no expone
los 5 campos deprecados (`default_fee`, `late_fee_grace_days`,
`payment_reminder_message`, `payment_reminder_last_sent_at`, `theme_preference`): el
`GET` nunca los devuelve y el `PUT` los ignora si vienen en el body. El path exacto es
`/settings` **sin** barra final: con barra, `TestClient` sigue un 307 hacia una ruta que
no existe y el assert falla por el motivo equivocado.
"""

from tests.helpers import COACH_EMAIL, OWNER_EMAIL


def test_get_settings_sin_token_responde_401(client):
    response = client.get("/settings")

    assert response.status_code == 401
    assert "gym_name" not in response.json()


def test_get_settings_con_token_invalido_responde_401(client):
    response = client.get(
        "/settings", headers={"Authorization": "Bearer no-es-un-token"}
    )

    assert response.status_code == 401
    assert "gym_name" not in response.json()


def test_get_settings_con_miembro_responde_200(client, client_user):
    response = client.get(
        "/settings", headers={"Authorization": f"Bearer {client_user['token']}"}
    )

    assert response.status_code == 200, response.text


def test_get_settings_con_owner_y_con_coach_responde_200(
    client, owner_user, coach_user, auth_header
):
    owner_response = client.get("/settings", headers=auth_header(OWNER_EMAIL))
    coach_response = client.get("/settings", headers=auth_header(COACH_EMAIL))

    assert owner_response.status_code == 200, owner_response.text
    assert coach_response.status_code == 200, coach_response.text
    assert owner_response.json() == coach_response.json()


def test_put_settings_sin_token_responde_401_y_no_modifica(
    client, owner_user, auth_header
):
    before = client.get("/settings", headers=auth_header(OWNER_EMAIL)).json()

    payload = dict(before)
    payload["gym_name"] = "Nombre Sin Autorizar"
    response = client.put("/settings", json=payload)

    assert response.status_code == 401

    after = client.get("/settings", headers=auth_header(OWNER_EMAIL)).json()
    assert after["gym_name"] == before["gym_name"]


def test_patch_settings_con_miembro_responde_403_y_no_modifica(
    client, owner_user, client_user, auth_header
):
    before = client.get("/settings", headers=auth_header(OWNER_EMAIL)).json()

    response = client.patch(
        "/settings",
        json={"gym_name": "Nombre De Miembro"},
        headers={"Authorization": f"Bearer {client_user['token']}"},
    )

    assert response.status_code == 403

    after = client.get("/settings", headers=auth_header(OWNER_EMAIL)).json()
    assert after["gym_name"] == before["gym_name"]


def test_put_settings_con_coach_actualiza(client, coach_user, auth_header):
    headers = auth_header(COACH_EMAIL)
    before = client.get("/settings", headers=headers).json()

    payload = dict(before)
    payload["gym_name"] = "Gimnasio Actualizado Por Coach"
    response = client.put("/settings", json=payload, headers=headers)

    assert response.status_code == 200, response.text
    assert response.json()["gym_name"] == "Gimnasio Actualizado Por Coach"

    after = client.get("/settings", headers=headers).json()
    assert after["gym_name"] == "Gimnasio Actualizado Por Coach"


DEPRECATED_FIELDS = (
    "default_fee",
    "late_fee_grace_days",
    "payment_reminder_message",
    "payment_reminder_last_sent_at",
    "theme_preference",
)

VIGENTES_FIELDS = (
    "gym_name",
    "currency",
    "allow_cash",
    "allow_transfer",
    "admin_name",
    "address",
    "contact_email",
    "contact_phone",
    "whatsapp_phone",
    "business_hours",
    "payment_alias",
    "payment_notes",
    "onboarding_message",
)


def test_get_settings_no_expone_los_campos_deprecados(client, owner_user, auth_header):
    response = client.get("/settings", headers=auth_header(OWNER_EMAIL))

    assert response.status_code == 200, response.text
    body = response.json()
    for field in DEPRECATED_FIELDS:
        assert field not in body


def test_put_settings_persiste_los_campos_vigentes(client, owner_user, auth_header):
    headers = auth_header(OWNER_EMAIL)
    before = client.get("/settings", headers=headers).json()

    payload = {field: before[field] for field in VIGENTES_FIELDS}
    payload["gym_name"] = "Gimnasio Persistido"
    payload["currency"] = "USD"
    payload["allow_cash"] = not before["allow_cash"]
    payload["allow_transfer"] = not before["allow_transfer"]
    payload["admin_name"] = "Responsable Actualizado"
    payload["address"] = "Otra Direccion 123"
    payload["contact_email"] = "nuevo@miniespacio.com"
    payload["contact_phone"] = "11 4444 4444"
    payload["whatsapp_phone"] = "11 4444 4444"
    payload["business_hours"] = "Lunes a viernes de 8 a 20 hs."
    payload["payment_alias"] = "NUEVO.ALIAS.GYM"
    payload["payment_notes"] = "Notas de pago actualizadas."
    payload["onboarding_message"] = "Mensaje operativo actualizado."

    response = client.put("/settings", json=payload, headers=headers)
    assert response.status_code == 200, response.text

    after = client.get("/settings", headers=headers).json()
    for field in VIGENTES_FIELDS:
        assert after[field] == payload[field], field


def test_put_settings_ignora_los_campos_deprecados_del_body(
    client, owner_user, auth_header
):
    headers = auth_header(OWNER_EMAIL)
    before = client.get("/settings", headers=headers).json()

    payload = {field: before[field] for field in VIGENTES_FIELDS}
    payload["default_fee"] = 99999
    payload["late_fee_grace_days"] = 10
    payload["payment_reminder_message"] = "Mensaje que no deberia persistir"
    payload["payment_reminder_last_sent_at"] = "2026-01-01T00:00:00"
    payload["theme_preference"] = "dark-copper"

    response = client.put("/settings", json=payload, headers=headers)

    assert response.status_code == 200, response.text
    body = response.json()
    for field in DEPRECATED_FIELDS:
        assert field not in body
