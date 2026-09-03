---
description: "OpenSpec: proponer un change y generar sus artifacts, cada uno por su rol dueño"
argument-hint: "[nombre-del-change | qué querés construir]"
---

Seguí la skill `openspec-propose` (mecánica del CLI, orden de artifacts, templates), pero
**delegando cada artifact al rol que lo posee** en vez de escribirlos todos vos.

## Reparto

| Artifact | Rol | Skill del rol |
|---|---|---|
| `proposal.md` y `specs/**` | Product Owner | `role-product-owner` |
| `design.md` y `tasks.md` | Arquitecto | `role-architect` |

## Cómo delegar

- **Con subagentes** (Claude Code: `product-owner` / `architect`; Codex: `product_owner` /
  `architect`): lanzá uno por artifact. En el prompt incluí siempre: nombre del change, el
  artifact a crear, y que corra `openspec instructions <artifact> --change "<name>" --json` para
  obtener template y rules. Los artifacts sin dependencias entre sí pueden ir en paralelo.
- **Sin subagentes**: leé `.agents/skills/role-<rol>/SKILL.md` y adoptá ese rol antes de escribir
  cada artifact. El aislamiento se pierde, las reglas del rol no.

## Guardrails del reparto

- El Product Owner **no** decide arquitectura y el Arquitecto **no** cambia requirements. Si al
  diseñar aparece un hueco en las specs, volvé al Product Owner en vez de parchearlo en `design.md`.
- Ningún rol de esta fase toca `backend/app/` ni `frontend/src/`. Implementar es `/opsx:apply`.
- Respetá el orden de dependencias que reporta `openspec status`: `specs` y `design` necesitan
  `proposal`; `tasks` necesita ambos.

Input del usuario: $ARGUMENTS
