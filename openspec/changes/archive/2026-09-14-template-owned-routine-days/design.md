## Context

Hoy el modelo de rutinas tiene **dos niveles de indirección** que el producto no pidió:
`RoutineTemplate` → `RoutineTemplateDay` (una referencia a `TrainingDay`, el catálogo global de 4
días fijos de `backend/app/routine_catalog.py`) → `TrainingDayExercise` (vínculo global
día↔ejercicio, **derivado** del `muscle_group` del ejercicio) → `RoutineTemplateExercise` (fila
rala por `(template_id, day_id, exercise_id)` con `is_active` + `strategy`, con fallback a
`(True, constant)`). El resultado es que "los días" no son de nadie: son del sistema, y las
plantillas apenas los apuntan.

Estado verificado sobre el working tree (no repetido del proposal):

- `backend/app/models.py`: `TrainingDay` (id semántico `day-1..day-4`, `muscle_groups` como String
  con comas, `day_order` **unique global**), `TrainingDayExercise` (sin `is_active` desde
  `drop-static-exercise-catalog` D10), `RoutineTemplateDay` (solo `template_id`+`day_id`+`position`),
  `RoutineTemplateExercise` (`is_active`+`strategy`, sin base propia), `WorkoutLog.day_id` FK a
  `training_days` con `ondelete="CASCADE"`, `RoutineAssignmentBase` por `(assignment_id,
  exercise_id)` — sin día.
- `backend/app/routers/routines.py` (1257 líneas) concentra: el catálogo fijo
  (`ensure_training_days`, `_day_ids_for_muscle_group`, `sync_exercise_day_links`), tres endpoints
  de lectura del catálogo global (`GET /routines/catalog`, `/routines/days`, `/routines/exercises`),
  la edición de la base del catálogo (`PUT /routines/exercises/{id}`, owner-only), overview/logs/
  progreso del Miembro y del staff, y el PDF de progreso. **Todo lo que lee días lee
  `training_days`**, no la plantilla asignada: hoy un Miembro ve los 4 días fijos completos aunque
  su plantilla tenga 2.
- `backend/app/routers/routine_templates.py`: `_resolve_exercise_config` y `_offered_as_new_option`
  son los dos predicados que sostienen la indirección; `routine_assignments.py` los importa para que
  "Mi rutina" y el detalle de plantilla coincidan (D10.6 del change anterior).
- `backend/app/routers/exercises.py` importa `ensure_training_days` y `sync_exercise_day_links`
  desde `routines.py` y los llama en `create_exercise`/`update_exercise`.
- `GET /exercises/` **ya** filtra por `q`, `muscle_group`, `training_type`, `is_active`, pagina con
  `X-Total-Count` y devuelve `name` + `muscle_group` + `training_types`: es exactamente lo que pide
  el buscador de la spec (D8), sin agregarle ningún campo.
- Frontend: la ruta `/routines` es el **listado de plantillas** (`pages/Routines.tsx`), y
  `/routines/:templateId` el detalle (`pages/RoutineTemplateDetail.tsx`). La "vista admin de
  configuración global de días con switches" que nombra el proposal **no es una pantalla aparte**:
  vive dentro del detalle de plantilla (un `Switch` por ejercicio + `StrategyChips`, ambos con
  autosave contra `PUT /routines/templates/{id}/days/{day_id}/exercises/{exercise_id}`). No hay
  ninguna ruta `/rutinas` en `App.jsx` — el listado sigue en `/routines` y **no se retira**.
- `CreateRoutineTemplateDialog` y `EditRoutineTemplateDialog` piden `day_ids` contra
  `GET /routines/days` (`useTrainingDaysQuery`). `EditExerciseBaseDialog` edita la base **del
  catálogo** desde el detalle de plantilla vía `PUT /routines/exercises/{id}`; ese endpoint, esos
  tres campos de `Exercise` y ese diálogo-contra-el-catálogo se retiran en este change (D7).
- La base del catálogo hoy solo se **lee** (`POST /exercises/` no la acepta: `ExerciseCreate` no
  tiene los campos y el alta cae en los `server_default` 3/10/0 de las columnas) y solo se
  **escribe** desde ese `PUT` owner-only. Su cobertura entera vive en
  `backend/tests/test_exercise_base.py` (6 casos), que deja de tener objeto.
- `main.jsx` usa `<BrowserRouter>` + `<Routes>` (react-router 7 **sin** data router): `useBlocker`
  no está disponible. Relevante para el aviso de borrador sin guardar (D11).
- Alembic: head único `030412411aba` (`drop_training_day_exercise_is_active`). La suite arma el
  esquema con `Base.metadata.create_all` sobre SQLite, **no** corriendo migraciones
  (`backend/tests/conftest.py`), con la fixture opt-in `catalog_basic` y el helper
  `create_exercise` de `tests/helpers.py`.
- `drop-static-exercise-catalog` está implementado pero **sin archivar** (veredicto FALLA →
  corregido en la fase 14 de sus tasks). Este change se apoya sobre su estado final y **lo
  supera**: retira el vínculo derivado entero, que es el concepto que sus D2/D8/D10 pelearon tres
  rondas.

Restricción de proyecto que aplica entera: `AGENTS.md` §"El proyecto está en BETA" — el diseño
correcto sobre el compatible, migración de esquema sin backfill, sin deprecación gradual.

## Goals / Non-Goals

**Goals:**

- Que el día sea **propiedad** de la plantilla: una fila que nace y muere con ella, con su grupo
  muscular y sus ejercicios propios, sin ninguna referencia a un catálogo compartido.
- Que la base y la estrategia de un ejercicio dentro de un día sean **datos de la plantilla**, no
  un fallback calculado sobre filas ralas.
- Que el histórico de `WorkoutLog` sea inmune a la edición de la plantilla (quitar un ejercicio,
  quitar un día, reasignar).
- Un único request de guardado para todo el borrador de días y ejercicios.
- Que la base por defecto de un ejercicio recién agregado sea una **constante única** (3 × 10 · 0
  kg), no un valor copiado de otra entidad.
- Retirar, en el mismo change, todo lo que queda sin dueño: `routine_catalog.py`, `TrainingDay`,
  `TrainingDayExercise`, `sync_exercise_day_links`, `ensure_training_days`, los tres endpoints de
  lectura del catálogo global, los dos predicados de fallback, y la base editable del catálogo
  (`Exercise.base_sets/base_reps/base_weight_kg` + `PUT /routines/exercises/{id}`).

**Non-Goals:**

- Cambiar el motor de progresión (`progression.py`): `plan_sets` sigue igual, solo cambia de dónde
  sale la base.
- Reordenar días (cambiar un Día 3 a Día 1): **fuera de alcance confirmado** por el proposal. Las
  specs piden reordenar **ejercicios** dentro de un día; los días se identifican por su posición y
  esta se renumera al quitar uno. El contrato de D5 lo soportaría gratis (el orden de la lista es
  la posición), pero la UI no lo ofrece en este change.
- La **asignación como copia** (que asignar una plantilla clone la rutina para ese Miembro, editable
  solo para él, con progreso propio, retirando `routine_assignment_bases`). Es un change
  **posterior**, ya decidido: acá la asignación sigue siendo una referencia y los cambios del
  Coach se ven en vivo (D4 y D10). Ver Risks.
