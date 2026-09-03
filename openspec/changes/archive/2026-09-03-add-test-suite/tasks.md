## 1. Reglas del change (leer antes de tocar nada)

- [x] 1.1 Leer `design.md` completo y `specs/automated-test-suite/spec.md`. El design ya resolvió
      el CÓMO con un spike ejecutado contra la app real: no rehacer la investigación, seguir las
      decisiones 1 a 8.
- [x] 1.2 Confirmar el alcance negativo antes de empezar: **NO** se escribe E2E/Playwright, **NO**
      se agrega `pytest-cov`/`pytest-asyncio`/`pytest-env`/MSW/`user-event`, **NO** se testean los
      endpoints de reportes/KPIs (usan `date_trunc`, Postgres-only), **NO** se persigue cobertura.
- [x] 1.3 Confirmar que este change **no modifica** `backend/app/**` ni `frontend/src/**` salvo los
      archivos nuevos de test bajo `frontend/src/test/` y `frontend/src/**/__tests__/`. Si aparece
      la necesidad de tocar código de aplicación (por ejemplo `app/database.py` o
      `app/config.py`), **parar**: no hacerlo por las tuyas, abrirlo como task nueva justificada en
      este archivo y confirmarla con el usuario. El diseño está hecho justamente para no tener que
      tocarlos.
- [x] 1.4 Verificar el baseline antes de cambiar nada: `make agents-check` responde
      `OK: .claude/ y .codex/ estan en sync con .agents/`. Si ya hay drift, resolverlo o reportarlo
      antes de seguir (así el drift del final es atribuible a este change).

## 2. Backend — dependencias y configuración de pytest

- [x] 2.1 Crear `backend/requirements-dev.txt` **en UTF-8**, con `-r requirements.txt` en la
      primera línea y `pytest` como única dependencia agregada. No agregar nada más: `httpx` ya
      está en `requirements.txt` y es todo lo que necesita `TestClient`.
- [x] 2.2 Verificar el gotcha de encoding: `backend/requirements.txt` está guardado en **UTF-16 LE
      con BOM y CRLF**. Correr `backend/.venv/bin/pip install -r backend/requirements-dev.txt` y
      confirmar que pip resuelve el `-r`. **Plan B si falla**: sacar el `-r`, dejar
      `requirements-dev.txt` solo con `pytest`, y que `setup-backend` instale los dos archivos en
      dos comandos. No reencodear `requirements.txt`: está fuera del alcance de este change.
- [x] 2.3 Editar el target `setup-backend` del `Makefile` de la raíz para que instale
      `backend/requirements-dev.txt` en vez de (o además de, según el resultado de 2.2)
      `backend/requirements.txt`. El `Dockerfile` y `railway.json` **no se tocan**: siguen
      instalando solo `requirements.txt`, que es lo que mantiene pytest fuera de la imagen de
      producción.
- [x] 2.4 Crear `backend/pytest.ini` con `[pytest]`, `testpaths = tests` y `pythonpath = .`. **No**
      crear `backend/pyproject.toml` ni `setup.cfg`: `backend/` hoy no tiene ninguno y su
      aparición puede cambiar cómo Nixpacks detecta el proyecto en el build de Railway.
- [x] 2.5 Crear el directorio `backend/tests/` **sin `__init__.py`** (import mode default de
      pytest).

## 3. Backend — `conftest.py` (la pieza de riesgo)

- [x] 3.1 Crear `backend/tests/conftest.py` y, **a nivel de módulo, antes de cualquier
      `import app.*`**, setear con asignación directa (no `setdefault`, para que una variable
      exportada en la shell no gane):
      `os.environ["DATABASE_URL"]` apuntando al SQLite temporal y `os.environ["SECRET_KEY"]` a un
      valor fijo de test. En pydantic-settings las env vars ganan sobre el `env_file`, así que
      `backend/.env` queda intacto y sin efecto.
- [x] 3.2 **No setear `CORS_ORIGINS`** en el conftest ni en el entorno de la corrida. Es
      `list[str]` y pydantic-settings intenta parsear JSON en la fuente de entorno **antes** de que
      corra el `field_validator(mode="before")` que soporta el formato coma-separado: exportarla
      como `http://testserver` hace fallar el import con `SettingsError` (reproducido). Dejar el
      default de la clase.
