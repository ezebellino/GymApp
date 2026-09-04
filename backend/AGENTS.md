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
  `user` (Cliente, el portal self-service). Los nombres en español son solo de producto; en
  código y en la API se usan los del enum (ver `routers/auth.py` y `routers/coaches.py`). Los
  endpoints protegidos usan dependencias de `deps.py` — no reimplementes chequeo de token a mano
  en un router nuevo.
- **CORS**: origins permitidos vienen de `CORS_ORIGINS` en `.env` (coma-separado). Si agregás un
  dominio de frontend nuevo, actualizá `.env.example` y `.env.docker.example` también.
- **Logs**: `app/logging_conf.py` escribe a `backend/logs/` (access/app/error). No commitear
  contenido de `logs/` (ya está en `.gitignore`).
- **Scripts**: son ejecutables sueltos pensados para correrse una vez (seed, import, fix de
  datos) — no son parte del arranque normal de la app. Si escribís uno nuevo, ponelo en
  `scripts/` con un nombre descriptivo, no lo mezcles con `app/`.
- **Tests**: hay suite con pytest en `backend/tests/` (`test_auth.py`, `test_roles.py`,
  `test_health.py`, `test_theme.py`). `test_theme.py` cubre la preferencia de tema por usuario
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
