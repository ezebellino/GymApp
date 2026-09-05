# backend/AGENTS.md

Instrucciones específicas del backend. Ver también el [AGENTS.md de la raíz](../AGENTS.md) para
convenciones generales, CodeGraph y OpenSpec (aplican también acá).

## Stack

FastAPI + SQLAlchemy 2.x + Alembic + PostgreSQL (Supabase en prod, Postgres en Docker local).
Auth JWT propia (`app/auth.py`, `app/security.py`). Python 3, venv en `backend/.venv`.

## Estructura

```text
app/
  main.py            # entrypoint FastAPI, registra routers y middleware
  routers/           # un router por dominio: auth, clients, payments, attendance,
                      #   reports, settings, coaches, routines
  models.py           # modelos SQLAlchemy
  schemas.py           # schemas Pydantic (request/response)
  auth.py, security.py # JWT, hashing, dependencias de auth
  deps.py               # dependencias inyectables (DB session, current_user, etc.)
  middleware.py         # CORS y middlewares custom
  config.py             # settings (pydantic-settings, lee .env)
  database.py            # engine + sesión SQLAlchemy
  routine_catalog.py      # catálogo estático de ejercicios por grupo muscular/día
migrations/               # Alembic — versions/ tiene el historial de migraciones
scripts/                  # utilidades one-off: create_owner, seeds, import CSV, etc.
```

Al agregar un endpoint nuevo: router en `app/routers/<dominio>.py`, schema en `schemas.py`,
registrar el router en `main.py` si es un módulo nuevo.

## Comandos

Desde la raíz del repo (usa el venv de `backend/.venv` vía Makefile):

```bash
make setup-backend      # crea venv + instala requirements + copia .env.example -> .env
make backend            # uvicorn --reload en :8001
make migrate            # alembic upgrade head
make lint-backend        # ruff check . (config en backend/ruff.toml)
```

Directo dentro de `backend/` (con el venv activado):

```bash
python -m alembic revision --autogenerate -m "<descripción>"   # nueva migración tras editar models.py
python -m alembic upgrade head
python scripts/create_owner.py     # crea usuario owner inicial
```

## Convenciones

- **Modelos**: cualquier cambio en `app/models.py` necesita una migración Alembic nueva. Revisá
  el autogenerate (`alembic revision --autogenerate`) siempre a mano antes de aplicar — a veces
  genera drops o cambios de tipo no deseados.
- **Auth**: el enum `models.UserRole` tiene **tres** roles — `owner` (Dueño), `coach` (Coach) y
  `member` (Miembro, el portal self-service; renombrado desde `user` en `unify-clients-into-users`
  — el modelo `Client` ya no existe, se fusionó en `User`). Los nombres en español son solo de
  producto; en código y en la API se usan los del enum (ver `routers/auth.py` y `routers/users.py`,
  que reemplazó a `routers/clients.py` + `routers/coaches.py`). Los endpoints protegidos usan
  dependencias de `deps.py` (`require_role`, `require_can_manage_user`) — no reimplementes chequeo
  de token o de permisos a mano en un router nuevo.
  - Ser "miembro del gimnasio" (con rutinas, asistencia y pagos) es un atributo funcional
    (`membership_status: none|active|cancelled`) independiente del rol: un Dueño o Coach puede
    además estar marcado como miembro. Dos reglas separadas a propósito, en módulos distintos:
    `utils.membership_indicator()` (color del listado, no mira el rol) y
    `auth.is_membership_blocking_login()` (bloqueo de acceso, solo aplica a rol `member`, no mira
    los pagos). Nunca fusionar esa lógica.
- **CORS**: origins permitidos vienen de `CORS_ORIGINS` en `.env` (coma-separado). Si agregás un
  dominio de frontend nuevo, actualizá `.env.example` y `.env.docker.example` también.
- **Invitación de miembro** (`member-invitation`): `app/notifications.py` define
  `NotificationSender` (`NOTIFICATIONS_BACKEND=log` por default, escribe el link en
  `backend/logs/invitations.log`; `smtp` usa `smtplib` de la stdlib con `SMTP_*` en `.env`, sin
  dependencias nuevas) y `FRONTEND_BASE_URL` arma el link `/invitacion/{channel}/{token}`. El
  WhatsApp **no** tiene integración real: el link se genera y la UI ofrece un botón `wa.me`, igual
  que el patrón ya usado para recordatorios de pago — no hay envío automático.
- **Logs**: `app/logging_conf.py` escribe a `backend/logs/` (access/app/error). No commitear
  contenido de `logs/` (ya está en `.gitignore`).
