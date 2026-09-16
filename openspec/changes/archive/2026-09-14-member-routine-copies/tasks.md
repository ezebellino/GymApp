> Orden obligatorio: el repo **no puede quedar a medias** entre el modelo viejo y el nuevo. Cada
> fase deja `make lint` y `make test` en verde antes de pasar a la siguiente; la única excepción
> declarada es la fase 2, que reescribe el backend sobre el modelo nuevo y recién cierra en verde
> al terminar la 3 (los tests viejos que prueban lo retirado se borran **dentro** de la fase que
> retira el código, no después).

## 1. Modelo, módulo compartido de backend y migración

- [x] 1.1 `backend/app/models.py`: crear `RoutineAssignmentDay` (`routine_assignment_days`: `id`,
      `assignment_id` FK CASCADE, `position`, `UNIQUE(assignment_id, position)`),
      `RoutineAssignmentDayMuscleGroup` (PK compuesta `assignment_day_id` + `muscle_group`,
      `sort_order`) y `RoutineAssignmentDayExercise` (`assignment_day_id`, `exercise_id`,
      `sort_order`, `strategy`, `base_sets`/`base_reps`/`base_weight_kg` con las constantes
      `DEFAULT_EXERCISE_BASE_*` como `default=` y `server_default=`, `updated_at`,
      `updated_by_user_id`, `UNIQUE(assignment_day_id, exercise_id)`) — design D1.
- [x] 1.2 `backend/app/models.py`: `RoutineAssignment` — dropear
      `UniqueConstraint(user_id, template_id)`, **conservar intacto** el índice parcial
      `ix_routine_assignments_user_active` (con `postgresql_where` **y** `sqlite_where`), pasar
      `template_id` a nullable con `ondelete="SET NULL"`, agregar `template_name` (NOT NULL) y
      `template_tag` (nullable), agregar `days` con `cascade="all, delete-orphan"`, sacar
      `base_overrides` y poner `passive_deletes=True` en `RoutineTemplate.assignments` — D2 y D2b.
- [x] 1.3 `backend/app/models.py`: crear `WorkoutSetLog` (`workout_set_logs`) con `user_id`,
      `assignment_day_id` FK **`ondelete="SET NULL"` nullable**, `day_name`, `exercise_id`,
      `set_index`, `reps` y `weight_kg` NOT NULL, `note`, `performed_on` (Date, index),
      `performed_at`, `created_by_user_id` y
      `UNIQUE(user_id, assignment_day_id, exercise_id, set_index, performed_on)` — D3.
- [x] 1.4 `backend/app/models.py`: borrar `RoutineAssignmentBase` y `WorkoutLog` enteros, y las
      relaciones que los nombran (`User.workout_logs`, `Exercise.logs`, `WorkoutLog.day`) — D3, D4.
- [x] 1.5 Crear `backend/app/routine_days.py`: una sola implementación del reemplazo completo con
      identidad explícita (validar 1..5 días, `day_id` perteneciente al dueño, orden por índice,
      base por defecto para pares nuevos, base conservada para pares existentes, `strategy` por
      defecto `constant`, ejercicio inactivo no agregable pero conservable) y **un solo**
      serializador de día/ejercicio con `planned_sets`, parametrizados por el descriptor
      `(modelo de día, modelo de grupo muscular, modelo de ejercicio, atributo FK del dueño)` — D8.
- [x] 1.6 Migración Alembic nueva encadenada a `alembic heads` (verificar que hay **una sola**
      cabeza antes de generar), en el orden de D11: drop `workout_logs` → drop
      `routine_assignment_bases` → `DELETE FROM routine_assignments` → sobre `routine_assignments`
      (drop del unique, `add_column` de los dos snapshots, recrear la FK con `SET NULL`,
      `alter_column template_id nullable`) → `create_table` de las tres tablas de la copia con
      `strategy` como `postgresql.ENUM(..., name="progressionstrategy", create_type=False)` (**no**
      `VARCHAR`) → `create_table("workout_set_logs")`. `downgrade()` no-op documentado, y
      `docstring` que declare qué datos se pierden.
