# Tasks: drop-static-exercise-catalog

Orden ejecutable. Cada grupo deja el repo en verde (`make lint` + `make test`) **salvo los grupos
2 y 3**, que están marcados con su excepción y su motivo: entre retirar el sembrado automático y
darle a los tests sus preconditions explícitas, la suite backend queda roja por construcción. Son
un par indivisible — el dev no cierra sesión con el 2 hecho y el 3 sin hacer.

Referencias: `design.md` D1–D11 y su `## Plan de verificación`; specs en `specs/`.

**Ronda 2.** Los grupos 1–12 se ejecutaron y la verificación salió FALLA. El **grupo 14**
reúne todo lo que hay que hacer ahora: el bloqueante B1 (que se resuelve retirando
`TrainingDayExercise.is_active`, design D10) más los otros nueve hallazgos. El grupo 4 quedó
superado y no se re-ejecuta. El grupo 12 (cierre local) se reabre y se corre al final.

## 1. Preparar el terreno (sin cambiar comportamiento)

- [x] 1.1 Extraer el doble candado de `backend/scripts/seed_dev_users.py` a
      `backend/scripts/dev_guards.py` como `check_environment_guards(what: str)`, con las mismas
      constantes `ALLOWED_ENVIRONMENTS` / `ALLOWED_DB_HOSTS` y los mismos mensajes, parametrizando
      solo el sujeto del texto ("usuarios de desarrollo") (D4).
- [x] 1.2 Dejar `seed_dev_users.py` importando el candado nuevo y verificar que
      `backend/tests/test_dev_seed.py` sigue verde sin tocarlo (parchea atributos del objeto
      `settings`, no del módulo).
- [x] 1.3 Crear `backend/scripts/seed_dev_exercises.py` mudando **entera** la constante
      `EXERCISE_LIBRARY` desde `backend/app/routine_catalog.py` (mudar, no copiar: `app/` no debe
      poder importarla) (D4).
- [x] 1.4 Implementar su `main()`: candado primero (antes de `create_engine`), luego
      `ensure_training_days`, inserción idempotente por `id` con `name_normalized` completado, y
      `sync_exercise_day_links` por ejercicio (D4).
- [x] 1.5 Agregar el target `seed-dev-exercises` al `Makefile`, calcado de `seed-dev` (detección de
      Docker con fallback al venv nativo, anunciando la rama tomada), más `.PHONY` y su línea de
      `## help`. No encadenarlo a `seed-dev`.

## 2. Retirar el sembrado automático de ejercicios (backend)

> **Excepción declarada**: al terminar este grupo, `make test` queda en rojo (los 5 archivos de
> test que heredaban el seed). Se cierra en el grupo 3, que es su continuación obligatoria.

- [x] 2.1 Partir `_ensure_seed_data` en `backend/app/routers/routines.py`: queda
      `ensure_training_days(db)` con solo el bloque de `TrainingDay`; se retiran el bloque que crea
      `Exercise` desde `EXERCISE_LIBRARY` y el que recalcula/borra `TrainingDayExercise` (D1).
- [x] 2.2 Hacer que `ensure_training_days` sea no-op cuando los 4 días ya existen: solo inserta los
      que faltan, deja de pisar `name`/`muscle_groups`/`day_order`, y solo hace `commit()` si
      insertó algo (D1).
- [x] 2.3 Actualizar los imports y los 20 call sites al nombre nuevo (`routines.py`,
      `routine_templates.py`, `routine_assignments.py`). Los call sites **no** se recortan (D1).
- [x] 2.4 Retirar `default_active_ids` de `TRAINING_DAYS` en `backend/app/routine_catalog.py` y
      dejar el archivo con `TRAINING_DAYS` como única constante; `routines.py` deja de importar
      `EXERCISE_LIBRARY` (D7).
- [x] 2.5 Confirmar con `grep -rn "EXERCISE_LIBRARY\|default_active_ids" backend/app` que no queda
      ninguna referencia dentro de `backend/app/` (I2).

## 3. Preconditions explícitas en la suite backend

> **Excepción declarada**: este grupo es el que devuelve `make test` al verde después del grupo 2.
> Sus sub-tasks intermedias pueden dejar la suite parcialmente roja; la 3.7 es el punto de control.

