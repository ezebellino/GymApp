# Verificación: add-membership-plans

**Fecha**: 2026-09-11 (tercera pasada)
**Veredicto**: PASA CON RESERVAS
**Diff verificado**: working tree contra `main` (sin commitear), rama `feat/secure-staff-endpoints`
**Riesgo declarado**: alto
**Paso 0**: lint OK · test OK · plan OK

Historial del gate:

| Pasada | Veredicto | Hallazgos |
|---|---|---|
| 1 | FALLA | 1 bloqueante, 2 mayores, 7 menores — cerrados en el grupo 12 de `tasks.md` |
| 2 | FALLA | 1 bloqueante (regresión sobre spec vigente), 4 menores — cerrados en el grupo 13, con decisión D2.2 del arquitecto |
| 3 | **PASA CON RESERVAS** | sin bloqueantes ni mayores; 5 reservas menores, ninguna de comportamiento visible |

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=add-membership-plans` | OK (exit 0, `riesgo=alto`) |
| Lint | `make lint` | OK (ruff limpio; eslint 0 errores / 46 warnings preexistentes; `tsc --noEmit` limpio) |
| Tests | `make test` | OK (backend 188 passed; frontend 29 archivos / 131 passed) |

109/109 tasks en `- [x]`. `openspec validate --strict` válido.

## Escenarios de la spec

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| Activar la membresía de un usuario que nunca fue miembro, eligiendo plan | UI: ficha con `membership_status=none` → "Activar membresía" → selector → confirmar. **Una sola** llamada `POST .../membership/activate` 200 | PASA |
| Mismo camino por API | `POST .../membership/activate {"membership_plan_id": "..."}` → 200 con `membership_status: active` y el plan resuelto en la misma respuesta | PASA |
| Atomicidad: activar con un plan inactivo no deja nada a medias | API: plan desactivado → 400 "El plan indicado está inactivo"; el usuario quedó `none`, sin plan, sin escrituras parciales | PASA |
| Un usuario que ya tiene plan se reactiva sin elegir uno nuevo | API con body `{}` → 200, mismo plan y mismo `plan_since`. UI: el diálogo no muestra selector cuando ya hay plan | PASA |
| Ciclo D2.1 (miembro dado de baja sin plan → "Asignar plan" → reactivar) | UI end-to-end | PASA (sin regresión) |
| I9 — los tres estados de la columna Plan | UI + API: "-" para `none`, "Sin plan" para miembro sin plan, nombre del plan para el resto | PASA (sin regresión) |
| 409 al desactivar el último plan activo | API | PASA (sin regresión) |
| 401 sin sesión / 403 con rol Miembro en endpoints de planes | API | PASA (sin regresión) |
| Fechas sin desfasaje (historial de precios y fila "desde") | UI contra la respuesta real de la API | PASA (sin regresión) |
| Estado de 0 planes activos | I3 impide alcanzarlo sobre una base con datos; cubierto por `CreateUserDialog.test.tsx` y por código | NO VERIFICABLE en vivo |
| Alta de Miembro con plan inactivo | El selector solo lista activos; cubierto por `test_alta_de_miembro_con_plan_inactivo_devuelve_400` | NO VERIFICABLE en vivo |

## QA manual

QA corrida por riesgo alto, sobre el stack Docker con `make seed-dev` y el contenedor `backend`
reiniciado (no corre con `--reload`). El bloqueante de la segunda pasada quedó cerrado en vivo:
el camino "Activar membresía" para un usuario que nunca fue miembro funciona en una sola
operación atómica. Ninguno de los escenarios que ya daban PASA mostró regresión.

Nota: el reporte de QA afirmó que los 4 hallazgos menores de la segunda pasada seguían sin
resolver. Es incorrecto — no estaban en el alcance de su pasada y no los revisó. El Code Reviewer
los verificó uno por uno en el código y los cuatro están cerrados (ver abajo).

## Confirmación de los hallazgos de las pasadas anteriores

| Hallazgo (pasada 2) | Estado | Evidencia |
|---|---|---|
| 1 — bloqueo mutuo para `membership_status = none` | **Cerrado** | `backend/app/routers/users.py:410-457`: las cuatro validaciones ocurren **antes** de cualquier mutación, la primera escritura es `:439` y el único `commit` está en `:455`. `get_db` hace rollback ante excepción. Cubierto por `test_activar_membresia_con_plan_inexistente_no_activa_la_membresia` |
| 2 — `IntegrityError` capturado de más | Cerrado | `membership_plans.py:51-67` inspecciona `e.orig.diag.constraint_name` con fallback por substring, y `update_membership_plan:295` solo lo invoca cuando el payload toca `name` |
| 3 — TOCTOU en la desactivación | Cerrado | `membership_plans.py:346-360` usa `with_for_update()` sobre los ids activos, sin agregación en la misma consulta. En SQLite el dialecto no emite `FOR UPDATE` y el comportamiento single-thread es el de antes; está declarado en el comentario |
| 4 — `assign_plan_to_member` sin `plan_since` | Cerrado en el helper | `backend/tests/helpers.py:102-104`. Ver reserva 1: quedaron cuatro sitios inline del mismo archivo sin migrar |
| 5 — `formatDate` duplicado | Cerrado | `MemberTemplatesCard.tsx` importa el compartido de `lib/utils.ts`; equivalente en comportamiento porque `last_adjustment.at` es un datetime |

Invariantes re-chequeados sin regresión: **I2** (ningún camino deja a alguien activo sin plan;
`UserUpdate` no expone `membership_status`, así que el `PATCH` no es puerta trasera), **I3**,
**I7**, **I8**, **I9**, **I10**, **I11** e **I12** (las tres columnas se escriben juntas en los
tres únicos caminos: `users.py:336-338`, `:439-441` y `:515-517`). Historial de precios
append-only: no existe `PATCH` ni `DELETE` sobre `/{plan_id}/prices`.

El verde en falso de la pasada anterior quedó cerrado:
`frontend/src/components/__tests__/ActivateMembershipDialog.test.tsx:127-139` afirma URL exacta,
body con `objectContaining`, `not.toHaveBeenCalledWith("/users/u-1/plan", ...)` **y**
`toHaveBeenCalledTimes(1)` — esta última es la que rompe si vuelve el encadenado de dos llamadas.

## Hallazgos

Ninguno bloqueante ni mayor. Las cinco reservas, en orden de lo que conviene atender primero:

1. **[menor]** `backend/tests/test_user_plan.py:95,125,188,410` — el hallazgo 4 se cerró en
   `helpers.py`, pero cuatro sitios inline del mismo archivo siguen haciendo
   `member.membership_plan_id = plan["id"]` sin `plan_since`: exactamente la fila que I12 dice que
   ningún camino de la API produce. Un test futuro que afirme `plan_since is not None` va a romper
   por el setup, no por el código. Lo natural es que usen `assign_plan_to_member`.
2. **[menor]** Falta test para el camino "plan inactivo" de `activate_membership`
   (`backend/app/routers/users.py:434-435`). D2.2 lo lista en el contrato y la task 13.2 lo
   implementa, pero el Plan de verificación no nombró un caso. Hoy solo está cubierto el camino
   equivalente de `change_user_plan`. QA sí lo verificó a mano en esta pasada.
3. **[menor]** `backend/app/routers/membership_plans.py:341-344` — el `if not plan.is_active` se
   lee *antes* del `FOR UPDATE`, así que dos `POST /{id}/deactivate` concurrentes sobre el **mismo**
   plan pueden devolver 200 los dos, en vez de un 200 y un 409 "El plan ya está inactivo". Es
   idempotente y no viola I3; solo el código de respuesta es menos fiel.
4. **[menor]** `frontend/src/components/ActivateMembershipDialog.tsx:33` — `hasNoActivePlans` no
   distingue "no hay planes activos" de "la query falló". Con la red caída, el modal muestra "No
   hay planes activos… Ir a Planes" y manda al usuario a una pantalla que tampoco va a cargar. Es
   el patrón heredado de `CreateUserDialog` (hallazgo 8 de la primera pasada), no algo que
   introdujo el grupo 13.
5. **[menor]** Estado tolerado sin documentar: reactivar a un miembro `cancelled` cuyo plan fue
   desactivado después lo deja `active` con un plan inactivo, porque `is_active` solo se chequea en
   la rama de asignación. Es coherente con D2 (desactivar saca el plan del selector, no migra a los
   miembros que ya lo tienen, supuesto S6), pero no está escrito en ningún invariante.

### Incidental, fuera del alcance de este change

Editar un usuario cuyo email en base no tiene formato válido dispara un `422` cuyo `detail` es la
lista de objetos de Pydantic, y `EditUserDialog` la renderiza directo como children de React:
`Objects are not valid as a React child`, pantalla en negro y hay que recargar. No lo introdujo
este change y no toca planes. Merece su propio change.

## Sin verificar

- **Estado de 0 planes activos**: I3 impide alcanzarlo sobre una base con datos. Confirmado por
  código y por `frontend/src/components/__tests__/CreateUserDialog.test.tsx`.
- **Concurrencia real**: el `FOR UPDATE` de la desactivación y la carrera de nombres duplicados se
  razonaron por lectura de código y por tests con monkeypatch, no con requests simultáneas reales.
  En SQLite (la suite) el row locking no existe, así que esa carrera no se reproduce ahí.
- **Alta de Miembro con plan inactivo**: el selector solo lista activos; cubierto por
  `backend/tests/test_user_plan.py::test_alta_de_miembro_con_plan_inactivo_devuelve_400`.
