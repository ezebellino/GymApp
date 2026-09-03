## Why

Hoy el repo no tiene ningún test automatizado: `AGENTS.md` declara explícitamente *"no asumas
test suite"* y `role-qa/SKILL.md` avisa que la verificación es siempre manual. Eso rompe el
proceso de trabajo: en `/opsx:verify` el rol QA solo puede levantar la app a mano con la skill
`run-app`, y todo escenario de spec que necesite ejecución repetible termina marcado como **NO
VERIFICABLE** en `verification.md`, así que ningún change puede cerrar el gate con evidencia real.
Además, sin tests el workflow de CI (issue #21) queda reducido a correr linters.

Queremos el **piso mínimo ejecutable**, no cobertura total: los caminos que más duelen si se
rompen (autenticación y separación de roles Dueño / Coach / Cliente) y que las vistas con spec
sigan renderizando.

## What Changes

- Se agrega una suite de tests de **backend** con pytest sobre la API: smoke de autenticación
  (registro → login → endpoint protegido) y verificación de que el rol equivocado recibe 403 para
  los tres roles de producto (Dueño, Coach, Cliente).
- Se agrega una suite de tests de **frontend** con Vitest: un test de render por vista que hoy
  tiene spec en `openspec/specs/` (`login-view`, `register-client-view`, `dashboard-view`,
  `settings-view`).
- Se agregan comandos al `Makefile`: `make test-backend`, `make test-frontend` y `make test`
  (corre las dos suites), de modo que QA y CI tengan un único punto de entrada.
- Se actualiza la documentación de agentes que hoy afirma lo contrario: `AGENTS.md` (raíz),
  `backend/AGENTS.md`, `frontend/AGENTS.md` y `.agents/skills/role-qa/SKILL.md` — se elimina el
  *"no asumas test suite"* y la sección "Estado actual del repo" del rol QA pasa a describir cómo
  correr los tests existentes.
- No cambia ningún comportamiento de producto: la API, la UI y el modelo de datos quedan igual.
  No es un cambio breaking.

**Fuera de alcance** (explícito, para no inflar el change):
- Tests E2E / Playwright: si hacen falta, van en un change aparte.
- Perseguir un porcentaje de cobertura o testear módulos sin spec (pagos, reportes, asistencia,
  rutinas). Este change fija el piso, no el techo.
- Armar el workflow de CI: lo habilita, pero lo implementa la issue #21.
- Decisiones técnicas (base de datos de test SQLite vs. Postgres, `requirements-dev.txt` vs.
  `requirements.txt`, configuración de Vitest/jsdom, estrategia de mocks del cliente HTTP): son
  del rol Arquitecto en `design.md`.

## Capabilities

### New Capabilities
- `automated-test-suite`: existencia y comportamiento observable de la suite de tests del repo —
  qué tiene que cubrir como mínimo (auth y autorización por rol en backend, render de las vistas
  con spec en frontend), cómo se ejecuta (`make test`, `make test-backend`, `make test-frontend`),
  y que las suites corran sin depender de un entorno productivo ni de datos preexistentes.

### Modified Capabilities

_Ninguna._ Las specs existentes (`login-view`, `register-client-view`, `dashboard-view`,
`settings-view`, `toast-notifications`) son el **insumo** de los tests de frontend, pero ninguno
de sus requirements cambia: este change no altera comportamiento de producto.

## Impact

- **Backend**: nuevas dependencias de test (pytest y compañía) y un directorio `backend/tests/`
  con su configuración de fixtures. Sin cambios en `backend/app/` ni migraciones nuevas.
- **Frontend**: nuevas devDependencies de test y script de test en `frontend/package.json`, más
  la configuración de entorno de test. Sin cambios en `frontend/src/`.
- **Raíz**: nuevos targets en el `Makefile`.
- **Documentación de agentes**: `AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md` y
  `.agents/skills/role-qa/SKILL.md` (editar en `.agents/` y correr `make agents-sync`; `make
  agents-check` no debe reportar drift).
- **Proceso**: destraba al rol `role-qa` y al gate `/opsx:verify`, que pasan a poder ejecutar
  escenarios en vez de declararlos NO VERIFICABLES. Habilita la issue #21 (CI con tests, no solo
  linters).
- **Riesgo**: bajo. El único costo real es el tiempo de ejecución de las suites y mantenerlas
  vivas cuando cambie la UI o la API; a cambio, cada change futuro tiene una red mínima.
