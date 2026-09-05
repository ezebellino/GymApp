# Respuestas del Product Owner a `design.md`

Sin usuario disponible para consultar; decisiones tomadas con criterio de producto, priorizando
minimalismo y que todo entre sin scroll de página.

1. **Título duplicado**: se confirma el default del Arquitecto. El Topbar muestra "Usuarios"
   (nombre de sección/nav) y el encabezado de la página muestra un título propio, "Directorio de
   usuarios". Evita repetir el mismo texto a pocos píxeles sin agregar un tercer bloque solo con
   el total. Reflejado en `specs/user-management/spec.md` (requirement "Encabezado compacto de la
   vista Usuarios").
2. **Columna Contacto**: se confirma el default ya escrito en la spec: email si existe, si no
   teléfono, si no ninguno "-". Mostrar ambos a la vez agrega ancho e información redundante para
   una columna que solo necesita un canal de contacto rápido; no hace falta un texto largo como
   "Sin contacto" en una tabla ya compacta.
3. **Nombres de columnas**: se confirma el requirement MODIFIED "Listado de Usuarios" ya escrito
   — Nombre, Contacto, Rol, Alta, Inicio en el gimnasio, Acciones — que reemplaza los nombres
   viejos ("nombre completo", "fecha de comienzo en el gimnasio") y queda alineado con la UI.
4. **Alcance del Sidebar**: se acepta bajar la placa de marca de 86px a 64px (logo de 40px a
   36px). Un Topbar de 86px le devuelve altura de viewport a la vista y va en contra del pedido
   explícito de compactar; `proposal.md` (What Changes + Impact) queda actualizado para incluir
   `Sidebar.tsx` dentro del alcance.
5. **Ubicación del ícono de leyenda**: junto al título de la página, en el header (no en el
   encabezado de columna "Nombre"). El header es el punto de entrada natural a la vista y evita
   que el ícono compita visualmente con el resto de la fila de encabezados de la tabla.
6. **Leyenda en mobile**: el popover alcanza en todos los viewports, sin agregar un drawer/sheet
   alternativo. Un componente nuevo (`drawer.tsx`) para un contenido puramente informativo amplía
   alcance sin necesidad; se agregó un scenario explícito en la spec para dejarlo cerrado.
7. **Acción primaria en mobile**: pasa a icon-button solo con el ícono `+`, sin texto, en
   viewports menores a 768px. Es coherente con "más minimalista" y libera espacio horizontal en
   el encabezado de una sola fila en pantallas chicas; reflejado como scenario en la spec.

## Revisión del dueño (2026-09-05)

El dueño del producto revisó la implementación y pidió cinco cambios. Reemplazan las decisiones 1
y 4 de arriba; las decisiones 2, 3, 5, 6 y 7 quedan sin cambios.

1. **El Topbar no muestra el nombre de la sección** (reemplaza la decisión 1). Se elimina la
   cláusula y el scenario correspondientes del requirement "Alineación del Topbar con el
   contenedor de contenido" en `specs/app-shell/spec.md`. El slot izquierdo del Topbar queda sin
   ese contenido; el criterio de alineación de bordes se verifica igual, contra el contenedor
   interno del Topbar (no contra el nombre de sección, que ya no existe ahí).
2. **El encabezado de la vista Usuarios usa el título "Usuarios", sin descripción** (ajusta la
   consecuencia de la decisión 1: al no haber nombre de sección en el Topbar, no hace falta un
   título de página distinto para evitar duplicación). Se reescribe el requirement "Encabezado
   compacto de la vista Usuarios": título "Usuarios" + total + ícono de leyenda + acción
   primaria, sin texto descriptivo debajo.
3. **La tabla completa (con su encabezado de columnas) va dentro de una card** con borde y fondo
   de superficie Level 1. Le da al listado un límite visual claro, coherente con el resto de
   cards del shell, en vez de una tabla "flotando" directamente sobre el fondo de la página.
4. **El Sidebar no debe mostrar una línea divisoria horizontal a la altura del borde inferior del
   Topbar** (reemplaza la decisión 4: ya no se acepta el ajuste de altura de la placa de marca
   como forma de igualar alturas, porque el Topbar deja de necesitar esa igualdad). Esa línea
   continua era un artefacto visual de la implementación previa, no un requisito de diseño.
5. **La placa de marca del Sidebar necesita margen superior** respecto del borde del viewport
   (mismo gutter que el resto del Sidebar), en vez de quedar pegada al borde. Su borde inferior ya
   no necesita coincidir con el del Topbar — esa restricción se elimina del requirement de
   `app-shell`. El tamaño exacto de la placa de marca queda a criterio del Arquitecto.

### Corrección del punto 3 (2026-09-05)

6. **La card Level 1 contiene toda la sección de la vista, no solo la tabla** (corrige/reemplaza
   el punto 3 de arriba). Encabezado (título, total, ícono de leyenda, acción primaria), barra de
   filtros, tabla con su encabezado de columnas y pie de paginación van todos dentro de una única
   card. La tabla sigue con su scroll interno propio y encabezado de columnas fijo dentro de esa
   card. Da una única superficie visual coherente para toda la vista en vez de una card que
   quedaba solo alrededor de la tabla, con el encabezado y los filtros "sueltos" por fuera.

### Punto 7: pie y encabezado de columnas igual que Asistencias (2026-09-05)

7. **El pie de la tabla de Usuarios adopta la misma disposición que Asistencias** (rango
   "Mostrando X-Y de Z" a la izquierda, selector de tamaño de página y controles Anterior/página
   actual/total de páginas/Siguiente a la derecha, en la misma fila), en vez de ocultar el rango.
   El total del encabezado ("14 usuarios") se mantiene: es una redundancia aceptada, coherente con
   mostrar el mismo componente `Pagination` por defecto que ya usa Asistencias en vez de mantener
   una variante especial (`showRange={false}`) solo para esta vista. El encabezado de columnas de
   la tabla usa la misma tipografía que Asistencias (mayúsculas, tracking, bold, muted, sobre una
   banda de fondo más clara que la card) para que ambas vistas se sientan como el mismo patrón
   visual. Reflejado en `specs/user-management/spec.md` (requirement "Tabla de Usuarios con
   scroll interno, encabezado fijo y paginación única").

### Punto 8: registro del hallazgo 12 de `verification.md` (2026-09-05)

8. **El menú mobile del Topbar cambia de contenido al derivarse de `NAV_ITEMS`** (hallazgo 12 de
   `verification.md`, aceptado por el Arquitecto en la dec. 23 de `design.md`): pasa a mostrar
   "Seguimiento" en lugar de "Dashboard" y a usar el orden del Sidebar (Rutinas, Usuarios,
   Asistencias, Seguimiento, Pagos, Reportes, Ajustes). Se acepta como consecuencia correcta y
   buscada de tener una única fuente de navegación (`NAV_ITEMS`) compartida entre Sidebar y
   Topbar: el usuario ve la misma sección con el mismo nombre y el mismo orden relativo tanto en
   mobile como en desktop, en vez de dos taxonomías de navegación distintas mantenidas a mano. Se
   registra explícitamente en `proposal.md` (What Changes + Impact) y se agrega un requirement con
   scenario en `specs/app-shell/spec.md` ("Menú mobile del Topbar con la misma fuente de
   navegación que el Sidebar") porque es una consecuencia observable y verificable, no solo un
   detalle de implementación.

### Punto 9: encabezado compacto acotado a ≥640px (2026-09-05)

9. **El encabezado de una sola fila de la vista Usuarios se acota a viewports de 640px o más**
   (reserva del Code Reviewer sobre `specs/user-management/spec.md:43-46`, aceptada por el
   Arquitecto en la dec. 23 de `design.md`). Debajo de 640px la acción primaria puede pasar a una
   segunda fila en vez de forzar título + total + ícono de leyenda + botón en una única fila.
   Se toma la opción (a) recomendada: mantener una fila única en todos los viewports obligaría a
   un cambio de layout que hoy QA ya dio PASA, y acotar el requirement a ≥640px es coherente con
   "minimalista" y con que en <768px el botón de acción primaria ya pasa a ser solo ícono (punto 7
   de la revisión original). Reflejado en `specs/user-management/spec.md` (requirement
   "Encabezado compacto de la vista Usuarios", nuevo scenario "Encabezado en dos filas debajo de
   640px").
