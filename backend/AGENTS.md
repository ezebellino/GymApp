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
                      #   reports, settings, coaches, routines, routine_templates,
                      #   routine_assignments
  models.py           # modelos SQLAlchemy
  schemas.py           # schemas Pydantic (request/response)
  auth.py, security.py # JWT, hashing, dependencias de auth
  deps.py               # dependencias inyectables (DB session, current_user, etc.)
  middleware.py         # CORS y middlewares custom
  config.py             # settings (pydantic-settings, lee .env)
  database.py            # engine + sesión SQLAlchemy
  routine_catalog.py      # catálogo estático de ejercicios por grupo muscular/día
  progression.py           # motor de progresión (add-routine-templates), función pura
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
python -m scripts.seed_dev_users   # crea/actualiza los 3 usuarios de desarrollo (o `make seed-dev` desde la raíz)
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
- **Plantillas de rutina, progresión y asignación** (`routine-templates`, `progression-strategies`,
  `routine-assignment`, `member-routine-view`, change `add-routine-templates`): capa nueva sobre el
  catálogo compartido de días/ejercicios que ya existía, sin cambiar su semántica.
  - `app/progression.py`: función pura `plan_sets(strategy, *, sets, reps, weight_kg) ->
    list[PlannedSet]` con las cinco estrategias (Constante, Pirámide, Invertida, Drop set,
    Rest-pause) y sus constantes del sistema (`ROUND_STEP_KG`, `PYRAMID_RATE`, etc., sin endpoint
    que las escriba). Sin imports de SQLAlchemy ni FastAPI; aritmética con `Decimal` y
    `ROUND_HALF_UP` explícito (no `round()`, que usa banker's rounding). El plan se calcula
    **siempre** en el backend, nunca en el frontend.
  - `app/routers/routine_templates.py` (`/routines/templates`, owner+coach): alta/edición/borrado
    de plantillas (`RoutineTemplate` + `RoutineTemplateDay`, subconjunto ordenado de
    `TrainingDay`) y la configuración activo/estrategia por (plantilla, día, ejercicio)
    (`RoutineTemplateExercise`, filas ralas con fallback a `TrainingDayExercise.is_active` +
    estrategia Constante cuando no hay fila propia — así un reseed del catálogo
    (`_ensure_seed_data`) nunca borra la configuración de una plantilla). Nombre único
    case-insensitive vía columna derivada `name_normalized` (NFC + strip + casefold en Python, no
    `lower()` de SQL: se comporta distinto en SQLite y Postgres).
  - `app/routers/routine_assignments.py`: dos routers en el mismo archivo — `router`
    (`/routines/users/{user_id}/templates`, owner+coach, reusa `require_can_manage_user` de
    `deps.py`) para asignar/reasignar una plantilla a un Miembro (estado Activa/Alternativa, como
    máximo una Activa por índice único parcial `ix_routine_assignments_user_active`) y ajustar la
    base de un ejercicio por cliente con autoría (`RoutineAssignmentBase`); y `my_router`
    (`/routines/my/templates`, rol member) de solo lectura para "Mi rutina", que resuelve la base
    con precedencia ajuste-de-cliente → catálogo (`_resolve_base`) y omite los ejercicios
    inactivos. Dar de baja la membresía de un Miembro **no** oculta ni borra sus asignaciones (esos
    endpoints no filtran por `membership_status`); asignar una plantilla nueva sí exige membresía
    activa.
  - El catálogo de ejercicios (`Exercise`) sumó `base_sets`/`base_reps`/`base_weight_kg` (default
    3/10/0) al flujo existente de alta/edición (`POST`/`PUT /routines/exercises`, sigue
    `require_role(owner)`, sin cambio de permiso ni pantalla de alta nueva en el frontend).
  - **Migración manual en Railway**: la migración `add routine templates` (tablas nuevas +
    columnas de base en `exercises`) **no** corre sola en el deploy (Railway no ejecuta
    migraciones automáticamente). Antes de promover el build con este código, aplicar
    `python -m alembic upgrade head` contra la `DATABASE_URL` de producción (por ejemplo con
    `railway run` sobre el servicio de backend). Hasta que corra, los endpoints nuevos y también
    los **existentes** de catálogo de ejercicios fallarían con columna inexistente
    (`exercises.base_sets`).
- **Invitación de miembro** (`member-invitation`): `app/notifications.py` define
  `NotificationSender` (`NOTIFICATIONS_BACKEND=log` por default, escribe el link en
  `backend/logs/invitations.log`; `smtp` usa `smtplib` de la stdlib con `SMTP_*` en `.env`, sin
  dependencias nuevas) y `FRONTEND_BASE_URL` arma el link `/invitacion/{channel}/{token}`. El
  WhatsApp **no** tiene integración real: el link se genera y la UI ofrece un botón `wa.me`, igual
  que el patrón ya usado para recordatorios de pago — no hay envío automático.
- **Verificación manual de contacto** (`user-management`, `move-user-actions-to-detail`):
  `POST /users/{user_id}/contact/verify` (sin canal, sin body, `routers/users.py:verify_contact`)
  deja que un Dueño o Coach con permiso de gestión (`require_can_manage_user`) marque a mano,
  **en una sola acción**, todos los datos de contacto cargados y aún sin verificar (`pending`:
  `email` si `obj.email` y no `obj.email_verified`, `phone` con el mismo criterio) — 409 "No hay
  datos de contacto para verificar" si `pending` queda vacía (nada cargado, o todo lo cargado ya
  verificado), sin escribir nada. Un dato no cargado o ya verificado simplemente se omite: ya no
  hay 400. Si el usuario tiene una invitación **pendiente** (no vencida: `_pending_invitation_for`,
  wrapper de `_live_invitation_for` + `expires_at` futuro), también marca en ella cada canal recién
  verificado (`email_verified_at`/`phone_verified_at`), sin tocar `password_hash`, `completed_at`
  ni emitir token — no sustituye la verificación por link, es una afirmación del admin.
