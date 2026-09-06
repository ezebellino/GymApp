"""Tests de la verificación manual de contacto (`user-management`, endpoint único

`POST /users/{id}/contact/verify`, ver design.md de `move-user-actions-to-detail`,
decisión D1: una sola acción verifica todos los canales pendientes a la vez).
"""

from datetime import datetime, timedelta

from app import models
from tests.helpers import COACH_EMAIL, OWNER_EMAIL, create_user


def _create_member_without_access(
    db_session,
    *,
    email,
    phone="1122334455",
    email_verified=False,
    phone_verified=False,
):
    member = create_user(
        db_session,
        email=email,
        first_name="Sin",
        last_name="Acceso",
        role=models.UserRole.member,
        password_hash=None,
    )
    member.phone = phone
    member.email_verified = email_verified
    member.phone_verified = phone_verified
    db_session.commit()
    db_session.refresh(member)
    return member


def _extract_token(link: str) -> str:
    return link.rstrip("/").split("/")[-1]


def test_owner_verifica_los_dos_datos_pendientes_de_un_miembro(
    client, owner_user, auth_header, db_session
):
    member = _create_member_without_access(db_session, email="ambos@example.com")

    response = client.post(
        f"/users/{member.id}/contact/verify", headers=auth_header(OWNER_EMAIL)
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email_verified"] is True
    assert body["phone_verified"] is True


def test_verificar_con_el_telefono_ya_verificado_solo_toca_el_email(
    client, owner_user, auth_header, db_session
):
    member = _create_member_without_access(
        db_session, email="soloemail@example.com", phone_verified=True
    )

    response = client.post(
        f"/users/{member.id}/contact/verify", headers=auth_header(OWNER_EMAIL)
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email_verified"] is True
    assert body["phone_verified"] is True


def test_verificar_sin_telefono_cargado_verifica_el_email_sin_error(
    client, owner_user, auth_header, db_session
):
    member = _create_member_without_access(
        db_session, email="sintelefono@example.com", phone=None
    )

    response = client.post(
        f"/users/{member.id}/contact/verify", headers=auth_header(OWNER_EMAIL)
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email_verified"] is True
    assert body["phone_verified"] is False


def test_verificar_sin_nada_pendiente_responde_409_y_no_cambia_nada(
    client, owner_user, auth_header, db_session
):
    member = _create_member_without_access(
        db_session,
        email="yatodo@example.com",
        email_verified=True,
        phone_verified=True,
    )

    response = client.post(
        f"/users/{member.id}/contact/verify", headers=auth_header(OWNER_EMAIL)
    )

    assert response.status_code == 409
    db_session.refresh(member)
    assert member.email_verified is True
    assert member.phone_verified is True


def test_verificar_un_usuario_sin_datos_de_contacto_responde_409(
    client, owner_user, auth_header, db_session
):
    member = _create_member_without_access(
        db_session, email="sindatos@example.com", phone=None
    )
    member.email = None
    db_session.commit()

    response = client.post(
        f"/users/{member.id}/contact/verify", headers=auth_header(OWNER_EMAIL)
    )

    assert response.status_code == 409


def test_coach_verifica_el_contacto_de_un_miembro(
    client, coach_user, auth_header, db_session
):
    member = _create_member_without_access(db_session, email="coachverifica@example.com")

    response = client.post(
        f"/users/{member.id}/contact/verify", headers=auth_header(COACH_EMAIL)
    )

    assert response.status_code == 200, response.text
    assert response.json()["email_verified"] is True


def test_coach_no_puede_verificar_el_contacto_de_otro_coach(
    client, coach_user, auth_header, db_session
):
    other_coach = create_user(
        db_session,
        email="otro-coach@example.com",
        first_name="Otro",
        last_name="Coach",
        role=models.UserRole.coach,
    )

    response = client.post(
        f"/users/{other_coach.id}/contact/verify", headers=auth_header(COACH_EMAIL)
    )

    assert response.status_code == 403


def test_verificar_un_usuario_inexistente_responde_404(client, owner_user, auth_header):
    response = client.post(
        "/users/00000000-0000-0000-0000-000000000000/contact/verify",
        headers=auth_header(OWNER_EMAIL),
    )

    assert response.status_code == 404


def test_verificacion_manual_marca_en_la_invitacion_vigente_solo_los_canales_recien_verificados(
    client, owner_user, auth_header, db_session
):
    member = _create_member_without_access(
        db_session, email="parcial@example.com", phone_verified=True
    )
    headers = auth_header(OWNER_EMAIL)
    client.post(f"/users/{member.id}/invitation", headers=headers)

    response = client.post(f"/users/{member.id}/contact/verify", headers=headers)

    assert response.status_code == 200, response.text
    invitation = (
        db_session.query(models.MemberInvitation)
        .filter(models.MemberInvitation.user_id == member.id)
        .first()
    )
    assert invitation.email_verified_at is not None
    assert invitation.phone_verified_at is None


def test_tras_verificar_ambos_canales_cualquier_link_habilita_la_contrasenia(
    client, owner_user, auth_header, db_session
):
    member = _create_member_without_access(db_session, email="mixto@example.com")
    headers = auth_header(OWNER_EMAIL)
    invite = client.post(f"/users/{member.id}/invitation", headers=headers).json()
    email_token = _extract_token(invite["email_link"])
    phone_token = _extract_token(invite["phone_link"])

    client.post(f"/users/{member.id}/contact/verify", headers=headers)

    for channel, token in (("email", email_token), ("phone", phone_token)):
        response = client.get(f"/invitations/{channel}/{token}")
        assert response.status_code == 200, response.text
        assert response.json()["can_set_password"] is True


def test_verificar_sin_invitacion_vigente_no_crea_ninguna_invitacion(
    client, owner_user, auth_header, db_session
):
    member = _create_member_without_access(db_session, email="sininvitacion@example.com")

    response = client.post(
        f"/users/{member.id}/contact/verify", headers=auth_header(OWNER_EMAIL)
    )

    assert response.status_code == 200, response.text
    count = (
        db_session.query(models.MemberInvitation)
        .filter(models.MemberInvitation.user_id == member.id)
        .count()
    )
    assert count == 0


def test_verificacion_manual_no_toca_una_invitacion_vencida(
    client, owner_user, auth_header, db_session
):
    member = _create_member_without_access(db_session, email="vencida@example.com")
    headers = auth_header(OWNER_EMAIL)
    client.post(f"/users/{member.id}/invitation", headers=headers)

    invitation = (
        db_session.query(models.MemberInvitation)
        .filter(models.MemberInvitation.user_id == member.id)
        .first()
    )
    invitation.expires_at = datetime.utcnow() - timedelta(days=1)
    db_session.commit()

    response = client.post(f"/users/{member.id}/contact/verify", headers=headers)

    assert response.status_code == 200, response.text
    db_session.refresh(invitation)
    assert invitation.email_verified_at is None
    assert invitation.phone_verified_at is None


def test_verificacion_manual_no_define_contrasenia_ni_completa_la_invitacion(
    client, owner_user, auth_header, db_session
):
    member = _create_member_without_access(db_session, email="sinpassword@example.com")
    headers = auth_header(OWNER_EMAIL)
    client.post(f"/users/{member.id}/invitation", headers=headers)

    response = client.post(f"/users/{member.id}/contact/verify", headers=headers)

    assert response.status_code == 200, response.text
    assert "access_token" not in response.json()
    db_session.refresh(member)
    assert member.password_hash is None
    invitation = (
        db_session.query(models.MemberInvitation)
        .filter(models.MemberInvitation.user_id == member.id)
        .first()
    )
    assert invitation.completed_at is None