- [x] 3.1 Agregar `create_exercise(db_session, *, id, name, muscle_group, ...)` a
      `backend/tests/helpers.py`: inserta la fila con `name_normalized`, asegura los días y crea
      los vínculos vía `sync_exercise_day_links` (D5).
- [x] 3.2 Agregar a `backend/tests/conftest.py` la fixture **opt-in** (no `autouse`)
      `catalog_basic`, que crea el puñado de ejercicios cuyos ids la suite ya nombra
      (`chest-bench-press`, `chest-cable-fly`, `legs-back-squat` y los que hagan falta por grupo)
      (D5).
- [x] 3.3 Migrar `backend/tests/test_routine_templates.py` (el archivo con más referencias) a la
      fixture y a `create_exercise`, sin reescribir asserts.
- [x] 3.4 Migrar `backend/tests/test_exercises.py`.
- [x] 3.5 Migrar `backend/tests/test_routine_assignments.py`.
- [x] 3.6 Migrar `backend/tests/test_member_routine.py` y `backend/tests/test_exercise_base.py`.
- [x] 3.7 `make test-backend` en verde, sin ninguna fixture `autouse` nueva y sin que ningún test
      dependa del script de seed de desarrollo (D5).

## 4. Vínculo día↔ejercicio: nace activo, sin reactivar lo apagado

> **Grupo superado por el 14.** D8 se retiró tras el hallazgo bloqueante B1 de la
> verificación. Las tasks quedan marcadas como hechas porque se ejecutaron; el grupo 14
> deshace 4.2 y reemplaza 4.6. No re-ejecutar este grupo.

- [x] 4.1 Retirar el parámetro `preserve_active` de `sync_exercise_day_links` y actualizar sus
      callers (D8).
- [x] 4.2 Implementar la regla de D8: el vínculo nuevo nace `is_active=True`, salvo que el
      ejercicio ya tenga algún `TrainingDayExercise` con `is_active=False` (incluidos los que esa
      misma llamada va a borrar), en cuyo caso hereda la desactivación.
- [x] 4.3 Actualizar el comentario de `activate_exercise` en `backend/app/routers/exercises.py`:
      "reactivar deja al ejercicio igual que uno recién creado" deja de ser cierto; el motivo real
      es que reactivar no inventa una selección por día (D8). Sin cambio de comportamiento.
- [x] 4.4 `backend/tests/test_exercises.py`:
      `test_un_ejercicio_nuevo_nace_activo_para_el_dia_de_su_grupo_muscular` (I8).
- [x] 4.5 `backend/tests/test_exercises.py`:
      `test_cambiar_el_grupo_muscular_mueve_el_vinculo_al_dia_nuevo_y_lo_saca_del_viejo` (I1). El
      caso edita el **grupo muscular**, no la descripción: es la rama donde vivía el bug de la
      reserva 1.
- [x] 4.6 `backend/tests/test_exercises.py`:
      `test_cambiar_el_grupo_muscular_de_ida_y_vuelta_no_reactiva_un_vinculo_desactivado` (I9). Dos
      ediciones de grupo, no una: con una sola el bug no aparece.

## 5. El bug de FK al crear el primer ejercicio en una base nueva

- [x] 5.1 Llamar a `ensure_training_days(db)` al entrar en `create_exercise` y en
      `update_exercise` de `backend/app/routers/exercises.py` (call site 21): sin los 4
      `TrainingDay`, `sync_exercise_day_links` inserta un `TrainingDayExercise` con FK a
      `training_days.id` inexistente y el alta explota (D2.1).
- [x] 5.2 `backend/tests/test_exercises.py`:
      `test_crear_un_ejercicio_en_una_base_sin_dias_sembrados_no_falla_por_fk` — el test no puede
      pegarle antes a ningún endpoint de Rutinas, que es lo que hoy tapa el bug (I4).

## 6. Invariantes estructurales y catálogo vacío (backend)

- [x] 6.1 Crear `backend/tests/test_routines_seed.py` con
      `test_ningun_modulo_de_app_importa_exercise_library`: recorre los módulos de `backend/app/` y
      falla si alguno define o importa el símbolo (I2).
- [x] 6.2 `backend/tests/test_routines_seed.py`:
      `test_visitar_endpoints_de_rutinas_no_crea_ni_borra_ejercicios_ni_vinculos` — cuenta filas de
      `exercises` y `training_day_exercises` antes y después de recorrer varios endpoints (I3).
