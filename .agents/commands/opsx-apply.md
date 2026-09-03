---
description: "OpenSpec: implementar las tasks de un change con el rol Dev"
argument-hint: "[nombre-del-change]"
---

Seguí la skill `openspec-apply-change` (selección del change, contextFiles, tracking de tasks),
**implementando con el rol Dev**.

## Cómo delegar

- **Con subagentes** (Claude Code: `dev`; Codex: `dev`): delegá la implementación pasándole el
  nombre del change y las rutas de sus artifacts. Es el único rol que escribe código de aplicación.
- **Sin subagentes**: leé `.agents/skills/role-dev/SKILL.md` y adoptá ese rol antes de la primera
  línea de código.

## Guardrails

- Si falta `tasks.md`, no implementes: corré `/opsx:propose` primero.
- Task por task, marcando `- [x]` a medida que cerrás. No adelantes tasks ni agregues features
  que nadie pidió.
- Si el diseño está mal o incompleto, **pará**: volvé al rol Arquitecto en vez de improvisar
  arquitectura dentro de una task.
- Toque a `backend/app/models.py` ⇒ migración Alembic en el mismo change.

## Al terminar

Cuando todas las tasks estén en `- [x]`, **no archives todavía**: corré `/opsx:verify`, que pasa
el change por Code Reviewer y QA y deja el veredicto en `verification.md`. Recién con veredicto
PASA siguen `/opsx:sync` y `/opsx:archive`.

Input del usuario: $ARGUMENTS
