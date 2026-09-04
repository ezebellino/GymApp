## ADDED Requirements

### Requirement: Fuente única de verdad de la sesión
La app SHALL mantener una única fuente de verdad para la sesión del usuario (token de acceso,
nombre y rol). Todas las partes de la UI que dependen de la sesión —menú lateral, barra
superior, pie de página, guards de ruta y contenido de cada vista— SHALL leer de esa misma
fuente, de modo que nunca muestren información de sesión contradictoria entre sí.

#### Scenario: La UI muestra un solo rol de forma coherente
- **WHEN** un Coach inicia sesión y llega a su vista inicial
- **THEN** el menú lateral, la barra superior y el pie de página muestran el mismo usuario y el
  mismo rol
- **THEN** las opciones visibles y el contenido accesible corresponden a ese rol, sin necesidad
  de recargar la página para que coincidan

#### Scenario: Cambio de sesión sin recargar
- **WHEN** el usuario cierra sesión e inicia sesión con una cuenta de otro rol en la misma
  pestaña
- **THEN** toda la UI pasa a mostrar el usuario y el rol nuevos de inmediato
- **THEN** no quedan restos de la sesión anterior (nombre, rol ni opciones de menú del rol
  previo)

### Requirement: La sesión sobrevive a recargar la página
La sesión establecida SHALL persistir entre recargas y entre visitas a la app en la misma
pestaña o navegador. Al volver a abrir la app con sesión vigente, el usuario SHALL quedar
autenticado sin volver a ingresar credenciales.

#### Scenario: Recargar con sesión vigente
- **WHEN** un usuario autenticado recarga la página estando en `/payments`
- **THEN** sigue autenticado y ve la vista de pagos
- **THEN** no es redirigido a `/login`

#### Scenario: Volver a abrir la app
- **WHEN** el usuario cierra la pestaña y vuelve a abrir la app con la sesión aún vigente
- **THEN** entra directo a la vista correspondiente a su rol, sin pasar por el formulario de
  login

#### Scenario: Entrar sin sesión
- **WHEN** una persona sin sesión abre cualquier ruta protegida de la app
- **THEN** el sistema la redirige a `/login`

### Requirement: Autorización por rol basada en la sesión
Los guards de ruta SHALL decidir el acceso usando el rol de la sesión vigente. Un usuario con
rol de cliente SHALL NOT acceder a las vistas de gestión (Dashboard, Clientes, Pagos,
Asistencia, Ajustes), y SHALL ser llevado a su portal.

#### Scenario: Cliente intenta entrar a una vista de gestión
- **WHEN** un usuario con rol de cliente navega a `/clients`
- **THEN** el sistema lo redirige a su portal (`/my-routine`) sin mostrar la vista de gestión

#### Scenario: Ruta inicial según rol
- **WHEN** un usuario autenticado abre la raíz de la app (`/`)
- **THEN** un cliente llega a `/my-routine` y un Dueño o Coach llega a `/dashboard`

### Requirement: Las llamadas a la API usan la sesión vigente
Toda llamada del frontend a la API SHALL autenticarse con el token de la sesión vigente. Si no
hay sesión, la llamada SHALL enviarse sin credenciales en vez de usar un token de una sesión ya
cerrada.

#### Scenario: Petición autenticada
- **WHEN** un usuario autenticado abre una vista que pide datos al servidor
- **THEN** la petición viaja con las credenciales de la sesión vigente y el servidor responde
  con los datos de ese usuario

#### Scenario: Sin sesión no se reusa un token viejo
- **WHEN** el usuario cierra sesión y la app hace una llamada a la API
- **THEN** la llamada no lleva el token de la sesión cerrada

### Requirement: Cerrar sesión deja el estado limpio
Al cerrar sesión, el sistema SHALL borrar la sesión persistida, descartar los datos del servidor
que se habían cargado para ese usuario y llevar al usuario a `/login`. El cambio SHALL
propagarse a toda la UI de inmediato.

#### Scenario: Logout desde cualquier vista
- **WHEN** el usuario hace click en cerrar sesión
- **THEN** llega a `/login` y la UI ya no muestra su nombre ni su rol

#### Scenario: Después del logout no se puede volver atrás a datos privados
- **WHEN** el usuario cierra sesión y usa el botón "atrás" del navegador o escribe una ruta
  protegida
- **THEN** el sistema lo lleva a `/login` y no muestra los datos del usuario anterior

#### Scenario: Recargar después del logout
- **WHEN** el usuario cierra sesión y recarga la página
- **THEN** sigue sin sesión: ve el formulario de login y no vuelve a entrar automáticamente

### Requirement: La expiración del token cierra la sesión en toda la app
Cuando el servidor rechaza una llamada por token inválido o expirado, el sistema SHALL avisar al
usuario, limpiar la sesión con el mismo efecto que un cierre de sesión y llevarlo a `/login`.

#### Scenario: Token expirado durante el uso
- **WHEN** el usuario está en una vista de gestión y una llamada a la API es rechazada por
  sesión expirada
- **THEN** el sistema le informa que su sesión expiró y lo lleva a `/login`
- **THEN** al volver a iniciar sesión no quedan restos de la sesión anterior en la UI