- [x] 6.3 `backend/tests/test_routines_seed.py`:
      `test_ensure_training_days_crea_los_cuatro_dias_una_vez_y_despues_no_escribe` (I4).
- [x] 6.4 `backend/tests/test_routines_seed.py`:
      `test_con_el_catalogo_vacio_los_endpoints_de_rutinas_responden_200` (I5).
- [x] 6.5 `backend/tests/test_routine_templates.py`:
      `test_la_curacion_por_dia_sobrevive_a_repetir_requests_de_rutinas` (I6). **Superada por
      14.30**: el invariante I6 se retiró con D10 y el test se borra.
- [x] 6.6 `backend/tests/test_member_routine.py`:
      `test_mi_rutina_con_el_catalogo_vacio_devuelve_el_dia_sin_ejercicios`.
- [x] 6.7 `backend/tests/test_member_routine.py`:
      `test_cargar_un_ejercicio_agregarlo_a_la_plantilla_y_asignarla_lo_deja_visible_en_mi_rutina`
      — el escenario end-to-end de la spec, sin ningún paso de activación extra (I8).

## 7. Un ejercicio desactivado deja de ofrecerse, pero no se cae de la plantilla

- [x] 7.1 En el armado del detalle de plantilla (`backend/app/routers/routine_templates.py`),
      excluir el vínculo cuyo `Exercise.is_active` es `False` **y** que no tiene
      `RoutineTemplateExercise` para esa plantilla y ese día (D9).
- [x] 7.2 `backend/tests/test_routine_templates.py`:
      `test_un_ejercicio_desactivado_en_el_catalogo_no_se_ofrece_como_opcion_nueva_del_dia` (I10).
- [x] 7.3 `backend/tests/test_routine_templates.py`:
      `test_un_ejercicio_desactivado_en_el_catalogo_sigue_en_la_plantilla_que_ya_lo_tenia` (I10).
      Separado del anterior a propósito: un solo test cubriría una rama y taparía la otra.
- [x] 7.4 `backend/tests/test_routine_templates.py`:
      `test_editar_el_grupo_muscular_de_un_ejercicio_usado_en_una_plantilla_lo_deja_en_el_dia_viejo`
      — candado de la corrección H2 del change anterior, que D8 no debe romper.

## 8. Migración

- [x] 8.1 Confirmar el head con `cd backend && alembic heads` (esperado `c387dcc091c2`) y generar
      la revision nueva.
- [x] 8.2 `upgrade()`: `DELETE FROM exercises WHERE id IN (<los 52 ids literales>)`, con la lista
      escrita en la migración (foto, sin importar nada de `app.*`) (D3).
- [x] 8.3 `downgrade()`: no-op, con docstring que explique que no hay nada que restaurar y que la
      vía para recuperar datos de desarrollo es `make seed-dev-exercises` (D3).
- [x] 8.4 Docstring de la revision: enumerar qué cascadea (`exercise_training_types`,
      `training_day_exercises`, `workout_logs`, `routine_template_exercises`,
      `routine_assignment_bases`) y que `training_days` no se toca.
- [x] 8.5 Correr `alembic upgrade head` sobre la base de desarrollo y verificar los conteos de la
      fila manual del Plan de verificación (los `custom-*` siguen, los 52 no, `training_days` = 4).

## 9. Estados vacíos del frontend

- [x] 9.1 `frontend/src/pages/Exercises.tsx`: separar el caso "catálogo vacío" del de "sin
      resultados de búsqueda" y usar el texto literal de la spec — título "Catálogo vacío", cuerpo
      "Todavía no cargaste ningún ejercicio. Cargá el primero para empezar a armar tus plantillas
      de rutina." y acción "Crear ejercicio" que abre el mismo alta que el botón de la cabecera,
      visible para Dueño y Coach (D6).
- [x] 9.2 `frontend/src/pages/RoutineTemplateDetail.tsx`: reemplazar "Este día no tiene ejercicios
      en el catálogo." por el texto literal "Todavía no hay ejercicios cargados para este día.
      Cargalos desde el catálogo de ejercicios." más la acción "Ir a Ejercicios" que navega a
      `/exercises` (D6).
