> Referencias: `design.md` (decisiones D1–D12 y `## Plan de verificación`),
> `specs/exercise-catalog/spec.md` (11 requirements) y
> `specs/staff-endpoint-authorization/spec.md`.
>
> Cada grupo deja el repo en verde (`make lint` + `make test`) al cerrarlo — **sin excepciones**.
> El change está diseñado bajo la regla de BETA de `AGENTS.md`: migración de esquema, sin backfill
> de rescate, y el catálogo de ejercicios se **reseedea** en vez de rescatarse (design D9).

## 1. Puerto de object storage

- [x] 1.1 Agregar `boto3` (pineado) a `backend/requirements.txt` y reinstalar con `make setup-backend` (design D8: dependencia justificada, se pinea como el resto).
- [x] 1.2 Agregar a `backend/app/config.py` las variables `STORAGE_*` de D10, todas con default apuntado al MinIO local (el entorno de desarrollo por defecto del repo).
- [x] 1.3 Crear `backend/app/storage.py` con el `Protocol` `ObjectStorage` (`put_object`, `delete_object` idempotente, `presigned_get_url`).
- [x] 1.4 Implementar `InMemoryObjectStorage` en `backend/app/storage.py` (dict `key -> (bytes, content_type)`, URL `memory://{bucket}/{key}?exp=...`).
- [x] 1.5 Implementar `S3ObjectStorage` con boto3 (`endpoint_url` + path-style configurables) y la traducción de `ClientError`/`EndpointConnectionError` a `502` en la subida y a log `WARNING` en el borrado (D6, D8).
- [x] 1.6 Implementar `presigned_get_url` con **expiración cuantizada** a `STORAGE_URL_WINDOW_SECONDS` (D3): la misma key debe producir una URL byte a byte idéntica dentro de la ventana, para no romper la caché del browser.
- [x] 1.7 Agregar la dependencia `get_storage()` (cacheada sobre la config, resuelve según `STORAGE_BACKEND`) en `backend/app/deps.py`, overrideable igual que `get_db`.
- [x] 1.8 Setear `STORAGE_BACKEND=memory` en `backend/tests/conftest.py` **antes** de importar `app.*` y agregar la fixture `storage` con el override de `get_storage` (D11: cinturón + tirantes).
- [x] 1.9 Crear `backend/tests/test_storage.py` con `test_s3_object_storage_presigna_sin_red`: instancia `S3ObjectStorage` con credenciales falsas y verifica que la URL trae `X-Amz-Signature` y el bucket/key correctos, sin abrir un socket.
- [x] 1.10 Agregar `STORAGE_PUBLIC_ENDPOINT_URL` a `backend/app/config.py` con default `""` y el comentario de D3.1: vacío ⇒ cae a `STORAGE_ENDPOINT_URL`, y solo hace falta setearla en Compose.
- [x] 1.11 Separar en `S3ObjectStorage` el cliente de **operaciones** (`put_object`/`delete_object`, endpoint interno) del de **firma** (`generate_presigned_url`, endpoint público), reusando el mismo cliente cuando los dos endpoints coinciden. El cliente de firma **no hace I/O**, así que su endpoint puede ser inalcanzable desde el backend. **No** reescribir el host después de firmar: SigV4 firma el header `host` y la URL quedaría inválida (D3.1).

## 2. Listas fijas del sistema

- [x] 2.1 Agregar `MuscleGroup(str, enum.Enum)` a `backend/app/models.py` con los 12 valores de la spec (nombre en inglés, valor en español con tildes: `MuscleGroup.chest = "Pecho"`).
- [x] 2.2 Agregar `TrainingType(str, enum.Enum)` con los 7 valores de la spec (Fuerza, Hipertrofia, Resistencia, Cardio, Movilidad, Funcional, Rehabilitación).

## 3. Modelo, migración y catálogo de seed

> **Nota de consistencia (D9).** `_sync_exercise_day_links` y `_ensure_seed_data`
> (`backend/app/routers/routines.py`) comparan `Exercise.muscle_group` **por igualdad de string**
> contra `TRAINING_DAYS[*].muscle_groups`, así que `routine_catalog.py` y la migración se cambian
> en el mismo grupo: desalineados, los vínculos día↔ejercicio quedan vacíos y el Día 4 se ve sin
> ejercicios. **No es una cuerda floja sobre datos irrecuperables**: esos vínculos son derivados y
> `_ensure_seed_data` los regenera enteros: realinear los archivos y volver a entrar a Rutinas los
> reconstruye. No hay que preservar nada.

