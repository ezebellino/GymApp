## REMOVED Requirements

### Requirement: Header de marca consistente con login
**Reason**: La vista `/register-client` deja de existir. El alta de un Miembro y su acceso al
portal pasan a iniciarse siempre por un Dueño o Coach (ver `user-management`), que dispara una
invitación (ver `member-invitation`) en vez de que el propio cliente se auto-registre libremente.
**Migration**: No hay reemplazo en la misma ruta. El equivalente funcional es la pantalla pública
de invitación (`member-invitation`), a la que el miembro llega desde el link que recibe por email
o WhatsApp, no navegando libremente a una URL de registro.

### Requirement: Estilo de card consistente con login
**Reason**: Mismo motivo que el requirement anterior — la vista completa se retira.
**Migration**: La pantalla de invitación de `member-invitation` es la nueva superficie donde el
miembro completa su acceso; su estilo visual se define en el design/tasks de ese change.

### Requirement: Background plano compartido con login
**Reason**: Mismo motivo — la vista completa se retira.
**Migration**: N/A, no hay una vista equivalente en esta ruta.

### Requirement: Registro de cliente sin cambios funcionales
**Reason**: El endpoint `/auth/client-register` que esta vista consumía se retira: los miembros ya
no se auto-registran con un formulario abierto de nombre/email/password. El alta la hace un
Dueño/Coach y el acceso se completa a través del flujo de invitación de `member-invitation`, que
verifica email y celular antes de permitir definir una contraseña.
**Migration**: Cualquier integración o flujo que dependiera de `/auth/client-register` debe migrar
a que un Dueño/Coach cree el usuario (rol Miembro) y dispare su invitación.

### Requirement: Volver al login
**Reason**: Mismo motivo — la vista completa se retira.
**Migration**: N/A, no hay una vista equivalente en esta ruta.
