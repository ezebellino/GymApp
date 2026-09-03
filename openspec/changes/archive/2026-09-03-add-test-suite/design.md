## Context

El repo no tiene ninguna suite de tests. El `proposal.md` pide el **piso mínimo ejecutable**:
smoke de auth + matriz de roles en backend (pytest) y un test de render por vista con spec en
frontend (Vitest), más `make test*` y actualización de la doc de agentes. El proposal delega
explícitamente a este documento todas las decisiones técnicas.

El QUÉ está fijado en `specs/automated-test-suite/spec.md` (comandos, endpoints, roles, elementos
que cada render debe encontrar y aislamiento de datos). Este documento resuelve el CÓMO y, cuando
la spec deja libre un detalle de ejecución (qué status code exacto, con qué barra final, en qué
orden), lo fija contra el comportamiento real de la API verificado en el repo.

Estado real del repo verificado para diseñar (no asunciones):

**Backend**
- `app/main.py` arma la app FastAPI a nivel de módulo (sin factory) y registra 8 routers.
  `setup_logging()` corre en import y crea/escribe `backend/logs/` (ya gitignorado).
- **Todos los endpoints son `def` sync** con `Session` de SQLAlchemy 2.0 vía `Depends(get_db)`.
  No hay nada async salvo el middleware y el exception handler.
- `app/deps.py::get_db` es el **único** consumidor de `SessionLocal`/`engine` en todo `app/`
  (verificado por grep): es el único seam de base de datos que hay que interceptar.
- `app/config.py` instancia `Settings()` **en import** y exige `DATABASE_URL` y `SECRET_KEY`.
  Lee `backend/.env` vía `pydantic-settings`; las variables de entorno del proceso tienen
  prioridad sobre ese archivo.
- `app/database.py` crea el engine **en import** con `pool_size=2, max_overflow=0`
  (relevante para la decisión 1). `create_engine` es lazy: importar no conecta.
- Roles reales del enum (`models.UserRole`): `owner`, `coach`, `user` — no "Dueño/Coach/Cliente",
  que son solo los nombres de producto.
- Modelos: solo `String`, `Integer`, `Float`, `Boolean`, `DateTime`, `Enum` genérico, FKs,
  `UniqueConstraint` e `Index`. **Cero tipos nativos de Postgres** (sin UUID, JSONB, ARRAY).
- Migraciones Alembic (`backend/migrations/`) sí son Postgres-only: hay
  `op.execute("ALTER TYPE userrole ADD VALUE ...")` y `alter_column`.
- Endpoints con `date_trunc` (Postgres-only) en `routers/reports.py`, `routers/payments.py` y
  `schemas.py`: no corren en SQLite.
- `requirements.txt` está guardado en **UTF-16 LE con CRLF** (rareza preexistente, no la toca
  este change).

**Frontend**
- No es "React + TS" puro: `App.jsx` y `main.jsx` son JSX, `vite.config.js` es JS, y
  **`typescript` no está en `devDependencies`** (el build es `vite build`, sin `tsc`). El alias
  `@ -> ./src` está en `vite.config.js`.
- ESLint solo lintea `**/*.{js,jsx}`: los tests `.tsx` no pasan por ESLint.
- Las 4 vistas con spec (`Login`, `RegisterClient`, `Dashboard`, `Settings`) importan **el mismo
  singleton axios** `@/lib/http` directo (no pasan por `src/services/`, contra lo que dice
  `frontend/AGENTS.md`). Ese import es el único seam HTTP.
- `App.jsx` **no** monta `AuthProvider`: `src/auth/AuthContext.tsx` existe pero está sin usar;
  `components/ProtectedRoute.tsx` lee `localStorage` directo. Para renderizar las vistas alcanza
  con un Router; no hace falta react-query (no está instalado) ni theme provider.
- `Login`, `RegisterClient` y `Dashboard` usan `useNavigate` (requieren Router). `Settings` no
  usa router.
- `Dashboard` y `Settings` disparan `api.get` en `useEffect` de montaje y leen `user_role` /
  `app_settings` de `localStorage`. `Dashboard` monta `Drawer` (vaul) y `SpotlightSearch` (cmdk).

**Spike ejecutado** (no es teoría): con `DATABASE_URL` apuntando a un SQLite de archivo y
`SECRET_KEY` de test, `Base.metadata.create_all` + `TestClient` levantan la app real y devuelven
la matriz completa de roles. Resultados observados y sus implicancias están en las decisiones.

