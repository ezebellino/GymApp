## ADDED Requirements

### Requirement: Asignación de una plantilla a un Miembro
Un Dueño o Coach SHALL poder asignar una plantilla de rutina a un usuario con rol Miembro,
indicando un estado (Activa o Alternativa) y quedando registrada la fecha desde la que rige la
asignación. Un Miembro SHALL poder tener varias plantillas asignadas a la vez, pero como máximo
una con estado Activa. Asignar una nueva plantilla como Activa SHALL dejar automáticamente
cualquier otra asignación Activa previa de ese Miembro en estado Alternativa.

#### Scenario: Asignar una primera plantilla como Activa
- **WHEN** un Coach asigna la plantilla "Fuerza 4 días" a un Miembro que no tenía ninguna plantilla
  asignada, con estado Activa
- **THEN** el Miembro queda con esa plantilla como su única asignación, en estado Activa

#### Scenario: Asignar una segunda plantilla como Alternativa
- **WHEN** un Miembro ya tiene "Fuerza 4 días" como Activa y un Coach le asigna "Full body inicial"
  con estado Alternativa
- **THEN** el Miembro queda con ambas plantillas asignadas: "Fuerza 4 días" sigue Activa y
  "Full body inicial" queda como Alternativa

#### Scenario: Asignar una nueva plantilla Activa reemplaza a la anterior
- **WHEN** un Miembro tiene "Fuerza 4 días" como Activa y un Coach asigna "Hipertrofia 3 días" con
  estado Activa
- **THEN** "Hipertrofia 3 días" queda Activa y "Fuerza 4 días" pasa a estado Alternativa,
  conservándose ambas asignaciones

### Requirement: Ajuste de la base por cliente con autoría
Al asignar una plantilla, o después, un Dueño o Coach SHALL poder sobreescribir, para ese cliente
en particular, la base (series × reps · kg) de uno o más ejercicios de la plantilla. Cuando exista
un ajuste, el sistema SHALL registrar quién lo hizo y en qué fecha, y mostrar esa información junto
a la asignación. Sin ningún ajuste, la asignación SHALL indicar que usa la base del catálogo sin
cambios.

#### Scenario: Ajustar la base de un ejercicio para un cliente
- **WHEN** el Coach Eze ajusta, para la asignación de "Fuerza 4 días" a un Miembro, la base de
  "Press banca plano" a 4×6 · 50 kg
- **THEN** el plan calculado para ese Miembro usa esa base ajustada en lugar de la base global del
  catálogo
- **THEN** la asignación muestra "Ajustada por Eze" junto con la fecha del ajuste

#### Scenario: Asignación sin ajustes
- **WHEN** un Coach asigna una plantilla a un Miembro sin sobreescribir la base de ningún ejercicio
- **THEN** la asignación indica que no tiene ajustes y el plan calculado usa la base del catálogo

#### Scenario: Quitar el ajuste de base de un ejercicio
- **WHEN** el Coach Eze había ajustado la base de "Press banca plano" a 4×6 · 50 kg para un
  Miembro, y ahora quita ese ajuste
- **THEN** el plan calculado para ese Miembro vuelve a usar la base global del catálogo para
  "Press banca plano"
- **THEN** la asignación deja de mostrar la autoría y fecha de ese ajuste

### Requirement: La membresía activa condiciona nuevas asignaciones
El sistema SHALL permitir asignar una plantilla únicamente a Miembros con membresía activa. Un
Miembro cuya membresía esté dada de baja, o que nunca haya tenido una membresía activa, NO SHALL
poder recibir una nueva asignación de plantilla mientras dure esa condición. Esta condición SHALL
aplicar únicamente a asignaciones nuevas: una asignación que el Miembro ya tenía SHALL conservarse
intacta, sin borrarse ni modificarse, cuando pierda la membresía activa.

#### Scenario: Rechazar la asignación a un Miembro con membresía dada de baja
- **WHEN** un Dueño intenta asignar una plantilla a un Miembro cuya membresía está dada de baja
- **THEN** el sistema rechaza la asignación y no la crea

#### Scenario: Reactivar la membresía habilita nuevas asignaciones
- **WHEN** un Dueño reactiva la membresía de un Miembro que estaba dada de baja y luego le asigna
  una plantilla
- **THEN** el sistema permite la asignación

#### Scenario: Dar de baja la membresía no quita las asignaciones existentes
- **WHEN** un Dueño da de baja la membresía de un Miembro que ya tenía "Fuerza 4 días" asignada
  como Activa
- **THEN** esa asignación se conserva intacta
- **THEN** al reactivarse la membresía de ese Miembro, vuelve a verla en "Mi rutina" — mientras la
  membresía está dada de baja, el Miembro no puede acceder a la aplicación por la regla de
  autenticación vigente (`backend/app/auth.py`, no modificada por este change), así que no llega a
  abrir "Mi rutina" en ese estado

### Requirement: Quitar una asignación
Un Dueño o Coach SHALL poder quitar, con confirmación, una asignación de plantilla de un Miembro
(sea Activa o Alternativa). Quitar la asignación Activa NO SHALL promover automáticamente ninguna
Alternativa a Activa: el Miembro queda sin plantilla Activa hasta que un Dueño o Coach asigne o
promueva una explícitamente.

#### Scenario: Quitar una asignación Alternativa
- **WHEN** un Coach quita, con confirmación, la asignación Alternativa "Full body inicial" de un
  Miembro que también tiene "Fuerza 4 días" como Activa
- **THEN** el Miembro queda únicamente con "Fuerza 4 días" como Activa

#### Scenario: Quitar la asignación Activa no promueve una Alternativa
- **WHEN** un Dueño quita, con confirmación, la asignación Activa "Fuerza 4 días" de un Miembro que
  también tiene "Full body inicial" como Alternativa
- **THEN** el Miembro queda sin ninguna plantilla Activa
- **THEN** "Full body inicial" sigue en estado Alternativa, sin pasar a Activa automáticamente

### Requirement: Ver las plantillas asignadas de un cliente desde su ficha
La ficha de un Miembro SHALL mostrar todas sus plantillas asignadas con su estado (Activa o
Alternativa), y desde ahí un Dueño o Coach SHALL poder asignarle una plantilla nueva, siguiendo el
mismo patrón de acciones en la ficha del usuario que el resto de las acciones sobre un Miembro
(membresía, invitación).

#### Scenario: Ver el estado de las plantillas asignadas en la ficha
- **WHEN** un Coach abre la ficha de un Miembro que tiene "Fuerza 4 días" Activa y
  "Full body inicial" como Alternativa
- **THEN** ve ambas plantillas listadas, cada una con su estado correspondiente
