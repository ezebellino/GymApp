## Why

El design doc (`docs/design/design.md:275`) manda que las acciones por fila sean icon-buttons
`rounded-full` con nombre accesible, y `Users.tsx` ya lo cumple. El resto de las tablas
(`MembershipPlans`, `Exercises`, `Payments`, `MemberTemplatesCard`) mezcla ese patrón con botones
de texto para acciones como Desactivar, Reactivar, Anular, Ajustar base y Quitar. Esto deja la
UI inconsistente entre vistas que resuelven el mismo problema (una acción por fila de tabla) y
retrasa la aplicación de una regla que el proyecto ya adoptó.

## What Changes

- Convertir a icon-button (`rounded-full`, sin texto, con `aria-label`) todas las acciones de fila
  que hoy son botones de texto: Desactivar y Reactivar en `MembershipPlans.tsx` y `Exercises.tsx`,
  Anular en `Payments.tsx`, Ajustar base y Quitar en `MemberTemplatesCard.tsx`, **Borrar en
  `Exercises.tsx`** (acción encontrada durante la verificación de diseño, no estaba en el
  relevamiento inicial pero cae bajo el mismo requirement de identificación por icono), y **Ver en
  `Routines.tsx`** (acción encontrada durante la verificación de QA/Code Reviewer: la tabla de
  plantillas de rutina también tiene una acción de fila con texto, `<Button size="sm">` con
  `aria-label={\`Ver plantilla ${template.name}\`}`, que no estaba en el relevamiento inicial).
- Mapeo icono ↔ acción para las acciones nuevas: Ajustar base → `SlidersHorizontal`,
  Anular/Desactivar → `Ban` (mismo icono para ambas, es la misma operación), Reactivar →
  `RotateCcw`, Quitar/Borrar → `Trash2`.
- **Vocabulario de `Trash2` no se unifica**: "Quitar" (desvincular una asignación de plantilla) y
  "Borrar" (destruir un ejercicio) conservan cada uno su verbo, aunque compartan icono y tinte —
  son operaciones semánticamente distintas y el `aria-label` es lo que las distingue. El diálogo
  de confirmación de ejercicios (`"Borrar ejercicio"`, `confirmLabel="Borrar"`) no cambia de copy:
  acompaña el verbo del botón de fila, como ya lo hace hoy.
- **`MembershipPlans.tsx` "Agregar precio" (`CircleDollarSign`)**: el icono no cambia, pero su
  `aria-label`/`title` se normaliza de `"Agregar precio a ${plan.name}"` a `"Agregar precio"`. El
  requirement de nombre accesible = solo verbo es incondicional para todo icon-button de acción de
  fila, y este ya es un icon-button — no queda excluido.
- Tinte destructivo unificado para `Ban` y `Trash2`
  (`border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20`); el resto
  de los icon-buttons de fila (`Eye`, `PencilLine`, `RotateCcw`, `SlidersHorizontal`,
  `CircleDollarSign`) usan el outline neutro ya existente.
- **BREAKING**: normalizar todo `aria-label` de acción de fila a solo el verbo (`"Ver"`,
  `"Editar"`, `"Desactivar"`, `"Anular"`, `"Reactivar"`, `"Quitar"`, `"Borrar"`, `"Ajustar base"`,
  `"Agregar precio"`), sin el nombre de la entidad. Esto cambia el `aria-label` de los
  icon-buttons que ya existían en `Users.tsx` y `MembershipPlans.tsx` (hoy `"Editar ${plan.name}"`,
  `"Ver perfil de ${user.full_name}"`, `"Agregar precio a ${plan.name}"`), y el de `Routines.tsx`
  (hoy `"Ver plantilla ${template.name}"`), para no dejar dos convenciones de nombre accesible
  conviviendo.
- Actualizar los tests que hoy ubican estas acciones por texto visible o por nombre accesible
  único por fila, dado que con `aria-label` de solo verbo varios botones de una misma columna
  comparten nombre: `MembershipPlans.test.tsx`, `Payments.test.tsx`,
  `MemberTemplatesCard.test.tsx`, `Exercises.test.tsx`, `Routines.test.tsx`.

**Fuera de alcance**: los botones de cabecera de página en `RoutineTemplateDetail.tsx` (icono +
texto) no son acciones de fila y se quedan como están — la regla del design doc aplica a
per-row actions, no a acciones de página. Tampoco es una acción de fila el
`Switch` de `RoutineTemplateDetail.tsx:175` (`aria-label={\`Activar o desactivar
${exercise.name}\`}`): es un control de card, no un botón dentro de `TableRow`, y su
`aria-label` no cambia.

## Capabilities

### New Capabilities

- `data-table-row-actions`: comportamiento observable y verificable de las acciones por fila en
  cualquier tabla del frontend — identificación por icono (no por texto), nombre accesible
  reducido al verbo, toggle de icono según el estado activo/inactivo del registro de la fila
  (Desactivar/Anular ↔ Reactivar), y distinción visual entre acciones destructivas y neutras. No
  existía spec de OpenSpec para esto (`docs/design/design.md` lo menciona como guía visual, pero
  no como requirement verificable); las acciones de cabecera de página quedan explícitamente
  fuera de esta capability.

### Modified Capabilities

Ninguna.

## Impact

- Código: `frontend/src/pages/MembershipPlans.tsx` (incluye normalizar el label de "Agregar
  precio"), `frontend/src/pages/Exercises.tsx` (incluye el botón "Borrar"),
  `frontend/src/pages/Payments.tsx`, `frontend/src/components/MemberTemplatesCard.tsx`,
  `frontend/src/pages/Users.tsx` (solo el `aria-label`, se achica a verbo),
  `frontend/src/pages/Routines.tsx` (acción "Ver" pasa a icon-button `Eye`, tono neutro).
- Tests: `frontend/src/pages/__tests__/MembershipPlans.test.tsx`,
  `frontend/src/pages/__tests__/Payments.test.tsx`,
  `frontend/src/components/__tests__/MemberTemplatesCard.test.tsx` (o ruta equivalente),
  `frontend/src/pages/__tests__/Exercises.test.tsx`,
  `frontend/src/pages/__tests__/Routines.test.tsx`.
- Sin cambios de backend, API ni modelo de datos.

## Preguntas abiertas

- Cuando una columna de acciones tenga más de un icon-button con el mismo `aria-label` posible
  entre filas (ej. "Editar" en cada fila), ¿los tests deben resolver ambigüedad con `getAllByRole`
  + índice de fila, o con un selector adicional (ej. por celda/fila contenedora)? Queda a criterio
  del rol Architect/Dev al definir el detalle de implementación de cada test.
- "Borrar" vs "Quitar"/"Eliminar" como verbos distintos para el mismo icono `Trash2` es la
  decisión de este proposal (no se unifican). Si en el futuro se decide que todo `Trash2` de fila
  debe decir lo mismo, es un change de copy aparte — no bloquea este.
