"""Entrega del link de invitación por email (design.md, decision 12).

Interfaz `NotificationSender` con dos implementaciones seleccionadas por
`NOTIFICATIONS_BACKEND` (`app/config.py`):

- `"log"` (default, y la que usa la suite de tests): escribe el link en
  `backend/logs/invitations.log`, no manda nada de verdad.
- `"smtp"`: `smtplib` de la biblioteca estándar. Sin dependencias nuevas.

WhatsApp **no** tiene implementación acá a propósito: no hay integración con ninguna
API de WhatsApp Business (ver decisión 12 y el hueco de spec 4). El link de WhatsApp
se genera y se muestra en la UI (`wa.me/<phone>?text=<link>`) para que el admin lo
dispare manualmente, igual que el patrón ya existente de recordatorios de pago.
"""

from __future__ import annotations

import logging
import smtplib
from abc import ABC, abstractmethod
from email.message import EmailMessage
from pathlib import Path

from .config import settings

log = logging.getLogger("request")

LOG_FILE = Path(__file__).resolve().parents[1] / "logs" / "invitations.log"


class NotificationSender(ABC):
    @abstractmethod
    def send_invitation_email(self, to: str, link: str) -> None:
        """Envía (o registra) el link de invitación por email."""


class LogNotificationSender(NotificationSender):
    """Default: no manda nada de verdad, deja el link en un archivo de log."""

    def send_invitation_email(self, to: str, link: str) -> None:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as handle:
            handle.write(f"[invitation-email] to={to} link={link}\n")
        log.info("Invitación (backend=log) para %s: %s", to, link)


class SmtpNotificationSender(NotificationSender):
    """`smtplib` de la biblioteca estándar. Sin dependencias nuevas."""

    def send_invitation_email(self, to: str, link: str) -> None:
        message = EmailMessage()
        message["Subject"] = f"Invitación a {settings.SMTP_FROM_NAME or 'Mini Espacio'}"
        message["From"] = settings.SMTP_FROM or settings.SMTP_USER or "no-reply@mini-espacio.local"
        message["To"] = to
        message.set_content(
            "Te invitaron a crear tu acceso al portal.\n\n"
            f"Completá tu registro acá: {link}\n\n"
            "Este link expira en 7 días."
        )

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(message)


def get_notification_sender() -> NotificationSender:
    if settings.NOTIFICATIONS_BACKEND == "smtp":
        return SmtpNotificationSender()
    return LogNotificationSender()