- [x] 3.3 Construir la URL de test como **SQLite de archivo** en un directorio temporal
      (`tempfile.mkdtemp()` a nivel de módulo, porque hace falta antes de que existan los
      fixtures). **No usar `sqlite:///:memory:`**: `app/database.py` hace
      `create_engine(..., pool_size=2, max_overflow=0)` y con SQLite en memoria SQLAlchemy elige
      `SingletonThreadPool`, que rechaza `max_overflow` y rompe el import de `app.database` con
      `TypeError`. Con archivo elige `QueuePool` y los kwargs son válidos.
- [x] 3.4 Crear en el conftest el engine y el `sessionmaker` de test contra esa misma URL, y
      overridear `app.dependency_overrides[get_db]` importando `get_db` desde `app.deps` (es el
      mismo objeto que usan todos los routers y `auth.get_current_user`; es el único consumidor de
      `SessionLocal` en todo `app/`).
- [x] 3.5 Fixture de función que hace `Base.metadata.drop_all()` + `create_all()` antes de cada
      test y limpia `app.dependency_overrides` al final. Esto es lo que cumple el escenario "Dos
      corridas seguidas dan el mismo resultado" (nada de "email ya registrado" entre corridas). No
      usar el patrón de transacción anidada con rollback: varios endpoints hacen `commit()` propio.
- [x] 3.6 Fixture `client` que devuelve `fastapi.testclient.TestClient(app)`. Tests **sync**, sin
      `pytest-asyncio` ni `asyncio_mode`: el 100% de los endpoints son `def` sync.
- [x] 3.7 Fixtures de usuarios: `owner` y `coach` insertando `models.User` con
      `app.auth.hash_password` y `role=UserRole.owner` / `UserRole.coach` (valores reales del enum:
      `owner`, `coach`, `user` — no "Dueño/Coach/Cliente", que son los nombres de producto); el
      usuario de rol `user` se crea **por el endpoint real** `POST /auth/client-register`, porque
      es el que linkea `client_id` y sin ese link `/routines/my/client` no da 200. Fixture helper
      que hace `POST /auth/token` y devuelve el header `Authorization`.
- [x] 3.8 Ojo con bcrypt: cada `hash_password` cuesta ~0.28 s (medido). No crear usuarios que el
      test no use y reutilizar fixtures donde se pueda. **No** tocar el `CryptContext` de
      `app/auth.py` para acelerarlo: es código de aplicación.
- [x] 3.9 Escribir un único test trivial `backend/tests/test_health.py` (`GET /health` → 200) y
      correrlo con `cd backend && ../backend/.venv/bin/python -m pytest`. **No seguir hasta que
      pase**: valida de una que el import de `app`, la config y el engine de test funcionan.
      Efecto colateral esperado y aceptado: importar `app.main` ejecuta `setup_logging()` y escribe
      en `backend/logs/` (ya gitignorado).

## 4. Backend — tests de auth y autorización

- [x] 4.1 `backend/tests/test_auth.py`: smoke de registro — `POST /auth/client-register` con
      nombre, email y password válidos responde OK y trae `access_token` + `token_type: "bearer"`.
- [x] 4.2 Mismo archivo: login con credenciales válidas — `POST /auth/token` con **form data**
      (`data={"username": ..., "password": ...}`, no JSON: el endpoint usa
      `OAuth2PasswordRequestForm`) devuelve `access_token` + `token_type: "bearer"`.
- [x] 4.3 Mismo archivo: login con password incorrecta. **Assert 400, no 401** — `routers/auth.py`
      levanta `HTTPException(status_code=400, detail="Incorrect username or password")`. La spec
      dice "error de credenciales" sin fijar el número; el número real es 400. Verificar además que
      la respuesta no trae `access_token`.
- [x] 4.4 Mismo archivo: endpoint protegido con token válido — `GET /auth/me` con el token del
      login responde 200 y el body incluye el `role` del usuario.
