# Verificación manual — `template-owned-routine-days`

Registro de las tasks **2.7** (migración) y **12.2** (recorridos manuales) para el gate de
`/opsx:verify`. El riesgo declarado en `design.md` es **alto**, así que la QA manual **no se
omite**.

## 2.7 — Migración en desarrollo

Verificada a mano contra el **Postgres real** del stack Docker de desarrollo (no SQLite): el gate
de `/opsx:verify` no corre `alembic upgrade head`, así que una migración rota pasaría `make test`
sin ponerse roja.

Migración: `3887b713f57d_template_owned_routine_days.py`, encadenada a `030412411aba`.

| Tabla | Antes | Después |
|---|---|---|
| `workout_logs` | 0 | 0 |
| `routine_templates` | 4 | 4 |
| `routine_template_days` | 8 | 4 |

`routine_template_days` queda en 4 = un Día 1 por plantilla sobreviviente, con posiciones
contiguas (reparación de I1, no backfill de negocio). Confirmado además que `training_days`,
`training_day_exercises` y la vieja `routine_template_exercises` ya no existen, y que `exercises`
no tiene columnas de base.

`alembic downgrade -1` corre sin excepción, pero es un **no-op real sobre el esquema** (está
documentado así en la migración). Después de ejecutarlo hay que `alembic stamp head` para
resincronizar el puntero de versión con el esquema ya migrado.

## 12.2 — Recorridos manuales

Ejecutados por el rol QA sobre la app corriendo (stack Docker, usuarios de `make seed-dev`).

| Recorrido | Resultado |
|---|---|
| Dueño: crear → Día 1 → grupos musculares → 5 días → buscador → base y estrategia → reordenar → aviso sin guardar → descartar → guardar → recargar | **PASA** |
| Coach sobre plantilla asignada: histórico intacto al quitar ejercicio y al quitar día | **PASA** (a nivel de datos/API; ver limitación abajo) |
| Ejercicio inactivo: sigue en la plantilla y en "Mi rutina", no se ofrece en el buscador | **PASA** |
| Catálogo sin base: ningún formulario de `/exercises` tiene series/reps/kg | **PASA** |
| Producción (Railway) | **NO EJECUTADO** — deliberado, no se toca producción desde el gate |

### Evidencia del invariante I6 (histórico inmune a la edición de la plantilla)

Verificado vía `GET /routines/users/{id}/logs` como Coach, después de cada operación:

- Quitar un **ejercicio** de un día: su log sigue listado, con `day_id` intacto y
  `day_name: "Día 1"`.
- Quitar un **día entero**: el log de ese día pasa a `day_id: null` conservando
  `day_name: "Día 2"`, y sigue consultándose sin error.

Es exactamente lo que piden D3 e I6.

## Defectos encontrados y cómo terminaron

1. **La barra flotante de guardado tapaba el botón "Quitar día"** (plantillas con pocos días, en
   un viewport de laptop). Defecto real y bloqueante: el click no llegaba. **Arreglado** en
   `frontend/src/pages/RoutineTemplateDetail.tsx`.

   La causa no era obvia: `sticky bottom-4` se comporta como `fixed` en cuanto el documento supera
   el viewport, así que **reservar padding al final no lo soluciona** — se probó y se descartó con
   mediciones de `getBoundingClientRect()`. Se resolvió con el patrón que ya usa `ListPageLayout`
   en el repo: franja de contenido con scroll propio (`--list-page-height`) y la barra como ítem
   `shrink-0` fuera del área scrolleable. Verificado en vivo a 700 px de alto.

2. **"Volver a Rutinas" no avisaba de cambios sin guardar** — reportado inicialmente por QA como
   FALLA. **Descartado: era un artefacto de HMR**, no un bug.

   El Dev no logró reproducirlo en más de una decena de variantes. Se dirimió reiniciando el
   contenedor de frontend y reverificando en una pestaña nueva con recarga dura: el diálogo
   apareció correctamente las 4 veces, y el link del Sidebar se comportó igual en esa misma
   sesión. Los logs previos al restart mostraban errores de parseo de Babel por HMR incremental
   sobre `RoutineTemplateDetail.tsx` mientras el Dev lo editaba, y `stores/unsavedChanges.ts` se
   había creado en esa misma sesión. El test de la fase 10 que cubre este escenario estaba bien.

## Limitaciones de cobertura (declaradas, no tapadas)

- **El histórico no se pudo verificar visualmente en la UI.** Las secciones *Seguimiento* y
  *Asistencias*, donde vive el render de esos logs, muestran "TO DO — Esta sección todavía no está
  disponible" en este build. Es una función pendiente **preexistente**, ajena a este change. El
  invariante se verificó por API (ver arriba) y por los tests de `test_member_routine.py`.
- **Producción no se verificó** (ver tabla). La migración en Railway es un paso manual posterior:
  este repo no corre migraciones en el deploy.
- **Quitar un día del borrador no pide confirmación.** El design lo menciona como deseable, pero
  ninguna spec lo exige y nada persiste hasta "Guardar configuración", así que se dejó como está.
  Queda anotado, no arreglado.

## Estado del gate mecánico al cierre

- `make test`: **260 backend + 189 frontend**, todo en verde.
- `make lint`: 0 errores (43 warnings preexistentes, ninguno nuevo).
- `make check-plan CHANGE=template-owned-routine-days`: pasa, `riesgo=alto`, sin `FALLA:`.

## Nota de infraestructura de tests (hallazgo colateral)

SQLite **no aplica las FK actions sin `PRAGMA foreign_keys=ON` por conexión**, y la suite nunca lo
activaba. El invariante I6 (`day_id → NULL` al borrar un día) dependía enteramente de esa acción de
FK: en Postgres siempre funcionó, pero en los tests un borrado de día dejaba el `day_id` colgado en
vez de en `NULL`. O sea que el invariante era **inverificable** por la suite.

Corregido en `backend/tests/conftest.py`, activando el pragma por conexión. El `drop_all`/
`create_all` corre con las FKs apagadas porque el esquema tiene un ciclo real
(`users.membership_plan_id` ↔ `membership_plans.created_by_user_id`) que SQLite no puede ordenar
topológicamente para el `DROP TABLE`, y las vuelve a encender antes del cuerpo del test.
