## Why

Hoy los "días de entrenamiento" (`TrainingDay` + `TrainingDayExercise`) son un catálogo global
compartido por todas las plantillas: editar el Día 1 cambia ese día en cualquier plantilla que lo
referencie, porque `RoutineTemplateDay` solo apunta a un subconjunto ordenado del catálogo en vez
de poseer sus propios días. Esto no representa el producto real: cada plantilla de rutina (ej.
"Fuerza 4 días" vs. "Hipertrofia 5 días") necesita sus propios días, con su propio grupo muscular
y su propia selección de ejercicios, sin pisar a las demás. Además, hoy la configuración de días y
ejercicios se hace, dentro del propio detalle de la plantilla (`/routines/:templateId`), con
switches por ejercicio y autosave sobre ese catálogo global — un diseño pensado para un catálogo
compartido que no tiene sentido una vez que cada plantilla posee sus propios días.

## What Changes

- **BREAKING**: los días de rutina dejan de ser un catálogo global compartido. Cada
  `RoutineTemplate` pasa a poseer directamente sus propios días (hasta 5), cada uno con su propio
  grupo muscular y su propia lista de ejercicios — editar un día de una plantilla no afecta a
  ninguna otra.
- **BREAKING**: se retiran, del detalle de plantilla, los switches por ejercicio y el autosave que
  hoy configuran el catálogo global de días. `/routines` (el listado de plantillas) no se retira;
  lo que cambia es cómo se configuran los días y ejercicios dentro del detalle de cada plantilla
  (`/routines/:templateId`): buscador + borrador local en vez de switches con autosave.
- El modal de **creación** de plantilla se simplifica: solo pide nombre y etiqueta. Los días se
  agregan después, desde el detalle de la plantilla ya creada.
- En el **detalle/edición** de una plantilla se pueden agregar días (hasta un máximo de 5), cada
  uno mostrado como "Día N - <grupos musculares>". El grupo muscular de cada día es un
  multi-selector sobre el enum `MuscleGroup` del catálogo de ejercicios (1..n grupos, mostrados
  unidos por "/"), editable por quien edita la plantilla.
- Dentro de cada día, los ejercicios se agregan buscándolos en el catálogo de ejercicios
  **activos** (buscador que muestra Nombre, Grupo Muscular y Tipo de Entrenamiento) en vez de
  activarlos con un switch sobre una lista fija. Cada ejercicio agregado se muestra como card con
  un botón para quitarlo del día.
- **BREAKING**: el catálogo de ejercicios deja de tener una base (series/reps/peso) editable
  propia. La base vive únicamente dentro de la plantilla: cada ejercicio dentro de un día de
  plantilla, además de su estrategia de progresión, tiene series/reps/peso base propios de esa
  combinación (plantilla, día, ejercicio), que al agregarlo arrancan en un valor fijo por defecto
  de 3 series × 10 repeticiones × 0 kg, y divergen si se editan ahí.
- La edición de días/ejercicios de una plantilla se acumula como borrador local en el cliente y se
  envía como una sola operación de guardado; salir con cambios sin guardar exige confirmación.
- El overview, los logs y el reporte/resumen de progreso del miembro (hoy referenciando el
  catálogo global de días) pasan a apuntar al día tal como está definido en la plantilla que
  tiene asignada. Igual que hoy, el overview y el progreso siguen siempre la asignación **Activa**
  del miembro (no la que esté eligiendo ver en "Mi rutina"): esto no cambia con este change, pero
  queda explicitado en la spec para que deje de ser un comportamiento implícito. Los cambios que
  el Dueño/Coach hace sobre la plantilla asignada se reflejan en vivo para el miembro.
- Quitar un ejercicio de un día de plantilla no debe romper ni ocultar los registros históricos
  (`WorkoutLog`) ya cargados contra ese ejercicio/día.
- Migración de esquema sin backfill: los días y plantillas existentes se descartan; se recrean a
  mano o vía seed de desarrollo (consistente con que GymApp está en beta sin usuarios finales).

