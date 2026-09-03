# Verificación: add-test-suite

**Fecha**: 2026-09-03
**Veredicto**: PASA (los hallazgos 1-3 fueron corregidos y reverificados; el 4 se deja por decisión del usuario)
**Diff verificado**: working tree sobre `chore/agents-estructura-unificada` (rama `test/add-test-suite`, sin commitear)

Suite completa: backend `14 passed`, frontend `8 passed` (4 archivos), `make test` exit 0.

## Escenarios de la spec

Los 9 requirements de `specs/automated-test-suite/spec.md` fueron verificados por QA corriendo los
comandos de verdad, de forma independiente del reporte del Dev.

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| Punto de entrada / Suite completa en verde | `make test` → 14 + 8, exit 0 | PASA |
| Punto de entrada / Un test falla | Mutación de un assert en `test_auth.py`: salida identifica `FAILED …::test_me_con_token_valido`, la suite de frontend **igual corre**, exit 2. Revertido | PASA |
| Punto de entrada / Comandos descubribles | `make help` lista los tres targets con descripción | PASA |
| Comandos por app / Solo backend | `make test-backend` corre solo pytest, exit 0 | PASA |
| Comandos por app / Solo frontend | `make test-frontend` corre solo vitest, exit 0 | PASA |
| Comandos por app / Sin app levantada a mano | Corridos sin `make dev`/`backend`/`frontend`/`docker-up` | PASA |
| Smoke de auth / Registro, login válido, login inválido, `/auth/me` con token | `tests/test_auth.py`, 6 tests. El login fallido asserta **400**, que es lo que la API devuelve hoy | PASA |
| Rechazo sin credenciales / Sin token y con token manipulado | `test_me_sin_token`, `test_me_con_token_invalido`: 401 y sin `email` en el body | PASA |
| Autorización por rol / Matriz completa | `tests/test_roles.py`, 7 tests: `/coaches` (owner 200, coach 403, user 403), `/clients/` (owner 200, coach 200, user 403), `/routines/my/client` (solo `user`) | PASA |
| Aislamiento / No toca datos reales | Conteo de filas en el Postgres real del dev (`gymapp_development`, el del `backend/.env`) antes y después de `make test`: `users=1, clients=0, payments=0, attendances=0, app_settings=1`, idéntico | PASA |
| Aislamiento / Sin datos previos | Corridas sin ningún seed manual; el conftest crea un SQLite temporal nuevo por invocación | PASA |
| Aislamiento / Dos corridas seguidas | 4+ corridas consecutivas, siempre `14 passed`, sin conflictos de email ya registrado | PASA |
| Render / Las 4 vistas con spec | Los 4 archivos de test assertan los elementos que cada spec promete y los que declara eliminados | PASA |
| Detección / Vista que rompe al renderizar | `throw` inyectado en `Login()`: falla apuntando a `src/pages/Login.tsx:39` dentro de `Login`. Revertido | PASA |
| Detección / Elemento prometido que desaparece | Botón "Entrar" eliminado de `Login.tsx`: falla con "Unable to find an accessible element" señalando el `getByRole`. Revertido | PASA |
| Detección / Sin backend disponible | Ver reserva 3: verificado estructuralmente, no bajando el stack | PASA (con salvedad) |
| Documentación / Raíz, por app, rol QA, sin drift | Los 4 archivos leídos; el "no asumas test suite" ya no aparece; `make agents-check` → `OK` | PASA |

Higiene al cierre: tras los tres ciclos de mutación y revert, `git status` y `git diff` vuelven al
baseline exacto. Ningún archivo de `backend/app/**` ni `frontend/src/**` modificado — el límite
duro de la task 1.3 se cumplió.

## Hallazgos

1. **[mayor]** `backend/tests/test_auth.py:3` y `backend/tests/test_roles.py:13` — el
   `from tests.conftest import ...` importa el conftest **una segunda vez** como módulo distinto.
   pytest ya lo cargó como `conftest` (import mode `prepend`, sin `__init__.py`); `pythonpath = .`
   hace de `tests` un namespace package, así que `tests.conftest` es otro objeto módulo. Verificado
   con una sonda: dos ids de módulo distintos, dos `mkdtemp()`, dos engines.
   **Falla concreta**: (a) cada corrida deja **dos** tmpdirs huérfanos con su `test.db` — medido:
   `miniespacio-tests-*` pasó de 10 a 12 tras una sola corrida; en CI crece por job. (b) La red de
   seguridad del design (decisión 1: "`DATABASE_URL` pisada garantiza que no se toque prod") queda
   apuntando a un SQLite **vacío y sin esquema** que ningún engine usa; cualquier fixture futuro
   que construya un engine desde `os.environ["DATABASE_URL"]` falla con `no such table: users` y
   nadie va a entender por qué leyendo el conftest.
   **CORREGIDO**: las constantes, `PASSWORD` y `login()` se movieron a `backend/tests/helpers.py`
   (que pytest no auto-carga, así que se importa una sola vez), y el fixture huérfano `auth_header`
   pasó a tomar `client` y ser consumido por los tests. No queda ningún `from tests.conftest import`.
   Reverificado de forma independiente: `os.environ["DATABASE_URL"]` vuelve a coincidir con
   `app.database.engine.url`, y los tmpdirs por corrida bajaron de **2 a 1** (medido antes/después
   sobre `make test`).

