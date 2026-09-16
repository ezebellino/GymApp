## Context

`template-owned-routine-days` (archivado el 2026-09-14) dejó la plantilla como dueña de sus días:
`RoutineTemplate` → `RoutineTemplateDay` (`position` 1..5, título derivado) →
`RoutineTemplateDayMuscleGroup` + `RoutineTemplateDayExercise` (`sort_order`, `strategy`,
`base_sets`/`base_reps`/`base_weight_kg`, default 3 × 10 × 0 kg). Ese change dejó **dos decisiones
que este supera deliberadamente**:

- **D4** de aquel design: el ajuste por cliente sigue viviendo en `routine_assignment_bases`, por
  `(assignment_id, exercise_id)`, como un override por encima de la base de la plantilla.
- **D10**: "el Miembro resuelve su rutina por la asignación", que es una **referencia** —
  `RoutineAssignment(user_id, template_id, status)` — y por eso los cambios del Coach se ven **en
  vivo** para todos los Miembros que tengan esa plantilla (su invariante I8).

Este change reemplaza las dos: asignar pasa a **copiar**, y la copia es la rutina de ese Miembro.

Estado verificado sobre el working tree (no repetido del proposal):

- `backend/app/models.py`: `RoutineAssignment` con `UniqueConstraint(user_id, template_id)` —
  reasignar hoy es un **upsert**, no una fila nueva — y un índice único parcial
  `ix_routine_assignments_user_active` declarado para Postgres **y** SQLite (la suite corre en
  SQLite), que sostiene "una sola Activa por usuario" en la base y no solo en el endpoint.
  `RoutineAssignmentBase` por `(assignment_id, exercise_id)`. `WorkoutLog(user_id, day_id →
  routine_template_days SET NULL nullable, day_name, exercise_id, sets_count, reps, weight_kg,
  note, performed_at)`: **una fila por ejercicio hecho**, con `sets_count` como cantidad.
- `backend/app/routers/routine_assignments.py`: `create_assignment` (upsert + `base_overrides`),
  `update_assignment_status`, `delete_assignment`, `PUT`/`DELETE .../bases/{exercise_id}`,
  `list_my_templates`, `get_my_template` (plan calculado leyendo la **plantilla** + `_resolve_base`
  con el override).
- `backend/app/routers/routines.py` (1257 líneas): `_get_active_assignment`,
  `_get_member_day_or_400`, overview de staff y de Miembro, `GET /users/{id}/logs` (filtro solo por
  `day_id`), **`POST`/`PATCH`/`DELETE /users/{id}/logs` de staff** (con efecto secundario: el alta
  crea una `Attendance` del día si no había), sus espejos `/my/logs` que delegan en los de staff,
  `progress-summary` y el PDF (`_collect_progress_snapshot`, con `total_volume = sets_count × reps
  × weight_kg`).
- `backend/app/routers/routine_templates.py`: el `PUT /{id}/days` de reemplazo completo con
  identidad explícita (`day_id: null` = día nuevo) y `_replace_muscle_groups` / `_replace_exercises`;
  `_assignment_count` bloquea borrar una plantilla asignada (requirement vigente de
  `routine-templates`, **no** tocado por este change).
- Frontend: `UserRoutine.tsx` (220 líneas, solo lectura, tabs de asignación + tabs de día +
  `PlannedSetsList`), `RoutineTemplateDetail.tsx` (754 líneas: `useReducer` del borrador,
  `DayCard`, barra de guardado, `stores/unsavedChanges.ts` + `hooks/useGuardedNavigate.ts`),
  `Users.tsx` (fila con `RowActionButton` Ver/Editar), `MemberTemplatesCard.tsx` (icon-buttons
  `SlidersHorizontal`="Ajustar base" + `Trash2`), `Tracking.tsx` (`ComingSoon` con `LineChart`).
  `App.jsx` usa `<BrowserRouter>` **sin** data router (no hay `useBlocker`). `recharts@^3.3.0` ya
  es dependencia (hoy solo la usa `Reports.tsx`): el gráfico de evolución **no** agrega
  dependencias.
- **Ningún archivo de `frontend/src` consume `WorkoutLog` fuera de `types.ts`**: no existe hoy
  ninguna pantalla de histórico, ni del Miembro ni del staff. Todo el costo del cambio de grano de
  los registros es de backend.
- Tests: pytest en SQLite con esquema por `create_all` (**no** corre migraciones) y
  `PRAGMA foreign_keys=ON` por conexión en `conftest.py` — sin eso los `SET NULL` de este design no
  se verificarían. Vitest en `frontend/src/**/__tests__/`.

## Goals / Non-Goals

**Goals:**

- Que asignar cree una copia independiente y editable, y que editar la copia o la plantilla origen
  no se filtren entre sí.
- Que reasignar la misma plantilla cree una copia **nueva** Activa, degradando la anterior sin
  tocar su histórico.
- Un modelo de progreso **por serie** que soporte marcar en el momento y corregir después, sin que
  una edición del Coach borre lo ya marcado.
- Dos pantallas nuevas: ejecución del Miembro y Progreso para staff (histórico filtrable +
  gráfico).
- Retirar el ajuste de base por cliente de punta a punta (modelo, API, UI, tests).
- Que borrar una plantilla quede bloqueado **solo** por copias Activas, y que una copia Alternativa
  sobreviva —entrenable y con su histórico— al borrado de su plantilla origen.
- Que marcar progreso no genere asistencia, ni desde el Miembro ni desde el staff.

**Non-Goals:**

- Re-sincronizar una copia con su plantilla origen (la única vía es reasignar).
- Editar plantillas: `routine-templates` no cambia.
- Un "Seguimiento" global del gimnasio: `/tracking` sigue siendo `ComingSoon` (ver D10).
- Edición concurrente de la misma copia (mismo "último guardado gana" del change anterior).
- Migrar la app a `createBrowserRouter` para tener `useBlocker` (sigue anotado como deuda).
- Backfill de asignaciones, ajustes de base o registros existentes.

## Decisions

### D1. La copia vive en **tres tablas propias** colgadas de `routine_assignments`

Tablas nuevas, espejo exacto de la estructura de plantilla:

| Tabla | Columnas | Restricciones |
|---|---|---|
| `routine_assignment_days` | `id`, `assignment_id` (FK CASCADE), `position` | `UNIQUE(assignment_id, position)` |
| `routine_assignment_day_muscle_groups` | `assignment_day_id` (FK CASCADE, PK), `muscle_group` (PK), `sort_order` | PK compuesta |
| `routine_assignment_day_exercises` | `id`, `assignment_day_id` (FK CASCADE), `exercise_id` (FK CASCADE), `sort_order`, `strategy`, `base_sets`/`base_reps`/`base_weight_kg`, `updated_at`, `updated_by_user_id` | `UNIQUE(assignment_day_id, exercise_id)` |

Las tres constantes `DEFAULT_EXERCISE_BASE_*` de `models.py` se reusan como `default=` y
`server_default=` de las columnas de base, igual que en la plantilla: siguen declaradas **una sola
vez** por app.

Alternativas descartadas:

- ***Reusar `routine_templates` con un `owner_user_id` nullable*** ("plantilla de un Miembro"). Es
  la tentación obvia y se rechaza por tres razones concretas, no estéticas: (1)
  `name_normalized` tiene `UNIQUE` **global**, así que dos Miembros con copia de "Fuerza 4 días"
  colisionan — habría que inventar nombres ("Fuerza 4 días (Juan)") o partir el índice en uno
  parcial, y el nombre de la copia pasa a ser un dato de negocio que nadie pidió; (2)
  `GET /routines/templates` y el buscador del staff tendrían que filtrar `owner_user_id IS NULL`
  en **cada** consulta, y el día que alguien olvide el filtro el catálogo se llena de copias (un
  bug silencioso, sin test que lo delate salvo que se escriba a propósito); (3)
  `_assignment_count` y el bloqueo de borrado de plantillas dejan de tener un significado único.
- ***Reusar `routine_template_days` con dueño polimórfico*** (`template_id` y `assignment_id`
  ambos nullable, XOR). Rechazada: `UNIQUE(template_id, position)` deja de servir, toda query
  necesita el discriminador, y las FK nullable-XOR no se pueden expresar en la base — el
  invariante queda solo en el código.
- ***Serializar la copia en un JSON dentro de `routine_assignments`***. Rechazada: el `WorkoutLog`
  necesita apuntar al día con una FK real (D3), y los filtros por ejercicio de la vista de
  Progreso serían scans sobre JSON en Postgres **y** en SQLite (la suite).

Consecuencia deliberada: hay dos subárboles estructuralmente idénticos. El costo se paga **una
sola vez** compartiendo la lógica de guardado y serialización (D8), no duplicándola — el review de
`template-owned-routine-days` ya había marcado el serializador de día/ejercicio triplicado.

### D2. `RoutineAssignment` sobrevive como **raíz de la copia**; se cae su `UNIQUE(user_id, template_id)`

`RoutineAssignment` deja de significar "referencia a una plantilla" y pasa a significar "una copia
de rutina de este Miembro, originada en tal plantilla". Cambios:

- **Se dropea `uq_routine_assignments_user_template`.** Es el candado que hoy convierte reasignar
  en un upsert; con copias, reasignar la misma plantilla **tiene que** poder crear una segunda
  fila. Sin este drop el escenario "Reasignar la misma plantilla crea una copia nueva" es
  imposible por la base, no por el código.
- **`ix_routine_assignments_user_active` se conserva tal cual** (parcial sobre `user_id` con
  `status = 'active'`, declarado para Postgres y SQLite). Sigue siendo el que sostiene "como máximo
  una Activa por usuario" (I5) ahora que puede haber N copias del mismo `template_id`, y sigue
  siendo la red de seguridad de `_degrade_active_assignment`.
