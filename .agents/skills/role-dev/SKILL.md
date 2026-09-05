---
name: role-dev
description: Rol Dev de Mini Espacio. Usar para implementar las tasks de un change de OpenSpec ya diseñado. Único rol que escribe código de aplicación.
---

# Rol: Dev

Implementás las tasks de un change de OpenSpec. Ver [AGENTS.md](../../../AGENTS.md) y el
`AGENTS.md` de la app que estés tocando.

## Cómo trabajás

1. Leé `proposal.md`, las specs, `design.md` y `tasks.md` antes de la primera línea de código.
   Si no hay `tasks.md`, no implementás: pedí `/opsx:propose` primero.
2. Trabajás **task por task**, marcando `- [x]` a medida que cerrás. No adelantes tasks futuras
   ni agregues features que nadie pidió.
3. Antes de modificar un símbolo existente: `codegraph impact <símbolo>` y `codegraph callers
   <símbolo>`. Te ahorra romper llamadores que no viste.
4. Si el diseño está mal o incompleto, **pará y decilo**. No improvises arquitectura dentro de
   una task; volvé a `role-architect`.

## Reglas duras

- `backend/app/models.py` modificado ⇒ generá la migración Alembic en el mismo cambio
  (comando en `backend/AGENTS.md`) y corré `make migrate`.
- Nombres de código en inglés; strings de UI y mensajes al usuario en español.
- Nunca commitees `.env` reales. Si agregás una variable, va a `.env.example` y
  `.env.docker.example`.
- Seguí el estilo del archivo que estás editando: misma densidad de comentarios, mismos idioms.
- Al terminar, verificá que corre de verdad (skill `run-app`), no solo que compila.
- **Cada fila de la tabla de Tests del `## Plan de verificación`** (`design.md`) es una task
  obligatoria, no una sugerencia: implementá el test exacto (archivo + caso) que declaró
  `role-architect`. No se marca la última task del change sin `make lint`, `make test` y
  `make check-plan CHANGE=<name>` en verde. Si un caso del plan no se puede escribir tal como está
  (el escenario no es reproducible, falta infraestructura, etc.), no lo borres del plan por tu
  cuenta: volvé a `role-architect` para que ajuste el `## Plan de verificación`.
- Si el change toca UI, la verificación con `run-app` se hace **en los tres roles** (Dueño, Coach
  y Miembro) usando el widget de cambio de rol tras `make seed-dev` — no solo en el rol con el que
  ya estabas logueado. Ver la sección "Usuarios de desarrollo" de la skill `run-app`.
