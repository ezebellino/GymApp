## 1. Preparación

- [x] 1.1 Confirmar el punto de partida: `drop-static-exercise-catalog` aplicado sobre el working
  tree (si está en `git stash`, restaurarlo antes de empezar) y `cd backend && alembic heads`
  devolviendo una sola head, `030412411aba`. Si la head no es esa, ajustar el `down_revision` de la
  task 2.6 a la real antes de escribirla.
- [x] 1.2 Correr `make lint` y `make test` sobre ese punto de partida y anotar el resultado: este
  change no puede empezar desde un repo en rojo, y hay que poder distinguir una falla propia de una
  heredada.
- [x] 1.3 Releer `design.md` §Decisions D1–D13 y el `## Plan de verificación`: las fases 2–12 de
  este archivo son su ejecución literal, y la tabla de tests de ahí es obligatoria (fases 9 y 10).

## 2. Modelo de datos y migración (D1, D3, D5, D7, D12)

- [x] 2.1 En `backend/app/models.py`, agregar las constantes `DEFAULT_EXERCISE_BASE_SETS = 3`,
  `DEFAULT_EXERCISE_BASE_REPS = 10`, `DEFAULT_EXERCISE_BASE_WEIGHT_KG = 0.0` (D5: único lugar del
  backend donde viven esos números).
- [x] 2.2 En `backend/app/models.py`, reescribir `RoutineTemplateDay`: sacar `day_id`, agregar
  `position` con `UniqueConstraint(template_id, position)` y FK `template_id` con
  `ondelete="CASCADE"`; sin columna `name` (el título se deriva de `position`).
- [x] 2.3 En `backend/app/models.py`, agregar `RoutineTemplateDayMuscleGroup`
  (`routine_template_day_muscle_groups`: PK compuesta `(template_day_id, muscle_group)`,
  `sort_order`, FK `ondelete="CASCADE"`), siguiendo el patrón de `ExerciseTrainingType`.
- [x] 2.4 En `backend/app/models.py`, agregar `RoutineTemplateDayExercise`
  (`routine_template_day_exercises`: `id`, `template_day_id`, `exercise_id`, `sort_order`,
  `strategy`, `base_sets`/`base_reps`/`base_weight_kg` NOT NULL con `default`/`server_default` = las
  constantes de 2.1, `updated_at`, `updated_by_user_id`), con
  `UniqueConstraint(template_day_id, exercise_id)` e índice en `exercise_id`.
- [x] 2.5 En `backend/app/models.py`, borrar `TrainingDay`, `TrainingDayExercise` y
  `RoutineTemplateExercise`; borrar `Exercise.base_sets`/`base_reps`/`base_weight_kg`; y cambiar
  `WorkoutLog`: `day_id` nullable con FK a `routine_template_days.id` `ondelete="SET NULL"` +
  `day_name` `String` NOT NULL (D3).
- [x] 2.6 Crear la migración Alembic (`cd backend && alembic revision -m "template owned routine
  days"`), encadenada a la head de 1.1, con el orden de D12: (1) `workout_logs` — drop FK vieja,
  `day_id` nullable, `add_column day_name` y `DELETE FROM workout_logs`; (2) drop de
  `routine_template_exercises` y `training_day_exercises`; (3) drop + recreate de
  `routine_template_days` y create de las dos tablas nuevas; (4) drop de `training_days`; (4bis)
  `drop_column` de las tres columnas de base en `exercises`; (5) FK nueva de `workout_logs.day_id`
  con `ondelete="SET NULL"`; (6) insertar un `routine_template_days(position=1)` por plantilla
  existente (reparación de I1, no backfill de negocio); (7) `downgrade()` no-op documentado. El
  docstring declara explícitamente que se borran todos los `workout_logs`.
- [x] 2.7 Verificar la migración **a mano**: `make migrate` (o Docker) sobre una base de desarrollo
  con datos, y `alembic downgrade -1` sin excepción. El gate de `/opsx:verify` **no** corre
  `alembic upgrade head`: una migración rota pasa `make test` sin ponerse roja. Dejar anotado el
  `count(*)` de `workout_logs`, `routine_templates` y `routine_template_days` antes y después.

