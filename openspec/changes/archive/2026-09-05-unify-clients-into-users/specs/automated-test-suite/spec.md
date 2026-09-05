## MODIFIED Requirements

### Requirement: Smoke de autenticación del backend
La suite de backend SHALL cubrir el camino feliz de autenticación de punta a punta contra la API:
login con las credenciales de una cuenta ya existente (creada como parte de la preparación del
test, no vía auto-registro) y consulta de la identidad autenticada con el token obtenido. El
auto-registro (`POST /auth/client-register`) ya no existe en este change — ver capability
`register-client-view` de este mismo change — y por lo tanto deja de ser parte de este smoke.

#### Scenario: Login con credenciales válidas
- **WHEN** el test hace `POST /auth/token` con el email y la contraseña de una cuenta existente
- **THEN** la respuesta es exitosa e incluye un `access_token` de tipo `bearer`

#### Scenario: Login con contraseña incorrecta
- **WHEN** el test hace `POST /auth/token` con un email existente y una contraseña equivocada
- **THEN** la API responde con error de credenciales y no devuelve ningún token

#### Scenario: Endpoint protegido con token válido
- **WHEN** el test consulta `GET /auth/me` enviando el token obtenido en el login
- **THEN** la API responde exitosamente con los datos del usuario autenticado, incluido su rol

### Requirement: Test de render por cada vista con spec
La suite de frontend SHALL incluir al menos un test de render por cada vista que hoy tiene una
capability en `openspec/specs/`: `login-view`, `dashboard-view` y `settings-view`. La vista
`register-client-view` deja de tener test de render porque su ruta se retira en este change (ver
capability `register-client-view` de este mismo change). Cada test MUST afirmar elementos que la
spec de esa vista promete que se ven y, cuando la spec lo declara explícitamente, que los
elementos eliminados no aparecen.

#### Scenario: Render de la vista de login
- **WHEN** el test renderiza la vista `/login`
- **THEN** encuentra el nombre de marca "Gym App", el campo "Usuario", el campo "Contraseña" y el
  botón "Entrar"
- **THEN** no encuentra banner de demo, contador de conexión, aviso de reactivación de backend, ni
  ningún link de registro de cuenta

#### Scenario: Render de la vista de dashboard
- **WHEN** el test renderiza la vista `/dashboard`
- **THEN** encuentra las cards de KPI "Clientes activos", "Rutina base" y "Check-ins de hoy"
- **THEN** no encuentra una sección titulada "Alertas de negocio"

#### Scenario: Render de la vista de ajustes
- **WHEN** el test renderiza la vista `/settings`
- **THEN** encuentra los formularios de configuración del negocio y la card "Vista previa del
  negocio" con su botón "Ver recordatorio en WhatsApp"
- **THEN** no encuentra las InfoCard "Identidad y contacto", "Cobranza operativa" ni "Recordatorio
  mensual", ni la card "Contexto operativo"
