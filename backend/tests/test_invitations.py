"""Tests del flujo de invitación (`member-invitation`)."""

from datetime import datetime, timedelta

from app import models
from tests.helpers import OWNER_EMAIL, PASSWORD, create_user


def _create_member_without_access(db_session, *, email, phone="1122334455"):
    member = create_user(
        db_session,
        email=email,
        first_name="Sin",
        last_name="Acceso",
        role=models.UserRole.member,
        password_hash=None,
    )
    member.phone = phone
    db_session.commit()
    db_session.refresh(member)
    return member


def test_invitar_sin_celular_responde_400(client, owner_user, auth_header, db_session):
    member = _create_member_without_access(db_session, email="sincel@example.com", phone=None)

    response = client.post(f"/users/{member.id}/invitation", headers=auth_header(OWNER_EMAIL))

    assert response.status_code == 400


def test_invitar_a_un_coach_responde_400(client, owner_user, coach_user, auth_header):
    response = client.post(f"/users/{coach_user.id}/invitation", headers=auth_header(OWNER_EMAIL))

    assert response.status_code == 400


def test_invitar_genera_los_dos_links(client, owner_user, auth_header, db_session):
    member = _create_member_without_access(db_session, email="invitable@example.com")

    response = client.post(f"/users/{member.id}/invitation", headers=auth_header(OWNER_EMAIL))

    assert response.status_code == 200, response.text
    body = response.json()
    assert "/invitacion/email/" in body["email_link"]
    assert "/invitacion/phone/" in body["phone_link"]


def _extract_token(link: str) -> str:
    return link.rstrip("/").split("/")[-1]


def test_verificar_solo_email_deja_el_celular_sin_verificar(
    client, owner_user, auth_header, db_session
):
    member = _create_member_without_access(db_session, email="unsolocanal@example.com")
    invite = client.post(
        f"/users/{member.id}/invitation", headers=auth_header(OWNER_EMAIL)
    ).json()
    email_token = _extract_token(invite["email_link"])

    response = client.get(f"/invitations/email/{email_token}")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["email_verified"] is True
    assert body["phone_verified"] is False
    assert body["can_set_password"] is False


def test_completar_con_un_solo_canal_verificado_responde_409(
    client, owner_user, auth_header, db_session
):
    member = _create_member_without_access(db_session, email="incompleto@example.com")
    invite = client.post(
        f"/users/{member.id}/invitation", headers=auth_header(OWNER_EMAIL)
    ).json()
    email_token = _extract_token(invite["email_link"])
    client.get(f"/invitations/email/{email_token}")

    response = client.post(
        f"/invitations/email/{email_token}/complete",
        json={"password": "una-password-valida"},
    )

    assert response.status_code == 409
    assert "phone" in response.json()["detail"]["missing_channels"]


