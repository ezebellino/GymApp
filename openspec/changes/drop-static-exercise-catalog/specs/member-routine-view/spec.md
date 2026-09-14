## MODIFIED Requirements

### Requirement: Ver el plan calculado por serie de cada ejercicio
Para el día elegido, la vista SHALL mostrar cada ejercicio activo de esa plantilla con su plan de
series calculado por la estrategia de progresión configurada: por cada serie, el peso objetivo y
las repeticiones objetivo, junto con cualquier anotación que corresponda ("20 s" de pausa, "al
fallo"). Un ejercicio desactivado para esa plantilla NO SHALL aparecer en el plan del Miembro. El
plan SHALL ser de solo lectura en este change — no SHALL incluir una acción para marcar una serie
como hecha ni un contador de series completadas. Si el día elegido no tiene ningún ejercicio
activo (porque el catálogo no tiene ningún ejercicio cargado para ese grupo muscular, o porque un
Dueño o Coach desactivó explícitamente para esa plantilla los únicos ejercicios que tenía), la
vista SHALL mostrar el texto "Este día todavía no tiene ejercicios cargados.", en vez de una
sección vacía sin explicación. El mensaje SHALL ser el mismo en los dos casos: la vista no
distingue, ni le pide nada al Miembro, porque no es una acción que el Miembro pueda resolver.

#### Scenario: Ver el plan de un día con varios ejercicios
- **WHEN** un Miembro con la plantilla "Fuerza 4 días" ve el Día 1, con "Press banca plano" en
  estrategia Pirámide y base 4×8 · 45 kg
- **THEN** ve las cuatro series calculadas de "Press banca plano": 45 kg × 8, 47,5 kg × 6,
  50 kg × 4 y 52,5 kg × 3

#### Scenario: Un ejercicio desactivado no aparece en el plan
- **WHEN** un ejercicio está desactivado para la plantilla que el Miembro tiene elegida
- **THEN** ese ejercicio no aparece en el plan del día mostrado al Miembro

#### Scenario: El plan es de solo lectura
- **WHEN** un Miembro ve el plan de series de un ejercicio
- **THEN** no encuentra ninguna acción para marcar una serie como hecha ni un contador de series
  completadas de la sesión

#### Scenario: Un día sin ningún ejercicio activo muestra un mensaje en vez de una sección vacía
- **WHEN** un Miembro elige un día de su plantilla asignada y ese día no tiene ningún ejercicio
  activo (porque el catálogo no tiene ninguno cargado para el grupo muscular de ese día)
- **THEN** la vista le muestra "Este día todavía no tiene ejercicios cargados.", en vez de una
  sección vacía sin explicación

#### Scenario: El mismo mensaje aplica si el staff desactivó a propósito los ejercicios de ese día
- **WHEN** un Miembro elige un día de su plantilla asignada cuyos ejercicios fueron desactivados a
  propósito por un Dueño o Coach para esa plantilla (no porque el catálogo esté vacío)
- **THEN** la vista le muestra el mismo texto "Este día todavía no tiene ejercicios cargados.",
  sin distinguir un caso del otro para el Miembro