- [x] 3.1 Extender `Exercise` en `backend/app/models.py` con `name_normalized` (`String`, único) y las 7 columnas de media de D6 (`external_media_url`, `media_object_key`, `media_content_type`, `media_size_bytes`, `media_filename`, `media_uploaded_at`, `media_uploaded_by_user_id` FK `users.id ON DELETE SET NULL`).
- [x] 3.2 Pasar `Exercise.muscle_group` a `nullable=True` (grupo 0..1, opcional por spec) manteniéndolo como `String` (D1: **no** `Enum()` de SQLAlchemy).
- [x] 3.3 Agregar el modelo `ExerciseTrainingType` (`exercise_id` FK `ON DELETE CASCADE`, `training_type`, `sort_order`, PK compuesta `(exercise_id, training_type)`, índice por `training_type`) y su `relationship` desde `Exercise`.
- [x] 3.4 Actualizar `EXERCISE_LIBRARY` en `backend/app/routine_catalog.py`: corregir `Biceps`→`Bíceps` y `Triceps`→`Tríceps`, y repartir los ejercicios `legs-*` entre `Cuádriceps`, `Isquios` y `Gemelos` según el movimiento real (sentadilla ≠ peso muerto rumano ≠ elevación de gemelos).
- [x] 3.5 Actualizar `TRAINING_DAYS` en el mismo archivo: día 1 → `["Pecho", "Tríceps"]`, día 2 → `["Espalda", "Bíceps"]`, día 4 → `["Cuádriceps", "Isquios", "Gemelos"]`.
- [x] 3.6 Confirmar el head actual con `alembic heads` (se espera `d5f74a834ac0`) y generar la revision nueva de Alembic.
- [x] 3.7 Escribir el `upgrade()` en el orden de D9: (1) `add_column` de las 8 columnas nuevas; (2) backfill de `name_normalized` (NFC + strip + casefold) y **después** el índice `UNIQUE`; (3) `create_table exercise_training_types`; (4) `alter_column muscle_group` a nullable; (5) un `UPDATE` de normalización con valores literales: `Biceps`→`Bíceps`, `Triceps`→`Tríceps`, y **todo lo que no quede en la lista fija → `NULL`** (incluye `Piernas`). Sin heurísticas ni mapeos por id.
- [x] 3.8 Escribir el `downgrade()`: rellenar `muscle_group IS NULL` con `'Cuerpo completo'` (necesidad mecánica para que el `alter_column` a no nula no falle), dropear tabla, índice y columnas. Documentar en el docstring que **no restaura nada** y que la forma correcta de volver atrás en beta es `downgrade` + reseed.
- [x] 3.9 Verificar el reseed en desarrollo: `make migrate`, después `DELETE FROM exercises WHERE id NOT LIKE 'custom-%'`, abrir `/routines` y confirmar que el Día 4 vuelve a listar sus ejercicios de pierna y que en `/exercises` los `legs-*` muestran `Cuádriceps`/`Isquios`/`Gemelos`.

## 4. Router del catálogo