- [x] 1.7 **Verificar la migración a mano** — el gate de `/opsx:verify` **no** corre
      `alembic upgrade head`, así que una migración rota pasa `make test` en verde. Con el stack
      Docker en la revision anterior (`make docker-up`), correr `make migrate` y comprobar:
      `alembic heads` con una sola cabeza; existen `routine_assignment_days`,
      `routine_assignment_day_muscle_groups`, `routine_assignment_day_exercises` y
      `workout_set_logs`; **no** existen `workout_logs` ni `routine_assignment_bases`;
      `routine_assignments` vacía, sin `uq_routine_assignments_user_template`, con
      `ix_routine_assignments_user_active` presente y `template_id` nullable; y
      `routine_assignment_day_exercises.strategy` con tipo `progressionstrategy`. Dejar la evidencia
      en el reporte de verificación.

## 2. Backend: copiar, editar la copia, marcar series

- [x] 2.1 `backend/app/schemas.py`: borrar `RoutineAssignmentBaseOverrideIn`,
      `RoutineAssignmentBaseUpdate` y `LastAdjustmentOut`; sacar `base_overrides` de
      `RoutineAssignmentCreate` (**422** si llega, no ignorado) y `adjustments_count` /
      `last_adjustment` de `RoutineAssignmentOut`; `template_id` pasa a `Optional[str]` y
      `template_name` / `template_tag` salen del snapshot — D2b, D4, D6.
- [x] 2.2 `backend/app/schemas.py`: `PlannedSetOut` gana `logged: LoggedSetOut | null`; schemas
      nuevos para la marca (`WorkoutSetMarkIn {weight_kg, reps, note?}`) y para el histórico
      (`WorkoutSetLogOut` con `set_index`, sin `sets_count`); reusar **tal cual**
      `RoutineTemplateDaysUpdate` y su árbol (con `validate_unique_day_ids`) para el `PUT` de la
      copia — D6, D8.
- [x] 2.3 `backend/app/routers/routine_assignments.py`: `create_assignment` **siempre inserta**
      (nunca upsert), valida membresía y rol antes de copiar nada, degrada la Activa previa antes
      del flush, snapshotea `template_name`/`template_tag` y copia días, grupos musculares y
      ejercicios (incluidos los inactivos ya presentes) en un solo `commit()` — D5.
- [x] 2.4 `backend/app/routers/routine_assignments.py`: agregar
      `GET /routines/users/{user_id}/templates/{assignment_id}` (detalle de la copia) y
      `PUT /routines/users/{user_id}/templates/{assignment_id}/days` (guardado por reemplazo
      completo), ambos delegando en `routine_days.py` — D6, D8.
- [x] 2.5 `backend/app/routers/routine_assignments.py`: **borrar** `upsert_assignment_base`,
      `remove_assignment_base`, `_upsert_base_override`, `_resolve_base` y
      `_validate_exercise_in_template`, con sus dos rutas `/bases/{exercise_id}` — D4.
- [x] 2.6 `backend/app/routers/routine_assignments.py`: `get_my_template` lee la **copia** (no la
      plantilla) y adjunta a cada `PlannedSetOut` la marca de **hoy** del mismo `set_index`, solo
      para índices dentro del plan vigente; `list_my_templates` devuelve todas las copias (Activas
      y Alternativas) ordenadas por `created_at desc` — D6, D7, D9.
- [x] 2.7 `backend/app/routers/routines.py`: agregar
      `PUT /routines/my/days/{day_id}/exercises/{exercise_id}/sets/{set_index}` como upsert
      idempotente por `(user, day, exercise, set_index, performed_on=hoy_ar)`, con las tres
      validaciones 400 de D6 (día de una asignación propia — Activa **o** Alternativa; par
      (día, ejercicio) existente; `set_index` dentro de `len(plan_sets(...))` recalculado). **No**
      toca `models.Attendance` — D3, D6.
- [x] 2.8 `backend/app/routers/routines.py`: **borrar** `create_workout_log`, `update_workout_log`,
      `delete_workout_log` y sus espejos `create_my_workout_log`, `update_my_workout_log`,
      `delete_my_workout_log`, junto con el alta automática de `Attendance` que vivía ahí — D6.
- [x] 2.9 `backend/app/routers/routines.py`: `GET /users/{user_id}/logs` y `GET /my/logs` ganan
      `exercise_id`, `from` y `to` (sobre `performed_on`) además de `day_id`, y devuelven marcas de
      serie; agregar `GET /routines/users/{user_id}/logged-exercises` alimentado por el
      **histórico**, no por la copia vigente — D6, D10.
