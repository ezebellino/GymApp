## Context

`add-exercise-catalog` cerró con una reserva explícita (reserva 1 de su `verification.md`): hay
**dos fuentes de verdad** para el grupo muscular de un ejercicio del seed, y gana la que el usuario
no puede editar. Este change retira la que sobra.

Estado del código verificado hoy (no repetido del proposal, medido sobre el working tree):

- `backend/app/routine_catalog.py` (150 líneas): `TRAINING_DAYS` (4 días, cada uno con
  `muscle_groups` y `default_active_ids`) y `EXERCISE_LIBRARY` (52 ejercicios con `id` semántico,
  `name`, `muscle_group` y base `base_sets`/`base_reps`/`base_weight_kg`).
- `backend/app/routers/routines.py`:
  - `_ensure_seed_data` (línea 149) hace **tres** cosas en una transacción que termina en
    `db.commit()`: (1) inserta los `TrainingDay` que falten **y pisa `name`/`muscle_groups`/
    `day_order` de los que ya están, en cada llamada**; (2) inserta los `Exercise` de
    `EXERCISE_LIBRARY` que falten; (3) recalcula todos los `TrainingDayExercise` desde
    `TRAINING_DAYS × EXERCISE_LIBRARY` — reordena los que existen, crea los que faltan, y **borra**
    los que no estén en `desired_link_keys` si el `exercise_id` pertenece al seed.
  - `sync_exercise_day_links` (línea 51, pública) hace lo mismo para **un** ejercicio derivando del
    `muscle_group` **de la fila en la base**, y nunca borra un vínculo de un día que alguna
    plantilla esté usando (corrección H2). La llama `routers/exercises.py` en `POST /exercises/` y
    en el `PATCH` cuando viene `muscle_group`.
  - `_day_ids_for_muscle_group` mapea grupo → `day_id` contra `TRAINING_DAYS`.
- Call sites de `_ensure_seed_data`: **20** (13 en `routines.py`, 4 en `routine_templates.py`, 3 en
  `routine_assignments.py`). Ninguno en `exercises.py`.
- `main.py` **no** tiene hook de startup ni de lifespan: hoy la única forma de que existan los 4
  `TrainingDay` es que alguien pegue a un endpoint de Rutinas.
- Alembic: head único `c387dcc091c2` (`add_exercise_catalog`). Las cuatro FKs que apuntan a
  `exercises.id` (`exercise_training_types`, `training_day_exercises`, `workout_logs`,
  `routine_template_exercises`, `routine_assignment_bases`) son todas `ondelete="CASCADE"`.
- La suite crea el esquema con `Base.metadata.create_all` (`backend/tests/conftest.py:69`), **no**
  corriendo migraciones, sobre SQLite de archivo. 5 archivos de test (~80 referencias) dependen hoy
  de que `_ensure_seed_data` haya sembrado los 52 ejercicios: `test_routine_templates.py`,
  `test_exercises.py`, `test_routine_assignments.py`, `test_member_routine.py`,
  `test_exercise_base.py`.
- Frontend: los tres estados vacíos que el proposal pide **ya tienen un sitio en el código**
  (`Exercises.tsx` `EmptyState`, `RoutineTemplateDetail.tsx:140`, `UserRoutine.tsx:190`); lo que
  falta es que digan algo útil para el caso "el catálogo está vacío", que hasta hoy era
  inalcanzable.

Restricción de proyecto que aplica entera: `AGENTS.md` §"El proyecto está en BETA" — cambio limpio
sobre compatibilidad, migración de esquema sin backfill como default, sin deprecación gradual.

## Goals / Non-Goals

**Goals:**

- Una sola fuente de verdad del vínculo día↔ejercicio: la fila `Exercise.muscle_group` de la base.
- `EXERCISE_LIBRARY` deja de existir dentro de `backend/app/`, de forma que la segunda fuente de
  verdad no pueda volver por descuido.
- Los 4 `TrainingDay` siguen existiendo siempre, en cualquier base, sin depender del orden en que
  se visiten los endpoints.
- Un catálogo vacío es un estado normal, sin 500 en ningún endpoint y explicado en las 3 pantallas.
- Los 52 ejercicios quedan disponibles como seed **opcional** de desarrollo, con el mismo doble
  candado que `make seed-dev`.

**Non-Goals:**

- `TRAINING_DAYS` y los 4 días fijos (es R-3 del backlog, otro change).
- Cambiar el contrato de `/routines/*` o de `/exercises/*` (ningún schema cambia de forma).
- La decisión D7.1 del change anterior: reactivar un ejercicio sigue sin restaurar su selección
  por día (sí cambia el default de un vínculo **nuevo**, ver D8).
- Reescribir la suite de rutinas: solo se le dan preconditions explícitas donde hoy hereda el seed.

## Decisions

### D1. `_ensure_seed_data` se parte: sobrevive solo `ensure_training_days`, y deja de escribir

`_ensure_seed_data` pierde los bloques (2) y (3) y se renombra a `ensure_training_days(db)` (sin
guión bajo: la importan dos routers hoy y va a importarla un tercero). Además cambia de "escribe
siempre" a **no-op cuando los 4 días ya están**: solo inserta los que faltan y solo hace `commit()`
si insertó algo. Hoy pisa `name`/`muscle_groups`/`day_order` en cada request, lo que significa un
`UPDATE` + `COMMIT` por request en 20 endpoints, y un `commit()` en medio de la transacción del
caller.

**Los 20 call sites se quedan como están** (más uno nuevo, ver D2). Alternativas consideradas:

- *Sembrar los días en la migración de Alembic y borrar los 20 call sites.* Rechazada: la suite
  arma el esquema con `create_all`, no con migraciones, así que los días no existirían en ningún
  test y habría que agregar una fixture global — o sea, cambiamos un acoplamiento implícito por
  otro, en un change que ya toca 5 archivos de test. Además, una base de desarrollo recién creada
  quedaría sin días hasta que alguien corra la migración correcta.
- *Sembrar los días en un hook de startup de FastAPI.* Rechazada: `main.py` hoy no tiene ninguno, y
  un startup que escribe en la base rompe el arranque si la base todavía no migró (y en los tests
  el `TestClient` se instancia antes que las fixtures de esquema).
