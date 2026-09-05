# `.agents/` — configuración de agentes, una sola vez

Este directorio es la **única fuente de verdad** de skills, comandos y roles de agentes de IA.
`.claude/` y `.codex/` solo contienen symlinks y wrappers generados. **Nunca edites nada dentro de
`.claude/` o `.codex/`**: se sobrescribe.

Los colaboradores usan proveedores distintos (Claude Code, Codex). La regla es: se escribe una vez
acá, funciona en los dos.

## Estructura

```
.agents/
├── README.md                  este archivo
├── registry.json              qué se linkea y config por proveedor de cada rol
├── bin/sync.py                materializa .claude/ y .codex/ desde acá
├── bin/check_plan.py          gate mecánico: chequea el `## Plan de verificación` de un design.md
│                               (make check-plan CHANGE=<nombre>) — lo corre `verify-change`
├── skills/                    ← ruta NATIVA de Codex ($REPO_ROOT/.agents/skills)
│   ├── openspec-*/            flujo de OpenSpec (cuerpo canónico, generado por openspec)
│   ├── verify-change/         gate de verificación previo a archivar (propia)
│   ├── run-app/               levantar la app en Docker
│   ├── role-*/                los 5 roles de proceso (ver abajo)
│   └── <autoskills>/          traídas por autoskills (skills-lock.json) — no editar a mano
└── commands/                  stubs de comandos: `opsx-<nombre>.md`
```

Y lo que genera `make agents-sync`:

```
.claude/skills            -> ../.agents/skills                    (symlink de directorio)
.claude/commands/opsx/*.md -> ../../../.agents/commands/opsx-*.md  (symlink por archivo)
.claude/agents/*.md          wrapper generado (frontmatter + delega a la skill del rol)
.codex/prompts/opsx-*.md  -> ../../.agents/commands/opsx-*.md      (symlink por archivo)
.codex/agents/*.toml         wrapper generado (TOML + delega a la skill del rol)
backend/.claude/skills    -> ../.agents/skills
frontend/.claude/skills   -> ../.agents/skills
```

## Por qué symlinks para algunas cosas y wrappers para otras

| Capa | Claude Code | Codex | Solución |
|---|---|---|---|
| Skills | `.claude/skills/` | `.agents/skills/` (nativo) | **symlink de directorio** — mismo `SKILL.md` |
| Comandos | `.claude/commands/<ns>/<n>.md` → `/ns:n` | `.codex/prompts/<ns>-<n>.md` → `/ns-n` | **symlink por archivo** — mismo frontmatter (`description`, `argument-hint`) y `$ARGUMENTS` |
| Roles / subagentes | Markdown + YAML frontmatter | TOML (`developer_instructions`, `sandbox_mode`) | **wrapper generado**: formatos incompatibles, así que el wrapper solo lleva config y delega el cuerpo a `role-*/SKILL.md` |

Verificado en Claude Code 2.1.250: descubre skills, comandos y subagentes a través de symlinks
(tanto de directorio como por archivo). La doc de Codex declara explícitamente que sigue symlinks
de skills. Claude Code **no** lee `.agents/skills` por su cuenta — de ahí el symlink.

## Cómo agregar cosas

**Una skill nueva**: creá `.agents/skills/<nombre>/SKILL.md` con frontmatter `name` +
`description`. Los dos proveedores la ven sin correr nada (Claude vía el symlink del directorio).

**Un comando nuevo**: creá `.agents/commands/<ns>-<nombre>.md` y corré `make agents-sync`.
Queda como `/<ns>:<nombre>` en Claude Code y `/<ns>-<nombre>` en Codex. Mantené el cuerpo mínimo:
el comando delega a una skill, no repite su contenido.

**Un rol nuevo**: creá `.agents/skills/role-<nombre>/SKILL.md`, agregá la entrada en
`registry.json` (tools/model para Claude, sandbox/effort para Codex) y corré `make agents-sync`.

Después de cualquier cambio: `make agents-check` no debe reportar drift. Reiniciá la sesión del
agente para que recargue skills y comandos.

## Los 5 roles

| Rol | Escribe | Herramientas |
|---|---|---|
| `product-owner` | `proposal.md`, `specs/**` | lectura + escritura en `openspec/` |
| `architect` | `design.md`, `tasks.md` | lectura + CodeGraph (impact/callers) |
| `dev` | código de aplicación | todas |
| `code-reviewer` | nada (reporta) | solo lectura + `/code-review` |
| `qa` | nada (reporta) | lectura + Docker + chrome-devtools |

Cada rol es **a la vez** una skill (invocable en cualquier proveedor) y un subagente
(aislamiento de contexto y permisos, en el proveedor que lo soporte).

Los comandos `/opsx:*` delegan en ellos: `propose` reparte entre Product Owner y Arquitecto,
`apply` implementa con Dev, y `verify` corre primero un gate mecánico (`make check-plan` +
`make lint` + `make test`; corta antes de gastar un turno de agente si algo sale en rojo) y recién
después Code Reviewer + QA (QA se omite con riesgo declarado bajo y el gate en verde), dejando el
veredicto en `verification.md` del change (gate previo a `archive`).

## Cosas que muerden

- **`openspec update` regenera archivos de proveedor** y puede pisar los symlinks de
  `.claude/commands/opsx/` con archivos reales. Si pasa: `make agents-sync` (avisa antes de tocar
  nada; con `--force` respalda en `.bak`).
- **Prompts globales de Codex duplicados**: `openspec update` instala `~/.codex/prompts/opsx-*.md`
  a nivel usuario. Ahora que están versionados en el repo, borrá los globales para no ver el
  comando dos veces.
- **Windows**: los symlinks del repo necesitan `git config core.symlinks true` (+ Developer Mode).
- **Skills por app**: Codex carga `$CWD/.agents/skills` y `$REPO_ROOT/.agents/skills`; Claude Code
  solo el `.claude/skills` del directorio desde donde arrancó. Para las skills de `frontend/`
  (13) o `backend/` (1), arrancá el agente dentro de esa carpeta.
- **`.agents/skills/` también la maneja `autoskills`** vía `skills-lock.json`. Nuestras skills
  (`openspec-*`, `run-app`, `role-*`) no están en el lockfile: no las toques con autoskills ni
  las agregues ahí.
