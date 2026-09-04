## Purpose

Shell autenticado de la aplicación (sidebar de navegación + `<main>` compartido) que envuelve
todas las vistas con sidebar: Dashboard, Clientes, Pagos, Asistencia, Rutinas, Mi rutina,
Reportes y Ajustes.

## Requirements

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

### Requirement: Scroll discreto en el sidebar
El sidebar SHALL permitir hacer scroll de su contenido cuando este exceda el alto visible del
viewport, sin mostrar de forma permanente una barra de scroll ancha o de color contrastante
sobre el fondo del sidebar.

#### Scenario: Contenido del sidebar excede el alto visible
- **WHEN** el contenido del sidebar (nav + bloque "Contexto") excede el alto visible del
  viewport
- **THEN** el usuario puede scrollear ese contenido
- **THEN** no aparece una barra de scroll ancha o de color sólido contrastante ocupando el
  borde del sidebar de forma permanente

#### Scenario: Contenido del sidebar entra completo en el viewport
- **WHEN** el contenido del sidebar entra completo dentro del alto visible del viewport
- **THEN** no se muestra ninguna barra de scroll en el sidebar

### Requirement: Layout de contenido unificado entre vistas autenticadas
El layout de contenido SHALL ser el mismo en todas las vistas del shell autenticado con sidebar
(Dashboard, Clientes, Pagos, Asistencia, Rutinas, Mi rutina, Reportes, Ajustes): mismo padding
horizontal, mismo padding vertical y mismo ancho máximo de contenido que la vista de Dashboard
(la referencia), sin que el padding quede duplicado por contenedores anidados.

#### Scenario: Padding equivalente entre Dashboard y otra vista
- **WHEN** el usuario navega de Dashboard a cualquier otra vista autenticada con sidebar (ej.
  Clientes, Pagos, Asistencia, Rutinas, Reportes o Ajustes)
- **THEN** el espacio entre el borde del contenido y el borde de la ventana (o del sidebar) es
  visualmente el mismo en ambas vistas, tanto en mobile como en desktop

#### Scenario: Sin padding duplicado
- **WHEN** se mide el padding efectivamente aplicado al contenido de cualquier vista autenticada
  con sidebar
- **THEN** el resultado es equivalente al de Dashboard, y no la suma de paddings aplicados por
  distintos contenedores anidados (el `<main>` compartido y el wrapper propio de la vista)

#### Scenario: Ancho máximo de contenido equivalente
- **WHEN** el usuario abre cualquier vista autenticada con sidebar en una pantalla ancha (ej.
  1440px o más)
- **THEN** el ancho máximo del área de contenido coincide con el de Dashboard, sin ser mayor ni
  menor
