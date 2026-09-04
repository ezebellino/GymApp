## Purpose

Vista de login (`/login`): formulario minimalista de acceso (usuario + contraseña) para
propietarios, coaches y clientes de Gym App, sin panel de marketing ni mensajería de estado
verbosa.

## Requirements

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
la UI. Un login exitoso SHALL dejar establecida la sesión del usuario (ver capability
`session-state`): el usuario queda autenticado, su rol queda disponible para toda la app y la
sesión sobrevive a recargar la página.

#### Scenario: Login exitoso
- **WHEN** el usuario ingresa usuario y contraseña válidos y confirma
- **THEN** el sistema lo autentica y lo redirige a `/`, desde donde llega a la vista que
  corresponde a su rol
- **THEN** la UI muestra su nombre y su rol, y las llamadas a la API se hacen como ese usuario

#### Scenario: La sesión sobrevive al refresh
- **WHEN** el usuario recarga la página después de un login exitoso
- **THEN** sigue autenticado y ve la vista correspondiente a su rol
- **THEN** no vuelve al formulario de login ni tiene que ingresar credenciales de nuevo

#### Scenario: Credenciales inválidas
- **WHEN** el usuario ingresa usuario o contraseña inválidos
- **THEN** el sistema muestra un toast de error ("Credenciales invalidas", ver capability
  `toast-notifications`) sin redirigir ni bloquear el formulario
- **THEN** no queda ninguna sesión establecida: al recargar sigue viendo el formulario de login

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

### Requirement: Contraste legible en los campos de usuario y contraseña
Los campos "Usuario" y "Contraseña" del formulario de login SHALL mostrar su texto con
contraste suficiente para ser legible sobre el fondo del input, en todos sus estados: vacío, con
texto tipeado manualmente, con foco, y con autocompletado del navegador (incluyendo sugerencias
ofrecidas por un gestor de contraseñas).

#### Scenario: Texto tipeado manualmente
- **WHEN** el usuario tipea su nombre de usuario en el campo "Usuario"
- **THEN** el texto se muestra con contraste suficiente para leerse claramente sobre el fondo
  del input (no texto oscuro sobre fondo oscuro)

#### Scenario: Campo con foco antes de tipear
- **WHEN** el usuario hace foco en el campo "Usuario" o "Contraseña" sin haber tipeado nada
  todavía
- **THEN** el input mantiene contraste suficiente entre su fondo y su contenido (placeholder o
  texto), sin cambiar a un color que dificulte la lectura

#### Scenario: Autocompletado del navegador o gestor de contraseñas
- **WHEN** el navegador autocompleta el campo "Usuario" o "Contraseña" (por historial de
  autocompletado o por un gestor de contraseñas) y el usuario selecciona una sugerencia
- **THEN** el valor autocompletado se muestra con el mismo contraste legible que el texto
  tipeado manualmente, en cualquier estado de foco
