# AGENTS.md

Instrucciones para agentes de IA (Claude Code, Codex y compatibles) que trabajan en este repo.
Este archivo es la fuente canónica: `CLAUDE.md` solo importa este archivo y agrega notas
específicas de Claude Code. Si editás guías de proyecto, editá **acá**.

## Qué es este proyecto

**Mini Espacio** — sistema de gestión para gimnasios. Monorepo con dos apps independientes:

| Carpeta | Stack | Rol |
|---|---|---|
| `backend/` | FastAPI + SQLAlchemy + Alembic + PostgreSQL (Supabase) | API REST + auth JWT |
| `frontend/` | React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui | SPA (roles Dueño/Coach + portal cliente) |

Cada carpeta tiene su propio `AGENTS.md` con detalle específico de stack — leelo antes de tocar
código ahí:
- [backend/AGENTS.md](backend/AGENTS.md)
- [frontend/AGENTS.md](frontend/AGENTS.md)

Ver [README.md](README.md) para contexto de producto, módulos y deploy.

## Comandos de desarrollo (Makefile)

No inventes comandos: el `Makefile` en la raíz es la fuente de verdad de cómo se levanta el
proyecto. `make help` los lista todos.

```bash
make setup      # instala backend + frontend
make dev        # levanta backend (uvicorn) + frontend (vite) juntos
make backend    # solo backend, puerto 8001
make frontend   # solo frontend
make migrate    # alembic upgrade head
make docker-up  # stack completo en Docker (db + backend + frontend)
```

## Gestión de contexto y tokens: usá CodeGraph antes de explorar a ciegas

Este repo tiene un índice de CodeGraph en `.codegraph/` (104 archivos, ~1200 símbolos). **Antes
de hacer una exploración amplia con `grep`/`find`/lectura de archivos completos**, preferí las
herramientas de CodeGraph — devuelven resultados dirigidos y gastan muchos menos tokens que leer
archivos enteros:

```bash
codegraph status                       # salud del índice
codegraph sync                         # re-indexar cambios desde el último index (rápido, correr si el status se ve viejo)
codegraph query <símbolo>              # buscar una función/clase/variable por nombre
codegraph context "<descripción tarea>" # arma un markdown de contexto relevante para una tarea
codegraph callers <símbolo>            # quién llama a este símbolo
codegraph callees <símbolo>            # a qué llama este símbolo
codegraph impact <símbolo>             # qué se ve afectado si lo cambio
codegraph affected <archivo...>        # qué tests se ven afectados por estos cambios
codegraph files                        # estructura del proyecto desde el índice
```

Reglas prácticas:
- Si vas a modificar un símbolo (función, clase, endpoint, componente), corré `codegraph impact
  <símbolo>` y `codegraph callers <símbolo>` primero para entender el blast radius sin leer todo
  el árbol de archivos.
- Si vas a empezar una tarea nueva ("agregar filtro de fecha a reportes"), corré `codegraph
  context "<descripción>"` para obtener un paquete de contexto acotado en vez de recorrer
  carpetas a mano.
- El índice puede quedar desactualizado a medida que se edita código en la sesión. Si las
  búsquedas no encuentran algo que sabés que existe, corré `codegraph sync` y reintentá.
- CodeGraph también está expuesto como servidor MCP (ver `.mcp.json`) para que Claude Code lo
  llame directo como herramienta en lugar de vía shell.

## Desarrollo guiado por specs: OpenSpec

Los cambios no triviales (nueva feature, cambio de contrato de API, cambio de modelo de datos)
se proponen primero como *change* de OpenSpec antes de tocar código. Esto evita divagar y
mantiene las specs (`openspec/specs/`) como fuente de verdad del comportamiento actual.

Flujo (slash commands ya configurados en `.claude/commands/opsx/` y `.codex/skills/`):

1. `/opsx:propose "<qué querés construir>"` — crea `openspec/changes/<nombre>/` con
   `proposal.md`, `design.md` y `tasks.md`.
2. Revisar y ajustar los artifacts generados si hace falta.
3. `/opsx:apply` — implementa las tasks del change.
4. `/opsx:sync` — sincroniza las delta specs a `openspec/specs/` (sin archivar).
5. `/opsx:archive` — cuando el change está implementado y validado, lo archiva y actualiza specs
   principales.

Para explorar una idea antes de comprometerse a una propuesta formal: `/opsx:explore`.

No archives un change sin correr los tests/lint relevantes y sin que el usuario haya confirmado
que el comportamiento es el esperado.

## Convenciones generales

- **Idioma**: el código (nombres de variables, funciones) va en inglés; el contenido de cara al
  usuario (strings de UI, mensajes, commits) va en español, siguiendo lo ya existente en el repo.
- **Commits**: mensajes cortos en imperativo, prefijo tipo Conventional Commits cuando aplique
  (`feat:`, `fix:`, `chore:`), como en el historial actual.
- **Variables de entorno**: nunca commitear `.env` reales; usar `.env.example` /
  `.env.docker.example` como plantilla. Los `.env*` reales ya están en `.gitignore`.
- **Migraciones**: cualquier cambio a `backend/app/models.py` requiere una migración Alembic
  nueva (`backend/AGENTS.md` tiene el comando). No edites migraciones ya aplicadas en producción.
- **No asumas test suite**: hoy no hay tests automatizados en `backend/` ni `frontend/`. Si
  agregás uno, documentalo en el `AGENTS.md` correspondiente y en el `Makefile`.

## Skills disponibles

Este repo usa `autoskills` (ver `skills-lock.json` en raíz, `backend/` y `frontend/`) para traer
skills de comunidad relevantes por stack (React, shadcn, Tailwind, testing en Python, a11y, SEO,
deploy a Vercel, etc.) a `.agents/skills/`, `backend/.agents/skills/` y
`frontend/.agents/skills/`. Se cargan automáticamente según el contexto — no hace falta invocarlas
a mano salvo que el usuario lo pida explícitamente.
