## ADDED Requirements

### Requirement: Disparo de invitación por admin/coach
Un Dueño o Coach SHALL poder disparar, desde la ficha de un usuario con rol Miembro que todavía
no tiene acceso de login al portal, una invitación que genera un link único de registro para esa
persona.

#### Scenario: Invitar a un miembro recién creado
- **WHEN** un Coach da de alta un usuario con rol Miembro y luego dispara "Invitar" desde su
  ficha
- **THEN** el sistema genera un link único de invitación asociado a ese usuario

#### Scenario: Invitación no disponible para Dueños ni Coaches
- **WHEN** un Dueño ve la ficha de un usuario con rol Dueño o Coach
- **THEN** no encuentra la acción de invitar a portal (ese flujo es exclusivo de usuarios con rol
  Miembro)

#### Scenario: Miembro que ya tiene acceso
- **WHEN** un Dueño o Coach ve la ficha de un Miembro que ya completó su invitación y tiene acceso
  al portal
- **THEN** no encuentra la acción de invitar, y en su lugar ve que el acceso ya está activo

### Requirement: Entrega del link por email y WhatsApp
Al disparar una invitación, el sistema SHALL enviar el link de registro por email al miembro, y
SHALL generar un link de WhatsApp (`wa.me`) prellenado con ese mismo link de invitación usando el
celular cargado del miembro, para que el admin/coach lo envíe manualmente desde su propio
WhatsApp — el mismo patrón ya usado hoy para los recordatorios de pago. El envío por WhatsApp NO
SHALL depender de ninguna integración con una API de WhatsApp Business ni ser un envío automático
del sistema. Si el miembro no tiene celular cargado, el sistema SHALL impedir disparar la
invitación hasta que se cargue uno.

#### Scenario: Invitación con ambos datos de contacto
- **WHEN** un miembro tiene email y celular cargados y el admin dispara la invitación
- **THEN** el sistema envía el email con el link de invitación
- **THEN** el sistema le ofrece al admin un link `wa.me` prellenado con el mismo link, para que lo
  envíe manualmente por WhatsApp

#### Scenario: Falta el celular
- **WHEN** un admin intenta invitar a un miembro que no tiene celular cargado
- **THEN** el sistema rechaza la acción e indica que hace falta cargar el celular primero

### Requirement: Verificación independiente de email y celular
El sistema SHALL verificar el email y el celular del miembro de forma independiente: abrir el
link recibido por email SHALL marcar el email como verificado; abrir/confirmar el link recibido
por WhatsApp SHALL marcar el celular como verificado. El miembro SHALL poder definir su
contraseña recién cuando ambos canales estén verificados.

#### Scenario: Verificación de email
- **WHEN** el miembro abre el link de invitación recibido por email
- **THEN** el sistema marca su email como verificado
- **THEN** el celular sigue sin verificar hasta que complete ese canal por separado

#### Scenario: Verificación de celular
- **WHEN** el miembro abre/confirma el link de invitación recibido por WhatsApp
- **THEN** el sistema marca su celular como verificado

#### Scenario: Definir contraseña con ambos canales verificados
- **WHEN** el miembro completó la verificación de email y de celular
- **THEN** el sistema le permite definir su contraseña y finalizar el registro

#### Scenario: Intento de definir contraseña con verificación incompleta
- **WHEN** el miembro intenta definir su contraseña habiendo verificado un solo canal
- **THEN** el sistema rechaza la acción e indica qué canal falta verificar

### Requirement: Login bloqueado hasta completar la invitación
El sistema SHALL NOT permitir iniciar sesión a un miembro invitado que todavía no completó la
verificación de ambos canales y la definición de su contraseña. Completar la invitación habilita
el login solo mientras la membresía del miembro siga activa: si más adelante un Dueño o Coach da
de baja su membresía, el acceso vuelve a bloquearse (ver `user-management`, "Estado de membresía,
fecha de baja y bloqueo de acceso") aunque la invitación ya esté verificada.

#### Scenario: Intento de login con invitación pendiente
- **WHEN** alguien intenta iniciar sesión con el email de un miembro cuya invitación está
  pendiente de completar
- **THEN** el sistema rechaza el login e informa que la invitación está pendiente de completar

#### Scenario: Baja posterior bloquea a un miembro que ya había completado la invitación
- **WHEN** un miembro completó su invitación (contraseña definida, email y celular verificados) y
  luego un Dueño da de baja su membresía
- **THEN** ese miembro ya no puede iniciar sesión, aunque su invitación siga marcada como
  completada

### Requirement: Expiración y reenvío del link de invitación
El link de invitación SHALL expirar 7 días después de generado. Un Dueño o Coach SHALL poder
reenviar la invitación en cualquier momento, lo que invalida el link anterior y genera uno nuevo.

#### Scenario: Link vencido
- **WHEN** el miembro abre un link de invitación generado hace más de 7 días
- **THEN** el sistema le informa que el link expiró y no lo deja continuar con el registro

#### Scenario: Reenvío invalida el link anterior
- **WHEN** un admin reenvía la invitación de un miembro que ya tenía un link generado
- **THEN** el link anterior deja de ser válido
- **THEN** se entrega un nuevo link por email y WhatsApp

### Requirement: Estado de invitación visible en la ficha del usuario
La ficha de un usuario con rol Miembro SHALL mostrar el estado de su invitación: sin invitar,
invitada (pendiente de verificación), o acceso activo.

#### Scenario: Estado pendiente
- **WHEN** un admin ve la ficha de un miembro que recibió la invitación pero no la completó
- **THEN** ve el estado "Invitación pendiente" junto con la opción de reenviar
