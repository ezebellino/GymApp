## MODIFIED Requirements

### Requirement: Elección de estrategia por plantilla, día y ejercicio
Un Dueño o Coach SHALL poder elegir, para cada ejercicio activo dentro de una plantilla o dentro
de la copia de rutina de un Miembro, una única estrategia de progresión entre cinco opciones:
Constante, Pirámide, Invertida, Drop set y Rest-pause. Cambiar la estrategia elegida SHALL
recalcular de inmediato el plan de series mostrado para ese ejercicio, sin requerir un paso
adicional de guardado para ver la previsualización. La estrategia elegida en la copia de un
Miembro SHALL ser independiente de la estrategia elegida en la plantilla de la que se copió:
cambiarla en la copia NO SHALL afectar a la plantilla origen ni a ninguna otra copia.

#### Scenario: Cambiar la estrategia recalcula el plan al instante
- **WHEN** un Coach cambia la estrategia de "Press banca plano" de Constante a Rest-pause dentro
  de una plantilla
- **THEN** el plan de series mostrado para ese ejercicio se recalcula de inmediato con la regla de
  Rest-pause, sin que el Coach tenga que guardar primero para verlo

#### Scenario: Cambiar la estrategia en la copia de un Miembro no afecta la plantilla origen
- **WHEN** un Coach cambia, dentro de la copia de rutina de un Miembro, la estrategia de "Press
  banca plano" de Constante a Pirámide
- **THEN** el plan de series de ese Miembro se recalcula con la regla de Pirámide
- **THEN** la plantilla de la que se copió esa rutina, y las copias de cualquier otro Miembro,
  siguen mostrando "Press banca plano" con la estrategia que tenían antes

### Requirement: Sin estrategia por defecto de la plantilla
Ni la plantilla de rutina ni la copia de rutina de un Miembro SHALL tener una estrategia de
progresión propia a su nivel. La estrategia SHALL existir únicamente por (plantilla o copia, día,
ejercicio), junto con la base (series × reps · kg) propia de esa misma combinación. Al agregar por
primera vez un ejercicio a un día — sea de una plantilla o de la copia de un Miembro — esa
combinación SHALL arrancar con la estrategia Constante y con la base fija por defecto de 3 series
× 10 repeticiones × 0 kg, hasta que un Dueño o Coach las cambie.

#### Scenario: Una plantilla no tiene un campo de estrategia propio
- **WHEN** un Dueño o Coach ve la ficha de una plantilla
- **THEN** no encuentra un campo de "estrategia por defecto" a nivel de la plantilla, solo la
  estrategia elegida por cada (día, ejercicio)

#### Scenario: Un ejercicio agregado por primera vez a un día de plantilla arranca en Constante
- **WHEN** un Coach agrega por primera vez un ejercicio a un día de una plantilla
- **THEN** ese ejercicio queda con estrategia Constante y con la base por defecto de 3×10 · 0 kg,
  hasta que el Coach cambie alguna de las dos

#### Scenario: Un ejercicio agregado por primera vez a un día de la copia de un Miembro arranca en Constante
- **WHEN** un Coach agrega, directamente sobre la copia de rutina de un Miembro, un ejercicio
  nuevo a uno de sus días
- **THEN** ese ejercicio queda con estrategia Constante y con la base por defecto de 3×10 · 0 kg
  en la copia de ese Miembro, hasta que el Coach cambie alguna de las dos