- [x] 9.3 `frontend/src/pages/UserRoutine.tsx`: separar el caso `!selectedDay` del de lista vacía y
      usar en este último el texto literal "Este día todavía no tiene ejercicios cargados.", sin
      pedirle ninguna acción al Miembro y sin distinguir por qué está vacío (D6).
- [x] 9.4 `frontend/src/pages/__tests__/Exercises.test.tsx`:
      `muestra el estado vacío de catálogo con la acción de crear ejercicio cuando no hay ninguno`.
- [x] 9.5 `frontend/src/pages/__tests__/Exercises.test.tsx`:
      `ofrece la acción de crear ejercicio del estado vacío también a un Coach`.
- [x] 9.6 `frontend/src/pages/__tests__/Exercises.test.tsx`:
      `mantiene el mensaje de sin resultados y no ofrece crear cuando la búsqueda no matchea`.
- [x] 9.7 `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx`:
      `explica que hay que cargar ejercicios desde el catálogo y ofrece ir a Ejercicios cuando el día no tiene ninguno`.
- [x] 9.8 `frontend/src/pages/__tests__/UserRoutine.test.tsx`:
      `indica que el día todavía no tiene ejercicios cargados`.

## 10. Seed opcional: tests

- [x] 10.1 Crear `backend/tests/test_dev_seed_exercises.py` con
      `test_seed_de_ejercicios_crea_los_52_con_sus_vinculos_de_dia_activos`.
- [x] 10.2 `test_seed_de_ejercicios_dos_veces_no_duplica_ni_pisa_un_grupo_editado` — corre el seed,
      edita el grupo muscular de un ejercicio, vuelve a correrlo y verifica que la edición
      sobrevive (idempotencia real, no solo conteo de filas).
- [x] 10.3 `test_seed_de_ejercicios_se_niega_a_correr_fuera_de_desarrollo` (I7), mismo patrón que
      `test_dev_seed.py`: `create_engine` parcheado para explotar si el candado no corta antes.
- [x] 10.4 `test_seed_de_ejercicios_se_niega_con_database_url_remota` (I7).

## 11. Documentación

- [x] 11.1 `backend/AGENTS.md`: documentar que el vínculo día↔ejercicio se deriva **solo** de
      `Exercise.muscle_group` vía `sync_exercise_day_links`, y la regla dura de D2.2 — todo change
      que toque `TRAINING_DAYS[*].muscle_groups` debe traer su propia migración que recalcule los
      vínculos, porque ya no hay proceso que los reponga.
- [x] 11.2 `backend/AGENTS.md`: documentar `scripts/seed_dev_exercises.py` y `scripts/dev_guards.py`
      junto al seed de usuarios ya documentado, más los tests nuevos de la suite.
- [x] 11.3 `AGENTS.md` de la raíz: agregar `make seed-dev-exercises` a la lista de comandos, al lado
      de `make seed-dev`, aclarando que es opcional y solo para datos de prueba.
- [x] 11.4 Revisar `docs/producto/` y el backlog (reserva 1 de `add-exercise-catalog`, ítem R-3):
      marcar la reserva como resuelta por este change y confirmar que ningún documento sigue
      afirmando que el catálogo viene precargado.

## 12. Cierre local

- [x] 12.1 `make lint` en verde.
- [x] 12.2 `make test` en verde (backend + frontend).
- [x] 12.3 `make check-plan CHANGE=drop-static-exercise-catalog` sin `FALLA:` — los 26 casos de la
      tabla existen con su nombre exacto.
- [x] 12.4 Recorrido manual de las tres filas `manual` no productivas del Plan de verificación
      (migración en desarrollo, recorrido con catálogo vacío por los 3 roles, y seed opcional con
      su candado).

## 13. Producción (Railway) — **lo ejecuta el usuario, no un agente**

- [ ] 13.1 Deploy de `main` y `railway run alembic upgrade head` (no hay migraciones automáticas en
      el deploy).
- [ ] 13.2 Verificar en producción: `/exercises` muestra el estado vacío, Rutinas y las plantillas
      abren sin error, y crear un ejercicio desde cero funciona (fila `manual` de producción).
- [ ] 13.3 **No** correr ningún seed en producción: el catálogo arranca vacío a propósito y lo carga
      el Dueño.

## 14. Hallazgos de la verificación (ronda 1)

### 14.a Bloqueante B1 — el vínculo pasa a ser puramente derivado (D10)

