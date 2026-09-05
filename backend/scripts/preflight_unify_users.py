"""Pre-vuelo de solo lectura para la migracion `unify-clients-into-users`.

Corre contra el esquema **actual** (pre-migracion): tablas `users` + `clients` tal
como existen hoy. No escribe nada. Pensado para correr contra una copia de los datos
reales de produccion **antes** de `alembic upgrade head` (ver design.md, decision 6,
y tasks.md 1.1/1.1b/1.2).

Uso (desde `backend/`, con el venv activado):

    python -m scripts.preflight_unify_users

Reporta:
1. Colisiones de `clients.email` con un `users.email` existente, en pares NO linkeados
   (si estan linkeados via `users.client_id`, la migracion los fusiona sin problema).
2. Nombres de una sola palabra en `users.full_name` / `clients.full_name` (el split de
   `full_name` -> first_name/last_name deja `last_name` NULL).
3. Clientes sin email y sin telefono (no se los puede invitar despues de migrar).
4. Conteo de pares linkeados (`users.client_id IS NOT NULL`) y de filas de
   `payments`/`attendances`/`workout_logs` que la migracion va a reescribir.
5. Lista nominal (nombre + email) de `clients.is_active = false` que tienen cuenta de
   portal linkeada: son quienes pierden el login el dia del deploy (migran a
   `membership_status='cancelled'` con rol Miembro). El gimnasio tiene que verla antes
   de migrar, no enterarse por un reclamo.
6. Version de Postgres, para validar que `ALTER TYPE ... RENAME VALUE` es soportado
   (Postgres >= 10; si la version es menor, la migracion necesita el fallback de tipo
   nuevo + `USING` cast documentado en design.md).
7. Conteo de pares linkeados cuyo `users.role` YA es owner/coach (el caso "Coach que
   también entrena"): la migración preserva ese rol (no lo pisa con 'user'/'member'),
   pero conviene que el gimnasio vea la lista antes de migrar.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from sqlalchemy import create_engine, text  # noqa: E402

from app.config import settings  # noqa: E402


def _print_header(title: str) -> None:
    print()
    print("=" * 78)
    print(title)
    print("=" * 78)


def check_email_collisions(conn) -> None:
    _print_header("1. Colisiones de email (clients.email == users.email, sin link)")
    rows = conn.execute(
        text(
            """
            SELECT c.id AS client_id, c.full_name AS client_name, c.email AS email,
                   u.id AS user_id, u.full_name AS user_name
            FROM clients c
            JOIN users u ON lower(u.email) = lower(c.email)
            WHERE c.email IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM users u2 WHERE u2.client_id = c.id
              )
            ORDER BY c.email
            """
        )
    ).mappings().all()
    if not rows:
        print("Sin colisiones. OK.")
        return
    print(f"{len(rows)} colision(es) encontradas. La migracion inserta estos clientes con email=NULL:")
    for row in rows:
        print(
            f"  - client_id={row['client_id']} ({row['client_name']!r}, email={row['email']!r}) "
            f"colisiona con user_id={row['user_id']} ({row['user_name']!r})"
        )


def check_single_word_names(conn) -> None:
    _print_header("2. Nombres de una sola palabra (last_name quedaria NULL)")
    for table in ("users", "clients"):
        rows = conn.execute(
            text(
                f"""
                SELECT id, full_name FROM {table}
                WHERE full_name IS NOT NULL
                  AND trim(full_name) != ''
                  AND position(' ' in trim(full_name)) = 0
                ORDER BY full_name
                """
            )
        ).mappings().all()
        print(f"-- {table}: {len(rows)} fila(s)")
        for row in rows:
            print(f"  - id={row['id']} full_name={row['full_name']!r}")


def check_clients_without_contact(conn) -> None:
    _print_header("3. Clientes sin email y sin telefono (no invitables)")
    rows = conn.execute(
        text(
            """
            SELECT id, full_name FROM clients
            WHERE (email IS NULL OR trim(email) = '')
              AND (phone IS NULL OR trim(phone) = '')
            ORDER BY full_name
            """
        )
    ).mappings().all()
    if not rows:
        print("Ninguno. OK.")
        return
    print(f"{len(rows)} cliente(s) sin ningun dato de contacto:")
    for row in rows:
        print(f"  - id={row['id']} full_name={row['full_name']!r}")


def check_counts(conn) -> None:
    _print_header("4. Conteo de pares linkeados y filas de historial a reescribir")
    linked = conn.execute(
        text("SELECT count(*) FROM users WHERE client_id IS NOT NULL")
    ).scalar_one()
    print(f"Pares cuenta<->cliente ya linkeados (users.client_id IS NOT NULL): {linked}")

    for table in ("payments", "attendances", "workout_logs"):
        total = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()
        to_rewrite = conn.execute(
            text(
                f"""
                SELECT count(*) FROM {table} t
                JOIN users u ON u.client_id = t.client_id
                """
            )
        ).scalar_one()
        print(f"  {table}: {total} fila(s) totales, {to_rewrite} pertenecen a un cliente linkeado (se reescriben)")


def check_deactivated_with_portal(conn) -> None:
    _print_header(
        "5. Clientes is_active=false con cuenta de portal (pierden el login al migrar)"
    )
    # Acotado a `u.role NOT IN ('owner', 'coach')`: un Dueño/Coach que también
    # entrena conserva su rol tras la migración (hallazgo 8 de
    # verification.md) y con eso su acceso administrativo — solo pierde el
    # seguimiento de pagos/asistencia/rutinas, no el login. Ver el chequeo 7
    # más abajo para esos casos.
    rows = conn.execute(
        text(
            """
            SELECT c.id AS client_id, c.full_name AS client_name,
                   u.id AS user_id, u.email AS user_email, u.full_name AS user_name
            FROM clients c
            JOIN users u ON u.client_id = c.id
            WHERE c.is_active = false
              AND u.password_hash IS NOT NULL
              AND u.role NOT IN ('owner', 'coach')
            ORDER BY c.full_name
            """
        )
    ).mappings().all()
    if not rows:
        print("Ninguno. Nadie pierde el login por este motivo. OK.")
        return
    print(
        f"{len(rows)} persona(s) van a quedar bloqueadas (rol Miembro, membresia 'cancelled') "
        "el dia del deploy. Avisar/revisar con el gimnasio ANTES de migrar:"
    )
    for row in rows:
        print(
            f"  - {row['user_name']!r} <{row['user_email']}> "
            f"(client_id={row['client_id']}, user_id={row['user_id']})"
        )


def check_postgres_version(conn) -> None:
    _print_header("6. Version de Postgres (para ALTER TYPE ... RENAME VALUE)")
    version = conn.execute(text("SHOW server_version")).scalar_one()
    print(f"server_version = {version}")
    try:
        major = int(version.split(".")[0])
    except (ValueError, IndexError):
        major = None
    if major is not None and major < 10:
        print(
            "ATENCION: Postgres < 10 no soporta ALTER TYPE ... RENAME VALUE. "
            "Usar el fallback de tipo nuevo + USING cast documentado en design.md."
        )
    else:
        print("OK: soporta ALTER TYPE ... RENAME VALUE (Postgres >= 10).")


def check_staff_linked_as_clients(conn) -> None:
    _print_header(
        "7. Pares linkeados con rol owner/coach (\"Coach que también entrena\")"
    )
    rows = conn.execute(
        text(
            """
            SELECT u.id AS user_id, u.full_name AS user_name, u.role AS role,
                   c.id AS client_id
            FROM users u
            JOIN clients c ON u.client_id = c.id
            WHERE u.role IN ('owner', 'coach')
            ORDER BY u.full_name
            """
        )
    ).mappings().all()
    if not rows:
        print("Ninguno. OK.")
        return
    print(
        f"{len(rows)} cuenta(s) owner/coach con ficha de cliente linkeada. La migración "
        "preserva su rol (no lo pisa con 'user'/'member') y les copia la membresía:"
    )
    for row in rows:
        print(
            f"  - {row['user_name']!r} rol={row['role']} "
            f"(user_id={row['user_id']}, client_id={row['client_id']})"
        )


def main() -> None:
    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    with engine.connect() as conn:
        check_email_collisions(conn)
        check_single_word_names(conn)
        check_clients_without_contact(conn)
        check_counts(conn)
        check_deactivated_with_portal(conn)
        check_postgres_version(conn)
        check_staff_linked_as_clients(conn)
    print()
    print("Pre-vuelo terminado. No se escribio nada en la base.")


if __name__ == "__main__":
    main()