- **`template_id` pasa a ser nullable con `ondelete=SET NULL`, y se denormalizan `template_name`
  (NOT NULL) y `template_tag`** en `routine_assignments`. Es la decisión que resuelve el
  requirement modificado de `routine-templates`: una plantilla cuyas únicas copias son Alternativas
  **se puede borrar**, y esas copias y su histórico **sobreviven**. Con el `RESTRICT` de hoy ese
  escenario es imposible: la base rechaza el `DELETE` mientras exista cualquier fila que la
  referencie, Activa o no. Ver D2b para el detalle de qué le pasa a la copia huérfana.
- **`_assignment_count` pasa a contar `DISTINCT user_id` con `status = 'active'`.** Dos cambios en
  uno: (a) sin el unique que se cae, dos copias del mismo Miembro dirían "2 miembros la tienen
  asignada", que es literalmente falso; (b) el bloqueo ahora es **solo por copias Activas**, y el
  mensaje de rechazo dice "N miembros la tienen asignada como Activa".
- `starts_on`, `status`, `created_by_user_id` quedan igual. `base_overrides` se retira (D4).

### D2b. Una copia huérfana de plantilla sigue siendo una rutina de pleno derecho

Cuando se borra la plantilla origen de una copia Alternativa, `template_id` queda en `NULL` y la
copia **no cambia en nada más**: sus días, ejercicios, bases y estrategias viven en sus propias
tablas (D1) y nunca dependieron de la plantilla después del momento de copiar (D5). Consecuencias
explícitas, para que no queden libradas a la implementación:

- La copia **sigue siendo entrenable**: aparece en "Mi rutina", el Miembro puede elegirla y marcar
  series sobre ella (D9). Ningún camino de lectura del Miembro toca `routine_templates`.
- La copia **sigue siendo editable** por Dueño o Coach desde la ficha, con el mismo editor (D8).
- Su histórico de marcas es indiferente al borrado: las marcas apuntan a `routine_assignment_days`
  y a `exercises`, nunca a la plantilla.
- Puede ser **promovida a Activa** desde la ficha (`PATCH /{assignment_id}`), como cualquier otra
  Alternativa. Lo que no se puede es *reasignar* una plantilla que ya no existe — pero eso es un
  404 del alta, no un problema de la copia.
- Lo único que se pierde es el vínculo al catálogo: por eso el nombre y la etiqueta de origen se
  **snapshotean al copiar** (`template_name`, `template_tag`) y la ficha y "Mi rutina" muestran
  **siempre el snapshot**, con `template_id` disponible solo para linkear a la plantilla cuando
  todavía existe. Elegir el snapshot como única fuente de la etiqueta, y no "el nombre vivo si
  existe, el snapshot si no", evita que la misma copia se llame distinto según si alguien borró la
  plantilla; el residuo (renombrar la plantilla no renombra la etiqueta de origen de las copias ya
  creadas) es coherente con que la copia es una foto de esa plantilla en ese momento, y queda en
  Risks.
- **Nota de implementación**: la relación `RoutineTemplate.assignments` necesita
  `passive_deletes=True` para que el `SET NULL` lo haga la base y no SQLAlchemy fila por fila; y
  `RoutineAssignmentOut.template_id` pasa a `Optional[str]`, mientras `template_name` /
  `template_tag` dejan de derivarse de la relación y salen del snapshot.

Alternativas descartadas:

- ***Dejar `template_id` como FK `RESTRICT` y borrar la plantilla "en lógico"*** (un `is_deleted`
  que la saca del catálogo). Rechazada: agrega un estado nuevo a `routine_templates` que ninguna
  spec pide, y deja filas que el staff no ve pero que siguen bloqueando nombres por el `UNIQUE` de
  `name_normalized`.
- ***Sacarle la FK a `template_id` y dejarlo como string suelto***. Rechazada: se pierde la
  integridad referencial también para el caso vivo (el 99 % del tiempo), a cambio de nada que el
  `SET NULL` no dé.
- ***`ondelete=CASCADE`***. Rechazada de plano: borra las copias y su histórico, exactamente lo que
  el requirement prohíbe.

Alternativa descartada: *una entidad nueva `MemberRoutine` y dejar `RoutineAssignment` como tabla
puente*. Rechazada: sería una tabla 1-a-1 con la asignación, y todas las specs hablan del par
Activa/Alternativa **de la asignación**; separarlas obliga a decidir en cuál de las dos vive el
estado y duplica el ciclo de vida.

### D3. `WorkoutLog` se retira y se reemplaza por `WorkoutSetLog`, con grano **una fila = una serie**

Este es el corazón del change. "La serie #2 planificada, marcada con 45 kg × 8" no puede
representarse con el modelo actual: `WorkoutLog` es una fila por ejercicio con `sets_count` como
**cantidad**, no como identidad de una serie.

Tabla nueva `workout_set_logs`:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | String PK | |
| `user_id` | FK `users` RESTRICT, NOT NULL, index | |
| `assignment_day_id` | FK `routine_assignment_days` **SET NULL**, nullable, index | el día de la **copia**, no de la plantilla |
| `day_name` | String NOT NULL | snapshot de `"Día {position}"` en el alta |
| `exercise_id` | FK `exercises` CASCADE, NOT NULL, index | |
| `set_index` | Integer NOT NULL | 1-based, **la misma numeración que `PlannedSet.index`** |
| `reps` | Integer NOT NULL | lo que efectivamente hizo |
| `weight_kg` | Float NOT NULL | ídem |
| `note` | String nullable | |
| `performed_on` | Date NOT NULL, index | la **sesión** (ver abajo) |
| `performed_at` | DateTime NOT NULL | momento exacto de la marca |
| `created_by_user_id` | FK `users` SET NULL | siempre el propio Miembro (D6) |

`UNIQUE(user_id, assignment_day_id, exercise_id, set_index, performed_on)`.

**Cómo se ata una marca a la serie planificada que la originó.** Las series planificadas **no son
filas**: salen de `plan_sets(strategy, sets=…, reps=…, weight_kg=…)`, que devuelve una lista con
`index` 1..N. El vínculo es, por lo tanto, **posicional**: la tupla `(assignment_day_id,
exercise_id, set_index)` identifica "la serie #k de ese ejercicio en ese día de esa copia", y
`plan_sets` se vuelve a evaluar en cada lectura para saber cuántas series hay y con qué objetivo.
No se persiste ninguna fila por serie planificada.

**Por qué no persistir las series planificadas.** Sería el modelo "obvio" (una tabla
`planned_sets` y la marca con FK a ella), y se rechaza: obligaría a materializar el plan en cada
guardado de la copia y a decidir qué pasa con las filas planificadas viejas cuando el Coach cambia
la estrategia — exactamente el problema que el requirement "sin mezclar series planificadas viejas
con las nuevas" quiere evitar. Con el plan derivado, ese requirement es verdadero por
construcción: el plan vigente **siempre** es `plan_sets` sobre la base actual.

**Qué es una sesión.** `performed_on` = fecha calendario en `America/Argentina/Buenos_Aires`
(`now_ar()`, ya usada en `routines.py`), calculada **en el servidor**. Es lo que hace que "marcar
la serie #2 hoy" sea corregible (mismo día ⇒ upsert) y que "la serie #2 de la semana que viene" sea
un registro nuevo sin chocar con el unique.

- Alternativa descartada: *una entidad `WorkoutSession` explícita* (user, assignment, day,
  `started_at`/`ended_at`). Es más correcta y resuelve entrenar dos veces el mismo día, pero
  introduce un ciclo de vida que ninguna spec define (¿cuándo abre?, ¿cuándo cierra?, ¿qué pasa si
  queda abierta?) y una pantalla de "empezar entrenamiento" que el proposal no pide ("en el
  momento, con el teléfono en la mano"). El residuo (dos entrenamientos del mismo día del mismo
  ejercicio se pisan) queda en Risks.
- Alternativa descartada: *sin `performed_on`, unique por `(…, set_index)` a secas*. Rechazada: la
  segunda semana el Miembro no podría marcar nada.
- Alternativa descartada: *sin unique, cada marca es una fila nueva y "corregir" es un `PATCH` por
  `log_id`*. Rechazada: obliga al cliente a recordar el id de cada marca para poder corregir, y un
  doble tap durante el entrenamiento (el escenario real de uso) duplica la serie. El upsert
  idempotente por posición hace que marcar y corregir sean **el mismo request** (D6).

**Por qué se renombra y no se altera `workout_logs`.** El grano cambia de "un ejercicio hecho" a
"una serie hecha". Todos los agregados de `_collect_progress_snapshot` cambian de significado en
silencio si el nombre se conserva: `len(logs)` pasa a contar series, `total_volume` ya no puede ser
`sets_count × reps × weight_kg` (pasa a `reps × weight_kg` sumado), `improvements` compara primera
y última **serie** y no primer y último día. Renombrando, cada uno de esos 38 usos de
`routines.py` falla al importar y tiene que ser reescrito a conciencia. Como ningún archivo de
`frontend/src` fuera de `types.ts` consume el tipo, el rename no tiene costo de cliente.
`sets_count` desaparece (una fila **es** una serie).

Alternativa descartada: *conservar `workout_logs` y agregarle `set_index`*. Rechazada por lo
anterior: es la variante que deja agregados rotos sin que nada se ponga rojo.

**Qué se denormaliza y qué no.** `day_name` se snapshotea (misma razón que D3 del change anterior:
un día borrado deja el histórico sin etiqueta).

