## 1. Lint del backend (ruff)

- [x] 1.1 Agregar `ruff==0.14.14` a `backend/requirements-dev.txt` (debajo de `pytest==9.1.1`) e
      instalarlo en el venv existente: `backend/.venv/bin/pip install -r backend/requirements-dev.txt`.
- [x] 1.2 Crear `backend/ruff.toml` con `target-version = "py313"`, `[lint] select = ["E4","E7","E9","F"]`
      y los `per-file-ignores` de la dec. 1 (`**/migrations/versions/*.py` → `F401`;
      `**/scripts/*.py` → `E402`), cada uno con el comentario que explica por qué.
- [x] 1.3 Correr `cd backend && .venv/bin/python -m ruff check . --output-format concise` y
      confirmar el baseline esperado: 16 offenses (10 fixable).
- [x] 1.4 Aplicar el autofix: `cd backend && .venv/bin/python -m ruff check . --fix`. Toca
      `app/logging_conf.py` (`os`, `logging`), `app/routers/auth.py` (`hash_password`),
      `app/routers/payments.py` (`joinedload`, `and_`), `app/routers/routines.py:981`
      (`except Exception as exc:` → `except Exception:`), `scripts/seed_attendance.py`,
      `scripts/seed_payments.py`, `tests/test_invitations.py`, `tests/test_membership.py`.
      Revisar el diff línea por línea: ninguna edición puede cambiar semántica.
- [x] 1.5 Partir a mano los 5 `E702`: `app/routers/attendance.py:104` y
      `app/routers/payments.py:86` y `:156` (`db.add(x); db.commit(); db.refresh(x)` → tres
      líneas, mismo orden).
- [x] 1.6 `app/routers/routines.py:878`: agregar `# noqa: F821` con comentario en el mismo lugar
      nombrando el bug (`_progress_score` no existe → `GET /routines/users/{user_id}/progress-report`
      responde 500 NameError) y apuntando a la dec. 3 del `design.md` de este change.
- [x] 1.7 Escribir `backend/tests/test_payments.py` con
      `test_crear_leer_y_borrar_un_pago`: `POST /payments` (owner o coach sobre un miembro creado
      con `tests/helpers.create_user`), `GET /payments/{id}` y `DELETE /payments/{id}` → 204.
      Es la cobertura de las líneas partidas en 1.5; no debe usar `date_trunc` (no corre en SQLite).
- [x] 1.8 **Verificación del bloque**: `cd backend && .venv/bin/python -m ruff check .` termina en
      0, y `make test-backend` pasa con 61 tests.
- [x] 1.9 **Escalar el hallazgo de 1.6**: reportarle al usuario el bug de `_progress_score` con su
      reproducción y proponer un change aparte (`fix-progress-report-500`). No marcar esta task
      hasta que el usuario esté avisado.

## 2. Lint del frontend (eslint + tipos)

- [x] 2.1 Agregar `"typescript": "^5.9.3"` a `devDependencies` de `frontend/package.json` y
      `"typecheck": "tsc --noEmit -p tsconfig.json"` a `scripts`. Correr `npm install` en
      `frontend/` para que quede en `package-lock.json`.
- [x] 2.2 Correr `cd frontend && npm run typecheck` y anotar el baseline (6 errores en HEAD; si
      aparece uno en `src/components/Topbar.tsx`, es del change en vuelo
      `redesign-list-page-layout` — reportarlo, no arreglarlo acá).
- [x] 2.3 `frontend/src/lib/navigation.ts:24`: ampliar el tipo del componente de ícono de nav
      para que acepte `className?: string` además de `size?: number` (TS2322).
- [x] 2.4 `frontend/src/components/UserCard.tsx:242`: envolver el label en `String(...)` (TS2345).
- [x] 2.5 `frontend/src/pages/Settings.tsx:77`: en `buildReminderPreviewMessage`, dar fallback a
      `template` (`?? ""`) para que no sea `string | null` (TS18047).
- [x] 2.6 `frontend/src/stores/session.ts`: declarar el tipo persistido
      (`Pick<SessionState, "token" | "userName" | "role" | "email" | "exp">`) y tipar el
      `PersistStorage` con él (TS2739). Sin `as any` ni `@ts-expect-error`.
- [x] 2.7 `frontend/src/stores/settings.ts`: mismo patrón que 2.6 para `settings` (TS2741).
- [x] 2.8 `frontend/src/stores/theme.ts`: mismo patrón que 2.6 para `mode` (TS2741).
- [x] 2.10 Agregar `"@types/node": "^24"` a `devDependencies` de `frontend/package.json` (dec. 15
      del `design.md`: `frontend/src/lib/__tests__/utils.test.ts`, mergeado con
      `redesign-list-page-layout` después de la medición original del baseline, importa
      `node:fs`/`node:path` y usa `process` sin que el repo tuviera los tipos de Node). Correr
      `npm install` en `frontend/` para que quede en `package-lock.json`.
