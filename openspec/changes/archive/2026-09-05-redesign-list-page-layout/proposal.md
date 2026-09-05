## Why

El Topbar no comparte los bordes del contenido de `main`, por lo que la búsqueda global y el
toggle de tema quedan desalineados con el resto de la vista, y su altura no coincide con la
placa de marca del Sidebar. Además, la vista Usuarios reutiliza el hero de bienvenida pensado
para el Dashboard y dedica una card entera a la leyenda de roles/estados, dos bloques que no
aportan información nueva y empujan la tabla fuera del viewport: en una pantalla de 1440x900 solo
entran ~4 filas antes de tener que scrollear, y la paginación aparece duplicada. El dueño del
producto no está conforme con este diseño y pide una vista de listado más compacta donde todos
los componentes entren sin scroll de página.

## What Changes

- Alinear el Topbar con el contenedor de contenido de `main`: mismos bordes izquierdo/derecho. El
  Topbar NO muestra el nombre de la sección actual (decisión del dueño del producto, ver
  "Revisión del dueño" en `po-answers.md`); `lib/navigation.ts` puede seguir siendo la fuente
  única de `NAV_ITEMS` aunque el Topbar no muestre título — lo decide el Arquitecto.
- El menú mobile del Topbar pasa a derivarse de `NAV_ITEMS` (la misma fuente única que usa el
  Sidebar), filtrado por rol. Como consecuencia visible, cambia el label "Dashboard" por
  "Seguimiento" y el orden pasa a ser el del Sidebar (Rutinas, Usuarios, Asistencias, Seguimiento,
  Pagos, Reportes, Ajustes), dejando mobile y desktop coherentes entre sí.
- El Sidebar deja de mostrar una línea divisoria horizontal a la altura del borde inferior del
  Topbar, y su placa de marca gana un margen superior visible (mismo gutter que el resto del
  Sidebar) en vez de quedar pegada al borde del viewport; su borde inferior ya no necesita
  coincidir con el del Topbar.
- Definir y documentar en `docs/design/design.md` un patrón único de "list page" para vistas de
  listado con tabla: encabezado compacto de una sola fila (título + total + ícono de leyenda +
  acción primaria, sin descripción), barra de filtros, tabla que ocupa el alto restante con
  scroll interno propio y encabezado de columnas fijo, y un único pie de paginación — todo
  contenido dentro de una única card. Sin hero con aura y sin card de leyenda separada.
- **BREAKING** (solo de comportamiento de UI, no de API): la vista Usuarios (`Users.tsx`) deja de
  usar el "Operational Hero Greeting Card" y adopta el patrón "list page":
  - la leyenda de roles y estados de membresía deja de ser una card visible por defecto y pasa a
    un popover que se abre desde un ícono de información junto al título;
  - el título del encabezado de la página es "Usuarios" (igual al nombre de la sección, ya que el
    Topbar no lo muestra) y NO lleva un texto descriptivo debajo;
  - el filtro de búsqueda deja el label en mayúsculas ("BUSCAR") sobre el input;
  - la fila de la tabla ya no muestra el UUID del usuario como segunda línea;
  - las columnas quedan: Nombre (con indicador de estado), Contacto (email o teléfono), Rol,
    Alta, Inicio en el gimnasio, Acciones;
  - toda la sección de la vista (encabezado, barra de filtros, tabla con su encabezado de
    columnas y pie de paginación) queda contenida en una única card con borde y fondo de
    superficie (Level 1);
  - el pie de la tabla vuelve a mostrar el texto de rango ("Mostrando X-Y de Z") a la izquierda,
    junto con el selector de tamaño de página y los controles de navegación a la derecha, igual
    que en Asistencias (el total de usuarios del encabezado se mantiene igual, como redundancia
    aceptada);
  - el encabezado de columnas de la tabla usa la misma tipografía que Asistencias: mayúsculas con
    tracking, bold, color muted, sobre una banda de fondo más clara que la card;
  - las acciones por fila (Ver, Editar, WhatsApp) pasan de botones con texto a botones de ícono
    accesibles (con `aria-label`); WhatsApp queda deshabilitado cuando el usuario no tiene
    teléfono cargado;
  - en viewports menores a 768px, la acción primaria de alta se muestra solo con ícono, sin
    texto, para no comprometer el layout compacto;
  - se conservan los estados de skeleton, error y vacío ya existentes.