- [x] 4.1 Agregar a `backend/app/schemas.py` los schemas `ExerciseBase`, `ExerciseCreate`, `ExerciseUpdate`, `ExerciseOut` (con `media_kind`, `media_file_url`, `external_media_url`) y `ExerciseMetaOut`, con `muscle_group: Optional[MuscleGroup]` y `training_types: list[TrainingType]`.
- [x] 4.2 Validar en los schemas: nombre obligatorio y no vacío tras `strip`, y `external_media_url` como URL `http(s)` bien formada (requirement "Validación de la URL externa").
- [x] 4.3 Crear `backend/app/routers/exercises.py` con `prefix="/exercises"` y `dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))]` **a nivel router** (D7: cubre el delta de `staff-endpoint-authorization` de una).
- [x] 4.4 Portar `_normalize_name` (NFC + strip + casefold en Python, **no** `lower()` de SQL) y `_check_name_collision` desde `membership_plans.py`, con la traducción de `IntegrityError` a `409` para la carrera concurrente.
- [x] 4.5 Implementar `GET /exercises/meta` devolviendo las dos listas fijas desde los enums de Python (D7: única fuente de verdad, evita el drift con el frontend).
- [x] 4.6 Implementar `GET /exercises/` con `q`, `muscle_group`, `training_type`, `is_active`, `limit` 1..200 (def. 50), `offset` y header `X-Total-Count` (sin `Link`), resolviendo `training_type` con un `EXISTS` sobre la tabla de asociación.
- [x] 4.7 Implementar `GET /exercises/{id}` y el serializer compartido, que deriva `media_kind` (`"file"` si hay archivo propio, si no `"external"`, si no `null`) y firma `media_file_url`.
- [x] 4.8 Implementar `POST /exercises/` (201 + `Location`, nace activo, `409` por nombre duplicado) y `PATCH /exercises/{id}` (`training_types` **reemplaza el set completo** con `DELETE` + `INSERT` en la misma transacción).
- [x] 4.9 Implementar `POST /exercises/{id}/activate` y `POST /exercises/{id}/deactivate` (`409` si ya está en ese estado), sin tocar el storage ni las plantillas que referencian el ejercicio. **`activate` no toca los `TrainingDayExercise`** (D7.1; corregido por la task 12.8).
- [x] 4.10 Implementar `DELETE /exercises/{id}`: `409` si hay `RoutineTemplateExercise`, `WorkoutLog` o `RoutineAssignmentBase` que lo referencien —con mensaje que ofrezca desactivarlo—; los `TrainingDayExercise` **no** cuentan como uso y se borran en cascada. Si tenía archivo propio, borrar el objeto **después** del commit (D6, S1 confirmado).
- [x] 4.11 Registrar el router en `backend/app/main.py`.
- [x] 4.12 Retirar `POST /routines/exercises` de `backend/app/routers/routines.py` (D7: sin consumidor en el frontend y sería un segundo escritor del catálogo que no valida la lista fija).
- [x] 4.13 Achicar `PUT /routines/exercises/{id}` y su schema a los tres campos de base (`base_sets`, `base_reps`, `base_weight_kg`); `name`/`muscle_group`/`description`/`is_active` pasan a ser exclusivos de `PATCH /exercises/{id}`. Queda owner-only (S2).
- [x] 4.14 Migrar `backend/tests/test_exercise_base.py` para que cree ejercicios por `POST /exercises/` en vez del endpoint retirado, sin cambiar lo que ese archivo verifica (la base de progresión).

## 5. Subida y ciclo de vida de la media

- [x] 5.1 Implementar `POST /exercises/{id}/media` con `UploadFile` (multipart), generando la key `exercises/{exercise_id}/{uuid4}.{ext}` (D4, D6).
- [x] 5.2 Validar en el orden de D4: `file.size` > límite ⇒ `413` **antes** de escribir en el bucket; sniff de magic bytes (`ftyp`, `GIF8`, `\xff\xd8`, `\x89PNG`) sobre los primeros 16 bytes, cruzado con el content-type declarado ⇒ `415`; `seek(0)` y streamear a `upload_fileobj`. (Reescrita por D4.1 tras el hallazgo H7; la implementa la task 12.10.)
- [x] 5.3 Garantizar que un rechazo por formato o tamaño **conserva la media anterior** del ejercicio sin tocarla (requirement "Validación de formato y tamaño al subir un archivo de media").
- [x] 5.4 Implementar el reemplazo según D6: `put_object` de la key nueva → `UPDATE` → `commit` → **después** `delete_object` de la key vieja, best-effort con log `WARNING`. Nunca convertir un borrado de storage fallido en un `500`.
- [x] 5.5 Implementar `DELETE /exercises/{id}/media` (`409` si no tiene archivo): columnas a `NULL` → `commit` → borrado best-effort. La URL externa se conserva y pasa a ser la media principal.
- [x] 5.6 Verificar explícitamente que **desactivar** un ejercicio no borra su objeto de storage (D6: el miembro con esa plantilla viva tiene que seguir viendo la demostración).

## 6. Tests del backend

