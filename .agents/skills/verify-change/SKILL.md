---
name: verify-change
description: Verificar un change de OpenSpec antes de archivarlo — review del diff + verificación de los escenarios de la spec, consolidado en verification.md. Usar cuando las tasks están completas y antes de /opsx:sync o /opsx:archive.
---

# Verificar un change

Este es el **gate previo a archivar**. OpenSpec solo tiene gates antes de implementar
(`apply.requires`); esta skill cubre el después.

## 1. Elegir el change y chequear precondiciones

```bash
openspec list --json
openspec status --change "<name>" --json
```

- Si quedan tasks sin marcar en `tasks.md`, **no verifiques**: decí cuántas faltan y devolvé el
  control a `role-dev`. Verificar a mitad de implementación genera hallazgos falsos.
- Si el change no tiene specs (`specs/**/spec.md`), avisá: sin escenarios no hay nada que
  verificar más que el diff.

## 2. Reunir el contexto

```bash
openspec instructions apply --change "<name>" --json   # contextFiles del change
git diff main...HEAD                                    # el diff a revisar
```

Leé `proposal.md`, las specs del change, `design.md` y `tasks.md` antes de mirar el diff.

## 3. Paso 0 — gate mecánico

Antes de gastar un turno de agente en Code Reviewer o QA, corré los tres chequeos mecánicos, en
orden de costo creciente y **los tres aunque uno falle** (misma razón que `lint`/`test` siguen de
largo: un solo turno devuelve la lista completa de lo que hay que arreglar):

```bash
make check-plan CHANGE=<name>   # solo si el diff toca backend/ o frontend/ (ver abajo)
make lint
make test
```

- **`check-plan` es condicional**: corre solo si el diff del change (incluyendo lo no
  commiteado) toca algún path bajo `backend/` o `frontend/`. Si **no** toca ninguno, se saltea y
  se registra como `N/A` — y si ese change sin código tampoco trae `## Plan de verificación`, el
  riesgo se trata como **medio** (nunca uses la ausencia de plan para saltear QA barato). Si el
  change **sí tiene código** y no trae el plan, `check-plan` sale con exit 1: eso **no** es un
  atajo a riesgo medio, es la FALLA del paso 0 de la línea siguiente — no se lanza ningún rol.
- Si **cualquiera de los tres** termina con código de salida distinto de cero: veredicto
  **FALLA** en `verification.md`, citando el comando y su salida relevante (archivo + regla para
  lint, test + app para test, motivo para check-plan). **No lances** Code Reviewer ni QA para
  este intento — se ahorra el turno que hoy se gasta igual.
- Si los tres terminan en verde, seguí al paso 4. `check-plan` además te da el **riesgo
  declarado** (`riesgo=bajo|medio|alto`), que gobierna la decisión de QA del paso 4.

## 4. Correr los roles (Code Reviewer siempre, QA según riesgo)

Code Reviewer y QA son independientes: **lanzalos en paralelo** si tu proveedor lo permite
(subagentes en Claude Code, `spawn` en Codex). Si no, uno después del otro.

| Rol | Skill | Insumo | Entrega |
|---|---|---|---|
| Code Reviewer | `role-code-reviewer` | el diff + las specs | hallazgos con archivo:línea y escenario de falla |
| QA | `role-qa` | los `#### Scenario:` del change | tabla escenario → PASA / FALLA / NO VERIFICABLE con evidencia |

Delegá con contexto explícito: nombre del change, rutas de sus artifacts y el rango del diff. No
les pidas que "revisen todo": el alcance es este change. Al prompt de Code Reviewer sumale el
riesgo declarado y pedile que lo contraste contra el diff con la tabla de criterio de
`role-architect` (gatillos de alto, condición doble de bajo): si no coinciden, es un **hallazgo**,
no un FALLA del paso 0.

**Decisión de QA por riesgo declarado** (viene de `check-plan`, paso 0):

- **Riesgo bajo** y paso 0 en verde ⇒ corré solo Code Reviewer. Omití la verificación manual de
  QA y dejalo escrito en `verification.md` (frase fija más abajo) — no la dejes implícita.
- **Riesgo medio o alto** ⇒ corré QA igual que hoy.
- **`check-plan` = `N/A`** (change sin código y sin `## Plan de verificación`) ⇒ riesgo **medio**,
  corré QA igual que con un riesgo medio declarado.
- **Riesgo alto nunca se omite**, ni siquiera si el usuario lo pide explícitamente en prosa o con
  un flag: no existe un `--no-qa`.
- **Forzar QA con riesgo bajo**: `/opsx:verify <change> --qa`, o el pedido en prosa ("corré QA
  igual"). En ese caso corré QA y registralo como "QA corrida a pedido del usuario pese al riesgo
  bajo" (no como la omisión).

## 5. Consolidar en `verification.md`

Escribí `openspec/changes/<name>/verification.md`:

```markdown
# Verificación: <change-name>

**Fecha**: YYYY-MM-DD
**Veredicto**: PASA | PASA CON RESERVAS | FALLA
**Diff verificado**: <rango o commits>
**Riesgo declarado**: bajo | medio | alto
**Paso 0**: lint OK · test OK · plan OK

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=<n>` | OK / N/A / FALLA (motivo) |
| Lint | `make lint` | OK / FALLA (archivo + regla) |
| Tests | `make test` | OK / FALLA (test + app) |

## Escenarios de la spec

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| <capability> / <escenario> | UI con run-app / request a la API / no verificable | PASA |

## QA manual

<uno de los tres:>
- el reporte de QA (tabla escenario → resultado + evidencia), o
- **QA manual omitida por riesgo bajo.** En su lugar corrieron `make lint`, `make test` y
  `make check-plan CHANGE=<nombre>` (los tres en verde) y los tests nombrados en el
  `## Plan de verificación`.
- QA corrida a pedido del usuario pese al riesgo bajo.

## Hallazgos

1. **[bloqueante|mayor|menor]** `archivo:línea` — qué está mal y con qué input falla.

## Sin verificar

- Qué quedó afuera y por qué (falta de tests, entorno, datos).
```

## 6. Veredicto

- **FALLA** (hay bloqueantes, o el paso 0 no pasó): devolvé el control a `role-dev` con la lista.
  No archives.
- **PASA CON RESERVAS**: mostrale las reservas al usuario y que él decida si sigue.
- **PASA**: recién ahí `/opsx:sync` y `/opsx:archive`.

## Límites

Verificás; no arreglás. Si encontrás algo, se arregla en el flujo de `role-dev` y se vuelve a
verificar. No inventes un veredicto PASA para cerrar el change: es normal que haya escenarios
**NO VERIFICABLE** (comportamiento de agente que ningún test automatizado cubre, por ejemplo) —
decilo en vez de taparlo.
