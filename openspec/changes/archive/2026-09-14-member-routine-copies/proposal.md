## Why

Hoy asignar una plantilla a un Miembro crea una **referencia**: `RoutineAssignment` apunta a la
misma `RoutineTemplate` que puede tener asignada cualquier otro Miembro, y el único margen para
adaptar el plan a ese cliente en particular es `RoutineAssignmentBase`, un ajuste puntual de
series×reps·kg por ejercicio. Esto no alcanza para el caso real de uso: un Coach necesita poder
ajustarle a un Miembro concreto qué días tiene, qué ejercicios hace en cada uno o su estrategia de
progresión — no solo la base de un ejercicio puntual — sin que ese ajuste se filtre a la plantilla
original ni a ningún otro Miembro que también la tenga asignada. Hoy eso es imposible: cualquier
cambio a la plantilla se refleja en vivo para *todos* los que la tienen asignada.

Además, el Miembro no tiene ninguna forma de registrar lo que efectivamente hizo en el gimnasio:
"Mi rutina" es de solo lectura por diseño explícito de la spec vigente (`member-routine-view`), y
aunque el backend de registro (`WorkoutLog`, endpoints `/routines/my/logs`) ya existe, no hay
pantalla para usarlo. Un Coach o Dueño tampoco tiene, desde la ficha de un Miembro, una forma de
ver qué progreso lleva.

Este change resuelve ambos problemas con una misma decisión de modelo: asignar deja de ser
referenciar una plantilla y pasa a ser **copiarla**.

## What Changes

- **BREAKING**: asignar una plantilla a un Miembro crea una **copia independiente** de sus días,
  grupos musculares, ejercicios, estrategias de progresión y bases (series×reps·kg) — no una
  referencia a la `RoutineTemplate` original. Desde ese momento, la copia es la rutina de ese
  Miembro.
- Un Dueño o Coach SHALL poder entrar a la copia de un Miembro y editarla (agregar/quitar días,
  ejercicios, cambiar estrategia o base) igual que hoy edita una plantilla. Esa edición **afecta
  solo a ese Miembro**: ni a la plantilla original de la que se copió, ni a otros Miembros que
  también la tengan asignada (aunque hayan copiado la misma plantilla origen).
- **BREAKING**: se retira el comportamiento "los cambios de la plantilla se reflejan en vivo para
  el Miembro" (el requirement "Un cambio del administrador se refleja de inmediato" de
  `member-routine-view` deja de aplicar). Editar la plantilla original, después de asignada, **no
  toca** ninguna copia ya creada. Si hace falta bajar una versión nueva de la plantilla a un
  Miembro, la única vía es **reasignarle la plantilla**, lo que crea una copia nueva (ver el punto
  de reasignación más abajo).
- **BREAKING**: se retira el ajuste de base por cliente (`RoutineAssignmentBase` y los endpoints
  de "ajustar la base para este cliente", junto con el icon-button "Ajustar base" en la ficha del
  Miembro). Queda redundante: ahora se edita directamente la base dentro de la copia del Miembro,
  en vez de mantener dos mecanismos superpuestos (la base de la copia y un ajuste por encima).
- El Miembro SHALL poder **marcar el progreso de ejecución** de su rutina **serie por serie, en el
  momento**: "Mi rutina" le muestra las series planificadas de cada ejercicio (ej. "#1 40 kg × 10",
  "#2 45 kg × 8", …) y, por cada una, el Miembro marca el peso y las repeticiones que efectivamente
  hizo — pensado para usarse entrenando, con el teléfono en la mano, no como un formulario de carga
  posterior. El Miembro no puede registrar más series de las que su plan indica para ese ejercicio,
  ni marcar progreso sobre un ejercicio que no está en su copia. "Mi rutina" deja de ser de solo
  lectura: pasa a ser la pantalla desde la que el Miembro ejecuta y registra su entrenamiento.
- **BREAKING**: reasignar a un Miembro la misma plantilla de la que ya tiene una copia crea una
  **copia nueva**, que pasa a ser la asignación Activa; la copia anterior pasa a Alternativa,
  conservando intacto su histórico de progreso ya registrado. Nada se descarta: encaja con el par
  Activa/Alternativa que la asignación ya tiene hoy.
