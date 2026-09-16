## MODIFIED Requirements

> **Ronda 3.** El delta original de este requirement hablaba de "ejercicio desactivado **para esa
> plantilla**" y de un plan de solo lectura; las dos cosas las reescribieron después
> `template-owned-routine-days` y `member-routine-copies`. Lo único que este change sigue
> aportando —y lo único que el delta pide ahora— es el texto del día sin ejercicios. El resto del
> requirement se transcribe tal cual está hoy en la spec principal, para no revertir esos changes
> al sincronizar.

### Requirement: Ver el plan calculado por serie de cada ejercicio
Para el día elegido, la vista SHALL mostrar cada ejercicio agregado a ese día de esa copia con su
plan de series calculado por la estrategia de progresión configurada: por cada serie, el peso
objetivo y las repeticiones objetivo, junto con cualquier anotación que corresponda ("20 s" de
pausa, "al fallo"). Un ejercicio que no esté agregado a ese día de la copia NO SHALL aparecer en
el plan del Miembro. Por cada serie planificada, la vista SHALL ofrecer una acción para que el
Miembro marque el peso y las repeticiones que efectivamente hizo (ver `routine-progress-tracking`)
— el plan deja de ser de solo lectura. Si el día elegido no tiene ningún ejercicio agregado, la
vista SHALL mostrar el texto "Este día todavía no tiene ejercicios cargados.", en vez de una
sección vacía sin explicación, y SHALL NOT pedirle ninguna acción al Miembro: no es algo que él
pueda resolver.

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

#### Scenario: Un día sin ningún ejercicio muestra un mensaje en vez de una sección vacía
- **WHEN** un Miembro elige un día de su copia asignada y ese día no tiene ningún ejercicio
  agregado
- **THEN** la vista le muestra "Este día todavía no tiene ejercicios cargados.", en vez de una
  sección vacía sin explicación, y sin ofrecerle ninguna acción para resolverlo