## 3. Backend — contrato de plantillas (D5, D6, D8, D9)

- [x] 3.1 En `backend/app/schemas.py`: `RoutineTemplateCreate` y `RoutineTemplateUpdate` quedan en
  `{name, tag}` (se retira `day_ids`, sin ignorarlo: un payload con `day_ids` es 422).
- [x] 3.2 En `backend/app/schemas.py`, agregar los schemas del guardado del borrador:
  `RoutineTemplateDaysUpdate` (`days: list[...]` con `min_length=1`, `max_length=5`),
  `RoutineTemplateDayInput` (`day_id: str | None`, `muscle_groups: list[MuscleGroup]` deduplicado y
  posiblemente vacío, `exercises: list[...]`) y `RoutineTemplateDayExerciseInput`
  (`exercise_id`, `strategy` opcional, `base` opcional), con la validación de `exercise_id` sin
  repetir dentro de un mismo día.
- [x] 3.3 En `backend/app/schemas.py`, actualizar los schemas de salida (`RoutineTemplateDayOut`,
  `RoutineTemplateExerciseOut`, `RoutineTemplateDetail`): `name` derivado de `position`,
  `muscle_groups` desde la tabla hija, `exercises` ordenados por `sort_order`, sin `is_active` por
  ejercicio. Retirar `RoutineTemplateExerciseUpdate`.
- [x] 3.4 En `backend/app/routers/routine_templates.py`, hacer que `POST /routines/templates` cree
  la plantilla **y** su `routine_template_days(position=1)` en la misma transacción (I1 desde el
  `INSERT`), y que `PATCH` solo toque `name`/`tag`.
- [x] 3.5 En `backend/app/routers/routine_templates.py`, implementar
  `PUT /routines/templates/{template_id}/days` (Dueño/Coach) como reemplazo completo con identidad
  explícita: `day_id` presente ⇒ conserva la fila (I2), `null` ⇒ día nuevo, día de otra plantilla
  ⇒ 400, día ausente del payload ⇒ borrado con cascade; posiciones = índice + 1, `sort_order` =
  índice; un solo `commit()` (I11). Responde el `RoutineTemplateDetail` recalculado.
- [x] 3.6 En el mismo endpoint, aplicar las reglas de base y estrategia: par nuevo sin `base` ⇒ las
  constantes de 2.1 (I5), par existente sin `base` ⇒ conserva la suya, `strategy` ausente en un par
  nuevo ⇒ `constant`; y la regla de D9: `Exercise.is_active` se exige solo para pares **nuevos**
  (400 si es inactivo), un par ya existente sobrevive aunque el ejercicio esté inactivo (I10).
- [x] 3.7 En `backend/app/routers/routine_templates.py`, borrar
  `PUT /routines/templates/{id}/days/{day_id}/exercises/{exercise_id}` (el autosave del switch y de
  los chips) y los predicados `_resolve_exercise_config` y `_offered_as_new_option`; el cálculo de
  `planned_sets` del detalle pasa a leer la base propia del par.

## 4. Backend — asignaciones y vista del Miembro (D3, D4, D10)

- [x] 4.1 En `backend/app/routers/routine_assignments.py`, cambiar `_resolve_base` para que reciba
  la fila de `routine_template_day_exercises` en vez del `Exercise`: precedencia "ajuste por cliente
  si existe, si no la base propia del par".
- [x] 4.2 En `backend/app/routers/routine_assignments.py`, reescribir
  `_validate_exercise_in_template` contra `routine_template_day_exercises` de los días de la
  plantilla (ya no `TrainingDayExercise`), y `_get_template_with_days` con los `joinedload` nuevos.
- [x] 4.3 En `backend/app/routers/routine_assignments.py`, simplificar
  `GET /routines/my/templates/{assignment_id}`: sin `configs_by_key` ni predicados de fallback —
  días de la plantilla, ejercicios por `sort_order`, base resuelta y `plan_sets(strategy, ...)`
  (I7, I8). `routine_assignment_bases` no se toca (D4).