## Fuera de alcance (change posterior)

- **Reordenar días** (ej. mover el Día 3 al lugar del Día 1) no se ofrece en este change. Solo se
  puede reordenar los ejercicios dentro de un día.
- El modelo de **asignación como copia** — que al asignar una plantilla a un miembro se cree una
  copia propia, editable por Coach/Dueño solo para ese miembro y con progreso propio, retirando
  `routine_assignment_bases` — **no** se incorpora en este change. Se aborda en un change
  posterior. Acá el comportamiento se mantiene tal cual está hoy: los cambios de días/ejercicios
  de la plantilla asignada se reflejan en vivo para el miembro.

## Capabilities

### Modified Capabilities
- `routine-templates`: los días pasan a ser propiedad de la plantilla (no una referencia a un
  catálogo compartido); la creación de plantilla ya no incluye días; el detalle/edición gana
  alta de días (máx. 5) con grupo muscular editable (multi-select) y alta/baja de ejercicios por
  búsqueda en el catálogo activo, con guardado explícito de un borrador acumulado. Se retira la
  base editable del catálogo: un ejercicio agregado a un día de plantilla arranca en un valor fijo
  por defecto (3×10 · 0 kg) en vez de copiarse de una base del catálogo. Esto retira la única
  referencia a la base editable del catálogo que existía en las specs — `exercise-catalog` nunca
  tuvo esa base entre sus requirements (su Purpose ya la atribuía a `routine-templates`) y no
  necesita un delta propio en este change.
- `progression-strategies`: la estrategia de progresión de un ejercicio dentro de un día pasa a
  convivir con series/reps/peso base propios de esa plantilla (ya no heredados de un único
  registro global de `TrainingDayExercise`, ni copiados de una base del catálogo).
- `routine-assignment`: la plantilla asignada a un miembro deja de depender de un catálogo global
  de días; sus cambios de días/ejercicios se reflejan en vivo sobre la asignación vigente; el
  ajuste de base por cliente sobreescribe la base propia de la plantilla, no una base del
  catálogo.
- `member-routine-view`: el overview, los logs y el progreso del miembro leen el día desde la
  plantilla asignada en vez de un catálogo global, y siguen siempre la asignación Activa del
  miembro; un ejercicio quitado de la plantilla no puede romper el histórico de `WorkoutLog` ya
  registrado.

## Impact

- **Modelo de datos** (`backend/app/models.py`): `TrainingDay` y `TrainingDayExercise` dejan de
  ser un catálogo global independiente; los días y su relación con ejercicios pasan a
  modelarse como propiedad de `RoutineTemplate`. `Exercise` pierde sus campos de base
  (`base_sets`, `base_reps`, `base_weight_kg`). Requiere migración Alembic nueva, sin backfill
  (se descartan plantillas/días existentes).
- **Backend**: `backend/app/routers/routine_templates.py`, `routines.py`,
  `routine_assignments.py`, `exercises.py`, `backend/app/routine_catalog.py` — el contrato de
  creación/edición de plantilla, el endpoint de base del catálogo, y las lecturas de
  overview/progreso del miembro, cambian de forma.
- **Frontend**: `CreateRoutineTemplateDialog` se simplifica; `RoutineTemplateDetail.tsx` reemplaza
  los switches por ejercicio y el autosave por la gestión de días/ejercicios con buscador y
  borrador local (el listado `/routines` no se retira); `UserRoutine.tsx` y demás vistas de
  progreso del miembro leen el día desde la plantilla asignada.
- **Specs existentes a modificar**: `openspec/specs/routine-templates/`,
  `openspec/specs/progression-strategies/`, `openspec/specs/routine-assignment/`,
  `openspec/specs/member-routine-view/`.
- **Riesgo: alto.** Toca el modelo de datos de rutinas y el histórico de `WorkoutLog`; requiere
  migración sin backfill y coordinación entre backend y frontend para no dejar el repo a medias
  entre el modelo viejo (catálogo global) y el nuevo (días propios de la plantilla).