- *Recortar a los ~6 endpoints que realmente leen días.* Rechazada **para este change**: enumerar
  cuáles de los 20 pueden prescindir es un análisis independiente, con su propio modo de fallo
  silencioso (un 404 de día en un endpoint raro), sobre un change ya declarado alto. Una vez que la
  función es un `SELECT` de 4 filas sin escritura, el argumento de costo que motivaba el recorte se
  evapora. Queda anotado como trabajo posterior, no como deuda que este change crea.

### D2. Los `TrainingDayExercise` se derivan **solo** en el CRUD de `/exercises`, y no hace falta reconciliación

Retirado el bloque (3), el único momento en que se crea, mueve o borra un `TrainingDayExercise`
pasa a ser `sync_exercise_day_links`, llamada desde `POST /exercises/` y desde
`PATCH /exercises/{id}` cuando el payload trae `muscle_group`. Eso **alcanza**, y se puede
demostrar por casos:

| Origen de la fila `Exercise` | Estado de sus vínculos después del change |
|---|---|
| Creada por `POST /exercises/` (ids `custom-*`) | Correctos: se crearon con `sync_exercise_day_links` y se actualizan en cada `PATCH` de grupo. El bloque (3) nunca los tocó (solo borraba links de ids del seed). |
| De `EXERCISE_LIBRARY` (52 ids semánticos) | Irrelevante: la migración las borra (D3), y la cascada se lleva sus vínculos. |
| Cualquier otra | No existe: no hay ningún otro camino que inserte `Exercise` (el `POST /routines/exercises` se retiró en el change anterior). |

Por lo tanto **no hay paso de reconciliación de una sola vez**, ni en la migración ni en código.
Alternativa considerada: un `reconcile_all_exercise_day_links(db)` corriendo una vez en la
migración o detrás de un endpoint de mantenimiento. Rechazada: no tiene ninguna fila para arreglar,
y dejarlo "por las dudas" reintroduce exactamente el patrón (un proceso global que reescribe
vínculos) que este change existe para retirar.

Dos consecuencias que hay que aceptar explícitamente:

1. **`sync_exercise_day_links` escribe `TrainingDayExercise` con FK a `training_days.id`.** Hoy
   `exercises.py` no llama a `_ensure_seed_data`, así que en una base sin días sembrados un
   `POST /exercises/` explota con error de FK. Es un bug preexistente que hoy tapa el hecho de que
   el frontend siempre pasa antes por Rutinas; cuando el catálogo arranca vacío, "cargar el primer
   ejercicio" pasa a ser el primer request posible de una base nueva. **`exercises.py` llama a
   `ensure_training_days(db)` al entrar en `create_exercise` y en `update_exercise`** (call site
   nuevo n.º 21).
2. **A partir de ahora, cambiar `TRAINING_DAYS` (grupos musculares de un día) no recalcula nada**:
   antes el bloque (3) rehacía los vínculos de los ejercicios del seed en el request siguiente.
   Queda registrado en `backend/AGENTS.md`: todo change que toque `TRAINING_DAYS[*].muscle_groups`
   debe traer su propia migración de datos que recalcule los vínculos. Es el precio de tener una
   sola fuente de verdad, y es el modo de fallo que reemplaza al que retiramos (uno que borraba
   curación manual en 20 endpoints).

`default_active_ids` deja de tener consumidor (solo lo leía el bloque 3) y **se retira de
`TRAINING_DAYS`** en el mismo change: dejarlo es una tercera lista de ids del seed dentro de
`app/`, justo lo que este change viene a eliminar. Su rol lo cubre el seed opcional (D4).

### D3. Migración: se borran los 52 por lista literal de ids, y sí conviene borrarlos

**El proposal tiene razón, y el análisis de costo lo confirma en vez de cambiarlo.** Lo evalué en
serio, porque conservar los 52 como filas normales es tentador: no requiere migración, y el
catálogo no queda vacío. Pero el ahorro es mucho menor de lo que parece:

- La reescritura de los tests (lo caro: 5 archivos, ~80 referencias) **hay que hacerla igual**. Las
  bases de test se crean vacías con `create_all` y el seed automático desaparece en los dos
  escenarios; conservar filas en producción no siembra nada en la suite.
- Lo único que se ahorra conservándolos es la migración, que es **un `DELETE` con una lista
  literal**, no una transformación.
- A cambio, conservarlos deja en producción 52 filas con grupos musculares que nadie curó (varias
  quedaron en `NULL` por la normalización de `add-exercise-catalog` D9) y hace que el estado
  "catálogo vacío" —el estado que este change convierte en ciudadano de primera— no se ejercite
  nunca en el entorno real.

Migración nueva, `down_revision = "c387dcc091c2"` (confirmar con `alembic heads` al implementar):

```sql
DELETE FROM exercises WHERE id IN (<los 52 ids literales>);
```

**Por lista literal, no por `id NOT LIKE 'custom-%'`.** Las dos expresiones dan el mismo resultado
sobre los datos que conocemos, pero la lista es una foto —el criterio que `add-exercise-catalog`
D9 fijó para las migraciones: "las constantes evolucionan, las migraciones son fotos"— y no puede
llevarse puesta una fila que alguna vía futura o pasada haya creado con otro prefijo. El `LIKE`
depende de una convención de ids que este change, justamente, deja sin dueño: después de retirar
el reseed, el prefijo `custom-` ya no significa nada y nadie lo va a mantener. Costo: 52 líneas de
ids en la migración. Aceptado.

Cascada (todas `ondelete="CASCADE"`, ver models.py): `exercise_training_types`,
`training_day_exercises`, `workout_logs`, `routine_template_exercises`,
`routine_assignment_bases`. En castellano: se pierden los vínculos día↔ejercicio de los 52, la
selección y configuración de ejercicios de toda plantilla que los use, los registros de
entrenamiento que los referencien y las bases por asignación. Las plantillas, las asignaciones y
los días **no** se borran: quedan vivas y vacías, que es exactamente el estado que los estados
vacíos del frontend (D6) tienen que saber mostrar. `training_days` no se toca.

`downgrade()`: no-op documentado. No hay nada que restaurar y la regla de BETA no pide fingir que
sí; la forma de volver a tener datos es `make seed-dev-exercises` (D4). El docstring de la revision
lo dice.