**`day_name` es `"Día {position}"` a secas, no el título con grupos musculares** (confirmado
después del gate, hallazgo menor 5: la implementación guardó `day_title(...)` ⇒ `"Día 1 - Pecho"`).
Se corrige el código, no el diseño, por tres razones: (a) el título con grupos **no es estable** —
si el Coach cambia los grupos del día entre dos sesiones, el **mismo** día aparece en el histórico
bajo dos etiquetas distintas y deja de poder agruparse; (b) la información no se pierde: cada fila
del histórico ya trae `exercise_name` y `muscle_group`, así que "era el día de pecho" se lee igual;
(c) `day_name` existe para que una marca huérfana (`assignment_day_id IS NULL`) conserve una
etiqueta, y para eso alcanza y sobra con la posición. El test que lo cubre tiene que usar un día
con **grupos musculares no vacíos**: con `muscle_groups: []` las dos implementaciones dan el mismo
string y el caso pasa con el código roto. El **peso y las reps planificados** al momento de
marcar **no** se snapshotean: ninguna spec los consume — el histórico y el gráfico muestran lo
ejecutado — y agregarlos después es una migración aditiva. Anotado en Risks.

### D4. `routine_assignment_bases` se dropea entero

No queda ninguna tabla, ninguna columna, ningún schema (`RoutineAssignmentBaseOverrideIn`,
`RoutineAssignmentBaseUpdate`, `LastAdjustmentOut`), ningún endpoint (`PUT`/`DELETE
.../bases/{exercise_id}`), ni los campos `adjustments_count` / `last_adjustment` de
`RoutineAssignmentOut`, ni `_resolve_base` / `_upsert_base_override` / `_resolve_plan_base`. La
base de un ejercicio de la copia **es** `routine_assignment_day_exercises.base_*`: un solo lugar,
sin override por encima.

`base_overrides` sale de `RoutineAssignmentCreate` **sin quedar ignorado**: un payload que lo
incluya es 422 (mismo criterio que D6 del change anterior con `day_ids` — que un cliente viejo
falle ruidoso, no en silencio).

Alternativa descartada: *conservar la tabla vacía por si vuelve el concepto*. Rechazada por la
regla de BETA: el período de deprecación no aplica.

### D5. Copiar es una operación del servidor, en la misma transacción del alta

`create_assignment` deja de ser un upsert: **siempre** inserta un `RoutineAssignment` nuevo —
snapshoteando `template_name` y `template_tag` de la plantilla origen (D2b) — y, a continuación,
copia día por día (`position`), grupos musculares (`muscle_group`, `sort_order`) y ejercicios
(`exercise_id`, `sort_order`, `strategy`, `base_sets`, `base_reps`, `base_weight_kg`) de la
plantilla. `updated_by_user_id` de cada ejercicio copiado = el staff que asigna; `updated_at` =
el momento de la copia. Un solo `commit()`.

- Si la plantilla origen tiene días sin ejercicios o sin grupos musculares, se copian igual
  (vacíos): la copia es fiel, no "mejorada".
- La validación de membresía activa (409) y `require_can_manage_user` no cambian, y ocurren
  **antes** de copiar nada: un rechazo no deja filas de copia huérfanas.
- El orden importa: `_degrade_active_assignment(db, user_id)` **antes** del `flush()` del
  assignment nuevo cuando el estado pedido es Activa, para no pelearse con el índice parcial único.
- Un ejercicio **inactivo en el catálogo** que estaba en la plantilla **se copia igual** (mismo
  criterio que D9 del change anterior: no se puede *agregar*, pero si ya estaba no se cae).

Alternativa descartada: *copiar de forma perezosa* (crear la copia recién cuando alguien la edita,
leyendo mientras tanto de la plantilla). Rechazada: reintroduce el comportamiento "en vivo" que el
proposal retira, para la ventana entre asignar y editar — justo el caso que la spec describe
("editar la plantilla origen después de asignada no toca ninguna copia ya creada").

### D6. Contrato de la API

**Se agregan:**

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `GET /routines/users/{user_id}/templates/{assignment_id}` | Dueño/Coach | Detalle de la copia (días, grupos, ejercicios, base, estrategia, `planned_sets`) para el editor |
| `PUT /routines/users/{user_id}/templates/{assignment_id}/days` | Dueño/Coach | Guardado de la copia: **mismo contrato de reemplazo completo con identidad explícita** que el `PUT` de plantillas (D8) |
| `PUT /routines/my/days/{day_id}/exercises/{exercise_id}/sets/{set_index}` | Miembro | **Marca o corrige** una serie. Body `{weight_kg, reps, note?}`. Upsert por `(user, day, exercise, set_index, hoy)` |
| `GET /routines/users/{user_id}/logged-exercises` | Dueño/Coach | Ejercicios **con registros** de ese Miembro (alimenta el filtro de la vista de Progreso) |

**Se reescriben:**

- `POST /routines/users/{user_id}/templates`: copia (D5); `base_overrides` retirado del payload.
- `GET /routines/my/templates/{assignment_id}`: lee la **copia**, no la plantilla. Cada
  `PlannedSetOut` gana `logged: {weight_kg, reps, performed_at} | null` con la marca **de hoy** para
  ese `set_index`. Un solo payload alimenta toda la pantalla de ejecución: sin request extra para
  saber qué está marcado.
- `GET /routines/users/{user_id}/logs` y `GET /routines/my/logs`: ganan `exercise_id`, `from`,
  `to` (fechas sobre `performed_on`) además del `day_id` que ya tenían; devuelven marcas de serie
  (`set_index`, `reps`, `weight_kg`) ordenadas por `performed_at desc`. Es el endpoint del
  histórico del staff **y** del histórico propio del Miembro (la spec exige que los registros sean
  consultables por los dos).
- `GET /routines/users/{user_id}/overview`, `/my/overview`, `/my/days`: leen los días de la copia
  Activa (`routine_assignment_days`) en vez de los de la plantilla. `log_count` pasa a ser series
  marcadas.
- `progress-summary` y `progress-report` (PDF): mismos endpoints, agregados recalculados en el
  grano nuevo (D3).

**Se retiran:** `PUT`/`DELETE /routines/users/{user_id}/templates/{assignment_id}/bases/{exercise_id}`
y **`POST`/`PATCH`/`DELETE /routines/users/{user_id}/logs`** (staff). El requirement "el marcado de
series SHALL seguir siendo una acción exclusiva del Miembro sobre su propia copia" no se sostiene
con un endpoint de staff que escribe registros; dejarlo vivo sería un agujero que ningún test de
UI detectaría. Sus espejos `/my/logs` (`POST`/`PATCH`/`DELETE`, que hoy **delegan** en los de
staff) también se retiran: los reemplaza el `PUT` de marca por serie.

**Validaciones del `PUT` de marca** (las tres devuelven 400, todas del lado del servidor):

1. `day_id` pertenece a **alguna** asignación del propio Miembro (Activa o Alternativa) —
   `_get_member_day_or_400` reapuntado a `routine_assignment_days`. Pedir el día de otro Miembro es
   indistinguible de pedir uno inexistente.
2. El par `(day_id, exercise_id)` existe en `routine_assignment_day_exercises`.
3. `1 <= set_index <= len(plan_sets(strategy, base…))` recalculado en el momento. Es la única
   defensa real del requirement "no se puede registrar una serie de más": esconder el botón en la
   UI no alcanza.

**Efecto secundario retirado: el alta de `Attendance`.** Hoy `create_workout_log` (staff) crea una
`Attendance` del día si no había. Se retira, y no es una omisión: el requirement "Marcar progreso
no registra asistencia" de `routine-progress-tracking` lo exige explícitamente, porque una marca
hecha desde el teléfono del Miembro deja de ser prueba de presencia física. El check-in sigue
siendo su propio flujo (`/attendance`), sin ninguna relación con el progreso. En el código esto
significa que el endpoint de marca (D6) **no** consulta ni escribe `models.Attendance`: no queda
ninguna referencia a asistencia en el camino de progreso.

