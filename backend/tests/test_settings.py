"""Tests de autorización de `/settings` (capability `staff-endpoint-authorization`).

Antes de este change los tres endpoints (`GET`/`PUT`/`PATCH /settings`) respondían sin
exigir sesión ni rol. Ahora la lectura exige sesión de cualquier rol y la escritura
exige Dueño o Coach. El path exacto es `/settings` **sin** barra final: con barra,
`TestClient` sigue un 307 hacia una ruta que no existe y el assert falla por el
motivo equivocado.
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