- [x] 4.5 `backend/tests/test_auth.py`: `GET /auth/me` **sin** header `Authorization` → 401
      (`strict_oauth2` tiene `auto_error=True`), y el body no expone datos de usuario.
- [x] 4.6 Mismo archivo: `GET /auth/me` con un token arbitrario/manipulado → 401 (lo tira el
      `except JWTError` de `auth.get_current_user`). Ruido esperado en la salida:
      `RequestLogMiddleware` también intenta decodificar el token y loguea el fallo — no es un
      error del test.
- [x] 4.7 `backend/tests/test_roles.py`: rol `user` contra `GET /clients/` → **403**. Usar la
      **barra final explícita**: la ruta real es `@router.get("/")` sobre el prefijo `/clients`, y
      sin barra FastAPI responde 307; no depender de que el cliente siga el redirect.
- [x] 4.8 Mismo archivo: rol `coach` contra `GET /coaches` → 403 (`require_owner`).
- [x] 4.9 Mismo archivo: rol `owner` contra `GET /coaches` → 200. Es el que demuestra que el 403 de
      4.8 es por rol y no porque el endpoint esté roto.
- [x] 4.10 Mismo archivo: rol `coach` contra `GET /clients/` → 200.
- [x] 4.11 Mismo archivo (opcional pero barato, cierra la matriz de los tres roles): `owner` y
      `coach` contra `GET /routines/my/client` → 403, y `user` → 200. Matriz completa verificada en
      el spike: `/coaches` 200/403/403, `/clients/` 200/200/403, `/routines/my/client` 403/403/200.
- [x] 4.12 No escribir tests contra `/reports/*` ni `/payments/reports/kpis`: usan `func.date_trunc`
      y no corren en SQLite.

## 5. Backend — verificación de la fase

- [x] 5.1 `cd backend && ../backend/.venv/bin/python -m pytest -q` pasa en verde con todos los
      tests de las tasks 4.x.
- [x] 5.2 Correrlo **dos veces seguidas** sin limpiar nada y confirmar mismo resultado (escenario
      "Dos corridas seguidas dan el mismo resultado" de la spec).
- [x] 5.3 Confirmar que la DB real quedó intacta: la suite corre con el `backend/.env` del dev
      apuntando a Postgres/Supabase y no crea ni un registro ahí. Chequear que el archivo SQLite
      quedó en el tmp y que no aparecieron `*.db` sueltos en el repo (`git status` limpio salvo los
      archivos nuevos del change).

## 6. Frontend — configuración de Vitest

- [x] 6.1 Instalar como devDependencies en `frontend/`: `vitest`, `jsdom`,
      `@testing-library/react`, `@testing-library/dom` (peer explícito de RTL v16) y
      `@testing-library/jest-dom`. **No fijar versiones a ojo**: instalar con `npm install -D`,
      dejar que npm resuelva contra Vite 7 + React 19, verificar que no queden warnings de peer
      deps y commitear el `package-lock.json`. **No** instalar `typescript` (Vitest transpila
      `.ts/.tsx` con esbuild y no hace type-check) ni `@testing-library/user-event` (los tests son
      de render, no de interacción).
- [x] 6.2 Agregar a `frontend/package.json` los scripts `"test": "vitest run"` (una sola pasada,
      exit code para CI) y `"test:watch": "vitest"`.
- [x] 6.3 Crear `frontend/vitest.config.js` que importe `frontend/vite.config.js` y lo combine con
      **`mergeConfig`** de Vite. Es obligatorio: si existe un `vitest.config.*`, Vitest **ignora el
      `vite.config.*` por completo**, y sin el merge se pierden el alias `@ -> ./src` y el plugin
      de React (y los tests fallan resolviendo `@/lib/http`). **No** meter la clave `test` dentro
      de `vite.config.js`: esa es la config de build de producción (Vercel) y no se toca.
- [x] 6.4 En el bloque `test` de `vitest.config.js`: `environment: "jsdom"`, `globals: false`,
      `setupFiles: ["./src/test/setup.ts"]`, `include: ["src/**/*.test.{ts,tsx}"]`, `css: false`.
      Con `globals: false` los tests importan explícitamente de `vitest`
      (`import { describe, it, expect, vi } from "vitest"`), lo que evita tener que agregar
      `types: ["vitest/globals"]` al `tsconfig.json`.