- [x] 2.9 **Verificación del bloque**: `cd frontend && npm run typecheck` termina en 0,
      `npm run lint` termina en 0 y `make test-frontend` pasa (los tests de `Login`, `Settings`,
      `Topbar` y `Dashboard` son los que ejercitan lo retipado).

## 3. Targets de lint en el `Makefile`

- [x] 3.1 Agregar `lint-backend` (banner `@echo "==> lint backend (ruff)"` +
      `cd backend && ../$(PYTHON) -m ruff check . --output-format concise`) con su comentario `##`.
- [x] 3.2 Agregar `lint-frontend` (banner + `npm run lint` y `npm run typecheck`, siguiendo de
      largo con `fail=1` para que un error de eslint no esconda los de tipos) con su comentario `##`.
- [x] 3.3 Agregar `lint` combinando los dos con el mismo patrón `fail=0 ... exit $$fail` que usa
      `test`, con su comentario `##`.
- [x] 3.4 Sumar `lint lint-backend lint-frontend` a la lista `.PHONY` de la primera línea.
- [x] 3.5 **Verificación del bloque**: `make lint` termina en 0; `make help` lista `lint`,
      `lint-backend` y `lint-frontend`; `make lint` corre sin haber levantado la app.
- [x] 3.6 **Verificación negativa**: inyectar temporalmente un `import os` sin usar en
      `backend/app/main.py` → `make lint` termina ≠ 0 citando `app/main.py` + `F401`; revertir.
      Repetir con un error de tipos en un `.ts` de `frontend/src` y con una violación de eslint,
      confirmando que la salida identifica app + archivo + regla en los tres casos.

## 4. Chequeo mecánico del Plan de verificación

- [x] 4.1 Crear `.agents/bin/check_plan.py` (stdlib, flags por `sys.argv`, docstring de uso, mismo
      estilo que `.agents/bin/sync.py`) con el contrato de la dec. 9: `--change <nombre>` /
      `--design <ruta>`, exit 0 + `riesgo=<nivel>`, exit 1 + una línea `FALLA:` por problema,
      exit 2 para error de uso.
- [x] 4.2 Implementar en el script los 6 chequeos de formato de la dec. 7 (sección única, línea de
      riesgo con nivel válido + criterio, ≥1 invariante `- I<n>.`, tabla de 3 columnas, ≥1 fila
      `backend`/`frontend`, capa válida). Los headings y líneas dentro de bloques de código fenced (```) se ignoran: el propio `design.md` de este change repite `## Plan de verificación` en dos ejemplos y debe seguir contando como sección única.
- [x] 4.3 Implementar la verificación de existencia de cada caso: `backend` → el archivo existe y
      contiene `def <caso>(`; `frontend` → el archivo existe y matchea
      `(it|test)\(\s*["'\`]<caso>` con el caso escapado; `manual` → sin chequeo. Strippear
      backticks y espacios de las celdas.
- [x] 4.4 Agregar el target `check-plan` al `Makefile` (`python3 .agents/bin/check_plan.py --change
      $(CHANGE)`), con comentario `##` que muestre el uso `CHANGE=<nombre>`, y sumarlo a `.PHONY`.
- [x] 4.5 **Verificación del bloque (caso verde)**:
      `make check-plan CHANGE=add-verification-gates-to-opsx-flow` termina en 0 e imprime
      `riesgo=medio`.
- [x] 4.6 **Verificación del bloque (casos rojos)**: con copias del `design.md` en un directorio
      temporal y `--design`, confirmar exit 1 y el `FALLA:` correcto para: (a) sin la sección
      `## Plan de verificación`, (b) sin línea `**Riesgo**`, (c) con un nivel inválido, (d) con un
      archivo de test inexistente, (e) con un caso inexistente dentro de un archivo que sí existe,
      (f) con la tabla solo de filas `manual`. Y exit 0 + `riesgo=bajo` con el nivel cambiado a
      `bajo`, y exit 0 con `### Invariantes del change` en vez de `### Invariantes` exacto (match
      por prefijo, hallazgo 2 de `verification.md`).

## 5. Skills de `.agents/`

- [x] 5.1 `.agents/skills/verify-change/SKILL.md`: insertar un paso 0 antes del actual "3. Correr
      los dos roles" que corre `make check-plan CHANGE=<n>` (solo si el diff toca `backend/` o
      `frontend/`), `make lint` y `make test`, los tres aunque uno falle; FALLA si alguno termina
      ≠ 0, sin lanzar Code Reviewer ni QA. Renumerar los pasos siguientes.