- [x] 6.1 Crear `backend/tests/test_exercises.py` con los casos de alta y validación: `test_crear_ejercicio_devuelve_201_con_grupo_y_tipos`, `test_crear_ejercicio_sin_grupo_ni_tipos_ni_media_nace_activo`, `test_nombre_duplicado_ignorando_mayusculas_y_espacios_devuelve_409`, `test_nombre_vacio_o_solo_espacios_devuelve_422`.
- [x] 6.2 Agregar a `backend/tests/test_exercises.py` los casos de listas fijas y edición: `test_grupo_muscular_fuera_de_la_lista_fija_devuelve_422`, `test_tipo_de_entrenamiento_fuera_de_la_lista_fija_devuelve_422`, `test_patch_reemplaza_el_set_completo_de_tipos_de_entrenamiento`, `test_editar_ejercicio_usado_en_plantilla_no_rompe_la_referencia`, `test_url_externa_invalida_devuelve_422_y_no_modifica_el_ejercicio`.
- [x] 6.3 Agregar a `backend/tests/test_exercises.py` los casos de listado y estado: `test_listado_filtra_por_grupo_tipo_y_estado_y_expone_total_count`, `test_desactivar_ejercicio_lo_saca_del_listado_activo_y_conserva_la_plantilla`, `test_reactivar_ejercicio_lo_vuelve_a_ofrecer_en_el_listado_activo`.
- [x] 6.4 Agregar a `backend/tests/test_exercises.py` los casos de borrado (S1): `test_borrar_ejercicio_nunca_usado_devuelve_204_y_lo_saca_del_catalogo`, `test_borrar_ejercicio_usado_en_plantilla_devuelve_409`, `test_borrar_ejercicio_con_solo_el_vinculo_automatico_de_dia_esta_permitido`.
- [x] 6.5 Agregar a `backend/tests/test_exercises.py` el caso de autorización del delta de `staff-endpoint-authorization`: `test_endpoints_de_ejercicios_sin_sesion_devuelve_401_y_con_rol_member_403`, recorriendo los 9 endpoints del router.
- [x] 6.6 Agregar a `backend/tests/test_exercises.py` el caso que protege la consistencia del grupo 3: `test_seed_vincula_los_ejercicios_de_pierna_a_los_grupos_musculares_nuevos` (verifica que `_ensure_seed_data` deja el Día 4 con sus ejercicios de `Cuádriceps`/`Isquios`/`Gemelos`).
- [x] 6.7 Crear `backend/tests/test_exercise_media.py` con los casos de subida: `test_subir_archivo_guarda_la_key_y_devuelve_url_prefirmada`, `test_subir_archivo_mas_grande_que_el_limite_devuelve_413_y_no_escribe_en_storage`, `test_subir_formato_no_permitido_devuelve_415_y_conserva_la_media_anterior`.
- [x] 6.8 Agregar a `backend/tests/test_exercise_media.py` los casos de ciclo de vida del objeto: `test_reemplazar_el_archivo_borra_el_objeto_anterior_despues_del_commit`, `test_desactivar_ejercicio_no_borra_el_objeto_del_storage`, `test_borrar_ejercicio_con_archivo_propio_elimina_el_objeto_del_storage`.
- [x] 6.9 Agregar a `backend/tests/test_exercise_media.py` los casos de prioridad y de falla: `test_archivo_propio_tiene_prioridad_sobre_la_url_externa_en_media_kind`, `test_quitar_el_archivo_propio_deja_la_url_externa_como_principal`, `test_fallo_del_storage_al_subir_devuelve_502_y_conserva_el_archivo_anterior`.
- [x] 6.10 Correr `make test-backend` y `make lint-backend` en verde.
- [x] 6.11 Agregar a `backend/tests/test_storage.py` el caso `test_presigna_contra_el_endpoint_publico_y_opera_contra_el_interno`: construir `S3ObjectStorage` con endpoint interno `http://minio:9000` y público `http://localhost:9000`, y verificar que la URL firmada apunta a `localhost:9000` y que sigue siendo idéntica entre dos llamadas dentro de la misma ventana de cuantización.

## 7. Frontend