- [x] 2.10 `backend/app/routers/routines.py`: `_get_active_assignment`, `_get_member_day_or_400`,
      `user_routine_overview`, `my_routine_days` y `my_routine_overview` pasan a leer
      `routine_assignment_days`; borrar `_resolve_plan_base` y los serializadores de plan que
      duplicaba (`_serialize_plan_exercise`, `_serialize_plan_day`) en favor de
      `routine_days.py` — D6, D8.
- [x] 2.11 `backend/app/routers/routines.py`: `_collect_progress_snapshot`, `progress-summary` y el
      PDF recalculados en el grano nuevo — `total_volume = Σ reps × weight_kg` (ya no hay
      `sets_count`), `unique_days` sobre `assignment_day_id` no nulos, `improvements` por
      ejercicio comparando peso máximo de la primera y la última sesión — D3.
- [x] 2.12 `backend/app/routers/routine_templates.py`: `_assignment_count` pasa a contar
      `DISTINCT user_id` **con `status = 'active'`**, y el mensaje de rechazo del `DELETE` dice "N
      miembros la tienen asignada como Activa"; `save_template_days` y los serializadores delegan
      en `routine_days.py` (mata el serializador triplicado marcado por el review de
      `template-owned-routine-days`) — D2, D8.
- [x] 2.13 Barrido de huérfanos en `backend/app/`: ninguna referencia viva a `RoutineAssignmentBase`,
      `WorkoutLog`, `sets_count`, `base_overrides`, `adjustments_count` ni a las rutas retiradas
      (incluye `backend/app/routers/exercises.py`, que consulta `WorkoutLog` en `_exercise_in_use`,
      y los comentarios que citan código ya borrado) — I13.

## 3. Backend: tests

- [x] 3.1 `backend/tests/helpers.py`: agregar `assign_template_copy(...)` que llame al **mismo
      camino de copia que el endpoint** (no armar la copia a mano: si el copiado se rompe, los
      tests de progreso tienen que enterarse) y `mark_set(...)`. Sin fixtures `autouse`.
- [x] 3.2 `backend/tests/test_routine_assignments.py`: borrar los casos de ajuste de base y agregar
      `test_asignar_copia_dias_grupos_ejercicios_base_y_estrategia`,
      `test_editar_la_plantilla_origen_no_cambia_la_copia_ya_creada`,
      `test_editar_la_copia_de_un_miembro_no_toca_la_copia_del_otro_ni_la_plantilla`,
      `test_reasignar_la_misma_plantilla_crea_copia_nueva_y_degrada_la_anterior`,
      `test_una_sola_asignacion_activa_por_usuario_con_varias_copias`,
      `test_guardar_la_copia_sin_tocar_un_dia_conserva_su_id_y_sus_marcas`,
      `test_los_endpoints_de_ajuste_de_base_por_cliente_ya_no_existen` y
      `test_agregar_un_ejercicio_a_la_copia_arranca_en_constante_y_3x10x0` — I1..I6.
- [x] 3.3 `backend/tests/test_routine_assignments.py`:
      `test_borrar_la_plantilla_origen_con_solo_copias_alternativas_deja_la_copia_entrenable` —
      borra la plantilla, verifica `template_id IS NULL` (el `SET NULL` **solo se observa** con el
      `PRAGMA foreign_keys=ON` que ya activa `conftest.py`), que `template_name` sigue, que la copia
      conserva sus días y su histórico y que el Miembro puede marcar una serie sobre ella — I16.
- [x] 3.4 `backend/tests/test_routine_templates.py`:
      `test_borrar_una_plantilla_con_una_copia_activa_es_409_y_lo_dice_en_el_mensaje` y
      `test_borrar_una_plantilla_con_solo_copias_alternativas_la_elimina` (dos fixtures distintos:
      uno con copia Activa, otro con la misma copia degradada a Alternativa, para que el par
      distinga la guardia nueva de la vieja) — I16.