- **Logs**: `app/logging_conf.py` escribe a `backend/logs/` (access/app/error). No commitear
  contenido de `logs/` (ya está en `.gitignore`).
- **Scripts**: son ejecutables sueltos pensados para correrse una vez (seed, import, fix de
  datos) — no son parte del arranque normal de la app. Si escribís uno nuevo, ponelo en
  `scripts/` con un nombre descriptivo, no lo mezcles con `app/`.
  - `scripts/seed_dev_users.py` (capability `dev-role-switcher`; `make seed-dev` desde la raíz)
    hace upsert por email de los tres usuarios de desarrollo — `dev.owner@miniespacio.local`
    (Dueño), `dev.coach@miniespacio.local` (Coach) y `dev.member@miniespacio.local` (Miembro con
    `membership_status=active`), password `devdev123` en los tres — con los flags que exigen los
    gates de `auth.py` (`password_hash`, `email_verified=True`, `is_active=True`). Es idempotente:
    correrlo N veces deja exactamente esas 3 filas. La constante `DEV_USERS` es la única
    definición del lado backend; la copia del frontend vive en
    `frontend/src/components/dev/devUsers.ts` (duplicada a propósito, si divergen el widget
    devuelve un 400 con mensaje accionable). **Se niega a correr fuera de desarrollo** con doble
    candado, evaluado **antes** de abrir cualquier conexión: `settings.ENVIRONMENT` (campo nuevo
    en `config.py`, default `"production"` — si nadie lo declara, el seed no corre; los
    `.env*.example` ya traen `development`) tiene que estar en `{development, local, test}` **y**
    el host de `DATABASE_URL` en `{localhost, 127.0.0.1, db, ""}`. Si un candado cierra, imprime
    cuál y sale con código 1 (no 0: desde `make`/CI una negativa no puede parecer éxito).
    `seed_dev_users(db)` está separada de `main()` (sin guardas ni engine) para poder testearla
    sobre la SQLite de la suite.
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
  `test_contact_verification.py`, `test_payments.py`, `test_dev_seed.py`, `test_progression.py`,
  `test_exercise_base.py`, `test_routine_templates.py`, `test_routine_assignments.py`,
  `test_member_routine.py`).
  `test_dev_seed.py` cubre `scripts/seed_dev_users.py`: primera corrida crea los 3 usuarios (uno
  por rol, Miembro con membresía activa), segunda corrida no duplica ni falla, los tres pasan
  `POST /auth/token` + `GET /auth/me` de verdad, y las dos guardas de entorno (`ENVIRONMENT`
  no-dev y `DATABASE_URL` remota) hacen que `main()` salga con `SystemExit != 0` sin llamar a
  `create_engine` (se reemplaza por un centinela que falla si se invoca).
  `test_membership.py` cubre el indicador de 3 estados (`utils.membership_indicator`), el bloqueo
  de login por baja **scopeado por rol** (`auth.is_membership_blocking_login` — un Miembro dado de
  baja no entra, un Coach-miembro dado de baja sí entra y además se ve "suspended" en el listado:
  las dos reglas están desacopladas a propósito), el enforcement en sesión abierta (401 inmediato
  en `get_current_user`, no solo en `POST /auth/token`) y las fechas de baja/reactivación.
  `test_invitations.py` cubre el flujo completo de `member-invitation` (alta, verificación
  independiente de los dos canales, expiración, reenvío, y que una baja posterior a una invitación
  ya completada vuelve a bloquear el login). `test_contact_verification.py` cubre
  `POST /users/{id}/contact/verify` (una sola acción, sin canal): owner verificando los dos datos
  pendientes de un miembro y coach verificando el suyo, que un teléfono ya verificado no se toca
  de nuevo (solo el email pendiente), que un teléfono sin cargar no impide verificar el email, el
  409 sin nada pendiente (ni con ambos ya verificados ni sin ningún dato cargado) sin escribir
  nada, el 403 de un coach sobre otro coach, el 404 de un usuario inexistente, que marca en la
  invitación vigente solo los canales recién verificados (no el que ya estaba verificado en el
  usuario), que tras verificar ambos canales cualquiera de los dos links de invitación habilita
  `can_set_password`, que sin invitación vigente no crea ninguna fila, que no toca una invitación
  vencida, y que nunca define `password_hash` ni completa la invitación. `tests/helpers.py` expone
  `create_user(...)` para
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
  - `test_progression.py` cubre `app/progression.py` con los escenarios numéricos exactos de la
    spec `progression-strategies`: Constante, los cuatro casos de Pirámide (incluido el piso de 3
    reps), los tres de Invertida (incluido el piso de 2,5 kg), los dos de Drop set (incluido el
    redondeo half-up de `1,5 × R` con R impar) y los dos de Rest-pause (incluido el piso de 1 rep),
    más un caso sintético que demuestra que `round()` de Python (banker's rounding) daría un
    resultado distinto al `ROUND_HALF_UP` que usa el motor.
  - `test_exercise_base.py` cubre la base (series × reps · kg) en el flujo existente de
    `POST`/`PUT /routines/exercises`: crear un ejercicio indicando la base, crear sin indicarla
    (default 3×10 · 0 kg), editar la base de uno existente, que una base inválida (sets ≤ 0 o
    peso negativo) responde 422, que un Coach no puede editarla (403, mismo permiso que el resto
    del endpoint) y que editar la base cambia el plan ya calculado de toda plantilla que incluya
    ese ejercicio.
  - `test_routine_templates.py` cubre `routers/routine_templates.py`: alta con días, rechazo sin
    días, edición de nombre/etiqueta, nombre único ignorando mayúsculas y espacios en los bordes,
    que quitar y volver a agregar un día conserva la configuración de sus ejercicios, que
    desactivar un ejercicio conserva su estrategia, que un ejercicio nuevo arranca en Constante,
    que el mismo ejercicio tiene estrategia propia por plantilla, borrado sin asignaciones,
    rechazo del borrado con asignaciones (con el conteo en el mensaje), que cambiar la estrategia
    devuelve el plan recalculado, que un reseed del catálogo no borra la configuración de ninguna
    plantilla, y que un Miembro no puede listar plantillas (403).
  - `test_routine_assignments.py` cubre `routers/routine_assignments.py` (`router`): asignar como
    Activa/Alternativa, que una nueva Activa degrada la anterior, los 409 de membresía dada de
    baja/nunca activa/rol no-Miembro, que reactivar la membresía habilita asignar, que dar de baja
    la membresía conserva las asignaciones ya existentes (consultadas desde la ficha del admin),
    el ajuste de base con autoría y fecha, la asignación sin ajustes, quitar el ajuste (vuelve a
    la base del catálogo) y quitar una asignación (Alternativa, y que quitar la Activa no
    promueve ninguna Alternativa).
  - `test_member_routine.py` cubre `routers/routine_assignments.py` (`my_router`, "Mi rutina"): que
    un Miembro solo ve sus propias plantillas asignadas, la lista vacía sin asignaciones, que
    pedir la asignación de otro Miembro responde 404 (no 403, para no filtrar existencia), que el
    detalle solo trae los días de la plantilla, que un ejercicio desactivado no aparece en el
    plan, que el plan usa la base ajustada por cliente cuando existe, que un cambio de estrategia
    del admin se refleja de inmediato, y que un Miembro dado de baja sigue viendo sus plantillas
    — este último caso, dado que `auth.is_membership_blocking_login` (regla preexistente, fuera
    de alcance de este change) bloquea con 401 cualquier request de un Miembro dado de baja
    incluso con un token ya emitido, se verifica con un override de `get_current_user` apuntando
    directo al Miembro ya dado de baja (mismo patrón que el override de `get_db` de
    `conftest.py`), en vez de loguearse de nuevo por HTTP.