- [x] 7.1 Crear `frontend/src/services/exercises.ts` con los tipos (`Exercise`, `ExerciseMeta`, `ExercisesParams`, inputs de create/update) y las funciones de fetch, incluida la subida con `FormData`.
- [x] 7.2 Agregar el dominio `exercises` a `frontend/src/services/queryKeys.ts` (`all` / `list(params)` / `detail(id)` / `meta()`) — único lugar del repo donde se escribe una key.
- [x] 7.3 Crear `frontend/src/services/exercises.queries.ts` con los hooks; `useExerciseMetaQuery` con `staleTime: Infinity` y toda mutación invalidando `queryKeys.exercises.all` (patrón de `membershipPlans.queries.ts`).
- [x] 7.4 Crear `frontend/src/pages/Exercises.tsx` con `ListPageLayout` + `Pagination` + header sticky, columnas nombre / grupo / tipos / media / estado, siguiendo `MembershipPlans.tsx`.
- [x] 7.5 Implementar los filtros del listado: búsqueda por nombre con `useDebounce`, selector de grupo muscular y de tipo alimentados por `GET /exercises/meta`, y filtro activo / inactivo / todos, combinables.
- [x] 7.6 Crear `CreateExerciseDialog.tsx` y `EditExerciseDialog.tsx` en `frontend/src/components/` con nombre, descripción, selector de grupo (0..1), multi-select de tipos (0..n), input de URL externa e input de archivo.
- [x] 7.7 Implementar el alta con archivo como las **dos** requests de D12 (`POST /exercises/` y después `POST /exercises/{id}/media`), con manejo de la falla parcial: el ejercicio queda creado y el diálogo ofrece reintentar solo la subida.
- [x] 7.8 Implementar el preview de media leyendo `media_kind` del backend (**sin** reimplementar la regla de prioridad): `<video controls preload="metadata">` o `<img>` según `media_content_type`, o link si es externa.
- [x] 7.9 Agregar las acciones de desactivar / reactivar con `ConfirmActionDialog`, y la de borrar, que ante un `409` muestra el motivo y ofrece desactivar en su lugar.
- [x] 7.10 Registrar la ruta `/exercises` en `frontend/src/App.jsx` con `<ProtectedRoute roles={["owner","coach"]}>` y `lazy(() => import("./pages/Exercises"))` **directo**, no por `routeImporters` (D12).
- [x] 7.11 Agregar el botón "Ejercicios" en el header de `frontend/src/pages/Routines.tsx` (S4: la entrada va acá, **no** en el Sidebar).
- [x] 7.12 Crear `frontend/src/pages/__tests__/Exercises.test.tsx` con los casos `muestra el listado con grupo muscular y tipos de entrenamiento`, `filtra por grupo muscular al elegirlo en el selector`, `crea un ejercicio y sube el archivo de media en la misma confirmación`, `muestra el archivo propio cuando el ejercicio tiene archivo y URL externa` y `ofrece desactivar en vez de borrar cuando el ejercicio está en uso`.
- [x] 7.13 Agregar a `frontend/src/pages/__tests__/Routines.test.tsx` el caso `ofrece la entrada a Ejercicios desde el header`.
- [x] 7.14 Correr `make test-frontend` y `make lint-frontend` en verde.

## 8. Infraestructura local

- [x] 8.1 Agregar el servicio `minio` a `docker-compose.yml` con la imagen **pineada** a un `RELEASE.*` concreto (no `latest`), `server /data --console-address ":9001"`, puertos 9000/9001, volumen `gymapp_minio_data` y healthcheck contra `/minio/health/live`.
- [x] 8.2 Agregar el servicio one-shot `minio-init` (`minio/mc`) que espera el healthcheck, crea el bucket si no existe y sale — crear el bucket a mano rompería `make docker-up` para el próximo que clone el repo.
- [x] 8.3 Agregar `depends_on: minio: {condition: service_healthy}` al servicio `backend` y declarar el volumen nuevo.
- [x] 8.4 Documentar las variables `STORAGE_*` en `backend/.env.example` (MinIO en `localhost:9000`) y en `backend/.env.docker.example` (apuntando al servicio `minio`).
- [x] 8.5 Agregar `STORAGE_PUBLIC_ENDPOINT_URL=http://localhost:9000` a `backend/.env.docker.example` (y dejarla vacía, con el comentario de por qué, en `backend/.env.example`): Compose es el único entorno donde hablar y firmar usan hostnames distintos (D3.1).
- [x] 8.6 Verificar el flujo local completo **sin tocar `/etc/hosts`**: `make docker-up`, confirmar el bucket `gymapp-media` en `http://localhost:9001`, crear en `/exercises` un ejercicio con grupo `Cuádriceps` y tipo `Fuerza`, subirle un mp4 de ~5 MB, recargar y comprobar que el video reproduce, hace seek, y que la URL del `<video>` apunta a `localhost:9000`.

## 9. Producción (Railway)

