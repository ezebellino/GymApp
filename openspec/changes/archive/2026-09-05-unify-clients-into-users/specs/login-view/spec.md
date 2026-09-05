## MODIFIED Requirements

### Requirement: Formulario de login minimalista
La vista de login SHALL mostrar únicamente: logo + nombre de marca "Gym App", campo de usuario,
campo de contraseña y botón de submit. No SHALL incluir panel de marketing, banners de demo,
mensajes de estado sobre el backend, ni ningún link de auto-registro — el alta de un usuario
nuevo (Dueño, Coach o Miembro) siempre la inicia un admin/Coach desde la gestión de Usuarios; ya
no existe una ruta pública de registro a la que enlazar (ver capability `member-invitation` de
este change).

#### Scenario: Carga inicial de la vista
- **WHEN** el usuario navega a `/login`
- **THEN** ve el logo, el nombre "Gym App", el campo "Usuario", el campo "Contraseña" y el botón
  "Entrar"
- **THEN** no ve texto de marketing, contador de conexión, aviso de reactivación de backend,
  banner de demo, ni ningún link de registro de cuenta

#### Scenario: Toggle de visibilidad de contraseña
- **WHEN** el usuario hace click en el ícono de mostrar/ocultar contraseña
- **THEN** el campo de contraseña alterna entre tipo `password` y `text`

## REMOVED Requirements

### Requirement: Link a registro de cuenta
**Reason**: Este change retira el auto-registro libre de cliente (`/register-client`,
`/auth/client-register` — ver capability `register-client-view` de este mismo change). El alta
de un Miembro ahora la inicia siempre un Dueño/Coach, que dispara una invitación personalizada
(ver `member-invitation`); no hay una ruta de registro genérica a la que un link de login pueda
apuntar.
**Migration**: Ningún link reemplaza a este en `/login`. Un usuario que llega sin invitación no
tiene forma de auto-registrarse; debe pedirle al gimnasio que lo dé de alta.