- [x] 6.5 Crear `frontend/src/test/setup.ts` con: (a) `import "@testing-library/jest-dom/vitest"`
      para registrar matchers y tipos sin depender de `globals: true`; (b) polyfills de
      **`window.matchMedia` y `ResizeObserver`**, que jsdom no implementa y que necesitan el
      `Drawer` (vaul) y el `SpotlightSearch` (cmdk/Radix) que monta `Dashboard` — sin esto el test
      de dashboard falla por infraestructura y no por la vista; (c) `afterEach` con `cleanup()` de
      RTL, `localStorage.clear()` y `vi.clearAllMocks()` (`localStorage` es estado compartido real:
      `ProtectedRoute`, `Dashboard` y `Settings` leen `user_role` / `app_settings` /
      `access_token`).
- [x] 6.6 Crear `frontend/src/test/apiMock.ts`: helper para `vi.mock("@/lib/http")` que devuelva
      `{ default: { get, post, put, delete } }` con `vi.fn()` y **resolución por ruta** — arrays
      vacíos para `/clients`, `/payments`, `/attendance`; objeto para `/settings`. Si devuelve
      `undefined`, los `useEffect` de montaje de `Dashboard` y `Settings` revientan haciendo `.map`.
      Mockear el módulo entero (no `vi.spyOn(api, "get")`): con spy, cualquier llamada no prevista
      se va a XHR real de jsdom y dispara los interceptores de `lib/http` (el 401 hace
      `window.location.href = "/login"`) y SweetAlert2.
- [x] 6.7 Crear `frontend/src/test/renderWithProviders.tsx`: envuelve en `MemoryRouter` con
      `initialEntries` configurable y reexporta las utilidades de RTL. Verificado que **no** hace
      falta `AuthProvider` (`App.jsx` no lo monta; `src/auth/AuthContext.tsx` está sin uso), ni
      react-query (no está instalado), ni theme provider (el tema se aplica por
      `document.documentElement.dataset`), ni el `Toaster` de sileo (los toasts salen en submit, no
      en render).
- [x] 6.8 Escribir primero **un solo** test de render (el de login, que es el más simple y
      sincrónico) y correr `cd frontend && npm run test`. No seguir con los otros tres hasta que
      ese pase: valida config, alias, setup y mock de una.

## 7. Frontend — tests de render de las 4 vistas con spec

- [x] 7.1 `frontend/src/pages/__tests__/Login.test.tsx`: renderiza `/login` y encuentra "Gym App",
      el campo "Usuario", el campo "Contraseña", el botón "Entrar" y el link "Registrar cuenta"; y
      **no** encuentra banner de demo, contador de conexión ni aviso de reactivación de backend.
      `Login` no hace fetch en montaje: acá los `getBy*`/`queryBy*` sincrónicos están bien.
- [x] 7.2 `frontend/src/pages/__tests__/RegisterClient.test.tsx`: renderiza `/register-client` y
      encuentra el header "Gym App", los campos de contraseña y confirmación y el link "Volver al
      login"; y **no** encuentra el eyebrow "Registro de cliente" ni el título "Crear acceso
      personal". Tampoco hace fetch en montaje.
- [x] 7.3 `frontend/src/pages/__tests__/Dashboard.test.tsx`: sembrar `localStorage` con
      `user_role` (`owner` o `coach`) **antes** de renderizar — la vista lo lee en el efecto de
      montaje. Encontrar las KPI "Clientes activos", "Rutina base" y "Check-ins de hoy"
      (`Dashboard.tsx:502/508/514`), y **no** encontrar una sección "Alertas de negocio". Usar
      `findBy*`/`waitFor`: son labels de estado derivado que aparecen recién cuando resuelven los
      efectos de montaje.