- [x] 3.5 Crear `backend/tests/test_workout_set_logs.py` con
      `test_marcar_una_serie_registra_el_peso_y_las_reps_reales`,
      `test_remarcar_la_misma_serie_el_mismo_dia_corrige_en_vez_de_duplicar`,
      `test_marcar_una_serie_mas_alla_de_las_planificadas_es_400`,
      `test_marcar_un_ejercicio_que_no_esta_en_la_copia_es_400`,
      `test_un_miembro_no_puede_marcar_sobre_el_dia_de_otro_miembro`,
      `test_reducir_las_series_conserva_las_marcas_previas_fuera_del_plan_vigente`,
      `test_quitar_un_dia_de_la_copia_deja_las_marcas_con_day_id_nulo_y_day_name`,
      `test_el_plan_del_miembro_trae_marcadas_solo_las_series_de_hoy`,
      `test_un_miembro_sin_asignacion_activa_puede_marcar_sobre_una_alternativa` y
      `test_marcar_una_serie_no_crea_ninguna_asistencia` — I7..I10, I14, I15, I17. En los tres
      últimos, el fixture tiene que **poder** producir rojo: marcas de otra fecha que no deben
      aparecer en el plan de hoy, una copia Alternativa real y única, y una tabla de asistencias
      cuyo conteo se compara antes y después de marcar (no "asserta que está vacía").
- [x] 3.6 `backend/tests/test_member_routine.py`: sacar el alta de logs por staff; agregar
      `test_el_historico_del_miembro_filtra_por_ejercicio_y_periodo` (con registros dentro y
      **fuera** del período y de otro ejercicio, para que el filtro pueda fallar) y
      `test_los_ejercicios_con_registros_incluyen_uno_quitado_de_la_copia`.
- [x] 3.7 `backend/tests/test_roles.py`:
      `test_un_coach_no_tiene_endpoint_para_marcar_series_de_un_miembro` (405/404 sobre las rutas
      retiradas de escritura de logs de staff) — I11, I17.
- [x] 3.8 `backend/tests/test_progress_score.py`:
      `test_el_volumen_total_se_calcula_por_serie_marcada` (dos marcas de la misma serie planificada
      con pesos distintos: el total cambia si alguien reintroduce un factor `sets_count`).
- [x] 3.9 `backend/tests/test_routines_invariants.py`:
      `test_el_ajuste_de_base_por_cliente_no_existe_en_el_modelo_ni_en_la_api` — candado de I13,
      con `RoutineAssignmentBase`, `WorkoutLog` y las rutas `/bases/` en la lista de símbolos
      retirados.
- [x] 3.10 `make test-backend` en verde. `make lint-backend` sin offenses nuevas.

## 4. Frontend: extracción del editor y edición de la copia

- [x] 4.1 Crear `frontend/src/lib/routineDraft.ts` moviendo desde `RoutineTemplateDetail.tsx` el
      `draftReducer`, `DraftDay`/`DraftExercise`, `deriveDraftDays`, `serializeDraft`,
      `toSavePayload`, `dayTitle` y `MAX_DAYS`, sin React — D8.
- [x] 4.2 Crear `frontend/src/components/routine/RoutineDaysEditor.tsx` con `DayCard`, la lista de
      días, la barra de guardado, el diálogo de base, el cálculo de `dirty`, el `beforeunload` y el
      `setDirty` del store global; props `{ detail, onSave, isSaving, saveError }` — D8.
- [x] 4.3 `frontend/src/pages/RoutineTemplateDetail.tsx` queda como cáscara sobre
      `RoutineDaysEditor` (su hero, sus acciones de plantilla, su `useGuardedNavigate`), **sin
      cambio de comportamiento**: `RoutineTemplateDetail.test.tsx` tiene que seguir verde sin
      tocarlo.
- [x] 4.4 `frontend/src/services/routineAssignments.ts` + `.queries.ts` + `queryKeys.ts`: cliente de
      la copia (detalle y `PUT` de días), del marcado por serie, del histórico con filtros y de
      `logged-exercises`; sacar el cliente del ajuste de base.
- [x] 4.5 Crear `frontend/src/pages/MemberRoutineEditor.tsx` (ruta
      `/users/:id/routine/:assignmentId`, `ProtectedRoute roles={["owner","coach"]}`, `lazy()` en
      `App.jsx`), con encabezado "Miembro + `template_name` snapshoteado" y vuelta a la ficha — D10.
- [x] 4.6 `frontend/src/components/MemberTemplatesCard.tsx`: retirar el icon-button
      `SlidersHorizontal`="Ajustar base" y agregar `PencilLine`="Editar" navegando al editor de esa
      copia; borrar `frontend/src/components/AdjustExerciseBaseDialog.tsx` y sus imports — D4, D10.
- [x] 4.7 `frontend/src/components/AssignTemplateDialog.tsx`: sacar `base_overrides` del payload de
      alta — D4.

## 5. Frontend: ejecución del Miembro y vista de Progreso

