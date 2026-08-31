# CLAUDE.md

@AGENTS.md

Lo de arriba es la fuente canónica de instrucciones del proyecto (stack, comandos, CodeGraph,
OpenSpec, convenciones). Lo que sigue es específico de Claude Code.

## Herramientas específicas de Claude Code en este repo

- **MCP CodeGraph** (`.mcp.json`): expone `codegraph` como servidor MCP — usá sus tools en vez de
  `Bash(codegraph ...)` cuando estén disponibles; son la misma info sin gastar un turno de shell.
- **Slash commands** `/opsx:propose`, `/opsx:explore`, `/opsx:apply`, `/opsx:sync`,
  `/opsx:archive` en `.claude/commands/opsx/` — flujo de OpenSpec, ver AGENTS.md.
- **Skills** en `.claude/skills/` (OpenSpec) y `.agents/skills/` + `backend/.agents/skills/` +
  `frontend/.agents/skills/` (autoskills por stack).

## Notas de contexto por carpeta

Al trabajar dentro de `backend/` o `frontend/`, Claude Code también carga el `CLAUDE.md`/
`AGENTS.md` local de esa carpeta automáticamente. No dupliques ahí lo que ya está acá.