- Compartir o clonar días entre plantillas ("duplicar plantilla" no está en las specs).
- Rediseñar la asignación a Miembros más allá de lo que obliga el modelo nuevo.
- Migrar la app a `createBrowserRouter` (ver D11).

## Decisions

### D1. Tres tablas nuevas propias de la plantilla; `training_days` y `training_day_exercises` se dropean

El modelo pasa a ser un árbol de propiedad, sin nodos compartidos:

```
routine_templates
└── routine_template_days            (id, template_id, position 1..5)
    ├── routine_template_day_muscle_groups  (template_day_id, muscle_group, sort_order)
    └── routine_template_day_exercises      (id, template_day_id, exercise_id, sort_order,
                                             strategy, base_sets, base_reps, base_weight_kg,
                                             updated_at, updated_by_user_id)
```

- **`routine_template_days` se reusa como nombre de tabla pero cambia de significado**: pierde
  `day_id` (la FK al catálogo) y gana los grupos musculares. Ya no es "qué días del catálogo
  incluye esta plantilla" sino "los días de esta plantilla". `UniqueConstraint(template_id,
  position)`, FK `template_id` `ondelete=CASCADE`. **No** hay columna `name`: el título "Día N" se
  deriva de `position` en el serializador (una sola fuente de verdad para el renumerado). El máximo
  de 5 y el mínimo de 1 se validan en el endpoint, no con un CHECK: son reglas de la operación de
  guardado (D5) y un CHECK por fila no puede expresar "al menos una".
- **`routine_template_day_muscle_groups`**: PK compuesta `(template_day_id, muscle_group)`,
  `sort_order` para el orden de visualización, FK `ondelete=CASCADE`. Es el mismo patrón que
  `ExerciseTrainingType` (0..n valores de un enum de Python, validados en Pydantic, columna
  `String`) — el precedente del repo para multi-valor.
- **`routine_template_day_exercises`**: `UniqueConstraint(template_day_id, exercise_id)` (I3),
  índice en `exercise_id` (lo consultan `_exercise_in_use` y la validación de logs), FK a
  `exercises` con `ondelete=CASCADE` (consistente con las otras cuatro FKs a `exercises.id`, y
  `delete_exercise` sigue bloqueado por `_exercise_in_use`), FK a `routine_template_days` con
  `ondelete=CASCADE`. Guarda la **base propia** (`base_sets`/`base_reps`/`base_weight_kg`, NOT NULL,
  con `default`/`server_default` = la constante de D5) y la estrategia.
  `updated_at`/`updated_by_user_id` se conservan porque el detalle ya los expone. Estas tres
  columnas son ahora el **único** lugar del modelo donde existe una base: las homónimas de
  `Exercise` se dropean (D7).
- `RoutineTemplateExercise` (la tabla rala vieja) **se dropea**: su `is_active` desaparece con el
  requirement "Composición de una plantilla por día y ejercicio" (REMOVED en la spec), y su
  `strategy` se muda a la tabla nueva. Estar en la plantilla ahora es existir; no hay estado
  "agregado pero apagado".

Alternativas descartadas:

- *Conservar `TrainingDay` y darle un `template_id` nullable (días globales + días propios).*
  Rechazada: mantiene vivas las dos semánticas a la vez, obliga a que todo query filtre por
  "global o mío", y es exactamente la capa de compatibilidad que la regla de BETA prohíbe.
- *Grupos musculares como String con comas (`"Pecho, Tríceps"`), como hoy en `TrainingDay`.*
  Rechazada: obliga a `split`/`join` en los cinco lugares que lo leen, no puede indexarse por
  grupo, y un valor con coma la rompe en silencio. El costo de la tabla hija es una migración más
  y un `joinedload`.
- *Grupos musculares como `ARRAY(String)` o JSON.* Rechazada: `ARRAY` es Postgres-only y la suite
  corre en SQLite; JSON deja el enum sin validar a nivel de esquema y sin poder consultarse.
- *Una sola tabla `routine_template_exercises` con `day_position` en vez de FK al día.* Rechazada:
  el día pasa a no existir como fila, así que no puede ser referenciado por `WorkoutLog` (D3) ni
  tener grupos musculares propios, y renumerar posiciones se vuelve un `UPDATE` masivo.

### D2. `routine_catalog.py` y todo el andamiaje derivado se retiran en este change

Se borran: `backend/app/routine_catalog.py` (`TRAINING_DAYS`), `ensure_training_days` (y sus 21 call
sites), `_day_ids_for_muscle_group`, `sync_exercise_day_links`, `_serialize_day`,
`_serialize_manage_exercise`, `_get_day_or_404`, `_resolve_exercise_config` y
`_offered_as_new_option`. `routers/exercises.py` deja de importar de `routines.py` (queda sin
ninguna dependencia hacia el módulo de rutinas, que es la dirección correcta: el catálogo no sabe
de rutinas).

Con eso desaparecen, de una vez, los tres modos de fallo que `drop-static-exercise-catalog`
documentó y no pudo cerrar: el vínculo que se mueve solo al editar el grupo muscular (H2), la
"cicatriz" por día (D8→D10) y el desacuerdo entre el detalle de plantilla y "Mi rutina" (hallazgo
7). Un ejercicio ya no "pertenece" a un día: alguien lo **agregó** a un día de una plantilla, y eso
es una fila explícita creada por un humano.

Alternativa descartada: *dejar `TRAINING_DAYS` como sugerencia de armado ("plantillas sugeridas")*.
Rechazada: ninguna spec la pide y volvería a ser una lista de ids del seed dentro de `app/`.

### D3. `WorkoutLog` apunta al día de la plantilla con `ondelete=SET NULL` + nombre denormalizado

Es la decisión que sostiene el requirement "El histórico de registros sobrevive a un ejercicio
quitado de la plantilla" y su equivalente para días.

- `WorkoutLog.day_id`: FK a `routine_template_days.id`, **nullable**, `ondelete="SET NULL"` (hoy es
  NOT NULL a `training_days` con `CASCADE` — o sea, hoy borrar un día borraría el histórico).
- `WorkoutLog.day_name`: `String` **NOT NULL**, snapshot de `"Día {position}"` en el momento del
  alta. Es lo que muestran el listado de logs, el PDF y el resumen de progreso; sin él, un día
  borrado deja el histórico sin etiqueta.
- `WorkoutLog.exercise_id` **no cambia** (FK a `exercises` con CASCADE): quitar un ejercicio de un
  día borra la fila de `routine_template_day_exercises`, **no** la fila de `exercises`, así que el
  log no se toca. Eso es todo lo que hace falta para el escenario de la spec — el histórico
  sobrevive porque nunca dependió de la configuración de la plantilla.

Alternativas descartadas:

- *`ondelete=CASCADE` al día (lo de hoy).* Rechazada: quitar el Día 3 de una plantilla borraría los
  entrenamientos que el Miembro registró ahí. Es el escenario que la spec prohíbe explícitamente.
- *`RESTRICT`: prohibir quitar un día que tenga logs.* Rechazada: convierte el histórico en un
  candado sobre la edición de la plantilla; el Coach no puede reorganizar una rutina porque alguien
  entrenó. La spec dice "rechaza quitar el **último** día", no "el día con logs".
- *No denormalizar el nombre y renderizar "Día eliminado".* Rechazada: pierde información que
  tenemos gratis al insertar, y deja el PDF de progreso con filas anónimas.
- *Denormalizar también el nombre del ejercicio.* Rechazada por ahora: `exercises` solo se borra por
  `DELETE /exercises/{id}`, que ya está bloqueado por `_exercise_in_use` cuando hay logs. No hay
  camino que deje un log sin ejercicio.

### D4. `routine_assignment_bases` sigue por `(assignment_id, exercise_id)`, sin día

La base propia de la plantilla ahora vive por `(día, ejercicio)`, así que el ajuste por cliente
**podría** querer la misma granularidad. No se cambia:

- Las specs de `routine-assignment` hablan siempre de "la base de *Press banca plano* para ese
  Miembro", nunca de un día. El modelo mental del staff es por ejercicio.
- Si el mismo ejercicio está en dos días de la plantilla, el ajuste aplica a los dos. Es
  defendible (es el peso que ese cliente levanta) y es el comportamiento actual.
- Cambiarlo obliga a mover el path del endpoint (`/bases/{exercise_id}` → con segmento de día) y a
  tocar `AssignTemplateDialog` + `AdjustExerciseBaseDialog`, sin requirement que lo respalde.

Lo que **sí** cambia: `_validate_exercise_in_template` deja de consultar `TrainingDayExercise` y
pasa a consultar `routine_template_day_exercises` por los días de la plantilla. Y el escenario
"quitar de la plantilla un ejercicio con ajuste de base" se cumple sin código nuevo: la fila de
`routine_assignment_bases` **queda** (no hay FK que la borre) pero deja de tener efecto porque ya
no hay ningún `routine_template_day_exercises` que la consuma. Eso es literal lo que pide la spec
("el ajuste deja de tener efecto… la asignación y el histórico se conservan intactos").

Alternativa descartada: *borrar el ajuste cuando se quita el ejercicio del día.* Rechazada: si el
Coach lo vuelve a agregar, el ajuste del cliente vuelve a aplicar, que es el comportamiento menos
sorprendente; y borrar pierde la autoría sin que nadie lo pida.

### D5. El guardado es **un `PUT` de reemplazo completo con identidad explícita**, no deltas

Contrato nuevo:

```
PUT /routines/templates/{template_id}/days        (Dueño/Coach) → RoutineTemplateDetail
{
  "days": [
    { "day_id": "uuid-existente" | null,
      "muscle_groups": ["Pecho", "Tríceps"],
      "exercises": [
        { "exercise_id": "…",
          "strategy": "pyramid",
          "base": { "sets": 4, "reps": 8, "weight_kg": 45 }   // opcional
        }
      ]
    }
  ]
}
```

- **El orden de las listas es el dato**: la posición del día es su índice + 1 (1..N), y el
  `sort_order` del ejercicio es su índice. No se mandan números de orden; así no puede llegar un
  payload con posiciones duplicadas o con huecos, y el "reordenar ejercicios" de la spec es
  simplemente otro orden de la lista.
- **`day_id: null` significa "día nuevo"**; un `day_id` presente tiene que pertenecer a la
  plantilla (400 si no). Esta es la parte que hace que "reemplazo completo" sea seguro: los días
  que sobreviven **conservan su fila y su id**, así que los `WorkoutLog` que los referencian no se
  tocan. Los días de la plantilla que no aparecen en el payload se borran (y con ellos sus grupos
  musculares y sus ejercicios, cascade — escenario "Quitar un día distinto del último elimina su
  configuración").
- **Validaciones**: `1 <= len(days) <= 5` (422 vía Pydantic, cubre "no se puede agregar un sexto
  día" y "no se puede quitar el último día"); `muscle_group` validado contra el enum `MuscleGroup`
  y deduplicado (lista vacía permitida: "Día 1 sin grupo muscular asignado"); `exercise_id`
  existente (400) y **activo**, salvo que ya estuviera en ese día antes del guardado (D9);
  `exercise_id` sin repetir dentro de un mismo día (422).
- **La base por defecto es una constante del servidor, no un valor copiado**: si `base` viene
  ausente para un par `(día, ejercicio)` que **no** existía, se aplica la constante **3 series × 10
  repeticiones × 0 kg**. Si el par ya existía y `base` viene ausente, se conserva la que tenía. Así
  el requirement "arranca en 3×10 · 0 kg" es del backend y no depende de que el cliente lo haga
  bien (I5). `strategy` ausente en un par nuevo ⇒ `constant`.
- **Dónde vive esa constante**: en **un solo lugar del backend**,
  `backend/app/models.py` — `DEFAULT_EXERCISE_BASE_SETS = 3`, `DEFAULT_EXERCISE_BASE_REPS = 10`,
  `DEFAULT_EXERCISE_BASE_WEIGHT_KG = 0.0`, usadas a la vez como `default=` y `server_default=` de las
  tres columnas de `routine_template_day_exercises` y por el handler del `PUT` cuando construye una
  fila nueva. El router **no** repite los literales. El frontend necesita el mismo valor para pintar
  la card antes de guardar: lo declara una vez en `frontend/src/services/routineTemplates.ts`
  (`DEFAULT_EXERCISE_BASE`), marcado como espejo de conveniencia — el servidor la vuelve a aplicar
  al persistir y la respuesta del `PUT` reemplaza el borrador, así que un desfasaje se corrige solo
  al guardar y además lo detecta un test de frontend (`muestra 3×10 · 0 kg…`). Son dos
  declaraciones, una por app, y ninguna más: ni `schemas.py`, ni el seed, ni la migración repiten
  los números (la migración toma el `server_default` del modelo).
- **Una sola transacción, un solo `commit()`**: el escenario "varios cambios se persisten en un
  solo guardado" es verdadero por construcción, no por disciplina del cliente.
- La respuesta es el `RoutineTemplateDetail` completo y recalculado (con `planned_sets`), así el
  frontend reemplaza el borrador por la verdad del servidor sin un refetch extra.

Alternativas descartadas:

- *Endpoints granulares (POST día, DELETE día, POST ejercicio, PATCH orden…) con el borrador
  resuelto como una cola de requests en el cliente.* Rechazada: la spec pide explícitamente "una
  única operación"; una cola deja estados intermedios inválidos en la base (una plantilla con 0
  días entre el DELETE y el POST) y no es atómica ante un fallo a mitad de camino.
- *Reemplazo completo **sin** identidad (borrar todos los días y recrearlos).* Rechazada, y es el
  error sutil que hay que evitar: los ids nuevos dejarían a todos los `WorkoutLog` con el día en
  `NULL` en cada guardado. Rompe el histórico sin que ningún test de la plantilla se ponga rojo
  (I2 existe por esto).
- *Deltas explícitos (`{added: [...], removed: [...], updated: [...]}`).* Rechazada: el cliente
  igual tiene que calcularlos, el servidor igual tiene que validarlos contra el estado actual, y
  dos borradores concurrentes producen resultados distintos según el orden de aplicación. El
  reemplazo idempotente es más simple de razonar y de testear.
- *Optimistic locking con `updated_at` en el payload (409 si la plantilla cambió).* Rechazada
  **para este change**: no hay requirement de edición concurrente y agrega un modo de fallo que la
  UI tendría que saber explicar. Queda anotado en Risks.

### D6. `POST /routines/templates` crea la plantilla con el Día 1 incluido; `PATCH` pierde `day_ids`

- `RoutineTemplateCreate` queda en `{name, tag}` — `day_ids` se retira del schema (no se ignora:
  un payload con `day_ids` es un 422, para que el frontend viejo falle ruidoso y no en silencio).
  El endpoint crea la plantilla **y** un `routine_template_days` en `position=1`, sin grupos
  musculares ni ejercicios (requirement "Una plantilla nueva nace con el Día 1 ya presente"). Es el
  backend quien lo crea, no el frontend con un `PUT` encadenado: así la invariante "toda plantilla
  tiene ≥1 día" (I1) vale desde el instante del `INSERT`.
- `RoutineTemplateUpdate` queda en `{name, tag}`. Toda la edición de días pasa por D5.
- `PUT /routines/templates/{id}/days/{day_id}/exercises/{exercise_id}` (el autosave del chip de
  estrategia y del switch) **se retira**: la estrategia ahora es parte del borrador.

### D7. Qué se retira y qué se reescribe de `routines.py`

| Endpoint | Destino |
|---|---|
| `GET /routines/catalog` | **Retirado**. Agrupaba ejercicios activos por grupo muscular para el catálogo global; el buscador usa `GET /exercises/` (D8). Sin consumidor en el frontend. |
| `GET /routines/days` | **Retirado**. Era el catálogo global; lo consumía `useTrainingDaysQuery` para el selector de días de los dos diálogos, que desaparece (D6). |
| `GET /routines/exercises` | **Retirado**. `RoutineExerciseManageOut` expone `day_ids`, que deja de existir. Reemplazado por `GET /exercises/` para listar y por el detalle de plantilla para la configuración. |
| `PUT /routines/exercises/{id}` (base del catálogo, owner-only) | **Retirado sin reemplazo.** El catálogo deja de tener base editable: el requirement "Base del ejercicio al crear o editar en el catálogo" está REMOVED en la spec de `routine-templates`. No se crea ningún `PUT /exercises/{id}/base`. |
| `GET /routines/users/{id}/overview`, `GET /routines/my/days`, `GET /routines/my/overview` | **Reescritos** sobre la asignación (D10). |
| `GET/POST/PATCH/DELETE` de logs (`/users/{id}/logs`, `/my/logs`) | **Reescritos**: el día es un `routine_template_days`, la validación de alta mira `routine_template_day_exercises` de la plantilla asignada, y el alta completa `day_name` (D3). |
| `progress-report` (PDF) y `progress-summary` | Solo cambian de fuente del nombre del día: `log.day_name` en vez de `log.day.name`. `unique_days` cuenta `day_id` distintos **no nulos**. |
| `GET /routines/my/profile` | Sin cambios. |

`routine_catalog.py` se borra; `routines.py` baja a los endpoints de logs/overview/progreso.
Schemas retirados: `RoutineCatalogGroup`, `RoutineCatalogExercise`, `RoutineExerciseOption`,
`RoutineExerciseManageOut`, `RoutineExerciseUpdate`, `RoutineDayOut` (reemplazado por
`RoutineTemplateDayOut`), `RoutineTemplateExerciseUpdate` (el autosave de D6).

**La base editable del catálogo se retira entera**, no se muda (decisión del producto, ya reflejada
en el proposal y en el REMOVED de la spec):

- `models.Exercise` pierde `base_sets`, `base_reps` y `base_weight_kg` (D12 dropea las tres
  columnas). `routers/exercises.py` no gana ningún endpoint: `POST /exercises/` ya no las aceptaba
  y `PATCH /exercises/{id}` tampoco, así que su contrato **no cambia**; `ExerciseOut` y
  `ExerciseMetaOut` quedan igual que hoy.
- `routine_assignments._resolve_base()` cambia de firma: recibe la fila de
  `routine_template_day_exercises` en vez del `Exercise`, y su precedencia pasa a ser "ajuste por
  cliente si existe, si no la base propia del par (día, ejercicio)" (D10). Era el único consumidor
  real que tenía la base del catálogo. Ídem `routine_templates.py:120`, que la usa para calcular
  `planned_sets` del detalle.
- Frontend: se borra `components/EditExerciseBaseDialog.tsx` en su forma actual (mutación contra el
  catálogo) y su lugar lo toma un editor de base **del borrador**, sin request, dentro de
  `RoutineTemplateDetail` (D11). `types.ts` pierde los tres campos de `Exercise`; `services/
  routineTemplates.ts` pierde `updateRoutineExerciseBase` y sus tipos.
- Tests: `backend/tests/test_exercise_base.py` se **borra** (sus 6 casos son, todos, sobre la base
  del catálogo); lo que queda vivo de esa idea se re-testea como base **de la plantilla** en
  `test_routine_templates.py`. `test_exercises.py` pierde los `base_*` que manda en algunos
  payloads y gana el caso de que el catálogo ya no expone ni acepta una base.

Alternativa descartada: *mudar la base del catálogo a `PUT /exercises/{id}/base`* (era la decisión
anterior de este mismo design). Rechazada por el producto: dos bases (una "de partida" en el
catálogo y otra por plantilla) obligan a explicar cuál gana y cuándo, y la de partida no la pide
ninguna spec viva. Una sola base, la de la plantilla, con una constante por defecto.

### D8. El buscador consume `GET /exercises/`; el filtrado de "ya agregados" es del cliente

No hay endpoint nuevo. El buscador del día llama a `GET /exercises/?q=<texto>&is_active=true&limit=20`
y **excluye en el cliente** los `exercise_id` que ya están en el borrador de **ese** día.

- `is_active=true` en el servidor: el escenario "el buscador no ofrece ejercicios inactivos" no
  puede depender del cliente.
- "Ya agregado" **sí** es del cliente y tiene que serlo: lo que cuenta es el **borrador**, no lo
  persistido. Un ejercicio que el Coach acaba de agregar sin guardar todavía no está en la base, y
  la spec pide que igual deje de ofrecerse.
- El `limit` se pide un poco más grande que lo que se muestra para que excluir no deje la lista
  corta de golpe; con "sin resultados" se muestra el mensaje de la spec.
- **`ExerciseOut` no cambia**: al retirarse la base del catálogo no hay nada que agregarle. La card
  de un ejercicio recién agregado se pinta con la constante por defecto del cliente (D5), y el
  servidor la vuelve a aplicar al persistir.

Alternativas descartadas:

- *Endpoint nuevo `GET /routines/templates/{id}/days/{day_id}/exercise-options`.* Rechazada:
  duplicaría el filtrado, la paginación y el serializador de `GET /exercises/` para agregar una
  exclusión que el servidor **no puede** calcular bien (no conoce el borrador).
- *Mandar los `exercise_id` ya agregados como query param (`exclude=`).* Rechazada: mismo
  resultado con un contrato más frágil (URL larga, tope de query string) que hacer un `filter` de
  una línea en el cliente.

### D9. Un ejercicio desactivado en el catálogo no se puede **agregar**, pero no se cae del día

Regla, en el servidor (D5) y en el buscador (D8): `Exercise.is_active` se exige solo para pares
`(día, ejercicio)` **nuevos**. Un par que ya existía en la base se conserva aunque el ejercicio
esté inactivo, y sigue apareciendo en el detalle y en el plan del Miembro.

Es la continuidad de D9/D10.5 de `drop-static-exercise-catalog` (un ejercicio desactivado deja de
ofrecerse pero no desaparece de las plantillas que ya lo usan), ahora sin ningún predicado
derivado: es una condición de la escritura, no un filtro de cada lectura. Toda lectura devuelve lo
que hay en la tabla, y punto.

Alternativa descartada: *filtrar los inactivos también en la lectura.* Rechazada: rompe el plan del
Miembro en silencio cuando el Dueño desactiva un ejercicio para reordenar el catálogo, y contradice
la spec de `exercise-catalog`.

### D10. El Miembro resuelve su rutina **por la asignación**, no por un catálogo

- **El overview y el progreso siguen siempre la asignación Activa**, y eso es ahora un requirement
  explícito de `member-routine-view` ("El overview y el progreso del Miembro siguen siempre la
  asignación Activa"), no una decisión abierta: **no** se agrega ningún `assignment_id` al contrato
  de overview ni de progreso. La pantalla "Mi rutina" sigue dejando elegir entre asignaciones para
  **navegar los días y el plan** (`GET /routines/my/templates/{assignment_id}`), y esa elección no
  mueve el overview ni el progreso.
- `GET /routines/my/days` y `GET /routines/my/overview`: días de la asignación **Activa** del
  Miembro. Sin asignación Activa ⇒ lista vacía (200, nunca 404: la UI ya tiene el estado "Todavía
  no tenés una plantilla asignada"), aunque tenga Alternativas. Una lista vacía **es** la forma en
  que el overview "indica que no hay asignación Activa" para estos dos endpoints.
- `GET /routines/users/{user_id}/overview` (staff): ídem, sobre la asignación Activa de ese usuario.
- `GET /routines/users/{id}/progress-summary` y `progress-report` (PDF): el único consumidor de
  `progress-summary` es `components/UserCard.tsx`. Ambos ganan `active_assignment: {assignment_id,
  template_name} | null` y, cuando es `null`, el resumen se calcula igual sobre el histórico pero
  la UI muestra "Sin plantilla activa" en vez del nombre de una Alternativa. Es el mínimo que hace
  observable el requirement sin inventar una pantalla nueva.
- `GET /routines/my/templates/{assignment_id}` (el plan calculado, `routine_assignments.py`): se
  simplifica fuerte — ya no hay `configs_by_key`, ni `_offered_as_new_option`, ni
  `_resolve_exercise_config`. Se leen los `routine_template_days` de la plantilla con sus
  `routine_template_day_exercises` ordenados, se aplica el override de base por cliente si existe
  (`_resolve_base`, sin cambios) y se llama a `plan_sets(strategy, ...)` con la base resultante.
  Esto es lo que hace que los cambios del Coach se vean **en vivo**: no hay copia de la plantilla en
  la asignación, la asignación es una referencia.
- Alta de log: el día tiene que pertenecer a **alguna** asignación del Miembro (Activa o
  Alternativa — la Alternativa existe para poder entrenarla) y el ejercicio tiene que estar en ese
  día (`routine_template_day_exercises`). Si no, 400 con el mensaje actual. Así un Miembro no puede
  registrar contra el día de la plantilla de otro.

Alternativa descartada: *congelar una copia de la plantilla en la asignación (snapshot).* Rechazada:
contradice el requirement "los cambios se reflejan en vivo sobre la asignación vigente" y duplica
todo el subárbol.

### D11. El borrador vive en un `useReducer` de la página, y el aviso al salir es explícito

- **Dónde vive**: `RoutineTemplateDetail.tsx` monta un `useReducer` cuyo estado inicial se deriva
  del `RoutineTemplateDetail` que devuelve React Query (`useEffect` sobre el `data` cuando cambia
  de identidad). No se guarda en `localStorage`: la spec pide "borrador local hasta guardar", no
  "borrador que sobrevive al cierre del navegador", y persistirlo abre la pregunta de qué pasa si
  otro usuario editó la plantilla mientras tanto.
- **Sucio**: el reducer mantiene el snapshot original y `dirty` se calcula comparando la forma
  serializada del borrador contra ese snapshot (`JSON.stringify` de la estructura normalizada). Un
  flag booleano que cada acción prende sería más barato pero marca sucio a un cambio que el usuario
  deshizo a mano, y eso produce avisos falsos que enseñan a ignorar el aviso.
- **Aviso al salir**: `main.jsx` usa `<BrowserRouter>`, así que `useBlocker` **no** está
  disponible (requiere data router). Se implementa con dos piezas:
  1. `stores/unsavedChanges.ts` (zustand, mismo patrón que `stores/session.ts`): un flag global que
     la página prende/apaga.
  2. Un hook `useGuardedNavigate()` que consulta ese flag y, si está sucio, abre un
     `ConfirmActionDialog` ("Tenés cambios sin guardar" · "Descartar y salir" / "Seguir editando")
     en vez de navegar. Lo usan el botón "Volver a Rutinas" de la página y el `onClick` de los
     links del `Sidebar`. Más un `beforeunload` para cerrar/recargar la pestaña.
- **Editar la base y la estrategia** de un ejercicio del día es **una acción del reducer**, no un
  request: el diálogo que hoy es `EditExerciseBaseDialog` (mutación contra el catálogo) pasa a ser
  un editor local que despacha `SET_EXERCISE_BASE`, y `StrategyChips` despacha `SET_EXERCISE_STRATEGY`
  en vez de autosalvar. Un ejercicio recién agregado se pinta con `DEFAULT_EXERCISE_BASE` (D5).
- **Descartar**: resetea el reducer al snapshot original y apaga el flag; no pega ningún request.
- **Guardar**: un `useMutation` contra el `PUT` de D5 que, al resolver, escribe la respuesta en la
  cache (`setQueryData` de `queryKeys.routineTemplates.detail`), reinicia el snapshot e invalida
  `routineAssignments.all` (el plan del Miembro cambió).

Alternativas descartadas:

- *Migrar la app a `createBrowserRouter` para usar `useBlocker`.* Es la solución correcta a largo
  plazo y bloquearía **toda** navegación, incluido el botón Atrás del navegador. Rechazada para
  este change: tocar el router de toda la app dentro de un change ya declarado alto multiplica la
  superficie de regresión sobre pantallas que no tienen nada que ver. Queda anotado como trabajo
  posterior; el residuo (navegar por URL directa o con el botón Atrás pierde el borrador sin
  aviso) está en Risks.
- *Autosave por acción (lo de hoy con el switch y los chips).* Rechazada: la spec pide
  explícitamente guardado explícito con opción de descartar.
- *Borrador en la URL o en un query param.* Rechazada: la estructura no entra y expone la
  configuración en el historial del navegador.

### D12. Migración: una sola revision, drops primero por las FKs, y reseed manual

Revision nueva encadenada a `030412411aba` (confirmar con `alembic heads` al implementar). **Sin
backfill** (regla de BETA; el proposal lo declara). Orden, obligado por las FKs:

1. `workout_logs`: `drop_constraint` de la FK a `training_days`; `alter_column day_id` →
   `nullable=True`; `add_column day_name` (`String`, `nullable=False`, `server_default="Día 1"`
   para las filas existentes, y después `alter` para sacar el default). **Y** `DELETE FROM
   workout_logs` — sus `day_id` apuntan a días que dejan de existir y no hay forma honesta de
   reasignarlos; conservarlos con `day_id` en `NULL` y un `day_name` inventado es peor que no
   tenerlos. Queda declarado en el `docstring` de la revision.
2. `drop_table("routine_template_exercises")`, `drop_table("training_day_exercises")`.
3. `drop_table("routine_template_days")` (la vieja) y `create_table` de las tres nuevas. Se dropea y
   se recrea en vez de `alter`: cambia la PK conceptual, se va una FK y se agregan cuatro columnas;
   un `ALTER` encadenado sería más código para el mismo resultado (y las filas viejas se descartan
   igual, por lo que no hay nada que conservar).
4. `drop_table("training_days")` (ya sin referentes).
4bis. `exercises`: `drop_column("base_sets")`, `drop_column("base_reps")`,
   `drop_column("base_weight_kg")`. Van **después** de dropear
   `routine_template_exercises`/`training_day_exercises` solo por orden de lectura; no hay FK que
   las ate. Sin backfill: el valor se pierde y no se copia a ninguna plantilla (las plantillas
   quedan sin días con ejercicios de todos modos).
5. `add_column` de la FK nueva de `workout_logs.day_id` → `routine_template_days.id`,
   `ondelete="SET NULL"`.
6. `routine_assignment_bases` no se toca (D4).
7. `routine_templates` y `routine_assignments` **sobreviven** (nombre, etiqueta, asignaciones); las
   plantillas quedan **sin ningún día**, que viola I1. La migración, por eso, inserta un
   `routine_template_days(position=1)` por cada plantilla existente. Es el único "backfill" y es
   estructural, no de datos de negocio: repara la invariante en vez de adivinar contenido.
8. `downgrade()`: no-op documentado, como en `bfc5002838bf`. No hay nada que restaurar.

Después de migrar, en desarrollo: `make seed-dev` (usuarios) sigue sin cambios — no toca días ni
plantillas (verificado). `make seed-dev-exercises` **sí** cambia: su `EXERCISE_LIBRARY`
(`backend/scripts/seed_dev_exercises.py`) trae `base_sets`/`base_reps`/`base_weight_kg` por
ejercicio y `_DEFAULT_BASE`; esas tres claves se retiran de las ~52 entradas y del `insert`, porque
las columnas dejan de existir. El resto del seed (id, nombre, grupo muscular) queda igual, y sigue
sin tocar días ni plantillas. Las plantillas de prueba se rearman a mano desde la UI, que es justamente el flujo
que este change agrega. En producción (Railway), `railway run alembic upgrade head` a mano, con el
procedimiento habitual.

Alternativa descartada: *conservar los `workout_logs` apuntando al día "equivalente" de la plantilla
asignada.* Rechazada: requiere adivinar qué día de qué plantilla corresponde a `day-2` para cada
Miembro, y es exactamente la heurística de backfill que `AGENTS.md` prohíbe.

### D13. Tests: la fixture `catalog_basic` se mantiene y se le suma `template_with_days`

La suite ya no hereda ningún seed (`drop-static-exercise-catalog` D5). Se agrega a
`backend/tests/helpers.py` un helper `create_template_with_days(db_session, *, name, days=[...])`
que arma plantilla + días + grupos musculares + ejercicios con base y estrategia, y una fixture
opt-in `template_with_days` en `conftest.py` para los archivos que hoy dependen de que existan
`day-1..day-4`. **No** se agrega ninguna fixture `autouse`: la precondición de cada test tiene que
leerse en el test (mismo criterio que D5 del change anterior).

`backend/tests/test_exercise_base.py` se **borra entero**: sus 6 casos son sobre la base del
catálogo, que deja de existir. Los dos que siguen teniendo sentido en el modelo nuevo se reescriben
como base **de la plantilla** en `test_routine_templates.py` (el default 3×10 · 0 kg y que editarla
no se filtra a otra plantilla).

`backend/tests/test_routines_seed.py` pierde su razón de ser (probaba `ensure_training_days`, el
no-op del seed y que `EXERCISE_LIBRARY` no vuelva a `app/`). Se conserva **solo** el test
estructural del import y se renombra el archivo a `test_routines_invariants.py`, sumándole el test
de que `routine_catalog` ya no existe.

## Risks / Trade-offs

- **[El `PUT` de reemplazo borra un día por un borrador desactualizado (dos editores a la vez)]** →
  Sin optimistic locking (D5), el último guardado gana y el otro pierde su edición sin aviso.
  Aceptado: no hay requirement de concurrencia y el equipo son 2–3 personas. Mitigación parcial: la
  respuesta del `PUT` reemplaza el borrador con la verdad del servidor, así que el perdedor **ve**
  el resultado real inmediatamente. Si aparece el caso, se agrega `If-Match`/`updated_at`.
- **[Navegar por URL directa o con el botón Atrás pierde el borrador sin aviso]** → Residuo
  conocido de D11 (sin data router no hay `useBlocker`). Cubierto parcialmente por `beforeunload`
  (recarga/cierre) y por el guard en Sidebar + botón Volver. Documentado, no oculto.
- **[La migración borra todos los `workout_logs` de producción]** → Aceptado bajo la regla de BETA y
  declarado en el docstring de la revision y en el Migration Plan. Es la contracara honesta de
  cambiar a qué apunta `day_id`.
- **[Quitar un día borra silenciosamente los ejercicios de ese día]** → Es el escenario explícito de
  la spec. Mitigación de UI: quitar un día pide confirmación en el borrador, y como nada se
  persiste hasta "Guardar", siempre se puede descartar.
- **[El reemplazo completo renumera posiciones y el "Día 3" del Miembro pasa a ser el "Día 2"]** →
  Consecuencia buscada de que el título se derive de `position` (D1): la plantilla no puede tener
  huecos. El histórico no se ve afectado porque guarda el `day_name` del momento (D3) y el `day_id`
  no cambia.
- **[Retirar tres endpoints de `routines.py` rompe un consumidor no identificado]** → Se verificó
  que `GET /routines/catalog` no tiene consumidor y que `GET /routines/days` solo lo usa
  `useTrainingDaysQuery` (los dos diálogos que se simplifican). `make lint-frontend` (`tsc`) se
  pone rojo si queda alguno, porque los tipos se retiran en el mismo change.
- **[El backend queda a medias entre los dos modelos]** → El change no es divisible: backend y
  frontend se implementan y se mergean juntos. Es la razón por la que el Plan de verificación pide
  el recorrido manual completo de los tres roles.
- **[D4 y D10 quedan superadas por el change de "asignación como copia"]** → Ya está decidido que
  un change **posterior** va a hacer que asignar una plantilla **cree una copia** de la rutina,
  editable por Coach/Dueño solo para ese Miembro y con progreso propio, y que eso va a **retirar
  `routine_assignment_bases`**. Quien lea este design no debe tomar como definitivas ni la
  granularidad del ajuste por cliente (D4) ni el comportamiento "en vivo" (D10): son el estado
  correcto **hoy**, elegido a propósito para no mezclar dos cambios de modelo en el mismo diff.
- **[El plan del Miembro cambia mientras entrena]** → Consecuencia aceptada del requirement de
  "cambios en vivo". No hay mitigación técnica y no se pide ninguna.

## Migration Plan

1. Implementar backend completo (D1–D10, D12) y frontend (D6, D8, D11) juntos, con los tests de la
   tabla. El repo no puede quedar a medias entre los dos modelos.
2. `make lint && make test` en verde; `make check-plan CHANGE=template-owned-routine-days` sin
   `FALLA:`.
3. Desarrollo: `cd backend && alembic upgrade head` (o `make migrate`). Verificar que
   `training_days`, `training_day_exercises` y la vieja `routine_template_exercises` ya no existen,
   que `exercises` ya no tiene `base_sets`/`base_reps`/`base_weight_kg`, que cada plantilla que
   sobrevivió tiene exactamente un día en `position=1`, y que `workout_logs` quedó vacía. El gate
   de `/opsx:verify` no corre migraciones: este paso es a mano, sí o sí.
4. Desarrollo: `make seed-dev` (+ `make seed-dev-exercises` si se quiere catálogo). Rearmar una
   plantilla a mano desde la UI con el flujo nuevo.
5. Producción (Railway, a mano): `railway run alembic upgrade head`. Avisar antes: se pierden los
   registros de entrenamiento y la configuración de días de las plantillas existentes.
6. Rollback: `downgrade` es no-op. Volver atrás significa revertir el código y restaurar la base
   desde backup; no hay camino de datos.

## Plan de verificación

**Riesgo**: alto — el diff toca `backend/app/models.py` y `backend/migrations/**`, dropea cuatro
tablas y tres columnas de `exercises`, **borra filas existentes** (`workout_logs` completa, más la
configuración de días de todas las plantillas y la base del catálogo), cambia a qué apunta
`WorkoutLog.day_id` y retira cuatro endpoints con consumidores en el frontend.

### Invariantes

- I1. Toda `RoutineTemplate` tiene entre 1 y 5 `routine_template_days`, con posiciones contiguas
  `1..N`, en todo momento observable por la API — incluidas las plantillas recién creadas y las que
  sobrevivieron a la migración.
- I2. Guardar el borrador **sin tocar un día** conserva el `id` de ese día: los `WorkoutLog` que lo
  referencian siguen apuntando a él después de cualquier cantidad de guardados.
- I3. Un día no puede tener el mismo `exercise_id` dos veces, ni por la API ni por la base
  (unique constraint).
- I4. Editar un día de una plantilla (grupos musculares, ejercicios, base, estrategia, orden) no
  modifica ninguna fila de ninguna otra plantilla.
- I5. Un par `(día, ejercicio)` nuevo nace en **3 series × 10 repeticiones × 0 kg** y estrategia
  `constant`; a partir de ahí su base es propia de esa combinación y editarla no toca ninguna otra
  plantilla ni ningún otro día.
- I6. Quitar un ejercicio de un día no borra ni oculta ningún `WorkoutLog` ya registrado para ese
  ejercicio; quitar un día deja sus logs con `day_id` en `NULL` y su `day_name` intacto, y siguen
  consultándose sin error.
- I7. El plan que ve el Miembro contiene exactamente los ejercicios que están en
  `routine_template_day_exercises` de los días de su plantilla asignada — ni uno más (ningún
  ejercicio "del catálogo") ni uno menos.
- I8. Un cambio del Coach sobre la plantilla asignada se ve en el próximo request del Miembro, sin
  reasignar ni tocar la asignación.
- I9. Ningún módulo bajo `backend/app/` importa `routine_catalog`, `TrainingDay`,
  `TrainingDayExercise`, `ensure_training_days` ni `sync_exercise_day_links`, y ningún modelo,
  schema o serializador expone `base_sets`/`base_reps`/`base_weight_kg` **de `Exercise`**: ni el
  catálogo global de días ni la base editable del catálogo pueden volver por descuido.
- I10. Un ejercicio inactivo en el catálogo no se puede agregar a un día (400) pero, si ya estaba,
  sigue en el detalle de la plantilla y en el plan del Miembro.
- I11. El guardado del borrador es atómico: un payload inválido (6 días, 0 días, ejercicio
  inexistente, día de otra plantilla) no persiste **ninguno** de sus cambios.
- I12. Un Miembro no puede registrar un `WorkoutLog` contra un día que no pertenece a una plantilla
  que tiene asignada, ni contra un ejercicio que no está en ese día.

### Tests

| Capa | Archivo | Caso |
|---|---|---|
| backend | `backend/tests/test_routine_templates.py` | `test_crear_plantilla_solo_con_nombre_y_etiqueta_nace_con_el_dia_1` |
| backend | `backend/tests/test_routine_templates.py` | `test_crear_plantilla_con_day_ids_en_el_payload_es_422` |
| backend | `backend/tests/test_routine_templates.py` | `test_guardar_el_borrador_persiste_dias_grupos_y_ejercicios_en_un_solo_request` |
| backend | `backend/tests/test_routine_templates.py` | `test_guardar_un_sexto_dia_es_422_y_no_persiste_nada` |
| backend | `backend/tests/test_routine_templates.py` | `test_guardar_cero_dias_es_422_y_la_plantilla_conserva_sus_dias` |
| backend | `backend/tests/test_routine_templates.py` | `test_un_dia_que_no_cambia_conserva_su_id_entre_guardados` |
| backend | `backend/tests/test_routine_templates.py` | `test_quitar_un_dia_elimina_sus_grupos_musculares_y_sus_ejercicios` |
| backend | `backend/tests/test_routine_templates.py` | `test_quitar_un_dia_intermedio_renumera_las_posiciones_de_forma_contigua` |
| backend | `backend/tests/test_routine_templates.py` | `test_editar_un_dia_de_una_plantilla_no_toca_los_dias_de_otra` |
| backend | `backend/tests/test_routine_templates.py` | `test_agregar_un_ejercicio_arranca_en_3x10_0kg_y_estrategia_constante` |
| backend | `backend/tests/test_routine_templates.py` | `test_editar_la_base_de_un_ejercicio_de_un_dia_no_toca_la_del_mismo_ejercicio_en_otro_dia` |
| backend | `backend/tests/test_routine_templates.py` | `test_el_mismo_ejercicio_en_dos_plantillas_mantiene_bases_y_estrategias_independientes` |
| backend | `backend/tests/test_routine_templates.py` | `test_el_orden_de_los_ejercicios_del_payload_se_persiste_como_sort_order` |
| backend | `backend/tests/test_routine_templates.py` | `test_repetir_un_ejercicio_dentro_del_mismo_dia_es_422` |
| backend | `backend/tests/test_routine_templates.py` | `test_guardar_un_dia_que_es_de_otra_plantilla_es_400` |
| backend | `backend/tests/test_routine_templates.py` | `test_agregar_un_ejercicio_inactivo_es_400_pero_el_ya_agregado_sigue_en_el_detalle` |
| backend | `backend/tests/test_routine_templates.py` | `test_un_coach_puede_guardar_el_borrador_y_un_miembro_recibe_403` |
| backend | `backend/tests/test_exercises.py` | `test_el_catalogo_de_ejercicios_ya_no_expone_ni_acepta_una_base` |
| backend | `backend/tests/test_member_routine.py` | `test_mi_rutina_muestra_solo_los_dias_y_ejercicios_de_la_plantilla_asignada` |
| backend | `backend/tests/test_member_routine.py` | `test_un_ejercicio_quitado_del_dia_desaparece_del_plan_pero_sus_logs_siguen_consultables` |
| backend | `backend/tests/test_member_routine.py` | `test_quitar_un_dia_deja_sus_logs_con_day_id_nulo_y_conserva_el_nombre_del_dia` |
| backend | `backend/tests/test_member_routine.py` | `test_un_cambio_del_coach_en_la_plantilla_se_ve_en_el_siguiente_request_del_miembro` |
| backend | `backend/tests/test_member_routine.py` | `test_mis_dias_sin_asignacion_activa_devuelve_lista_vacia_con_200` |
| backend | `backend/tests/test_member_routine.py` | `test_registrar_un_log_contra_un_dia_de_otra_plantilla_es_400` |
| backend | `backend/tests/test_member_routine.py` | `test_registrar_un_log_contra_un_ejercicio_que_no_esta_en_el_dia_es_400` |
| backend | `backend/tests/test_member_routine.py` | `test_el_overview_del_miembro_cuenta_los_ejercicios_del_dia_de_su_plantilla` |
| backend | `backend/tests/test_member_routine.py` | `test_el_overview_sigue_la_asignacion_activa_aunque_haya_una_alternativa` |
| backend | `backend/tests/test_member_routine.py` | `test_el_progress_summary_sin_asignacion_activa_lo_indica_en_vez_de_usar_la_alternativa` |
| backend | `backend/tests/test_routine_assignments.py` | `test_el_ajuste_de_base_por_cliente_pisa_la_base_propia_de_la_plantilla` |
| backend | `backend/tests/test_routine_assignments.py` | `test_quitar_de_la_plantilla_un_ejercicio_con_ajuste_conserva_la_asignacion_y_el_historico` |
| backend | `backend/tests/test_routine_assignments.py` | `test_ajustar_la_base_de_un_ejercicio_que_no_esta_en_la_plantilla_es_400` |
| backend | `backend/tests/test_routines_invariants.py` | `test_ningun_modulo_de_app_importa_el_catalogo_global_de_dias` |
| backend | `backend/tests/test_routines_invariants.py` | `test_los_endpoints_retirados_del_catalogo_global_devuelven_404` |
| backend | `backend/tests/test_routines_invariants.py` | `test_el_endpoint_de_base_del_catalogo_devuelve_404` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `agrega un día al borrador y lo envía en un solo guardado` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `no deja agregar un sexto día` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `no deja quitar el último día` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `muestra el título del día como Día N con sus grupos musculares unidos por barra` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `el buscador no ofrece un ejercicio ya agregado a ese día` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `el buscador avisa cuando no hay resultados` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `quita un ejercicio del día con el botón de papelera` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `muestra 3x10 y 0 kg en un ejercicio recién agregado al día` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `edita la base de un ejercicio del día en el borrador y la manda en el guardado` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `avisa que hay cambios sin guardar al intentar volver a Rutinas` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `descarta el borrador y deja la plantilla como estaba` |
| frontend | `frontend/src/components/__tests__/CreateRoutineTemplateDialog.test.tsx` | `crea una plantilla pidiendo solo nombre y etiqueta` |
| frontend | `frontend/src/pages/__tests__/UserRoutine.test.tsx` | `muestra solo los días de la plantilla asignada` |
| frontend | `frontend/src/pages/__tests__/UserRoutine.test.tsx` | `no muestra un ejercicio que ya no está en el día de la plantilla` |
| manual | — | Migración en desarrollo: `cd backend && alembic upgrade head`. Antes y después, `SELECT count(*)` sobre `workout_logs`, `routine_templates` y `routine_template_days`; confirmar que las tablas `training_days`, `training_day_exercises` y la vieja `routine_template_exercises` ya no existen (`\dt`), que cada plantilla sobreviviente tiene exactamente una fila en `routine_template_days` con `position = 1`, y que `alembic downgrade -1` no explota. |
| manual | — | Recorrido de Dueño (`make dev`, `dev.owner@miniespacio.local`): crear una plantilla solo con nombre y etiqueta; verificar que el detalle abre con "Día 1" sin grupo muscular ni ejercicios; asignarle "Pecho" y "Tríceps" y ver el título "Día 1 - Pecho/Tríceps"; agregar 4 días más y confirmar que el botón de agregar queda deshabilitado en 5; buscar y agregar dos ejercicios en el Día 1 (verificar que el buscador muestra Nombre / Grupo Muscular / Tipo de Entrenamiento y que no vuelve a ofrecer los ya agregados); cambiar la estrategia de uno y su base; reordenar los dos ejercicios; **sin guardar**, intentar volver a Rutinas y confirmar el aviso; descartar y verificar que no quedó nada; rehacer y guardar; recargar y verificar que todo persistió, incluido el orden. |
| manual | — | Recorrido de Coach sobre plantilla asignada: con `dev.coach@miniespacio.local`, quitar un ejercicio de un día de la plantilla que tiene `dev.member@miniespacio.local`; entrar como Miembro a "Mi rutina" y verificar que el ejercicio ya no está en el plan; volver como Coach y verificar que el histórico de ese Miembro para ese ejercicio sigue visible en su ficha (Seguimiento → registros). Repetir quitando un **día** entero y confirmar que los registros de ese día siguen listándose. |
| manual | — | Catálogo sin base: entrar como Dueño a `/exercises`, abrir el detalle/edición de un ejercicio y confirmar que ya no hay ningún campo ni acción de "base" (series/reps/kg); confirmar que la base solo se edita dentro de un día de plantilla. |
| manual | — | Ejercicio inactivo: desactivar un ejercicio en `/exercises` que ya esté agregado a un día; verificar que sigue apareciendo en el detalle de la plantilla y en "Mi rutina", y que el buscador de otro día no lo ofrece. |
| manual | — | Producción (Railway): `railway run alembic upgrade head`; entrar como Dueño, abrir una plantilla existente (debe mostrar el Día 1 vacío), rearmarla con el flujo nuevo y confirmar que un Miembro asignado la ve. |