- [x] 7.4 `frontend/src/pages/__tests__/Settings.test.tsx`: **obligatoriamente asíncrono**.
      `Settings.tsx:223` hace un return temprano con el placeholder "Cargando configuracion..."
      mientras `loading === true`, y solo renderiza los formularios cuando resuelve el
      `GET /settings` mockeado; un `getByText("Vista previa del negocio")` sincrónico falla
      siempre. Encontrar los formularios de configuración y la card "Vista previa del negocio" con
      su botón "Ver recordatorio en WhatsApp", y **no** encontrar las InfoCard "Identidad y
      contacto", "Cobranza operativa", "Recordatorio mensual" ni la card "Contexto operativo".
- [x] 7.5 Regla transversal para 7.3 y 7.4: los asserts **negativos** (`queryBy... toBeNull`) van
      **después** de haber esperado el render final. Si se hacen mientras la vista todavía muestra
      el loader, pasan en verde por accidente y no verifican nada.

## 8. Frontend — verificación de la fase

- [x] 8.1 `cd frontend && npm run test` pasa en verde con los 4 tests.
- [x] 8.2 Confirmar que no hay warnings de `act(...)` ni promesas sin manejar en la salida (si los
      hay, falta un `waitFor`/`findBy` en 7.3 o 7.4).
- [x] 8.3 Correr la suite **sin backend levantado ni base de datos accesible** y confirmar que da
      el mismo resultado (escenario "Sin backend disponible" de la spec). Es lo que valida que el
      `vi.mock` de `@/lib/http` cierra bien la puerta.

## 9. Makefile — puntos de entrada

- [x] 9.1 Agregar el target `test-backend` con comentario `##` (para que salga en `make help`),
      siguiendo el patrón ya usado por `migrate`/`backend`:
      `cd backend && ../$(PYTHON) -m pytest`.
- [x] 9.2 Agregar el target `test-frontend` con comentario `##`:
      `cd frontend && npm run test`.
- [x] 9.3 Agregar el target `test` con comentario `##` que corre **las dos suites aunque la primera
      falle** y agrega el estado (`fail=0; $(MAKE) test-backend || fail=1; $(MAKE) test-frontend ||
      fail=1; exit $$fail`). El consumidor es el rol QA en `/opsx:verify` y CI: quieren el cuadro
      completo en una corrida, no descubrir el fallo de frontend recién después de arreglar el de
      backend. No usarlo como `test: test-backend test-frontend` (dependencias de make), que corta
      al primer fallo.
- [x] 9.4 Agregar `test test-backend test-frontend` a la lista `.PHONY` de la primera línea del
      `Makefile`.
- [x] 9.5 `make test` **no** instala dependencias: asume que `make setup` ya corrió, igual que el
      resto de los targets del Makefile.

## 10. Verificación por mutación (los escenarios "meta" de la spec)

Estas tasks rompen algo a propósito para demostrar que los tests detectan la rotura, y revierten.
Ninguna deja cambios en el repo: al terminar cada una, `git status` tiene que quedar como antes.

- [x] 10.1 `make test` en verde: la salida muestra el resultado de las dos suites y el exit code es
      0 (`echo $?`).
- [x] 10.2 `make help` lista `test`, `test-backend` y `test-frontend` con su descripción.
- [x] 10.3 `make test-backend` corre **solo** backend y `make test-frontend` corre **solo**
      frontend, sin haber ejecutado antes `make dev`/`make backend`/`make frontend`/`make
      docker-up` (escenario "Los comandos no requieren la app levantada a mano").
- [x] 10.4 **Mutación — un test falla**: romper temporalmente un assert de un test de backend,
      correr `make test`, confirmar que la salida identifica el test y el motivo, que igual corrió
      también la suite de frontend, y que el exit code es distinto de 0. Revertir.
- [x] 10.5 **Mutación — vista que rompe al renderizar**: hacer que una vista cubierta lance un
      error en render (p. ej. un `throw` temporal al inicio del componente), correr
      `make test-frontend`, confirmar que falla identificando la vista afectada. Revertir.
- [x] 10.6 **Mutación — elemento prometido por la spec que desaparece**: borrar temporalmente el
      botón "Entrar" de `Login.tsx`, correr `make test-frontend`, confirmar que falla señalando el
      elemento faltante. Revertir y confirmar con `git diff` que `frontend/src/pages/Login.tsx`
      quedó idéntico.
