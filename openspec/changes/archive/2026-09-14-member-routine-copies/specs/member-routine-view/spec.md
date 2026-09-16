## MODIFIED Requirements

### Requirement: Ver el plan calculado por serie de cada ejercicio
Para el día elegido, la vista SHALL mostrar cada ejercicio agregado a ese día de esa copia con su
plan de series calculado por la estrategia de progresión configurada: por cada serie, el peso
objetivo y las repeticiones objetivo, junto con cualquier anotación que corresponda ("20 s" de
pausa, "al fallo"). Un ejercicio que no esté agregado a ese día de la copia NO SHALL aparecer en
el plan del Miembro. Por cada serie planificada, la vista SHALL ofrecer una acción para que el
Miembro marque el peso y las repeticiones que efectivamente hizo (ver `routine-progress-tracking`)
— el plan deja de ser de solo lectura.

#### Scenario: Ver el plan de un día con varios ejercicios
- **WHEN** un Miembro con la copia de "Fuerza 4 días" ve el Día 1, con "Press banca plano" en
  estrategia Pirámide y base 4×8 · 45 kg
- **THEN** ve las cuatro series calculadas de "Press banca plano": 45 kg × 8, 47,5 kg × 6,
  50 kg × 4 y 52,5 kg × 3

#### Scenario: Un ejercicio no agregado a ese día no aparece en el plan
- **WHEN** un ejercicio no está agregado al día de la copia que el Miembro tiene elegida
- **THEN** ese ejercicio no aparece en el plan del día mostrado al Miembro

#### Scenario: Cada serie planificada tiene una acción para marcarla
- **WHEN** un Miembro ve el plan de series de un ejercicio
- **THEN** encuentra, junto a cada serie planificada, una acción para marcar el peso y las
  repeticiones que efectivamente hizo en esa serie

## REMOVED Requirements

### Requirement: El plan refleja los ajustes de base hechos para ese cliente
**Reason**: se retira el ajuste de base por cliente (`routine-assignment`); la base ya no se
sobreescribe por encima de la plantilla, se edita directamente sobre la copia del Miembro. El plan
calculado siempre usa la base propia de esa copia, sin que exista un ajuste separado que reflejar.

**Migration**: ninguna acción del lado del Miembro — el plan sigue calculándose a partir de la
base vigente de su copia, que ahora es la única base que existe para esa copia. La edición de esa
base queda cubierta por "Edición de la copia de un Miembro por Dueño o Coach" en
`routine-assignment`.

### Requirement: Un cambio del administrador se refleja de inmediato
**Reason**: la asignación deja de ser una referencia en vivo a la plantilla — es una copia
independiente creada en el momento de asignar. Editar la plantilla origen después de asignada ya
no tiene efecto sobre ninguna copia ya creada.

**Migration**: para bajarle a un Miembro los cambios hechos en la plantilla origen, un Dueño o
Coach reasigna esa plantilla, lo que crea una copia nueva (ver "Asignación de una plantilla a un
Miembro" en `routine-assignment`), dejando la copia anterior como Alternativa con su progreso
intacto.

### Requirement: El histórico de registros sobrevive a un ejercicio quitado de la plantilla
**Reason**: se reemplaza por un requirement equivalente a nivel de copia — con asignación como
copia, lo que puede editarse (y de lo que un ejercicio puede quitarse) es la copia del Miembro, no
la plantilla que él tiene asignada.

**Migration**: ver "El histórico de registros sobrevive a un ejercicio quitado de la copia" en
`routine-progress-tracking`.
