## MODIFIED Requirements

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