- [x] 10.7 **Mutación — no toca datos reales**: correr `make test-backend` con el `backend/.env`
      real apuntando a la base de desarrollo/producción con datos cargados, confirmar que la suite
      pasa igual y que después no aparecieron usuarios, clientes ni pagos nuevos en esa base
      (contar filas antes y después). Es lo que valida que pisar `DATABASE_URL` en el conftest
      antes del import funciona como red de seguridad.
- [x] 10.8 **Sin datos previos**: borrar el directorio temporal de tests si quedó algo, y correr
      `make test-backend` como si fuera una máquina limpia: pasa sin ningún paso manual de carga de
      datos.

## 11. Documentación de agentes

- [x] 11.1 `AGENTS.md` de la raíz (archivo real versionado, se edita en su lugar): reemplazar la
      bala "No asumas test suite" de la sección "Convenciones generales" por la descripción de
      `make test`, `make test-backend` y `make test-frontend` y dónde viven las suites. No puede
      quedar ninguna afirmación de que el repo no tiene tests automatizados.
- [x] 11.2 `backend/AGENTS.md` (archivo real, se edita en su lugar): reescribir la bala "Tests" de
      "Convenciones" con pytest, `backend/tests/`, `backend/requirements-dev.txt`, el comando, y la
      aclaración de que la DB de test es SQLite — por eso no se testean los endpoints con
      `date_trunc` (reportes/KPIs). Agregar la advertencia de no exportar `CORS_ORIGINS` como
      variable de entorno en formato coma-separado (rompe el import de `Settings`).
- [x] 11.3 `frontend/AGENTS.md` (archivo real, se edita en su lugar): reescribir la bala "Tests"
      con Vitest + Testing Library, `npm run test`, dónde viven los tests
      (`src/**/__tests__/*.test.tsx`), el helper de render de `src/test/` y la estrategia de mock
      de `@/lib/http`.
- [x] 11.4 `.agents/skills/role-qa/SKILL.md` (archivo real **canónico** del rol): reemplazar la
      sección "Estado actual del repo" por qué cubre la suite (smoke de auth, 401 sin credenciales,
      matriz de roles owner/coach/user, render de las 4 vistas con spec), cómo correrla
      (`make test` como **primer paso** de verificación) y **qué sigue sin cubrir** (flujos de UI,
      reportes/KPIs con `date_trunc`, E2E), para que QA no infiera cobertura que no existe.
      Mantener la regla de que lint y build no son verificación, y que "NO VERIFICABLE" queda
      reservado para lo que ni la suite ni la prueba manual alcanzan.
- [x] 11.5 **No editar** `.claude/skills` (es un symlink al directorio `.agents/skills`),
      `.claude/agents/qa.md` ni `.codex/agents/qa.toml` (son wrappers generados por
      `.agents/bin/sync.py`). Dato útil verificado: esos wrappers solo contienen frontmatter +
      un puntero al SKILL, no copian el cuerpo — así que cambiar el cuerpo de `role-qa/SKILL.md`
      **no** genera drift y **no** requiere `make agents-sync`. Este change no toca
      `.agents/registry.json`.
- [x] 11.6 Correr `make agents-check` y confirmar que responde `OK` sin reportar drift entre
      `.agents/` y los directorios generados de cada proveedor. Si por algún motivo reportara
      drift, correr `make agents-sync` y volver a chequear.

## 12. Cierre

- [x] 12.1 `make test` en verde desde la raíz, en una terminal limpia.
- [x] 12.2 `git status` / `git diff` revisado: no quedó ninguna mutación de la fase 10 sin
      revertir, no hay `*.db` ni contenido de `backend/logs/` en el diff, y no se modificó ningún
      archivo de `backend/app/**` ni de `frontend/src/**` fuera de `src/test/` y
      `src/**/__tests__/`.
- [x] 12.3 Repasar la spec `specs/automated-test-suite/spec.md` requirement por requirement y
      confirmar que cada uno tiene tests o verificación que lo cubre. Anotar en el reporte de apply
      cualquier escenario que haya quedado sin cubrir y por qué.
