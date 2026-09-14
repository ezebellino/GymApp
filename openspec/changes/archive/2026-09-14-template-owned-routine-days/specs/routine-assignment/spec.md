## MODIFIED Requirements

### Requirement: Ajuste de la base por cliente con autoría
Al asignar una plantilla, o después, un Dueño o Coach SHALL poder sobreescribir, para ese cliente
en particular, la base (series × reps · kg) propia que uno o más ejercicios tienen en esa
plantilla — no la base del catálogo global. Cuando exista un ajuste, el sistema SHALL registrar
quién lo hizo y en qué fecha, y mostrar esa información junto a la asignación. Sin ningún ajuste,
la asignación SHALL indicar que usa la base propia de la plantilla sin cambios. Si el ejercicio
ajustado es quitado del día de la plantilla, el ajuste SHALL dejar de tener efecto sin romper la
asignación ni el histórico ya registrado para ese cliente.

#### Scenario: Ajustar la base de un ejercicio para un cliente
- **WHEN** el Coach Eze ajusta, para la asignación de "Fuerza 4 días" a un Miembro, la base de
  "Press banca plano" a 4×6 · 50 kg
- **THEN** el plan calculado para ese Miembro usa esa base ajustada en lugar de la base propia que
  ese ejercicio tiene en la plantilla
- **THEN** la asignación muestra "Ajustada por Eze" junto con la fecha del ajuste

#### Scenario: Asignación sin ajustes
- **WHEN** un Coach asigna una plantilla a un Miembro sin sobreescribir la base de ningún ejercicio
- **THEN** la asignación indica que no tiene ajustes y el plan calculado usa la base propia de la
  plantilla

#### Scenario: Quitar el ajuste de base de un ejercicio
- **WHEN** el Coach Eze había ajustado la base de "Press banca plano" a 4×6 · 50 kg para un
  Miembro, y ahora quita ese ajuste
- **THEN** el plan calculado para ese Miembro vuelve a usar la base propia que ese ejercicio tiene
  en la plantilla
- **THEN** la asignación deja de mostrar la autoría y fecha de ese ajuste

#### Scenario: Quitar de la plantilla un ejercicio con ajuste de base para un cliente
- **WHEN** el Coach Eze había ajustado la base de "Press banca plano" para un Miembro, y luego un
  Dueño quita "Press banca plano" del día de la plantilla que ese Miembro tiene asignada
- **THEN** ese ejercicio deja de aparecer en el plan del Miembro y el ajuste deja de tener efecto
- **THEN** la asignación del Miembro y su histórico ya registrado para ese ejercicio se conservan
  intactos
