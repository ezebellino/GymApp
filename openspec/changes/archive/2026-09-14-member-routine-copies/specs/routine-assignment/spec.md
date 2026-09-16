## MODIFIED Requirements

### Requirement: Asignación de una plantilla a un Miembro
Un Dueño o Coach SHALL poder asignar una plantilla de rutina a un usuario con rol Miembro,
indicando un estado (Activa o Alternativa) y quedando registrada la fecha desde la que rige la
asignación. Asignar una plantilla SHALL crear una **copia independiente** de sus días, grupos
musculares, ejercicios, estrategias de progresión y bases (series × reps · kg) propia de ese
Miembro — no una referencia a la plantilla original. Un Miembro SHALL poder tener varias copias
asignadas a la vez, pero como máximo una con estado Activa. Asignar una nueva plantilla como
Activa SHALL dejar automáticamente cualquier otra asignación Activa previa de ese Miembro en
estado Alternativa. Reasignar a un Miembro la misma plantilla de la que ya tiene una copia SHALL
crear una copia nueva, independiente de la anterior, que pasa a ser la asignación Activa; la
copia anterior SHALL pasar a estado Alternativa, conservando intacto el progreso ya registrado
contra ella.

#### Scenario: Asignar una primera plantilla como Activa
- **WHEN** un Coach asigna la plantilla "Fuerza 4 días" a un Miembro que no tenía ninguna copia
  asignada, con estado Activa
- **THEN** el Miembro queda con una copia de "Fuerza 4 días" como su única asignación, en estado
  Activa

#### Scenario: Asignar una segunda plantilla como Alternativa
- **WHEN** un Miembro ya tiene una copia de "Fuerza 4 días" como Activa y un Coach le asigna
  "Full body inicial" con estado Alternativa
- **THEN** el Miembro queda con copias de ambas plantillas asignadas: la de "Fuerza 4 días" sigue
  Activa y la de "Full body inicial" queda como Alternativa

#### Scenario: Asignar una nueva plantilla Activa reemplaza a la anterior
- **WHEN** un Miembro tiene una copia de "Fuerza 4 días" como Activa y un Coach asigna
  "Hipertrofia 3 días" con estado Activa
- **THEN** la copia nueva de "Hipertrofia 3 días" queda Activa y la copia de "Fuerza 4 días" pasa
  a estado Alternativa, conservándose ambas asignaciones

#### Scenario: Editar la plantilla origen no afecta las copias ya creadas
- **WHEN** un Dueño edita, después de haberla asignado, la plantilla "Fuerza 4 días" (agrega un
  ejercicio a un día, cambia una estrategia)
- **THEN** ninguna copia ya asignada de "Fuerza 4 días" a ningún Miembro cambia — cada copia sigue
  mostrando exactamente lo que tenía en el momento en que fue creada

#### Scenario: Reasignar la misma plantilla crea una copia nueva y conserva la anterior como Alternativa
- **WHEN** un Miembro ya tiene una copia Activa de "Fuerza 4 días" con progreso registrado, y un
  Coach le vuelve a asignar "Fuerza 4 días" (por ejemplo, para bajarle cambios hechos en la
  plantilla origen desde entonces)
- **THEN** se crea una copia nueva de "Fuerza 4 días" que pasa a ser la asignación Activa del
  Miembro
- **THEN** la copia anterior pasa a estado Alternativa, sin perder ninguno de los registros de
  progreso que el Miembro ya había cargado contra ella

### Requirement: La membresía activa condiciona nuevas asignaciones
El sistema SHALL permitir asignar una plantilla (creando una copia) únicamente a Miembros con
membresía activa. Un Miembro cuya membresía esté dada de baja, o que nunca haya tenido una
membresía activa, NO SHALL poder recibir una nueva asignación de plantilla mientras dure esa
condición. Esta condición SHALL aplicar únicamente a asignaciones nuevas, incluida una
reasignación: una copia que el Miembro ya tenía SHALL conservarse intacta, sin borrarse ni
modificarse, cuando pierda la membresía activa.

#### Scenario: Rechazar la asignación a un Miembro con membresía dada de baja
- **WHEN** un Dueño intenta asignar una plantilla a un Miembro cuya membresía está dada de baja
- **THEN** el sistema rechaza la asignación y no crea ninguna copia

#### Scenario: Reactivar la membresía habilita nuevas asignaciones
- **WHEN** un Dueño reactiva la membresía de un Miembro que estaba dada de baja y luego le asigna
  una plantilla
