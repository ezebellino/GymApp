## ADDED Requirements

### Requirement: Marcar una serie ejecutada, serie por serie y en el momento
Un Miembro SHALL poder marcar, para cada serie planificada de un ejercicio de su copia de rutina,
el peso y las repeticiones que efectivamente hizo, pensado para registrarse durante el
entrenamiento (con el peso indicado precargado como valor de partida, ajustable antes de
confirmar). El Miembro NO SHALL poder registrar una serie para un ejercicio que no está agregado
a su copia, ni una cantidad de series mayor a la que su copia indica para ese ejercicio ese día.

#### Scenario: Marcar una serie con el peso y las repeticiones planificadas
- **WHEN** un Miembro entrenando ve la serie #1 de "Press banca plano" planificada en 45 kg × 8, y
  la ejecuta tal cual estaba planificada
- **THEN** marca esa serie con 45 kg y 8 repeticiones, y queda registrada como hecha

#### Scenario: Marcar una serie con un peso o repeticiones distintos a los planificados
- **WHEN** un Miembro ejecuta la serie #2 de "Press banca plano", planificada en 47,5 kg × 6, pero
  solo llega a 6 repeticiones con 45 kg
- **THEN** marca esa serie con 45 kg y 6 repeticiones — lo que efectivamente hizo, no lo
  planificado

#### Scenario: No se puede registrar una serie de más
- **WHEN** un ejercicio de la copia de un Miembro tiene planificadas 4 series y el Miembro ya
  marcó las 4
- **THEN** el sistema no ofrece una acción para agregar una quinta serie para ese ejercicio ese día

#### Scenario: No se puede registrar progreso de un ejercicio ajeno a la copia
- **WHEN** un ejercicio no está agregado a ningún día de la copia de rutina de un Miembro
- **THEN** ese Miembro no tiene forma de marcar progreso para ese ejercicio

### Requirement: Corregir una serie ya marcada
Un Miembro SHALL poder corregir el peso o las repeticiones de una serie que ya había marcado como
hecha, mientras esa serie siga perteneciendo a su copia de rutina vigente.

#### Scenario: Corregir el peso de una serie ya marcada
- **WHEN** un Miembro había marcado la serie #1 de "Sentadilla libre" con 70 kg × 5, y se da
  cuenta de que en realidad levantó 72,5 kg
- **THEN** puede corregir esa serie a 72,5 kg × 5, reemplazando el registro anterior

### Requirement: El plan editado por el Coach no invalida el progreso ya marcado
Si un Dueño o Coach edita la copia de un Miembro después de que ese Miembro ya marcó progreso sobre ella (cambia la cantidad de series, la estrategia o quita el ejercicio), los registros de progreso ya marcados SHALL conservarse sin borrarse. El plan vigente que el Miembro ve de ahí en adelante SHALL reflejar la copia tal como quedó después de la edición, sin mezclar series planificadas viejas con las nuevas.

#### Scenario: El Coach reduce las series de un ejercicio después de que el Miembro ya marcó progreso
- **WHEN** un Miembro ya había marcado 3 de las 4 series planificadas de "Press banca plano", y
  luego un Coach edita la copia de ese Miembro para dejar ese ejercicio en 2 series
- **THEN** el Miembro ve de ahí en adelante el ejercicio con 2 series planificadas
- **THEN** las 3 series que ya había marcado antes de la edición siguen existiendo en su histórico
  de progreso, sin borrarse

### Requirement: El histórico de registros sobrevive a un ejercicio quitado de la copia
Quitar un ejercicio, o un día completo, de la copia de rutina de un Miembro NO SHALL romper,
ocultar ni borrar los registros de progreso que ese Miembro ya tenía cargados para ese ejercicio.
Esos registros SHALL seguir siendo consultables, tanto por el Miembro como por un Dueño o Coach
desde la vista de Progreso, aunque el ejercicio ya no forme parte del plan vigente de esa copia.

#### Scenario: Un ejercicio quitado de la copia no rompe el histórico del Miembro
- **WHEN** un Coach quita "Aperturas con mancuernas" de un día de la copia de un Miembro que ya
  tenía registros de progreso cargados para ese ejercicio
- **THEN** "Aperturas con mancuernas" deja de aparecer en el plan vigente de ese Miembro
- **THEN** los registros de progreso de ese Miembro para "Aperturas con mancuernas" siguen
  pudiendo consultarse, tanto en su propio historial como en la vista de Progreso que ve un Coach