- [x] 4.4 En `backend/app/routers/routines.py`, reescribir `GET /routines/users/{id}/overview`,
  `GET /routines/my/days` y `GET /routines/my/overview` sobre la asignación **Activa** del Miembro
  (lista vacía con 200 si no hay ninguna, aunque tenga Alternativas) — sin ningún `assignment_id` en
  el contrato (D10).
- [x] 4.5 En `backend/app/routers/routines.py`, reescribir los endpoints de logs
  (`GET/POST/PATCH/DELETE` de `/users/{id}/logs` y `/my/logs`): el día es un
  `routine_template_days` de **alguna** asignación del Miembro, el ejercicio tiene que estar en ese
  día (400 si no, I12) y el alta completa `day_name` con `"Día {position}"` (D3).
- [x] 4.6 En `backend/app/routers/routines.py`, actualizar `progress-report` (PDF) y
  `progress-summary`: nombre del día desde `log.day_name`, `unique_days` contando `day_id` distintos
  **no nulos**, y `active_assignment: {assignment_id, template_name} | null` en la respuesta de
  `progress-summary` (requirement "el overview y el progreso siguen la asignación Activa").

## 5. Backend — retiro del catálogo global y de la base del catálogo (D2, D7)

- [x] 5.1 Borrar `backend/app/routine_catalog.py`.
- [x] 5.2 En `backend/app/routers/routines.py`, borrar `ensure_training_days` y sus call sites,
  `_day_ids_for_muscle_group`, `sync_exercise_day_links`, `_serialize_day`,
  `_serialize_manage_exercise` y `_get_day_or_404`.
- [x] 5.3 En `backend/app/routers/routines.py`, retirar `GET /routines/catalog`,
  `GET /routines/days`, `GET /routines/exercises` y `PUT /routines/exercises/{id}` (este último
  **sin reemplazo**: el catálogo deja de tener base editable).
- [x] 5.4 En `backend/app/routers/exercises.py`, sacar los imports de `routines.py`
  (`ensure_training_days`, `sync_exercise_day_links`) y sus llamadas en `create_exercise` /
  `update_exercise`, dejando el router del catálogo sin ninguna dependencia hacia el de rutinas
  (I9). El contrato de `POST /exercises/` y `PATCH /exercises/{id}` no cambia.
- [x] 5.5 En `backend/app/schemas.py`, borrar `RoutineCatalogGroup`, `RoutineCatalogExercise`,
  `RoutineExerciseOption`, `RoutineExerciseManageOut`, `RoutineExerciseUpdate` y `RoutineDayOut`.
- [x] 5.6 `grep -rn "training_day\|routine_catalog\|base_sets" backend/app` y confirmar que no
  queda ninguna referencia viva (I9).

## 6. Seeds y scripts (D12)

- [x] 6.1 En `backend/scripts/seed_dev_exercises.py`, sacar `_DEFAULT_BASE` y las claves
  `base_sets`/`base_reps`/`base_weight_kg` de las ~52 entradas de `EXERCISE_LIBRARY` y del `insert`;
  el resto del seed (id, nombre, grupo muscular) no cambia.
- [x] 6.2 Verificar que `backend/scripts/seed_dev_users.py` sigue sin tocar días ni plantillas y que
  `make seed-dev` y `make seed-dev-exercises` corren sin error sobre la base ya migrada.

## 7. Frontend — servicios, tipos y diálogos (D5, D6, D8)

- [x] 7.1 En `frontend/src/types.ts`, sacar `base_sets`/`base_reps`/`base_weight_kg` de `Exercise` y
  actualizar los tipos de día/ejercicio de plantilla (día con `day_id`, `position`,
  `muscle_groups`, `exercises` con `base` y `strategy`, sin `is_active`).
- [x] 7.2 En `frontend/src/services/routineTemplates.ts`: declarar `DEFAULT_EXERCISE_BASE`
  (3 / 10 / 0, espejo de conveniencia de la constante del backend, D5); borrar
  `updateRoutineExerciseBase`, `updateRoutineTemplateExercise` y `fetchTrainingDays`; agregar
  `saveRoutineTemplateDays` contra el `PUT` de la task 3.5.
