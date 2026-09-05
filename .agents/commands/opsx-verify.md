---
description: "OpenSpec: verificar un change antes de archivarlo (review del diff + escenarios de la spec)"
argument-hint: "[nombre-del-change] [--qa]"
---

Usá la skill `verify-change`.

Si tu proveedor no la expone como skill invocable, leé
`.agents/skills/verify-change/SKILL.md` y seguí sus pasos de punta a punta.

`--qa` fuerza la verificación manual de QA aunque el `## Plan de verificación` del change declare
riesgo bajo (no existe un flag equivalente para saltear QA con riesgo medio o alto).

Input del usuario: $ARGUMENTS