- Registrar como criterio para futuros changes que Pagos y Asistencias (hoy vaciadas para
  reimplementar, ver commits recientes en el historial) deben adoptar el mismo patrón "list
  page" cuando se reimplementen. No se reimplementan en este change.

Fuera de alcance: backend, cambios de datos o de contrato de API, Dashboard (conserva su hero con
aura), portal de miembro, y el comportamiento de apertura/cierre del mobile drawer del Sidebar. El
contenido del menú mobile del Topbar sí cambia como consecuencia deliberada de derivarse de
`NAV_ITEMS`: ver la viñeta correspondiente en What Changes. El Sidebar sigue dentro de alcance
para dos ajustes puntuales:
quitar la línea divisoria horizontal a la altura del borde inferior del Topbar y agregar margen
superior a la placa de marca (mismo gutter que el resto del Sidebar); el tamaño exacto de la
placa de marca queda a criterio del Arquitecto, ya no atado a igualar la altura del Topbar (ver
"Revisión del dueño" en `po-answers.md`).

## Capabilities

### New Capabilities
(ninguna — este change modifica capabilities existentes, no introduce una nueva)

### Modified Capabilities
- `app-shell`: agrega el requirement de alineación del Topbar con el contenedor de contenido
  (bordes izquierdo/derecho; sin nombre de sección en el Topbar), el requisito de que el Sidebar
  no muestre línea divisoria a la altura del Topbar y de que su placa de marca tenga margen
  superior, y el requisito de que el menú mobile del Topbar derive de la misma fuente de
  navegación (`NAV_ITEMS`) que el Sidebar.
- `user-management`: reemplaza los requirements de layout de la vista Usuarios (hero de
  bienvenida, card de leyenda, columnas de la tabla, UUID visible, acciones con texto) por los
  del patrón "list page" (encabezado compacto con título "Usuarios" sin descripción, leyenda en
  popover, columnas y acciones nuevas, toda la vista contenida en una única card).

## Impact

- `frontend/src/components/Topbar.tsx`, `frontend/src/App.jsx` (alineación de bordes con el
  contenedor de `main`; el Topbar ya no muestra el nombre de la sección actual; el menú mobile
  pasa a derivarse de `NAV_ITEMS`, cambiando "Dashboard" por "Seguimiento" y el orden de las
  secciones al del Sidebar).
- `frontend/src/components/Sidebar.tsx`: quita la línea divisoria horizontal a la altura del
  borde inferior del Topbar y agrega margen superior a la placa de marca (mismo gutter que el
  resto del Sidebar); ya no necesita igualar su altura con la del Topbar.
- `frontend/src/pages/Users.tsx` y sus tests (`frontend/src/pages/__tests__/Users.test.tsx`): la
  leyenda pasa a estar dentro de un popover, el encabezado usa el título "Usuarios" sin
  descripción, cambian las columnas de la tabla y las acciones por fila, y toda la sección
  (encabezado, filtros, tabla y paginación) queda contenida en una única card.
- `docs/design/design.md`: nueva sección documentando el patrón "list page" como componente
  reutilizable, distinto del "Operational Hero Greeting Card" (que queda reservado para
  Dashboard).
- No afecta `backend/app/`, migraciones, ni el portal de miembro (`Mi rutina`).
- Criterios de éxito observables: en 1440x900 con 10 filas de usuarios, la tabla y su paginación
  entran sin scroll de página; el Topbar queda alineado con el contenido en viewports ≥1280px;
  el contraste cumple AA en modo dark y light; los tests de `Users.test.tsx` pasan o quedan
  actualizados para reflejar la leyenda dentro del popover.
