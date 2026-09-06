## Purpose

Las cinco estrategias de progresión (Constante, Pirámide, Invertida, Drop set y Rest-pause) que, a partir de la base de un ejercicio (series × reps · kg), calculan de forma determinística el peso y las repeticiones objetivo de cada serie, con sus anotaciones ("20 s", "al fallo"). La estrategia se elige por (plantilla, día, ejercicio) y sus parámetros numéricos son constantes del sistema. Los escenarios numéricos son la referencia de cálculo para tests y UI.

## Requirements

### Requirement: Elección de estrategia por plantilla, día y ejercicio
Un Dueño o Coach SHALL poder elegir, para cada ejercicio activo dentro de una plantilla, una única
estrategia de progresión entre cinco opciones: Constante, Pirámide, Invertida, Drop set y
Rest-pause. Cambiar la estrategia elegida SHALL recalcular de inmediato el plan de series mostrado
para ese ejercicio, sin requerir un paso adicional de guardado para ver la previsualización.

#### Scenario: Cambiar la estrategia recalcula el plan al instante
- **WHEN** un Coach cambia la estrategia de "Press banca plano" de Constante a Rest-pause dentro
  de una plantilla
- **THEN** el plan de series mostrado para ese ejercicio se recalcula de inmediato con la regla de
  Rest-pause, sin que el Coach tenga que guardar primero para verlo

### Requirement: Cálculo de series para la estrategia Constante
Dada una base de S series × R repeticiones · P kg, la estrategia Constante SHALL calcular que
todas las S series tengan P kg y R repeticiones, sin variación entre series.

#### Scenario: Constante con base 4×8 · 45 kg
- **WHEN** el sistema calcula el plan de un ejercicio con base 4 series × 8 repeticiones · 45 kg y
  estrategia Constante
- **THEN** las cuatro series calculadas son 45 kg × 8 repeticiones cada una

### Requirement: Cálculo de series para la estrategia Pirámide
Dada una base de S series × R repeticiones · P kg, la estrategia Pirámide SHALL calcular, para la
serie i (numerada desde 0), un peso de P × (1 + 0,06 × i) redondeado al múltiplo de 2,5 kg más
cercano, y unas repeticiones de max(R − 2 × i, 3) — el piso de 3 repeticiones SHALL respetarse aun
cuando la resta daría un valor menor.

#### Scenario: Pirámide con base 4×8 · 45 kg (Press banca plano)
- **WHEN** el sistema calcula el plan de un ejercicio con base 4 series × 8 repeticiones · 45 kg y
  estrategia Pirámide
- **THEN** las series calculadas son 45 kg × 8, 47,5 kg × 6, 50 kg × 4 y 52,5 kg × 3

#### Scenario: Pirámide con base 5×5 · 70 kg (Sentadilla libre) respeta el piso de repeticiones
- **WHEN** el sistema calcula el plan de un ejercicio con base 5 series × 5 repeticiones · 70 kg y
  estrategia Pirámide
- **THEN** las series calculadas son 70 kg × 5, 75 kg × 3, 77,5 kg × 3, 82,5 kg × 3 y 87,5 kg × 3

#### Scenario: Pirámide con base 4×6 · 20 kg (Dominadas asistidas)
- **WHEN** el sistema calcula el plan de un ejercicio con base 4 series × 6 repeticiones · 20 kg y
  estrategia Pirámide
- **THEN** las series calculadas son 20 kg × 6, 20 kg × 4, 22,5 kg × 3 y 22,5 kg × 3

#### Scenario: Pirámide con base 3×12 · 14 kg (Aperturas con mancuernas)
- **WHEN** el sistema calcula el plan de un ejercicio con base 3 series × 12 repeticiones · 14 kg
  y estrategia Pirámide
- **THEN** las series calculadas son 15 kg × 12, 15 kg × 10 y 15 kg × 8

### Requirement: Cálculo de series para la estrategia Invertida
Dada una base de S series × R repeticiones · P kg, la estrategia Invertida SHALL calcular, para la
serie i (numerada desde 0), un peso de P × (1 − 0,06 × i) redondeado al múltiplo de 2,5 kg más
cercano, y unas repeticiones de R + 2 × i. El peso resultante NO SHALL bajar nunca del paso de
redondeo: si el cálculo redondeado da un valor menor a 2,5 kg, el sistema SHALL usar 2,5 kg como
piso.

#### Scenario: Invertida con base 4×8 · 45 kg (Press banca plano)
- **WHEN** el sistema calcula el plan de un ejercicio con base 4 series × 8 repeticiones · 45 kg y
  estrategia Invertida
- **THEN** las series calculadas son 45 kg × 8, 42,5 kg × 10, 40 kg × 12 y 37,5 kg × 14

#### Scenario: Invertida con base 3×12 · 14 kg (Aperturas con mancuernas)
- **WHEN** el sistema calcula el plan de un ejercicio con base 3 series × 12 repeticiones · 14 kg
  y estrategia Invertida