- [x] 7.3 En `frontend/src/services/routineTemplates.queries.ts` y `services/queryKeys.ts`: borrar
  `useTrainingDaysQuery` y sus keys; agregar la mutation de guardado que escribe la respuesta en
  `queryKeys.routineTemplates.detail` e invalida `routineAssignments.all`.
- [x] 7.4 Simplificar `frontend/src/components/CreateRoutineTemplateDialog.tsx` y
  `EditRoutineTemplateDialog.tsx`: solo nombre y etiqueta, sin selector de días.
- [x] 7.5 Reemplazar `frontend/src/components/EditExerciseBaseDialog.tsx` por un editor de base
  **del borrador** (sin request, despacha al reducer de 8.1) y adaptar
  `frontend/src/components/StrategyChips.tsx` para que despache al reducer en vez de autosalvar.
  (`StrategyChips.tsx` ya era agnóstico de la mutación — su `onChange` no cambió de forma, el
  cambio está en qué hace el caller con él, en `RoutineTemplateDetail.tsx`.)

## 8. Frontend — detalle de plantilla, borrador y vistas del Miembro (D8, D10, D11)

- [x] 8.1 En `frontend/src/pages/RoutineTemplateDetail.tsx`, montar el `useReducer` del borrador
  (estado inicial derivado del detalle de React Query, snapshot original guardado, `dirty` por
  comparación serializada) con las acciones de agregar/quitar día, editar sus grupos musculares,
  agregar/quitar/reordenar ejercicios y editar base y estrategia.
- [x] 8.2 En la misma página, renderizar los días como "Día N - <grupos musculares unidos por />",
  con el multi-select de `MuscleGroup`, el botón de agregar día deshabilitado en 5 y el de quitar
  deshabilitado cuando queda uno solo.
- [x] 8.3 En la misma página, implementar el buscador del día contra
  `GET /exercises/?q=&is_active=true&limit=` (reusando `services/exercises.ts` y `useDebounce`),
  excluyendo en el cliente los ejercicios ya presentes **en el borrador** de ese día y mostrando
  nombre, grupo muscular y tipos de entrenamiento, con estado vacío "sin resultados" (D8).
- [x] 8.4 En la misma página, cada ejercicio como card con botón trash, control de reordenamiento y
  la base pintada con `DEFAULT_EXERCISE_BASE` cuando recién se agrega.
