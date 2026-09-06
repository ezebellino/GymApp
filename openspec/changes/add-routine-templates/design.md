## Context

Hoy el dominio de rutinas es un **catálogo plano y compartido**: `TrainingDay` (4 días con
`day_order` único), `Exercise` (nombre, grupo muscular, `is_active`) y `TrainingDayExercise` (el
vínculo día↔ejercicio con `is_active` y `sort_order`, que hoy significa "este ejercicio está
activo en este día **para todo el gimnasio**"). `WorkoutLog` registra lo que el miembro hizo.
Todo eso lo sirve `backend/app/routers/routines.py` (1331 líneas: catálogo, alta/edición de
ejercicios, selección de días, logs, resumen y PDF de progreso), y `_ensure_seed_data()` se
ejecuta al principio de casi todos sus endpoints: reseedea días/ejercicios y **borra los
`TrainingDayExercise` que ya no están en `routine_catalog.py`**. Ese detalle condiciona el modelo
de datos de este change (D2).

En el frontend, `pages/Routines.tsx` es hoy un placeholder de 21 líneas ("sección en
reconstrucción") y `pages/UserRoutine.tsx` es la vista del miembro con carga imperativa vía
`api.get` y `useState`, anterior a la convención de `services/*.ts` + `*.queries.ts` +
`queryKeys.ts` que ya usan Usuarios, Pagos y Asistencias.

Restricciones que enmarcan el diseño:

1. **Sesión paralela en curso**: el change `move-user-actions-to-detail` está a mitad de un
   rework y tiene sin commitear `backend/app/routers/users.py`,
   `frontend/src/services/users.ts`, `users.queries.ts`, `pages/UserDetail.tsx` y varios
   `components/*Dialog.tsx`. Este change trabaja sobre archivos nuevos y toca `UserDetail.tsx` en
   **un solo bloque de 3 líneas** (D11).
2. **Producción en Railway sin migraciones automáticas en el deploy**: cualquier tabla o columna
   nueva exige un paso manual explícito (Migration Plan).
3. **La suite de backend corre en SQLite** (`conftest.py`) y producción en Postgres: los índices
   parciales necesitan `postgresql_where` **y** `sqlite_where` (como ya hace
   `MemberInvitation.ix_member_invitations_user_id_live`), y cualquier unicidad
   case-insensitive no puede depender de `lower()` del motor (D1).
4. Las specs fijan **valores numéricos exactos** de las cinco estrategias, incluidos los tres
   pisos/redondeos de borde (Rest-pause ≥ 1 rep, Invertida ≥ 2,5 kg, Drop set `1,5 × R` half-up):
   el motor tiene que reproducirlos al dígito.
5. El alta/edición de ejercicios del catálogo **ya existe** (`POST`/`PUT /routines/exercises`,
   hoy `require_role(owner)`): la base se agrega como un campo más de ese flujo, sin construir uno
   nuevo (proposal, "fuera de alcance").

## Goals / Non-Goals

**Goals:**

- Modelar la plantilla como una **capa sobre el catálogo existente**, sin duplicar días ni
  ejercicios y sin cambiar la semántica de `TrainingDayExercise`.
- Un **motor de progresión determinístico y puro**, con una única implementación en el repo, que
  reproduzca exactamente los casos de la spec `progression-strategies`, bordes incluidos.
- Asignación de plantillas a miembros con estado Activa/Alternativa garantizado por la base (no
  solo por código), ajuste de base por cliente con autoría, y sus dos inversos (quitar el ajuste,
  quitar la asignación).
- Nombre de plantilla único case-insensitive con la misma semántica en Postgres y SQLite.
- Vista "Mi rutina" que consume el plan calculado **por el backend**, de solo lectura.
- Minimizar la superficie de colisión con `move-user-actions-to-detail`.

**Non-Goals:**

- Registro serie por serie del cliente, contador de series completadas, "Mi progreso", insights,
  columna "Plantilla · Día" en Seguimiento, botón "Sugerir" (fuera de alcance en `proposal.md`).
- Editar los parámetros de las estrategias desde la UI (la spec lo prohíbe explícitamente).
- Persistir una "estrategia por defecto de la plantilla": la spec la prohíbe explícitamente
  (requirement "Sin estrategia por defecto de la plantilla"); el default es Constante por
  (plantilla, día, ejercicio) — D2.
- **Construir un flujo nuevo de alta/edición de ejercicios**: el backend suma el campo base al
  flujo existente y el frontend expone la **edición** de esa base desde el detalle de plantilla
  (D3). Reconstruir la pantalla de catálogo de ejercicios (hoy borrada) es otro change.
- Reordenar los ejercicios dentro de un día desde la plantilla (ninguna requirement lo pide).
- Tocar `WorkoutLog`, el PDF de progreso o el resumen de progreso.

## Decisions

### D1. La plantilla es una capa sobre el catálogo: 3 tablas nuevas, cero cambios de semántica

`routine_templates` (la plantilla), `routine_template_days` (qué días incluye y en qué orden) y
`routine_template_exercises` (la configuración activo/estrategia por combinación plantilla-día-
ejercicio).

```python
class RoutineTemplate(Base):            # routine_templates
    id, name, name_normalized, tag, created_at, updated_at, created_by_user_id
    UniqueConstraint(name_normalized)

class RoutineTemplateDay(Base):         # routine_template_days
    id, template_id -> routine_templates.id (CASCADE)
    day_id -> training_days.id (CASCADE)
    position: int                        # orden dentro de la plantilla
    UniqueConstraint(template_id, day_id)

class RoutineTemplateExercise(Base):    # routine_template_exercises
    id, template_id -> routine_templates.id (CASCADE)
    day_id -> training_days.id (CASCADE)
    exercise_id -> exercises.id (CASCADE)
    is_active: bool
    strategy: Enum(ProgressionStrategy)
    updated_at, updated_by_user_id
    UniqueConstraint(template_id, day_id, exercise_id)
```

`tag` es texto libre corto (≤ 24 caracteres, normalizado a mayúsculas), no un enum: la spec da
FUERZA/HIPERTROFIA/RECOMP/INICIO como **ejemplos** ("por ejemplo"), y cerrar el conjunto agregaría
una regla que nadie pidió.

**Unicidad del nombre (spec "Nombre de plantilla único")**: se guarda `name` como lo escribió el
usuario pero con `strip()`, y una columna derivada `name_normalized` =
`unicodedata.normalize("NFC", name).strip().casefold()` con índice único simple. La normalización
la hace **Python**, no el motor: `lower()` de SQLite es ASCII-only, así que un índice funcional
`lower(name)` dejaría pasar "FUERZA 4 DÍAS" vs "Fuerza 4 días" en la suite de tests (SQLite) y lo
rechazaría en producción (Postgres) — el peor de los mundos, un invariante que ningún test puede
verificar. Con la columna derivada, base y tests se comportan igual en los dos motores. El
endpoint chequea la colisión antes de insertar y responde **409** con mensaje en español ("Ya
existe una plantilla con ese nombre"); el índice único es la red de seguridad ante carreras.

*Alternativas consideradas*: (a) que la plantilla tenga sus propios días y ejercicios (copia del
catálogo al crearla) — se descarta: la decisión de producto es "catálogo compartido, la plantilla
elige un subconjunto ordenado", y copiar obligaría a sincronizar cuando el catálogo cambia
(`_ensure_seed_data` corre en cada request); (b) índice funcional `lower(name)` — descartado por
lo de SQLite; (c) validar la unicidad solo en la aplicación — sin índice, dos requests
concurrentes crean el duplicado que la spec prohíbe.

### D2. La configuración por ejercicio NO cuelga del día de la plantilla ni del link del catálogo

`routine_template_exercises` referencia `(template_id, day_id, exercise_id)` **directo**, no
`routine_template_days.id` ni `training_day_exercises.id`. Dos razones, ambas de requirement o de
código existente:

- La spec exige que quitar un día de la plantilla **no borre** la configuración de sus ejercicios
  y que al re-agregarlo reaparezca igual. Con FK a `routine_template_days` + `ON DELETE CASCADE`,
  quitar el día la borraría; sin cascade, quedarían filas huérfanas apuntando a una fila muerta.
  Con esta forma, "quitar un día" es sencillamente borrar la fila de `routine_template_days`, y
  la configuración queda intacta esperando.
- `_ensure_seed_data()` **borra y recrea** filas de `training_day_exercises` cada vez que el
  catálogo cambia. Colgarse de su `id` haría que un reseed se llevara puesta la configuración de
  todas las plantillas.

**Filas ralas (sparse) con fallback**: solo existe fila cuando alguien configuró explícitamente
ese ejercicio en esa plantilla. Al leer, el ejercicio sin fila hereda `is_active` del catálogo
(`TrainingDayExercise.is_active`) y `strategy = constant` — que es exactamente el requirement "un
ejercicio nuevo dentro de una plantilla arranca en Constante". Al escribir (toggle o chip), se
hace upsert de la fila. Así una plantilla recién creada ya muestra los ejercicios activos por
defecto del día, y el volumen de filas queda acotado a lo que el coach realmente tocó.

*Alternativa considerada*: materializar todas las filas (plantilla × día × ejercicio) al agregar
un día. Lectura más simple (sin fallback), pero ~24 filas por día por plantilla, y hay que
decidir qué hacer cuando el catálogo suma un ejercicio nuevo después (backfill perezoso, o sea el
mismo fallback pero escondido). Se descarta.

### D3. La base va como tres columnas de `exercises` y entra al flujo existente de alta/edición

```python
# Exercise (columnas nuevas, NOT NULL con server_default)
base_sets: int          # default 3
base_reps: int          # default 10
base_weight_kg: float   # default 0
```

Es una relación 1:1 con el ejercicio y siempre se lee junto con él: una tabla aparte
(`exercise_bases`) solo agregaría un join a cada lectura del catálogo.

La spec "Base del ejercicio al crear o editar en el catálogo" pide que el **flujo existente** la
acepte. Concretamente, y sin cambiar nada más de ese flujo:

- `schemas.RoutineExerciseCreate` suma `base_sets` / `base_reps` / `base_weight_kg` opcionales con
  default `3 / 10 / 0`; `RoutineExerciseUpdate` los suma como opcionales (el endpoint ya hace
  `model_dump(exclude_unset=True)` + `setattr`, así que la edición parcial sale sola);
  `RoutineExerciseManageOut` los devuelve.
- `create_routine_exercise` / `update_routine_exercise` (`backend/app/routers/routines.py`) pasan a
  asignar esos campos. **Es la única edición de `routines.py` en este change** además del punto
  siguiente, y ese archivo no lo toca la sesión paralela.
- Validación: `base_sets ≥ 1`, `base_reps ≥ 1`, `base_weight_kg ≥ 0` (422 si no).
- **El rol exigido no cambia**: siguen siendo `require_role(UserRole.owner)`, tal como están hoy.
  El proposal dice explícitamente "sin cambiar ese flujo más allá de ese campo", así que ampliar
  el permiso a Coach sería un cambio de autorización que este change no tiene mandato de hacer
  (ver Notas para el Product Owner, N1).

`routine_catalog.py` suma `base_sets`/`base_reps`/`base_weight_kg` a cada entrada de
`EXERCISE_LIBRARY` (es un archivo de datos), `_ensure_seed_data` los usa **solo al crear** un
ejercicio que no existía, y la migración backfillea las filas ya seedeadas con una tabla estática
**copiada dentro del archivo de migración** (una migración no importa constantes de la app: son
snapshots, y la constante puede cambiar mañana).

En el frontend, la edición de la base se expone donde la base se ve: el detalle de plantilla
muestra la base de cada ejercicio y, para el Dueño, un botón que abre `EditExerciseBaseDialog`
sobre el mismo `PUT /routines/exercises/{id}` (D11). No se construye una pantalla de alta de
ejercicios: hoy no existe (fue borrada a pedido de producto) y reconstruirla está fuera de alcance.

### D4. Motor de progresión: función pura en `backend/app/progression.py`, con `Decimal`

Módulo nuevo, sin imports de SQLAlchemy ni de FastAPI:

```python
class ProgressionStrategy(str, enum.Enum):   # vive en models.py, se importa acá
    constant, pyramid, inverted, drop_set, rest_pause

@dataclass(frozen=True)
class PlannedSet:
    index: int          # 1-based
    weight_kg: float
    reps: int
    note: str | None    # "20 s" | "al fallo" | None

def plan_sets(strategy, *, sets: int, reps: int, weight_kg: float) -> list[PlannedSet]
```

Constantes del sistema en el mismo módulo (`ROUND_STEP_KG = 2.5`, `PYRAMID_RATE = 0.06`,
`INVERTED_RATE = 0.06`, `INVERTED_REPS_STEP = 2`, `MIN_REPS_PYRAMID = 3`, `MIN_REPS_REST_PAUSE = 1`,
`MIN_WEIGHT_KG = 2.5`, `DROP_SET_WEIGHT_FACTOR = 0.8`, `DROP_SET_REPS_FACTOR = 1.5`,
`REST_PAUSE_SECONDS = 20`), sin ningún endpoint que las escriba — la spec prohíbe exponerlas.

**Aritmética con `Decimal` y redondeo half-up explícito**, no `round()`: `round()` de Python usa
banker's rounding (`round(8.5) == 8`) y los floats introducen ruido (`14 * 1.06 =
14.839999999999998`). El redondeo de peso es `Decimal(str(value)) / Decimal("2.5")` cuantizado a
entero con `ROUND_HALF_UP` y multiplicado de vuelta por `2.5`; el mismo `ROUND_HALF_UP` resuelve
`1,5 × R` de Drop set con `R` impar (R=7 → 10,5 → 11, escenario de la spec). Con eso los cuatro
casos de Pirámide, los tres de Invertida, los dos de Drop set y los dos de Rest-pause salen
exactos.

**Pisos, todos fijados por la spec** (ya no son decisiones abiertas del diseño):
Pirámide `max(R − 2i, 3)`; Rest-pause `max(R − i, 1)`; Invertida, peso `max(redondeado, 2,5)`.
El único borde que las specs no nombran es `sets <= 0` (base inválida, imposible por la validación
de 422 en D3): devuelve lista vacía en vez de romper.

### D5. El plan se calcula **solo** en el backend; el chip guarda y devuelve el plan recalculado

La spec pide que cambiar la estrategia recalcule el plan "de inmediato, sin un paso adicional de
guardado". Se resuelve con **autosave**: el click en el chip dispara
`PUT /routines/templates/{id}/days/{day_id}/exercises/{exercise_id}`, que responde con la
configuración **y su `planned_sets` ya recalculado**; el hook escribe esa respuesta en la caché
de TanStack Query (`setQueryData`) sin refetch. El coach nunca ve un botón "Guardar", que es
exactamente lo que la spec exige, y el frontend no reimplementa ninguna fórmula.

*Alternativas consideradas*:
- **Espejo del motor en TypeScript** para previsualizar offline: dos implementaciones de las
  mismas cinco fórmulas (y de los tres pisos), con drift garantizado a la primera corrección de
  redondeo. Se descarta: el costo de mantener el espejo supera al de un round-trip por click.
- **Endpoint de previsualización sin persistir** (`POST /routines/templates/preview`): mismo
  round-trip que el autosave pero además obliga a un botón "Guardar" explícito, lo contrario de
  lo que pide la spec.

Riesgo asumido del autosave: un click equivocado persiste. Mitigación: el chip anterior sigue a
un click de distancia y el estado se ve siempre (el chip elegido queda marcado); no hay borrado
de datos involucrado.

### D6. Asignación: tabla propia, "máximo una Activa" garantizado por índice único parcial

```python
class RoutineAssignmentStatus(str, enum.Enum):
    active, alternative

class RoutineAssignment(Base):          # routine_assignments
    id, user_id -> users.id (RESTRICT), template_id -> routine_templates.id (RESTRICT)
    status: Enum(RoutineAssignmentStatus)
    starts_on: Date                      # "fecha desde la que rige"
    created_at, created_by_user_id
    UniqueConstraint(user_id, template_id)
    Index("ix_routine_assignments_user_active", "user_id", unique=True,
          postgresql_where=text("status = 'active'"), sqlite_where=text("status = 'active'"))
```

El índice parcial es la red de seguridad: la regla "como máximo una Activa" queda en la base y no
depende de que ningún endpoint futuro se acuerde de degradar la anterior. El endpoint hace la
degradación explícita (`UPDATE ... SET status='alternative' WHERE user_id=? AND status='active'`)
antes del insert, con `flush()` entre ambas operaciones para no chocar contra el índice dentro de
la misma transacción. Se sigue el precedente de `MemberInvitation` (índice parcial con los dos
dialectos declarados) porque la suite corre en SQLite y producción en Postgres. El índice permite
**cero** asignaciones activas, que es justo lo que exige el requirement "quitar la Activa no
promueve ninguna Alternativa".

`UniqueConstraint(user_id, template_id)` hace que **reasignar la misma plantilla al mismo
miembro sea un upsert** (actualiza estado y fecha) en lugar de un 409 o de una segunda fila
duplicada: es lo que un coach espera al "volver a asignar" una plantilla que ya estaba como
Alternativa.

**Quitar una asignación** (`DELETE`) borra la fila y sus ajustes de base por cascade, y **no**
toca el estado de ninguna otra asignación del miembro: la no-promoción es simplemente "no hacer
nada más", explícito en el código con un comentario y cubierto por test. La confirmación que pide
la spec es responsabilidad de la UI (`ConfirmActionDialog`, D11).

*Alternativa considerada*: un campo `active_template_id` en `User`. Se descarta: no permite el
historial de asignaciones, mezcla dominio de rutinas dentro de la tabla de usuarios (justo el
archivo que la sesión paralela está editando) y exigiría una migración sobre `users`.

### D7. Ajuste de base por cliente: tabla hija de la asignación, autoría por fila, reversible

```python
class RoutineAssignmentBase(Base):      # routine_assignment_bases
    id, assignment_id -> routine_assignments.id (CASCADE)
    exercise_id -> exercises.id (CASCADE)
    sets, reps, weight_kg
    adjusted_by_user_id -> users.id (SET NULL), adjusted_at
    UniqueConstraint(assignment_id, exercise_id)
```

La autoría se guarda **por fila** (quién ajustó ese ejercicio y cuándo). El dato que la ficha
muestra ("Ajustada por Eze el 24/08") se **deriva** de la fila con `adjusted_at` más reciente y se
expone como `last_adjustment: {by_name, at} | null`; sin filas, la asignación reporta
`adjustments_count: 0` y la UI dice "Sin ajustes". Derivar en vez de denormalizar en
`routine_assignments` evita dos fuentes de verdad que se desincronizan al primer bug, y hace que
**quitar** un ajuste (`DELETE .../bases/{exercise_id}`, requirement "Quitar el ajuste de base de
un ejercicio") no necesite recalcular ningún contador: borrada la fila, el derivado ya refleja
"sin ajustes" o el ajuste anterior más reciente, sin ningún paso extra.

La resolución de la base al calcular el plan del miembro es: **override del ajuste si existe, si
no la base del catálogo**. Es la única precedencia del sistema y vive en una sola función
(`_resolve_base(exercise, overrides)`), no repartida por endpoint.

### D8. Membresía activa: se lee, condiciona solo el alta, y nunca borra nada

`POST` de asignación valida `target.role == member` y `target.membership_status == active`; si no,
**409 Conflict** con mensaje en español (mismo código y forma que ya usan las acciones de
membresía existentes para "el estado no corresponde"). No se agrega ninguna columna ni endpoint
de membresía, y `require_can_manage_user` (`backend/app/deps.py`) se **reutiliza tal cual** para
el permiso — sin editar ese archivo, que la sesión paralela también consume.

La condición aplica **solo al alta**: dar de baja la membresía no borra, no degrada y no oculta
ninguna asignación existente, y los endpoints del miembro (`/routines/my/templates`) **no filtran
por `membership_status`**. Es requirement explícito ("Dar de baja la membresía no quita las
asignaciones existentes") y por lo tanto va con test propio a los dos lados (backend y la card de
la ficha, que oculta el botón de asignar pero sigue listando lo asignado).

### D9. Dos routers nuevos; de los existentes, solo dos endpoints de `routines.py`

| Archivo | Prefijo | Rol |
|---|---|---|
| `backend/app/routers/routine_templates.py` (nuevo) | `/routines/templates` | owner + coach |
| `backend/app/routers/routine_assignments.py` (nuevo) → `router` | `/routines/users/{user_id}/templates` | owner + coach |
| `backend/app/routers/routine_assignments.py` (nuevo) → `my_router` | `/routines/my/templates` | member |
| `backend/app/routers/routines.py` (existente) | `POST`/`PUT /routines/exercises` | owner (sin cambios) |

Los prefijos viven bajo el namespace `/routines/...` que el frontend ya conoce, pero el código
está en archivos nuevos: de `routines.py` solo se tocan los dos endpoints de ejercicio para sumar
la base (D3), y `users.py` (en edición por la otra sesión) no se toca en absoluto. `main.py` suma
tres `include_router` y un import. `_ensure_seed_data` se **importa** desde `.routines` (los
routers nuevos la llaman al entrar, igual que todos los demás endpoints de rutinas) en lugar de
moverla a un módulo compartido, para acotar el diff sobre ese archivo; el trade-off es un import
de un símbolo privado entre routers, aceptable frente al riesgo de conflicto.

**Contrato**:

```
GET    /routines/templates                          → [{id, name, tag, day_count,
                                                        assignment_count, created_at}]
POST   /routines/templates                          {name, tag, day_ids[≥1]}          → 201 detalle
GET    /routines/templates/{id}                     → detalle
PATCH  /routines/templates/{id}                     {name?, tag?, day_ids?[≥1]}       → detalle
DELETE /routines/templates/{id}                     → 204 · 409 si tiene asignaciones
PUT    /routines/templates/{id}/days/{day_id}/exercises/{exercise_id}
                                                    {is_active?, strategy?}           → ejercicio

GET    /routines/users/{user_id}/templates          → [asignación]
POST   /routines/users/{user_id}/templates          {template_id, status, starts_on?,
                                                     base_overrides?[]}               → 201
PATCH  /routines/users/{user_id}/templates/{assignment_id}   {status}                 → asignación
DELETE /routines/users/{user_id}/templates/{assignment_id}                            → 204
PUT    /routines/users/{user_id}/templates/{assignment_id}/bases/{exercise_id}
                                                    {sets, reps, weight_kg}           → asignación
DELETE /routines/users/{user_id}/templates/{assignment_id}/bases/{exercise_id}        → asignación

GET    /routines/my/templates                       → [asignación (sin datos de otros)]
GET    /routines/my/templates/{assignment_id}       → detalle con el plan calculado

POST   /routines/exercises   (existente)            + base_sets?, base_reps?, base_weight_kg?
PUT    /routines/exercises/{id} (existente)         + los mismos tres campos, opcionales
```

Detalle de plantilla (admin) y de asignación (miembro) comparten forma: `days[]` ordenados por
`position`, y por día `exercises[]` con `{exercise_id, name, muscle_group, base{sets,reps,
weight_kg}, is_active, strategy, planned_sets[]}`. Diferencias: el del miembro **omite los
ejercicios inactivos** (lo exige la spec) y usa la base ajustada; el del admin los devuelve todos
con su `is_active` para poder togglearlos.

`assignment_count` en el listado de plantillas alimenta el mensaje de rechazo del borrado sin un
round-trip extra: la UI puede deshabilitar/avisar antes, y el backend igual valida y responde
**409 con el conteo** en el `detail` ("No se puede eliminar: 2 miembros la tienen asignada"). El
`DELETE` de plantilla borra en cascade sus `routine_template_days` y `routine_template_exercises`.

Códigos de error: 404 plantilla/asignación/usuario/ajuste inexistente (y también cuando un miembro
pide una asignación que no es suya: 404, no 403, para no filtrar existencia); 422 body inválido
(`day_ids` vacío o con ids repetidos, estrategia desconocida, `sets/reps` ≤ 0, peso < 0); 400
cuando el día no pertenece a la plantilla o el ejercicio no pertenece al día/plantilla; 409 nombre
de plantilla duplicado, borrado de plantilla con asignaciones y membresía no activa; 403 rol
insuficiente.

### D10. Schemas: bloque nuevo al final de `schemas.py`

Los schemas nuevos (`RoutineTemplateSummary`, `RoutineTemplateCreate`, `RoutineTemplateUpdate`,
`RoutineTemplateDetail`, `RoutineTemplateDayOut`, `RoutineTemplateExerciseOut`,
`RoutineTemplateExerciseUpdate`, `PlannedSetOut`, `RoutineAssignmentCreate`,
`RoutineAssignmentUpdate`, `RoutineAssignmentBaseUpdate`, `RoutineAssignmentOut`,
`MemberRoutineTemplateOut`) van **al final** de `backend/app/schemas.py`, en un bloque delimitado
por comentario. Es un append: aunque otra sesión edite el archivo, el conflicto de merge es nulo o
trivial. Las únicas ediciones *in situ* son los tres campos de base en `RoutineExerciseCreate` /
`RoutineExerciseUpdate` / `RoutineExerciseManageOut` (D3). Un módulo `schemas_routines.py` aparte
rompería la convención de "un solo módulo de schemas" que hoy respetan los 8 routers.

### D11. Frontend: dos páginas nuevas, `UserDetail.tsx` tocado en un solo bloque

| Ruta | Página | Rol |
|---|---|---|
| `/routines` | `pages/Routines.tsx` (reescrita) — lista de plantillas | owner, coach |
| `/routines/:templateId` | `pages/RoutineTemplateDetail.tsx` (nueva) | owner, coach |
| `/my-routine` | `pages/UserRoutine.tsx` (reescrita) | member |

- La **lista** copia el patrón de `pages/Users.tsx`: `ListPageLayout` con `title`, `count`,
  `primaryAction` ("Crear plantilla"), `Table` con `STICKY_HEAD_CLASS`, `SkeletonRow`,
  `EmptyState`, `DataError`. Columnas: Nombre, Etiqueta (`Badge`), Días, Miembros, acción "Ver".
  La fila navega a `/routines/:templateId`. Sin paginación server-side (el endpoint devuelve la
  lista completa: son unidades, no cientos; si crecen, se agrega `limit/offset` como en usuarios).
- El **detalle** copia `pages/UserDetail.tsx`: hero con nombre + badge de etiqueta + "Volver a
  Rutinas" + botones "Editar" y "Eliminar", y debajo una `Card` por día con la tabla de ejercicios
  (base, toggle activo, chips de estrategia y plan de series).
- **Acciones en diálogos**, siguiendo `move-user-actions-to-detail`: `CreateRoutineTemplateDialog`
  y `EditRoutineTemplateDialog` (formulario propio); `DeleteRoutineTemplateDialog`,
  `AssignTemplateDialog`, `RemoveAssignmentDialog`, `AdjustExerciseBaseDialog` y
  `EditExerciseBaseDialog` construidos sobre **`ConfirmActionDialog`**, que ya acepta `children`
  como slot de campos extra, `destructive` para los borrados y `error` para pintar el 409 del
  backend (nombre duplicado, plantilla con asignaciones). Ningún diálogo nuevo se mete en los
  archivos de la sesión paralela.
- **Errores 409 del backend se muestran tal cual** en el `error` del diálogo: el mensaje de
  "nombre en uso" y el de "N miembros la tienen asignada" los redacta el backend, así no hay dos
  redacciones del mismo error que se desincronizan.
- **`UserDetail.tsx` se toca en un único bloque**: un `import MemberTemplatesCard` y el render
  `{isMemberRole ? <MemberTemplatesCard user={user} canManage={canManage} /> : null}` dentro de la
  columna derecha, debajo de la card de Invitación. Toda la lógica (query, lista de asignaciones,
  badges Activa/Alternativa, autoría del ajuste, botones "+ Asignar plantilla" / "Quitar" /
  "Quitar ajuste", gating por `canManageUser` y por `membership_status === "active"` **solo para
  el alta**) vive en `components/MemberTemplatesCard.tsx`. Si la otra sesión reescribe la ficha,
  el conflicto se resuelve re-insertando 3 líneas.
- `PlannedSetsList.tsx` renderiza `planned_sets[]` (peso × reps + anotación) y lo comparten el
  detalle de plantilla y "Mi rutina": el plan se ve igual del lado del coach y del cliente.
- `App.jsx`: una `<Route path="/routines/:templateId">` con `ProtectedRoute roles={["owner",
  "coach"]}`, y `const RoutineTemplateDetail = lazy(() => import("./pages/RoutineTemplateDetail"))`
  **sin** entrada en `routePreload.ts` (igual que `UserDetail`: no se navega desde el sidebar).
- La navegación del sidebar **no cambia**: "Rutinas" y "Mi rutina" ya existen en
  `lib/navigation.ts` con el filtro por rol correcto.

### D12. Data fetching: dos archivos por dominio, keys en `queryKeys.ts`

`services/routineTemplates.ts` (fetchers con el **default export** de `@/lib/http`, requisito duro
de los tests) + `services/routineTemplates.queries.ts` (hooks). `queryKeys.ts` suma dos dominios:

```ts
routineTemplates: { all, list(), detail(id) }
routineAssignments: { all, byUser(userId), my(), myDetail(assignmentId) }
```

Invalidación por prefijo de dominio, como manda `frontend/AGENTS.md`:

- toggle/chip de un ejercicio → `setQueryData(detail(id), respuesta)` + invalidate
  `routineAssignments.all` (el plan del miembro cambió: cubre el requirement "un cambio del
  administrador se refleja de inmediato").
- crear/editar/eliminar plantilla → invalidate `routineTemplates.all`; el borrado además
  invalida `routineAssignments.all` y navega de vuelta a `/routines`.
- editar la base de un ejercicio del catálogo → invalidate `routineTemplates.all` **y**
  `routineAssignments.all` (cambia el plan de toda plantilla que lo incluya).
- asignar / cambiar estado / quitar asignación / ajustar o quitar base → invalidate
  `routineAssignments.all`. **No** se invalida `users.all`: la ficha de usuario no embebe la
  plantilla en `User`, y así este change no compite con las invalidaciones que la sesión paralela
  está tocando.

Los tipos nuevos se agregan al final de `frontend/src/types.ts` (append, mismo criterio que D10).

### D13. Alcance cerrado por ausencia de requirement

No se implementan: reordenar los ejercicios dentro del día desde la plantilla, "estrategia por
defecto de la plantilla" (la spec la prohíbe: el default es Constante por ejercicio, D2), alta de
ejercicios desde la UI (D3) ni promoción automática de una Alternativa al quitar la Activa (la
spec la prohíbe explícitamente, D6).

### D14. Migración única, aditiva, con backfill

Una sola revision Alembic (`add_routine_templates`) que: crea los dos tipos enum
(`progressionstrategy`, `routineassignmentstatus`), crea las cinco tablas nuevas con sus índices
(incluido el único de `name_normalized` y el único parcial de asignación activa), agrega las tres
columnas de base a `exercises` con `server_default` y backfillea los ejercicios seedeados con la
tabla estática copiada en el archivo. El `downgrade` borra tablas, columnas, índices y **también
los tipos enum** (Postgres no los borra solo). No se edita ninguna migración ya aplicada.

## Risks / Trade-offs

- **Aritmética de punto flotante que no reproduce la spec al dígito** → `Decimal` +
  `ROUND_HALF_UP` (D4) y un test por cada caso numérico de la spec, incluidos los tres bordes
  (piso de 1 rep, piso de 2,5 kg, `1,5 × R` con R impar) y el medio paso donde `round()` de Python
  fallaría.
- **Unicidad case-insensitive que se comporta distinto en SQLite y Postgres** → columna derivada
  `name_normalized` normalizada en Python (D1), no índice funcional `lower()`.
- **Autosave del chip persiste un click equivocado** (D5) → no hay borrado de datos, el chip
  anterior está a un click, y el estado elegido siempre se ve marcado.
- **Borrado de plantilla o de asignación por error** → ambos pasan por `ConfirmActionDialog` en
  modo `destructive`, y el de plantilla además está bloqueado por el 409 mientras haya alguien
  asignado. Quitar una asignación sí es irreversible (se pierden sus ajustes de base por cascade):
  el diálogo lo dice explícitamente.
- **`_ensure_seed_data` borra links del catálogo en cada request** → la configuración por
  plantilla no cuelga de esos links (D2); un test cubre que la config sobrevive a un reseed.
- **Colisión con `move-user-actions-to-detail`** → archivos nuevos salvo: tres líneas en
  `UserDetail.tsx`, cuatro en `main.py`, dos endpoints de `routines.py`, y appends al final de
  `schemas.py`, `types.ts`, `queryKeys.ts`, `App.jsx` y `routine_catalog.py`. Ningún archivo del
  listado de esa sesión (`users.py`, `users.ts`, `users.queries.ts`, `permissions.ts`,
  `*Dialog.tsx` existentes) se edita.
- **Migración en Railway que no corre sola** → paso manual explícito y bloqueante en el Migration
  Plan; hasta que corra, los endpoints nuevos y también los **existentes** de catálogo fallarían
  con columna inexistente (`exercises.base_sets`). Por eso el orden es: aplicar migración → deploy.
- **N+1 al calcular planes** (una plantilla de 4 días × ~6 ejercicios) → una query por entidad con
  `joinedload` y todo el cálculo en memoria; el motor no toca la base.
- **La base solo se puede editar, no crear con valor propio desde la UI** (no hay pantalla de alta
  de ejercicios, D3) → el ejercicio nace en 3×10 · 0 kg y se corrige con
  `EditExerciseBaseDialog`; ver N2.

## Migration Plan

1. Generar la revision con `python -m alembic revision --autogenerate -m "add routine templates"`
   desde `backend/` y **revisarla a mano**: el autogenerate no emite el backfill de bases, suele
   errar con los índices parciales y no dropea los tipos enum en el `downgrade`.
2. Local: `make migrate` y `make test-backend` en verde (la suite recrea el esquema con
   `create_all`, así que el test verde **no** valida la migración: la validación es correr
   `alembic upgrade head` y `alembic downgrade -1` contra una Postgres local/Docker,
   `make docker-up`).
3. Producción (Railway, el deploy **no** corre migraciones): aplicar
   `python -m alembic upgrade head` contra la `DATABASE_URL` de producción (por ejemplo con
   `railway run` sobre el servicio de backend) **antes** de promover el build con el código nuevo.
   Coordinarlo con el dueño del deploy; dejarlo anotado en `backend/AGENTS.md`.
4. Rollback: `alembic downgrade -1` borra tablas, columnas, índices y tipos enum. Es destructivo
   para las plantillas/asignaciones creadas después de la migración (no para datos preexistentes:
   el change no modifica ni borra ninguna fila anterior). Rollback de código sin rollback de base
   es seguro: las tablas y columnas nuevas quedan huérfanas pero nadie las lee.

## Open Questions

Los siete huecos que este diseño había abierto los cerró el Product Owner en `proposal.md` y las
specs (base en el flujo existente de ejercicios, los tres pisos del motor, borrado de plantilla y
de asignación, quitar el ajuste de base, nombre único case-insensitive, sin estrategia por defecto
de plantilla, y asignaciones que sobreviven a la baja de membresía). Quedan dos observaciones
menores, ninguna bloqueante:

- **N1.** El escenario "Crear un ejercicio sin indicar la base" dice "un **Coach** crea un
  ejercicio nuevo", pero el flujo existente (`POST`/`PUT /routines/exercises`) es
  `require_role(owner)`. El proposal pide no cambiar ese flujo más allá del campo de base, así que
  el diseño **mantiene owner-only** y el escenario queda cubierto para Dueño. Si la intención era
  habilitar Coach, es un cambio de autorización que merece su propio requirement.
- **N2.** No existe hoy pantalla de alta de ejercicios (se borró a pedido de producto), así que el
  escenario "Crear un ejercicio indicando su base" se cumple a nivel API pero no tiene UI; la UI
  cubre la **edición** de la base (`EditExerciseBaseDialog` desde el detalle de plantilla). Cuando
  se reconstruya la pantalla de catálogo, el campo ya está en el contrato.

## Plan de verificación

**Riesgo**: alto — el diff toca `backend/app/models.py` (cinco tablas nuevas, dos enums y tres
columnas en `exercises`) y agrega una migración en `backend/migrations/**`, que son gatillos
directos de la tabla de criterio de riesgo del rol. Además incorpora borrados de datos
(plantillas, asignaciones y ajustes de base) y la migración debe aplicarse a mano en producción
antes del deploy.

### Invariantes

- I1. Quitar un día de una plantilla no borra ninguna fila de `routine_template_exercises`: al
  volver a agregarlo, cada ejercicio conserva `is_active` y `strategy`.
- I2. Un miembro tiene como máximo una asignación con estado Activa, garantizado por el índice
  único parcial y no solo por el código del endpoint; cero Activas es un estado válido.
- I3. `plan_sets` es puro y determinístico: sin acceso a base de datos, red ni reloj; mismo
  `(estrategia, sets, reps, kg)` ⇒ mismo resultado.
- I4. Todo peso calculado es múltiplo de 2,5 kg y ≥ 2,5 kg; toda repetición calculada es ≥ 1, y
  ≥ 3 en Pirámide.
- I5. El change no cambia el rol exigido por ningún endpoint existente ni toca autenticación,
  membresía ni `WorkoutLog`: `membership_status` solo se **lee** como condición para dar de alta
  una asignación nueva.
- I6. El plan de series se calcula únicamente en el backend; no hay ninguna fórmula de progresión
  en `frontend/src/**`.
- I7. Un miembro solo puede leer sus propias asignaciones; pedir la de otro devuelve 404.
- I8. La migración es aditiva: no borra ni renombra tablas o columnas existentes y no modifica
  ninguna fila previa salvo el backfill de las tres columnas de base nuevas.
- I9. `routine_template_exercises` no depende de `training_day_exercises.id`, así que un reseed del
  catálogo (`_ensure_seed_data`) no borra configuración de ninguna plantilla.
- I10. El plan del miembro usa el ajuste de base de su asignación cuando existe y la base del
  catálogo cuando no, con esa única precedencia; quitar el ajuste vuelve a la base del catálogo.
- I11. No existen dos plantillas cuyo nombre coincida ignorando mayúsculas/minúsculas y espacios en
  los bordes, con el mismo resultado en Postgres y en SQLite.
- I12. Quitar una asignación no modifica el estado de ninguna otra asignación del mismo miembro.
- I13. Perder la membresía activa no borra, no degrada ni oculta ninguna asignación existente.
- I14. Una plantilla con al menos una asignación no puede borrarse, y ningún borrado de plantilla
  deja asignaciones huérfanas.

### Tests

| Capa | Archivo | Caso |
|---|---|---|
| backend | `backend/tests/test_progression.py` | `test_constante_repite_la_base_en_todas_las_series` |
| backend | `backend/tests/test_progression.py` | `test_piramide_press_banca_4x8_45kg` |
| backend | `backend/tests/test_progression.py` | `test_piramide_sentadilla_5x5_70kg_respeta_el_piso_de_reps` |
| backend | `backend/tests/test_progression.py` | `test_piramide_dominadas_4x6_20kg` |
| backend | `backend/tests/test_progression.py` | `test_piramide_aperturas_3x12_14kg` |
| backend | `backend/tests/test_progression.py` | `test_invertida_press_banca_4x8_45kg` |
| backend | `backend/tests/test_progression.py` | `test_invertida_aperturas_3x12_14kg` |
| backend | `backend/tests/test_progression.py` | `test_invertida_respeta_el_piso_de_2_5_kg` |
| backend | `backend/tests/test_progression.py` | `test_drop_set_marca_al_fallo_la_ultima_serie` |
| backend | `backend/tests/test_progression.py` | `test_drop_set_redondea_para_arriba_las_reps_con_r_impar` |
| backend | `backend/tests/test_progression.py` | `test_rest_pause_anota_la_pausa_desde_la_segunda_serie` |
| backend | `backend/tests/test_progression.py` | `test_rest_pause_respeta_el_piso_de_una_repeticion` |
| backend | `backend/tests/test_progression.py` | `test_el_redondeo_de_medio_paso_va_para_arriba` |
| backend | `backend/tests/test_exercise_base.py` | `test_crear_un_ejercicio_indicando_su_base` |
| backend | `backend/tests/test_exercise_base.py` | `test_crear_un_ejercicio_sin_base_usa_el_default_3x10_0kg` |
| backend | `backend/tests/test_exercise_base.py` | `test_editar_la_base_de_un_ejercicio_existente` |
| backend | `backend/tests/test_exercise_base.py` | `test_la_base_editada_cambia_el_plan_calculado_de_la_plantilla` |
| backend | `backend/tests/test_exercise_base.py` | `test_una_base_invalida_es_rechazada` |
| backend | `backend/tests/test_routine_templates.py` | `test_coach_crea_una_plantilla_con_dos_dias` |
| backend | `backend/tests/test_routine_templates.py` | `test_crear_una_plantilla_sin_dias_es_rechazado` |
| backend | `backend/tests/test_routine_templates.py` | `test_editar_nombre_y_etiqueta_de_una_plantilla` |
| backend | `backend/tests/test_routine_templates.py` | `test_rechaza_un_nombre_duplicado_ignorando_mayusculas` |
| backend | `backend/tests/test_routine_templates.py` | `test_rechaza_un_nombre_duplicado_ignorando_espacios_en_los_bordes` |
| backend | `backend/tests/test_routine_templates.py` | `test_quitar_y_volver_a_agregar_un_dia_conserva_la_configuracion` |
| backend | `backend/tests/test_routine_templates.py` | `test_desactivar_un_ejercicio_conserva_su_estrategia` |
| backend | `backend/tests/test_routine_templates.py` | `test_un_ejercicio_nuevo_en_una_plantilla_arranca_en_constante` |
| backend | `backend/tests/test_routine_templates.py` | `test_el_mismo_ejercicio_tiene_estrategia_propia_en_cada_plantilla` |
| backend | `backend/tests/test_routine_templates.py` | `test_el_detalle_solo_devuelve_los_dias_de_la_plantilla` |
| backend | `backend/tests/test_routine_templates.py` | `test_cambiar_la_estrategia_devuelve_el_plan_recalculado` |
| backend | `backend/tests/test_routine_templates.py` | `test_eliminar_una_plantilla_sin_asignaciones` |
| backend | `backend/tests/test_routine_templates.py` | `test_rechaza_eliminar_una_plantilla_con_asignaciones_e_informa_cuantos_miembros` |
| backend | `backend/tests/test_routine_templates.py` | `test_un_reseed_del_catalogo_no_borra_la_configuracion_de_la_plantilla` |
| backend | `backend/tests/test_routine_templates.py` | `test_un_miembro_no_puede_listar_plantillas` |
| backend | `backend/tests/test_routine_assignments.py` | `test_asignar_la_primera_plantilla_como_activa` |
| backend | `backend/tests/test_routine_assignments.py` | `test_asignar_una_segunda_plantilla_como_alternativa` |
| backend | `backend/tests/test_routine_assignments.py` | `test_asignar_una_nueva_activa_deja_la_anterior_como_alternativa` |
| backend | `backend/tests/test_routine_assignments.py` | `test_asignar_a_un_miembro_dado_de_baja_responde_409` |
| backend | `backend/tests/test_routine_assignments.py` | `test_asignar_a_un_miembro_sin_membresia_responde_409` |
| backend | `backend/tests/test_routine_assignments.py` | `test_reactivar_la_membresia_habilita_la_asignacion` |
| backend | `backend/tests/test_routine_assignments.py` | `test_dar_de_baja_la_membresia_conserva_las_asignaciones` |
| backend | `backend/tests/test_routine_assignments.py` | `test_no_se_puede_asignar_una_plantilla_a_un_coach` |
| backend | `backend/tests/test_routine_assignments.py` | `test_ajustar_la_base_registra_autor_y_fecha` |
| backend | `backend/tests/test_routine_assignments.py` | `test_una_asignacion_sin_ajustes_se_reporta_sin_ajustes` |
| backend | `backend/tests/test_routine_assignments.py` | `test_quitar_el_ajuste_de_base_vuelve_a_la_base_del_catalogo` |
| backend | `backend/tests/test_routine_assignments.py` | `test_quitar_una_asignacion_alternativa` |
| backend | `backend/tests/test_routine_assignments.py` | `test_quitar_la_asignacion_activa_no_promueve_una_alternativa` |
| backend | `backend/tests/test_member_routine.py` | `test_el_miembro_solo_ve_sus_plantillas_asignadas` |
| backend | `backend/tests/test_member_routine.py` | `test_el_miembro_sin_asignaciones_recibe_una_lista_vacia` |
| backend | `backend/tests/test_member_routine.py` | `test_el_detalle_del_miembro_solo_trae_los_dias_de_la_plantilla` |
| backend | `backend/tests/test_member_routine.py` | `test_un_ejercicio_desactivado_no_aparece_en_el_plan_del_miembro` |
| backend | `backend/tests/test_member_routine.py` | `test_el_plan_del_miembro_usa_la_base_ajustada_para_ese_cliente` |
| backend | `backend/tests/test_member_routine.py` | `test_cambiar_la_estrategia_se_refleja_en_el_plan_del_miembro` |
| backend | `backend/tests/test_member_routine.py` | `test_el_miembro_dado_de_baja_sigue_viendo_sus_plantillas` |
| backend | `backend/tests/test_member_routine.py` | `test_un_miembro_no_puede_ver_la_asignacion_de_otro` |
| frontend | `frontend/src/pages/__tests__/Routines.test.tsx` | `lista las plantillas con su etiqueta y su cantidad de dias` |
| frontend | `frontend/src/pages/__tests__/Routines.test.tsx` | `abre el detalle de la plantilla al hacer click en la fila` |
| frontend | `frontend/src/pages/__tests__/Routines.test.tsx` | `muestra el error del backend cuando el nombre de plantilla ya esta en uso` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `muestra solo los dias que incluye la plantilla` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `al elegir otra estrategia guarda y muestra el plan recalculado` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `pide confirmacion antes de eliminar la plantilla` |
| frontend | `frontend/src/pages/__tests__/UserRoutine.test.tsx` | `permite elegir entre las plantillas asignadas` |
| frontend | `frontend/src/pages/__tests__/UserRoutine.test.tsx` | `avisa cuando el miembro no tiene ninguna plantilla asignada` |
| frontend | `frontend/src/pages/__tests__/UserRoutine.test.tsx` | `muestra el plan de series sin accion para marcar una serie como hecha` |
| frontend | `frontend/src/components/__tests__/MemberTemplatesCard.test.tsx` | `lista las plantillas asignadas con su estado` |
| frontend | `frontend/src/components/__tests__/MemberTemplatesCard.test.tsx` | `no ofrece asignar plantilla a un miembro sin membresia activa` |
| frontend | `frontend/src/components/__tests__/MemberTemplatesCard.test.tsx` | `sigue listando las plantillas de un miembro sin membresia activa` |
| frontend | `frontend/src/components/__tests__/MemberTemplatesCard.test.tsx` | `pide confirmacion antes de quitar una asignacion` |
| manual | — | Con `make dev` y `make seed-dev`: entrar como `dev.owner@miniespacio.local`, ir a Rutinas, crear la plantilla "Full body inicial" (etiqueta INICIO) con Día 1 y Día 4, abrir su detalle y verificar que no aparecen Día 2 ni Día 3. Intentar crear otra llamada "FULL BODY INICIAL" y ver el mensaje de nombre en uso. |
| manual | — | En ese detalle, editar la base de un ejercicio, cambiar su estrategia de Constante a Rest-pause y verificar que el plan se recalcula sin apretar ningún botón de guardado, y que el mismo ejercicio en otra plantilla mantiene su estrategia anterior. |
| manual | — | En `/users/<id>` de `dev.member@miniespacio.local`, asignar la plantilla como Activa, ajustar la base de un ejercicio y verificar "Ajustada por <coach> el <fecha>"; quitar el ajuste y verificar que vuelve a "Sin ajustes"; entrar como el miembro a "Mi rutina" y confirmar que el plan es de solo lectura y refleja cada paso. |
| manual | — | Dar de baja la membresía del miembro: verificar que el botón "+ Asignar plantilla" desaparece de su ficha, que sus asignaciones siguen listadas, que las sigue viendo en "Mi rutina" y que el `POST` directo responde 409. |
| manual | — | Intentar eliminar desde el detalle una plantilla con ese miembro asignado y ver el rechazo con el conteo; quitar la asignación con confirmación (verificando que ninguna Alternativa se promueve) y recién ahí eliminar la plantilla. |
