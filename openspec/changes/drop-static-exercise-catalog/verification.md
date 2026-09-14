# Verificación: drop-static-exercise-catalog

**Fecha**: 2026-09-12
**Veredicto**: FALLA
**Diff verificado**: working tree contra `ecab5f2`, acotado a los archivos de este change
**Riesgo declarado**: alto
**Paso 0**: lint OK · test OK · plan OK

> **Nota de alcance.** Las tasks 13.1–13.3 (Railway) quedaron deliberadamente sin ejecutar: son
> operaciones sobre infraestructura viva que hace el usuario. No hay ninguna task de código
> pendiente; por eso se verificó con 61/64.
>
> **Otro change en paralelo**: otra sesión viene trabajando en `simplify-settings-view`. La
> revisión se acotó a los archivos de este change.

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=drop-static-exercise-catalog` | OK (exit 0, `riesgo=alto`, los 23 casos existen) |
| Lint | `make lint` | OK (exit 0; ruff limpio, eslint 0 errores / 43 warnings preexistentes, `tsc` limpio) |
| Tests | `make test` | OK (exit 0; backend 260 passed, frontend 179 passed / 33 archivos) |

`openspec validate drop-static-exercise-catalog --strict` → válido.

## Escenarios de la spec

QA levantó el stack de Docker y verificó **todos los escenarios de las tres delta specs: PASA**,
ninguno NO VERIFICABLE. Incluye el recorrido de primer uso completo (el Dueño crea su primer
ejercicio → lo agrega a una plantilla → la asigna → el Miembro lo ve en "Mi rutina", sin ningún
paso de activación intermedio), los tres estados vacíos con su texto literal, las dos ramas de
D9, la migración (58 filas → 6, conservando los `custom-*` y los 4 `training_days`), el seed
opcional con sus guardas, y el `403` del Miembro / `201` del Coach.

**El bloqueante B1 no lo encontró QA**: probó el round trip `Pecho → Espalda → Pecho`, que pasa.
La rama que falla es `Pecho → null → Pecho`, que ninguna spec nombra explícitamente y que el
Code Reviewer encontró razonando sobre el código.

## QA manual

Corrida completa (riesgo alto, no se omite). Stack de Docker real, los tres roles.

**Dato operativo que conviene registrar**: QA encontró el contenedor `backend` corriendo 4 horas
con código viejo (el `Dockerfile` no usa `--reload`), lo que produjo un `409` y un `is_active`
espurios en el primer intento. Se resolvió con `docker compose restart backend` y no se volvió a
reproducir. **Cualquier verificación manual sobre un stack ya levantado tiene que reiniciar
`backend` después de que el Dev toque código** — si no, se verifica una versión que no es la del
diff. Es el segundo change seguido en el que esto muerde.

## Hallazgos

1. **[bloqueante]** `backend/app/routers/routines.py:99` — la desactivación **no es monótona**
   cuando el grupo muscular pasa por `null`. `new_link_is_active = all(link.is_active for link in
   existing_links)` se apoya en que exista **algún** vínculo apagado; al limpiar el grupo,
   `desired_day_ids` queda vacío, el loop borra **todos** los vínculos, y la llamada siguiente
   encuentra `existing_links == []` → `all([]) is True` → el vínculo nuevo nace activo.
   **Falla con** (reproducido, 100% alcanzable desde la UI): crear un ejercicio en "Pecho" →
   desactivarlo (botón Desactivar) → reactivarlo → `PATCH {"muscle_group": null}` (el Dueño limpia
   el grupo en el diálogo de edición) → `PATCH {"muscle_group": "Pecho"}` → `GET /routines/days`
   devuelve el vínculo de `day-1` con **`is_active: true`**. El staff lo había desactivado a
   propósito y vuelve solo.
   Rompe el invariante **I9** de este change y el **I10** del change anterior.
   `test_cambiar_el_grupo_muscular_de_ida_y_vuelta_no_reactiva_un_vinculo_desactivado`
   (`backend/tests/test_exercises.py:588`) elige `Pecho → Espalda → Pecho`, **la única rama donde
   siempre sobrevive un vínculo apagado**. La rama `Pecho → null → Pecho` no la cubre ningún test.

2. **[mayor]** `frontend/src/pages/Exercises.tsx:71-98` y `:302` — el estado vacío del catálogo se
   dispara también con filtros activos. `EmptyState` solo bifurca por `debouncedQ`, pero la
   pantalla tiene tres filtros más (`muscleGroup`, `trainingType`, `statusFilter`) y paginación,
   todos enviados al backend.
   **Falla con**: catálogo de 20 ejercicios, ninguno de "Hombros"; el Dueño elige el filtro de
   grupo "Hombros" sin escribir nada → la pantalla afirma **"Catálogo vacío · Todavía no cargaste
   ningún ejercicio"** sobre un catálogo lleno, y ofrece crear el primero. Igual con
   `statusFilter="inactive"` sin inactivos, o al borrar filas estando en la página 2.
   La spec es explícita: *"cuando el catálogo está completamente vacío (**sin ningún filtro ni
   búsqueda aplicada**)"*. Los tres tests nuevos de `Exercises.test.tsx` solo ejercitan la rama de
   búsqueda. La condición debería exigir además sin grupo, sin tipo, `statusFilter === "all"` y
   `offset === 0`.

3. **[mayor]** `backend/app/routers/routines.py:159-184` — retirar el pisado de
   `name`/`muscle_groups`/`day_order` deja una divergencia real **sin migración que la repare**.
   El commit inmediatamente anterior (`add-exercise-catalog`) cambió `TRAINING_DAYS[*].muscle_groups`
   (`"Triceps"`→`"Tríceps"`, `"Biceps"`→`"Bíceps"`, `["Piernas"]`→`["Cuádriceps","Isquios","Gemelos"]`)
   **sin traer migración de datos**, y se reparaba solo porque `_ensure_seed_data` reescribía
   `training_days.muscle_groups` en cada request. Este change retira esa reparación.
   **Falla con**: una base cuyo `training_days` se creó antes de ese commit y que no corrió esa
   versión del código — que es exactamente el caso de producción, porque las tasks 9.1–9.5 de
   Railway del change anterior quedaron sin ejecutar. Tras `alembic upgrade head`,
   `GET /routines/days` devuelve `muscle_groups: ["Piernas"]` para el Día 4 **para siempre**: no
   hay ningún camino que lo corrija. En la UI el día se titula "Piernas" mientras sus ejercicios
   dicen "Cuádriceps"/"Isquios"/"Gemelos". Es solo presentación, pero es permanente y la ven los
   tres roles. Incumple retroactivamente la regla dura **D2.2** que el propio design escribe.
   **Chequeo antes de archivar**: `SELECT id, muscle_groups FROM training_days ORDER BY day_order;`
   en producción; si no coincide con `routine_catalog.py::TRAINING_DAYS`, hace falta un `UPDATE`.

4. **[menor]** `backend/scripts/seed_dev_exercises.py:166-167` — el seed reintroduce la segunda
   fuente de verdad que este change retira: sincroniza **los 52**, no los recién creados, y pasa
   `entry["muscle_group"]` (la constante) en vez del valor de la fila.
   **Falla con**: correr el seed, mover un ejercicio de grupo desde la UI, correr el seed otra vez
   → el vínculo vuelve al día viejo. Es el bug de la reserva 1 en versión dev-only.
   `test_seed_de_ejercicios_dos_veces_no_duplica_ni_pisa_un_grupo_editado` no lo detecta: edita
   `muscle_group` directo en el ORM sin mover el vínculo, y no verifica ningún `TrainingDayExercise`.

5. **[menor]** `backend/scripts/seed_dev_exercises.py:141-158` — el seed explota con
   `IntegrityError` crudo si el Dueño ya cargó un ejercicio con uno de los 52 nombres. La
   idempotencia es por `id`, pero `exercises.name_normalized` es `unique`. Dev-only, pero es el
   flujo natural (cargar a mano y después querer datos de prueba).

6. **[menor]** `frontend/src/pages/UserRoutine.tsx:192` — "Sin días." es una cadena de UI sin spec
   ni test. La separación de `!selectedDay` de la lista vacía es correcta, pero el texto es
   telegráfico y el Miembro con una plantilla sin días ve una caja con eso y nada más.

7. **[menor]** `backend/app/routers/routine_templates.py:108-119` vs
   `routine_assignments.py:427-434` — inconsistencia entre el detalle de plantilla y "Mi rutina"
   cuando `Exercise.is_active=False` y el vínculo está activo: el Miembro lo ve en su plan y el
   Coach **no** lo ve en el detalle, así que no tiene cómo sacarlo. Baja probabilidad (requiere
   `PUT /routines/days/{id}/selection`, sin consumidor en el frontend).

8. **[menor]** `backend/tests/test_routine_templates.py:337-362` — el test de D9 "ya agregado" no
   verifica lo que la spec afirma. La spec dice *"sigue apareciendo **activo** … **y en el plan
   del cliente**"*; el test solo asserta que el id está en el detalle. Verificado a mano: las dos
   cosas se cumplen hoy. No es un bug, es un candado que falta sobre media afirmación.

9. **[menor]** `backend/tests/test_routines_seed.py:33-60` — el test de I3 no puede fallar por la
   rama que importa: corre sin `catalog_basic`, así que `before == after == (0, 0)`. Detectaría
   "crea filas", no "borra/modifica", que es donde vivía el daño real. Compara solo conteos, no
   `is_active`/`sort_order`.

10. **[menor]** Nombres de test que hablan de un seed que ya no existe:
    `test_seed_vincula_los_ejercicios_de_pierna_a_los_grupos_musculares_nuevos`
    (`test_exercises.py:391`) y `test_un_reseed_del_catalogo_no_borra_la_configuracion_de_la_plantilla`
    (`test_routine_templates.py:253`). Los dos se reescribieron para no depender del seed pero
    conservan el nombre.

## Categorías sin hallazgos

- **Migración `bfc5002838bf`**: los 52 ids coinciden exactamente con `EXERCISE_LIBRARY`
  (verificado por script, sin diferencias en ninguna dirección). Las cinco FK a `exercises.id`
  tienen `ondelete="CASCADE"` en las migraciones reales, no solo en `models.py`: no puede fallar
  por FK. `downgrade()` no-op documentado. **Cadena de Alembic con un solo head**:
  `… → d5f74a834ac0 → e79526156f68 → c387dcc091c2 → bfc5002838bf`, sin ramas pese al change en
  paralelo.
- **El bug de FK**: cerrado. `sync_exercise_day_links` es el único insertor de
  `TrainingDayExercise` y sus tres callers llaman a `ensure_training_days` antes.
- **El `commit()` de `ensure_training_days`**: sin riesgo. Los 21 call sites la invocan como
  primera sentencia del handler, sin estado pendiente. Queda estrictamente mejor que antes.
- **N+1 en `_offered_as_new_option`**: no hay; `_serialize_detail` ya carga los links con
  `joinedload`.
- **Extracción del doble candado a `dev_guards.py`**: fiel, no se debilitó, y se evalúa antes de
  `create_engine` (verificado con centinela).
- **Textos literales del frontend**: los seis coinciden carácter por carácter con las specs, y el
  caso "sin resultados" conserva su propio mensaje sin ofrecer crear.
- **Riesgo declarado**: **alto es correcto**, por dos gatillos independientes (toca
  `backend/migrations/**` y borra datos existentes).
- **Tasks marcadas `[x]` que no estén hechas**: ninguna.

## Sin verificar

- **Grupo 13 (Railway)**: 13.1–13.3 sin ejecutar por decisión de alcance. El hallazgo 3 hace que
  esto importe más que de costumbre: el estado real de `training_days` en producción hay que
  mirarlo antes de dar el change por cerrado.
