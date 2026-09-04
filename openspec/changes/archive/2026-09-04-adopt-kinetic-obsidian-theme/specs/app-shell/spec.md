## ADDED Requirements

### Requirement: Control de modo de tema alcanzable por cualquier rol
El shell autenticado SHALL mostrar un control simple de dos opciones (toggle o switch) para
alternar entre modo dark y modo light, visible y usable desde cualquier vista con sidebar,
independientemente del rol del usuario logueado (Dueño, Coach o cliente del portal en "Mi
rutina").

#### Scenario: El cliente del portal puede cambiar su modo
- **WHEN** un usuario con rol cliente ve su vista "Mi rutina"
- **THEN** encuentra el control de modo dark/light en el shell, sin necesidad de acceder a Ajustes
  (vista a la que no tiene acceso)

#### Scenario: El control refleja el modo actual
- **WHEN** el usuario ve el shell autenticado con un modo de tema ya elegido
- **THEN** el control muestra ese modo como seleccionado/activo, sin ambigüedad sobre cuál está
  activo

#### Scenario: Ajustes ya no tiene un control de tema
- **WHEN** el Dueño o el Coach navegan a `/settings`
- **THEN** no encuentran ahí un control para cambiar el modo de tema, porque vive en el shell y no
  en la configuración del negocio

### Requirement: Identidad del usuario logueado en el Sidebar
El Sidebar SHALL mostrar, debajo del nav principal, un badge corto de rol ("Vista {Dueño/Coach/
Usuario}") y, por separado, una card compacta con la identidad de la persona logueada: nombre y
email. Si el nombre o el email son demasiado largos para el ancho disponible, SHALL truncarse en
vez de romper el layout del Sidebar.

#### Scenario: Badge y card de identidad conviven como elementos separados
- **WHEN** cualquier usuario logueado (Dueño, Coach o cliente) ve el Sidebar
- **THEN** ve un badge corto con su rol y, debajo, una card distinta con su nombre y su email

#### Scenario: Nombre y email visibles
- **WHEN** el usuario ve la card de identidad del Sidebar
- **THEN** encuentra el nombre y el email de la cuenta con la que inició sesión

#### Scenario: Truncado de datos largos
- **WHEN** el nombre o el email del usuario logueado exceden el ancho disponible de la card
- **THEN** el texto se trunca visualmente en vez de desbordar o romper el layout del Sidebar

## MODIFIED Requirements

### Requirement: Sidebar sin sección de atajos
El sidebar SHALL NOT mostrar la sección "Atajos" (título "Atajos", descripción "Acciones de
operación diaria" y sus botones de acceso directo), que duplica navegación ya disponible en el
nav principal. El badge de rol y la card de identidad del usuario logueado (ver requirement
"Identidad del usuario logueado en el Sidebar") SHALL seguir mostrándose en su lugar.

#### Scenario: Sidebar de un Dueño
- **WHEN** un usuario con rol Dueño ve el sidebar
- **THEN** no ve un título "Atajos" ni botones como "Gestionar clientes" o "Buscar y seguir"
  duplicados fuera del nav principal
- **THEN** sigue viendo el badge de rol y la card de identidad del usuario logueado

#### Scenario: Sidebar de un Coach
- **WHEN** un usuario con rol Coach ve el sidebar
- **THEN** no ve un título "Atajos" ni botones como "Ir a rutinas" duplicados fuera del nav
  principal
