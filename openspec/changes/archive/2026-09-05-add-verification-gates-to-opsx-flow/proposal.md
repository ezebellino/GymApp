## Why

La verificación de `/opsx:verify` hoy depende enteramente del criterio de Code Reviewer y QA en el
momento de revisar el diff, sin ningún gate mecánico previo ni un plan de qué invariantes proteger
declarado antes de escribir código. El costo es medible: la verificación del change archivado
`openspec/changes/archive/2026-09-05-unify-clients-into-users/verification.md` necesitó **3
pasadas y 14 hallazgos** (permisos por rol sin aplicar en dos endpoints, semántica de una
migración que pisaba un rol existente, un diálogo que perdía ediciones sin guardar tras un
refetch, entre otros), incluida una **regresión introducida por el fix de un hallazgo anterior**
(N1, en la segunda pasada). Casi todos esos hallazgos eran invariantes declarables antes de
implementar — no requerían ejecutar nada para anticiparlos. Además, ninguna de las 3 pasadas
arrancó corriendo `make lint` (el repo no tiene ese comando), así que cualquier problema mecánico
de estilo o tipos se hubiera mezclado con hallazgos de comportamiento en vez de filtrarse gratis.

## What Changes

- **`make lint`**: nuevo target en el `Makefile` que corre el linter de backend (Python — la
  herramienta concreta la elige `role-architect` en `design.md`) y el de frontend (`eslint` +
  chequeo de tipos de TypeScript), listado en `make help`, con código de salida distinto de cero
  si cualquiera de los dos falla.
- **`verify-change` corre `make lint` y `make test` como paso 0**, antes de lanzar Code Reviewer
  y QA. Si alguno falla, el veredicto en `verification.md` es FALLA sin ejecutar los dos roles
  (ahorra el turno de agente que hoy se gasta igual).
- **Sección obligatoria `## Plan de verificación` en `design.md`** de todo change con código,
  escrita por `role-architect`: invariantes que no pueden romperse, tests por capa nombrados
  (archivo + caso concreto de pytest/Vitest) que `role-dev` debe implementar como parte de las
  tasks, y un nivel de riesgo declarado (bajo/medio/alto) con el criterio que lo determina.
  `verify-change` chequea que la sección exista y que los tests nombrados existan de verdad tras
  aplicar las tasks; si falta la sección o un test nombrado no existe, el veredicto es FALLA.
- **QA manual se omite cuando el riesgo declarado es bajo** y `make lint` + `make test` están en
  verde: `/opsx:verify` corre solo Code Reviewer y lo deja explícito en `verification.md` ("QA
  manual omitida por riesgo bajo"). Riesgo medio o alto sigue corriendo QA manual como hoy y
  **riesgo alto nunca se puede saltear**. El usuario puede forzar QA manual aunque el riesgo sea
  bajo, pero no puede forzar que se salte en riesgo medio o alto.
- Actualización de las skills `verify-change`, `role-architect`, `role-dev` y `role-qa` en
  `.agents/skills/` (y `make agents-sync` después) para reflejar el flujo nuevo, y de `AGENTS.md`
  / `.agents/README.md` donde corresponda documentar `make lint`.

Este change **no toca la aplicación**: no hay cambios en `backend/app/` ni `frontend/src/` más
allá de la configuración de lint que agrega el Arquitecto (config del linter, no lógica de
negocio). El "usuario" de este change es el propio flujo de desarrollo con agentes.

## Capabilities

### New Capabilities
- `change-verification-gate`: el flujo de `/opsx:verify` de punta a punta — el gate mecánico de
  lint+test como paso 0, la exigencia y verificación del Plan de verificación en `design.md`, y la
  condición de riesgo declarado que decide si QA manual corre o se omite.

### Modified Capabilities
- `automated-test-suite`: se agrega `make lint` como comando de la red de seguridad automatizada
  (junto a `make test`), incluida su documentación en `AGENTS.md`/`backend/AGENTS.md`/
  `frontend/AGENTS.md`.

## Impact

- `Makefile`: nuevo target `lint` (y posiblemente `lint-backend`/`lint-frontend` — decisión de
  `role-architect`), agregado a la lista de `.PHONY` y a `make help`.
- `backend/requirements-dev.txt` + un archivo de configuración del linter Python elegido.
- `frontend/package.json`: posible script nuevo de typecheck si no alcanza con el `lint` existente
  (decisión de `role-architect`).
- `.agents/skills/verify-change/SKILL.md`, `.agents/skills/role-architect/SKILL.md`,
  `.agents/skills/role-dev/SKILL.md`, `.agents/skills/role-qa/SKILL.md`.
- `AGENTS.md`, `.agents/README.md` donde documenten comandos o el flujo de verificación.
- Sin cambios en `backend/app/`, `frontend/src/`, modelos ni migraciones.

## Supuestos

Sin usuario disponible para consultar en estas decisiones de producto; se registran acá con el
criterio de "menos es más pero completo":

1. **Nombre de la capability nueva**: se evaluó una capability por pieza (`lint-gate`,
   `verification-plan`, `qa-skip-policy`) contra una sola que cubra el flujo completo de
   `/opsx:verify`. Se eligió **una sola** (`change-verification-gate`) porque las tres piezas
   comparten el mismo artifact de salida (`verification.md`) y el mismo punto de entrada
   (`/opsx:verify`); partirlas en tres specs hubiera obligado a cross-referenciar constantemente
   sin aportar claridad.
2. **Dónde vive el gate de lint**: se evaluó ponerlo entero dentro de `change-verification-gate`
   (como un paso más del flujo) contra extender `automated-test-suite` (que ya es "la red de
   seguridad ejecutable del repo") y que `change-verification-gate` solo lo *consuma*. Se eligió
   lo segundo: `make lint` es un comando mecánico igual que `make test`, con la misma forma
   (target, código de salida, descubrible en `make help`); inventar una capability nueva para un
   comando hubiera duplicado buena parte de los requirements ya existentes de
   `automated-test-suite`.
3. **Alcance de "riesgo alto nunca se saltea"**: se consideró permitir que el usuario fuerce el
   salto de QA manual en cualquier nivel de riesgo (máxima flexibilidad) contra bloquearlo
   siempre en alto (lo pedido explícitamente en el encargo). Se eligió la segunda: alto siempre
   corre QA manual, sin excepción vía flag ni pedido explícito, porque es el nivel donde una
   regresión no detectada (como la N1 de la evidencia citada) tiene el costo más alto.
4. **Legacy de lint**: no se especifica en la spec cómo tratar offenses preexistentes (baseline vs
   bloqueo total) porque es una decisión de implementación de `role-architect`, no de
   comportamiento observable — hoy el frontend ya corre `eslint .` limpio y el backend no tiene
   linter, así que al día de este change no hay deuda heredada real que resolver todavía.