- La ficha de Usuario, en la fila de acciones de un Miembro, SHALL sumar un tercer icon-button de
  **Progreso** (el mismo icono que hoy identifica "Seguimiento" en la navegación lateral) junto a
  los de Ver y Editar ya existentes. Desde ahí un Dueño o Coach accede a una vista con el
  **histórico de registros del Miembro, filtrable por ejercicio y por período** (fecha, día,
  ejercicio, series, peso), más un **gráfico de la evolución del peso** de cada ejercicio en el
  tiempo.
- Las plantillas (`routine-templates`) siguen existiendo como se conocen hoy: son el catálogo de
  origen que un Coach usa para asignar. Este change no cambia cómo se crean o editan las
  plantillas en sí, solo qué pasa en el momento de asignarlas.
- **BREAKING**: solo una copia **Activa** bloquea el borrado de la plantilla de la que se originó.
  Una plantilla cuyas únicas copias sean Alternativas SHALL poder eliminarse; esas copias y su
  histórico de progreso sobreviven al borrado de la plantilla origen, sin dejar de existir para
  sus Miembros.
- **BREAKING**: se retira la asistencia automática que hoy crea `POST /routines/users/{id}/logs`
  cuando el staff carga un registro. Marcar una serie de progreso (por el Miembro o por el
  staff) NO SHALL registrar asistencia — el check-in sigue siendo su propio flujo, independiente.
  El motivo: si el Miembro marca su progreso desde el teléfono, esa marca deja de ser prueba de
  presencia física en el gimnasio.

## Capabilities

### New Capabilities
- `routine-progress-tracking`: que un Miembro marque, serie por serie y en el momento, los pesos y
  repeticiones que ejecutó sobre su propia copia de rutina, respetando las series que esa copia
  indica; y que un Dueño o Coach pueda consultar, desde la ficha del Miembro (icono Progreso), el
  histórico de registros filtrable por ejercicio y período, más la evolución del peso por
  ejercicio en el tiempo.

### Modified Capabilities
- `routine-assignment`: asignar pasa de crear una referencia a crear una copia independiente de la
  plantilla; se retira el ajuste de base por cliente (`RoutineAssignmentBase`) porque la copia ya
  es editable directamente; un Dueño o Coach edita la copia de un Miembro (días, ejercicios,
  estrategias, bases) sin afectar la plantilla origen ni otras copias.
- `member-routine-view`: "Mi rutina" deja de ser de solo lectura — el Miembro ve y ejecuta su
  propia copia, marcando el progreso serie por serie; se retira el requirement de reflejo en vivo
  de los cambios de la plantilla origen, porque la copia ya no depende de ella una vez creada.
- `data-table-row-actions`: se agrega el icono de Progreso al vocabulario cerrado de acciones de
  fila (mismo icono que "Seguimiento" del sidebar) para la fila de un Miembro en la tabla de
  Usuarios; se retira `SlidersHorizontal`="Ajustar base" del vocabulario, porque la acción que
  representaba desaparece.
- `progression-strategies`: la estrategia de progresión de un ejercicio pasa a vivir en la copia
  del Miembro (no en la plantilla que referencia la asignación); editarla en la copia no afecta a
  la plantilla origen.
- `routine-templates`: el requirement de eliminación de plantilla pasa a bloquearse únicamente por
  copias en estado Activa; una plantilla cuyas únicas copias sean Alternativas puede eliminarse,
  sin afectar esas copias ni su histórico.

## Impact

- **Modelo de datos** (`backend/app/models.py`): `RoutineAssignment` deja de ser una referencia
  `(user_id, template_id, status)` y pasa a poseer su propia copia de días/ejercicios/bases,
  análoga a la estructura `RoutineTemplateDay` → `RoutineTemplateDayMuscleGroup` /
  `RoutineTemplateDayExercise`, pero propia de cada asignación. `RoutineAssignmentBase` se
  elimina. `WorkoutLog` pasa a registrar contra la copia del Miembro (hoy referencia
  `routine_template_days`, que deja de tener sentido como fuente del plan vigente del Miembro).
  Requiere migración Alembic sin backfill: las asignaciones existentes se descartan y se
  recrean (consistente con GymApp en beta sin usuarios finales).
