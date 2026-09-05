# Verificación: add-verification-gates-to-opsx-flow

**Fecha**: 2026-09-05
**Veredicto**: PASA — segunda pasada: los 7 hallazgos en alcance corregidos (bloque 8 de `tasks.md`) y paso 0 re-ejecutado en verde; el único hallazgo abierto es preexistente y fuera de alcance (7)
**Diff verificado**: working tree sin commitear sobre HEAD `c6f19fb` (`git diff HEAD`, 29 archivos, más `.agents/bin/check_plan.py`, `backend/ruff.toml` y `backend/tests/test_payments.py` nuevos)
**Riesgo declarado**: medio — confirmado correcto por Code Reviewer contra el diff
**Paso 0**: lint OK · test OK · plan OK

## Lectura rápida

- **Valor**: primera corrida real del flujo nuevo. El paso 0 mecánico filtró antes de gastar agentes, `check-plan` devolvió el riesgo, y riesgo medio hizo correr QA. El gate se verificó a sí mismo.
- **Conflictos**: ninguno abierto. Los dos preexistentes (eslint sin cobertura de `.ts`/`.tsx`, hallazgo 7, y el 500 de `_progress_score`) se corrigieron a pedido del usuario en el mismo working tree, sin change aparte; ver tercera pasada.
- **Hecho / Pendiente**: 59/59 tasks. La primera pasada dio PASA CON RESERVAS (1 mayor, 6 menores); todos corregidos y re-verificados en la segunda pasada. Listo para `/opsx:sync` y `/opsx:archive`.

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=add-verification-gates-to-opsx-flow` | OK (`riesgo=medio`, exit 0) |
| Lint | `make lint` | OK (exit 0; ruff "All checks passed!", eslint limpio, tsc limpio) |
| Tests | `make test` | OK (exit 0; backend 61 passed, frontend 16 archivos / 68 passed) |

## Escenarios de la spec

### `automated-test-suite`

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| Lint limpio en ambas apps | `make lint` en repo limpio: banners de ambas apps, exit 0 | PASA |
| Offense de estilo en el backend | Inyección `x = 1; y = 2` en `backend/app/utils.py` → `app/utils.py:85:10: E702`, exit ≠ 0; revertido | PASA |
| Offense de eslint en el frontend | Inyección de variable sin usar en `App.jsx` → `no-unused-vars` con archivo:línea, exit ≠ 0; revertido. La misma inyección en un `.ts` no la detecta eslint (ver hallazgo m7, preexistente) | PASA |
| Error de tipos en el frontend | Inyección `const x: number = "x"` en `lib/utils.ts` → `TS2322` con archivo:línea, exit ≠ 0; revertido | PASA |
| El comando es descubrible | `make help` lista `lint`, `lint-backend`, `lint-frontend` junto a los de test | PASA |
| No requiere la app levantada | Sin proceso en 8001; `make lint` corre igual | PASA |
| La raíz documenta tests y lint | `AGENTS.md` líneas 41, 94-95, 119-127; ninguna afirmación de ausencia | PASA |
| Cada app documenta su suite y su lint | `backend/AGENTS.md` (41, 88, 109, 126) y `frontend/AGENTS.md` (77, 83-84, 214) | PASA |
| El rol QA sabe que puede ejecutar tests | `role-qa/SKILL.md:13-20` y `62-64` | PASA |
| La skill de verificación describe el gate | `verify-change/SKILL.md:32-53` | PASA |
| Sin drift entre proveedores | `make agents-check` → OK, exit 0 | PASA |

### `change-verification-gate`

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| Lint rojo bloquea antes de gastar un turno | Gatillo mecánico probado (arriba). Reacción del agente prescrita en `verify-change/SKILL.md:48-51` | PASA (gatillo ejecutado; reacción por lectura de skill) |
| Test rojo bloquea antes de gastar un turno | `verify-change/SKILL.md:48-51`; no se inyectó un test roto | PASA (por lectura de skill) |
| Lint y test en verde continúan el flujo | Esta misma corrida: paso 0 verde → Code Reviewer + QA | PASA (evidencia directa) |
| Design sin Plan de verificación | `check_plan.py --design <copia sin sección>` → `FALLA: falta la sección`, exit 1. La sección real cuenta como única pese a los ejemplos en bloques de código | PASA |
| Test nombrado que no existe | Caso renombrado en copia → `FALLA: backend/tests/test_payments.py: no se encontró el caso '...'`, exit 1 | PASA |
| Plan completo con sus tres contenidos | `check_plan.py --change ...` → `riesgo=medio`, exit 0 | PASA |
| Riesgo declarado no coincide con el diff | Code Reviewer contrastó riesgo vs diff con la tabla de `role-architect`: medio es correcto. El mecanismo (hallazgo, no FALLA) quedó ejercitado en esta corrida | PASA (evidencia directa) |
| Riesgo bajo con suite verde omite QA manual | Gatillo: fixture con `bajo` → `riesgo=bajo`. Comportamiento en `verify-change/SKILL.md:73-74` y frase fija en `113-115` | PASA (gatillo ejecutado; reacción por lectura de skill) |
| Riesgo medio corre QA manual | Esta misma corrida | PASA (evidencia directa) |
| Riesgo alto nunca se saltea | `verify-change/SKILL.md:76-77`; `grep -rn "no-qa" .agents/` sin resultados; `opsx-verify.md` solo documenta `--qa` | PASA (por lectura de skill + ausencia del flag) |
| El usuario fuerza QA en riesgo bajo | `verify-change/SKILL.md:78-80`, `opsx-verify.md:11-12` | PASA (por lectura de skill) |

### Camino infeliz adicional

| Caso | Resultado |
|---|---|
| `make check-plan` sin `CHANGE=` | exit 2, mensaje culpa al flag `--change` en vez de decir que falta `CHANGE=` (m6) |
| `make check-plan CHANGE=no-existe` | exit 2, `ERROR: change inexistente: 'no-existe' (...)` |
| `make lint` con venv sin ruff | NO VERIFICABLE (no se desinstaló); por lectura del Makefile daría `No module named ruff`, exit ≠ 0, riesgo ya declarado en design ("falsos rojos por entorno") |

## QA manual

Corrida por riesgo medio, sin app levantada: todos los escenarios son comandos, archivos y fixtures. Fixtures en el scratchpad de sesión, fuera del repo. `git status --short` idéntico antes y después de las inyecciones.

## Segunda pasada — re-verificación tras las correcciones

Paso 0 re-ejecutado: `make check-plan CHANGE=...` → `riesgo=medio` exit 0 · `make lint` exit 0 · `make test` exit 0 (61 + 68) · `make agents-check` OK · `make check-plan` sin `CHANGE=` → mensaje explícito, exit 2. Texto del paso 0 y del paso 4 de `verify-change/SKILL.md` releído: la regla quedó como en dec. 10 (con código y sin plan ⇒ FALLA de `check-plan`; sin código y sin plan ⇒ `N/A` ⇒ riesgo medio, QA corre) y sin frases contradictorias. Fixtures del script: heading `### Invariantes del change` → exit 0; fence sin cerrar → `FALLA: bloque de código sin cerrar en línea 5`, exit 1.