- **THEN** el sistema permite la asignación y crea la copia correspondiente

#### Scenario: Dar de baja la membresía no quita las asignaciones existentes
- **WHEN** un Dueño da de baja la membresía de un Miembro que ya tenía una copia de "Fuerza 4
  días" asignada como Activa
- **THEN** esa copia se conserva intacta
- **THEN** al reactivarse la membresía de ese Miembro, vuelve a verla en "Mi rutina" — mientras la
  membresía está dada de baja, el Miembro no puede acceder a la aplicación por la regla de
  autenticación vigente (`backend/app/auth.py`, no modificada por este change), así que no llega a
  abrir "Mi rutina" en ese estado

### Requirement: Ver las plantillas asignadas de un cliente desde su ficha
La ficha de un Miembro SHALL mostrar todas sus copias de rutina asignadas con la plantilla de la
que se copiaron y su estado (Activa o Alternativa), y desde ahí un Dueño o Coach SHALL poder
asignarle una plantilla nueva, siguiendo el mismo patrón de acciones en la ficha del usuario que
el resto de las acciones sobre un Miembro (membresía, invitación).

#### Scenario: Ver el estado de las copias asignadas en la ficha
- **WHEN** un Coach abre la ficha de un Miembro que tiene una copia de "Fuerza 4 días" Activa y
  una copia de "Full body inicial" como Alternativa
- **THEN** ve ambas copias listadas, cada una con la plantilla de la que se originó y su estado
  correspondiente

## ADDED Requirements

### Requirement: Edición de la copia de un Miembro por Dueño o Coach
Un Dueño o Coach SHALL poder entrar a la copia de rutina de un Miembro y editarla — agregar o
quitar días, agregar o quitar ejercicios de un día, cambiar la estrategia de progresión o la base
(series × reps · kg) de un ejercicio — con el mismo alcance de edición que hoy existe para una
plantilla. El punto de entrada a esa edición SHALL ser la fila de esa copia entre las rutinas
asignadas de la ficha del Miembro, mediante el mismo icono de Editar que ya identifica esa acción
en el resto de la ficha. Editar la copia de un Miembro SHALL afectar únicamente a ese Miembro: NO
SHALL modificar la plantilla de la que se copió, ni ninguna otra copia de ningún otro Miembro,
incluso si esa otra copia se originó de la misma plantilla.

#### Scenario: Entrar a editar la copia desde la ficha del Miembro
- **WHEN** un Coach abre la ficha de un Miembro y usa el icono de Editar en la fila de una de sus
  copias de rutina asignadas
- **THEN** entra a la edición de esa copia (sus días, ejercicios, estrategias y bases), no a la
  edición de la plantilla de la que se originó

#### Scenario: Editar la copia de un Miembro no afecta a otro Miembro con la misma plantilla origen
- **WHEN** dos Miembros tienen cada uno una copia de "Fuerza 4 días", y un Coach le cambia a uno
  de ellos la base de "Sentadilla libre" en su copia
- **THEN** solo la copia de ese Miembro queda con la base cambiada
- **THEN** la copia del otro Miembro y la plantilla "Fuerza 4 días" original permanecen sin cambios

#### Scenario: Quitar un ejercicio de la copia de un Miembro con progreso ya registrado
- **WHEN** un Coach quita "Aperturas con mancuernas" de un día de la copia de un Miembro que ya
  tenía registros de progreso cargados para ese ejercicio
- **THEN** "Aperturas con mancuernas" deja de aparecer en el plan vigente de ese Miembro
- **THEN** los registros de progreso que ese Miembro ya había cargado para ese ejercicio se
  conservan intactos y siguen siendo consultables

## REMOVED Requirements

### Requirement: Ajuste de la base por cliente con autoría
**Reason**: queda redundante una vez que la asignación es una copia editable directamente por
Dueño o Coach. Mantener el ajuste de base por cliente además de la edición directa de la copia
suponía dos mecanismos superpuestos para el mismo resultado.

**Migration**: en vez de ajustar la base de un ejercicio para un cliente, un Dueño o Coach edita
directamente la base de ese ejercicio en la copia del Miembro (ver "Edición de la copia de un
Miembro por Dueño o Coach"). No hay backfill: los ajustes de base existentes en producción se
descartan junto con las asignaciones-referencia que reemplaza este change.