- [x] 8.5 Agregar `frontend/src/stores/unsavedChanges.ts` (zustand, patrón de `stores/session.ts`) y
  el hook `useGuardedNavigate()` que abre `ConfirmActionDialog` ("Descartar y salir" / "Seguir
  editando") cuando el borrador está sucio; cablearlo en el botón "Volver a Rutinas" de la página y
  en los links de `frontend/src/components/Sidebar.tsx`, más un `beforeunload` (D11).
- [x] 8.6 Cablear los botones "Guardar" y "Descartar" del detalle: guardar usa la mutation de 7.3 y
  reinicia el snapshot; descartar resetea el reducer sin pegar ningún request.
- [x] 8.7 Actualizar `frontend/src/pages/UserRoutine.tsx` y `components/MemberTemplatesCard.tsx` para
  el contrato nuevo de días/ejercicios de la plantilla asignada, y
  `frontend/src/components/UserCard.tsx` para mostrar "Sin plantilla activa" cuando
  `progress-summary` devuelve `active_assignment: null` (task 4.6).
  (`UserRoutine.tsx`/`MemberTemplatesCard.tsx` no consumían `is_active` ni ningún campo retirado
  del contrato — verificado con `tsc`, sin cambios de código necesarios. `types.ts` suma
  `ActiveAssignmentRef`/`UserProgressSummary.active_assignment`, y `UserCard.tsx` lo pinta en el
  PDF de progreso, único lugar que muestra ese resumen.)
- [x] 8.8 Limpiar los mocks de `/routines/days` en `frontend/src/pages/__tests__/Routines.test.tsx`
  y cualquier otro test que mockee endpoints retirados, para que `make test-frontend` no quede
  verde por un mock que ya no existe en la app.

## 9. Tests de backend (Plan de verificación)

- [x] 9.1 En `backend/tests/helpers.py`, agregar `create_template_with_days(db_session, *, name,
  days=[...])` (plantilla + días + grupos musculares + ejercicios con base y estrategia) y en
  `backend/tests/conftest.py` la fixture **opt-in** `template_with_days`; ninguna fixture `autouse`
  (D13).
- [x] 9.2 `backend/tests/test_routine_templates.py`: `test_crear_plantilla_solo_con_nombre_y_etiqueta_nace_con_el_dia_1`,
  `test_crear_plantilla_con_day_ids_en_el_payload_es_422`.
- [x] 9.3 `backend/tests/test_routine_templates.py`: `test_guardar_el_borrador_persiste_dias_grupos_y_ejercicios_en_un_solo_request`,
  `test_guardar_un_sexto_dia_es_422_y_no_persiste_nada`,
  `test_guardar_cero_dias_es_422_y_la_plantilla_conserva_sus_dias`.
- [x] 9.4 `backend/tests/test_routine_templates.py`: `test_un_dia_que_no_cambia_conserva_su_id_entre_guardados`,
  `test_quitar_un_dia_elimina_sus_grupos_musculares_y_sus_ejercicios`,
  `test_quitar_un_dia_intermedio_renumera_las_posiciones_de_forma_contigua`,
  `test_editar_un_dia_de_una_plantilla_no_toca_los_dias_de_otra`.
- [x] 9.5 `backend/tests/test_routine_templates.py`: `test_agregar_un_ejercicio_arranca_en_3x10_0kg_y_estrategia_constante`,
  `test_editar_la_base_de_un_ejercicio_de_un_dia_no_toca_la_del_mismo_ejercicio_en_otro_dia`,
  `test_el_mismo_ejercicio_en_dos_plantillas_mantiene_bases_y_estrategias_independientes`.
- [x] 9.6 `backend/tests/test_routine_templates.py`: `test_el_orden_de_los_ejercicios_del_payload_se_persiste_como_sort_order`,
  `test_repetir_un_ejercicio_dentro_del_mismo_dia_es_422`,
  `test_guardar_un_dia_que_es_de_otra_plantilla_es_400`,
  `test_agregar_un_ejercicio_inactivo_es_400_pero_el_ya_agregado_sigue_en_el_detalle`,
  `test_un_coach_puede_guardar_el_borrador_y_un_miembro_recibe_403`.
- [x] 9.7 `backend/tests/test_exercises.py`: `test_el_catalogo_de_ejercicios_ya_no_expone_ni_acepta_una_base`;
  y sacar los `base_*` de los payloads existentes de ese archivo.
- [x] 9.8 Borrar `backend/tests/test_exercise_base.py` (sus 6 casos son sobre la base del catálogo,
  retirada en este change; lo que sigue vivo quedó cubierto por 9.5).
- [x] 9.9 `backend/tests/test_member_routine.py`: `test_mi_rutina_muestra_solo_los_dias_y_ejercicios_de_la_plantilla_asignada`,
  `test_un_ejercicio_quitado_del_dia_desaparece_del_plan_pero_sus_logs_siguen_consultables`,
  `test_quitar_un_dia_deja_sus_logs_con_day_id_nulo_y_conserva_el_nombre_del_dia`,
  `test_un_cambio_del_coach_en_la_plantilla_se_ve_en_el_siguiente_request_del_miembro`.
- [x] 9.10 `backend/tests/test_member_routine.py`: `test_mis_dias_sin_asignacion_activa_devuelve_lista_vacia_con_200`,
  `test_el_overview_del_miembro_cuenta_los_ejercicios_del_dia_de_su_plantilla`,
  `test_el_overview_sigue_la_asignacion_activa_aunque_haya_una_alternativa`,
  `test_el_progress_summary_sin_asignacion_activa_lo_indica_en_vez_de_usar_la_alternativa`.
- [x] 9.11 `backend/tests/test_member_routine.py`: `test_registrar_un_log_contra_un_dia_de_otra_plantilla_es_400`,
  `test_registrar_un_log_contra_un_ejercicio_que_no_esta_en_el_dia_es_400`.
- [x] 9.12 `backend/tests/test_routine_assignments.py`: `test_el_ajuste_de_base_por_cliente_pisa_la_base_propia_de_la_plantilla`,
  `test_quitar_de_la_plantilla_un_ejercicio_con_ajuste_conserva_la_asignacion_y_el_historico`,
  `test_ajustar_la_base_de_un_ejercicio_que_no_esta_en_la_plantilla_es_400`.
- [x] 9.13 Renombrar `backend/tests/test_routines_seed.py` a
  `backend/tests/test_routines_invariants.py` (conservando solo el test estructural del import) y
  escribir `test_ningun_modulo_de_app_importa_el_catalogo_global_de_dias`,
  `test_los_endpoints_retirados_del_catalogo_global_devuelven_404` y
  `test_el_endpoint_de_base_del_catalogo_devuelve_404`.
- [x] 9.14 `make test-backend` en verde.

## 10. Tests de frontend (Plan de verificación)

- [x] 10.1 `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx`:
  `agrega un día al borrador y lo envía en un solo guardado`, `no deja agregar un sexto día`,
  `no deja quitar el último día`,
  `muestra el título del día como Día N con sus grupos musculares unidos por barra`.
- [x] 10.2 `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx`:
  `el buscador no ofrece un ejercicio ya agregado a ese día`,
  `el buscador avisa cuando no hay resultados`,
  `quita un ejercicio del día con el botón de papelera`.
- [x] 10.3 `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx`:
  `muestra 3x10 y 0 kg en un ejercicio recién agregado al día`,
  `edita la base de un ejercicio del día en el borrador y la manda en el guardado`.
- [x] 10.4 `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx`:
  `avisa que hay cambios sin guardar al intentar volver a Rutinas`,
  `descarta el borrador y deja la plantilla como estaba`.
- [x] 10.5 Crear `frontend/src/components/__tests__/CreateRoutineTemplateDialog.test.tsx` con
  `crea una plantilla pidiendo solo nombre y etiqueta`.
- [x] 10.6 `frontend/src/pages/__tests__/UserRoutine.test.tsx`:
  `muestra solo los días de la plantilla asignada`,
  `no muestra un ejercicio que ya no está en el día de la plantilla`.
- [x] 10.7 `make test-frontend` y `make lint-frontend` (eslint + `tsc --noEmit`) en verde: `tsc` es
  lo que detecta cualquier consumidor huérfano de los endpoints retirados.

## 11. Documentación

- [x] 11.1 Actualizar `backend/AGENTS.md`: modelo de rutinas (días propios de la plantilla, sin
  catálogo global ni base en `Exercise`), endpoints retirados y el nuevo `PUT .../days`, el archivo
  de tests renombrado (`test_routines_invariants.py`), el borrado de `test_exercise_base.py` y el
  cambio en `seed_dev_exercises.py`.
- [x] 11.2 Actualizar `frontend/AGENTS.md`: el detalle de plantilla pasa de autosave a borrador con
  guardado explícito, el store `unsavedChanges` + `useGuardedNavigate`, y los tests nuevos.
- [x] 11.3 Revisar si `AGENTS.md` raíz o `docs/producto/09-backlog-mvp.md` mencionan el catálogo
  global de días o la base del catálogo, y corregirlo si es así.

## 12. Verificación final

- [x] 12.1 `make lint` y `make test` en verde, y `make check-plan CHANGE=template-owned-routine-days`
  sin `FALLA:`.
- [x] 12.2 Ejecutar los recorridos `manual` de la tabla del `## Plan de verificación`: migración en
  desarrollo, recorrido de Dueño (crear plantilla → Día 1 → grupos musculares → 5 días → buscador →
  base y estrategia → reordenar → aviso de cambios sin guardar → descartar → guardar → recargar),
  recorrido de Coach sobre plantilla asignada (histórico intacto al quitar ejercicio y al quitar
  día), catálogo sin base, y ejercicio inactivo.
- [x] 12.3 Dejar anotado en el change el resultado de 2.7 y 12.2 para el gate de `/opsx:verify`
  (riesgo **alto**: QA manual no se omite).