- [x] 14.1 Retirar la regla de nacimiento de D8 de `sync_exercise_day_links`
      (`new_link_is_active` y su párrafo de docstring): quedan dos reglas, crear los vínculos de
      los días del grupo actual y no borrar los que una plantilla usa (D10.3).
- [x] 14.2 Quitar `is_active` de `TrainingDayExercise` en `backend/app/models.py` (D10.1).
- [x] 14.3 Revision de Alembic nueva, encadenada a `bfc5002838bf`: `drop_column`
      `training_day_exercises.is_active`. `downgrade()` recrea la columna con default `True`, sin
      intentar restaurar valores (no hay de dónde).
- [x] 14.4 En la **misma** revision, el `UPDATE` de una sola vez de las 4 filas de `training_days`
      (`name`, `muscle_groups`, `day_order`) con valores literales, para reparar la divergencia que
      `add-exercise-catalog` dejó sin migración (D11, hallazgo 3).
- [x] 14.5 Retirar `PUT /routines/days/{day_id}/selection` de `backend/app/routers/routines.py` y
      su schema de `schemas.py`; borrar los tests que lo ejercitan. Sin requirement y sin consumidor
      (D10.2).
- [x] 14.6 `_resolve_exercise_config` (`routine_templates.py`): sin fila de configuración devuelve
      `(True, ProgressionStrategy.constant)` (D10.4).
- [x] 14.7 `_offered_as_new_option`: se ofrece si hay fila de configuración para esa plantilla y
      ese día, **o** si `Exercise.is_active` **y** el día está en
      `_day_ids_for_muscle_group(exercise.muscle_group)` (D10.5).
- [x] 14.8 Aplicar el mismo predicado en `backend/app/routers/routine_assignments.py` al armar el
      plan del Miembro (D10.6). Cierra además el hallazgo 7.
- [x] 14.9 `deactivate_exercise` deja de apagar los `day_links`; actualizar su comentario y el de
      `activate_exercise` (la invariante I10 de `add-exercise-catalog` se retira junto con el
      concepto que protegía, ver D10) (D10.7).
- [x] 14.10 Sacar `is_active` de `RoutineExerciseOption` en `backend/app/schemas.py` y de
      `RoutineExerciseOption` en `frontend/src/types.ts`, más las fixtures de
      `frontend/src/pages/__tests__/Routines.test.tsx` que lo construyen (D10.8).
- [x] 14.11 Adaptar los **tres** lectores restantes del flag (D10.9): `active_exercise_count` del
      endpoint de progreso cuenta los vínculos con `link.exercise.is_active`; la validación de alta
      de `WorkoutLog` pasa de `link.is_active` a `link.exercise.is_active`; y el upsert de un
      `RoutineTemplateExercise` nuevo en `routine_templates.py` defaultea `is_active=True` en vez
      de `link.is_active`. Los dos últimos aparecieron por `grep` al implementar: el design decía
      "los otros dos" y se quedaba corto.
- [x] 14.12 Borrar
      `test_cambiar_el_grupo_muscular_de_ida_y_vuelta_no_reactiva_un_vinculo_desactivado`
      (`test_exercises.py`): fijaba la regla retirada, y es el test que eligió la rama vecina de la
      que fallaba.
- [x] 14.13 `test_exercises.py`:
      `test_limpiar_y_reponer_el_grupo_muscular_deja_al_ejercicio_ofrecido_y_activo_en_su_dia` — la
      rama exacta del bloqueante (`Pecho → null → Pecho`).
- [x] 14.14 `test_exercises.py`:
      `test_pasar_por_un_grupo_muscular_sin_dia_en_el_catalogo_borra_los_vinculos_y_volver_los_repone`
      — la otra familia de secuencias con cero vínculos (`Core`, `Glúteos`, `Antebrazo`,
      `Cuerpo completo`: cuatro de los doce valores del enum).
- [x] 14.15 `test_exercises.py`:
      `test_desactivar_y_reactivar_un_ejercicio_lo_vuelve_a_ofrecer_para_su_dia` — el escenario
      "Reactivar un ejercicio" de `exercise-catalog`, hoy sin candado.
