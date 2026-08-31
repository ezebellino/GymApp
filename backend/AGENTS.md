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
- **Auth**: roles son `Dueño` y `Coach`, más un portal de cliente self-service (ver
  `routers/auth.py` y `routers/coaches.py`). Los endpoints protegidos usan dependencias de
  `deps.py` — no reimplementes chequeo de token a mano en un router nuevo.
- **CORS**: origins permitidos vienen de `CORS_ORIGINS` en `.env` (coma-separado). Si agregás un
  dominio de frontend nuevo, actualizá `.env.example` y `.env.docker.example` también.
- **Logs**: `app/logging_conf.py` escribe a `backend/logs/` (access/app/error). No commitear
  contenido de `logs/` (ya está en `.gitignore`).
- **Scripts**: son ejecutables sueltos pensados para correrse una vez (seed, import, fix de
  datos) — no son parte del arranque normal de la app. Si escribís uno nuevo, ponelo en
  `scripts/` con un nombre descriptivo, no lo mezcles con `app/`.
- **Tests**: no hay suite de tests todavía. Si el usuario pide agregar tests, usá pytest (hay una
  skill `python-testing-patterns` en `.agents/skills/`) y documentá el comando acá y en el
  Makefile una vez exista.
