# CLAUDE.md

@AGENTS.md

Lo de arriba es la fuente canónica de instrucciones del proyecto (stack, comandos, CodeGraph,
OpenSpec, convenciones). Lo que sigue es específico de Claude Code.

## Herramientas específicas de Claude Code en este repo

- **MCP CodeGraph** (`.mcp.json`): expone `codegraph` como servidor MCP — usá sus tools en vez de
  `Bash(codegraph ...)` cuando estén disponibles; son la misma info sin gastar un turno de shell.
- **Slash commands** `/opsx:propose`, `/opsx:explore`, `/opsx:apply`, `/opsx:sync`,
  `/opsx:archive` — flujo de OpenSpec, ver AGENTS.md.
- **Subagentes por rol** en `.claude/agents/` (`product-owner`, `architect`, `dev`,
  `code-reviewer`, `qa`): son wrappers generados que delegan el cuerpo a
  `.agents/skills/role-*/SKILL.md`.
- **Skills**: todas viven en `.agents/skills/` y `.claude/skills` es un symlink a ese directorio.

**No edites nada dentro de `.claude/`**: `skills`, `commands/opsx/*.md` son symlinks y
`agents/*.md` está generado. Editá en `.agents/` y corré `make agents-sync`. Ver
[.agents/README.md](.agents/README.md).

## Notas de contexto por carpeta

Al trabajar dentro de `backend/` o `frontend/`, Claude Code también carga el `CLAUDE.md`/
`AGENTS.md` local de esa carpeta automáticamente. No dupliques ahí lo que ya está acá.