- [x] 5.1 `frontend/src/pages/UserRoutine.tsx`: cada serie planificada pasa a ser una fila con su
      objetivo y una acción de marcar, con peso y reps **precargados** con lo planificado (o con lo
      ya marcado si la serie tiene `logged`); confirmar dispara el `PUT` idempotente e invalida el
      detalle. Sin acción para una serie extra: la lista **es** `planned_sets` — D9.
- [x] 5.2 `frontend/src/pages/UserRoutine.tsx`: los tabs dejan elegir entre **todas** las copias
      (Activas y Alternativas), con la Activa por defecto y, sin ninguna Activa, la copia más
      reciente; el estado vacío aparece **solo** con cero copias — D9, I15.
- [x] 5.3 `frontend/src/pages/UserRoutine.tsx`: panel "Historial" (colapsado) con las marcas propias
      filtrables por ejercicio, sobre `GET /routines/my/logs` — es la superficie que hace
      consultable el histórico de un ejercicio ya quitado de la copia — D9.
- [x] 5.4 Crear `frontend/src/pages/MemberProgress.tsx` (ruta `/users/:id/progress`,
      `ProtectedRoute roles={["owner","coach"]}`, `lazy()` en `App.jsx`): histórico filtrable por
      ejercicio y período + gráfico de peso máximo por sesión con `recharts` (ya es dependencia, no
      se agrega ninguna), filtro alimentado por `logged-exercises` y por defecto en el último
      ejercicio registrado; vacío explícito si el Miembro no registró nada. Sin ninguna acción para
      marcar series — D10, I11.
- [x] 5.5 `frontend/src/pages/Users.tsx`: `RowActionButton` con `LineChart` y `aria-label`
      exactamente "Progreso", **solo** en la fila de un Miembro, después de Ver y Editar; más el
      acceso equivalente desde la ficha `UserDetail.tsx` — D10.
- [x] 5.6 `frontend/src/types.ts`: retirar `WorkoutLog` y el tipo del ajuste de base; agregar los
      de marca de serie e histórico. `Tracking.tsx` **no se toca** (D10).

## 6. Frontend: tests

- [x] 6.1 `frontend/src/pages/__tests__/UserRoutine.test.tsx`:
      `precarga el peso planificado al marcar una serie`,
      `muestra la serie ya marcada con lo ejecutado y permite corregirla`,
      `ofrece exactamente cuatro acciones de marcar para un plan de cuatro series`,
      `deja elegir y marcar sobre una copia Alternativa aunque no haya ninguna Activa` y
      `muestra el estado vacío solo cuando no hay ninguna copia asignada`. El fixture del
      anteúltimo caso tiene **dos** copias Alternativas y ninguna Activa; el del último devuelve
      lista vacía — así ninguno de los dos pasa por accidente.
- [x] 6.2 Crear `frontend/src/pages/__tests__/MemberProgress.test.tsx` con
      `filtra el histórico por ejercicio` (el fixture trae registros de **dos** ejercicios),
      `ofrece en el filtro un ejercicio que ya no está en la copia` y
      `avisa que el miembro no registró progreso en vez de mostrar tabla y gráfico vacíos`.
- [x] 6.3 Crear `frontend/src/pages/__tests__/MemberRoutineEditor.test.tsx` con
      `guarda los días de la copia con un solo PUT a la asignación` (asertando la URL de la
      asignación, no la de plantillas) y `no deja agregar un sexto día a la copia`.
- [x] 6.4 `frontend/src/pages/__tests__/Users.test.tsx`:
      `expone el icon-button Progreso solo en la fila de un Miembro` — el fixture incluye un Coach,
      para que el test pueda ponerse rojo si el icono se renderiza sin condición.
- [x] 6.5 `frontend/src/components/__tests__/MemberTemplatesCard.test.tsx`:
      `ofrece Editar la copia y ya no ofrece Ajustar base` — con una copia en el fixture y las dos
      aserciones juntas (la positiva es la que garantiza que la fila realmente se renderizó).
- [x] 6.6 `make test-frontend` en verde. `make lint-frontend` (`eslint` + `tsc --noEmit`) sin
      offenses nuevas.

## 7. Seeds, docs y cierre

- [x] 7.1 Revisar `backend/scripts/seed_dev_users.py` y `backend/scripts/seed_dev_exercises.py`: no
      tocan asignaciones ni plantillas, así que **no deberían cambiar** — confirmarlo corriendo
      `make seed-dev` después de migrar y dejarlo dicho, en vez de asumirlo.
