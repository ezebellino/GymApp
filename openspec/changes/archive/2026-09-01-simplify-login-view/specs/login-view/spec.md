## ADDED Requirements

### Requirement: Formulario de login minimalista
La vista de login SHALL mostrar únicamente: logo + nombre de marca "Gym App", campo de usuario,
campo de contraseña, botón de submit y un link a registro de cuenta. No SHALL incluir panel de
marketing, banners de demo, ni mensajes de estado sobre el backend.

#### Scenario: Carga inicial de la vista
- **WHEN** el usuario navega a `/login`
- **THEN** ve el logo, el nombre "Gym App", el campo "Usuario", el campo "Contraseña", el
  botón "Entrar" y el link "Registrar cuenta"
- **THEN** no ve texto de marketing, contador de conexión, aviso de reactivación de backend ni
  banner de demo

#### Scenario: Toggle de visibilidad de contraseña
- **WHEN** el usuario hace click en el ícono de mostrar/ocultar contraseña
- **THEN** el campo de contraseña alterna entre tipo `password` y `text`

### Requirement: Autenticación sin cambios funcionales
El submit del formulario SHALL seguir autenticando contra `/auth/token` con la misma lógica de
retry por timeout y resolución de nombre/rol de usuario existente, sin importar el rediseño de
la UI.

#### Scenario: Login exitoso
- **WHEN** el usuario ingresa usuario y contraseña válidos y confirma
- **THEN** el sistema obtiene el token, guarda `access_token`, `user_name` y `user_role` en
  `localStorage`, y redirige a `/`

#### Scenario: Credenciales inválidas
- **WHEN** el usuario ingresa usuario o contraseña inválidos
- **THEN** el sistema muestra una alerta de error ("Credenciales invalidas") sin redirigir

### Requirement: Link a registro de cuenta
El formulario SHALL mostrar un link con el texto "Registrar cuenta" que navega a
`/register-client`.

#### Scenario: Navegar a registro
- **WHEN** el usuario hace click en "Registrar cuenta"
- **THEN** el sistema navega a la ruta `/register-client`

### Requirement: Diseño responsive
La vista de login SHALL adaptarse correctamente a viewports mobile y desktop usando un único
layout centrado, sin depender de un panel adicional que solo aparece en desktop.

#### Scenario: Vista en mobile
- **WHEN** el usuario abre `/login` en un viewport angosto (ej. 375px)
- **THEN** el formulario se muestra completo, centrado y sin overflow horizontal

#### Scenario: Vista en desktop
- **WHEN** el usuario abre `/login` en un viewport ancho (ej. 1440px)
- **THEN** el formulario se muestra centrado, sin panel de marketing adicional

### Requirement: Background plano
La vista de login SHALL mostrar un fondo plano sin gradientes radiales, vignette ni efectos de
blur decorativos, tanto en el `<main>` que la envuelve como en el card del formulario.

#### Scenario: Sin vignette en los bordes
- **WHEN** el usuario abre `/login` en cualquier viewport
- **THEN** el área alrededor del card no muestra glow ni gradiente radial visible
