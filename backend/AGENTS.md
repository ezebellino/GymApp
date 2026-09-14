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
                      #   routine_assignments, exercises
  models.py           # modelos SQLAlchemy
  schemas.py           # schemas Pydantic (request/response)
  auth.py, security.py # JWT, hashing, dependencias de auth
  deps.py               # dependencias inyectables (DB session, current_user, get_storage, etc.)
  middleware.py         # CORS y middlewares custom
  config.py             # settings (pydantic-settings, lee .env)
  database.py            # engine + sesión SQLAlchemy
  storage.py               # puerto ObjectStorage (media de ejercicios, add-exercise-catalog)
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
- **Migraciones en el deploy (Railway)**: el deploy **sí** aplica las migraciones pendientes
  solo. `backend/railway.json` declara `deploy.preDeployCommand: ["python -m alembic upgrade
  head"]`, que Railway corre en un contenedor aparte del build nuevo, con las mismas variables de
  entorno (incluida `DATABASE_URL`) y **antes** de arrancar el proceso web. Consecuencias:
  - Si la migración falla, el deploy queda en `failed` y **el deploy anterior sigue sirviendo
    tráfico**: no queda código nuevo contra un esquema viejo. El error se ve en los logs del
    servicio (sección Deploy), no en los del proceso web.
  - `alembic upgrade head` es idempotente: en un deploy sin migraciones nuevas no hace nada y
    agrega unos segundos.
  - **No** corre en el proceso web: el `CMD` del `Dockerfile` y el `startCommand` siguen siendo
    solo uvicorn, para que las migraciones nunca bloqueen el healthcheck de `/health`.
  - Sigue valiendo la regla de no dejar dos heads de Alembic: `alembic upgrade head` explota con
    `Multiple head revisions` y ahí el deploy falla entero, no solo una query suelta.
  - Ya no hace falta `railway run alembic upgrade head` a mano antes de promover un build. Queda
    como herramienta de rescate si hay que aplicar algo fuera de un deploy.
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
  `routine-assignment`, `member-routine-view`, `template-owned-routine-days`): los días de una
  plantilla son propiedad exclusiva de esa plantilla — no hay ningún catálogo compartido de días
  ni de vínculos día↔ejercicio (ese diseño, de `add-exercise-catalog`/`drop-static-exercise-catalog`,
  se retiró entero en `template-owned-routine-days`: `app/routine_catalog.py`, `TrainingDay`,
  `TrainingDayExercise` y `RoutineTemplateExercise` ya no existen).
  - `app/progression.py`: función pura `plan_sets(strategy, *, sets, reps, weight_kg) ->
    list[PlannedSet]` con las cinco estrategias (Constante, Pirámide, Invertida, Drop set,
    Rest-pause) y sus constantes del sistema (`ROUND_STEP_KG`, `PYRAMID_RATE`, etc., sin endpoint
    que las escriba). Sin imports de SQLAlchemy ni FastAPI; aritmética con `Decimal` y
    `ROUND_HALF_UP` explícito (no `round()`, que usa banker's rounding). El plan se calcula
    **siempre** en el backend, nunca en el frontend.
  - **Modelo**: `RoutineTemplate` tiene `days` (`RoutineTemplateDay`, `cascade="all,
    delete-orphan"`, ordenados por `position`); cada día tiene sus propios `muscle_groups`
    (`RoutineTemplateDayMuscleGroup`, 0..n) y `exercises` (`RoutineTemplateDayExercise`, PK propia
    — estar en la tabla **es** estar en el día, no hay flag `is_active` intermedio). `base_sets`/
    `base_reps`/`base_weight_kg` (default 3/10/0 kg, `DEFAULT_EXERCISE_BASE_*` en `models.py`) y
    `strategy` viven en `RoutineTemplateDayExercise` — es el **único** lugar del modelo con una
    base: `Exercise` no tiene columnas de base propia (se dropearon en este change). El mismo
    ejercicio en dos días, o en dos plantillas, tiene base y estrategia completamente
    independientes. `RoutineTemplateDay` no tiene columna `name`: el título "Día N" se deriva de
    `position` en el serializador.
  - `app/routers/routine_templates.py` (`/routines/templates`, owner+coach):
    - `POST` toma solo `{name, tag}` y crea la plantilla **y** su Día 1 vacío en la misma
      transacción — la invariante "toda plantilla tiene ≥1 día" vale desde el `INSERT`, sin
      depender de un `PUT` encadenado del frontend.
    - `PATCH` solo edita `name`/`tag`; toda la edición de días pasa por
      `PUT /routines/templates/{id}/days`.
    - `PUT /routines/templates/{id}/days` reemplaza el borrador completo (días, grupos musculares
      y ejercicios) en una sola transacción, con **identidad explícita**: cada día del payload
      trae `day_id` (conserva la fila, así los `WorkoutLog` que la referencian no se rompen) o
      `null` (crea un día nuevo). Un día ausente del payload se borra (cascade se lleva sus grupos
      musculares y ejercicios). El orden de las listas **es** el dato: la posición del día es su
      índice + 1, el `sort_order` del ejercicio es su índice. Un par (día, ejercicio) nuevo sin
      `base` toma la constante por defecto; uno existente sin `base` en el payload conserva la
      suya. Un ejercicio inactivo no se puede **agregar** de nuevo, pero uno que el día ya tenía
      agregado sobrevive en el detalle aunque el ejercicio se desactive después.
    - Nombre de plantilla único case-insensitive vía columna derivada `name_normalized` (NFC +
      strip + casefold en Python, no `lower()` de SQL: se comporta distinto en SQLite y Postgres).
  - `app/routers/routine_assignments.py`: dos routers en el mismo archivo — `router`
    (`/routines/users/{user_id}/templates`, owner+coach, reusa `require_can_manage_user` de
    `deps.py`) para asignar/reasignar una plantilla a un Miembro (estado Activa/Alternativa, como
    máximo una Activa por índice único parcial `ix_routine_assignments_user_active`) y ajustar la
    base de un ejercicio por cliente con autoría (`RoutineAssignmentBase`); y `my_router`
    (`/routines/my/templates`, rol member) de solo lectura para "Mi rutina". `_resolve_base` tiene
    una única precedencia: el ajuste de base por cliente si existe, si no la base propia del par
    (día, ejercicio) — ya no hay un tercer nivel de "catálogo". Dar de baja la membresía de un
    Miembro **no** oculta ni borra sus asignaciones (esos endpoints no filtran por
    `membership_status`); asignar una plantilla nueva sí exige membresía activa.
  - `WorkoutLog.day_id` es `nullable` con `ondelete="SET NULL"`: quitar un día de una plantilla
    (o borrarla entera) no borra el histórico de logs, solo desvincula la FK. `day_name` es un
    snapshot `NOT NULL` (`"Día {position}"`) tomado al insertar, así el histórico conserva una
    etiqueta legible aunque el día se borre después. La suite depende de que SQLite tenga
    `PRAGMA foreign_keys=ON` para verificar este `SET NULL` — ver la sección de Tests.
- **Catálogo de ejercicios y su media** (`app/routers/exercises.py`, `/exercises`, owner+coach,
  change `add-exercise-catalog`): CRUD del catálogo (nombre único case/trim-insensitive vía
  `name_normalized`, mismo patrón que `routine_templates.py`), grupo muscular (`MuscleGroup`,
  0..1, columna `String` nullable — no `Enum()` de SQLAlchemy, para que Postgres y SQLite se
  comporten igual) y tipos de entrenamiento (`TrainingType`, 0..n, tabla de asociación
  `exercise_training_types`), ambos validados contra la lista fija del enum de Python y expuestos
  al frontend por `GET /exercises/meta`. El catálogo **no tiene base de progresión propia**
  (`template-owned-routine-days` dropeó `base_sets`/`base_reps`/`base_weight_kg` de `Exercise`: la
  base vive exclusivamente en `RoutineTemplateDayExercise`, ver más arriba). Todo el router de
  `/routines` que ese diseño anterior necesitaba se retiró con él: `GET /routines/catalog`,
  `GET /routines/days`, `GET /routines/exercises` y `PUT /routines/exercises/{id}` ya no existen
  (`POST /routines/exercises` ya se había retirado antes, en `add-exercise-catalog`). El alta y la
  edición del catálogo pasan **solo** por `POST`/`PATCH /exercises/`.
  - **Media de un ejercicio**: dos campos independientes y opcionales — `external_media_url`
    (URL pegada a mano) y archivo propio (`POST/DELETE /exercises/{id}/media`, multipart, hasta
    `STORAGE_MAX_UPLOAD_BYTES`). Si hay los dos, el archivo propio gana (`media_kind` lo resuelve
    el backend, la UI no reimplementa la prioridad). Se persiste la **key** del objeto
    (`media_object_key`), nunca la URL: con bucket privado la URL es prefirmada y efímera. Orden
    fijo en cualquier reemplazo o borrado: `put_object`/`UPDATE` → `commit` → recién después
    `delete_object` del objeto viejo, *best effort* (log `WARNING`, nunca un `500` de una
    operación ya commiteada). Desactivar un ejercicio no toca su objeto de storage.
  - **Puerto `ObjectStorage`** (`app/storage.py`, `Protocol` con `put_object`, `delete_object`
    idempotente y `presigned_get_url`): dos implementaciones, `S3ObjectStorage` (boto3;
    `endpoint_url` configurable sirve igual para MinIO local y para el bucket de Railway en prod)
    e `InMemoryObjectStorage` (dict en memoria, solo para tests). Se resuelve con la dependencia
    `get_storage()` de `app/deps.py` (cacheada con `lru_cache` sobre la config), overrideable en
    tests exactamente igual que `get_db`. `presigned_get_url` no hace red (HMAC local) y cuantiza
    la expiración a `STORAGE_URL_WINDOW_SECONDS` para que la misma key devuelva la misma URL byte
    a byte dentro de la ventana (pega en la caché HTTP del `<video>`/`<img>`).
    `S3ObjectStorage` arma **dos clientes** de boto3 (design D3.1): uno de **operaciones**
    (`put_object`/`delete_object`) contra `STORAGE_ENDPOINT_URL` (el endpoint con el que el
    backend habla de verdad) y uno de **firma** (`generate_presigned_url`) contra
    `STORAGE_PUBLIC_ENDPOINT_URL` (el endpoint que tiene que poder resolver el browser); si los
    dos coinciden se reusa el mismo cliente. El cliente de firma nunca hace I/O — presignar es
    HMAC local —, así que da igual que su endpoint sea inalcanzable desde el contenedor. **Nunca**
    reescribir el host de una URL ya firmada: SigV4 firma `host` dentro de `SignedHeaders` y el
    resultado es una firma inválida (403 de MinIO/S3).
  - **Variables `STORAGE_*` en `config.py`** (todas con default, documentadas en
    `.env.example`/`.env.docker.example`): `STORAGE_BACKEND` (`s3` | `memory`, la suite usa
    `memory`), `STORAGE_ENDPOINT_URL` (con quién **habla** el backend),
    `STORAGE_PUBLIC_ENDPOINT_URL` (contra quién se **firma** la URL que ve el browser; default
    `""` ⇒ cae a `STORAGE_ENDPOINT_URL`), `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`,
    `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET`, `STORAGE_MAX_UPLOAD_BYTES` (25 MB),
    `STORAGE_URL_TTL_SECONDS`, `STORAGE_USE_PATH_STYLE` (MinIO lo necesita) y
    `STORAGE_URL_WINDOW_SECONDS`.

    **Qué endpoint usa cada entorno (design D3.1)** — Compose es el único donde hablar y firmar
    difieren, y por lo tanto el único donde hace falta setear `STORAGE_PUBLIC_ENDPOINT_URL`:

    | Entorno | `STORAGE_ENDPOINT_URL` (hablar) | `STORAGE_PUBLIC_ENDPOINT_URL` (firmar) |
    |---|---|---|
    | `make dev` (nativo) | `http://localhost:9000` | vacío ⇒ cae al de la izquierda |
    | `make docker-up` (Compose) | `http://minio:9000` | `http://localhost:9000` |
    | Railway | endpoint del bucket gestionado | vacío ⇒ cae al de la izquierda |

    En Compose, `http://minio:9000` es el hostname interno de la red que solo el contenedor
    `backend` puede resolver; sin `STORAGE_PUBLIC_ENDPOINT_URL` ese mismo hostname quedaría
    embebido en la URL prefirmada y el browser (que corre en el host) no podría cargarla. No hace
    falta ningún `127.0.0.1 minio` en `/etc/hosts`: la variable resuelve el problema sin tocar la
    máquina.
  - **Dependencia nueva `boto3`** (`requirements.txt`, pineada; arrastra `botocore`, `s3transfer`,
    `jmespath`). `S3ObjectStorage` traduce `ClientError`/`EndpointConnectionError` de boto3 a
    `502` en la subida y a un log `WARNING` en el borrado — nunca los deja escalar a un `500`
    genérico.
  - **La suite corre sin red**: `tests/conftest.py` setea `STORAGE_BACKEND=memory` **antes** de
    importar `app.*` y overridea `get_storage()` con `InMemoryObjectStorage` (fixture `storage`) —
    cinturón (variable de entorno) y tirantes (override explícito), mismo patrón que `get_db`.
    `tests/test_storage.py` además instancia `S3ObjectStorage` con credenciales falsas para
    probar que `presigned_get_url` firma de verdad (trae `X-Amz-Signature`) sin abrir un socket, y
    con endpoints interno/público distintos (design D3.1) prueba que firma contra el público y
    que la URL es idéntica entre dos llamadas dentro de la misma ventana de cuantización.
- **El catálogo de ejercicios arranca vacío, en todos los entornos**: no existe ningún sembrado
  automático de `Exercise`, ni un catálogo global de días con el que sincronizarlo — cargar un
  ejercicio (`POST /exercises/`) no lo vincula a ningún "día" por su cuenta. `muscle_group` es
  solo un atributo del ejercicio: qué días de una plantilla lo incluyen es una decisión explícita
  del Dueño/Coach al editar esa plantilla (`PUT /routines/templates/{id}/days`), no algo derivado
  automáticamente. `template-owned-routine-days` retiró entero el mecanismo que existía antes
  (`app/routine_catalog.py::TRAINING_DAYS`, `ensure_training_days`, `sync_exercise_day_links`,
  las tablas `TrainingDay`/`TrainingDayExercise`) — no queda ningún proceso ni tabla que reponer
  al tocar el catálogo.
  - **Seed opcional de desarrollo**: `scripts/seed_dev_exercises.py` (ver "Scripts" más abajo) es
    la única forma de tener los 52 ejercicios de ejemplo a mano; nunca corre en producción, no
    crea ninguna plantilla ni día (son datasets sin relación entre sí), y el catálogo real lo
    carga el Dueño desde la UI.
- **Infraestructura local de MinIO**: `docker-compose.yml` suma los servicios `minio` (imagen
  pineada a un `RELEASE.*`, healthcheck contra `/minio/health/live`, puertos 9000 API / 9001
  consola) y `minio-init` (one-shot con `mc` que crea el bucket `gymapp-media` si no existe, para
  que `make docker-up` no dependa de un paso manual en la consola). `backend` depende de
  `minio: {condition: service_healthy}`.
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
    devuelve un 400 con mensaje accionable). **Se niega a correr fuera de desarrollo** con el
    doble candado compartido `scripts/dev_guards.py::check_environment_guards(what)`
    (`drop-static-exercise-catalog` design D4 — extraído de este script para que
    `seed_dev_exercises.py` lo reuse en vez de copiarlo), evaluado **antes** de abrir cualquier
    conexión: `settings.ENVIRONMENT` (campo en `config.py`, default `"production"` — si nadie lo
    declara, el seed no corre; los `.env*.example` ya traen `development`) tiene que estar en
    `{development, local, test}` **y** el host de `DATABASE_URL` en
    `{localhost, 127.0.0.1, db, ""}`. Si un candado cierra, imprime cuál (con `what` — "usuarios
    de desarrollo" o "ejercicios de desarrollo" — en el mensaje) y sale con código 1 (no 0: desde
    `make`/CI una negativa no puede parecer éxito). `seed_dev_users(db)` está separada de `main()`
    (sin guardas ni engine) para poder testearla sobre la SQLite de la suite.
  - `scripts/seed_dev_exercises.py` (`make seed-dev-exercises` desde la raíz, **opcional** — el
    catálogo arranca vacío en todos los entornos, ver más arriba) siembra 52 ejercicios de
    ejemplo. La constante `EXERCISE_LIBRARY` (id semántico, nombre y grupo muscular; sin base:
    `template-owned-routine-days` dropeó `base_sets`/`base_reps`/`base_weight_kg` de `Exercise`)
    vive **acá**, originalmente mudada desde `app/routine_catalog.py` (ya borrado):
    `backend/scripts/` no es importable desde `backend/app/`, así que ningún código de aplicación
    puede volver a derivar nada de esta lista. Mismo candado que `seed_dev_users.py`
    (`check_environment_guards("ejercicios de desarrollo")`), evaluado antes de `create_engine`.
    `seed_dev_exercises(db)` es idempotente por `id` (no pisa un ejercicio ya existente, ni
    siquiera si alguien le editó el grupo muscular a mano) y solo inserta filas de `Exercise` —
    ya no crea ningún vínculo día↔ejercicio (ese mecanismo no existe más; ver más arriba). **No**
    se cuelga de `make seed-dev` ni crea ninguna plantilla o día: son datasets sin relación entre
    sí (uno lo necesita el widget de cambio de rol para funcionar; el otro es conveniencia), y
    encadenarlos obliga a quien solo quiere usuarios a cargar 52 ejercicios.
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
  `test_contact_verification.py`, `test_payments.py`, `test_dev_seed.py`,
  `test_dev_seed_exercises.py`, `test_progression.py`, `test_routine_templates.py`,
  `test_routine_assignments.py`, `test_member_routine.py`, `test_routines_invariants.py`,
  `test_storage.py`, `test_exercises.py`, `test_exercise_media.py`).
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
  (`/auth/client-register` se retiró). También expone `create_exercise(db_session, *, id, name,
  muscle_group, ...)`, que inserta un `Exercise` directo en la base con su `name_normalized` —
  desde `template-owned-routine-days` (design D7) no toca ningún día ni vínculo: el catálogo ya
  no tiene base propia ni una relación implícita con "días", así que crear un ejercicio no hace
  que pertenezca a nada. Y `create_template_with_days(db_session, *, name, days=None, tag=None)`
  (design D13): arma una `RoutineTemplate` con sus propios días, grupos musculares y ejercicios
  (cada uno con `base_sets`/`base_reps`/`base_weight_kg`/`strategy` opcionales, default las
  constantes de `models.py`) directo en la base, para tests que solo necesitan una plantilla con
  contenido sin ejercitar el `PUT` de guardado del borrador. `conftest.py` suma dos fixtures
  **opt-in** (no `autouse`): `catalog_basic`, un puñado chico de ejercicios cuyos ids la suite
  nombra seguido (`chest-bench-press`, `chest-cable-fly`, `legs-back-squat`, entre otros) — un
  test que necesita un ejercicio de un grupo puntual que no cubre llama a `create_exercise`
  directamente —, y `template_with_days` (depende de `catalog_basic`), una plantilla con dos días
  y un ejercicio en cada uno, con la base 4×8 · 45 kg que varios tests de asignación/miembro ya
  esperaban. `conftest.py` también activa `PRAGMA foreign_keys=ON` por conexión de SQLite (fuera
  del bloque de `drop_all`/`create_all`, que necesita las FK desactivadas para poder romper el
  ciclo `users` ↔ `membership_plans`): sin esto, el `ondelete="SET NULL"`/`"CASCADE"` del modelo
  (por ejemplo `WorkoutLog.day_id`) no tiene ningún efecto en la suite, aunque sí en Postgres.
  `test_theme.py` cubre la preferencia de tema por usuario
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
    y la foto de plan/precio de `rebuild-payments-with-plan-pricing` (design D1-D4, invariantes
    I1-I9): que el alta congela el plan y el precio vigente del miembro al momento de registrar
    (no el del período cubierto), que sin `amount` usa el precio de referencia y que con
    `amount` editado guarda lo pagado y la referencia por separado, que el payload no puede
    aportar plan/precio propios (el servidor los ignora), el `400` de miembro sin plan asignado y
    el de membresía dada de baja, que un período futuro se acepta y que un segundo pago del mismo
    período responde `409`, que el listado tolera pagos previos sin foto ("Sin plan") y que
    renombrar/reprecio/desactivar el plan no reescribe pagos ya registrados, los filtros nuevos de
    `GET /payments` (período + método), `GET /payments/summary` (cobrado/pagados/pendientes del
    período, `403` para un Miembro) y que los 4 endpoints de reportes siguen sumando lo
    efectivamente pagado (`Payment.amount`), no la referencia. Corrección de `verify` (gate
    FALLA): `test_alta_con_method_cash_y_method_channel_responde_422` (un `model_validator` en
    `PaymentCreate` rechaza `method_channel` con `method="cash"`, deuda preexistente),
    `test_anular_pago_recalcula_el_indicador_de_cuota_a_mora` (invariante I9: `DELETE /payments`
    deja el indicador de cuota del miembro en `overdue`, sin persistir nada) y
    `test_cambiar_el_plan_del_miembro_no_cambia_la_foto_del_pago_ya_registrado` (`POST
    /users/{id}/plan` después del alta no toca la foto del pago).
  - `test_progression.py` cubre `app/progression.py` con los escenarios numéricos exactos de la
    spec `progression-strategies`: Constante, los cuatro casos de Pirámide (incluido el piso de 3
    reps), los tres de Invertida (incluido el piso de 2,5 kg), los dos de Drop set (incluido el
    redondeo half-up de `1,5 × R` con R impar) y los dos de Rest-pause (incluido el piso de 1 rep),
    más un caso sintético que demuestra que `round()` de Python (banker's rounding) daría un
    resultado distinto al `ROUND_HALF_UP` que usa el motor.
  - `test_routine_templates.py` cubre `routers/routine_templates.py`. Alta/edición/borrado:
    `POST` crea la plantilla con el Día 1 solo con `{name, tag}` (422 si el payload trae
    `day_ids`), edición de nombre/etiqueta, nombre único ignorando mayúsculas y espacios en los
    bordes, borrado sin asignaciones y su rechazo con asignaciones (con el conteo en el mensaje),
    y que un Miembro no puede listar plantillas (403). El grueso de la cobertura es
    `PUT /routines/templates/{id}/days` (`template-owned-routine-days`, design D5): guardar
    días/grupos/ejercicios en un solo request, 422 sin persistir nada al pasar de 5 días o
    de 0 días, que un día que no cambia conserva su `id` entre guardados, que quitar un día borra
    en cascada sus grupos y ejercicios, que quitar un día intermedio renumera las posiciones de
    forma contigua, que editar un día de una plantilla no toca los días de otra, que un ejercicio
    nuevo arranca en 3×10 · 0 kg y estrategia Constante, que editar la base de un ejercicio en un
    día no toca la del mismo ejercicio en otro día ni en otra plantilla, que el orden del payload
    se persiste como `sort_order`, 422 al repetir un ejercicio dentro del mismo día, 400 al
    mandar un `day_id` de otra plantilla, 400 al agregar un ejercicio inactivo (pero uno ya
    agregado sobrevive en el detalle), que un Coach puede guardar el borrador y un Miembro recibe
    403, y que cambiar la estrategia de un ejercicio devuelve el plan recalculado.
  - `test_routine_assignments.py` cubre `routers/routine_assignments.py` (`router`): asignar como
    Activa/Alternativa, que una nueva Activa degrada la anterior, los 409 de membresía dada de
    baja/nunca activa/rol no-Miembro, que reactivar la membresía habilita asignar, que dar de baja
    la membresía conserva las asignaciones ya existentes (consultadas desde la ficha del admin),
    el ajuste de base con autoría y fecha, la asignación sin ajustes, quitar el ajuste (vuelve a
    la base propia del par día-ejercicio, `template-owned-routine-days` design D4: ya no hay un
    tercer nivel de "catálogo") y quitar una asignación (Alternativa, y que quitar la Activa no
    promueve ninguna Alternativa). Suma de `template-owned-routine-days`: que el ajuste de base
    por cliente pisa la base propia de la plantilla, que quitar de la plantilla un ejercicio con
    ajuste conserva la asignación y el histórico, y 400 al ajustar la base de un ejercicio que no
    está en la plantilla.
  - `test_member_routine.py` cubre `routers/routine_assignments.py` (`my_router`, "Mi rutina"): que
    un Miembro solo ve sus propias plantillas asignadas, la lista vacía sin asignaciones, que
    pedir la asignación de otro Miembro responde 404 (no 403, para no filtrar existencia), que
    "Mi rutina" muestra solo los días y ejercicios de la plantilla asignada, que el plan usa la
    base ajustada por cliente cuando existe, que un cambio de estrategia del admin se refleja de
    inmediato, y que un Miembro dado de baja sigue viendo sus plantillas — este último caso, dado
    que `auth.is_membership_blocking_login` (regla preexistente, fuera de alcance de este change)
    bloquea con 401 cualquier request de un Miembro dado de baja incluso con un token ya emitido,
    se verifica con un override de `get_current_user` apuntando directo al Miembro ya dado de
    baja (mismo patrón que el override de `get_db` de `conftest.py`), en vez de loguearse de nuevo
    por HTTP. Suma de `template-owned-routine-days`: que un ejercicio quitado del día desaparece
    del plan pero sus logs siguen consultables, que quitar un día deja sus `WorkoutLog` con
    `day_id` nulo y conserva `day_name` (invariante que depende de `PRAGMA foreign_keys=ON` en
    SQLite — ver `conftest.py` más arriba), y que un cambio del coach en la plantilla se ve en el
    siguiente request del miembro.
  - `test_exercises.py` cubre `routers/exercises.py` (alta y validación, listas fijas y edición,
    listado y estado, borrado y el `401`/`403` de los 9 endpoints del router para el delta de
    `staff-endpoint-authorization`), y (`template-owned-routine-days`)
    `test_el_catalogo_de_ejercicios_ya_no_expone_ni_acepta_una_base`: candado de que el payload de
    alta/edición no acepta `base_sets`/`base_reps`/`base_weight_kg` y que el response no los
    incluye — esas columnas se dropearon de `Exercise`. `test_exercise_media.py` cubre el ciclo
    de vida del archivo propio (subida, límite de tamaño y formato, reemplazo, prioridad sobre la
    URL externa, y que un fallo del storage al subir responde `502` sin perder la media anterior)
    usando la fixture `storage` (`InMemoryObjectStorage`) de `conftest.py`.
  - `test_routines_invariants.py` (renombrado desde `test_routines_seed.py` en
    `template-owned-routine-days`; `drop-static-exercise-catalog` design D2 originalmente) cubre
    invariantes estructurales que sobreviven a los dos changes: que ningún módulo de `app/`
    importa el catálogo global de días retirado (recorre los módulos de `app/` y falla si alguno
    define o importa `TRAINING_DAYS`/`routine_catalog` — candado contra que la fuente de verdad
    retirada vuelva por descuido) y que los endpoints retirados de ese catálogo
    (`GET /routines/catalog`, `/routines/days`, `/routines/exercises`,
    `PUT /routines/exercises/{id}`) responden 404, no reviven por descuido. El resto del archivo
    original (`ensure_training_days`, el catálogo fijo, el reseed) se borró entero junto con el
    código que probaba: no queda nada de eso en `app/`.
  - `test_dev_seed_exercises.py` cubre `scripts/seed_dev_exercises.py`: primera corrida crea los
    52 ejercicios, una segunda corrida no duplica nada ni pisa un grupo muscular editado a mano
    entre medio (idempotencia real, no solo conteo de filas), y las mismas dos guardas de entorno
    que `test_dev_seed.py` (mismo patrón: `create_engine` reemplazado por un centinela que explota
    si el candado no cortó antes).