- [x] 7.2 `backend/AGENTS.md`: documentar el modelo de la copia (D1, D2b), `routine_days.py` como
      módulo compartido, el grano de `workout_set_logs`, los endpoints retirados y los nuevos, y el
      archivo de tests nuevo.
- [x] 7.3 `frontend/AGENTS.md`: documentar `lib/routineDraft.ts` + `components/routine/
      RoutineDaysEditor.tsx` como editor compartido, las rutas nuevas y qué pantallas existen ahora
      para el Miembro y para el staff.
- [x] 7.4 `docs/producto/09-backlog-mvp.md`: tachar los ítems que este change implementa y completar
      su columna Change (queda pendiente del change anterior, según su verificación).
- [x] 7.5 `make check-plan CHANGE=member-routine-copies`, `make lint` y `make test` en verde, y
      **reasignar a mano** las plantillas a los Miembros desde la UI (las asignaciones viejas se
      descartan en la migración) antes de dar el change por implementado.

## 8. Correcciones del gate de verificación (D13, D14)

Salen del `verification.md` (veredicto FALLA). No reabren ningún requirement: son la forma de
**cumplir** los que ya están escritos.

- [x] 8.1 Backend, previsualización (D13): `schemas.PlannedSetsPreviewOut` +
      `GET /routines/progression/preview` en `backend/app/routers/routines.py`, con
      `dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))]`, params
      `strategy`/`sets` (1..10)/`reps` (1..100)/`weight_kg` (0..500) y respuesta
      `plan_sets(...)`. Sin acceso a la base: el handler no recibe `Session`.
- [x] 8.2 Tests backend de 8.1 en `backend/tests/test_progression.py`:
      `test_la_previsualizacion_devuelve_el_mismo_plan_que_el_guardado` (compara la respuesta del
      endpoint con los `planned_sets` que devuelve el `PUT` de días para la misma tupla — es el
      test que detecta una divergencia, no solo que el endpoint responde),
      `test_la_previsualizacion_le_responde_403_a_un_miembro` y
      `test_la_previsualizacion_rechaza_una_base_fuera_de_rango` (422 con `sets=0` y con
      `sets=999`).
- [x] 8.3 Frontend, cliente de 8.1: `frontend/src/services/progression.ts`
      (`fetchPlannedSetsPreview`) + `progression.queries.ts` (`usePlannedSetsPreviewQuery`, con
      `staleTime: Infinity`) + la key `progression.preview(input)` en `queryKeys.ts` — **el único**
      archivo donde se escribe un string de key.
- [x] 8.4 `frontend/src/components/routine/RoutineDaysEditor.tsx`: la fila de ejercicio consume
      `usePlannedSetsPreviewQuery` con su tupla vigente; en `RESET` se siembra la caché con los
      `planned_sets` del detalle (`queryClient.setQueryData`) para no pedir nada al cargar. En
      vuelo: lista atenuada con `aria-busy="true"` y "Recalculando…". En error: aviso
      "No pudimos recalcular la previsualización" + "Reintentar". Guardar nunca se bloquea.
- [x] 8.5 `frontend/src/lib/routineDraft.ts`: **no** se agrega ninguna acción de plan al reducer;
      `planned_sets` de `DraftExercise` queda documentado como semilla de caché de la tupla
      inicial, y `serializeDraft`/`toSavePayload` siguen sin incluirlo.
- [x] 8.6 Tests frontend de la previsualización:
      `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` →
      `recalcula el plan mostrado al cambiar la estrategia, sin guardar` (el mock del `GET` de
      preview devuelve un plan **distinguible** del inicial y el caso assertea además que no hubo
      `PUT`; si el editor no llama al endpoint, el texto nuevo no aparece y el test falla) y
      `deja guardar aunque la previsualización falle`;
      `frontend/src/pages/__tests__/MemberRoutineEditor.test.tsx` →
      `recalcula el plan de la copia al confirmar una base nueva, sin guardar`.
- [x] 8.7 Backend, grano del puntaje (D14): `_collect_progress_snapshot` calcula `session_count`
      (`performed_on` distintos) y **retira** `unique_days`; `_progress_score` y
      `_motivation_for_metrics` pasan a recibirlo, con `_SCORE_SESSION_GOAL = 4` y umbrales de
      motivación reescalados a 4 y 2 sesiones. `UserProgressSummary` cambia `unique_days` por
      `session_count` y gana `score`. El PDF del backend rotula "SESIONES" y "SERIES" según el
      grano nuevo.
