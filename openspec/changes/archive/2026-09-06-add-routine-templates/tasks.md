## 1. Modelo de datos y migración

- [x] 1.1 En `backend/app/models.py`, agregar los enums `ProgressionStrategy` (`constant`,
      `pyramid`, `inverted`, `drop_set`, `rest_pause`) y `RoutineAssignmentStatus` (`active`,
      `alternative`), junto a los enums existentes (design D4, D6).
- [x] 1.2 En `backend/app/models.py`, agregar a `Exercise` las columnas `base_sets` (Integer, NOT
      NULL, default 3), `base_reps` (Integer, NOT NULL, default 10) y `base_weight_kg` (Float, NOT
      NULL, default 0) (design D3).
- [x] 1.3 En `backend/app/models.py`, agregar `RoutineTemplate` (`routine_templates`: `id`, `name`,
      `name_normalized` NOT NULL con `UniqueConstraint`, `tag`, `created_at`, `updated_at`,
      `created_by_user_id` → `users.id` SET NULL) (design D1).
- [x] 1.4 Agregar `RoutineTemplateDay` (`routine_template_days`: `template_id` CASCADE, `day_id` →
      `training_days.id` CASCADE, `position`, `UniqueConstraint(template_id, day_id)`) (design D1).
- [x] 1.5 Agregar `RoutineTemplateExercise` (`routine_template_exercises`: `template_id` CASCADE,
      `day_id` CASCADE, `exercise_id` CASCADE, `is_active`, `strategy`, `updated_at`,
      `updated_by_user_id`, `UniqueConstraint(template_id, day_id, exercise_id)`), **sin** FK a
      `routine_template_days` ni a `training_day_exercises` (design D2, invariantes I1/I9).
- [x] 1.6 Agregar `RoutineAssignment` (`routine_assignments`: `user_id` RESTRICT, `template_id`
      RESTRICT, `status`, `starts_on`, `created_at`, `created_by_user_id`,
      `UniqueConstraint(user_id, template_id)`) más el índice único parcial
      `ix_routine_assignments_user_active` sobre `user_id` con `postgresql_where` **y**
      `sqlite_where` = `status = 'active'` (design D6, invariante I2).
- [x] 1.7 Agregar `RoutineAssignmentBase` (`routine_assignment_bases`: `assignment_id` CASCADE,
      `exercise_id` CASCADE, `sets`, `reps`, `weight_kg`, `adjusted_by_user_id` SET NULL,
      `adjusted_at`, `UniqueConstraint(assignment_id, exercise_id)`) (design D7).
- [x] 1.8 En `backend/app/routine_catalog.py`, agregar `base_sets` / `base_reps` /
      `base_weight_kg` a cada entrada de `EXERCISE_LIBRARY` (valores del prototipo para los
      equivalentes directos de `docs/propuestas/rutinas-descripcion-funcional.md` §5.2, y una base
      razonable para el resto).
- [x] 1.9 En `_ensure_seed_data` (`backend/app/routers/routines.py`), pasar la base del catálogo
      **solo al crear** un `Exercise` que no existía. No modificar la base de ejercicios ya
      creados y no tocar nada más de esa función (design D3).
- [x] 1.10 Generar la migración con `python -m alembic revision --autogenerate -m "add routine
      templates"` desde `backend/` y revisarla a mano: tipos enum, las cinco tablas nuevas, las
      tres columnas de `exercises` con `server_default`, el índice único de `name_normalized` y el
      índice único parcial de asignación activa.
- [x] 1.11 En esa migración, agregar el backfill de bases de los ejercicios seedeados con una
      **tabla estática copiada dentro del archivo** (sin importar `routine_catalog.py`), y
      completar el `downgrade` para que borre índices, columnas, tablas y **los dos tipos enum**
      (design D14).
- [x] 1.12 Correr `make migrate` en local y verificar `alembic upgrade head` + `alembic downgrade
      -1` + `upgrade head` contra Postgres (`make docker-up`), sin errores.

## 2. Motor de progresión

