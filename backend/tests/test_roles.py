"""Matriz de autorizacion por rol (owner / coach / user) en endpoints restringidos.

| Endpoint                 | owner | coach | user |
|--------------------------|-------|-------|------|
| GET /coaches             |  200  |  403  | 403  |
| GET /clients/            |  200  |  200  | 403  |
| GET /routines/my/client  |  403  |  403  | 200  |

`/clients/` va con barra final explicita: la ruta real es `@router.get("/")` sobre el
prefijo `/clients`, y sin barra FastAPI responde 307.
"""

from tests.helpers import COACH_EMAIL, OWNER_EMAIL


def _client_headers(client_user):
    return {"Authorization": f"Bearer {client_user['token']}"}


def test_user_no_accede_a_clientes(client, client_user):
    response = client.get("/clients/", headers=_client_headers(client_user))

    assert response.status_code == 403


def test_coach_no_accede_a_coaches(client, coach_user, auth_header):
    response = client.get("/coaches", headers=auth_header(COACH_EMAIL))

    assert response.status_code == 403


def test_owner_accede_a_coaches(client, owner_user, auth_header):
    response = client.get("/coaches", headers=auth_header(OWNER_EMAIL))

    assert response.status_code == 200, response.text


def test_coach_accede_a_clientes(client, coach_user, auth_header):
    response = client.get("/clients/", headers=auth_header(COACH_EMAIL))

    assert response.status_code == 200, response.text


def test_owner_no_accede_a_rutina_de_cliente(client, owner_user, auth_header):
    response = client.get("/routines/my/client", headers=auth_header(OWNER_EMAIL))

    assert response.status_code == 403


def test_coach_no_accede_a_rutina_de_cliente(client, coach_user, auth_header):
    response = client.get("/routines/my/client", headers=auth_header(COACH_EMAIL))

    assert response.status_code == 403


def test_user_accede_a_su_rutina(client, client_user):
    response = client.get("/routines/my/client", headers=_client_headers(client_user))

    assert response.status_code == 200, response.text