- [x] 8.8 Tests backend de 8.7 en `backend/tests/test_progress_score.py`:
      `test_una_sola_sesion_con_muchas_series_no_satura_el_componente_de_entrenamientos`
      (4 ejercicios × 3 series **el mismo día**: el componente da 10 de 40, no 40 — es el caso que
      distingue el grano viejo del nuevo) y
      `test_cuatro_sesiones_de_una_serie_saturan_el_componente_de_entrenamientos`. Actualizar los
      asserts unitarios existentes de `_progress_score` a la meta nueva.
- [x] 8.9 Frontend de 8.7: `types.ts` (`unique_days` → `session_count`, `+ score`) y
      `frontend/src/components/UserCard.tsx` consume `summary.score` en vez de recalcularlo, con
      las cards "SESIONES / entrenadas" y "SERIES / marcadas". Test
      `usa el puntaje que calcula el servidor en el PDF de progreso` en
      `frontend/src/components/__tests__/UserCard.test.tsx`, con un `score` del mock que la fórmula
      vieja **no** produciría.
- [x] 8.10 `make check-plan CHANGE=member-routine-copies`, `make lint` y `make test` en verde, y
      recorrer a mano las dos filas manuales nuevas del Plan de verificación.

## 9. Hallazgos del `verification.md` fuera de D13/D14

El diagnóstico y la causa raíz de cada uno están en `verification.md`; acá va solo lo que hay que
hacer. Ninguno reabre un requirement: los dos mayores son incumplimientos de requirements ya
escritos.

- [x] 9.1 **Mayor 1 — Progreso filtra en servidor** (`frontend/src/pages/MemberProgress.tsx:80` y
      `:92-99`): `useUserWorkoutLogsQuery(userId, { exercise_id, from, to, limit: 200 })` con los
      tres filtros como **params**, y se borra el `filteredLogs` que filtra en memoria. El
      `exerciseId` inicial deja de derivarse de `logs[0]` (que ya no es "el último registro" sino
      "el último de la ventana filtrada"): sale de `useLoggedExercisesQuery`, que no tiene ventana.
      El gráfico se construye sobre lo que devuelve el servidor.
- [x] 9.2 Tests de 9.1 en `frontend/src/pages/__tests__/MemberProgress.test.tsx`:
      `pide el histórico filtrado al servidor en vez de filtrar en memoria` (assertea la URL/params
      del `GET`) y `encuentra un registro más viejo que la ventana de doscientas marcas`.
      **El fixture del segundo caso tiene que ser MÁS GRANDE QUE LA VENTANA**: el mock responde
      **201+ filas** cuando la request viene sin `exercise_id`, y el registro buscado está **fuera**
      de las 200 más recientes; solo la request **con** `exercise_id` lo devuelve. Con un fixture
      que entre en la ventana, el caso pasa con el código roto y con el sano — que es justo el
      hallazgo que ya se nos escapó dos veces.
- [x] 9.3 **Mayor 2 (backend) — `logged-exercises` del Miembro** (D15):
      `GET /routines/my/logged-exercises` en `backend/app/routers/routines.py`, rol Miembro,
      delegando en `user_logged_exercises(member.id, db)` igual que `my_workout_logs` en
      `user_workout_logs`. Sumar el cliente (`services/routineAssignments.ts` +
      `useMyLoggedExercisesQuery`) y la key `routineAssignments.myLoggedExercises()` en
      `queryKeys.ts`.
- [x] 9.4 Tests de 9.3 en `backend/tests/test_member_routine.py`:
      `test_el_miembro_lista_sus_ejercicios_con_registros_incluido_uno_quitado` (marcar, quitar el
      ejercicio de la copia, y verificar que sigue apareciendo) y
      `test_los_ejercicios_con_registros_del_miembro_no_aceptan_un_user_id_ajeno` (un Miembro
      pidiendo `/users/{otro}/logged-exercises` recibe 403 — el scope `/my` no es un atajo para
      leer a otro, I10).
