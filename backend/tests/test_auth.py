"""Smoke de autenticacion contra la API real: registro, login y endpoint protegido."""

from tests.helpers import CLIENT_EMAIL, PASSWORD

NEW_CLIENT = {
    "full_name": "Nueva Clienta",
    "email": "nueva.clienta@example.com",
    "password": "una-password-valida",
}


def test_client_register_devuelve_sesion_utilizable(client):
    response = client.post("/auth/client-register", json=NEW_CLIENT)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_con_credenciales_validas(client, client_user):
    response = client.post(
        "/auth/token",
        data={"username": CLIENT_EMAIL, "password": PASSWORD},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_con_password_incorrecta(client, client_user):
    # La spec pide "error de credenciales" sin fijar el numero: routers/auth.py
    # devuelve 400, no 401.
    response = client.post(
        "/auth/token",
        data={"username": CLIENT_EMAIL, "password": "password-equivocada"},
    )

    assert response.status_code == 400
    assert "access_token" not in response.json()


def test_me_con_token_valido(client, client_user):
    headers = {"Authorization": f"Bearer {client_user['token']}"}

    response = client.get("/auth/me", headers=headers)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email"] == CLIENT_EMAIL
    assert body["role"] == "user"


def test_me_sin_token(client):
    response = client.get("/auth/me")

    assert response.status_code == 401
    assert "email" not in response.json()


def test_me_con_token_invalido(client):
    # RequestLogMiddleware tambien intenta decodificar el token y loguea el fallo:
    # ese ruido en la salida es esperado, no es un error del test.
    response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer token.arbitrario.manipulado"},
    )

    assert response.status_code == 401
    assert "email" not in response.json()
