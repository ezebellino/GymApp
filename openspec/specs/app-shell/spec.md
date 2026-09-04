## Purpose

Shell autenticado de la aplicación (sidebar de navegación + `<main>` compartido) que envuelve
todas las vistas con sidebar: Dashboard, Clientes, Pagos, Asistencia, Rutinas, Mi rutina,
Reportes y Ajustes.

## Requirements

### Requirement: Sidebar sin sección de atajos
El sidebar SHALL NOT mostrar la sección "Atajos" (título "Atajos", descripción "Acciones de
operación diaria" y sus botones de acceso directo), que duplica navegación ya disponible en el
nav principal. El bloque "Contexto" (selector de vista Dueño/Coach) SHALL seguir mostrándose.

#### Scenario: Sidebar de un Dueño
- **WHEN** un usuario con rol Dueño ve el sidebar
- **THEN** no ve un título "Atajos" ni botones como "Gestionar clientes" o "Buscar y seguir"
  duplicados fuera del nav principal
- **THEN** sigue viendo el bloque "Contexto" con el selector de vista Dueño/Coach

#### Scenario: Sidebar de un Coach
- **WHEN** un usuario con rol Coach ve el sidebar
- **THEN** no ve un título "Atajos" ni botones como "Ir a rutinas" duplicados fuera del nav
  principal

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