def test_completar_con_ambos_canales_verificados_devuelve_token(
    client, owner_user, auth_header, db_session
):
    member = _create_member_without_access(db_session, email="completo@example.com")
    invite = client.post(
        f"/users/{member.id}/invitation", headers=auth_header(OWNER_EMAIL)
    ).json()
    email_token = _extract_token(invite["email_link"])
    phone_token = _extract_token(invite["phone_link"])
    client.get(f"/invitations/email/{email_token}")
    client.get(f"/invitations/phone/{phone_token}")

    response = client.post(
        f"/invitations/email/{email_token}/complete",
        json={"password": "una-password-valida"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["access_token"]

    login_response = client.post(
        "/auth/token",
        data={"username": "completo@example.com", "password": "una-password-valida"},
    )
    assert login_response.status_code == 200, login_response.text


def test_link_vencido_responde_410(client, owner_user, auth_header, db_session):
    member = _create_member_without_access(db_session, email="vencido@example.com")
    invite = client.post(
        f"/users/{member.id}/invitation", headers=auth_header(OWNER_EMAIL)
    ).json()
    email_token = _extract_token(invite["email_link"])

    invitation = (
        db_session.query(models.MemberInvitation)
        .filter(models.MemberInvitation.user_id == member.id)
        .first()
    )
    invitation.expires_at = datetime.utcnow() - timedelta(days=1)
    db_session.commit()

    response = client.get(f"/invitations/email/{email_token}")

    assert response.status_code == 410


def test_reenvio_invalida_el_link_anterior(client, owner_user, auth_header, db_session):
    member = _create_member_without_access(db_session, email="reenvio@example.com")
    headers = auth_header(OWNER_EMAIL)
    first_invite = client.post(f"/users/{member.id}/invitation", headers=headers).json()
    old_email_token = _extract_token(first_invite["email_link"])

    second_invite = client.post(f"/users/{member.id}/invitation", headers=headers).json()
    new_email_token = _extract_token(second_invite["email_link"])

    old_response = client.get(f"/invitations/email/{old_email_token}")
    assert old_response.status_code == 410

    new_response = client.get(f"/invitations/email/{new_email_token}")
    assert new_response.status_code == 200, new_response.text


def test_reenvio_no_revoca_la_viva_si_falla_el_envio_de_email(
    client, owner_user, auth_header, db_session, monkeypatch
):
    """Hallazgo N5 de verification.md: el envío va ANTES de tocar la base — si el
    `NotificationSender` revienta (SMTP caído), la invitación viva no se revoca ni se
    inserta una nueva a medias, así el admin puede reintentar sin haber perdido el
    link que ya funcionaba."""
    member = _create_member_without_access(db_session, email="reenvio.falla@example.com")
    headers = auth_header(OWNER_EMAIL)

    first_invite = client.post(f"/users/{member.id}/invitation", headers=headers)
    assert first_invite.status_code == 200, first_invite.text

    live = (
        db_session.query(models.MemberInvitation)
        .filter(
            models.MemberInvitation.user_id == member.id,
            models.MemberInvitation.revoked_at.is_(None),
        )
        .one()
    )

    def _send_que_revienta(self, to, link):
        raise RuntimeError("SMTP caído")

    monkeypatch.setattr(
        "app.notifications.LogNotificationSender.send_invitation_email",
        _send_que_revienta,
    )

    try:
        client.post(f"/users/{member.id}/invitation", headers=headers)
        raised = False
    except RuntimeError:
        raised = True
    assert raised, "se esperaba que el envío fallido se propagara"

    db_session.expire_all()
    still_live = db_session.get(models.MemberInvitation, live.id)
    assert still_live.revoked_at is None

    email_token = _extract_token(first_invite.json()["email_link"])
    still_valid = client.get(f"/invitations/email/{email_token}")
    assert still_valid.status_code == 200, still_valid.text


def test_login_con_invitacion_pendiente_es_rechazado(client, owner_user, auth_header, db_session):
    member = _create_member_without_access(db_session, email="pendiente@example.com")
    client.post(f"/users/{member.id}/invitation", headers=auth_header(OWNER_EMAIL))

    response = client.post(
        "/auth/token",
        data={"username": "pendiente@example.com", "password": "cualquier-cosa"},
    )

    assert response.status_code == 400
    assert "invitación" in response.json()["detail"].lower()


def test_baja_posterior_a_invitacion_completada_vuelve_a_bloquear(
    client, owner_user, auth_header, db_session
):
    member = _create_member_without_access(db_session, email="completoybaja@example.com")
    headers = auth_header(OWNER_EMAIL)
    invite = client.post(f"/users/{member.id}/invitation", headers=headers).json()
    email_token = _extract_token(invite["email_link"])
    phone_token = _extract_token(invite["phone_link"])
    client.get(f"/invitations/email/{email_token}")
    client.get(f"/invitations/phone/{phone_token}")
    client.post(
        f"/invitations/email/{email_token}/complete",
        json={"password": "una-password-valida"},
    )

    client.post(f"/users/{member.id}/membership/cancel", json={}, headers=headers)

    response = client.post(
        "/auth/token",
        data={"username": "completoybaja@example.com", "password": "una-password-valida"},
    )
    assert response.status_code == 400