El segundo escenario de ese requirement ("un Coach carga progreso desde la ficha... el sistema no
crea ni modifica ninguna asistencia") se satisface por una vía más fuerte que "no crea asistencia":
**no existe el camino**. Los endpoints de escritura de logs de staff se retiran (arriba), así que
un Coach no tiene forma de cargar progreso por un Miembro, y por lo tanto tampoco de generarle
asistencia. Para que eso sea verificable y no una ausencia muda, hay un test nombrado que pide los
endpoints retirados y asserta 404/405, y otro que marca una serie como Miembro y asserta que la
tabla de asistencias no cambió.

**Borrado de plantilla**: `DELETE /routines/templates/{template_id}` no cambia de forma, pero su
guardia pasa a contar solo copias Activas (D2) y su mensaje de rechazo lo dice. El `SET NULL` lo
hace la base; el endpoint no toca ninguna copia.

### D7. Qué pasa con las marcas cuando el Coach edita la copia

Regla única: **editar la copia nunca borra una marca**. Se sostiene con tres mecanismos y ninguna
lógica de limpieza:

- **Quitar un ejercicio de un día**: borra la fila de `routine_assignment_day_exercises`; las
  marcas apuntan a `exercises` (CASCADE) y a `routine_assignment_days`, no a esa fila. No se tocan.
- **Quitar un día, o borrar la copia entera** (`delete_assignment`): `assignment_day_id` queda en
  `NULL` por `SET NULL` y `day_name` conserva la etiqueta. El histórico sigue listándose y
  filtrándose por ejercicio.
- **Reducir las series de 4 a 2** (o cambiar la estrategia): el plan vigente es `plan_sets` sobre
  la base nueva ⇒ el Miembro ve 2 series. Las marcas con `set_index` 3 y 4 **siguen en la tabla**
  y aparecen en el histórico, pero **no** se adjuntan al plan: el `logged` de cada `PlannedSetOut`
  solo se busca para `set_index` ≤ la cantidad planificada actual. Eso es exactamente "sin mezclar
  series planificadas viejas con las nuevas" y los dos THEN del escenario se cumplen a la vez.

Alternativa descartada: *borrar las marcas que quedan fuera del plan al guardar la copia*.
Rechazada explícitamente por el requirement ("SHALL conservarse sin borrarse"), y además haría que
una edición del Coach destruya datos del Miembro sin aviso.

Alternativa descartada: *bloquear la edición de un ejercicio con marcas (RESTRICT)*. Rechazada por
el mismo motivo que en el change anterior: convierte el histórico en un candado sobre el trabajo
del Coach.

### D8. La lógica de días se comparte entre plantilla y copia, en las dos apps

Los dos subárboles de D1 tienen las **mismas** reglas: 1..5 días, posiciones por índice,
`sort_order` por índice, `exercise_id` único por día, `day_id: null` = día nuevo, base por defecto
3 × 10 × 0 kg, estrategia por defecto `constant`, ejercicio inactivo no agregable pero conservable.
Duplicarlas garantiza que diverjan.

**Backend**: se extrae `backend/app/routine_days.py` con (a) la aplicación del payload de reemplazo
y (b) la serialización de día/ejercicio con `planned_sets`, parametrizadas por un pequeño
descriptor `(modelo de día, modelo de grupo muscular, modelo de ejercicio, nombre del FK al dueño)`.
`routine_templates.py` y `routine_assignments.py` pasan a llamarlo. Esto además **elimina el
serializador triplicado** que el review de `template-owned-routine-days` marcó como riesgo de
divergencia (hoy en `routine_templates.py:87-115`, `routines.py:61-93` y
`routine_assignments.py:371-401`). Los schemas del payload (`RoutineTemplateDaysUpdate` y su árbol,
con `validate_unique_day_ids` y `_unique_exercise_ids`) se reusan **tal cual** para las dos rutas:
el contrato es idéntico y partirlo en dos jerarquías de Pydantic sería copiar las validaciones.

Trade-off aceptado: un nivel de indirección (el descriptor) a cambio de una sola implementación de
las reglas que sostienen I1, I2 e I8 del change anterior a nivel copia.

**Frontend**: se **extrae**, no se duplica ni se parametriza con un `mode`:

- `frontend/src/lib/routineDraft.ts`: `draftReducer`, `DraftDay`/`DraftExercise`,
  `deriveDraftDays`, `serializeDraft`, `toSavePayload`, `dayTitle`, `MAX_DAYS`. Puro, sin React:
  testeable directo.
- `frontend/src/components/routine/RoutineDaysEditor.tsx`: `DayCard` + la lista de días + la barra
  de guardado + el diálogo de base. Props: `{ detail, onSave, isSaving, saveError }`. Se queda con
  el borrador, el cálculo de `dirty`, el `beforeunload` y el `setDirty` del store global.
- `RoutineTemplateDetail.tsx` y la página nueva `MemberRoutineEditor.tsx` quedan como **cáscaras**:
  su propio hero (nombre de plantilla vs. nombre del Miembro + plantilla origen), sus acciones
  propias (editar/eliminar plantilla vs. volver a la ficha), su propia query y mutación, y el
  `useGuardedNavigate` de su botón de volver.

Alternativas descartadas: *duplicar el archivo de 754 líneas* (garantiza divergencia justo en las
reglas que un test de una sola de las dos páginas no cubre — p. ej. el tope de 5 días); *una sola
página con `mode="template" | "member"`* (los dos encabezados, las dos rutas, los dos roles y las
dos mutaciones son distintos: el `mode` termina siendo un `if` por bloque y una prop nullable por
cada diferencia).

### D9. Marcar una serie en la UI: precargado, optimista y corregible

- Cada serie planificada se renderiza como una fila con el objetivo ("#2 · 47,5 kg × 6") y una
  acción. Al abrirla, los campos **peso** y **reps** vienen precargados con lo planificado
  (requirement explícito), o con lo ya marcado si la serie tiene `logged` — así corregir es el
  mismo gesto que marcar.
- Confirmar dispara el `PUT` de D6 y, al resolver, se invalida
  `queryKeys.routineTemplates.myDetail(assignmentId)`. No hay `POST` seguido de `PATCH`: un solo
  verbo idempotente, que es lo que hace segura la reintentabilidad con señal mala en el gimnasio.
- Una serie con `logged` se muestra marcada (check + lo ejecutado) y sigue siendo pulsable.
- **No hay acción para agregar una serie extra**: la lista de filas **es** `planned_sets`. El
  escenario "no se puede registrar una serie de más" se cumple en la UI por construcción y en el
  servidor por la validación 3 de D6.
- **Qué copia se ejecuta**: el Miembro elige entre **todas** sus copias (Activas y Alternativas)
  con los tabs que `UserRoutine.tsx` ya tiene, y puede marcar sobre cualquiera de ellas — el
  requirement "Un Miembro puede marcar progreso sobre cualquier copia asignada, tenga o no una
  Activa" es explícito. La selección por defecto es la copia Activa si existe y, si no, la copia
  asignada más reciente (`created_at desc`, el primer elemento del listado que ya devuelve
  `GET /routines/my/templates`); los tabs se muestran igual con una sola copia Alternativa, para
  que el estado de la copia elegida siempre esté a la vista. La falta de una Activa **no** cambia
  nada de la pantalla de ejecución: no hay ninguna rama de UI que dependa de `status`.
- **El estado vacío** ("Todavía no tenés una rutina asignada", sin tabs y sin ninguna acción de
  marcar) se muestra **únicamente** cuando el Miembro no tiene **ninguna** copia, ni Activa ni
  Alternativa — o sea, cuando `GET /routines/my/templates` devuelve una lista vacía. Es la
  condición que ya evalúa hoy la página (`rows.length === 0`); lo que cambia es que ahora es la
  **única** condición, y hay un test nombrado que lo fija con un fixture de dos Alternativas y
  ninguna Activa.
- **Cuidado con no romper lo que sí sigue la Activa**: `GET /my/overview` y `GET /my/days` siguen
  resolviendo por la asignación **Activa** (requirement vigente de `member-routine-view`, no tocado
  por este change) y devuelven lista vacía sin ella. La pantalla de ejecución **no** los consume:
  se alimenta de `GET /routines/my/templates` + `GET /routines/my/templates/{assignment_id}`, que
  son por asignación. Confundir los dos caminos es la forma más fácil de reintroducir el vacío
  indebido.
- "Mi rutina" suma un panel secundario **"Historial"** (colapsado por defecto) con las marcas
  propias filtrables por ejercicio, alimentado por `GET /routines/my/logs`. Sin él, el requirement
  "esos registros SHALL seguir siendo consultables **por el Miembro**" no tendría superficie
  cuando el ejercicio ya no está en el plan.

Alternativa descartada: *un formulario de carga por ejercicio al final del día* (más cercano a lo
que hace hoy el endpoint de staff). Rechazada: el proposal define el caso de uso como "en el
momento, con el teléfono en la mano".

### D10. Las dos pantallas nuevas y qué pasa con `/tracking`

| Ruta | Rol | Pantalla |
|---|---|---|
| `/my-routine` | Miembro | Ejecución (reemplaza el plan de solo lectura) |
| `/users/:id/progress` | Dueño/Coach | Progreso del Miembro: histórico filtrable + gráfico |
| `/users/:id/routine/:assignmentId` | Dueño/Coach | Editor de la copia (encabezado: Miembro + `template_name` snapshoteado, D2b) |
| `/tracking` | Dueño/Coach | **Sin cambios**: sigue siendo `ComingSoon` |

- Las tres nuevas son `lazy()` en `App.jsx` con `ProtectedRoute` (`["member"]` la primera,
  `["owner","coach"]` las otras dos), siguiendo el patrón existente.
- **Cómo se alcanza Progreso**: el icon-button `LineChart` con `aria-label` "Progreso" en la fila
  de un Miembro de `/users` (solo si `user.role === "member"`), más un acceso equivalente en la
  ficha `UserDetail` — la spec dice "desde la ficha de un Miembro" y la tabla es la que nombra
  `data-table-row-actions`; se cubren las dos.
- **Cómo se alcanza el editor de la copia**: `MemberTemplatesCard` cambia sus icon-buttons: se va
  `SlidersHorizontal`="Ajustar base" (D4) y entra `PencilLine`="Editar" navegando al editor.
  `Trash2`="Quitar" queda. Es el punto de entrada que fija el requirement "Edición de la copia de un
  Miembro por Dueño o Coach" ("la fila de esa copia entre las rutinas asignadas de la ficha del
  Miembro, mediante el mismo icono de Editar"), con su propio escenario: **no** se agrega ningún
  otro acceso al editor de copias.
- **`/tracking` no se toca y comparte el icono a propósito.** La spec de `data-table-row-actions`
  define el icono de fila como "el mismo que identifica Seguimiento en la navegación lateral", así
  que el ítem del sidebar tiene que seguir existiendo. Progreso-de-un-Miembro y Seguimiento-del-
  gimnasio son la misma idea a dos escalas; convertir `/tracking` en un selector de Miembro sería
  inventar una pantalla que ninguna spec pide. Alternativa descartada: *borrar `/tracking` y su
  ítem del sidebar* — dejaría al icono de fila sin el referente que la spec le asigna.
- **El gráfico** usa `recharts`, ya presente (patrón de `Reports.tsx`): `LineChart` de **peso
  máximo por sesión** (`performed_on`), una línea por ejercicio presente en el filtro. El filtro de
  ejercicio arranca en el **último ejercicio registrado** del Miembro, para que la vista por
  defecto sea una línea legible en vez de una maraña; se puede cambiar o quitar. El listado de
  opciones sale de `GET /routines/users/{id}/logged-exercises` (D6) y **no** de la copia vigente:
  un ejercicio quitado tiene que seguir siendo filtrable. Sin ningún registro, la vista muestra un
  vacío explícito en vez de tabla y gráfico vacíos. Alternativa descartada: *derivar el filtro de
  los ejercicios de la copia Activa* — rompe el requirement del histórico que sobrevive.

### D11. Migración: una sola revision, drops antes que creates, y reasignar a mano después

Revision nueva encadenada a la cabeza actual (confirmar con `alembic heads` al implementar).
**Sin backfill** (regla de BETA). Orden, obligado por las FKs:

1. `drop_table("workout_logs")` — primero, porque tiene la FK a `routine_template_days`. Sus filas
   se pierden: su grano no existe en el modelo nuevo y su `day_id` apunta a días de plantilla que
   dejan de ser el plan de nadie. Declarado en el `docstring` de la revision.
2. `drop_table("routine_assignment_bases")`.
3. `DELETE FROM routine_assignments` — las asignaciones existentes son referencias sin copia; no
   hay forma honesta de convertirlas (habría que decidir el contenido de la copia, o sea
   backfillear). Borrarlas primero permite el paso 4 sin `server_default` de compromiso.
4. `routine_assignments`, en este orden: `drop_constraint("uq_routine_assignments_user_template")`
   (D2); `add_column("template_name", String, nullable=False)` y
   `add_column("template_tag", String, nullable=True)` (posibles sin `server_default` porque el
   paso 3 dejó la tabla vacía); `drop_constraint` de la FK a `routine_templates` y
   `create_foreign_key` equivalente con `ondelete="SET NULL"`; `alter_column("template_id",
   nullable=True)` (D2b). El índice parcial `ix_routine_assignments_user_active` **no se toca** —
   es el que sostiene I5 y recrearlo sin el `postgresql_where`/`sqlite_where` sería perderlo en
   silencio.
5. `create_table` de `routine_assignment_days`, `routine_assignment_day_muscle_groups`,
   `routine_assignment_day_exercises`, en ese orden. `strategy` se declara con
   `postgresql.ENUM("…", name="progressionstrategy", create_type=False)`, **no** con `VARCHAR`
   (hallazgo 4 de la verificación anterior: un `VARCHAR` acá deja el tipo huérfano y hace que el
   próximo `--autogenerate` proponga un `ALTER COLUMN` espurio).
6. `create_table("workout_set_logs")` con la FK a `routine_assignment_days` `ondelete="SET NULL"` y
   el `UniqueConstraint` de D3.
7. `downgrade()`: no-op documentado, como en `bfc5002838bf` y `3887b713f57d`. No hay nada que
   restaurar.

**Después de migrar**: `make seed-dev` y `make seed-dev-exercises` no tocan asignaciones ni
plantillas, así que no cambian. Lo que hay que pedirle al usuario, en desarrollo y en producción,
es **reasignar las plantillas a los Miembros desde la UI** (las plantillas, sus días y sus
ejercicios sobreviven intactos; lo que se perdió son las asignaciones, los ajustes de base y los
registros de entrenamiento). En Railway: `railway run alembic upgrade head` a mano, con el
procedimiento habitual — el deploy no corre migraciones.

Alternativa descartada: *crear una copia por cada asignación existente leyendo su plantilla actual
(un "backfill estructural" como el Día 1 del change anterior)*. Es tentador y sería técnicamente
correcto, pero significa congelar hoy una versión de la plantilla que nadie revisó, y las
asignaciones de producción son de prueba. Reasignar desde la UI es el mismo trabajo, con el Coach
mirando.

### D12. Tests: el helper de plantilla gana un gemelo de copia

`backend/tests/helpers.py` ya tiene `create_template_with_days(...)`; se le suma
`assign_template_copy(db_session, *, user, template, status)` que llama al **mismo camino de
copia** que el endpoint (no arma la copia a mano: si el copiado se rompe, los tests de progreso se
tienen que enterar) y `mark_set(client, ...)`. Sin fixtures `autouse`: la precondición de cada test
se lee en el test, como en los dos changes anteriores.

`backend/tests/test_routine_assignments.py` pierde sus casos de ajuste de base y gana los de copia;
`test_member_routine.py` pierde el alta de logs por staff. El marcado por serie va a un archivo
nuevo, `backend/tests/test_workout_set_logs.py`, para no engordar más `test_member_routine.py`.

### D13. La previsualización del plan la calcula el servidor, por un endpoint sin estado

Decisión tomada después del gate (`verification.md`, la FALLA): el requirement "Cambiar la
estrategia elegida SHALL recalcular de inmediato el plan de series mostrado **sin requerir un paso
adicional de guardado**" no se cumple porque `SET_EXERCISE_STRATEGY` del reducer cambia `strategy`
y deja `planned_sets` como vinieron del último fetch, y **nada dispara un recálculo**. Editar la
base tiene exactamente el mismo residuo, y agregar un ejercicio también (`ADD_EXERCISE` deja
`planned_sets: []`, así que el ejercicio nuevo se muestra sin plan hasta guardar).

El requirement no se reescribe y la fórmula no se duplica en el cliente: se agrega un endpoint de
previsualización.

**Forma del endpoint** — `GET /routines/progression/preview`, **sin estado**:

| | |
|---|---|
| Query params | `strategy` (`ProgressionStrategyLiteral`), `sets` (1..10), `reps` (1..100), `weight_kg` (0..500) |
| Respuesta | `PlannedSetsPreviewOut { planned_sets: list[PlannedSetOut] }` — exactamente `plan_sets(strategy, sets=…, reps=…, weight_kg=…)`, con `logged` siempre `null` |
| Errores | 422 fuera de rango, 403 si el rol no corresponde. No consulta la base: no hay 404 posible |

No recibe `template_id`, `assignment_id`, `day_id` ni `exercise_id`. Es una función pura expuesta
por HTTP, y por eso sirve **igual** a la plantilla y a la copia del Miembro (D8: un solo editor,
una sola forma de previsualizar) y funciona sobre un día con `day_id: null` o un ejercicio recién
agregado que todavía no existe en la base. Vive en `routines.py` (prefijo `/routines`, sin
dependencia de rol a nivel router) y no en `routine_templates.py`, justamente porque no es de
plantillas.

**`GET` y no `POST`**: no tiene efectos, y el verbo de lectura es lo que habilita las dos capas de
caché que hacen que esto no sea una tormenta de requests (abajo). Un `POST` para calcular sería
mentir sobre la semántica y perder el cacheo.

**De a uno, no por lote.** Evaluado: un `POST` con `{items: [...]}` y `client_ref` por ítem. Se
descarta porque la unidad de cambio del editor **es un ejercicio** (un clic de chip, una
confirmación de diálogo, un ejercicio agregado): nunca hay N tuplas nuevas a la vez. Y sobre todo,
de a uno la key de React Query **es la tupla** `(strategy, sets, reps, weight_kg)`, así que volver
a una estrategia ya vista cuesta **cero requests**; con un lote la key es el array entero y esa
tasa de acierto se desploma. Si algún día una pantalla necesita N planes, son N `GET` cacheados.

**Autorización**: `require_role(UserRole.owner, UserRole.coach)` en el endpoint. Es cálculo puro
sobre constantes del sistema, pero no queda abierto:

- *Sin auth (público)*: descartado. Sería el único endpoint sin token de la API y un endpoint
  CPU-bound sin credencial es un amplificador gratis.
- *Cualquier usuario autenticado, incluido el Miembro*: descartado por ahora. Ningún consumidor del
  Miembro lo necesita — su plan ya viene calculado en `GET /routines/my/templates/{id}` (D6) — y
  abrirlo convierte los parámetros de las estrategias (que la spec prohíbe exponer en una UI) en un
  oráculo consultable. Sumar el rol después es aditivo y sin migración.

**Cuándo lo llama el editor.** No con un `dispatch` imperativo por acción, sino **declarativamente**:
cada fila de ejercicio de `RoutineDaysEditor` corre
`usePlannedSetsPreviewQuery({strategy, ...base})` con `staleTime: Infinity` (el plan de una tupla
es inmutable: función pura de constantes del sistema). Consecuencias:

- Cambiar el chip, confirmar el diálogo de base **o** agregar un ejercicio cambian la tupla ⇒
  cambia la query key ⇒ se dispara exactamente **un** fetch. Los tres agujeros se cierran con el
  mismo mecanismo, sin una rama por acción.
- Al montar (y en cada `RESET`), el editor **siembra la caché** con
  `queryClient.setQueryData(queryKeys.progression.preview(tupla), {planned_sets})` usando los
  `planned_sets` que ya trajo el detalle. La carga inicial hace **cero** requests y volver a la
  estrategia original es instantáneo.
- **Sin debounce**, y es deliberado: no hay ningún input que dispare por tecleo. La base se edita
  dentro de `EditExerciseBaseDialog` y solo viaja al borrador al **confirmar**; el chip es un clic
  discreto. El peor caso real —clickear los cinco chips seguidos— son cinco `GET` de ~1 KB sin una
  sola consulta a la base, y el sexto clic sobre una estrategia ya vista es un acierto de caché.
  Un debounce acá agregaría latencia percibida y un timer que testear, a cambio de nada.

**En vuelo y en error.** El borrador nunca queda mostrando un plan que no corresponde ni bloqueado:

- *En vuelo*: la lista de series sigue en pantalla con el plan anterior, atenuada y con
  `aria-busy="true"` más el texto "Recalculando…". No se desmonta (evita que la card salte) pero
  queda explícito que no es el plan vigente.
- *En error*: la lista se reemplaza por "No pudimos recalcular la previsualización" + "Reintentar"
  (`refetch`). Mostrar un plan que se sabe viejo sin decirlo sería peor que no mostrar ninguno.
- *Siempre*: agregar, quitar, mover, cambiar de estrategia y **guardar** siguen habilitados. El
  botón de guardar no depende del estado de ninguna previsualización.
- No hay carrera posible por respuestas fuera de orden: cada fila lee la data **de su key actual**;
  una respuesta vieja se guarda en la caché de su propia tupla y no se renderiza.

**Relación con el borrador local.** El plan previsualizado es un **derivado**, no estado del
borrador: no entra en `DraftExercise` por ninguna acción nueva del reducer, no se agrega a
`serializeDraft` (el cálculo de "sucio" sigue siendo `day_id` + grupos + `(exercise_id, strategy,
base)`) y no viaja en `toSavePayload`. `DraftExercise.planned_sets` deja de ser "lo que se muestra"
y pasa a ser solo **la semilla de caché** de la tupla inicial. Al guardar, el servidor recalcula
con `plan_sets` sobre la base persistida exactamente como hoy (D6): la previsualización no puede
introducir una diferencia entre lo que el Coach vio y lo que se guardó, porque las dos salen de la
**misma** función.

**Alternativas descartadas**:

- *Duplicar la fórmula en TypeScript*. Contradice `frontend/AGENTS.md` ("ninguna fórmula de
  progresión vive en frontend") y, peor, obliga a reimplementar redondeo half-up con `Decimal` en
  un lenguaje sin decimales: `plan_sets` existe en Python precisamente porque `round()` y los
  floats dan otro número (ver el docstring de `app/progression.py`). Dos implementaciones que
  divergen en el redondeo del peso es un bug invisible en la UI y visible en el plan guardado.
- *Previsualización con estado, tipo `POST .../days/preview` con el borrador entero*. Descartada:
  necesita dos rutas (plantilla y copia), manda el árbol completo para un cambio de un chip, y
  vuelve a atar la previsualización a que el borrador sea guardable (ids nulos, validaciones de
  unicidad) cuando el requirement es justamente "sin guardar".
- *Reusar el `PUT` con `dry_run=true`*. Descartada: un verbo de escritura que no escribe, imposible
  de cachear y con el costo de payload del anterior.
- *Reescribir el requirement como "al guardar"* (salida (c) del `verification.md`). Es del Product
  Owner, y el usuario la descartó explícitamente: el objetivo es cumplir el requirement.

### D14. El componente "entrenamientos" del puntaje se cuenta en **sesiones**, no en filas

Hallazgo 4 del `verification.md`: `_progress_score` y `_motivation_for_metrics` reciben `len(logs)`,
pero con D3 `logs` son **series**, no ejercicios. Los umbrales (`_SCORE_LOG_GOAL = 12`) quedaron
donde estaban, así que una sola sesión de 4 ejercicios × 3 series (12 filas) satura los 40 puntos
que antes pedían 3-4 sesiones, y dispara el texto "Excelente constancia" a alguien que entrenó
**un** día. D3 anticipó el cambio de grano para `total_volume` y `unique_days`; para el puntaje, no.

**Decisión**: ese componente pasa a contar **sesiones** —
`session_count = len({log.performed_on for log in logs})` — con meta `_SCORE_SESSION_GOAL = 4`.
Es la lectura fiel del significado original ("constancia": cuántas veces vino a entrenar) y la
única que no hay que re-calibrar la próxima vez que cambie el grano de la tabla.

Concretamente:

- `_collect_progress_snapshot` calcula `session_count` y lo devuelve en su tupla.
- `_progress_score(session_count, attendance_count, improvements)` y
  `_motivation_for_metrics(...)` cambian de parámetro; los umbrales de motivación se reescalan con
  el mismo criterio con el que fueron elegidos (12 registros ≈ 3-4 sesiones, 6 ≈ 2): "excelente
  constancia" = 4 sesiones + 8 asistencias, "muy buen avance" = 2 sesiones.
- **`unique_days` se retira y lo reemplaza `session_count`** en `UserProgressSummary`, en el PDF del
  backend y en el del frontend. `unique_days` cuenta `assignment_day_id` distintos: satura en 5 (una
  copia tiene a lo sumo 5 días) y no crece con la constancia — entrenar veinte veces el Día 1 da 1.
  La card del PDF que lo muestra ya se llama "DIAS ACTIVOS / jornadas con avances": *jornadas* es
  `session_count`, no `unique_days`. En BETA se corrige el modelo, no se agrega un campo al lado
  (AGENTS.md).
- `log_count` **sobrevive** con su significado nuevo explícito (**series marcadas**) y se rotula
  como tal ("SERIES / marcadas"), pero deja de alimentar el puntaje.
- `UserProgressSummary` gana `score: int`, calculado por `_progress_score`, y
  `frontend/src/components/UserCard.tsx:152-159` **deja de reimplementar el puntaje**
  (`Math.min(summary.log_count * 3, 40) + …`, que es el mismo defecto de grano duplicado en el
  cliente, con otros coeficientes). Es el mismo argumento que D13: una sola implementación de cada
  fórmula, en el servidor.

**Alternativas descartadas**:

- *Dejar `len(logs)` y subir la meta a ~36 series*. Descartada: el umbral pasa a depender de cuántos
  ejercicios y series le puso el Coach. Un Miembro con un plan de 2 ejercicios nunca llega a
  "excelente constancia" y otro con 6 satura en dos sesiones. Además hay que recalibrarlo en el
  próximo cambio de grano.
- *Contar pares `(performed_on, exercise_id)`* — que es **exactamente** el grano viejo (una fila por
  ejercicio por sesión) y dejaría intactos los umbrales y todos los asserts de
  `test_progress_score.py`. Es la opción conservadora, y por eso se descarta: mide lo mismo que la
  anterior (cuántos ejercicios planificó el Coach) disfrazado de compatibilidad, y el proyecto
  prefiere el modelo correcto sobre el compatible.
- *Usar el `unique_days` que ya se calcula*. Descartada por lo de arriba: tope estructural de 5 y
  ciego a la repetición, que es justo lo que "constancia" quiere medir.

### D15. El Miembro tiene su propio `logged-exercises`

Durante la implementación se resolvió el filtro del panel "Historial" derivando las opciones de las
filas ya traídas, porque `logged-exercises` solo existía en el scope de staff
(`frontend/src/pages/UserRoutine.tsx:392-405`). Eso es lo que hace que el hallazgo mayor 2 incumpla
un requirement: el `select` solo puede ofrecer lo que entró en la ventana de 40 marcas, así que un
ejercicio quitado de la copia hace tres sesiones **desaparece del filtro** — y ese ejercicio es
exactamente el caso que el requirement nombra.

**Decisión**: se agrega `GET /routines/my/logged-exercises` (rol Miembro), espejo exacto de
`GET /routines/users/{user_id}/logged-exercises`, resuelto sobre el `user_id` del token. Es la
misma delegación de tres líneas que ya usan `/my/logs`, `/my/overview` y `/my/days`
(`my_workout_logs` → `user_workout_logs`), así que no hay lógica nueva que mantener: la consulta
sale del **histórico completo**, no de una ventana ni de la copia vigente, que es la única forma de
que el filtro ofrezca un ejercicio ya quitado.

Alternativas descartadas:

- *Seguir derivando las opciones del histórico, subiendo el `limit` a 200*. Descartada: sigue
  siendo una ventana (ahora de 200 en vez de 40, con el mismo bug a las siete semanas) y trae 200
  filas para llenar un `<select>` de cinco opciones.
- *Abrir el endpoint de staff al Miembro pasándole su propio `user_id`*. Descartada: rompe I10 —
  la ruta pasaría a aceptar un `user_id` de la URL con un token de Miembro, y la única defensa
  quedaría en comparar ids dentro del handler. El scope `/my` existe precisamente para que el
  `user_id` **no** sea un parámetro.
- *Derivarlo de la copia vigente*. Descartada: es la lista de ejercicios que el Miembro **tiene**
  hoy, o sea justo el complemento de lo que el requirement pide.


## Risks / Trade-offs

- **[Dos entrenamientos del mismo ejercicio el mismo día se pisan]** → `performed_on` es la
  sesión (D3). Aceptado: no hay requirement de doble sesión diaria y la alternativa
  (`WorkoutSession`) trae un ciclo de vida sin spec. Si aparece, la salida es agregar
  `session_ordinal` al unique, aditivo.
- **[El histórico no guarda qué estaba planificado al marcar]** → si el Coach cambia la base, no se
  puede reconstruir "hizo 45 kg cuando le habían puesto 47,5". Aceptado: ninguna spec lo consume, y
  `planned_weight_kg`/`planned_reps` son dos columnas nullable que se agregan después sin migrar
  datos.
- **[Duplicación estructural entre plantilla y copia]** → seis tablas donde había tres. Mitigado
  por D8 (una sola implementación de las reglas en cada app); el riesgo residual es que alguien
  agregue una columna a un lado y no al otro, que es visible en un diff de `models.py`.
- **[El rename de `WorkoutLog` toca el PDF y `progress-summary`]** → 38 usos en `routines.py`.
  Mitigado: es deliberado (D3), el compilador/intérprete los señala todos, y `test_progress_score.py`
  ya cubre el scoring. El residuo real es que los **números** del PDF cambian de significado
  (volumen, días únicos); por eso hay un test nombrado sobre el volumen en el grano nuevo.
- **[La asistencia deja de generarse sola al entrenar]** → ya no es un riesgo abierto sino un
  requirement ("Marcar progreso no registra asistencia"): el check-in queda como flujo propio. El
  residuo operativo es que, si nadie usa `/attendance`, las métricas de asistencia del PDF y del
  `progress-summary` quedan en cero — se computan sobre `attendances`, no sobre registros de
  entrenamiento. Es el comportamiento pedido, anotado acá para que no se lea como una regresión.
- **[La etiqueta de origen de una copia no se actualiza si se renombra la plantilla]** → es el
  precio de snapshotear `template_name` (D2b) para que la copia huérfana conserve identidad.
  Aceptado: la copia es una foto de esa plantilla en ese momento. La alternativa (nombre vivo si
  existe, snapshot si no) haría que la misma copia se llame distinto según si alguien borró la
  plantilla.
- **[Borrar una plantilla con copias Alternativas es irreversible]** → las copias quedan sin
  `template_id` y no hay forma de re-vincularlas si la plantilla se recrea con el mismo nombre.
  Aceptado: el requirement pide exactamente eso, y el `DELETE` ya está detrás de una confirmación
  en la UI.
- **[El borrador de la copia hereda los residuos conocidos del editor]** → navegar por URL directa
  o con el botón Atrás pierde el borrador sin aviso (no hay `useBlocker` sin data router), el
  logout no pasa por `guardedNavigate` (hallazgo 8) y un refetch en background puede pisar el
  borrador (hallazgo 9). Al extraer el editor (D8), esos tres residuos pasan a afectar **dos**
  pantallas en vez de una. Aceptado: arreglarlos es una decisión de producto sobre el borrador que
  el change anterior dejó explícitamente anotada, y meterla acá agranda un change ya declarado
  alto. La extracción, al menos, hace que el arreglo futuro sea en un solo lugar.
- **[El histórico sigue sin paginación real]** → con los filtros mandados al servidor (hallazgos
  mayores 1 y 2) el tope de 200 deja de ser un filtro encubierto, pero un Miembro con dos años de
  registros y un período amplio sigue viendo como mucho 200 filas. Aceptado para un gimnasio
  chico; la salida, si aparece, es paginar por cursor sobre `performed_at`.
- **[El editor necesita red para previsualizar el plan]** → con D13, cambiar la estrategia o la
  base sin conexión muestra "No pudimos recalcular la previsualización" en vez de series. Aceptado:
  el editor ya no sirve sin red (guardar es un `PUT`), la alternativa es duplicar la fórmula en el
  cliente (descartada en D13) y el error es explícito, no un plan viejo disfrazado de vigente.
- **[Los números del reporte de progreso cambian de escala]** → con D14 el puntaje de un Miembro
  con una sola sesión baja (10 pts en vez de 40) y la card de "jornadas" pasa a contar sesiones.
  Aceptado y buscado: el número anterior estaba inflado por el cambio de grano de D3. Ninguna spec
  fija estos valores, así que no hay requirement que ajustar.
- **[Un Miembro con muchas semanas de registros carga un histórico largo]** → el `GET` de logs
  mantiene su `limit` (≤ 200) y suma filtros por período. Suficiente para el volumen de un gimnasio
  chico; sin paginación real, anotado.

## Migration Plan

1. Modelo + `routine_days.py` compartido + migración Alembic (D1, D2, D3, D4, D11).
2. Backend: copiar al asignar, editar la copia, marcar series, histórico filtrable, agregados
   recalculados, retiro de los endpoints de base y de logs de staff (D5, D6, D7).
3. Frontend: extracción del editor (D8), ejecución del Miembro (D9), Progreso (D10), icon-buttons
   (D10), retiro de `AdjustExerciseBaseDialog`.
4. Correcciones del gate: endpoint de previsualización + su consumo en el editor compartido (D13)
   y grano del puntaje de progreso de punta a punta, backend y `UserCard` (D14). Sin migración:
   D13 no toca el modelo y D14 solo cambia cómo se agregan filas ya existentes.
5. `make lint` + `make test` en verde; `make migrate` sobre Docker con la base en la revision
   anterior; reasignar plantillas a mano.
6. Producción: `railway run alembic upgrade head` y reasignación manual desde la UI.

Rollback: el `downgrade()` es no-op (D11). Volver atrás significa revertir el código y recrear la
base desde cero — aceptable en BETA, y es el mismo criterio de los dos changes anteriores.

## Open Questions

1. `/tracking` queda como `ComingSoon` compartiendo icono con Progreso (D10). Si más adelante se
   define el Seguimiento global del gimnasio, conviene revisar si el icono de fila debería apuntar
   ahí con el Miembro preseleccionado. No bloquea este change.

## Plan de verificación

**Riesgo**: alto — el diff toca `backend/app/models.py` y `backend/migrations/**`, dropea tablas
con datos (`workout_logs`, `routine_assignment_bases`) y borra filas (`routine_assignments`), y
cambia qué rol puede escribir registros de entrenamiento (se retiran los endpoints de logs de
staff). Cualquiera de los tres gatillos alcanza por separado. Las correcciones del gate (D13, D14)
no lo bajan: D13 estrena un endpoint con rol y D14 cambia un campo del contrato de
`progress-summary`.

### Invariantes

- I1. Una copia tiene entre 1 y 5 `routine_assignment_days` con posiciones contiguas 1..N, y un
  `assignment_day_id` no puede tener dos veces el mismo `exercise_id` (ni por la API ni por la base).
- I2. Guardar la copia sin tocar un día conserva el `id` de ese día: las marcas que lo referencian
  no quedan huérfanas después de un guardado que no lo tocó.
- I3. Editar la copia de un Miembro no modifica ninguna fila de `routine_template_*` ni de la copia
  de ningún otro Miembro, aunque las dos copias vengan de la misma plantilla.
- I4. Editar la plantilla origen después de asignarla no modifica ninguna fila de una copia ya
  creada.
- I5. Un usuario tiene como máximo una asignación con estado Activa, garantizado por el índice
  parcial único en Postgres **y** en SQLite, no solo por el código del endpoint.
- I6. Reasignar la misma plantilla inserta una asignación **nueva** (no un upsert) y degrada la
  anterior a Alternativa sin borrar ninguna de sus marcas.
- I7. Ninguna marca se borra ni se oculta del histórico al quitar un ejercicio, quitar un día o
  borrar la copia entera: en el peor caso queda con `assignment_day_id IS NULL` y su `day_name`.
- I8. Toda marca tiene `1 <= set_index <= len(plan_sets(...))` evaluado sobre la base vigente del
  par (día, ejercicio) al momento de marcar; fuera de ese rango el servidor responde 400.
- I9. Marcar dos veces la misma serie el mismo día corrige la marca, no la duplica
  (`UNIQUE(user_id, assignment_day_id, exercise_id, set_index, performed_on)`).
- I10. Un Miembro solo puede marcar y leer marcas sobre días de sus propias asignaciones; pedir el
  día de otro Miembro es indistinguible de pedir uno inexistente.
- I11. No existe ningún endpoint que permita a un Dueño o Coach crear, modificar o borrar una marca
  de serie de un Miembro.
- I12. Ninguna copia aparece en `GET /routines/templates` ni en ninguna vista de catálogo del
  staff: las copias viven en tablas propias, no en `routine_templates`.
- I13. Ningún módulo bajo `backend/app/` referencia `RoutineAssignmentBase`, `WorkoutLog`,
  `sets_count` ni las rutas de ajuste de base.
- I14. El plan que ve el Miembro contiene exactamente los ejercicios de
  `routine_assignment_day_exercises` de su copia, y las series marcadas que se le adjuntan son solo
  las de `set_index` dentro del plan vigente.
- I15. Un Miembro con al menos una copia asignada —aunque ninguna sea Activa— puede elegirla y
  marcar progreso sobre ella; el estado vacío aparece solo con cero copias.
- I16. Borrar una plantilla se rechaza si y solo si tiene al menos una copia **Activa**; borrarla
  con solo copias Alternativas deja esas copias con `template_id IS NULL`, entrenables, editables y
  con su histórico y su `template_name` intactos.
- I17. Marcar una serie no crea, modifica ni borra ninguna fila de `attendances`, y no existe
  ningún endpoint por el que un Dueño o Coach pueda marcar una serie de un Miembro.
- I18. El plan de series que muestra el editor sale siempre de `plan_sets` en el servidor: ningún
  módulo de `frontend/src/**` calcula series, y para una misma `(strategy, sets, reps, weight_kg)`
  lo previsualizado y lo guardado son idénticos por construcción.
- I19. La previsualización es un derivado: no entra en el payload del `PUT`, no afecta el cálculo
  de "sucio", y ni en vuelo ni en error bloquea editar o guardar el borrador — mientras tanto el
  editor nunca presenta un plan de una tupla vieja sin decir que no es el vigente.
- I20. El componente de entrenamientos del puntaje de progreso se calcula sobre **sesiones**
  (`performed_on` distintos), no sobre filas de `workout_set_logs`: agregar series dentro de una
  misma sesión no lo mueve.
- I21. El puntaje de progreso se calcula en un solo lugar (`_progress_score`); el cliente lo
  consume del `progress-summary` y no lo reimplementa.
- I22. Ninguna de las dos pantallas de histórico (Progreso del staff y "Historial" del Miembro)
  filtra en memoria sobre una ventana fija: el ejercicio y el período viajan como parámetros al
  servidor, y las opciones del filtro salen del histórico completo, no de las filas ya traídas.
- I23. El `PUT` de marca es idempotente también ante dos requests solapados: el segundo corrige la
  marca o reintenta, nunca devuelve 500.
- I24. `day_name` es el snapshot de `"Día {position}"`: el mismo día no puede aparecer en el
  histórico con dos etiquetas distintas por haber cambiado sus grupos musculares.

### Tests

| Capa | Archivo | Caso |
|---|---|---|
| backend | `backend/tests/test_routine_assignments.py` | `test_asignar_copia_dias_grupos_ejercicios_base_y_estrategia` |
| backend | `backend/tests/test_routine_assignments.py` | `test_editar_la_plantilla_origen_no_cambia_la_copia_ya_creada` |
| backend | `backend/tests/test_routine_assignments.py` | `test_editar_la_copia_de_un_miembro_no_toca_la_copia_del_otro_ni_la_plantilla` |
| backend | `backend/tests/test_routine_assignments.py` | `test_reasignar_la_misma_plantilla_crea_copia_nueva_y_degrada_la_anterior` |
| backend | `backend/tests/test_routine_assignments.py` | `test_una_sola_asignacion_activa_por_usuario_con_varias_copias` |
| backend | `backend/tests/test_routine_assignments.py` | `test_guardar_la_copia_sin_tocar_un_dia_conserva_su_id_y_sus_marcas` |
| backend | `backend/tests/test_routine_assignments.py` | `test_los_endpoints_de_ajuste_de_base_por_cliente_ya_no_existen` |
| backend | `backend/tests/test_routine_assignments.py` | `test_agregar_un_ejercicio_a_la_copia_arranca_en_constante_y_3x10x0` |
| backend | `backend/tests/test_workout_set_logs.py` | `test_marcar_una_serie_registra_el_peso_y_las_reps_reales` |
| backend | `backend/tests/test_workout_set_logs.py` | `test_remarcar_la_misma_serie_el_mismo_dia_corrige_en_vez_de_duplicar` |
| backend | `backend/tests/test_workout_set_logs.py` | `test_marcar_una_serie_mas_alla_de_las_planificadas_es_400` |
| backend | `backend/tests/test_workout_set_logs.py` | `test_marcar_un_ejercicio_que_no_esta_en_la_copia_es_400` |
| backend | `backend/tests/test_workout_set_logs.py` | `test_un_miembro_no_puede_marcar_sobre_el_dia_de_otro_miembro` |
| backend | `backend/tests/test_workout_set_logs.py` | `test_reducir_las_series_conserva_las_marcas_previas_fuera_del_plan_vigente` |
| backend | `backend/tests/test_workout_set_logs.py` | `test_quitar_un_dia_de_la_copia_deja_las_marcas_con_day_id_nulo_y_day_name` |
| backend | `backend/tests/test_workout_set_logs.py` | `test_el_plan_del_miembro_trae_marcadas_solo_las_series_de_hoy` |
| backend | `backend/tests/test_member_routine.py` | `test_el_historico_del_miembro_filtra_por_ejercicio_y_periodo` |
| backend | `backend/tests/test_member_routine.py` | `test_los_ejercicios_con_registros_incluyen_uno_quitado_de_la_copia` |
| backend | `backend/tests/test_routine_assignments.py` | `test_borrar_la_plantilla_origen_con_solo_copias_alternativas_deja_la_copia_entrenable` |
| backend | `backend/tests/test_routine_templates.py` | `test_borrar_una_plantilla_con_una_copia_activa_es_409_y_lo_dice_en_el_mensaje` |
| backend | `backend/tests/test_routine_templates.py` | `test_borrar_una_plantilla_con_solo_copias_alternativas_la_elimina` |
| backend | `backend/tests/test_workout_set_logs.py` | `test_un_miembro_sin_asignacion_activa_puede_marcar_sobre_una_alternativa` |
| backend | `backend/tests/test_workout_set_logs.py` | `test_marcar_una_serie_no_crea_ninguna_asistencia` |
| backend | `backend/tests/test_roles.py` | `test_un_coach_no_tiene_endpoint_para_marcar_series_de_un_miembro` |
| backend | `backend/tests/test_progress_score.py` | `test_el_volumen_total_se_calcula_por_serie_marcada` |
| backend | `backend/tests/test_routines_invariants.py` | `test_el_ajuste_de_base_por_cliente_no_existe_en_el_modelo_ni_en_la_api` |
| frontend | `frontend/src/pages/__tests__/UserRoutine.test.tsx` | `precarga el peso planificado al marcar una serie` |
| frontend | `frontend/src/pages/__tests__/UserRoutine.test.tsx` | `muestra la serie ya marcada con lo ejecutado y permite corregirla` |
| frontend | `frontend/src/pages/__tests__/UserRoutine.test.tsx` | `ofrece exactamente cuatro acciones de marcar para un plan de cuatro series` |
| frontend | `frontend/src/pages/__tests__/UserRoutine.test.tsx` | `deja elegir y marcar sobre una copia Alternativa aunque no haya ninguna Activa` |
| frontend | `frontend/src/pages/__tests__/UserRoutine.test.tsx` | `muestra el estado vacío solo cuando no hay ninguna copia asignada` |
| frontend | `frontend/src/pages/__tests__/MemberProgress.test.tsx` | `filtra el histórico por ejercicio` |
| frontend | `frontend/src/pages/__tests__/MemberProgress.test.tsx` | `ofrece en el filtro un ejercicio que ya no está en la copia` |
| frontend | `frontend/src/pages/__tests__/MemberProgress.test.tsx` | `avisa que el miembro no registró progreso en vez de mostrar tabla y gráfico vacíos` |
| frontend | `frontend/src/pages/__tests__/MemberRoutineEditor.test.tsx` | `guarda los días de la copia con un solo PUT a la asignación` |
| frontend | `frontend/src/pages/__tests__/MemberRoutineEditor.test.tsx` | `no deja agregar un sexto día a la copia` |
| frontend | `frontend/src/pages/__tests__/Users.test.tsx` | `expone el icon-button Progreso solo en la fila de un Miembro` |
| frontend | `frontend/src/components/__tests__/MemberTemplatesCard.test.tsx` | `ofrece Editar la copia y ya no ofrece Ajustar base` |
| backend | `backend/tests/test_progression.py` | `test_la_previsualizacion_devuelve_el_mismo_plan_que_el_guardado` |
| backend | `backend/tests/test_progression.py` | `test_la_previsualizacion_le_responde_403_a_un_miembro` |
| backend | `backend/tests/test_progression.py` | `test_la_previsualizacion_rechaza_una_base_fuera_de_rango` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `recalcula el plan mostrado al cambiar la estrategia, sin guardar` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `deja guardar aunque la previsualización falle` |
| frontend | `frontend/src/pages/__tests__/MemberRoutineEditor.test.tsx` | `recalcula el plan de la copia al confirmar una base nueva, sin guardar` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `avisa 'Sin conexión' en vez de mostrar en silencio el plan de la tupla vieja` |
| backend | `backend/tests/test_progress_score.py` | `test_una_sola_sesion_con_muchas_series_no_satura_el_componente_de_entrenamientos` |
| backend | `backend/tests/test_progress_score.py` | `test_cuatro_sesiones_de_una_serie_saturan_el_componente_de_entrenamientos` |
| frontend | `frontend/src/components/__tests__/UserCard.test.tsx` | `usa el puntaje que calcula el servidor en el PDF de progreso` |
| backend | `backend/tests/test_member_routine.py` | `test_el_miembro_lista_sus_ejercicios_con_registros_incluido_uno_quitado` |
| backend | `backend/tests/test_member_routine.py` | `test_los_ejercicios_con_registros_del_miembro_no_aceptan_un_user_id_ajeno` |
| backend | `backend/tests/test_workout_set_logs.py` | `test_marcar_la_misma_serie_dos_veces_en_paralelo_no_devuelve_500` |
| backend | `backend/tests/test_workout_set_logs.py` | `test_el_day_name_guardado_es_la_posicion_sin_los_grupos_musculares` |
| frontend | `frontend/src/pages/__tests__/MemberProgress.test.tsx` | `pide el histórico filtrado al servidor en vez de filtrar en memoria` |
| frontend | `frontend/src/pages/__tests__/MemberProgress.test.tsx` | `encuentra un registro más viejo que la ventana de doscientas marcas` |
| frontend | `frontend/src/pages/__tests__/UserRoutine.test.tsx` | `ofrece en el Historial un ejercicio sin marcas en las últimas cuarenta` |
| frontend | `frontend/src/pages/__tests__/UserRoutine.test.tsx` | `pide al servidor las marcas del ejercicio elegido en el Historial` |
| frontend | `frontend/src/pages/__tests__/MemberRoutineEditor.test.tsx` | `no muestra una etiqueta vacía cuando la plantilla origen no tenía tag` |
| manual | — | **Migración** (el gate no corre `alembic upgrade head`): con el stack Docker en la revision anterior (`make docker-up`), correr `make migrate`; verificar que `alembic heads` devuelve **una sola** cabeza, que existen `routine_assignment_days`, `routine_assignment_day_muscle_groups`, `routine_assignment_day_exercises` y `workout_set_logs`, que ya no existen `workout_logs` ni `routine_assignment_bases`, que `routine_assignments` quedó vacía, que `uq_routine_assignments_user_template` no existe y que `ix_routine_assignments_user_active` sí, y que `routine_assignment_day_exercises.strategy` tiene tipo `progressionstrategy` (no `varchar`). |
| manual | — | **Ejecución en el teléfono**: con `make dev`, entrar como `dev.member@miniespacio.local` a `/my-routine` en un viewport de 390 px, marcar la serie #1 de un ejercicio con un peso distinto al planificado, recargar la página y verificar que la marca persiste y que el campo viene precargado con lo ejecutado. |
| manual | — | **Recálculo al instante** (el escenario que falló en el gate): con `make dev`, abrir una plantilla con un ejercicio en Constante 3 × 10 · 99 kg, clickear el chip "Rest-pause" **sin guardar** y verificar que las tres series pasan a `99×10, 99×9 (20 s), 99×8 (20 s)`; volver a "Constante" y verificar que vuelven a `99×10` las tres. Repetir en la copia de un Miembro (`/users/{id}/routine/{assignmentId}`) editando la base a 4 × 8 · 60 kg desde el diálogo. |
| manual | — | **Ejecución a 390 px** (quedó sin verificar en el gate): con `make dev` y el viewport en 390 px de ancho (DevTools, iPhone 14), entrar como `dev.member@miniespacio.local` a `/my-routine`, elegir una copia en los tabs, abrir una serie y marcarla con un peso distinto al planificado, corregirla, y desplegar el panel "Historial" y filtrar por un ejercicio. Verificar que ningún control queda fuera de pantalla ni requiere scroll horizontal, que los targets táctiles se pueden tocar con el pulgar y que el teclado numérico no tapa el botón de confirmar. |
| manual | — | **Gráfico de evolución**: marcar la misma serie del mismo ejercicio en tres fechas distintas (ajustando `performed_on` por SQL si hace falta), abrir `/users/{id}/progress` como Dueño y verificar que el gráfico dibuja la tendencia creciente y que el filtro de período la recorta. |