- [x] 14.16 `test_exercises.py`:
      `test_un_ejercicio_sin_grupo_muscular_no_se_ofrece_ni_en_el_dia_de_la_plantilla_que_lo_usa` —
      la rama del escenario "sin grupo muscular" con un vínculo conservado por H2, que hasta ahora
      no cubría ningún test.
- [x] 14.17 `test_routine_templates.py`:
      `test_un_ejercicio_agregado_sin_configuracion_propia_arranca_activo_y_en_constante` (I11).
- [x] 14.18 `test_member_routine.py`:
      `test_un_ejercicio_desactivado_en_el_catalogo_sin_configuracion_no_aparece_en_mi_rutina`
      (I10, rama del Miembro).

### 14.b Hallazgo 2 (mayor) — el estado vacío se dispara con filtros activos

- [ ] 14.19 `frontend/src/pages/Exercises.tsx`: el estado vacío de catálogo exige además sin filtro
      de grupo, sin filtro de tipo, `statusFilter === "all"` y `offset === 0`; con cualquier filtro
      o página distinta de la primera va el mensaje de "sin resultados", sin acción de crear. La
      spec dice "sin ningún filtro ni búsqueda aplicada".
- [ ] 14.20 Extender
      `mantiene el mensaje de sin resultados y no ofrece crear cuando la búsqueda no matchea` o
      agregar un caso hermano que ejercite la rama de **filtro** (grupo muscular sin resultados
      sobre un catálogo lleno), no solo la de búsqueda.

### 14.c Hallazgos menores

- [ ] 14.21 Hallazgo 4: `backend/scripts/seed_dev_exercises.py` sincroniza **solo** los ejercicios
      que acaba de crear, y con el `muscle_group` **de la fila**, no el de la constante. Hoy
      reintroduce en dev la segunda fuente de verdad que el change retira.
- [ ] 14.22 Hallazgo 4: `test_seed_de_ejercicios_dos_veces_no_duplica_ni_pisa_un_grupo_editado`
      pasa a mover el grupo por el endpoint y a verificar el `TrainingDayExercise` resultante, no
      solo la columna.
- [ ] 14.23 Hallazgo 5: el seed detecta la colisión por `name_normalized` y la reporta con un
      mensaje accionable en vez de dejar salir el `IntegrityError` crudo.
- [ ] 14.24 Hallazgo 6: reemplazar "Sin días." en `frontend/src/pages/UserRoutine.tsx` por un texto
      legible para el Miembro. **Consultar al Product Owner**: es una cadena de UI sin spec.
- [ ] 14.25 Hallazgo 8: el test de D9 "ya agregado" verifica las dos mitades de la spec — que sigue
      **activo** en el detalle y que sigue **en el plan del Miembro** —, no solo que el id aparezca.
- [x] 14.26 Hallazgo 9: el test de I3 corre con `catalog_basic` (para que haya filas que romper) y
      compara `sort_order` además de los conteos. Cubre también `routine_template_exercises`: es la
      mitad de I6 que sobrevive, absorbida por I3 (design, sección Invariantes).
- [ ] 14.27 Hallazgo 10: renombrar los dos tests que todavía hablan de un seed que no existe
      (`test_seed_vincula_los_ejercicios_de_pierna_a_los_grupos_musculares_nuevos`,
      `test_un_reseed_del_catalogo_no_borra_la_configuracion_de_la_plantilla`).
- [ ] 14.28 Actualizar `backend/AGENTS.md` (task 11.1): el vínculo día↔ejercicio no tiene estado
      propio y `TrainingDayExercise` no lleva `is_active`.

### 14.d Consecuencias en el Plan de verificación

- [x] 14.30 Borrar `test_la_curacion_por_dia_sobrevive_a_repetir_requests_de_rutinas`
      (`test_routine_templates.py`): solo podía existir llamando a
      `PUT /routines/days/{day_id}/selection`, que 14.5 retira. Es caída natural de 14.5, pero sin
      esta fila el historial no lo registraba y `check-plan` seguía exigiendo el caso. El
      invariante I6 que lo respaldaba se retiró del design (contradecía a I9) y su mitad viva pasó
      a I3.

### 14.e Nota operativa para la re-verificación

- [x] 14.29 Antes de cualquier verificación manual sobre un stack de Docker ya levantado, correr
      `docker compose restart backend`: el `Dockerfile` no usa `--reload` y es el segundo change
      seguido en el que se verifica código viejo.