## Hallazgos — estado tras la segunda pasada

| # | Severidad | Estado |
|---|---|---|
| 1 | mayor | Corregido (task 8.1) |
| 2, 3 | menor | Corregidos (8.2, 8.3) |
| 4 | menor | Corregido (8.4), `include: ["src", "*.ts"]`, typecheck sigue en 0 |
| 5 | menor | Corregido (8.5), `routers/auth.py` y la regla general de token/rol en la fila de riesgo alto |
| 6 | menor | Corregido (8.6) |
| 7 | menor, preexistente | Corregido a pedido del usuario (tercera pasada): `typescript-eslint` recommended sobre `.ts`/`.tsx`, 0 errores |
| 8 | nit | Corregido (8.7) |

## Hallazgos (primera pasada, texto original)

1. **[mayor]** `.agents/skills/verify-change/SKILL.md:46-47` — dice "si el change **tiene código** y no trae plan, el riesgo se trata como medio". El design (dec. 10, líneas 344-345) dice "si un change **sin código** no trae plan". Escenario de falla: change que toca `backend/app/` sin sección `## Plan de verificación`; `check-plan` sale 1 y la línea 48 ordena FALLA sin roles, pero las líneas 46-47 dan una salida contraria que lleva al agente a correr Code Reviewer + QA con riesgo medio. La spec exige FALLA. Además desapareció la regla real para changes sin código (check-plan `N/A`, sin `riesgo=`): el paso 4 no define qué hacer con QA. Corrección: invertir la frase y agregar la regla para `N/A`.
2. **[menor]** `.agents/bin/check_plan.py:144,151` — `### Invariantes` y `### Tests` se matchean por igualdad exacta pero `role-architect/SKILL.md` solo exige encabezado exacto del `##`. Con `### Invariantes del change` el script da FALLA con la sección presente. Documentar o matchear por prefijo.
3. **[menor]** `check_plan.py:48-61` — `strip_fences` va por paridad de líneas de tres backticks; un fence sin cerrar antes del plan se traga el resto y el error dice "falta la sección" con la sección escrita. Anidado con cuatro backticks sí funciona.
4. **[menor]** `frontend/tsconfig.json` `include: ["src"]` — el typecheck no cubre `.ts` fuera de `src/` (hoy no hay ninguno; latente).
5. **[menor]** `.agents/skills/role-architect/SKILL.md:66-70` — la tabla de riesgo angosta "autenticación" a 5 rutas exactas; un cambio de TTL del token en `routers/auth.py` no dispara alto. La spec dice "autenticación o permisos por rol".
6. **[menor]** `tasks.md` 2.3 y `design.md` dec. 5 nombran `Sidebar.tsx`; el fix real está en `frontend/src/lib/navigation.ts:24` (lugar correcto). Si se archiva así, el registro queda con el archivo equivocado.
7. **[menor, preexistente]** `frontend/eslint.config.js:10` — `files: ['**/*.{js,jsx}']`: eslint no cubre `.ts`/`.tsx`, que son 88 de 90 archivos de `src/`. El escenario de spec pasa literalmente pero la cobertura de estilo real en el frontend es solo `tsc`. Fuera del alcance de este change; conviene un change chico aparte.
8. **[nit]** `Makefile:73` — mensaje de `make check-plan` sin `CHANGE=` (ver camino infeliz).