### D4. El seed opcional: `backend/scripts/seed_dev_exercises.py`, con el candado compartido

`EXERCISE_LIBRARY` **se muda entera** de `backend/app/routine_catalog.py` a
`backend/scripts/seed_dev_exercises.py`. Mudarla (y no copiarla ni dejarla en `app/` "sin usar") es
lo que hace estructural la decisión: `backend/scripts/` no es importable desde `app/`, así que
ningún código de aplicación puede volver a derivar nada de esa lista. Un test lo fija (I2).

El script imita a `seed_dev_users.py`:

- `main()` arranca por el **mismo doble candado**: `ENVIRONMENT ∈ {development, local, test}` **y**
  host de `DATABASE_URL` ∈ `{localhost, 127.0.0.1, db, ""}`, `sys.exit(1)` con mensaje explicativo
  si alguno falla, **antes** de tocar `create_engine`.
- La guarda se **extrae** de `seed_dev_users.py` a `backend/scripts/dev_guards.py`
  (`check_environment_guards(what: str)`, donde `what` es lo que aparece en el mensaje: "usuarios
  de desarrollo" / "ejercicios de desarrollo") y los dos scripts la importan. Alternativa
  considerada: copiar las ~25 líneas. Rechazada: dos copias de un candado de seguridad divergen, y
  la que se olvide de actualizar es la que corre contra producción. Los tests existentes de
  `test_dev_seed.py` siguen funcionando: parchean atributos del objeto `settings` (instancia
  compartida), no del módulo.
- Idempotente: inserta por `id` los que faltan, no pisa los que ya están (mismo criterio que el
  bloque (2) que retiramos), completa `name_normalized`, llama a `ensure_training_days(db)` y luego
  a `sync_exercise_day_links(db, id, muscle_group)` por ejercicio.
- Los vínculos nacen activos por D8, sin que el script tenga que pedirlo. Esto **no** replica
  `default_active_ids` (que activaba 6 por día): deja los 52 activos. Es deliberado — el seed
  existe para tener datos utilizables en dos comandos, no para reproducir una curación que ya no
  tiene dueño. Alternativa considerada: llevarse `default_active_ids` al script para fidelidad
  exacta. Rechazada: la curación por día ahora es un acto del Dueño en la UI, y prefabricar una en
  el seed es volver a opinar desde código sobre un dato editable.

Makefile: target `seed-dev-exercises`, calcado de `seed-dev` (detecta el stack de Docker y cae al
venv nativo, anunciando qué rama tomó), más la línea en `.PHONY` y en `make help`. **No** se cuelga
de `seed-dev`: son dos datasets con públicos distintos (uno lo necesita el widget de cambio de rol
para funcionar; el otro es conveniencia), y encadenarlos obliga a quien solo quiere usuarios a
cargar 52 ejercicios.

### D5. Los tests: preconditions explícitas por test, no una fixture que reponga el seed

El acoplamiento que hoy tienen 5 archivos de test no es "usan los 52 ejercicios": es que **nunca
declaran que los necesitan**. Se resuelve con un helper explícito, no reponiendo el efecto global.

- `backend/tests/helpers.py` gana `create_exercise(db_session, *, id, name, muscle_group, ...)`:
  inserta la fila (con `name_normalized`), asegura los días y crea los vínculos vía
  `sync_exercise_day_links` (que por D8 los deja activos). Devuelve el `Exercise`.
- `backend/tests/conftest.py` gana una fixture **opt-in** (no `autouse`) `catalog_basic`, que crea
  un puñado chico y suficiente: los ids que la suite ya nombra más veces —`chest-bench-press`,
  `chest-cable-fly`, `legs-back-squat`— más uno por grupo que haga falta. Conservar esos ids
  acota el diff de los tests a agregar la fixture al parámetro, sin reescribir asserts.
- Los tests que necesitan otra cosa (un ejercicio de un grupo puntual) llaman a `create_exercise`
  en el cuerpo, donde se lee.

Alternativas consideradas:

- *Fixture `autouse` que siembre los 52.* Rechazada: reconstruye el efecto global que el change
  retira, hace imposible testear el catálogo vacío (el estado nuevo), y mantiene a los tests sin
  declarar sus preconditions — o sea, deja el mismo agujero que nos costó tres rondas de
  verificación en `add-exercise-catalog`.
- *Reusar `seed_dev_exercises.py` desde la suite.* Rechazada: vuelve al script de conveniencia una
  dependencia dura del CI — editar la lista de 52 para sumar un ejercicio de prueba pasaría a poder
  romper tests que no tienen nada que ver — y ata el schema de test al de un script de desarrollo.

### D6. Frontend: los tres sitios ya existen, cambia el mensaje y el destino

Ningún componente nuevo. En los tres casos, el estado vacío distingue **rol** para no darle al
Miembro una instrucción que no puede ejecutar:

| Sitio | Hoy | Cambio |
|---|---|---|
| `Exercises.tsx` `EmptyState` (línea 71) | ya separa "con búsqueda" / "sin búsqueda", pero el badge dice "Sin resultados" en los dos | El caso sin búsqueda pasa a ser un primer uso: badge/copy propios y **acción** que abre `CreateExerciseDialog` (el mismo handler que el botón de la cabecera). El caso con búsqueda queda igual. |
| `RoutineTemplateDetail.tsx:140` | "Este día no tiene ejercicios en el catálogo." | Explica la causa (no hay ejercicios cargados para los grupos de ese día) y enlaza a `/exercises`. Es una pantalla de staff, no hace falta bifurcar por rol. |
| `UserRoutine.tsx:190` | "No hay ejercicios activos para este día.", que además conflaciona `!selectedDay` con lista vacía | Se separan los dos casos y el de lista vacía dice que ese día todavía no tiene ejercicios cargados, **sin** pedirle nada al Miembro. |

**La redacción la fijan las specs, entre comillas, y no se reescribe.** Copia exacta a usar:

| Sitio | Texto |
|---|---|
| `Exercises.tsx` | título "Catálogo vacío" · "Todavía no cargaste ningún ejercicio. Cargá el primero para empezar a armar tus plantillas de rutina." · acción "Crear ejercicio" |
| `RoutineTemplateDetail.tsx` | "Todavía no hay ejercicios cargados para este día. Cargalos desde el catálogo de ejercicios." · acción "Ir a Ejercicios" que navega a `/exercises` |
| `UserRoutine.tsx` | "Este día todavía no tiene ejercicios cargados." (el **mismo** texto tanto si el catálogo está vacío como si el staff desactivó los ejercicios a propósito: la vista no distingue y no le pide nada al Miembro) |

El caso "sin resultados de búsqueda" de `Exercises.tsx` conserva su mensaje actual y **no** ofrece
la acción de crear (escenario explícito de la spec). La acción "Crear ejercicio" del estado vacío
se le ofrece igual al Dueño y al Coach (Q3 resuelta), mismo criterio que el botón de la cabecera.

### D7. Qué queda en `routine_catalog.py`

Solo `TRAINING_DAYS`, sin `default_active_ids`. El archivo no se renombra ni se mueve: el nombre
sigue siendo correcto (es el catálogo de días) y renombrarlo agrega ruido al diff de un change ya
grande. `routines.py` pasa a importar solo `TRAINING_DAYS`.

### D8. Un vínculo nuevo nace **activo**, salvo que el ejercicio ya tenga una desactivación tomada

> **SUPERADA por D10** (hallazgo bloqueante B1 de `verification.md`). La regla de esta decisión se
> retira entera: no había forma de sostenerla sin persistir estado nuevo, porque se apoyaba en que
> sobreviviera algún vínculo apagado y hay cuatro secuencias que dejan al ejercicio con cero
> vínculos. Se conserva escrita porque D10 se entiende leyendo por qué esto no funcionó.

Resolución de Q1 por el PO (`specs/exercise-catalog/spec.md`, "Disponibilidad de un ejercicio para
los días según su grupo muscular"): un ejercicio recién creado, o que cambia de grupo muscular,
**nace activo** para el día que le corresponde, de forma que el recorrido alta → agregar a la
plantilla → asignar al Miembro no tenga ningún paso oculto de activación.

Estado actual: `sync_exercise_day_links` crea los vínculos con `is_active=not preserve_active`, y
los dos callers pasan `preserve_active=True` ⇒ **inactivos**. El parámetro además está mal
nombrado: no preserva nada (los vínculos existentes se saltean con `continue` sin importar su
valor), solo decide el `is_active` de los vínculos nuevos.

**El parámetro `preserve_active` se retira.** La regla pasa a ser una sola, y vive entera dentro de
`sync_exercise_day_links`:

> Un vínculo nuevo nace `is_active=True`, **salvo** que el ejercicio ya tenga algún
> `TrainingDayExercise` con `is_active=False` en el momento de la llamada (contando los que esta
> misma llamada está por borrar). En ese caso el vínculo nuevo hereda la desactivación.

La salvedad es el candado contra el problema que señala el coordinador, y es exactamente el caso
que cierra la invariante I10 de `add-exercise-catalog`. Sin ella, el round trip
`Pecho → Espalda → Pecho` sobre un ejercicio que el staff había desactivado **borra la
desactivación y la repone en activo**, en silencio: el vínculo viejo se borra al cambiar de grupo y
el nuevo nace activo. Con ella, la desactivación es monótona — una vez tomada, cambiar el grupo
mueve el vínculo pero no lo reactiva; para volver a activarlo hay que decirlo explícitamente
(`PUT /routines/days/{day_id}/selection`, o activarlo dentro de la plantilla al agregarlo).

Alternativas consideradas:

- *Nacer siempre activo, sin salvedad.* Es lo que el texto de la spec dice literalmente, y es lo
  que rompe I10. Rechazada: convierte editar el grupo muscular en una vía indirecta de reactivar
  algo apagado a propósito, que es la misma clase de bug (una fuente de verdad implícita pisando
  una decisión humana) que este change viene a retirar.
- *No borrar nunca un vínculo desactivado, como ya se hace con los días que una plantilla usa.*
  Tentadora porque reusa una regla que la función ya tiene. Rechazada: deja el ejercicio colgando
  en un día cuyo grupo muscular ya no le corresponde, y ese vínculo fantasma hace que el día se vea
  "no vacío" en el editor de plantillas, tapando el estado vacío que este mismo change agrega (D9).
- *Copiar el `is_active` del vínculo que se borra, uno a uno, día por día.* Rechazada por
  indefinida: al cambiar de un grupo con dos días a uno con tres no hay correspondencia entre
  vínculos viejos y nuevos. La regla "si hay alguna desactivación, el vínculo nuevo nace apagado"
  es determinista y conservadora — ante la duda, respeta la decisión del staff.

**Efecto colateral a documentar, no a corregir:** `deactivate_exercise` apaga *todos* los
`day_links` del ejercicio, y `activate_exercise` no los repone (D7.1/I10 del change anterior). Con
D8, un ejercicio desactivado y reactivado tiene vínculos apagados, así que si después le cambian el
grupo muscular el vínculo nuevo también nace apagado. Es coherente con I10, pero **invalida la
frase** del comentario en `activate_exercise` ("reactivar deja al ejercicio igual que uno recién
creado"): desde este change, uno recién creado nace activo y uno reactivado no. El comentario se
actualiza para decir el motivo verdadero (reactivar no inventa una selección por día), sin cambiar
el comportamiento.

Nota de alcance que baja el riesgo: `PUT /routines/days/{day_id}/selection` **no tiene consumidor
en el frontend** (verificado). Hoy la curación por día solo se toca por API o por
`deactivate_exercise`; la curación que usa el staff en la UI es la de la plantilla
(`RoutineTemplateExercise.is_active`, que pisa la del vínculo en `_resolve_exercise_config`).

### D9. Un ejercicio desactivado en el catálogo deja de ofrecerse para el día, pero no se cae de las plantillas que ya lo usan

La spec de `routine-templates` pide que el día muestre el estado vacío cuando "el catálogo no tiene
ningún ejercicio activo" para ese grupo, y a la vez que una plantilla que ya tenía un ejercicio
agregado siga funcionando aunque después se desactive el resto. Hoy el detalle de plantilla
(`routine_templates.py:151-157`) lista **todos** los `TrainingDayExercise` del día sin mirar
`Exercise.is_active`, así que desactivar todos los ejercicios de "Hombros" deja el día lleno de
opciones apagadas y el estado vacío nunca aparece.

Regla nueva en el armado del detalle de plantilla: se excluye el vínculo cuyo `Exercise.is_active`
es `False` **y** que no tiene una `RoutineTemplateExercise` para esa plantilla y ese día. Los dos
escenarios de la spec caen exactos: el ejercicio desactivado desaparece como opción nueva, y el que
la plantilla ya tenía agregado sigue apareciendo (y sigue contando para el plan del Miembro, que ya
resuelve por `_resolve_exercise_config`).

Alternativa considerada: exponer `Exercise.is_active` en el payload y filtrar en el frontend.
Rechazada: agrega un campo al contrato para que dos pantallas repitan la misma regla, y "Mi rutina"
—que consume otro endpoint— quedaría afuera.

`routine_assignments.py` no necesita cambio: ya saltea los inactivos (línea 429) resolviendo por
configuración de plantilla primero.

### D10. El vínculo día↔ejercicio es **puramente derivado**: se retira `TrainingDayExercise.is_active`

Esta decisión reemplaza a D8 y cierra el bloqueante B1.

**Diagnóstico.** El bug (`Pecho → null → Pecho` repone activo un vínculo desactivado) no es un
error de la fórmula `all(link.is_active for link in existing_links)`: es que estamos usando el
`is_active` de una fila **derivada** para guardar una **decisión humana**. La fila existe o no
existe según el `muscle_group` actual; la decisión tiene que durar más que la fila. Cada vez que
esos dos tiempos de vida chocan, agregamos una salvedad — H2 en el change anterior, D8 en este, y
ahora haría falta una tercera. La respuesta correcta no es la tercera salvedad.

Y hay más secuencias que las que el hallazgo nombra: además de `muscle_group = null`, el enum
`MuscleGroup` tiene cuatro valores que **no corresponden a ningún día** del catálogo fijo
(`Antebrazo`, `Core`, `Glúteos`, `Cuerpo completo`). `Pecho → Core → Pecho` deja cero vínculos
igual que `null`. La regla de D8 estaba rota en un tercio del enum, no en un caso de borde.

**El dato que decide.** Revisé `openspec/specs/` entero: **ningún requirement pide curación por
día**. El único "activar o desactivar un ejercicio" que existe es por combinación
**(plantilla, día, ejercicio)** — `routine-templates`, "Composición de una plantilla por día y
ejercicio" —, y eso vive en `RoutineTemplateExercise.is_active`, una fila que nadie deriva de
nada y que ninguna de estas secuencias toca. `PUT /routines/days/{day_id}/selection`, el único
endpoint que edita el flag del vínculo, **no tiene consumidor en el frontend y no implementa
ningún requirement**. Llevamos tres correcciones consecutivas protegiendo un estado que nadie
pidió.

**Decisión**: `TrainingDayExercise` deja de tener `is_active`. El vínculo pasa a significar una
sola cosa, verdadera por construcción: *este ejercicio pertenece a este día porque su grupo
muscular lo dice*.

1. Se dropea la columna `training_day_exercises.is_active` (`models.py` + migración).
2. Se retira `PUT /routines/days/{day_id}/selection` y su schema. Sin requirement y sin
   consumidor; regla de BETA: se retira en el mismo change, no en uno de limpieza posterior.
3. `sync_exercise_day_links` vuelve a **dos** reglas, una menos que antes de D8: crea los vínculos
   de los días del grupo actual, y nunca borra un vínculo de un día que alguna plantilla esté
   usando (H2 sigue en pie). Desaparece la regla de nacimiento.
4. `_resolve_exercise_config`, sin fila de configuración, devuelve `(True, constant)` en vez de
   `(link.is_active, constant)`. Con eso el requirement "nace activo" (Q1) se cumple **sin ningún
   estado**: un ejercicio agregado a una plantilla arranca activo y en Constante, que es
   literalmente lo que la spec de `routine-templates` ya decía.
5. `_offered_as_new_option` pasa a decir lo que su nombre promete: se ofrece como opción nueva si
   hay fila de configuración para esa plantilla y ese día, **o** si `Exercise.is_active` **y** el
   día corresponde al `muscle_group` **actual** del ejercicio. El segundo término cierra un agujero
   preexistente: un vínculo conservado por H2 (porque una plantilla lo usa) hacía que el ejercicio
   se siguiera ofreciendo en el día viejo aunque ya no tuviera ese grupo — o directamente ninguno.
   Ahora el escenario "un ejercicio sin grupo muscular no se ofrece para ningún día" vale en
   **todas** las ramas, no solo con ejercicios sin usar.
6. El mismo predicado se aplica en `routine_assignments.py`. Es obligatorio: con el fallback en
   `True`, un ejercicio desactivado en el catálogo y sin fila de configuración se colaría en el
   plan del Miembro. De paso cierra el hallazgo 7 de `verification.md` (el detalle de plantilla y
   "Mi rutina" no coincidían cuando `Exercise.is_active` era `False` y el vínculo estaba activo:
   el Miembro lo veía en su plan y el Coach no lo veía en el detalle, así que no tenía cómo
   sacarlo). **Confirmado cerrado al implementar**: no hace falta un arreglo aparte para ese
   hallazgo, el predicado único lo disuelve.
7. `deactivate_exercise` deja de apagar los `day_links` (no hay nada que apagar). El efecto que
   buscaba —"un ejercicio desactivado no se ofrece"— ya lo da `Exercise.is_active` en los puntos 5
   y 6, que es donde corresponde.
8. `RoutineExerciseOption.is_active` sale del contrato de `GET /routines/days` y de
   `frontend/src/types.ts`. Verificado: ningún componente del frontend lo lee.
9. Los lectores restantes del flag son mecánicos, y son **tres**, no dos (la lista original de
   esta decisión decía "los otros dos" y se quedaba corta; los encontró un `grep` del Dev al
   implementar):
   - `active_exercise_count` del endpoint de progreso pasa a contar los vínculos cuyo ejercicio
     está activo;
   - la validación de alta de `WorkoutLog` (`if not link or not link.is_active`) pasa a mirar
     `link.exercise.is_active`;
   - el upsert de un `RoutineTemplateExercise` nuevo en `routine_templates.py`, que defaulteaba
     `is_active=link.is_active`, pasa a defaultear `True` — mismo criterio que el punto 4, y sin él
     el fallback y el upsert opinarían distinto sobre el mismo caso.

   **Total: 7 sitios de código** (puntos 3 a 9), no 5. Queda corregido acá a propósito: un mapa
   incompleto en el design es de la misma familia que los tests apuntados a la rama vecina que nos
   costaron tres rondas en el change anterior.

**Qué pasa con la secuencia del hallazgo.** Termina con el ejercicio ofrecido y activo — y eso es
**correcto**: el staff lo desactivó *en el catálogo* y después lo **reactivó**, y
`exercise-catalog` dice textualmente "Reactivar un ejercicio → vuelve a ofrecerse como opción para
agregar a una plantilla nueva". El error nunca fue que el flag volviera: fue que existiera un flag
capaz de dejar una cicatriz por día que ningún requirement pedía y que la UI no podía ver ni
revertir.

**Sobre la invariante I10 de `add-exercise-catalog`.** No se revisa: se **retira**, junto con el
concepto que protegía. Su argumento de entonces era que `activate_exercise` "inventaba el estado
más invasivo posible y pisaba en silencio la curación por día que el staff hizo con
`PUT /routines/days/{day_id}/selection`". Ese argumento se apoya entero en que esa curación exista
y tenga dueño; con el endpoint retirado y sin requirement que lo respalde, no queda nada que pisar.
`activate_exercise` sigue sin tocar vínculos, así que su código tampoco cambia — cambia solo el
comentario que explica por qué.

**Alternativas descartadas** (las tres que identificó el Dev, más una cuarta):

- *Persistir la señal en estado nuevo (una columna tipo `Exercise.day_optout`).* Rechazada: es
  agregar una columna, su migración y su mantenimiento para guardar una decisión que **ningún
  requirement pide** y que ninguna pantalla puede tomar ni revertir. La regla de BETA habilita
  agregar columnas cuando son la solución correcta; acá lo correcto es que sobre estado, no que
  falte.
- *Revisar I10: que `activate_exercise` restaure los `day_links`.* Rechazada porque **no arregla el
  bug**. En la secuencia reproducida la reactivación ocurre *antes* del round trip por `null`: con
  los vínculos restaurados activos, el `PATCH {"muscle_group": null}` los borra igual y el
  siguiente los crea activos. Cambia el camino, no el resultado. Además no toca las secuencias que
  pasan por `Core`/`Glúteos`/`Antebrazo`/`Cuerpo completo`.
- *Aflojar la spec "sin grupo muscular no se ofrece para ningún día" para tolerar un vínculo
  huérfano inactivo.* Rechazada, y con D10 **ni siquiera hace falta llevarla al PO**: el punto 5
  hace que ese escenario se cumpla en más ramas que hoy, no en menos. Aflojar una spec para que
  entre una implementación era la señal de que la implementación estaba mal.
- *Dejar la columna existiendo pero siempre en `True`.* Rechazada: deja la trampa armada para el
  próximo que la lea y crea que significa algo, y no ahorra la migración de datos que igual hace
  falta para que el comportamiento sea consistente.

**Costo sobre lo ya implementado**: se borra la regla de nacimiento (unas pocas líneas y su
docstring), se agrega una revision de Alembic, y se reemplazan dos tests por otros más simples. El
saldo de complejidad es **negativo**: `sync_exercise_day_links` queda con menos reglas que cuando
empezó este change.

### D11. La migración repara de una vez `training_days`, que quedó sin quien lo repare

Hallazgo 3 de `verification.md`, y es una deuda que crea **este** design: `add-exercise-catalog`
cambió `TRAINING_DAYS[*].muscle_groups` (`Triceps`→`Tríceps`, `Biceps`→`Bíceps`,
`["Piernas"]`→`["Cuádriceps","Isquios","Gemelos"]`) **sin migración de datos**, y se reparaba solo
porque `_ensure_seed_data` reescribía las 4 filas en cada request. D1 retira esa reparación, así
que una base que no corrió esa versión del código —producción, donde el grupo 9 de Railway del
change anterior nunca se ejecutó— se queda con el Día 4 titulado "Piernas" **para siempre**.

La migración de este change hace el `UPDATE` de una sola vez sobre las 4 filas (`name`,
`muscle_groups`, `day_order`), con **valores literales**, no importados de `routine_catalog.py`
(misma razón que D3: las migraciones son fotos). Es exactamente la regla dura que D2.2 escribe para
el futuro, aplicada retroactivamente a la deuda que dejó el change anterior.

## Risks / Trade-offs

- **[El `DELETE` de la migración se lleva configuración de plantillas y registros de entrenamiento
  de producción]** → Aceptado explícitamente bajo la regla de BETA; el proposal lo declara y no hay
  usuarios finales. Mitigación operativa: correr la migración de producción a mano (ver Migration
  Plan) y avisar antes.
- **[Un cambio futuro en `TRAINING_DAYS[*].muscle_groups` deja los vínculos desalineados y nadie
  los recalcula]** → Se documenta en `backend/AGENTS.md` como regla dura (D2.2) y el change R-3, que
  es el que va a tocar los días, la va a leer. Trade-off consciente: es un modo de fallo ruidoso y
  puntual, contra el actual, que es silencioso y en 20 endpoints.
- **[Retirar el bloque (3) rompe algún endpoint que asumía vínculos recién regenerados]** → Es el
  motivo del riesgo alto. Lo cubren I3 e I5 más la corrida manual de los tres roles.
- **[La suite queda verde y el bug sigue vivo, como en las rondas 1 y 2 de `add-exercise-catalog`]**
  → Mitigación de diseño, no de esfuerzo: I2 e I3 son invariantes **estructurales** (no existe la
  constante en `app/`; visitar endpoints no muta filas), verificables sin adivinar por qué rama
  entra el bug. Y los casos de la tabla nombran la rama que ejercitan, no el escenario de negocio.
- **[Retirar `TrainingDayExercise.is_active` (D10) borra una curación por día que alguien estuviera
  usando]** → Solo se edita por `PUT /routines/days/{day_id}/selection`, sin consumidor en el
  frontend y sin requirement; y `deactivate_exercise`, cuyo efecto útil lo cubren los puntos 5 y 6
  de D10. Bajo la regla de BETA, se descarta explícitamente.
- **[Un ejercicio desactivado en el catálogo se cuela en el plan del Miembro]** → Es el modo de
  fallo que abre el fallback en `True` (D10.4). Lo cierra el punto 6 con el mismo predicado que el
  detalle de plantilla, y lo fija un test propio en `test_member_routine.py`.
- **[El filtro de D9 esconde de una plantilla un ejercicio que sí tenía que ver]** → La condición
  lleva dos términos (`Exercise.is_active is False` **y** sin `RoutineTemplateExercise` para esa
  plantilla y ese día); los dos escenarios de la spec están cubiertos por un test cada uno,
  deliberadamente separados para que uno no tape al otro.
- **[El seed opcional corre contra producción por error]** → Doble candado compartido con
  `seed_dev_users.py` (D4), con sus dos tests de rechazo.
- **[Quedan 20+1 llamadas a `ensure_training_days` que ya casi nunca hacen nada]** → Aceptado a
  cambio de no cambiar dos cosas a la vez; queda como limpieza posterior barata y sin riesgo.

## Migration Plan

1. Implementar backend (D1, D2, D4, D7) y tests (D5) juntos: el repo no puede quedar a medias entre
   los dos modelos.
2. `make lint && make test` en verde.
3. Desarrollo: `cd backend && alembic upgrade head`; verificar que `/exercises` queda vacío y que
   `GET /routines/days`, `/routines/catalog` y `/routines/templates` siguen en 200.
4. Desarrollo: `make seed-dev-exercises`; verificar 52 ejercicios y sus vínculos activos.
5. Producción (Railway, a mano, con el procedimiento habitual): `railway run alembic upgrade head`.
   No hay paso de reseed en producción — el catálogo arranca vacío a propósito y lo carga el Dueño.
6. Rollback: `downgrade` no restaura nada (D3). Si hay que volver atrás, se vuelve el código y se
   recarga el catálogo a mano o con el seed en un entorno de desarrollo.

## Supuestos resueltos

Los tres supuestos que este design dejó abiertos los cerró el Product Owner en las specs:

- **Q1 → resuelto en contra del supuesto original.** Un ejercicio recién creado (o que cambia de
  grupo) **nace activo** para su día. Absorbido en D8, junto con el candado que evita que editar el
  grupo muscular se convierta en una reactivación indirecta.
- **Q2 → resuelto.** La redacción exacta de los tres mensajes está en las specs y se copia literal
  (tabla en D6).
- **Q3 → resuelto.** El Coach también ve la acción "Crear ejercicio" en el estado vacío.

Queda una sola pregunta abierta, y es de alcance futuro, no de este change: los 20 (+1) call sites
de `ensure_training_days` quedan como limpieza posterior (D1).

## Plan de verificación

**Riesgo**: alto — la migración **borra filas existentes** (52 ejercicios y, en cascada,
configuración de plantillas y registros de entrenamiento), y el diff cambia el comportamiento de
arranque de un helper que corre en 20 endpoints de un router central.

### Invariantes

- I1. Cambiar el `muscle_group` de **cualquier** ejercicio por `PATCH /exercises/{id}` lo hace
  seleccionable en los días del grupo nuevo y lo saca de los del viejo, salvo los días donde alguna
  plantilla ya lo usa (corrección H2, que no se toca).
- I2. Ningún módulo bajo `backend/app/` importa ni contiene `EXERCISE_LIBRARY`: la segunda fuente de
  verdad no puede volver sin que un test se ponga rojo.
- I3. Visitar cualquier endpoint de Rutinas, cuantas veces sea, no crea, borra ni modifica ninguna
  fila de `exercises`, `training_day_exercises` ni `routine_template_exercises`. Es el invariante
  que hubiera fallado en las rondas 1 y 2 del change anterior, y absorbe la mitad de I6 que sigue
  viva (la configuración por plantilla sobrevive a cualquier cantidad de requests posteriores).
- I4. Los 4 `TrainingDay` existen tras el primer request a Rutinas **o** a `POST /exercises/` sobre
  una base recién creada, y `ensure_training_days` no escribe nada si ya están.
- I5. Con `exercises` vacía, todos los endpoints de Rutinas, plantillas y asignaciones responden 200
  (o 404/403 por su propia razón), nunca 500.
- I6. **Retirada por D10**, y contradecía a I9: hablaba de "curación por día
  (`TrainingDayExercise.is_active`)", que es exactamente el estado que D10 elimina. Su mitad viva
  —la configuración por plantilla— pasó a I3. Se deja anotada en vez de renumerar, para no romper
  las referencias de `tasks.md` y para que el historial se lea.
- I7. El seed de ejercicios se niega a correr si `ENVIRONMENT` no es de desarrollo o si el host de
  `DATABASE_URL` no es local, **antes** de abrir conexión.
- I8. Un ejercicio recién creado con grupo muscular queda vinculado y **activo** para su día, de
  forma que agregarlo a una plantilla y asignarla alcanza para que el Miembro lo vea en "Mi rutina"
  sin ningún paso extra de activación.
- I9. El vínculo día↔ejercicio es derivado y sin estado propio: para cualquier secuencia de
  ediciones de grupo muscular (incluidas las que pasan por `null` o por un grupo sin día, como
  `Core`), el conjunto de días donde el ejercicio se ofrece depende **solo** de su `muscle_group`
  actual, de `Exercise.is_active` y de las plantillas que ya lo usan. Ninguna decisión del staff
  vive en `TrainingDayExercise`.
- I10. Un ejercicio desactivado en el catálogo deja de ofrecerse como opción nueva para su día —
  tanto en el detalle de plantilla como en "Mi rutina" — pero **no** desaparece de una plantilla que
  ya lo tenía agregado ni del plan del Miembro.
- I11. Un ejercicio agregado a una plantilla sin configuración propia arranca **activo** y en
  estrategia Constante, sin que eso dependa de ninguna fila previa.
- I12. Tras `alembic upgrade head`, las 4 filas de `training_days` coinciden con `TRAINING_DAYS`
  (`name`, `muscle_groups`, `day_order`) en cualquier base, incluida una que venga de antes de
  `add-exercise-catalog`. **Sin candado automatizado posible**: la suite arma el esquema con
  `create_all` y no corre migraciones, así que este invariante se verifica solo en la fila `manual`
  de la migración. Queda dicho a propósito, no por omisión.

### Tests

| Capa | Archivo | Caso |
|---|---|---|
| backend | `backend/tests/test_exercises.py` | `test_un_ejercicio_nuevo_nace_activo_para_el_dia_de_su_grupo_muscular` |
| backend | `backend/tests/test_exercises.py` | `test_cambiar_el_grupo_muscular_mueve_el_vinculo_al_dia_nuevo_y_lo_saca_del_viejo` |
| backend | `backend/tests/test_exercises.py` | `test_limpiar_y_reponer_el_grupo_muscular_deja_al_ejercicio_ofrecido_y_activo_en_su_dia` |
| backend | `backend/tests/test_exercises.py` | `test_pasar_por_un_grupo_muscular_sin_dia_en_el_catalogo_borra_los_vinculos_y_volver_los_repone` |
| backend | `backend/tests/test_exercises.py` | `test_desactivar_y_reactivar_un_ejercicio_lo_vuelve_a_ofrecer_para_su_dia` |
| backend | `backend/tests/test_exercises.py` | `test_un_ejercicio_sin_grupo_muscular_no_se_ofrece_ni_en_el_dia_de_la_plantilla_que_lo_usa` |
| backend | `backend/tests/test_exercises.py` | `test_crear_un_ejercicio_en_una_base_sin_dias_sembrados_no_falla_por_fk` |
| backend | `backend/tests/test_routines_seed.py` | `test_visitar_endpoints_de_rutinas_no_crea_ni_borra_ejercicios_ni_vinculos` |
| backend | `backend/tests/test_routines_seed.py` | `test_ensure_training_days_crea_los_cuatro_dias_una_vez_y_despues_no_escribe` |
| backend | `backend/tests/test_routines_seed.py` | `test_ningun_modulo_de_app_importa_exercise_library` |
| backend | `backend/tests/test_routines_seed.py` | `test_con_el_catalogo_vacio_los_endpoints_de_rutinas_responden_200` |
| backend | `backend/tests/test_routine_templates.py` | `test_editar_el_grupo_muscular_de_un_ejercicio_usado_en_una_plantilla_lo_deja_en_el_dia_viejo` |
| backend | `backend/tests/test_routine_templates.py` | `test_un_ejercicio_desactivado_en_el_catalogo_no_se_ofrece_como_opcion_nueva_del_dia` |
| backend | `backend/tests/test_routine_templates.py` | `test_un_ejercicio_desactivado_en_el_catalogo_sigue_en_la_plantilla_que_ya_lo_tenia` |
| backend | `backend/tests/test_routine_templates.py` | `test_un_ejercicio_agregado_sin_configuracion_propia_arranca_activo_y_en_constante` |
| backend | `backend/tests/test_member_routine.py` | `test_un_ejercicio_desactivado_en_el_catalogo_sin_configuracion_no_aparece_en_mi_rutina` |
| backend | `backend/tests/test_member_routine.py` | `test_mi_rutina_con_el_catalogo_vacio_devuelve_el_dia_sin_ejercicios` |
| backend | `backend/tests/test_member_routine.py` | `test_cargar_un_ejercicio_agregarlo_a_la_plantilla_y_asignarla_lo_deja_visible_en_mi_rutina` |
| backend | `backend/tests/test_dev_seed_exercises.py` | `test_seed_de_ejercicios_crea_los_52_con_sus_vinculos_de_dia_activos` |
| backend | `backend/tests/test_dev_seed_exercises.py` | `test_seed_de_ejercicios_dos_veces_no_duplica_ni_pisa_un_grupo_editado` |
| backend | `backend/tests/test_dev_seed_exercises.py` | `test_seed_de_ejercicios_se_niega_a_correr_fuera_de_desarrollo` |
| backend | `backend/tests/test_dev_seed_exercises.py` | `test_seed_de_ejercicios_se_niega_con_database_url_remota` |
| frontend | `frontend/src/pages/__tests__/Exercises.test.tsx` | `muestra el estado vacío de catálogo con la acción de crear ejercicio cuando no hay ninguno` |
| frontend | `frontend/src/pages/__tests__/Exercises.test.tsx` | `ofrece la acción de crear ejercicio del estado vacío también a un Coach` |
| frontend | `frontend/src/pages/__tests__/Exercises.test.tsx` | `mantiene el mensaje de sin resultados y no ofrece crear cuando la búsqueda no matchea` |
| frontend | `frontend/src/pages/__tests__/RoutineTemplateDetail.test.tsx` | `explica que hay que cargar ejercicios desde el catálogo y ofrece ir a Ejercicios cuando el día no tiene ninguno` |
| frontend | `frontend/src/pages/__tests__/UserRoutine.test.tsx` | `indica que el día todavía no tiene ejercicios cargados` |
| manual | — | Migración en desarrollo: `cd backend && alembic upgrade head`; antes y después, `SELECT count(*)` sobre `exercises`, `training_day_exercises` y `routine_template_exercises`. Confirmar que los ejercicios `custom-*` y sus filas de plantilla **siguen**, que los 52 ids del seed y sus dependientes ya no, y que `SELECT id, name, muscle_groups, day_order FROM training_days ORDER BY day_order` coincide con `TRAINING_DAYS` — en particular el Día 4 en `Cuádriceps, Isquios, Gemelos`, no `Piernas` (D11). |
| manual | — | Recorrido completo con catálogo vacío (`make dev`, los 3 usuarios de `make seed-dev`): en `/exercises` ver el estado vacío "Catálogo vacío" y crear un ejercicio desde su acción; abrir una plantilla y ver el día con el ejercicio nuevo **ya activo**; asignar la plantilla y entrar con `dev.member@miniespacio.local` a "Mi rutina" para verificar que aparece sin ningún paso de activación extra. Repetir el estado vacío del día con un Coach. |
| manual | — | `make seed-dev-exercises` en desarrollo: confirma 52 ejercicios con vínculos activos; correrlo dos veces seguidas no duplica nada. Después, con `ENVIRONMENT=production` en `backend/.env`, confirmar que corta con mensaje y sin tocar la base. |
| manual | — | Producción (Railway): `railway run alembic upgrade head`; entrar como Dueño, verificar que `/exercises` muestra el estado vacío, que Rutinas y las plantillas abren sin error, y crear un ejercicio para confirmar el alta desde cero. |