- [ ] 9.1 Crear el Storage Bucket en el proyecto de Railway (privado, gestionado).
- [ ] 9.2 Resolver el supuesto **S3**: correr `railway variables` para ver los nombres reales que expone el bucket, mapearlos a las `STORAGE_*` del backend con referencias `${{...}}`, y dejar el mapeo anotado en `backend/AGENTS.md` para el próximo que lo configure. **No setear `STORAGE_PUBLIC_ENDPOINT_URL`**: el bucket gestionado tiene endpoint único y público, el fallback de D3.1 ya hace lo correcto y producción no gana ningún paso nuevo.
- [ ] 9.3 Deployar el backend y **correr la migración a mano por CLI** (`railway run alembic upgrade head`): en este proyecto **el deploy no corre migraciones automáticamente**.
- [ ] 9.4 Reseedear el catálogo en producción: `DELETE FROM exercises WHERE id NOT LIKE 'custom-%'` y entrar una vez a Rutinas para que `_ensure_seed_data` lo reconstruya con la lista fija. Descarta registros de entrenamiento y configuraciones de plantilla de prueba — aceptado bajo la regla de BETA de `AGENTS.md`.
- [ ] 9.5 Verificar en producción desde otro browser: subir un mp4 a un ejercicio y reproducirlo (valida credenciales reales, path-style y el acceso prefirmado del bucket gestionado, que es donde MinIO y Railway pueden diferir).

## 10. Documentación

- [x] 10.1 `docs/producto/04-rutinas.md` §0: reescribir el supuesto **R1**, que hoy dice que el video/GIF es una URL externa y que no hay subida de archivos en el MVP. Ahora hay **los dos** campos, independientes y opcionales, y el archivo propio tiene prioridad si están ambos.
- [x] 10.2 `docs/producto/04-rutinas.md` §5, fila "Permisos": la tabla es "qué existe hoy | qué cambia". **No tocar la celda izquierda** (describe el estado actual); cambiar la derecha, que hoy dice "Sin cambios (D10)", para registrar que el Coach también mantiene el catálogo de ejercicios.
- [x] 10.3 `docs/producto/04-rutinas.md` §6: tachar en R-2 la parte que este change cierra (CRUD, pantalla de alta, media, grupo de lista fija, tipos, desactivación) y dejar explícito que **"Deprecar la base" sigue pendiente** y pasa a depender de R-4 — está fuera de alcance de este change.
- [x] 10.4 `docs/producto/01-roles-y-permisos.md` §2.3, fila "Crear / editar / desactivar ejercicio del catálogo": Coach ❌ → ✅ (hereda, D10) y retirar la nota "Sin pantalla de alta; sin video ni tipos", que este change deja obsoleta.
- [x] 10.5 `docs/producto/09-backlog-mvp.md` Fase 2: anotar `add-exercise-catalog` en la columna "Change" de R-2, con la misma aclaración de 10.3 sobre la parte que queda pendiente.
- [x] 10.6 `docs/producto/09-backlog-mvp.md` tabla Post-MVP: **partir** la fila "Subida de video/imagen para ejercicios, catálogos administrables de grupos y tipos" — sacar la subida de video/imagen (la resuelve este change) y **conservar** los catálogos administrables de grupos y tipos, que siguen siendo Post-MVP (R2).
- [x] 10.7 `backend/AGENTS.md`: documentar la dependencia `boto3`, las variables `STORAGE_*` —incluida `STORAGE_PUBLIC_ENDPOINT_URL` y la tabla de qué endpoint usa cada entorno (D3.1)—, el puerto de storage con sus dos adaptadores y sus dos clientes de boto3, cómo la suite corre sin red (`STORAGE_BACKEND=memory` + override de `get_storage`) y los dos archivos de tests nuevos.
- [x] 10.8 `frontend/AGENTS.md`: documentar la pantalla `/exercises`, su entrada desde el header de Rutinas y el archivo de tests nuevo.
- [x] 10.9 `AGENTS.md` raíz: mencionar el servicio `minio` de `docker-compose.yml` en la sección de comandos de desarrollo, para que `make docker-up` no traiga una sorpresa.

## 11. Cierre

- [x] 11.1 `make lint` y `make test` en verde en las dos apps.
- [x] 11.2 `make check-plan CHANGE=add-exercise-catalog` sin `FALLA` (los 36 casos automatizados del Plan de verificación tienen que existir con el nombre exacto).
- [x] 11.3 `openspec validate add-exercise-catalog --strict` en verde.

## 12. Correcciones de verificación (veredicto FALLA de `verification.md`)

