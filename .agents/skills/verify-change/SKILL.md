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

## 3. Correr los dos roles

Los dos son independientes: **lanzalos en paralelo** si tu proveedor lo permite (subagentes en
Claude Code, `spawn` en Codex). Si no, uno después del otro.

| Rol | Skill | Insumo | Entrega |
|---|---|---|---|
| Code Reviewer | `role-code-reviewer` | el diff + las specs | hallazgos con archivo:línea y escenario de falla |
| QA | `role-qa` | los `#### Scenario:` del change | tabla escenario → PASA / FALLA / NO VERIFICABLE con evidencia |

Delegá con contexto explícito: nombre del change, rutas de sus artifacts y el rango del diff. No
les pidas que "revisen todo": el alcance es este change.

## 4. Consolidar en `verification.md`

Escribí `openspec/changes/<name>/verification.md`:

```markdown
# Verificación: <change-name>

**Fecha**: YYYY-MM-DD
**Veredicto**: PASA | PASA CON RESERVAS | FALLA
**Diff verificado**: <rango o commits>

## Escenarios de la spec

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| <capability> / <escenario> | UI con run-app / request a la API / no verificable | PASA |

## Hallazgos

1. **[bloqueante|mayor|menor]** `archivo:línea` — qué está mal y con qué input falla.

## Sin verificar

- Qué quedó afuera y por qué (falta de tests, entorno, datos).
```

## 5. Veredicto

- **FALLA** (hay bloqueantes): devolvé el control a `role-dev` con la lista. No archives.
- **PASA CON RESERVAS**: mostrale las reservas al usuario y que él decida si sigue.
- **PASA**: recién ahí `/opsx:sync` y `/opsx:archive`.

## Límites

Verificás; no arreglás. Si encontrás algo, se arregla en el flujo de `role-dev` y se vuelve a
verificar. No inventes un veredicto PASA para cerrar el change: mientras el repo no tenga suite de
tests, es normal que haya escenarios **NO VERIFICABLE** — decilo en vez de taparlo.
