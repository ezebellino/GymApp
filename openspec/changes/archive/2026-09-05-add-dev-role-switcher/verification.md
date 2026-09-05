# Verificación: add-dev-role-switcher

**Fecha**: 2026-09-05
**Veredicto**: PASA CON RESERVAS
**Diff verificado**: working tree sin commitear sobre `0ee1ccc` (branch `feat/kinetic-obsidian-theme`); 10 archivos modificados + 8 nuevos (ver `git status`)
**Riesgo declarado**: bajo (Code Reviewer lo contrasta y propone **medio**, ver hallazgo 2)
**Paso 0**: lint OK · test OK · plan OK

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=add-dev-role-switcher` | OK (`riesgo=bajo`) |
| Lint | `make lint` | OK (ruff "All checks passed"; eslint 0 errores / 32 warnings preexistentes; tsc OK) |
| Tests | `make test` | OK (backend 74 passed; frontend 18 archivos / 76 tests passed) |

## Escenarios de la spec

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| dev-role-switcher / Visible en desarrollo | `App.devSwitcher.test.tsx` (`DEV=true`) + UI con run-app (`evidence/01-login-widget.png`) | PASA |
| dev-role-switcher / Ausente en producción | `App.devSwitcher.test.tsx` (`DEV=false`) + `npm run build` y grep de centinelas en `dist/` (cero coincidencias, sin chunk `dev`) | PASA |
| dev-role-switcher / Las tres opciones están disponibles | `DevRoleSwitcher.test.tsx` + UI | PASA |
| dev-role-switcher / Cambiar de un rol a otro sin restos de la sesión anterior | UI con run-app: Coach → Miembro, Sidebar/Topbar sin restos (`evidence/05-…`). Sin test automatizado del camino feliz (ver hallazgo 4) | PASA |
| dev-role-switcher / Elegir un usuario sin tener sesión previa | UI con run-app: Dueño desde `/login` (`evidence/03-…`) | PASA |
| dev-role-switcher / Dueño o Coach aterrizan en el dashboard | UI con run-app (`evidence/03-…`, `04-…`) | PASA |
| dev-role-switcher / Miembro aterriza en su portal | UI con run-app: `/my-routine` (`evidence/05-…`) | PASA |
| dev-role-switcher / Colapsar el widget | `DevRoleSwitcher.test.tsx` + UI | PASA |
| dev-role-switcher / El estado sobrevive a recargar | `DevRoleSwitcher.test.tsx` (siembra + remount) + recarga real (`evidence/06-…`) | PASA |
| dev-role-switcher / Seed no corrido | `DevRoleSwitcher.test.tsx` (400 → mensaje + token intacto) + UI sin sesión (`02-…`) y con sesión Miembro vigente (`07-…`) | PASA |
| dev-role-switcher / Feedback visible durante el cambio | `DevRoleSwitcher.test.tsx` (pendiente → `disabled` + `aria-busy`) + snapshot a11y durante el click | PASA |
| dev-role-switcher / No se puede disparar un segundo cambio | `DevRoleSwitcher.test.tsx` (segundo click no dispara otro `POST`) | PASA |
| dev-role-switcher / Primera corrida crea los tres usuarios | `test_dev_seed.py` (crea 3 + login real parametrizado por rol) + `make seed-dev` en Docker (`3 creados`) | PASA |
| dev-role-switcher / Correr el seed dos veces no duplica usuarios | `test_dev_seed.py` + segunda corrida de `make seed-dev` (`0 creados, 3 actualizados`, 3 filas) | PASA |
| dev-role-switcher / Intento de correr el seed fuera de desarrollo | `test_dev_seed.py` (dos guardas, `SystemExit != 0`, `create_engine` no invocado) | PASA |
| automated-test-suite / Se renderiza en modo desarrollo | `App.devSwitcher.test.tsx` | PASA |
| automated-test-suite / No se renderiza en modo producción | `App.devSwitcher.test.tsx` | PASA |

## QA manual

- **QA manual omitida por riesgo bajo.** En su lugar corrieron `make lint`, `make test` y
  `make check-plan CHANGE=add-dev-role-switcher` (los tres en verde) y los tests nombrados en el
  `## Plan de verificación`.
- Atenuante: `role-dev` dejó una vuelta manual completa con la skill `run-app` en
  `evidence/README.md` (7 escenarios PASA con screenshots), que cubre los cinco escenarios que solo
  tienen fila `manual` en el plan. No es un reporte del rol QA.

## Hallazgos