- **THEN** las series calculadas son 15 kg × 12, 12,5 kg × 14 y 12,5 kg × 16

#### Scenario: Invertida respeta el piso de 2,5 kg con una base de peso muy bajo
- **WHEN** el sistema calcula el plan de un ejercicio con base 10 series × 5 repeticiones · 2,5 kg
  y estrategia Invertida
- **THEN** en la última serie (serie 10, i=9), donde el cálculo sin piso redondearía a 0 kg, el
  peso calculado se mantiene en 2,5 kg

### Requirement: Cálculo de series para la estrategia Drop set
Dada una base de S series × R repeticiones · P kg, la estrategia Drop set SHALL calcular que las
primeras S-1 series tengan P kg y R repeticiones, y que la última serie tenga un peso de 0,8 × P
redondeado al múltiplo de 2,5 kg más cercano y unas repeticiones de 1,5 × R, marcada con la
anotación "al fallo". Cuando R sea impar, 1,5 × R SHALL redondearse hacia arriba al entero más
cercano (half-up).

#### Scenario: Drop set con base 4×8 · 45 kg (Press banca plano)
- **WHEN** el sistema calcula el plan de un ejercicio con base 4 series × 8 repeticiones · 45 kg y
  estrategia Drop set
- **THEN** las series calculadas son 45 kg × 8, 45 kg × 8, 45 kg × 8 y 35 kg × 12 con la anotación
  "al fallo" en la última serie

#### Scenario: Drop set redondea hacia arriba las repeticiones con R impar
- **WHEN** el sistema calcula el plan de un ejercicio con base 4 series × 7 repeticiones · 50 kg y
  estrategia Drop set
- **THEN** las series calculadas son 50 kg × 7, 50 kg × 7, 50 kg × 7 y 40 kg × 11 (1,5 × 7 = 10,5
  redondeado hacia arriba a 11) con la anotación "al fallo" en la última serie

### Requirement: Cálculo de series para la estrategia Rest-pause
Dada una base de S series × R repeticiones · P kg, la estrategia Rest-pause SHALL calcular, para
la serie i (numerada desde 0), P kg × max(R − i, 1) repeticiones — las repeticiones NO SHALL bajar
nunca de 1 — y SHALL mostrar la anotación de pausa "20 s" desde la segunda serie en adelante
(i ≥ 1).

#### Scenario: Rest-pause con base 4×8 · 45 kg (Press banca plano)
- **WHEN** el sistema calcula el plan de un ejercicio con base 4 series × 8 repeticiones · 45 kg y
  estrategia Rest-pause
- **THEN** las series calculadas son 45 kg × 8 (sin anotación), 45 kg × 7 "20 s", 45 kg × 6 "20 s"
  y 45 kg × 5 "20 s"

#### Scenario: Rest-pause respeta el piso de 1 repetición
- **WHEN** el sistema calcula el plan de un ejercicio con base 5 series × 4 repeticiones · 20 kg y
  estrategia Rest-pause
- **THEN** las series calculadas son 20 kg × 4 (sin anotación), 20 kg × 3 "20 s", 20 kg × 2 "20 s",
  20 kg × 1 "20 s" y 20 kg × 1 "20 s" (la quinta serie, donde R − i daría 0, queda en 1 repetición)

### Requirement: Parámetros de las estrategias como constantes del sistema
El sistema SHALL tratar como constantes, iguales para todo el gimnasio y para todos los
ejercicios, los parámetros numéricos de las estrategias: el incremento/decremento del 6 % por
serie en Pirámide e Invertida, la reducción del 20 % en la última serie de Drop set, el paso de
redondeo de 2,5 kg, el piso de 3 repeticiones, el incremento de 2 repeticiones por serie en
Invertida y la pausa de 20 segundos en Rest-pause. El sistema NO SHALL ofrecer una interfaz para
editar estos parámetros en este change.

#### Scenario: Sin control para editar los parámetros
- **WHEN** un Dueño o Coach busca una forma de cambiar el porcentaje de incremento de la
  estrategia Pirámide o el paso de redondeo
- **THEN** no encuentra ningún control en la interfaz para hacerlo

### Requirement: Sin estrategia por defecto de la plantilla
La plantilla de rutina NO SHALL tener una estrategia de progresión propia. La estrategia SHALL
existir únicamente por (plantilla, día, ejercicio), y una combinación nueva SHALL arrancar en la
estrategia Constante hasta que un Dueño o Coach la cambie.

#### Scenario: Una plantilla no tiene un campo de estrategia propio
- **WHEN** un Dueño o Coach ve la ficha de una plantilla
- **THEN** no encuentra un campo de "estrategia por defecto" a nivel de la plantilla, solo la
  estrategia elegida por cada (día, ejercicio)

#### Scenario: Un ejercicio nuevo dentro de una plantilla arranca en Constante
- **WHEN** un Coach activa por primera vez un ejercicio para un (plantilla, día) que antes no lo
  tenía configurado
- **THEN** ese ejercicio queda con la estrategia Constante hasta que el Coach elija otra
