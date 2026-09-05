## ADDED Requirements

### Requirement: Alineación del Topbar con el contenedor de contenido
El Topbar SHALL alinear sus bordes izquierdo y derecho con los del contenedor de contenido de
`<main>` en viewports de escritorio (1280px o más). El Sidebar SHALL NOT mostrar una línea
divisoria horizontal a la altura del borde inferior del Topbar.

#### Scenario: Bordes alineados con el contenido en desktop
- **WHEN** el usuario ve el shell autenticado en un viewport de 1280px de ancho o más
- **THEN** el borde derecho del toggle de tema coincide con el borde derecho del contenido de
  `<main>`
- **THEN** el contenedor interno del Topbar tiene los mismos bordes izquierdo y derecho que el
  contenedor de contenido de `<main>`

#### Scenario: Sin línea divisoria continua entre el Sidebar y el Topbar
- **WHEN** el usuario ve el shell autenticado
- **THEN** el Sidebar no muestra una línea divisoria horizontal a la altura del borde inferior
  del Topbar

#### Scenario: Placa de marca del Sidebar con margen superior
- **WHEN** el usuario ve el Sidebar en el shell autenticado
- **THEN** la placa de marca tiene un margen superior visible respecto del borde superior del
  viewport, equivalente al gutter usado en el resto del Sidebar
- **THEN** el borde inferior de la placa de marca no necesita coincidir con el borde inferior del
  Topbar

### Requirement: Menú mobile del Topbar con la misma fuente de navegación que el Sidebar
El menú mobile del Topbar SHALL mostrar las mismas secciones y en el mismo orden que el nav
principal del Sidebar, filtradas por el rol del usuario logueado, en vez de una lista propia
independiente.

#### Scenario: Mismas secciones y mismo orden que el Sidebar
- **WHEN** un usuario abre el menú mobile del Topbar
- **THEN** ve las mismas secciones de navegación que vería en el Sidebar en desktop, en el mismo
  orden, filtradas según su rol