1. **[mayor]** `frontend/src/hooks/useSignIn.ts:46` — `setThemeMode(normalizeThemeMode(me?.theme_preference))` corre aunque `GET /auth/me` haya fallado. En el código anterior de `Login.tsx` el `setThemeMode` vivía dentro del `try` de `/auth/me`; la rama de fallo no tocaba el tema. Escenario: `app_theme="light"`, `POST /auth/token` 200, `GET /auth/me` 500 → el tema pasa a `"dark"` y se persiste. Contradice el Non-Goal del design ("cambiar el comportamiento observable del login manual"). El hook sigue literalmente la task 3.3 y la dec. 3 del design, así que el origen está en el design; la corrección es condicionar la llamada a `me !== null`. `Login.test.tsx` no lo detecta (sus casos mockean `/auth/me` con éxito).
2. **[mayor, proceso]** `openspec/changes/add-dev-role-switcher/design.md:398` — el riesgo `bajo` no cumple la condición doble de `role-architect`: (a) el diff sí cambia comportamiento observable (widget, seed, campo de `Settings`, refactor de `Login.tsx`; el hallazgo 1 lo prueba) y (b) cinco escenarios de la spec solo tienen fila `manual` ("Ausente en producción", "sin restos de la sesión anterior", "sin sesión previa", "aterrizan en el dashboard", "aterriza en su portal"). Nivel correcto propuesto: **medio**. Con `bajo`, el gate omite QA por diseño; el daño material lo cubre la evidencia de `role-dev`, pero el nivel debe corregirse en `design.md`.
3. **[menor]** `backend/scripts/seed_dev_users.py:88` — en la rama de fila existente, `membership_status`/`membership_cancelled_at` solo se normalizan para el Miembro; un Dueño/Coach dejado en `cancelled` a mano no vuelve a `none` con `make seed-dev` (la dec. 8 dice que quedan en `none`). No afecta el login (`is_membership_blocking_login` solo mira rol `member`), sí el indicador del listado.
4. **[menor]** `design.md:404-414` — el plan reformateado conserva el contenido de las decisiones, pero los invariantes I2 e I4 no tienen fila en la tabla de Tests (I2 es la task 5.5; I4 —`logout()` antes de `setSession`— no lo verifica nada) y `DevRoleSwitcher.test.tsx` no tiene ningún caso de cambio de usuario exitoso.
5. **[menor]** `frontend/src/services/auth.ts:35` — el default de destructuring `message = ""` no cubre `null` (el código anterior usaba `?? ""`); axios nunca manda `message: null`, sin escenario real. Cosméticos: el error inline del widget no se limpia al colapsar; `aria-expanded` en el botón colapsado sin `aria-controls`.
6. **[registro]** `useSignIn.ts:39` — `role: me.role` reemplaza a `(me.role ?? "coach")`; con `role` ausente ahora cae al del JWT vía `setSession`. Mejora, sin ruta que lo alcance (`MeUser.role` es obligatorio).

## Sin verificar

- Code Reviewer no reejecutó `npm run build`, `make seed-dev` ni levantó la app: tomó I1 y los
  escenarios manuales de `evidence/README.md` (que no contrastó visualmente).
- No hay versión previa del `## Plan de verificación` en git (el change entero está untracked): la
  fidelidad del reformateo se juzgó por coherencia con las Decisions, no por diff.
- Comportamiento visual del widget frente a `DialogContent` (top layer) y en viewport chico.
- I4 (`logout()` estrictamente antes de `setSession`) solo por inspección del código y del shell en
  la corrida manual; ningún test lo afirma.

## Decisión del usuario

**Reservas aceptadas explícitamente por el usuario el 2026-09-05** (pidió `/opsx:sync` +
`/opsx:archive` tras leer el veredicto PASA CON RESERVAS). Los hallazgos 1 (tema pisado si
`/auth/me` falla tras un token válido) y 2 (riesgo declarado `bajo`, criterio del Arquitecto dice
`medio`) quedan abiertos como deuda a resolver en un change posterior; no se corrigieron antes de
archivar. Las capturas de la evidencia se borraron a pedido del usuario (no se suben imágenes al
repo salvo pedido explícito); `evidence/README.md` describe lo que mostraba cada una.

## Opciones que se ofrecieron

Las reservas son los hallazgos 1 y 2. Opciones: (a) volver a `role-dev` para condicionar el
`setThemeMode` a `me !== null` (y opcionalmente el hallazgo 3), y a `role-architect` para subir el
riesgo a **medio** y corregir la dec. 3 / task 3.3, y reverificar; o (b) aceptar las reservas
explícitamente y seguir con `/opsx:sync` + `/opsx:archive`, dejándolo registrado en el resumen del
archive.