> Los 11 hallazgos de la primera corrida de `/opsx:verify` (2026-09-12). H6 y H7 quedan sin tocar
> a propósito: son decisiones de comportamiento/diseño que le corresponden al Arquitecto, no un
> bug de implementación — reportados, no resueltos acá.

- [x] 12.1 H1 (bloqueante) — `schemas.RoutineExerciseOption.muscle_group` a `Optional[str]`
  (`backend/app/schemas.py`); `frontend/src/types.ts::RoutineExerciseOption.muscle_group` a
  `string | null` (revisado: el único consumidor de `RoutineDay` en el frontend lee
  `day.muscle_groups`, nunca `exercise.muscle_group`, así que no hay render que arreglar). Test
  nuevo `test_ejercicio_sin_grupo_muscular_no_rompe_routines_days`
  (`backend/tests/test_exercises.py`).
- [x] 12.2 H2 (bloqueante) — `sync_exercise_day_links` (`backend/app/routers/routines.py`) ya no
  borra un `TrainingDayExercise` referenciado por algún `RoutineTemplateExercise`, aunque el
  ejercicio cambie de grupo muscular por `PATCH`. Extendido
  `test_editar_ejercicio_usado_en_plantilla_no_rompe_la_referencia`
  (`backend/tests/test_exercises.py`) para cubrir también el cambio de `muscle_group`, no solo
  `name`/`description`.
- [x] 12.3 H3 (mayor) — `ExerciseUpdate.name_not_blank` (`backend/app/schemas.py`) rechaza también
  `None` explícito, no solo una `str` en blanco (que `strip_strings` ya convertía a `None` antes
  de que este validador corriera). Casos nuevos en
  `test_nombre_vacio_o_solo_espacios_devuelve_422`.
- [x] 12.4 H4 (mayor) — **SUPERADA por 12.13, el código que describe ya no existe.** Este primer
  intento cuantizaba el reloj de firma monkeypatcheando `botocore.auth.get_current_datetime` bajo
  lock; el re-review encontró que la captura del original quedaba fuera de la sección crítica y
  dos hilos concurrentes podían congelar ese símbolo de forma permanente en todo el proceso. Se
  reemplazó por el memo de URL por `(key, ventana)` de 12.13. Se deja anotada para que el
  historial del change no sugiera volver a esta solución. Texto original: cuantizar
  también el reloj de firma y fijar
  `X-Amz-Expires` a una constante (`ttl + window`) en vez de derivarlo del reloj real: la firma ya
  no varía segundo a segundo dentro de la ventana. Reescrito
  `test_presigna_contra_el_endpoint_publico_y_opera_contra_el_interno`
  (`backend/tests/test_storage.py`) para simular el paso real del tiempo (antes probaba dos
  llamadas back-to-back en el mismo segundo, sin ejercitar la propiedad) y sumado el caso de
  cruce de ventana.
- [x] 12.5 H5 (mayor) — el `upgrade()` de
  `backend/migrations/versions/c387dcc091c2_add_exercise_catalog.py` deduplica
  `name_normalized` durante el backfill (renombra las filas siguientes de cada grupo de
  duplicados con el sufijo `" (dup N)"`, nunca borra) antes de `create_unique_constraint`.
  Estrategia documentada en el docstring de la migración.
- [x] 12.6 H8 (menor) — `EditExerciseDialog.tsx` mantiene un estado `mediaExercise` propio,
  actualizado con lo que devuelven `upload`/`delete` de media, para que el preview no quede
  pegado a la copia congelada que pasó `Exercises.tsx` al abrir el diálogo.
  `H9` (menor) — `Exercises.tsx`: si el ejercicio ya está inactivo, el diálogo de borrado ya no
  ofrece "Desactivar en su lugar" (sería un segundo 409); solo informa y cierra.
  `H10` (menor) — `CreateExerciseDialog.tsx`: el botón "Crear ejercicio" se deshabilita una vez
  que el alta ya creó el ejercicio y falló solo la subida (`createdExercise` seteado), para que
  reintentar no dispare un segundo `POST /exercises/` con el mismo nombre.
  `H11` (menor) — `docker-compose.yml`: `backend` agrega `depends_on: minio-init:
  {condition: service_completed_successfully}` (además de `minio: service_healthy`), para no
  levantar antes de que el bucket exista.
- [x] 12.7 H6 y H7 — reportados a `role-architect`. **Resueltos en `design.md`**: H6 se arregla
  (nueva decisión D7.1), H7 se arregla a medias y se acepta a medias (nueva decisión D4.1). Las
  tasks concretas son 12.8 a 12.11.