2. **[menor]** `backend/AGENTS.md:68` — documenta `cd backend && ../.venv/bin/python -m pytest`,
   pero el venv vive en `backend/.venv` (`Makefile:6`). Desde `backend/`, `../.venv` resuelve a
   `<repo>/.venv`, que no existe.
   **Falla concreta**: un agente que siga el AGENTS.md al pie de la letra obtiene
   `no such file or directory: ../.venv/bin/python` (reproducido). Es un defecto introducido por
   este change.
   **CORREGIDO**: quedó `cd backend && .venv/bin/python -m pytest`, verificado corriendo el comando
   tal como quedó escrito (`14 passed`). En el mismo archivo se corrigió la bala de Auth, que
   describía dos roles cuando `models.UserRole` tiene tres.

3. **[menor]** `frontend/src/pages/__tests__/Settings.test.tsx:41` — el
   `queryByText("Recordatorio mensual")` da null solo porque `Settings.tsx:639` renderiza
   `Recordatorio mensual:{" "}` (con dos puntos) dentro de la card "Resumen rápido", que la spec sí
   quiere, y el matcher exacto normaliza a `"Recordatorio mensual:"`.
   **Falla concreta**: si alguien mueve el `:` dentro del `<span>` de "Resumen rápido", el test se
   pone en rojo sin que se haya reintroducido ninguna InfoCard. Falso positivo. Un
   `queryByText(/^Recordatorio mensual$/)` o una búsqueda por rol/heading sería robusto.
   **CORREGIDO**: las tres InfoCard se buscan por `queryByRole("heading", ...)`. El discriminador
   salió de mirar el markup original (`git show 339843d^`): el título de la InfoCard era un `<h2>` y
   la línea de "Resumen rápido" es un `<p>`. Se sumó un control positivo (`Resumen rápido` sigue
   presente) para que los asserts negativos no puedan pasar por página vacía. Verificado en las dos
   direcciones con mutaciones revertidas: mover el `:` ya no produce rojo espurio, y reintroducir un
   `<h2>Recordatorio mensual</h2>` sí falla.

4. **[menor]** `frontend/src/pages/__tests__/Login.test.tsx:20,23` — el regex tolerante
   (`/contrase[nñ]a/i`, `/registrar cuenta/i`) es la decisión **correcta** para este change (el Dev
   tenía prohibido tocar `frontend/src/**`, y fallar por un typo preexistente habría dejado la
   suite entera en rojo por algo ajeno). Pero silencia una divergencia real:
   la spec `login-view` promete el campo **"Contraseña"** y un **link** "Registrar cuenta";
   `Login.tsx:118` escribe `Contrasena` sin tilde y `:160` es un `<button>` con "Registrar Cuenta".
   **`RegisterClient.tsx:117` sí escribe "Contraseña" con tilde**: la misma palabra, distinta, en
   dos vistas contiguas.
   **Falla concreta**: la UI hoy incumple literalmente su spec y la suite da verde, que es
   exactamente lo que el requirement "Test de render por cada vista con spec" quería evitar.
   Además el assert acepta ambas grafías para siempre. Requiere una decisión de producto (corregir
   `Login.tsx` o relajar la spec), fuera del alcance de este change.
   **Decisión del usuario (2026-09-03): se deja como está.** El regex tolerante se mantiene y no se
   abre follow-up. Queda registrado acá que, a partir de ahora, ese assert acepta ambas grafías: si
   alguien corrige o rompe el acento de `Login.tsx`, ningún test se va a enterar.

## Sin verificar

- **"Sin backend disponible"** no se verificó de la forma literal (bajar el stack y correr): tanto
  el Dev como QA tuvieron `docker stop` bloqueado por el clasificador de permisos. QA lo dio por
  PASA con un argumento **estructural**, no empírico: `@/lib/http` es el único seam de red de las 4
  vistas y los 4 tests hacen `vi.mock` del módulo entero antes de que se evalúe. Ojo con la
  evidencia que reportó el Dev (apuntar `VITE_API_URL` a un puerto muerto): **no prueba nada**,
  porque el mock reemplaza el módulo donde esa variable se lee, así que su valor es inerte.
- **Endpoints con `date_trunc`** (reportes, KPIs de pagos): fuera de alcance por diseño — no corren
  en SQLite. Documentado como no cubierto en `backend/AGENTS.md`.
- **Flujos de UI** (submit de formularios, navegación, toasts) y **E2E**: fuera de alcance
  explícito del proposal.
- `backend/AGENTS.md` sigue describiendo los roles como "Dueño y Coach" cuando el enum tiene tres.
  Es deuda preexistente que el proposal excluyó, pero este change **agravó la inconsistencia
  interna del archivo**: ahora documenta una suite que testea `owner`/`coach`/`user` tres líneas
  debajo de la afirmación de que hay dos roles.

## Reverificación tras los arreglos

Confirmado de forma independiente sobre el working tree final:

- `make test` → backend `14 passed`, frontend `8 passed` (4 archivos), **exit 0**.
- Fuga de tmpdirs cerrada: `miniespacio-tests-*` pasa de 2 a 3 tras una corrida completa (delta 1,
  antes era 2).
- El comando de `backend/AGENTS.md:70` corre tal como está escrito: `14 passed`.
- `git diff -- backend/app frontend/src` vacío: el límite duro de la task 1.3 se sigue cumpliendo.

## Adenda: test de regresión del aislamiento

A pedido del usuario se agregó `backend/tests/test_isolation.py` (2 tests) después de la
verificación, para que el hallazgo 1 no pueda volver en silencio: asserta que
`app.database.engine.url` coincide con `os.environ["DATABASE_URL"]` y que el backend del engine es
`sqlite`. No importa nada de `conftest` a propósito — compara contra `os.environ`, que es la fuente
que el conftest pisa.

Verificado por mutación: reintroduciendo un `from tests.conftest import ...` en un test, falla
`test_database_url_coincide_con_el_engine_de_la_app`. Mutación revertida.

Suite final: backend **16 passed**, frontend **8 passed**, `make test` exit 0.
