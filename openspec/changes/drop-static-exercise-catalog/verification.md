# Verificación: drop-static-exercise-catalog

**Fecha**: 2026-09-14
**Veredicto**: PASA CON RESERVAS
**Diff verificado**: el delta de la **ronda 3** (working tree, acotado a los archivos de este
change) sobre el código ya commiteado en `1dc66e1`
**Riesgo declarado**: alto
**Paso 0**: lint OK · test OK · plan OK

> **Ronda 3.** La ronda 1 salió FALLA (10 hallazgos). Entre la ronda 2 y esta, el change quedó
> parado mientras se implementaron y archivaron **dos changes encima**:
> `template-owned-routine-days` (retiró entero el catálogo global de días —
> `app/routine_catalog.py`, `TrainingDay`, `TrainingDayExercise`, `RoutineTemplateExercise`,
> `ensure_training_days`, `sync_exercise_day_links`) y `member-routine-copies` (la asignación pasó
> a ser una copia propia). Eso volvió **sin objeto** cinco de los diez hallazgos de la ronda 1
> (4, 7, 8, 9, 10) y obligó a recortar los artifacts: la tabla de tests del `## Plan de
> verificación` bajó de 27 a 12 casos, se borró el delta spec de `routine-templates` entero y se
> reescribieron los otros dos. Ese recorte es lo que más se revisó en esta ronda, porque
> sincronizar los delta specs originales habría **revertido** los dos changes posteriores.
>
> **Nota de alcance.** Las tasks 13.1–13.3 (Railway) siguen deliberadamente sin ejecutar: son
> operaciones sobre infraestructura viva que hace el usuario. La 15.7 es esta verificación. No
> hay ninguna task de código pendiente.
>
> **Árbol mezclado**: el working tree contiene además el trabajo sin commitear de
> `member-routine-copies`. La revisión se acotó a los archivos de este change.

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=drop-static-exercise-catalog` | OK (exit 0, `riesgo=alto`, los 12 casos existen) |
| Lint | `make lint` | OK (exit 0; ruff limpio, eslint 0 errores / 43 warnings preexistentes, `tsc` limpio) |
| Tests | `make test` | OK (exit 0; backend 283 passed, frontend 209 passed / 36 archivos) |

`openspec validate drop-static-exercise-catalog --strict` → válido.

## Escenarios de la spec

QA levantó el stack de Docker con `docker compose up -d --build backend` (rebuild explícito, no
solo restart: la nota operativa de la ronda 1 se respetó y esta vez no se verificó código viejo) y
recorrió los 11 escenarios de las dos delta specs recortadas.

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| `exercise-catalog` / Un catálogo recién instalado no tiene ejercicios | DB de dev reseteada a cero (`down -v` + migraciones + `make seed-dev`, sin `seed-dev-exercises`); `SELECT count(*) FROM exercises` = 0 antes de tocar la UI | PASA |
| `exercise-catalog` / Un ejercicio borrado no vuelve a aparecer | Crear y borrar "QA Borrar Temp", después usar el sistema con normalidad (crear otro ejercicio, crear una plantilla, abrir el buscador de un día); nunca reaparece | PASA |
| `exercise-catalog` / Un ejercicio desactivado no vuelve a ofrecerse por su cuenta | Desactivar "QA Sentadilla Temp" (badge "Inactivo", persiste tras reload); el buscador del día de plantilla responde "Sin resultados." | PASA |
| `exercise-catalog` / Catálogo vacío en la pantalla de ejercicios | UI con catálogo en 0; los tres textos leídos carácter por carácter | PASA |
| `exercise-catalog` / Un Coach también puede crear el primer ejercicio desde el estado vacío | Mismo estado vacío como Coach; la acción abre el alta y se creó un ejercicio de verdad | PASA |
| `exercise-catalog` / Una búsqueda sin resultados conserva su propio mensaje | Búsqueda `"zzz-no-existe"` sobre un catálogo con datos; sin acción de crear | PASA |
| `exercise-catalog` / Un filtro sin resultados tampoco muestra el catálogo como vacío | **Tres variantes**: filtro de grupo "Antebrazo", filtro de estado "Activos" sin activos, y página 2 vaciada por un borrado. En los tres, "SIN RESULTADOS", nunca "Catálogo vacío", nunca la acción de crear | PASA |
| `member-routine-view` / Ver el plan de un día con varios ejercicios | Día 1 de la copia activa del Miembro, con plan por serie y acción de marcar | PASA |
| `member-routine-view` / Un ejercicio no agregado a ese día no aparece en el plan | Día 2 de la misma copia: solo el único ejercicio agregado, con sus 4 series | PASA |
| `member-routine-view` / Cada serie planificada tiene una acción para marcarla | Botón "Marcar"/"Corregir" por serie | PASA |
| `member-routine-view` / Un día sin ningún ejercicio muestra un mensaje | Copia Alternativa con Día 1 vacío: texto literal, sin ninguna acción ofrecida al Miembro | PASA |
| *(fuera de spec)* Copia sin ningún día → "Rutina sin días" | Se intentó desde la UI y pegándole a la API | **NO VERIFICABLE** |

**El NO VERIFICABLE, en detalle**: `RoutineTemplateDaysUpdate` declara
`Field(min_length=1, max_length=5)`, así que la API rechaza una lista de días vacía, y `copy_days`
siempre copia al menos los días de la plantilla origen (que nace con su Día 1 desde el `POST`).
El estado solo es alcanzable manipulando la base a mano. **Contradice al hallazgo menor 4 del
Code Reviewer**, que lo daba por alcanzable desde la UI; la evidencia de QA está mejor fundada
(leyó el schema y lo intentó contra la API real), así que el hallazgo queda rebajado a "texto sin
spec ni test", sin la parte de "rama alcanzable".

## QA manual

Corrida completa (riesgo alto, no se omite). Stack de Docker real, los tres roles, con rebuild
del contenedor `backend` antes de empezar.

## Hallazgos

1. **[mayor]** `openspec/changes/drop-static-exercise-catalog/design.md:542` — **I2 quedó
   declarado como cubierto y no tiene ningún candado.** La fila que la tabla recortada le asigna
   es `backend/tests/test_routines_invariants.py::test_ningun_modulo_de_app_importa_el_catalogo_global_de_dias`,
   pero ese test es de `template-owned-routine-days` y su conjunto `retired_symbols` es
   `{routine_catalog, TRAINING_DAYS, TrainingDay, TrainingDayExercise, ensure_training_days,
   sync_exercise_day_links}` — **`EXERCISE_LIBRARY` no está**.
   **Falla con**: pegar `EXERCISE_LIBRARY = [...]` en `backend/app/routers/exercises.py` y derivar
   algo de ahí → `make test` verde y `make check-plan` verde (solo matchea nombres de caso). El
   invariante que es la razón de ser del change es hoy el único sin red.
2. **[mayor]** — **el requirement "El catálogo no se repone automáticamente" no tiene ningún
   test.** Al dar I3 por superado entero se perdió su mitad viva: "no crea, borra ni modifica
   ninguna fila de `exercises`". Ninguno de los 12 casos de la tabla recortada cubre los tres
   escenarios de ese requirement (los dos de `test_routines_invariants.py` son de otros changes,
   los cinco de `test_dev_seed_exercises.py` son el seed, los cinco de frontend son estados
   vacíos). Verificado: no queda ningún test que compare el conteo de `exercises` antes/después de
   pegarle a endpoints de Rutinas.
   **Falla con**: reintroducir un `db.add(Exercise(...))` de conveniencia en cualquier endpoint de
   Rutinas (el patrón exacto que este change retiró) → suite verde, y el requirement que se va a
   sincronizar a `openspec/specs/` queda sin candado. I5 ("con `exercises` vacía nada responde
   500") tampoco tiene fila propia, aunque está cubierto de forma difusa porque `conftest.py` deja
   el catálogo vacío para toda la suite.
3. **[menor]** `frontend/src/pages/Exercises.tsx:326` — con `offset > 0` y **cero** filtros, el
   mensaje que sale es "No encontramos ejercicios que coincidan con los filtros aplicados", sin
   que haya ninguno. `setOffset(0)` solo se dispara en el `useEffect` de
   `[debouncedQ, muscleGroup, trainingType, statusFilter, limit]`.
   **Falla con** (reproducido por QA, variante 7c): 11 ejercicios, ir a la página 2 y borrar desde
   ahí el único ítem → mensaje de filtros inexistentes, y el indicador queda en "pag 2 / 1" y
   "Mostrando 11-10 de 10". **No viola el requirement verificado** (que exige el mensaje correcto,
   no el índice) porque nunca muestra "Catálogo vacío". El arreglo natural es clampear el `offset`
   cuando `offset >= total`, no tocar el mensaje.
4. **[menor]** `frontend/src/pages/UserRoutine.tsx:200` y `:211` — los dos textos nuevos ("Rutina
   sin días" y "Esta rutina todavía no tiene días cargados. Consultá con tu coach.") son una
   decisión de producto tomada **sin consultar al Product Owner**, que es lo que la task 14.24
   pedía explícitamente, y no tienen ni requirement ni test. Además el texto le pide una acción al
   Miembro ("Consultá con tu coach") justo donde el requirement hermano dice "SHALL NOT pedirle
   ninguna acción al Miembro". Atenuante: QA confirmó que la rama **no es alcanzable** sin tocar
   la base (ver el NO VERIFICABLE de arriba), así que es deuda de registro, no un texto que un
   Miembro vaya a leer hoy.
5. **[menor]** `backend/scripts/seed_dev_exercises.py:183` — el reporte de colisión imprime
   `choca con el ejercicio {owner_id}`, y `/exercises` no busca por id.
   **Falla con**: un Dueño que cargó "Dominadas" a mano (id UUID) y corre `make seed-dev-exercises`
   → lee "choca con el ejercicio 7f3c1a2e-…" y tiene que ir a la base para saber cuál es. El
   `name` de la fila existente está a un `row.name` del query que ya se hace. La contabilidad
   (`created + skipped + collisions == 52`), la normalización y el caso de dos entradas del seed
   que normalicen igual entre sí están **bien** (verificado).
6. **[menor]** `tasks.md` grupo 15 — el recorte de artifacts no está registrado: no menciona ni el
   borrado de `specs/routine-templates/spec.md` entero ni la reescritura de los otros dos delta
   specs, que son los cambios de artifact más grandes de la ronda. Ligado: la "Nota de ronda 3"
   de `proposal.md` dice "(d) los estados vacíos accionables de la UI" en plural, pero el del
   editor de plantillas ya no existe — `RoutineDaysEditor.tsx:346` dice "Todavía no hay ejercicios
   cargados para este día. Buscalos arriba para agregarlos.", sin acción "Ir a Ejercicios", y no
   debería existir porque el picker ya no es por grupo muscular.

## Categorías sin hallazgos

- **Los delta specs reescritos no revierten los dos changes posteriores.** Contrastados
  requirement por requirement contra `openspec/specs/`:
  `specs/member-routine-view/spec.md` transcribe "Ver el plan calculado por serie" **palabra por
  palabra** como está hoy (copia y no plantilla, acción de marcar cada serie, los tres escenarios
  vigentes intactos) y solo le suma la oración del día sin ejercicios más su escenario;
  `specs/exercise-catalog/spec.md` agrega dos requirements que **no existen** en la spec vigente
  (los 11 títulos verificados) y no chocan con "Listado del catálogo con búsqueda y filtros"; y el
  borrado del delta de `routine-templates` no pierde nada, porque el escenario equivalente
  ("Buscador sin resultados") ya está en la spec vigente.
- **Seed de ejercicios**: contabilidad, normalización (la misma función que usa el router: NFC +
  strip + casefold) y colisión entre dos entradas del propio seed, todo correcto. Los 52 nombres
  normalizan a 52 valores distintos.
- **Condición del estado vacío**: cubre las cuatro ramas que pide la spec; se verificó que no haya
  un quinto filtro en el estado de la página.
- **Checklist del rol**: sin cambios a `models.py` ni migraciones en este delta, ningún contrato
  de API tocado, sin endpoints nuevos, sin secretos ni URLs hardcodeadas, strings de UI en español
  y código en inglés, y ninguna task marcada `[x]` que no esté hecha (las `[~]` están
  correctamente justificadas por 15.1–15.4).
- **Cadena de migraciones**: lineal y con un solo head
  (`c387dcc091c2 → bfc5002838bf → 030412411aba → 3887b713f57d → 423f909a614f`).
- **Riesgo declarado**: **alto sigue siendo correcto**. El delta de la ronda 3 aislado sería
  medio, pero el criterio se aplica al diff del change, y ese sigue conteniendo `bfc5002838bf`,
  que borra 52 filas de `exercises` en producción. Lo recortable es el alcance del QA manual (las
  filas manuales de `training_days` ya están anotadas como sin objeto), no el nivel.

## Sin verificar

- **Grupo 13 (Railway)**: 13.1–13.3 sin ejecutar por decisión de alcance. El hallazgo 3 de la
  ronda 1 (la divergencia de `training_days` en producción) **ya no aplica**: la tabla se dropeó
  entera en una migración posterior de `template-owned-routine-days`.
- **Estado de una copia sin días**: no alcanzable sin tocar la base (ver el NO VERIFICABLE).

## Fuera de alcance, registrado para un change aparte

- **`alembic upgrade head` desde una base Postgres vacía falla.**
  `e790291219f2_unify_clients_into_users` explota con
  `psycopg.errors.UnsafeNewEnumValueUsage: unsafe use of new value "user" of enum type userrole`:
  el valor se agrega al enum en `9f8a7c6b5d4e` y se usa en el mismo `upgrade head` corrido de
  punta a punta. QA lo esquivó corriendo `alembic upgrade 9f8a7c6b5d4e` primero y después
  `alembic upgrade head`. **No es de este change**, pero rompe cualquier setup desde cero (dev
  nuevo, CI, disaster recovery) y confirma con un caso concreto la nota ya conocida de que el gate
  de `/opsx:verify` no detecta migraciones rotas: `make test` usa SQLite con `create_all` y nunca
  corre Alembic.