- [x] 12.8 H6 — **arreglar**: `activate_exercise` (`backend/app/routers/exercises.py`) deja de
  poner `is_active = True` en los `day_links`; solo pone `Exercise.is_active = True` (D7.1). Un
  ejercicio reactivado queda igual que uno recién creado: en el catálogo y sin seleccionar en
  ningún día.
- [x] 12.9 H6 — test nuevo `test_reactivar_no_reactiva_la_seleccion_por_dia_del_catalogo_fijo` en
  `backend/tests/test_exercises.py`: excluir un ejercicio de un día con
  `PUT /routines/days/{day_id}/selection`, desactivarlo y reactivarlo desde `/exercises`, y
  verificar que **no** vuelve a la selección de ese día ni al `active_exercise_count`.
- [x] 12.10 H7 — **arreglar la parte que era una promesa incumplida** (D4.1): en
  `upload_exercise_media` retirar el chequeo de `Content-Length` (no ahorra nada porque Starlette
  ya parseó, y cuenta los boundaries del multipart) y el bucle que acumula `chunks: list[bytes]` +
  `b"".join(chunks)`. Queda: `file.size > STORAGE_MAX_UPLOAD_BYTES` ⇒ `413`; leer 16 bytes para el
  sniff; `seek(0)`; pasar `file.file` a `upload_fileobj`. El archivo deja de materializarse en
  memoria y un archivo de exactamente el límite deja de rechazarse.
- [x] 12.11 H7 — test nuevo `test_archivo_de_exactamente_el_limite_se_acepta` en
  `backend/tests/test_exercise_media.py` (cubre el bug de los boundaries que arregla 12.10).
  **No** se agrega test para la parte aceptada de H7: que el cuerpo se reciba antes del `413` es
  una limitación documentada en D4.1, no un comportamiento a fijar.
- [x] 12.12 A1 (re-review) — cinco schemas más de `backend/app/schemas.py` declaraban
  `muscle_group: str` no-opcional contra la columna nullable: `RoutineCatalogExercise`,
  `RoutineCatalogGroup`, `RoutineExerciseManageOut`, `RoutineTemplateExerciseOut` y
  `WorkoutLogOut`, ahora `Optional[str] = None`. También `routine_catalog()`
  (`backend/app/routers/routines.py`) ordenaba los grupos con `sorted(..., key=lambda item:
  item[0])`, que explota comparando `None` contra `str` en Python 3 — corregido a `(item[0] is
  None, item[0] or "")`. Espejo en frontend (`types.ts`: `RoutineCatalogGroup`,
  `RoutineExerciseManage`, `WorkoutLog`, `RoutineTemplateExercise` a `string | null`) y fallback
  visual "Sin grupo muscular" en `UserRoutine.tsx`/`RoutineTemplateDetail.tsx`. Test extendido:
  `test_ejercicio_sin_grupo_muscular_no_rompe_routines_days` ahora cubre las cuatro superficies
  nombradas por el hallazgo más el detalle de plantilla.
- [x] 12.13 A3 (re-review) — H4 volvió a fallar: la captura de
  `original_get_current_datetime` en `backend/app/storage.py` quedaba fuera del
  `with _presign_clock_lock`, así que un interleaving entre hilos podía dejar
  `botocore.auth.get_current_datetime` parcheado para siempre (proceso corrupto,
  `RequestTimeTooSkewed` a los 15 min). Rehecho por completo: se retira el
  monkeypatch del reloj de botocore y se memoiza la URL firmada en un dict
  `{(key, ventana): url}` protegido por `threading.Lock`, firmando con el reloj
  real y `ExpiresIn = ttl + window` (constante) solo en el miss; desalojo
  descartando toda entrada de una ventana que no sea la actual. D3.1 intacto
  (se sigue firmando con `self._sign_client`). Reescrito
  `test_presigna_contra_el_endpoint_publico_y_opera_contra_el_interno` para
  seguir probando la identidad dentro de la ventana y el cambio al cruzarla sin
  depender del reloj real del proceso (`_frozen_at`, congela `time.time` +
  `botocore.auth.get_current_datetime` solo dentro del test). Verificado además
  con un repro de 8 hilos × 200 llamadas: `botocore.auth.get_current_datetime`
  queda intacto al terminar.
