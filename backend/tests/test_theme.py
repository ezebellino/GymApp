"""Tests de la preferencia de tema por usuario: GET /auth/me y PATCH /auth/me/theme."""


def test_me_incluye_theme_preference_null_para_usuario_nuevo(client, owner_user, auth_header):
    response = client.get("/auth/me", headers=auth_header(owner_user.email))

    assert response.status_code == 200, response.text
    assert response.json()["theme_preference"] is None


def test_patch_theme_actualiza_y_persiste(client, owner_user, auth_header):
    headers = auth_header(owner_user.email)

    patch_response = client.patch(
        "/auth/me/theme", json={"theme_preference": "light"}, headers=headers
    )
    assert patch_response.status_code == 200, patch_response.text
    assert patch_response.json()["theme_preference"] == "light"

    get_response = client.get("/auth/me", headers=headers)
    assert get_response.status_code == 200, get_response.text
    assert get_response.json()["theme_preference"] == "light"


def test_patch_theme_con_valor_invalido_responde_422(client, owner_user, auth_header):
    response = client.patch(
        "/auth/me/theme",
        json={"theme_preference": "dark-gold"},
        headers=auth_header(owner_user.email),
    )

    assert response.status_code == 422


def test_patch_theme_sin_token_responde_401(client):
    response = client.patch("/auth/me/theme", json={"theme_preference": "light"})

    assert response.status_code == 401


def test_patch_theme_no_afecta_a_otro_usuario(client, owner_user, coach_user, auth_header):
    client.patch(
        "/auth/me/theme",
        json={"theme_preference": "light"},
        headers=auth_header(owner_user.email),
    )

    other_response = client.get("/auth/me", headers=auth_header(coach_user.email))

    assert other_response.status_code == 200, other_response.text
    assert other_response.json()["theme_preference"] is None