- [x] 5.2 `.agents/skills/verify-change/SKILL.md`: agregar la decisión de QA por riesgo — bajo +
      paso 0 verde ⇒ solo Code Reviewer; medio/alto ⇒ QA igual que hoy; alto nunca se omite ni a
      pedido; sin plan ⇒ se trata como medio; `--qa` o el pedido en prosa fuerzan QA con riesgo bajo.
- [x] 5.3 `.agents/skills/verify-change/SKILL.md`: actualizar el template de `verification.md` con
      `**Riesgo declarado**`, `**Paso 0**`, la tabla "Paso 0 — gate mecánico" y la frase fija
      "QA manual omitida por riesgo bajo" (dec. 12); y sumar al prompt de delegación de Code
      Reviewer el contraste entre riesgo declarado y diff.
- [x] 5.4 `.agents/skills/verify-change/SKILL.md`: borrar de *Límites* la frase "mientras el repo no
      tenga suite de tests" (es falsa y la spec MODIFIED la prohíbe), dejando el resto del párrafo.
- [x] 5.5 `.agents/skills/role-architect/SKILL.md`: agregar la obligación de escribir
      `## Plan de verificación` en todo change con código, con el formato literal de la dec. 7
      (bloque de ejemplo incluido) y las 6 reglas.
- [x] 5.6 `.agents/skills/role-architect/SKILL.md`: agregar la tabla de criterio de riesgo de la
      dec. 8 (gatillos de alto, condición doble de bajo, medio por default, desempate hacia
      arriba) y la instrucción de correr `make check-plan CHANGE=<n>` sobre el design recién
      escrito antes de dar el artifact por terminado.
- [x] 5.7 `.agents/skills/role-dev/SKILL.md`: agregar que cada fila de la tabla de tests del plan
      es una task obligatoria; que no se marca la última task sin `make lint`, `make test` y
      `make check-plan` en verde; y que si un caso del plan no se puede escribir se vuelve a
      `role-architect` en vez de borrarlo del plan.
- [x] 5.8 `.agents/skills/role-qa/SKILL.md`: el primer paso pasa a ser `make lint` + `make test`;
      aclarar que si la invocación viene de `/opsx:verify` esos comandos ya corrieron en el paso 0
      y llegan como insumo (no se repiten); y que con riesgo bajo QA puede no ser invocada, sin que
      eso sea un hueco de verificación.
- [x] 5.9 `.agents/commands/opsx-verify.md`: documentar `--qa` en el `argument-hint` y una línea de
      su semántica (forzar QA manual con riesgo bajo; no existe un flag para saltearla).
- [x] 5.10 **Verificación del bloque**: correr `make agents-sync` y después `make agents-check` sin
      drift; abrir `.claude/agents/architect.md`, `dev.md` y `qa.md` y confirmar que los wrappers
      quedaron regenerados con las descriptions vigentes.

## 6. Documentación

- [x] 6.1 `AGENTS.md` (raíz): sumar `make lint` al bloque de comandos del Makefile y extender el
      bullet **Tests** con qué corre el lint en cada app (ruff en backend, eslint + tsc en frontend).
- [x] 6.2 `AGENTS.md` (raíz): en el flujo de OpenSpec, mencionar el `## Plan de verificación` como
      parte del artifact del Arquitecto (paso 1) y el gate mecánico de `/opsx:verify` (paso 4),
      incluyendo que con riesgo bajo QA manual se omite y queda registrado.
- [x] 6.3 `backend/AGENTS.md`: sumar `make lint-backend` al bloque **Comandos** y, en el bullet de
      **Tests**, dónde vive la config de ruff (`backend/ruff.toml`), qué reglas cubre y por qué
      `migrations/versions/` y `scripts/` tienen `per-file-ignores`. Mencionar `tests/test_payments.py`.
- [x] 6.4 `frontend/AGENTS.md`: sumar `npm run typecheck` / `make lint-frontend` al bloque
      **Comandos** y una línea de que `typescript` ahora es dependencia real, que `npm run build`
      sigue sin chequear tipos (lo hace el gate) y que los `PersistStorage` quedaron tipados.
- [x] 6.5 `.agents/README.md`: agregar `bin/check_plan.py` al árbol de estructura y una línea sobre
      el gate mecánico en el párrafo que describe los comandos `/opsx:*`.
