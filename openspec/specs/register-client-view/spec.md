## Purpose

Vista de auto-registro de cliente (`/register-client`): permite a un cliente crear su propio
acceso a Gym App, con el mismo tratamiento visual que la vista de login.

## Requirements

### Requirement: Header de marca consistente con login
La vista de registro de cliente SHALL mostrar el mismo header de marca que login: logo
(`/mini-espacio-logo.svg`) + nombre "Gym App", en lugar del eyebrow "Registro de cliente" y el
título "Crear acceso personal".

#### Scenario: Carga inicial de la vista
- **WHEN** el usuario navega a `/register-client`
- **THEN** ve el logo y el nombre "Gym App" en el header del formulario
- **THEN** no ve el eyebrow "Registro de cliente" ni el título "Crear acceso personal"

### Requirement: Estilo de card consistente con login
El card del formulario de registro SHALL usar el mismo ancho máximo (`max-w-lg`), el mismo fondo
sólido (`bg-zinc-900/95`) y estar libre de `shadow` con blur naranja y `backdrop-blur` que login.

#### Scenario: Ancho de card
- **WHEN** el usuario abre `/register-client`
- **THEN** el card del formulario tiene el mismo ancho máximo que el card de `/login`

### Requirement: Background plano compartido con login
La vista de registro SHALL heredar el mismo fondo plano (sin gradientes radiales ni vignette)
que login, al renderizarse dentro del mismo `<main>` de rutas de auth.

#### Scenario: Sin vignette en los bordes
- **WHEN** el usuario abre `/register-client` en cualquier viewport
- **THEN** el área alrededor del card no muestra glow ni gradiente radial visible

### Requirement: Registro de cliente sin cambios funcionales
El submit del formulario SHALL seguir registrando contra `/auth/client-register` con la misma
lógica de validación de contraseñas, guardado de sesión y redirección existente, sin importar el
rediseño de la UI.

#### Scenario: Registro exitoso
- **WHEN** el usuario completa el formulario con datos válidos y contraseñas coincidentes
- **THEN** el sistema crea la cuenta, guarda `access_token`, `user_name` y `user_role` en
  `localStorage`, y redirige a `/my-routine`

#### Scenario: Contraseñas no coinciden
- **WHEN** el usuario ingresa contraseñas distintas en los campos de contraseña y confirmación
- **THEN** el sistema muestra una alerta de error y no envía el formulario

### Requirement: Volver al login
El formulario SHALL mostrar un link/botón "Volver al login" que navega a `/login`.

#### Scenario: Navegar de vuelta
- **WHEN** el usuario hace click en "Volver al login"
- **THEN** el sistema navega a la ruta `/login`