### Requirement: Un Miembro puede marcar progreso sobre cualquier copia asignada, tenga o no una Activa
Un Miembro con al menos una copia de rutina asignada — sea Activa o Alternativa — SHALL poder
elegirla en "Mi rutina" y marcar progreso sobre ella, sin que la falta de una asignación Activa se
lo impida. El estado vacío ("todavía no tenés una rutina asignada", sin ninguna acción para marcar
series) SHALL mostrarse únicamente cuando el Miembro no tiene ninguna copia asignada, sea Activa o
Alternativa.

#### Scenario: Un Miembro con solo copias Alternativas puede elegir y entrenar cualquiera
- **WHEN** un Miembro tiene dos copias asignadas, ambas en estado Alternativa (ninguna Activa), y
  abre "Mi rutina"
- **THEN** puede elegir cualquiera de las dos y marcar progreso sobre ella, igual que si tuviera
  una Activa

#### Scenario: Sin ninguna copia asignada, no hay nada que marcar
- **WHEN** un Miembro sin ninguna copia de rutina asignada (ni Activa ni Alternativa) abre "Mi
  rutina"
- **THEN** ve el mensaje de que todavía no tiene una rutina asignada, sin ninguna acción para
  marcar series

### Requirement: Vista de Progreso de un Miembro para Dueño o Coach
Desde la ficha de un Miembro, un Dueño o Coach SHALL poder abrir una vista de Progreso de ese
Miembro con dos partes: un histórico de sus registros de progreso (fecha, día, ejercicio, series
marcadas, peso) filtrable por ejercicio y por período, y un gráfico de la evolución del peso
registrado para cada ejercicio a lo largo del tiempo. Si el Miembro todavía no registró ningún
progreso, la vista SHALL indicarlo en vez de mostrar un histórico o un gráfico vacíos sin
explicación.

#### Scenario: Ver el histórico filtrado por ejercicio y período
- **WHEN** un Coach abre la vista de Progreso de un Miembro y filtra por el ejercicio "Press banca
  plano" en el último mes
- **THEN** ve únicamente los registros de progreso de ese Miembro para "Press banca plano"
  cargados en ese período

#### Scenario: Ver la evolución del peso de un ejercicio
- **WHEN** un Miembro registró progreso de "Sentadilla libre" con pesos crecientes a lo largo de
  varias semanas
- **THEN** el gráfico de evolución de ese ejercicio, en la vista de Progreso de ese Miembro, muestra
  esa tendencia creciente

#### Scenario: Vista de Progreso de un Miembro que nunca registró nada
- **WHEN** un Coach abre la vista de Progreso de un Miembro que todavía no marcó ninguna serie
- **THEN** la vista indica que ese Miembro todavía no tiene progreso registrado, en vez de mostrar
  un histórico o un gráfico vacíos

### Requirement: Marcar progreso no registra asistencia
Marcar una serie de progreso — sea el Miembro desde "Mi rutina" o el staff desde la ficha del Miembro — NO SHALL registrar ni crear automáticamente la asistencia (check-in) de ese Miembro. El registro de asistencia SHALL seguir siendo un flujo propio e independiente, sin relación con el registro de progreso.

#### Scenario: Un Miembro marca una serie sin quedar marcado como asistido
- **WHEN** un Miembro que no había hecho check-in ese día marca una serie de progreso desde "Mi
  rutina"
- **THEN** ese Miembro sigue sin tener asistencia registrada ese día, hasta que alguien la marque
  por el flujo de check-in

#### Scenario: Un Coach carga progreso por un Miembro sin registrar asistencia
- **WHEN** un Coach carga, desde la ficha de un Miembro, un registro de progreso para ese Miembro
- **THEN** el sistema no crea ni modifica ninguna asistencia de ese Miembro como efecto de esa
  carga

### Requirement: Un Miembro solo ve y edita su propio progreso
Un Miembro SHALL poder marcar y consultar únicamente el progreso de su propia copia de rutina, sin
poder ver ni modificar el progreso registrado por ningún otro Miembro. Un Dueño o Coach SHALL
poder consultar, desde la vista de Progreso, el progreso de cualquier Miembro, pero el marcado de
series SHALL seguir siendo una acción exclusiva del Miembro sobre su propia copia.

#### Scenario: Un Miembro no puede ver el progreso de otro Miembro
- **WHEN** un Miembro intenta acceder al progreso registrado por otro Miembro
- **THEN** el sistema se lo impide

#### Scenario: Un Coach puede ver el progreso de cualquier Miembro, pero no marcarlo por él
- **WHEN** un Coach abre la vista de Progreso de un Miembro
- **THEN** puede consultar su histórico y su gráfico de evolución
- **THEN** no encuentra, en esa vista, una acción para marcar una serie en nombre de ese Miembro
