"""unify clients into users

Fusiona las tablas `users` + `clients` en una unica tabla `users` (ver
`openspec/changes/unify-clients-into-users/design.md`, decision 6, para el detalle
completo de cada paso y las alternativas descartadas). Es **una sola revision** con
esquema y datos: el esquema nuevo no es desplegable sin los datos ya movidos, y
Postgres tiene DDL transaccional, asi que toda la revision entra o no entra completa.

Orden (idéntico al del design):
1. Columnas nuevas en `users`, todas nullable, sin default de servidor.
2. `email`/`password_hash` -> nullable; UNIQUE plana de email -> indice unico parcial.
3. Backfill de las filas `users` existentes (split de `full_name`, `membership_status`
   'none', `email_verified=true` para quien ya tiene password).
4. Insertar una fila `users` por cada `clients` SIN cuenta linkeada, reusando
   `clients.id` como `users.id`.
5. Para los pares linkeados (`users.client_id IS NOT NULL`): copiar el perfil del
   cliente sobre la fila `users` y reescribir `payments`/`attendances`/`workout_logs`
   de `client_id = clients.id` a `users.id`.
6. Renombrar `client_id` -> `user_id` en las tres tablas de historial, FKs a
   `users.id` con RESTRICT.
7. Drop de `users.client_id` y de la tabla `clients`.
8. `ALTER TYPE userrole RENAME VALUE 'user' TO 'member'`.
9. `SET NOT NULL` en `first_name`, `membership_status`, `phone_verified`,
   `email_verified`.

IMPORTANTE: en los pasos 3-7 el valor de rol que corresponde a "Miembro" todavia se
escribe literalmente como `'user'` porque el rename del enum (paso 8) corre despues -
Postgres no acepta la etiqueta `'member'` hasta ese punto. Después del rename, esas
mismas filas se leen con rol `member` sin ningun UPDATE adicional (renombrar un valor
de enum no reescribe filas).

Revision ID: e790291219f2
Revises: 9812b6c09a1a
Create Date: 2026-09-05 00:26:33.170852

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e790291219f2'
down_revision: Union[str, Sequence[str], None] = '9812b6c09a1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # ------------------------------------------------------------------
    # Paso 1: columnas nuevas en `users`, todas nullable
    # ------------------------------------------------------------------
    op.add_column("users", sa.Column("first_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("birth_date", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("weight_kg", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("height_cm", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(), nullable=True))
    op.add_column("users", sa.Column("phone_verified", sa.Boolean(), nullable=True))

    membership_status_enum = postgresql.ENUM(
        "none", "active", "cancelled", name="membershipstatus"
    )
    membership_status_enum.create(bind, checkfirst=True)
    op.add_column(
        "users",
        sa.Column(
            "membership_status",
            postgresql.ENUM(
                "none", "active", "cancelled", name="membershipstatus", create_type=False
            ),
            nullable=True,
        ),
    )
    op.add_column("users", sa.Column("membership_start_date", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("membership_cancelled_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("created_by_user_id", sa.String(), nullable=True))
    op.add_column("users", sa.Column("legacy_client_id", sa.String(), nullable=True))

    op.create_index("ix_users_legacy_client_id", "users", ["legacy_client_id"])
    op.create_foreign_key(
        "fk_users_created_by_user_id_users",
        "users",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # ------------------------------------------------------------------
    # Paso 2: email/password_hash nullable + indice unico parcial de email
    # ------------------------------------------------------------------
    op.drop_index("ix_users_email", table_name="users")
    op.alter_column("users", "email", existing_type=sa.String(), nullable=True)
    op.alter_column("users", "password_hash", existing_type=sa.String(), nullable=True)
    op.create_index(
        "ix_users_email_unique",
        "users",
        ["email"],
        unique=True,
        postgresql_where=sa.text("email IS NOT NULL"),
    )
    op.create_index("ix_users_phone", "users", ["phone"])
    op.create_index("ix_users_membership_status", "users", ["membership_status"])
    op.create_index("ix_users_membership_start_date", "users", ["membership_start_date"])
    op.create_index(
        "ix_users_full_name",
        "users",
        [sa.text("(first_name || ' ' || coalesce(last_name, ''))")],
    )

    # ------------------------------------------------------------------
    # Paso 3: backfill de las filas `users` existentes (staff: owner/coach/user)
    # ------------------------------------------------------------------
    op.execute(
        """
        UPDATE users
        SET
            first_name = split_part(trim(full_name), ' ', 1),
            last_name = CASE
                WHEN position(' ' in trim(full_name)) = 0 THEN NULL
                ELSE NULLIF(trim(substring(trim(full_name) from position(' ' in trim(full_name)) + 1)), '')
            END,
            membership_status = 'none'::membershipstatus,
            phone_verified = false,
            email_verified = CASE WHEN password_hash IS NOT NULL THEN true ELSE email_verified END
        """
    )
    # `full_name` deja de ser una columna (pasa a `hybrid_property`, ver models.py):
    # ya extrajimos first_name/last_name de ella para las filas existentes, se puede
    # soltar antes de insertar filas nuevas (que nunca la completarian).
    op.drop_column("users", "full_name")

    # ------------------------------------------------------------------
    # Log de colisiones de email (clients.email == users.email, sin link):
    # se insertan mas abajo con email=NULL. Nunca se auto-mergea por email.
    # ------------------------------------------------------------------
    op.execute(
        """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN
                SELECT c.id AS client_id, c.email AS email
                FROM clients c
                JOIN users u ON lower(u.email) = lower(c.email)
                WHERE c.email IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.client_id = c.id)
            LOOP
                RAISE NOTICE 'unify-clients-into-users: client_id=% email=% colisiona con un users.email existente; se migra con email=NULL', r.client_id, r.email;
            END LOOP;
        END $$;
        """
    )

    # ------------------------------------------------------------------
    # Paso 4: insertar una fila `users` por cada `clients` SIN cuenta linkeada,
    # reusando `clients.id` como `users.id`. Colision de email (con un `users.email`
    # existente, o entre clientes sin cuenta que comparten el mismo email) -> NULL.
    # ------------------------------------------------------------------
    op.execute(
        """
        INSERT INTO users (
            id, first_name, last_name, email, email_verified, phone, phone_verified,
            password_hash, role, is_active, membership_status, membership_start_date,
            membership_cancelled_at, created_at, created_by_user_id, legacy_client_id
        )
        SELECT
            c.id,
            split_part(trim(c.full_name), ' ', 1),
            CASE
                WHEN position(' ' in trim(c.full_name)) = 0 THEN NULL
                ELSE NULLIF(trim(substring(trim(c.full_name) from position(' ' in trim(c.full_name)) + 1)), '')
            END,
            c.effective_email,
            false,
            c.phone,
            false,
            NULL,
            'user'::userrole,
            true,
            (CASE WHEN c.is_active THEN 'active' ELSE 'cancelled' END)::membershipstatus,
            c.join_date,
            CASE WHEN c.is_active THEN NULL ELSE now() END,
            now(),
            c.created_by_user_id,
            c.id
        FROM (
            SELECT
                cl.*,
                CASE
                    WHEN cl.email IS NULL THEN NULL
                    WHEN EXISTS (
                        SELECT 1 FROM users u2 WHERE lower(u2.email) = lower(cl.email)
                    ) THEN NULL
                    WHEN EXISTS (
                        SELECT 1 FROM clients other
                        WHERE other.email IS NOT NULL
                          AND lower(other.email) = lower(cl.email)
                          AND other.id < cl.id
                          AND NOT EXISTS (SELECT 1 FROM users u3 WHERE u3.client_id = other.id)
                    ) THEN NULL
                    ELSE cl.email
                END AS effective_email
            FROM clients cl
            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.client_id = cl.id)
        ) c
        """
    )

    # ------------------------------------------------------------------
    # Preparacion para el paso 5: soltar las FKs viejas de historial (-> clients)
    # antes de reescribir client_id hacia el id del usuario que sobrevive.
    # ------------------------------------------------------------------
    op.drop_constraint("payments_client_id_fkey", "payments", type_="foreignkey")
    op.drop_constraint("attendances_client_id_fkey", "attendances", type_="foreignkey")
    op.drop_constraint("workout_logs_client_id_fkey", "workout_logs", type_="foreignkey")

    # ------------------------------------------------------------------
    # Paso 5: pares linkeados (`users.client_id IS NOT NULL`) - copiar perfil del
    # cliente sobre la fila `users` (email y nombre de `users` quedan autoritativos)
    # y reescribir el historial de `client_id = clients.id` a `users.id`.
    #
    # El rol de `users` NO se toca: ya es el correcto para esa cuenta (owner/coach/
    # user) desde antes de esta migracion. Un Dueño o Coach que ademas entrena
    # ("Coach que también entrena", escenario explicito de la spec) llega a este
    # UPDATE con `client_id` seteado pero rol owner/coach — forzar `role='user'`
    # acá le borraría los permisos administrativos (hallazgo 8 de la
    # verificación de `unify-clients-into-users`).
    # ------------------------------------------------------------------
    op.execute(
        """
        UPDATE users u
        SET
            phone = c.phone,
            membership_start_date = c.join_date,
            membership_status = (CASE WHEN c.is_active THEN 'active' ELSE 'cancelled' END)::membershipstatus,
            membership_cancelled_at = CASE WHEN c.is_active THEN NULL ELSE now() END,
            legacy_client_id = c.id
        FROM clients c
        WHERE u.client_id = c.id
        """
    )
    op.execute(
        """
        UPDATE payments p
        SET client_id = u.id
        FROM users u
        WHERE u.client_id = p.client_id
        """
    )
    op.execute(
        """
        UPDATE attendances a
        SET client_id = u.id
        FROM users u
        WHERE u.client_id = a.client_id
        """
    )
    op.execute(
        """
        UPDATE workout_logs w
        SET client_id = u.id
        FROM users u
        WHERE u.client_id = w.client_id
        """
    )

    # ------------------------------------------------------------------
    # Paso 6: renombrar client_id -> user_id en las tres tablas de historial,
    # FKs nuevas a users.id con RESTRICT (no CASCADE: "no hay eliminacion fisica").
    # ------------------------------------------------------------------
    op.alter_column("payments", "client_id", new_column_name="user_id")
    op.alter_column("attendances", "client_id", new_column_name="user_id")
    op.alter_column("workout_logs", "client_id", new_column_name="user_id")

    op.execute("ALTER INDEX ix_payments_client_id RENAME TO ix_payments_user_id")
    op.execute("ALTER INDEX ix_attendances_client_id RENAME TO ix_attendances_user_id")
    op.execute("ALTER INDEX ix_workout_logs_client_id RENAME TO ix_workout_logs_user_id")

    op.create_foreign_key(
        "fk_payments_user_id_users", "payments", "users", ["user_id"], ["id"], ondelete="RESTRICT"
    )
    op.create_foreign_key(
        "fk_attendances_user_id_users", "attendances", "users", ["user_id"], ["id"], ondelete="RESTRICT"
    )
    op.create_foreign_key(
        "fk_workout_logs_user_id_users", "workout_logs", "users", ["user_id"], ["id"], ondelete="RESTRICT"
    )

    # ------------------------------------------------------------------
    # Paso 7: drop de users.client_id y de la tabla clients
    # ------------------------------------------------------------------
    op.drop_constraint("fk_users_client_id_clients", "users", type_="foreignkey")
    op.drop_index("ix_users_client_id", table_name="users")
    op.drop_column("users", "client_id")
    op.drop_table("clients")

    # ------------------------------------------------------------------
    # Paso 8: rename del valor del enum de rol. Fallback (si esta version de
    # Postgres no soporta ALTER TYPE ... RENAME VALUE, ver design.md decision 3):
    # crear un tipo `userrole_new` con los 3 valores y castear la columna con
    # `USING role::text::userrole_new`.
    # ------------------------------------------------------------------
    op.execute("ALTER TYPE userrole RENAME VALUE 'user' TO 'member'")

    # ------------------------------------------------------------------
    # Paso 9: SET NOT NULL en las columnas que ya quedaron completas para toda fila
    # ------------------------------------------------------------------
    op.execute("UPDATE users SET email_verified = false WHERE email_verified IS NULL")
    op.alter_column("users", "first_name", existing_type=sa.String(), nullable=False)
    op.alter_column(
        "users",
        "membership_status",
        existing_type=postgresql.ENUM(
            "none", "active", "cancelled", name="membershipstatus", create_type=False
        ),
        nullable=False,
    )
    op.alter_column("users", "phone_verified", existing_type=sa.Boolean(), nullable=False)
    op.alter_column("users", "email_verified", existing_type=sa.Boolean(), nullable=False)


def downgrade() -> None:
    raise NotImplementedError(
        "Esta migracion fusiona `clients` en `users` y no es reversible con fidelidad: "
        "una vez fusionadas las filas no hay forma de reconstruir cual era cuenta y cual "
        "era ficha de cliente. La estrategia de rollback es restaurar el snapshot de la "
        "base tomado inmediatamente antes de correr `alembic upgrade head` (ver "
        "openspec/changes/unify-clients-into-users/design.md, decision 6 y Migration Plan)."
    )