- [x] 2.1 Crear `backend/app/progression.py` con las constantes del sistema (`ROUND_STEP_KG`,
      `PYRAMID_RATE`, `INVERTED_RATE`, `INVERTED_REPS_STEP`, `MIN_REPS_PYRAMID`,
      `MIN_REPS_REST_PAUSE`, `MIN_WEIGHT_KG`, `DROP_SET_WEIGHT_FACTOR`, `DROP_SET_REPS_FACTOR`,
      `REST_PAUSE_SECONDS`) y el helper de redondeo half-up con `Decimal` (design D4). Sin imports
      de SQLAlchemy ni FastAPI.
- [x] 2.2 En el mismo módulo, implementar el dataclass `PlannedSet` (`index`, `weight_kg`, `reps`,
      `note`) y `plan_sets(strategy, *, sets, reps, weight_kg) -> list[PlannedSet]` con las cinco
      estrategias de la spec `progression-strategies`.
- [x] 2.3 Implementar los pisos que fija la spec: Pirámide `max(R − 2i, 3)`, Rest-pause
      `max(R − i, 1)`, Invertida peso `max(redondeado, 2,5 kg)`, Drop set `1,5 × R` con
      `ROUND_HALF_UP`; y `sets <= 0` → lista vacía.
- [x] 2.4 Crear `backend/tests/test_progression.py` con
      `test_constante_repite_la_base_en_todas_las_series`,
      `test_piramide_press_banca_4x8_45kg`,
      `test_piramide_sentadilla_5x5_70kg_respeta_el_piso_de_reps`,
      `test_piramide_dominadas_4x6_20kg` y `test_piramide_aperturas_3x12_14kg`, con los valores
      exactos de los escenarios de la spec.
- [x] 2.5 En el mismo archivo, agregar `test_invertida_press_banca_4x8_45kg`,
      `test_invertida_aperturas_3x12_14kg` y `test_invertida_respeta_el_piso_de_2_5_kg`
      (base 10×5 · 2,5 kg, última serie en 2,5 kg).
- [x] 2.6 En el mismo archivo, agregar `test_drop_set_marca_al_fallo_la_ultima_serie`,
      `test_drop_set_redondea_para_arriba_las_reps_con_r_impar` (base 4×7 · 50 kg → última
      40 kg × 11), `test_rest_pause_anota_la_pausa_desde_la_segunda_serie` y
      `test_rest_pause_respeta_el_piso_de_una_repeticion` (base 5×4 · 20 kg → 4, 3, 2, 1, 1).