- [x] 6.6 **Verificación del bloque**: `grep -rn "no tiene lint\|sin lint\|no hay test" AGENTS.md
      backend/AGENTS.md frontend/AGENTS.md .agents/skills/role-qa/SKILL.md
      .agents/skills/verify-change/SKILL.md` no devuelve ninguna afirmación viva de que el repo no
      tiene tests o no tiene lint.

## 7. Cierre y dogfooding

- [x] 7.1 Confirmar que el working tree no arrastra el rojo de `redesign-list-page-layout`: si
      `make test` falla en `frontend/src/pages/__tests__/Users.test.tsx`, reportarlo al usuario
      como precondición externa y no marcar 7.2 hasta que se resuelva.
- [x] 7.2 Correr el paso 0 completo sobre este mismo change:
      `make check-plan CHANGE=add-verification-gates-to-opsx-flow`, `make lint` y `make test`, los
      tres en verde.
- [x] 7.3 Recorrer las filas `manual` del `## Plan de verificación` del `design.md` y dejar el
      resultado de cada una anotado para que `/opsx:verify` lo consolide.
- [x] 7.4 Verificar los invariantes I1-I8 del plan, en particular I6 (ningún archivo tocado dentro
      de `.claude/`, `.codex/` ni `backend/migrations/versions/`): `git status --porcelain` no debe
      listar nada de esas rutas.
- [x] 7.5 Correr `/opsx:verify add-verification-gates-to-opsx-flow` con el flujo nuevo y confirmar
      que `verification.md` sale con la cabecera de paso 0, el riesgo declarado y el reporte de QA
      (riesgo medio ⇒ QA corre).

## 8. Correcciones de la verificación

- [x] 8.1 Invertir la frase de `.agents/skills/verify-change/SKILL.md:46-47` (hallazgo 1 de
      `verification.md`): la regla real es "change **sin** código y sin plan ⇒ riesgo medio";
      "change **con** código y sin plan" es una FALLA de `check-plan` (exit 1), no un atajo a
      riesgo medio. Se agregó también el caso `check-plan = N/A ⇒ medio` a la decisión de QA del
      paso 4.
- [x] 8.2 `.agents/bin/check_plan.py`: `### Invariantes` y `### Tests` ahora matchean por prefijo
      (`heading_matches`), no por igualdad exacta (hallazgo 2 de `verification.md`). Documentado
      en `role-architect/SKILL.md` y agregado el caso `### Invariantes del change` → exit 0 al
      fixture de la task 4.6.
- [x] 8.3 `check_plan.py` `strip_fences`: un fence sin cerrar al final del documento ahora emite
      `FALLA: bloque de código sin cerrar en línea N` en vez de tragarse el resto y reportar
      "falta la sección" (hallazgo 3 de `verification.md`). Probado con fixture ad hoc.
- [x] 8.4 `frontend/tsconfig.json`: `include` pasa a `["src", "*.ts"]` para cubrir `.ts` fuera de
      `src/` (hallazgo 4 de `verification.md`). `npm run typecheck` sigue en 0 y
      `tsc --listFiles` no agrega nada fuera de `src/` (no hay `.ts` en la raíz de `frontend/`
      hoy).
- [x] 8.5 `role-architect/SKILL.md`: la fila "alto" de la tabla de riesgo suma
      `backend/app/routers/auth.py` y la frase general "cualquier cambio que altere cómo se
      emite/valida un token o qué rol exige un endpoint" (hallazgo 5 de `verification.md`). El
      `## Plan de verificación` de este mismo `design.md` se actualizó para aclarar que el único
      toque a `routers/auth.py` (un `F401` de la dec. 2) no dispara el gatillo nuevo.
- [x] 8.6 `tasks.md` 2.3 y `design.md` dec. 5: corregido `Sidebar.tsx` → `frontend/src/lib/navigation.ts:24`,
      el archivo real donde se hizo el fix del tipo del ícono (hallazgo 6 de `verification.md`).
- [x] 8.7 `Makefile` `check-plan`: si `CHANGE` está vacío, imprime
      `ERROR: falta CHANGE=<nombre-del-change>. Uso: make check-plan CHANGE=<nombre>` y sale con
      2 antes de invocar el script (hallazgo 8 de `verification.md`).
- [x] 8.8 Hallazgo 7 (`frontend/eslint.config.js` no cubre `.ts`/`.tsx`): corregido a pedido del
      usuario en la tercera pasada — `typescript-eslint` recommended sobre `**/*.{ts,tsx}`, 0 errores
      (ver `verification.md`, tercera pasada).
- [x] 8.9 `_progress_score` definida en `backend/app/routers/routines.py` con test
      `tests/test_progress_score.py`; `noqa: F821` retirado (design dec. 3, posdata).
