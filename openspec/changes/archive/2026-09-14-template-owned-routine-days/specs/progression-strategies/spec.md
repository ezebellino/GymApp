## MODIFIED Requirements

### Requirement: Sin estrategia por defecto de la plantilla
La plantilla de rutina NO SHALL tener una estrategia de progresión propia. La estrategia SHALL
existir únicamente por (plantilla, día, ejercicio), junto con la base (series × reps · kg) propia
de esa misma combinación. Al agregar por primera vez un ejercicio a un día de una plantilla, esa
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
