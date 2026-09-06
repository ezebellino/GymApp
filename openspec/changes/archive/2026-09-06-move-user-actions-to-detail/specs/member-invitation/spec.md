## ADDED Requirements

### Requirement: Acción de invitar desde la ficha en modal
La acción de disparar o reenviar la invitación al portal SHALL vivir dentro de un modal, abierto
desde la card "Invitación al portal" de la ficha del usuario, en vez de mostrarse inline en un
formulario de edición. Al confirmar la invitación dentro del modal, este SHALL mostrar el
resultado: el link de email (con acción de copiar) y el link de WhatsApp prellenado, siguiendo el
mismo comportamiento ya especificado en "Entrega del link por email y WhatsApp". El botón de
WhatsApp SHALL mostrarse deshabilitado cuando el usuario no tiene celular cargado. Cuando faltan
los datos de contacto necesarios (email o celular), el modal SHALL mostrar el error de precondición
ya especificado en "Entrega del link por email y WhatsApp" en vez de generar la invitación. Cuando
el acceso del miembro ya está activo, la card SHALL NOT ofrecer esta acción.

#### Scenario: Abrir el modal de invitación
- **WHEN** un Dueño o Coach hace click en "Invitar" (o "Reenviar invitación") en la card
  Invitación al portal de la ficha de un Miembro
- **THEN** se abre un modal para disparar o reenviar la invitación

#### Scenario: Ver el link de email con acción de copiar
- **WHEN** el admin confirma la invitación dentro del modal para un miembro con email y celular
  cargados
- **THEN** el modal muestra el link de invitación enviado por email junto con una acción para
  copiarlo

#### Scenario: WhatsApp deshabilitado sin teléfono
- **WHEN** el modal de invitación se abre para un miembro sin celular cargado
- **THEN** el botón para compartir el link por WhatsApp se muestra deshabilitado

#### Scenario: Error por falta de datos de contacto
- **WHEN** el admin intenta confirmar la invitación de un miembro sin celular cargado
- **THEN** el modal muestra el error indicando que hace falta cargar el celular, sin generar la
  invitación

#### Scenario: Sin acción cuando el acceso ya está activo
- **WHEN** un Dueño o Coach ve la card Invitación al portal de un Miembro cuyo acceso ya está
  activo
- **THEN** no encuentra la acción de invitar ni de reenviar, dentro ni fuera de un modal

#### Scenario: Verificación manual reduce lo que falta para definir contraseña
- **WHEN** un Miembro con invitación pendiente ya verificó su celular abriendo el link recibido por
  WhatsApp, y luego un Dueño confirma "Verificar contacto" para ese miembro
- **THEN** el sistema marca el email como verificado en la invitación (el celular ya lo estaba y
  queda sin cambios)
- **THEN** el miembro puede definir su contraseña, porque ambos canales ya cuentan como verificados
  en la invitación

#### Scenario: Cerrar el modal sin reenviar hace perder de vista el link
- **WHEN** el admin cierra el modal de invitación después de generar el link
- **THEN** el link deja de estar visible en la ficha
- **THEN** para volver a verlo hace falta reenviar la invitación, lo que genera un link nuevo