- **Backend**: `backend/app/routers/routine_assignments.py` (asignar pasa a copiar; se retiran los
  endpoints de ajuste de base; se suman endpoints de edición de la copia y de registro de
  progreso del Miembro sobre su copia — los de `/routines/my/logs` y `/routines/my/overview` ya
  existen pero hoy leen contra la plantilla, no contra una copia), `routines.py`,
  `routine_catalog.py`, `schemas.py`.
- **Frontend**: `UserRoutine.tsx` deja de ser de solo lectura y gana la interacción de registro de
  progreso serie por serie (pantalla nueva, hoy no existe); `AdjustExerciseBaseDialog.tsx` y el
  icon-button "Ajustar base" de `MemberTemplatesCard.tsx` se retiran; `Users.tsx` suma el
  icon-button de Progreso a la fila de Miembro; se necesita una vista de progreso nueva (listado
  filtrable + gráfico de evolución por ejercicio) alcanzable desde ese icono — hoy no existe
  ninguna (`Tracking.tsx` es un placeholder `ComingSoon`, y ese es el icono que se reutiliza).
- **Specs**: nueva `openspec/specs/routine-progress-tracking/`; deltas en
  `openspec/specs/routine-assignment/`, `openspec/specs/member-routine-view/`,
  `openspec/specs/data-table-row-actions/`, `openspec/specs/progression-strategies/`,
  `openspec/specs/routine-templates/`.
- **Riesgo: alto.** Cambia el modelo de datos central de rutinas (asignación deja de ser
  referencia), retira un mecanismo existente (`RoutineAssignmentBase`) y construye, desde cero,
  dos pantallas que hoy no existen: la ejecución serie por serie del Miembro en "Mi rutina" (hasta
  ahora de solo lectura) y la vista de progreso para Coach/Dueño (listado filtrable + gráfico de
  evolución). El alcance de este change es deliberadamente grande — el usuario evaluó partirlo y
  decidió resolverlo de punta a punta en un solo change; eso exige un plan de verificación
  proporcionalmente exigente en la fase de diseño (tests por capa en cada una de las dos
  pantallas nuevas, no solo en el cambio de modelo).

## Decisiones cerradas por el usuario

1. **Reasignar la misma plantilla a un Miembro que ya tiene una copia de ella** crea una copia
   nueva que pasa a Activa; la copia anterior pasa a Alternativa, conservando intacto su histórico
   de progreso. Nada se descarta.
2. **Granularidad del progreso**: serie por serie, en el momento — el Miembro ve las series
   planificadas de un ejercicio y marca cada una con el peso y las repeticiones que hizo realmente,
   pensado para usarse durante el entrenamiento.
3. **La vista de Progreso** para Coach/Dueño combina el histórico de registros del Miembro
   (filtrable por ejercicio y período) con un gráfico de evolución del peso por ejercicio en el
   tiempo.
4. **Un ejercicio o un día quitado de la copia de un Miembro** no puede borrar ni ocultar el
   progreso que ese Miembro ya había registrado contra él — la misma protección que
   `member-routine-view` ya exigía a nivel de plantilla se traslada, sin cambios de fondo, al
   nivel de copia.
5. **Un Miembro sin asignación Activa, pero con una o más Alternativas, sí puede entrenar**: elige
   y ejecuta cualquiera de sus copias Alternativas en "Mi rutina". El estado vacío ("todavía no
   tenés una rutina asignada") queda reservado al caso real de no tener ninguna copia asignada.
6. **La edición de la copia de un Miembro por Dueño o Coach** se hace desde la fila de esa copia en
   las rutinas asignadas de la ficha del Miembro (`MemberTemplatesCard`), con el mismo icono de
   Editar que ya existe ahí para otras acciones — no se agrega un punto de entrada nuevo.
7. **Solo una copia Activa bloquea el borrado de la plantilla origen.** Una plantilla cuyas únicas
   copias sean Alternativas puede eliminarse; esas copias y su histórico de progreso sobreviven,
   dejando de depender de la plantilla borrada.
8. **Se retira la asistencia automática** que hoy crea el registro de progreso del staff. Marcar
   una serie —lo haga el Miembro o el staff— no registra asistencia; el check-in sigue siendo un
   flujo aparte, porque una marca hecha desde el teléfono del Miembro ya no es prueba de presencia
   física.