## Goals / Non-Goals

**Goals:**
- Fijar la infraestructura de test mínima para que `make test` corra verde en una máquina limpia
  y en CI, sin Docker, sin Postgres y sin datos preexistentes.
- Que los tests de backend ejerciten la app **real** (routers, dependencias, middleware, JWT,
  hashing), no dobles de la lógica de auth.
- Que los tests de frontend rendericen los componentes **reales** de página con un único helper
  de providers y sin tocar la red.
- Que las dependencias de test **no** entren en la imagen de producción (Docker/Railway).
- Dejar la doc de agentes consistente con la realidad, sin generar drift en `.claude/` ni
  `.codex/`.

**Non-Goals:**
- Cobertura, métricas de cobertura o `pytest-cov`.
- E2E/Playwright, tests de los endpoints con `date_trunc` (reportes/KPIs) y tests de interacción
  (submit de formularios, toasts) más allá del render.
- Refactorizar `app/database.py`, `app/config.py`, `vite.config.js` o mover las llamadas HTTP de
  las páginas a `src/services/`. El diseño se adapta al código tal como está.
- Armar el workflow de CI (issue #21). Este change solo deja el punto de entrada listo.

## Decisions

### 1. Base de datos de test: SQLite de archivo temporal + `create_all`

**Decisión:** SQLite en un archivo dentro de un directorio temporal de pytest, esquema creado con
`Base.metadata.create_all()`, y `DATABASE_URL` **sobreescrita por variable de entorno desde
`conftest.py` antes de importar `app`**, apuntando a ese mismo archivo. Además se overridea
`app.dependency_overrides[get_db]` con una sesión ligada al engine de test.

Por qué es viable: los modelos no usan ningún tipo nativo de Postgres. Se verificó que
`Base.metadata.create_all()` sobre SQLite crea las 9 tablas sin warnings ni
`CircularDependencyError` (hay un ciclo `users.client_id ↔ clients.created_by_user_id` que
SQLAlchemy resuelve solo porque SQLite no aplica las FKs por defecto).

**Por qué archivo y no `:memory:`:** `app/database.py` llama a `create_engine(..., pool_size=2,
max_overflow=0)`. Con `sqlite:///:memory:` SQLAlchemy elige `SingletonThreadPool`, que **rechaza
`max_overflow`** y hace fallar el import de `app.database` con `TypeError` (comprobado). Con un
SQLite de archivo elige `QueuePool` y esos kwargs son válidos. Un archivo además evita el combo
`StaticPool` + `check_same_thread=False` que haría falta para que el threadpool de `TestClient`
vea los datos.

**Por qué `create_all` y no `alembic upgrade head`:** las migraciones son Postgres-only
(`ALTER TYPE userrole ADD VALUE`, `alter_column` sin batch mode): no corren en SQLite. `create_all`
usa `models.py` como fuente de verdad, que es lo que los endpoints realmente consultan.

**Por qué se pisa `DATABASE_URL` además del override de `get_db`:** es la red de seguridad. El
`.env` real del dev apunta a Supabase de producción; si un test olvidara el override, el engine
del módulo apuntaría a prod. Pisando la variable antes del import, `app.database.engine` **no
puede** ser Postgres durante los tests. El override de `get_db` queda igual porque es el seam
explícito y documentado, y permite a los fixtures sembrar datos por la misma sesión.

**Aislamiento entre tests:** fixture de función que hace `drop_all` + `create_all` (barato en
SQLite a esta escala) y limpia `app.dependency_overrides` al final. Alternativa más rápida
(transacción anidada con rollback por test) se descarta por complejidad: varios endpoints hacen
`commit()` propio y el patrón de savepoints agrega ruido que no paga a esta escala.

**Alternativas consideradas:**
- *Postgres del `docker-compose`*: fidelidad total (enums nativos, `date_trunc`, FKs reales),
  pero obliga a tener Docker corriendo para `make test`, agrega arranque de contenedor + espera
  de healthcheck, y en CI exige un service container. Contradice "sin depender de un entorno
  productivo ni de datos preexistentes" en el sentido práctico de "corre en cualquier máquina".
  Se descarta **para el piso**, y se deja como camino natural el día que haya que testear
  reportes.
- *SQLite en memoria con `StaticPool`*: más rápido, pero rompe el import de `app.database` como
  se explicó; obligaría a tocar `app/` (fuera de alcance).

**Trade-off aceptado:** los tests no cubren nada que dependa de SQL específico de Postgres
(`date_trunc` en reportes/KPIs) ni el comportamiento de FKs/`ondelete`. Los endpoints elegidos
para la matriz de roles se seleccionan para esquivar eso (ver decisión 8).

### 2. Cliente HTTP: `TestClient` de Starlette, sin `pytest-asyncio`

**Decisión:** `fastapi.testclient.TestClient` (envoltorio de `httpx` con transporte ASGI), tests
sincrónicos, **sin** `pytest-asyncio` y sin `asyncio_mode`.

**Rationale:** el 100% de los endpoints son `def` sync. `httpx.AsyncClient` + `ASGITransport`
obligaría a marcar cada test como `async`, sumar `pytest-asyncio` y configurar `asyncio_mode =
auto` para cero beneficio: las mismas requests, el mismo event loop, más dependencias y más
superficie de configuración. `TestClient` además ejecuta lifespan/middleware igual que uvicorn, y
`httpx` **ya está en `requirements.txt`** (no suma dependencia nueva).

**Alternativa considerada:** `httpx.AsyncClient(transport=ASGITransport(app=app))` — es la opción
correcta si algún día aparecen endpoints `async def` con IO real o hay que testear concurrencia.
Migrar después es mecánico. **Trade-off:** hoy no se puede testear código async; no hay ninguno.

### 3. Dependencias de test del backend: `requirements-dev.txt` nuevo

**Decisión:** crear `backend/requirements-dev.txt` en UTF-8 que arranque con `-r requirements.txt`
y agregue solo **`pytest`**. `make setup-backend` pasa a instalar `requirements-dev.txt`;
`Dockerfile` y Railway (Nixpacks) siguen instalando únicamente `requirements.txt`.

**Rationale:** meter pytest en `requirements.txt` lo mete en la imagen de producción y en el
deploy de Railway, que no lo necesita: más superficie, build más lento y ruido en el árbol de
dependencias del runtime. Ni el `Dockerfile` (`COPY requirements.txt` explícito) ni Nixpacks
(instala `requirements.txt`) van a levantar el archivo dev, así que la separación es efectiva sin
tocar ninguno de los dos.

Se agrega **una sola** dependencia: `httpx` ya está y `TestClient` no necesita nada más.
Explícitamente **no** se agregan `pytest-cov` (no hay goal de cobertura), `pytest-asyncio`
(decisión 2), `pytest-env` (decisión 4) ni `factory-boy`/`faker` (`Faker` ya está en
`requirements.txt` y los fixtures son 4 usuarios: no justifica una capa de factories).

**Alternativa considerada:** todo en `requirements.txt` — un archivo menos, pero contamina prod.
**Alternativa considerada:** `pyproject.toml` con extras `[dev]` — ver decisión 4, se descarta por
el mismo motivo (riesgo con Nixpacks).

**Gotcha a verificar en apply:** `requirements.txt` está en UTF-16 LE con BOM. `pip` lo
autodetecta por BOM, así que `-r requirements.txt` debería funcionar; hay que **confirmarlo
corriendo `make setup-backend` en limpio**. Si fallara, el plan B es no usar `-r` y que
`requirements-dev.txt` liste solo pytest, con `setup-backend` instalando los dos archivos.
Reencodear `requirements.txt` a UTF-8 queda fuera de alcance de este change.

### 4. Config de pytest: `backend/pytest.ini`

**Decisión:** `backend/pytest.ini` con `testpaths = tests`, `pythonpath = .` y
`filterwarnings` mínimos si hiciera falta. Los tests viven en `backend/tests/` **sin
`__init__.py`**. Se invoca como `cd backend && ../backend/.venv/bin/python -m pytest`.

**Por qué `pytest.ini` y no `pyproject.toml`:** `backend/` hoy **no tiene** `pyproject.toml`.
Crear uno solo para hospedar `[tool.pytest.ini_options]` cambia cómo detectan el proyecto los
builders: Nixpacks (el builder que usa `backend/railway.json`) trata la presencia de
`pyproject.toml` como señal de proyecto empaquetable/poetry/uv y puede alterar el build de
producción. Riesgo real, beneficio nulo. `setup.cfg` se descarta por el mismo motivo (semántica
de packaging) y por ser el formato más obsoleto de los tres.

**Import de `app` desde `backend/tests/`:** `pythonpath = .` (opción nativa de pytest ≥7, sin
plugins) agrega el rootdir al `sys.path`, así que `from app.main import app` funciona sin importar
desde dónde se invoque. Correr con `python -m pytest` desde `backend/` da el mismo resultado por
otra vía; se hacen las dos cosas por robustez.

**Variables de entorno sin pisar el `.env` del dev:** se setean en `backend/tests/conftest.py`, a
nivel de módulo y **antes de cualquier `import app.*`**, con asignación directa a `os.environ`
(no `setdefault`, para que una variable exportada en la shell no gane):
- `DATABASE_URL` → el SQLite temporal (decisión 1).
- `SECRET_KEY` → valor fijo de test.

En `pydantic-settings` las variables de entorno tienen prioridad sobre el `env_file`, así que el
`backend/.env` real queda intacto en disco y sin efecto sobre los tests. Se descarta `pytest-env`
(dependencia extra para lo mismo) y un `.env.test` (habría que modificar `ENV_PATH` en
`app/config.py`, que es código de app).

**Trampa verificada — no setear `CORS_ORIGINS`:** `Settings.CORS_ORIGINS` es `list[str]` y
`pydantic-settings` intenta parsear JSON en la fuente de entorno **antes** de que corra el
`field_validator(mode="before")` que soporta el formato coma-separado. Exportar
`CORS_ORIGINS=http://testserver` hace fallar el import con `SettingsError` (reproducido en el
spike). El conftest debe **no** setear esa variable y dejar el default de la clase. Es un bug
preexistente de config, no lo arregla este change: queda anotado en Open Questions.

**Efecto colateral aceptado:** importar `app.main` ejecuta `setup_logging()` y escribe en
`backend/logs/`. Ya está gitignorado; no se hace nada al respecto.

### 5. Frontend: `vitest.config.js` separado con `mergeConfig`, jsdom, y mock del módulo `@/lib/http`

**5a. Ubicación de la config.** `frontend/vitest.config.js` nuevo, que importa `vite.config.js` y
lo combina con `mergeConfig` de Vite, agregando solo el bloque `test`.

- *Por qué separado:* `vite.config.js` es la config de build de producción (Vercel); dejarla
  intacta evita cualquier riesgo sobre el deploy y mantiene el ruido de test fuera del build.
- *Por qué `mergeConfig` y no un config independiente:* si existe `vitest.config.*`, Vitest
  **ignora** `vite.config.*` por completo; sin merge se perdería el alias `@` y el plugin de
  React, y habría que duplicarlos (dos fuentes de verdad para el alias, que es exactamente el
  bug que se paga caro después).
- *Alternativa considerada:* agregar la clave `test` dentro de `vite.config.js` (un archivo menos,
  patrón muy común). Se descarta por no tocar la config de build; además `defineConfig` de `vite`
  no tipa `test` y el proyecto no tiene `typescript` instalado para el truco de la triple-slash
  reference. **Trade-off:** un archivo más y la obligación de acordarse del `mergeConfig`.

**5b. Bloque `test`.** `environment: "jsdom"`, `globals: false`, `setupFiles:
["./src/test/setup.ts"]`, `include: ["src/**/*.test.{ts,tsx}"]`, `css: false`.

- `globals: false` + imports explícitos (`import { describe, it, expect, vi } from "vitest"`)
  evita tener que declarar `types: ["vitest/globals"]` en `tsconfig.json` (que hoy solo hace
  `include: ["src"]`) y evita ambigüedad con ESLint. Como ESLint solo lintea `.js/.jsx`, los
  tests `.tsx` no se lintean: un motivo más para ser explícito.
- No hace falta instalar `typescript`: Vitest transpila `.ts/.tsx` con esbuild vía Vite y **no
  hace type-check**. Los tests van en `.tsx` igual que las páginas que prueban.

**5c. Dependencias (devDependencies).** `vitest`, `jsdom`, `@testing-library/react`,
`@testing-library/dom` (peer explícito de RTL v16) y `@testing-library/jest-dom`. No se agrega
`@testing-library/user-event` en el piso: los tests son de render, no de interacción; se suma
cuando aparezca el primer test de flujo.

**Versiones:** no se fijan a ojo en este diseño. El proyecto usa Vite 7 y React 19, que acotan qué
versión de Vitest y de RTL sirven. En apply se instala con `npm install -D` (que resuelve), se
verifica que no queden warnings de peer deps y se commitea el `package-lock.json`. Fijar acá un
número que no exista o que choque con Vite 7 sería peor que dejarlo explícito como paso.

**5d. `setupFiles`.** `frontend/src/test/setup.ts` hace:
1. `import "@testing-library/jest-dom/vitest"` — registra los matchers y su tipado sin depender de
   `globals: true`.
2. Polyfills de jsdom: `window.matchMedia` y `ResizeObserver`. jsdom no los implementa y
   `Dashboard` monta `Drawer` (vaul) y `SpotlightSearch` (cmdk/Radix), que los usan. Sin esto el
   test de Dashboard falla por una razón que no tiene nada que ver con la vista.
3. `afterEach`: `cleanup()` de RTL, `localStorage.clear()` y `vi.clearAllMocks()`. `localStorage`
   es estado compartido real entre tests: `ProtectedRoute`, `Dashboard` y `Settings` leen
   `user_role`/`app_settings`/`access_token` de ahí.

**5e. Aislamiento de HTTP: `vi.mock("@/lib/http")`.** Todas las vistas importan el mismo singleton
axios `@/lib/http` (default export). Hay exactamente **un** seam, y se stubea a nivel de módulo
con un helper compartido en `frontend/src/test/apiMock.ts` que expone `get/post/put/delete` como
`vi.fn()` y resuelve por ruta (arrays vacíos para `/clients`, `/payments`, `/attendance`; objeto
para `/settings`), para que los `useEffect` de montaje de `Dashboard` y `Settings` no revienten al
hacer `.map` sobre `undefined`.

- *Por qué no MSW:* MSW es la opción correcta cuando hay muchos tests de flujo y querés fidelidad
  de red (status codes, headers, errores). Acá son 4 tests de render: MSW suma una dependencia
  grande, un server de handlers que mantener y una capa de interceptores XHR sobre jsdom, para
  verificar lo mismo. Queda registrado como **el upgrade natural** el día que se testeen flujos
  (login exitoso, submit de settings) donde el status code y el shape de la respuesta importen.
- *Por qué no `vi.spyOn(api, "get")`:* funciona, pero deja pasar cualquier llamada que el test no
  haya previsto hacia XHR real de jsdom, que falla ruidosamente y, peor, dispara los
  interceptores de `lib/http` (el 401 hace `window.location.href = "/login"`) y SweetAlert2. El
  `vi.mock` del módulo cierra la puerta entera.
- **Trade-off:** los tests quedan acoplados a la forma de la API de axios (`api.get(url,
  config)`); si mañana las páginas pasan por `src/services/` (como pide `frontend/AGENTS.md`), hay
  que mover el mock un nivel. Es un cambio chico y localizado en un solo helper.

**5f. Helper de render.** `frontend/src/test/renderWithProviders.tsx` que envuelve en
`MemoryRouter` con `initialEntries` configurable y expone las utilidades de RTL. Se verificó que
**no hace falta** `AuthProvider` (`App.jsx` no lo monta), ni react-query (no está instalado), ni
theme provider (el tema se aplica por `document.documentElement.dataset`), ni el `Toaster` de
sileo (los toasts se disparan en submit, no en render). Se envuelven las 4 vistas por
uniformidad, aunque `Settings` no use router.

**5f-bis. Los asserts tienen que ser asíncronos.** No es cosmético: `Settings.tsx` devuelve
temprano el placeholder **"Cargando configuracion..."** mientras `loading === true`, y solo
renderiza los formularios cuando resuelve el `GET /settings`. Un `getByText("Vista previa del
negocio")` sincrónico falla siempre. Regla para las 4 vistas: usar `findBy*` / `waitFor` para lo
que llega después del efecto de montaje, y reservar `getBy*`/`queryBy*` para lo estático
(`Login` y `RegisterClient` sí son sincrónicas: no hacen fetch en montaje). Los asserts negativos
que pide la spec (`queryBy... toBeNull`) deben hacerse **después** de haber esperado el render
final, o pasan en verde por accidente mientras la vista todavía muestra el loader.

**5g. Ubicación de los tests.** Colocados en `src/**/__tests__/<Vista>.test.tsx` (p. ej.
`src/pages/__tests__/Login.test.tsx`), helpers en `src/test/`. Quedan dentro de `include: ["src"]`
del `tsconfig.json` y cerca del código que prueban. Alternativa `frontend/tests/` en la raíz: se
descarta porque quedaría fuera del `include` del tsconfig y del alias mental del proyecto.

**5h. Scripts en `package.json`.** `"test": "vitest run"` (un solo pase, exit code para CI) y
`"test:watch": "vitest"` para desarrollo.

### 6. Makefile: dos targets granulares + un agregador que no corta al primer fallo

**Decisión:**

```make
test-backend: ## Corre los tests del backend (pytest)
	cd backend && ../$(PYTHON) -m pytest

test-frontend: ## Corre los tests del frontend (vitest)
	cd frontend && npm run test

test: ## Corre backend + frontend y reporta el estado combinado
	@fail=0; \
	$(MAKE) test-backend || fail=1; \
	$(MAKE) test-frontend || fail=1; \
	exit $$fail
```

- Se respeta el patrón ya existente del Makefile: `cd <app> && ../$(PYTHON) -m ...` para Python
  (como `migrate` y `backend`) y `cd frontend && npm run ...` para Node. Sin comandos nuevos
  inventados fuera del Makefile.
- Hay que agregar `test test-backend test-frontend` a `.PHONY` y mantener el comentario `##` para
  que aparezcan en `make help`.
- **`test` corre las dos suites aunque la primera falle.** El consumidor principal es el rol QA en
  `/opsx:verify` y, más adelante, CI: ambos quieren el cuadro completo en una corrida, no
  descubrir el fallo de frontend recién después de arreglar el de backend.
  *Alternativa considerada:* `test: test-backend test-frontend` (dependencias de make, corta al
  primer fallo). Más corto y con fail-fast, pero esconde la mitad del resultado.
  **Trade-off:** 5 líneas de shell en el Makefile y una corrida más lenta cuando ya sabés que algo
  está roto; mitigado porque los targets granulares existen para iterar.
- `make setup-backend` pasa a instalar `backend/requirements-dev.txt` (decisión 3). `make test`
  asume que `make setup` ya corrió; no auto-instala nada (los targets de setup ya son explícitos
  en este Makefile y mezclarlos haría `test` lento e impredecible).

### 7. Docs de agentes: qué se edita dónde (verificado, no asumido)

Se comprobó el estado real de cada archivo antes de decidir:

| Archivo | Qué es | Cómo se edita |
|---|---|---|
| `AGENTS.md` (raíz) | archivo real versionado | se edita en su lugar |
| `backend/AGENTS.md` | archivo real versionado | se edita en su lugar |
| `frontend/AGENTS.md` | archivo real versionado | se edita en su lugar |
| `.agents/skills/role-qa/SKILL.md` | archivo real, **canónico** del rol | se edita ahí |
| `.claude/skills` | **symlink** a `../.agents/skills` | nunca se toca |
| `.claude/agents/qa.md`, `.codex/agents/qa.toml` | **generados** por `.agents/bin/sync.py` | nunca se tocan |

Punto fino que conviene fijar para no perder tiempo en apply: los wrappers generados de rol
**solo contienen frontmatter (name/description/tools/model) + un puntero al SKILL**; no copian el
cuerpo. Por lo tanto **cambiar el cuerpo de `role-qa/SKILL.md` no genera drift** y no requiere
`make agents-sync`. Solo haría falta sincronizar si se tocara `.agents/registry.json` (que este
change **no** toca). Igual la task de cierre debe correr `make agents-check` y verlo en `OK`
(baseline actual verificado: está en sync).

Contenido a corregir (el proposal ya define el alcance; acá solo se fija dónde vive cada cosa):
- `AGENTS.md` raíz → la bala "No asumas test suite" pasa a describir `make test` /
  `make test-backend` / `make test-frontend` y dónde viven las suites.
- `backend/AGENTS.md` → sección "Tests" con pytest, `backend/tests/`, `requirements-dev.txt` y la
  aclaración de que la DB de test es SQLite (por eso no se testean los endpoints con `date_trunc`).
  Nota aparte: ese archivo hoy dice que los roles son "Dueño y Coach"; el enum real tiene tres
  (`owner`/`coach`/`user`). Corregirlo es una mejora obvia pero **no está en el alcance del
  proposal**: se anota en Open Questions.
- `frontend/AGENTS.md` → sección "Tests" con Vitest + Testing Library, el helper de render, la
  estrategia de mock de `@/lib/http` y dónde viven los tests.
- `.agents/skills/role-qa/SKILL.md` → "Estado actual del repo" pasa a decir qué cubre la suite
  (auth + matriz de roles + render de las 4 vistas), cómo correrla (`make test`) y **qué sigue sin
  cubrir** (flujos de UI, reportes/KPIs, E2E), para que QA no infiera cobertura que no existe. La
  regla de "lint y build no son verificación" se mantiene.

### 8. Alcance concreto de los tests de backend (derivado de las decisiones anteriores)

Esto no agrega requirements: acota qué endpoints se usan para cumplir los de la spec
`automated-test-suite` sin chocar con SQLite. Matriz verificada end-to-end en el spike:

| Endpoint | Dependencia de rol | owner | coach | user |
|---|---|---|---|---|
| `GET /coaches` | `require_owner` | 200 | 403 | 403 |
| `GET /clients/` | `require_role(owner, coach)` (a nivel router) | 200 | 200 | 403 |
| `GET /routines/my/client` | `require_role(user)` | 403 | 403 | 200 |
| `GET /auth/me` | solo autenticado | 200 | 200 | 200 |

Los tres endpoints elegidos no usan `date_trunc` (por eso se descartan `/reports/*` y
`/payments/reports/kpis`) y `GET /clients/` solo usa `ilike` cuando hay `q`, que SQLite soporta.
La spec escribe el endpoint como `GET /clients`, pero la ruta real es `@router.get("/")` sobre el
prefijo `/clients`: sin barra final FastAPI responde 307 y el test depende de que el cliente siga
redirecciones. Los tests deben pedir **`/clients/`** explícito y no apoyarse en el redirect.

Smoke de auth: `POST /auth/client-register` → `POST /auth/token` → `GET /auth/me`, más los dos
casos de rechazo sin credenciales válidas. Hechos observados en el spike que los asserts tienen
que respetar tal como la API es hoy (la spec dice "error de credenciales" sin fijar el número, y
el número real es este):
- credenciales inválidas en `POST /auth/token` devuelven **400**, no 401 (`routers/auth.py`);
- `GET /auth/me` sin header `Authorization` devuelve **401** (`strict_oauth2` con
  `auto_error=True`);
- `GET /auth/me` con un token arbitrario/manipulado devuelve **401** por el `except JWTError` de
  `auth.get_current_user`. Ojo: `RequestLogMiddleware` también decodifica el token y loguea el
  fallo en DEBUG; es ruido esperado, no un error del test.

Fixtures: usuarios `owner` y `coach` se crean insertando `models.User` con `hash_password`; el
usuario `user` se crea por el endpoint real de registro (que es además el que linkea `client_id`,
necesario para que `/routines/my/client` dé 200).

## Risks / Trade-offs

- **La suite no valida SQL específico de Postgres** → los endpoints con `date_trunc` quedan sin
  cubrir y un bug ahí no lo agarra nadie. *Mitigación:* está documentado en `backend/AGENTS.md` y
  en el SKILL de QA como límite explícito; el camino de upgrade (Postgres del `docker-compose`
  como fixture de sesión) queda descrito en la decisión 1.
- **Divergencia esquema-migraciones**: `create_all` usa `models.py`, no las migraciones. Si una
  migración quedó desalineada con el modelo, los tests pasan y producción rompe. *Mitigación:* es
  el riesgo que ya existe hoy sin tests; la regla del repo (todo cambio de `models.py` lleva
  migración) sigue siendo el control. No se agrega un test de drift en este change.
- **`create_engine` con `pool_size`/`max_overflow` fijos en `app/database.py`** ata el diseño a
  SQLite de archivo. *Mitigación:* documentado acá; si alguien "limpia" esos kwargs o cambia el
  engine, el conftest deja de importar y el fallo es inmediato y evidente.
- **`CORS_ORIGINS` en el entorno rompe el import de `Settings`** → si CI exporta esa variable en
  formato coma-separado, la suite entera falla en collection con un `SettingsError` opaco.
  *Mitigación:* dejarlo escrito en `backend/AGENTS.md` y no setearlo en el conftest; en CI usar
  formato JSON o no setearlo.
- **bcrypt es lento a propósito** (~0.28 s por hash, medido). Con usuarios creados por test la
  suite se degrada rápido. *Mitigación:* fixtures de usuarios con scope de módulo/sesión donde se
  pueda, y no crear usuarios que el test no use. No se toca el `CryptContext` de `app/auth.py`
  (es código de app).
- **Versiones de Vitest/RTL vs. Vite 7 + React 19**: es la parte más frágil del plan; una
  combinación mal elegida da errores de peer deps o de transformación. *Mitigación:* instalar
  resolviendo con npm en apply, no fijar versiones desde el diseño, y verificar que
  `npm run test` corre antes de escribir los tests reales.
- **Polyfills de jsdom (`matchMedia`, `ResizeObserver`)**: si vaul/cmdk/Radix suman otro API del
  browser, el test de `Dashboard` falla por infraestructura y no por la vista. *Mitigación:* los
  polyfills viven centralizados en `src/test/setup.ts`; sumar uno es una línea.
- **Los tests de render son un piso muy bajo**: verifican que la vista monta y muestra sus
  elementos clave, no que los escenarios WHEN/THEN de las specs se cumplan. *Mitigación:* está
  asumido en el proposal ("el piso, no el techo") y se explicita en el SKILL de QA para no inducir
  falsa cobertura.
- **`tests/` entra en la imagen Docker** porque el `Dockerfile` hace `COPY . .` y
  `backend/.dockerignore` no los excluye. Impacto real: unos KB, sin pytest instalado, sin efecto
  en runtime. *Mitigación opcional:* agregar `tests/` al `.dockerignore` del backend. No es
  bloqueante.

## Migration Plan

No hay migración de datos ni cambio de contrato: el change es aditivo y no toca `backend/app/` ni
`frontend/src/`. Orden de despliegue del cambio en sí:

1. Backend primero, completo y verde (`requirements-dev.txt` → `pytest.ini` → `tests/conftest.py`
   → tests). El conftest es la pieza de riesgo: conviene validarlo con un test trivial
   (`GET /health` → 200) antes de escribir la matriz de roles.
2. Frontend después (deps → `vitest.config.js` → `src/test/*` → un test de render, y recién
   ahí los otros tres).
3. Makefile cuando las dos suites corren a mano.
4. Docs de agentes al final, cuando los comandos documentados ya son verdad.

**Rollback:** revertir el commit. No queda estado persistente; el SQLite de test vive en un
directorio temporal y `*.db` ya está en `.gitignore`. Lo único con efecto fuera de los tests es
que `make setup-backend` instala pytest en el venv local (inofensivo) — producción no cambia
porque ni el `Dockerfile` ni Nixpacks leen `requirements-dev.txt`.

## Open Questions

- **Hueco para el Product Owner (menor, no bloqueante):** dos escenarios de
  `automated-test-suite` describen *meta-comportamiento* de la suite y no se pueden verificar
  ejecutándola tal cual queda: "Vista que rompe al renderizar" y "Elemento prometido por la spec
  que desaparece" exigen romper la vista a propósito, y "No toca datos reales" exige una máquina
  apuntando a una DB con datos. Se cumplen por construcción con las decisiones 1 y 5 (SQLite
  temporal + `DATABASE_URL` pisada antes del import; asserts sobre elementos concretos), pero QA
  necesita saber si los verifica con una mutación manual temporal o los marca como
  "verificado por diseño". Lo decide el PO/QA en `/opsx:verify`, no lo puede resolver el
  arquitecto.
- **Detalle a confirmar en apply, no un hueco de spec:** la spec pide que el test de dashboard
  encuentre "Clientes activos", "Rutina base" y "Check-ins de hoy". Están en `Dashboard.tsx`
  (líneas 502/508/514) como labels de KPI derivados de estado, así que aparecen aun con el mock
  devolviendo listas vacías — pero solo después de que resuelvan los efectos de montaje
  (ver 5f-bis).
- **Fuera de alcance, para un change futuro:** `Settings.CORS_ORIGINS` no acepta el formato
  coma-separado desde variables de entorno (el `field_validator` corre después del parseo JSON de
  `pydantic-settings`), lo que hace que el propio `backend/.env.example` sea inaplicable como
  variable de entorno. Es un bug de config preexistente.
- **Fuera de alcance:** `backend/AGENTS.md` describe los roles como "Dueño y Coach" cuando el enum
  tiene tres (`owner`/`coach`/`user`), y `frontend/AGENTS.md` afirma que las llamadas a la API van
  en `src/services/` cuando las 4 vistas con spec usan `@/lib/http` directo. Corregir esas dos
  afirmaciones excede lo que pide el proposal; queda anotado.
- **A decidir en CI (issue #21), no acá:** si CI corre `make test` (agregado) o los dos targets
  como jobs separados en paralelo.