- [x] 2.7 En el mismo archivo, agregar `test_el_redondeo_de_medio_paso_va_para_arriba` (el caso
      que `round()` de Python resolvería con banker's rounding).
- [x] 2.8 Correr `make test-backend` y dejar `test_progression.py` en verde antes de seguir.

## 3. Base del ejercicio en el flujo existente del catálogo

- [x] 3.1 En `backend/app/schemas.py`, agregar `base_sets` / `base_reps` / `base_weight_kg` a
      `RoutineExerciseCreate` (opcionales, defaults 3 / 10 / 0), a `RoutineExerciseUpdate`
      (opcionales, sin default) y a `RoutineExerciseManageOut`, con validación `sets ≥ 1`,
      `reps ≥ 1`, `weight_kg ≥ 0` (design D3).
- [x] 3.2 En `backend/app/routers/routines.py`, hacer que `create_routine_exercise` asigne los tres
      campos y que `_serialize_manage_exercise` los devuelva. **No** cambiar el rol requerido
      (`require_role(UserRole.owner)`) ni nada más de esos endpoints.
- [x] 3.3 Verificar que `update_routine_exercise` no necesita cambios más allá del schema (ya hace
      `model_dump(exclude_unset=True)` + `setattr`), y dejarlo documentado con un comentario corto.
- [x] 3.4 Crear `backend/tests/test_exercise_base.py` con `test_crear_un_ejercicio_indicando_su_base`,
      `test_crear_un_ejercicio_sin_base_usa_el_default_3x10_0kg`,
      `test_editar_la_base_de_un_ejercicio_existente` y `test_una_base_invalida_es_rechazada`
      (422).

## 4. API: plantillas (Dueño/Coach)

- [x] 4.1 Agregar al final de `backend/app/schemas.py`, en un bloque delimitado por comentario, los
      schemas de plantilla: `PlannedSetOut`, `RoutineTemplateExerciseOut`,
      `RoutineTemplateExerciseUpdate`, `RoutineTemplateDayOut`, `RoutineTemplateSummary`,
      `RoutineTemplateDetail`, `RoutineTemplateCreate` (con `day_ids` de longitud mínima 1) y
      `RoutineTemplateUpdate` (design D10).
- [x] 4.2 Crear `backend/app/routers/routine_templates.py` con `router =
      APIRouter(prefix="/routines/templates", tags=["routines"])`, importando `_ensure_seed_data`
      desde `.routines` y `require_role(UserRole.owner, UserRole.coach)` en todos los endpoints
      (design D9).
- [x] 4.3 Implementar el helper de normalización del nombre
      (`unicodedata.normalize("NFC", name).strip().casefold()` → `name_normalized`) y el chequeo de
      colisión que responde **409** con "Ya existe una plantilla con ese nombre" (design D1,
      invariante I11).
- [x] 4.4 En ese router, implementar el resolvedor de configuración por ejercicio: fila de
      `routine_template_exercises` si existe, si no fallback a `TrainingDayExercise.is_active` +
      `strategy = constant` (design D2), y el armado del detalle con `planned_sets` calculado por
      `plan_sets` sobre la base del catálogo.
- [x] 4.5 Implementar `GET /routines/templates` (id, name, tag, day_count, assignment_count,
      created_at) y `POST /routines/templates` (`{name, tag, day_ids}`, 422 si `day_ids` viene
      vacío o con ids repetidos, 400 si algún `day_id` no existe, 409 si el nombre está en uso).
- [x] 4.6 Implementar `GET /routines/templates/{id}` (solo los días de la plantilla, ordenados por
      `position`, con todos los ejercicios del día y su base, `is_active`, `strategy` y
      `planned_sets`).
- [x] 4.7 Implementar `PATCH /routines/templates/{id}` (`name?`, `tag?`, `day_ids?`): reemplaza la
      selección de días borrando/creando filas de `routine_template_days` **sin tocar**
      `routine_template_exercises` (invariante I1), y valida el nombre único en el renombre.
- [x] 4.8 Implementar `DELETE /routines/templates/{id}`: 409 con el conteo de miembros asignados si
      tiene asignaciones vigentes; si no, borra la plantilla (los días y la configuración caen por
      cascade) y responde 204 (design D9, invariante I14).
- [x] 4.9 Implementar `PUT /routines/templates/{id}/days/{day_id}/exercises/{exercise_id}`
      (`{is_active?, strategy?}`) con upsert de la fila de configuración, autoría en
      `updated_by_user_id`/`updated_at`, y respuesta con el ejercicio y su `planned_sets`
      recalculado (design D5). 400 si el día no pertenece a la plantilla o el ejercicio no
      pertenece al día.
- [x] 4.10 Registrar el router en `backend/app/main.py` (import + `include_router`), sin tocar
      ningún otro router.
- [x] 4.11 Crear `backend/tests/test_routine_templates.py` con
      `test_coach_crea_una_plantilla_con_dos_dias`,
      `test_crear_una_plantilla_sin_dias_es_rechazado`,
      `test_editar_nombre_y_etiqueta_de_una_plantilla` y
      `test_el_detalle_solo_devuelve_los_dias_de_la_plantilla`.
- [x] 4.12 En el mismo archivo, agregar `test_rechaza_un_nombre_duplicado_ignorando_mayusculas` y
      `test_rechaza_un_nombre_duplicado_ignorando_espacios_en_los_bordes` (los dos escenarios de la
      spec, ambos con 409 y mensaje claro).
- [x] 4.13 En el mismo archivo, agregar
      `test_quitar_y_volver_a_agregar_un_dia_conserva_la_configuracion`,
      `test_desactivar_un_ejercicio_conserva_su_estrategia`,
      `test_un_ejercicio_nuevo_en_una_plantilla_arranca_en_constante` y
      `test_el_mismo_ejercicio_tiene_estrategia_propia_en_cada_plantilla`.
- [x] 4.14 En el mismo archivo, agregar `test_eliminar_una_plantilla_sin_asignaciones` y
      `test_rechaza_eliminar_una_plantilla_con_asignaciones_e_informa_cuantos_miembros`
      (el `detail` del 409 incluye la cantidad).
- [x] 4.15 En el mismo archivo, agregar `test_cambiar_la_estrategia_devuelve_el_plan_recalculado`,
      `test_un_reseed_del_catalogo_no_borra_la_configuracion_de_la_plantilla` (invariante I9) y
      `test_un_miembro_no_puede_listar_plantillas` (403).
- [x] 4.16 Agregar a `backend/tests/test_exercise_base.py` el caso
      `test_la_base_editada_cambia_el_plan_calculado_de_la_plantilla` (usa el detalle de plantilla
      de este grupo).

## 5. API: asignaciones (Dueño/Coach)

- [x] 5.1 Agregar al final de `backend/app/schemas.py` los schemas de asignación:
      `RoutineAssignmentCreate` (`template_id`, `status`, `starts_on?`, `base_overrides?`),
      `RoutineAssignmentUpdate` (`status`), `RoutineAssignmentBaseUpdate` (`sets ≥ 1`, `reps ≥ 1`,
      `weight_kg ≥ 0`) y `RoutineAssignmentOut` (con `adjustments_count` y
      `last_adjustment {by_name, at} | null`).
- [x] 5.2 Crear `backend/app/routers/routine_assignments.py` con `router =
      APIRouter(prefix="/routines/users/{user_id}/templates", tags=["routines"])` y el permiso
      `require_role(UserRole.owner, UserRole.coach)` + `require_can_manage_user` de
      `backend/app/deps.py` (reutilizado tal cual, sin editar ese archivo).
- [x] 5.3 Implementar `GET` de la lista de asignaciones del miembro, con la última autoría de
      ajuste derivada del `adjusted_at` máximo (design D7). La lista **no** filtra por
      `membership_status` (invariante I13).
- [x] 5.4 Implementar `POST`: valida rol Miembro y `membership_status == active` (409 si no),
      degrada a `alternative` cualquier Activa previa con `flush()` antes del insert, y hace
      upsert si ya existía una asignación de esa plantilla para ese miembro (design D6, D8).
      Acepta `base_overrides` iniciales con autoría.
- [x] 5.5 Implementar `PATCH /{assignment_id}` para alternar `status`, aplicando la misma
      degradación de la Activa previa.
- [x] 5.6 Implementar `DELETE /{assignment_id}`: borra la asignación y sus ajustes por cascade, y
      **no** promueve ninguna Alternativa (comentario explícito en el código; invariante I12).
- [x] 5.7 Implementar `PUT /{assignment_id}/bases/{exercise_id}` (upsert del ajuste con
      `adjusted_by_user_id` y `adjusted_at`), validando que el ejercicio pertenezca a algún día de
      la plantilla asignada (400 si no).
- [x] 5.8 Implementar `DELETE /{assignment_id}/bases/{exercise_id}`: borra el ajuste (404 si no
      existía) y devuelve la asignación ya sin esa autoría (design D7, invariante I10).
- [x] 5.9 Registrar el router en `backend/app/main.py`.
- [x] 5.10 Crear `backend/tests/test_routine_assignments.py` con
      `test_asignar_la_primera_plantilla_como_activa`,
      `test_asignar_una_segunda_plantilla_como_alternativa` y
      `test_asignar_una_nueva_activa_deja_la_anterior_como_alternativa`.
- [x] 5.11 En el mismo archivo, agregar `test_asignar_a_un_miembro_dado_de_baja_responde_409`,
      `test_asignar_a_un_miembro_sin_membresia_responde_409`,
      `test_reactivar_la_membresia_habilita_la_asignacion`,
      `test_dar_de_baja_la_membresia_conserva_las_asignaciones` y
      `test_no_se_puede_asignar_una_plantilla_a_un_coach`.
- [x] 5.12 En el mismo archivo, agregar `test_ajustar_la_base_registra_autor_y_fecha`,
      `test_una_asignacion_sin_ajustes_se_reporta_sin_ajustes` y
      `test_quitar_el_ajuste_de_base_vuelve_a_la_base_del_catalogo`.
- [x] 5.13 En el mismo archivo, agregar `test_quitar_una_asignacion_alternativa` y
      `test_quitar_la_asignacion_activa_no_promueve_una_alternativa`.

## 6. API: vista del miembro

- [x] 6.1 Agregar a `backend/app/schemas.py` `MemberRoutineTemplateOut` (asignación + días +
      ejercicios activos con `planned_sets`).
- [x] 6.2 En `routine_assignments.py`, agregar `my_router =
      APIRouter(prefix="/routines/my/templates", tags=["routines"])` con
      `require_role(UserRole.member)` y `_require_member` (design D9).
- [x] 6.3 Implementar `GET /routines/my/templates`: solo las asignaciones del usuario autenticado
      (id, plantilla, estado, fecha desde), lista vacía si no tiene ninguna, **sin** filtrar por
      estado de membresía (invariante I13).
- [x] 6.4 Implementar `GET /routines/my/templates/{assignment_id}`: 404 si la asignación no es
      suya (invariante I7); devuelve los días de la plantilla en orden y, por día, **solo los
      ejercicios activos** con su `planned_sets`.
- [x] 6.5 Implementar `_resolve_base(exercise, overrides)` como única precedencia base ajustada →
      base del catálogo, y usarla en el cálculo del plan del miembro (design D7, invariante I10).
- [x] 6.6 Registrar `my_router` en `backend/app/main.py`.
- [x] 6.7 Crear `backend/tests/test_member_routine.py` con
      `test_el_miembro_solo_ve_sus_plantillas_asignadas`,
      `test_el_miembro_sin_asignaciones_recibe_una_lista_vacia`,
      `test_el_miembro_dado_de_baja_sigue_viendo_sus_plantillas` y
      `test_un_miembro_no_puede_ver_la_asignacion_de_otro`.
- [x] 6.8 En el mismo archivo, agregar
      `test_el_detalle_del_miembro_solo_trae_los_dias_de_la_plantilla`,
      `test_un_ejercicio_desactivado_no_aparece_en_el_plan_del_miembro`,
      `test_el_plan_del_miembro_usa_la_base_ajustada_para_ese_cliente` y
      `test_cambiar_la_estrategia_se_refleja_en_el_plan_del_miembro`.
- [x] 6.9 Correr `make test-backend` y `make lint-backend` y dejar ambos en verde.

## 7. Frontend: contratos y capa de datos

- [x] 7.1 Agregar al final de `frontend/src/types.ts` los tipos `ProgressionStrategy`,
      `PlannedSet`, `ExerciseBase`, `RoutineTemplateSummary`, `RoutineTemplateExercise`,
      `RoutineTemplateDay`, `RoutineTemplateDetail`, `RoutineAssignment` y
      `MemberRoutineTemplate`, espejo exacto de los schemas del backend (design D12). Sumar los
      tres campos de base al tipo del ejercicio del catálogo si ya existe uno.
- [x] 7.2 Agregar a `frontend/src/services/queryKeys.ts` los dominios `routineTemplates`
      (`all`, `list()`, `detail(id)`) y `routineAssignments` (`all`, `byUser(userId)`, `my()`,
      `myDetail(assignmentId)`). No escribir keys inline en ningún hook.
- [x] 7.3 Crear `frontend/src/services/routineTemplates.ts` con los fetchers de plantillas
      (`fetchRoutineTemplates`, `fetchRoutineTemplate`, `createRoutineTemplate`,
      `updateRoutineTemplate`, `deleteRoutineTemplate`, `updateTemplateExercise`,
      `updateExerciseBase`) usando el **default export** de `@/lib/http`.
- [x] 7.4 En el mismo archivo, agregar los fetchers de asignaciones y del miembro
      (`fetchUserAssignments`, `assignTemplate`, `updateAssignmentStatus`, `removeAssignment`,
      `updateAssignmentBase`, `removeAssignmentBase`, `fetchMyTemplates`, `fetchMyTemplate`).
- [x] 7.5 Crear `frontend/src/services/routineTemplates.queries.ts` con los hooks de lectura
      (`useRoutineTemplatesQuery`, `useRoutineTemplateQuery`, `useUserAssignmentsQuery`,
      `useMyTemplatesQuery`, `useMyTemplateQuery`).
- [x] 7.6 En el mismo archivo, agregar los hooks de mutación con invalidación por prefijo de
      dominio: crear/editar/eliminar plantilla → `routineTemplates.all` (el borrado además
      `routineAssignments.all`); toggle/chip de ejercicio → `setQueryData(detail(id), respuesta)` +
      invalidate `routineAssignments.all`; editar base del catálogo → los dos dominios; asignar /
      cambiar estado / quitar asignación / ajustar o quitar base → `routineAssignments.all`
      (design D12).

## 8. Frontend: lista y detalle de plantillas

- [x] 8.1 Reescribir `frontend/src/pages/Routines.tsx` con el patrón de `pages/Users.tsx`:
      `ListPageLayout` (`title`, `count`, `primaryAction` "Crear plantilla"), `Table` con
      `STICKY_HEAD_CLASS`, `SkeletonRow`, `EmptyState` y `DataError`. Columnas: Nombre, Etiqueta
      (`Badge`), Días, Miembros, acción "Ver". La fila navega a `/routines/:templateId`.
- [x] 8.2 Crear `frontend/src/components/CreateRoutineTemplateDialog.tsx` (nombre, etiqueta y
      selección múltiple de días con su orden; deshabilita el confirmar sin días seleccionados) y
      conectarlo al botón primario de la lista, mostrando el mensaje del 409 de nombre duplicado
      tal como lo devuelve el backend (design D11).
- [x] 8.3 Crear `frontend/src/components/PlannedSetsList.tsx`: renderiza `planned_sets[]` como
      "peso kg × reps" con su anotación ("20 s", "al fallo"), en modo solo lectura. Es el
      componente compartido por el detalle de plantilla y "Mi rutina" (design D11).
- [x] 8.4 Crear `frontend/src/components/StrategyChips.tsx`: los cinco chips de estrategia con el
      elegido marcado, `disabled` mientras la mutación está en vuelo.
- [x] 8.5 Crear `frontend/src/pages/RoutineTemplateDetail.tsx` con el patrón de
      `pages/UserDetail.tsx`: hero con nombre, badge de etiqueta, "Volver a Rutinas" y botones
      "Editar" y "Eliminar"; una `Card` por día de la plantilla con su tabla de ejercicios (base,
      toggle activo, `StrategyChips`, `PlannedSetsList`).
- [x] 8.6 Crear `frontend/src/components/EditRoutineTemplateDialog.tsx` (nombre, etiqueta y
      agregar/quitar días, con el mismo manejo del 409 de nombre duplicado) conectado al botón
      "Editar" del detalle.
- [x] 8.7 Crear `frontend/src/components/DeleteRoutineTemplateDialog.tsx` sobre
      `ConfirmActionDialog` (`destructive`), que muestra el `detail` del 409 con el conteo de
      miembros asignados cuando el backend rechaza, y navega a `/routines` cuando borra.
- [x] 8.8 Crear `frontend/src/components/EditExerciseBaseDialog.tsx` sobre `ConfirmActionDialog`
      (series, repeticiones y kg) para editar la base del catálogo desde el detalle de plantilla,
      visible solo para Dueño (espejo de `require_role(owner)` del endpoint existente; design D3).
- [x] 8.9 Cablear el toggle de activo y los chips al hook de mutación de 7.6 (autosave, sin botón
      de guardado) y mostrar el plan que devuelve el backend, sin calcular nada en el frontend
      (invariante I6).
- [x] 8.10 En `frontend/src/App.jsx`, agregar `const RoutineTemplateDetail = lazy(() =>
      import("./pages/RoutineTemplateDetail"))` y la ruta `/routines/:templateId` con
      `ProtectedRoute roles={["owner", "coach"]}`. **No** agregar entrada en `lib/routePreload.ts`
      (no se navega desde el sidebar, igual que `UserDetail`).
- [x] 8.11 Crear `frontend/src/pages/__tests__/Routines.test.tsx` con
      `lista las plantillas con su etiqueta y su cantidad de dias`,
      `abre el detalle de la plantilla al hacer click en la fila` y
      `muestra el error del backend cuando el nombre de plantilla ya esta en uso`, mockeando la red
      con `vi.mock("@/lib/http")` + `src/test/apiMock.ts` y renderizando con `renderWithProviders`.
- [x] 8.12 Crear `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` con
      `muestra solo los dias que incluye la plantilla`,
      `al elegir otra estrategia guarda y muestra el plan recalculado` y
      `pide confirmacion antes de eliminar la plantilla`.

## 9. Frontend: asignación desde la ficha del usuario

- [x] 9.1 Crear `frontend/src/components/MemberTemplatesCard.tsx`: `Card` con la lista de
      plantillas asignadas (nombre, badge Activa/Alternativa, "Sin ajustes" o "Ajustada por X el
      dd/mm") y el botón "+ Asignar plantilla" en el footer, visible solo si `canManageUser(...)`
      **y** `membership_status === "active"`. La lista se muestra siempre, aunque la membresía esté
      dada de baja (design D11, invariante I13).
- [x] 9.2 Crear `frontend/src/components/AssignTemplateDialog.tsx` sobre `ConfirmActionDialog`
      (slot `children` con el selector de plantilla y el estado Activa/Alternativa), avisando en el
      propio diálogo que asignar como Activa deja la anterior como Alternativa.
- [x] 9.3 Crear `frontend/src/components/RemoveAssignmentDialog.tsx` sobre `ConfirmActionDialog`
      (`destructive`), aclarando que se pierden los ajustes de base de esa asignación y que quitar
      la Activa no promueve ninguna Alternativa.
- [x] 9.4 Crear `frontend/src/components/AdjustExerciseBaseDialog.tsx` sobre
      `ConfirmActionDialog` (series, repeticiones y kg) para el ajuste por cliente, y la acción
      "Quitar ajuste" sobre el `DELETE` correspondiente, ambas accesibles desde la asignación en
      `MemberTemplatesCard`.
- [x] 9.5 En `frontend/src/pages/UserDetail.tsx`, agregar **solo** el import de
      `MemberTemplatesCard` y su render condicionado a `isMemberRole` dentro de la columna derecha,
      debajo de la card de Invitación. No tocar nada más del archivo (change paralelo
      `move-user-actions-to-detail` en curso).
- [x] 9.6 Crear `frontend/src/components/__tests__/MemberTemplatesCard.test.tsx` con
      `lista las plantillas asignadas con su estado`,
      `no ofrece asignar plantilla a un miembro sin membresia activa`,
      `sigue listando las plantillas de un miembro sin membresia activa` y
      `pide confirmacion antes de quitar una asignacion`.

## 10. Frontend: "Mi rutina"

- [x] 10.1 Reescribir `frontend/src/pages/UserRoutine.tsx` para consumir `useMyTemplatesQuery` /
      `useMyTemplateQuery` (TanStack Query, sin `api.get` imperativo ni `useState` de carga) y
      mostrar el selector entre las plantillas asignadas con su badge de estado.
- [x] 10.2 Agregar la navegación entre los días de la plantilla elegida, en el orden que devuelve el
      backend, y por cada ejercicio activo su nombre, grupo muscular y `PlannedSetsList`.
- [x] 10.3 Agregar el estado vacío explícito ("todavía no tenés una plantilla asignada") y el manejo
      de error con `DataError`, sin ninguna acción de marcar serie ni contador de series
      completadas (spec `member-routine-view`).
- [x] 10.4 Crear `frontend/src/pages/__tests__/UserRoutine.test.tsx` con
      `permite elegir entre las plantillas asignadas`,
      `avisa cuando el miembro no tiene ninguna plantilla asignada` y
      `muestra el plan de series sin accion para marcar una serie como hecha`.
- [x] 10.5 Correr `make test-frontend` y `make lint-frontend` y dejar ambos en verde.

## 11. Documentación y cierre

- [x] 11.1 Actualizar `backend/AGENTS.md`: módulo `progression.py`, los dos routers nuevos con sus
      prefijos, las tablas nuevas, el campo base en el flujo existente de ejercicios y los cinco
      archivos de test agregados (`test_progression.py`, `test_exercise_base.py`,
      `test_routine_templates.py`, `test_routine_assignments.py`, `test_member_routine.py`).
- [x] 11.2 Documentar en `backend/AGENTS.md` que esta migración **no** corre en el deploy de
      Railway: hay que aplicar `python -m alembic upgrade head` contra la base de producción antes
      de promover el build con el código nuevo (design, Migration Plan paso 3).
- [x] 11.3 Actualizar `frontend/AGENTS.md`: rutas `/routines` y `/routines/:templateId`, archivos
      nuevos de `services/`, los dominios nuevos de `queryKeys.ts`, los diálogos nuevos sobre
      `ConfirmActionDialog` y los cuatro archivos de test agregados.
- [x] 11.4 Correr `make check-plan CHANGE=add-routine-templates` y dejarlo en verde (todos los
      casos de la tabla del Plan de verificación existen con ese nombre exacto).
- [x] 11.5 Correr `make lint` y `make test` y dejar ambos en verde.