- [x] 9.5 **Mayor 2 (frontend) — Historial sin ventana**
      (`frontend/src/pages/UserRoutine.tsx:388-405`): el `select` se alimenta de
      `useMyLoggedExercisesQuery()` y no de `allLogs`; el ejercicio elegido viaja como
      `exercise_id` a `useMyWorkoutLogsQuery({ exercise_id })`, y se borra el `filteredLogs` en
      memoria. Actualizar el comentario del panel, que hoy documenta la limitación como si fuera
      inevitable.
- [x] 9.6 Tests de 9.5 en `frontend/src/pages/__tests__/UserRoutine.test.tsx`:
      `ofrece en el Historial un ejercicio sin marcas en las últimas cuarenta` y
      `pide al servidor las marcas del ejercicio elegido en el Historial`.
      **Fixture MÁS GRANDE QUE LA VENTANA**: el mock de `/my/logs` sin `exercise_id` devuelve
      **41+ filas** de otros ejercicios y el ejercicio buscado **no** aparece en ninguna de ellas —
      solo en la respuesta de `/my/logged-exercises` y en la del `GET` con su `exercise_id`. Si el
      ejercicio está en las 40, el caso no puede ponerse rojo con el código actual.
- [x] 9.7 **Menor 3 — upsert a prueba de concurrencia**
      (`backend/app/routers/routines.py:876-897`): envolver el `INSERT` en `try/except
      IntegrityError` con `db.rollback()` y re-lectura de la fila existente para aplicarle la
      corrección. El resultado observable del segundo request es el mismo que el del primero, no un
      500.
- [x] 9.8 Test de 9.7 en `backend/tests/test_workout_set_logs.py`:
      `test_marcar_la_misma_serie_dos_veces_en_paralelo_no_devuelve_500` — simular la carrera
      forzando el `IntegrityError` (insertar la fila en la sesión de test entre el `SELECT` y el
      `INSERT`, o parchear el `first()` para que devuelva `None` la segunda vez); el assert es
      `200` + una sola fila en la tabla con los valores del segundo request.
- [x] 9.9 **Menor 5 — `day_name`** (`backend/app/routers/routines.py:891`): guardar
      `f"Día {day.position}"`, no `day_title(...)` (ver la aclaración agregada a D3).
- [x] 9.10 Test de 9.9 en `backend/tests/test_workout_set_logs.py`:
      `test_el_day_name_guardado_es_la_posicion_sin_los_grupos_musculares`. El fixture usa un día
      con **grupos musculares no vacíos** (`["Pecho"]`): con `muscle_groups: []` las dos
      implementaciones producen el mismo string y el test pasa con el código roto. Revisar además
      el fixture de `test_quitar_un_dia_de_la_copia_deja_las_marcas_con_day_id_nulo_y_day_name`,
      que hoy tiene el mismo punto ciego.
- [x] 9.11 **Menor 6 — key inline** (`frontend/src/services/routineAssignments.queries.ts:69`):
      la invalidación por prefijo usa `queryKeys.routineAssignments.myLogs`; si hace falta un
      prefijo sin `params`, se agrega `myLogsAll()` a `queryKeys.ts` y se invalida con eso.
      Ningún string de key fuera de `queryKeys.ts`.
- [x] 9.12 **Menor 7 — vocabulario de acciones de fila** (`frontend/AGENTS.md:113`): borrar la fila
      `Ajustar base | SlidersHorizontal` (acción retirada por este change) y agregar
      `Progreso | LineChart | neutral | "Progreso"`, alineando la tabla **cerrada** con la delta de
      `data-table-row-actions`. Chequear de paso que la prosa alrededor no siga nombrando el ajuste
      de base.
- [x] 9.13 **Menor 8 — badge vacío** (`frontend/src/pages/MemberRoutineEditor.tsx:94`): renderizar
      el `<Badge>` solo con `template_tag` no vacío, como ya hace `RoutineTemplateDetail`. Test
      `no muestra una etiqueta vacía cuando la plantilla origen no tenía tag` en
      `frontend/src/pages/__tests__/MemberRoutineEditor.test.tsx`, con `template_tag: ""` en el
      fixture.
- [x] 9.14 **Estilo** (sin escenario de falla, del mismo `verification.md`): línea en blanco antes
      del decorador de `mark_set` (`routines.py:834`) y extraer los `muscle_groups` de la línea
      larga que arma el `day_name` (que con 9.9 queda corta igual).
- [x] 9.15 `make check-plan CHANGE=member-routine-copies`, `make lint` y `make test` en verde, y
      recorrer la fila manual de **ejecución a 390 px** del Plan de verificación.