- **Scripts**: son ejecutables sueltos pensados para correrse una vez (seed, import, fix de
  datos) — no son parte del arranque normal de la app. Si escribís uno nuevo, ponelo en
  `scripts/` con un nombre descriptivo, no lo mezcles con `app/`.
- **Lint**: `ruff` (config en `backend/ruff.toml`, `target-version = "py313"`), select por
  defecto (`E4` imports, `E7` statements, `E9` errores de sintaxis, `F` pyflakes — sin `E501` de
  línea larga ni familias extra como `I`/`B`/`UP`). `per-file-ignores`: `F401` en
  `migrations/versions/*.py` (Alembic autogenera `op`/`sa` aunque la revision no los use, y esas
  migraciones ya aplicadas no se editan) y `E402` en `scripts/*.py` (los scripts one-off empujan
  el root al `sys.path` antes de importar `app.*`). Se corre con `make lint-backend` desde la
  raíz o `cd backend && .venv/bin/python -m ruff check .`; la dependencia vive en
  `backend/requirements-dev.txt` junto a pytest.
- **Tests**: hay suite con pytest en `backend/tests/` (`test_auth.py`, `test_roles.py`,
  `test_health.py`, `test_theme.py`, `test_membership.py`, `test_invitations.py`,
  `test_payments.py`).
  `test_membership.py` cubre el indicador de 3 estados (`utils.membership_indicator`), el bloqueo
  de login por baja **scopeado por rol** (`auth.is_membership_blocking_login` — un Miembro dado de
  baja no entra, un Coach-miembro dado de baja sí entra y además se ve "suspended" en el listado:
  las dos reglas están desacopladas a propósito), el enforcement en sesión abierta (401 inmediato
  en `get_current_user`, no solo en `POST /auth/token`) y las fechas de baja/reactivación.
  `test_invitations.py` cubre el flujo completo de `member-invitation` (alta, verificación
  independiente de los dos canales, expiración, reenvío, y que una baja posterior a una invitación
  ya completada vuelve a bloquear el login). `tests/helpers.py` expone `create_user(...)` para
  crear usuarios directo en la base con cualquier rol/`membership_status` — no hay auto-registro
  (`/auth/client-register` se retiró). `test_theme.py` cubre la preferencia de tema por usuario
  (`theme_preference` en `users`, adoptada en `adopt-kinetic-obsidian-theme`): `GET /auth/me`
  incluye `theme_preference` (`null` para un usuario nuevo); `PATCH /auth/me/theme` con
  `{"theme_preference": "light"}` responde 200 y un `GET` posterior lo devuelve; con un valor que
  no sea `"dark"`/`"light"` (p. ej. `"dark-gold"`) responde 422; sin token responde 401; y con dos
  usuarios, el `PATCH` de uno no cambia el `theme_preference` del otro (aislamiento). Se corre con
  `make test-backend` desde la raíz, o
  `cd backend && .venv/bin/python -m pytest` (el venv vive en `backend/.venv`). Config en
  `backend/pytest.ini`; las
  dependencias de test viven en `backend/requirements-dev.txt` (`-r requirements.txt` + pytest),
  que instala `make setup-backend` — el `Dockerfile` y Railway siguen usando solo
  `requirements.txt`, así que pytest no entra en la imagen de producción.
  - **La base de test es SQLite de archivo** en un directorio temporal, con el esquema creado por
    `Base.metadata.create_all()` (las migraciones son Postgres-only y no corren en SQLite).
    `tests/conftest.py` pisa `DATABASE_URL` **antes** de importar `app`, así que el `.env` real
    nunca se toca. Consecuencia: no se pueden testear los endpoints que usan `date_trunc`
    (reportes y KPIs de pagos) — quedan fuera de cobertura a propósito.
  - **No exportes `CORS_ORIGINS` como variable de entorno en formato coma-separado** (ni en tu
    shell ni en CI): `Settings.CORS_ORIGINS` es `list[str]` y pydantic-settings intenta parsear
    JSON antes de que corra el `field_validator` que soporta ese formato, así que el import de
    `Settings` falla con `SettingsError`. Usá formato JSON o no la setees.
  - Hay una skill `python-testing-patterns` en `.agents/skills/` con patrones de pytest.
  - `test_payments.py` cubre alta/lectura/borrado de un pago (`POST`/`GET`/`DELETE /payments`)
    sobre un miembro con membresía activa — la cobertura mínima que exige `make lint` haber
    tocado `app/routers/payments.py` para el gate de `add-verification-gates-to-opsx-flow`.