**Nota**: task 1.9 (escalar el bug de `_progress_score`) quedó cumplida: el usuario fue informado y pidió el arreglo inmediato, hecho en la tercera pasada.

## Tercera pasada — dos preexistentes corregidos a pedido del usuario, sin change aparte

- **eslint sobre TypeScript**: `typescript-eslint` como devDependency; bloque `**/*.{ts,tsx}` con `recommended` + react-hooks + react-refresh en `frontend/eslint.config.js`; `.agents` ignorado (templates de skills). De 44 errores iniciales quedaron 0: 3 arreglados en código (`LastPayments.tsx` expresión suelta, `Dashboard.tsx` variable sin uso, `MembershipDot.tsx` disable con motivo), `only-export-components` y `no-explicit-any` apagados en `ui/**`, `test/**` y `__tests__/**`, y `no-explicit-any` en `warn` para el resto. Deuda visible: 21 warnings de `any` en `src/` y 12 de `exhaustive-deps`, ninguno bloquea.
- **`_progress_score`**: definida en `backend/app/routers/routines.py` con metas alineadas a `_motivation_for_metrics` (design dec. 3, posdata); `noqa` retirado; `tests/test_progress_score.py` con 6 casos (cero, negativos, saturación, umbral verde 65, componentes independientes). No hay test de endpoint: requiere seed de rutinas y ejercicios; el NameError desaparece por construcción al existir la función.
- Paso 0 re-ejecutado: `make lint` exit 0 · `make test` exit 0 (backend 67, frontend 68).

## Lo que Code Reviewer confirmó bien

Los fixes mecánicos son 1:1 en semántica: los 5 splits de `E702` conservan orden y sentencias; los imports borrados por F401 no tenían caller ni efecto secundario; `except Exception as exc` → `except Exception` no cambia nada porque `exc` no se usaba. El `noqa: F821` deja la lógica intacta y el bug es real. Los tres `PersistStorage` cambian solo anotaciones (claves de storage intactas, cubiertas por tests de `Topbar`/`Login`/`Settings`). `check_plan.py` es stdlib pura y cumple el contrato de exit 0/1/2 en todos los casos probados. `Makefile`: 4 targets en `.PHONY` y `help`, `lint` propaga exit ≠ 0 con el mismo patrón que `test`, mismo `$(PYTHON)` del venv. `ruff.toml` no silencia nada fuera de lo diseñado. `test_payments.py` rompe de verdad si el `commit` del split desaparece. Sin secretos, sin debug, sin strings de UI en inglés, `.claude/` y `.codex/` solo via `agents-sync`. `package-lock.json` suma exactamente `typescript@5.9.3`, `@types/node@24.13.3` y `undici-types`.

## Sin verificar

- Reacción del agente ante lint/test rojo y ante riesgo alto con pedido de omisión: comportamiento de agente que solo se ejercita con una corrida real de `/opsx:verify` sobre un fixture roto. Prescrito sin ambigüedad en la skill; no ejecutado.
- `make lint` con entorno roto (venv sin ruff, `node_modules` sin `typescript`): no se desinstalaron dependencias reales.
