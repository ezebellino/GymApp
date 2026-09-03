---
description: "OpenSpec: archivar un change ya implementado y verificado"
argument-hint: "[nombre-del-change]"
---

Usá la skill `openspec-archive-change`.

Si tu proveedor no la expone como skill invocable, leé
`.agents/skills/openspec-archive-change/SKILL.md` y seguí sus pasos de punta a punta.

## Gate previo (antes de correr el archive)

1. Chequeá que exista `openspec/changes/<name>/verification.md` con **Veredicto: PASA** (o PASA
   CON RESERVAS aceptadas explícitamente por el usuario).
2. Si no existe, no archives: ofrecé correr `/opsx:verify` primero.
3. Si el veredicto es FALLA o tiene hallazgos bloqueantes abiertos, no archives: devolvé el
   control a `/opsx:apply` con la lista de hallazgos.

El usuario puede saltear el gate, pero tiene que decirlo explícitamente y el resumen del archive
debe registrar que se archivó sin verificación.

Input del usuario: $ARGUMENTS
