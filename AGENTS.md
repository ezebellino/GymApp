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

Flujo (comandos definidos una sola vez en `.agents/commands/`: `/opsx:<x>` en Claude Code,
`/opsx-<x>` en Codex):

1. `/opsx:propose "<qué querés construir>"` — crea `openspec/changes/<nombre>/` con
   `proposal.md`, `specs/`, `design.md` y `tasks.md`. Cada artifact lo escribe su rol dueño:
   Product Owner el proposal y las specs, Arquitecto el design y las tasks.
2. Revisar y ajustar los artifacts generados si hace falta.
3. `/opsx:apply` — el rol Dev implementa las tasks del change.
4. `/opsx:verify` — **gate**: Code Reviewer revisa el diff y QA verifica los escenarios de la
   spec; el veredicto queda en `verification.md` dentro del change. OpenSpec solo tiene gates
   antes de implementar (`apply.requires`), así que este cubre el después.
5. `/opsx:sync` — sincroniza las delta specs a `openspec/specs/` (sin archivar).
6. `/opsx:archive` — con veredicto PASA, archiva el change y actualiza las specs principales.

Para explorar una idea antes de comprometerse a una propuesta formal: `/opsx:explore`.

No archives un change sin `verification.md` con veredicto PASA y sin que el usuario haya
confirmado que el comportamiento es el esperado. El usuario puede saltear el gate, pero tiene que
decirlo explícitamente y el resumen del archive debe registrarlo.

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

## Configuración de agentes: `.agents/` es la única fuente de verdad

Los colaboradores usan proveedores distintos (Claude Code, Codex). Para no mantener dos copias de
todo, **skills, comandos y roles se escriben una sola vez en `.agents/`** y cada proveedor los ve
por symlink o por un wrapper generado.

```
.agents/skills/     skills (ruta nativa de Codex; Claude Code la ve por symlink en .claude/skills)
.agents/commands/   comandos: /opsx:apply en Claude Code, /opsx-apply en Codex
.agents/skills/role-*/  los 5 roles de proceso (product-owner, architect, dev, code-reviewer, qa)
.agents/registry.json   qué se linkea + config por proveedor de cada rol
```

**Reglas**:
- **Nunca edites archivos dentro de `.claude/` o `.codex/`**: son symlinks o generados y se
  sobrescriben. Editá en `.agents/` y corré `make agents-sync`.
- Después de tocar `.agents/`, `make agents-check` no debe reportar drift (útil en CI).
- Un comando no repite el cuerpo de una skill: delega en ella.

Detalle completo, tabla de equivalencias por proveedor y cosas que muerden: [.agents/README.md](.agents/README.md).

## Roles de proceso

Los cambios no triviales se hacen por roles, cada uno con su propio alcance. Como skill funcionan
en cualquier proveedor; como subagente (`.claude/agents/`, `.codex/agents/`) suman aislamiento de
contexto y permisos.

| Rol | Dueño de | Escribe código |
|---|---|---|
| `role-product-owner` | `proposal.md`, `specs/**` | no |
| `role-architect` | `design.md`, `tasks.md` | no |
| `role-dev` | la implementación | sí (el único) |
| `role-code-reviewer` | review del diff | no |
| `role-qa` | verificación de escenarios | no |

## Skills disponibles

Además de las propias, este repo usa `autoskills` (ver `skills-lock.json` en raíz, `backend/` y
`frontend/`) para traer skills de comunidad por stack (React, shadcn, Tailwind, testing en Python,
a11y, SEO, deploy a Vercel, etc.) a `.agents/skills/`, `backend/.agents/skills/` y
`frontend/.agents/skills/`. Codex las carga solo; Claude Code las ve por los symlinks de
`.claude/skills`. Las de `frontend/` y `backend/` se cargan cuando arrancás el agente dentro de
esa carpeta.
