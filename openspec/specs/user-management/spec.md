## Purpose

Modelo unificado de Usuarios: toda persona que interactúa con la plataforma (Dueño, Coach,
Miembro) es un único registro con un rol. Ser "miembro del gimnasio" (con rutinas, asistencia y
pagos) es un atributo funcional aparte del rol — un Dueño o Coach puede además marcarse como
miembro si también entrena, sin perder su rol ni sus permisos administrativos. Cubre el perfil de
datos personales, el estado de membresía/baja y su bloqueo de acceso scopeado por rol, el listado
único de Usuarios, los permisos de gestión por rol, y que no existe eliminación física de
usuarios.

## Requirements

### Requirement: Registro único por persona con un rol
El sistema SHALL representar a toda persona que interactúa con la plataforma (Dueño, Coach,
Miembro) con un único registro de Usuario, identificado por un rol (Dueño, Coach o Miembro). No
SHALL existir más de un registro para la misma persona.

#### Scenario: Un coach que también entrena en el gimnasio
- **WHEN** un Coach existente también entrena en el gimnasio y el Dueño lo marca como miembro
- **THEN** el sistema sigue teniendo un único registro de Usuario para esa persona, con rol Coach
  y con el atributo de miembro activado
- **THEN** esa persona conserva sus permisos de Coach sin cambios

#### Scenario: Alta de un miembro nuevo
- **WHEN** un Dueño o Coach da de alta a una persona nueva con rol Miembro
- **THEN** el sistema crea un único registro de Usuario con ese rol

### Requirement: Perfil de datos personales del usuario
El sistema SHALL permitir registrar por usuario: nombre, apellido, fecha de nacimiento, peso,
altura, email y número de celular. La edad SHALL derivarse de la fecha de nacimiento cuando esté
cargada, en vez de almacenarse como un dato independiente.

#### Scenario: Alta con datos mínimos
- **WHEN** un Dueño o Coach da de alta un usuario indicando solo nombre, apellido y rol
- **THEN** el sistema crea el registro y deja el resto de los campos de perfil (fecha de
  nacimiento, peso, altura, email, celular) sin completar, editables después

#### Scenario: Edad derivada de la fecha de nacimiento
- **WHEN** un usuario tiene cargada su fecha de nacimiento
- **THEN** el sistema muestra su edad calculada a partir de esa fecha, sin requerir un campo de
  edad separado

#### Scenario: Sin fecha de nacimiento cargada
- **WHEN** un usuario no tiene cargada su fecha de nacimiento
- **THEN** el sistema no muestra una edad para ese usuario, en vez de mostrar un valor inconsistente

### Requirement: Estado de membresía, fecha de baja y bloqueo de acceso (según rol)
El sistema SHALL mantener el estado de membresía/suscripción de un usuario (activa o dada de
baja). Al dar de baja la membresía, un Dueño o Coach SHALL poder ingresar manualmente la fecha de
baja (incluyendo fechas retroactivas); si no la especifica, el sistema SHALL registrar la fecha y
hora del momento en que se ejecuta la baja. Dar de baja NO SHALL borrar el registro del usuario
ni su historial de pagos, asistencia o rutinas. Rutinas, asistencia y pagos SHALL aplicar
únicamente a usuarios con membresía activa.

El bloqueo de acceso a la aplicación (login deshabilitado) por baja de membresía SHALL aplicar
únicamente cuando el rol del usuario es Miembro. Un Dueño o Coach que además esté marcado como
miembro (porque también entrena en el gimnasio) conserva su acceso administrativo y su login
aunque su condición de miembro sea dada de baja — la baja en ese caso solo lo saca del
seguimiento de pagos/asistencia/rutinas, no le quita el acceso al sistema. Reactivar la
membresía de un usuario con rol Miembro SHALL restaurar su acceso a la aplicación.

#### Scenario: Dar de baja con fecha manual
- **WHEN** un Dueño da de baja la membresía de un Miembro e indica una fecha de baja retroactiva
- **THEN** el sistema guarda esa fecha indicada como fecha de baja

#### Scenario: Dar de baja sin indicar fecha
- **WHEN** un Dueño da de baja la membresía de un Miembro sin especificar una fecha
- **THEN** el sistema registra la fecha y hora actuales como fecha de baja

#### Scenario: Dar de baja no borra el historial
- **WHEN** se da de baja la membresía de un Miembro
- **THEN** el registro del usuario y su historial de pagos, asistencia y rutinas siguen
  existiendo sin cambios
- **THEN** no se le puede registrar nueva asistencia, pago ni asignación de rutina mientras la
  membresía esté de baja

#### Scenario: Baja de un usuario con rol Miembro bloquea su login
- **WHEN** se da de baja la membresía de un usuario con rol Miembro que tiene acceso de login
- **THEN** ese usuario ya no puede iniciar sesión, aunque sus credenciales sigan siendo válidas

#### Scenario: Baja de la membresía de un Coach que también es miembro no bloquea su acceso
- **WHEN** se da de baja la condición de miembro de un usuario con rol Coach (o Dueño) que además
  entrena en el gimnasio
- **THEN** ese usuario conserva su acceso de login y sus permisos administrativos
- **THEN** deja de contar como miembro activo a efectos de pagos, asistencia y rutinas

#### Scenario: Reactivar la membresía restaura el acceso de un Miembro
- **WHEN** un Dueño reactiva la membresía de un usuario con rol Miembro que estaba dado de baja
- **THEN** ese usuario vuelve a poder iniciar sesión con sus credenciales existentes

### Requirement: No hay eliminación física de usuarios
El sistema SHALL NOT ofrecer una acción de eliminar un usuario. La única baja disponible SHALL
ser la de la membresía/suscripción del gimnasio, según el requirement anterior.

#### Scenario: No existe botón de eliminar
- **WHEN** un Dueño o Coach ve la ficha o el listado de un usuario
- **THEN** no encuentra ninguna acción para eliminar el registro, solo para editarlo o para dar de
  baja su membresía

### Requirement: Listado de Usuarios
El sistema SHALL mostrar un listado único con todos los usuarios (Dueños, Coaches y Miembros) en
una tabla con las columnas: Nombre (con un indicador visual de su estado — activo, de baja o
administrativo), Contacto (el email si está cargado; si no hay email, el teléfono; si ninguno
está cargado, vacío o "-"), Rol, Alta (fecha de creación del registro), Inicio en el gimnasio, y
Acciones. La fila SHALL NOT mostrar el identificador interno (UUID) del usuario. La columna
"Inicio en el gimnasio" SHALL mostrarse únicamente para usuarios con perfil de miembro (activo o
dado de baja); para el resto SHALL mostrarse vacía o "-".

#### Scenario: Ver el listado completo
- **WHEN** un Dueño o Coach abre el listado de Usuarios
- **THEN** ve en la tabla a todos los Dueños, Coaches y Miembros, cada uno con su nombre con
  indicador de estado, contacto, rol, fecha de alta, fecha de inicio en el gimnasio y sus
  acciones disponibles

#### Scenario: Fecha de comienzo en el gimnasio para quien no es miembro
- **WHEN** un usuario con rol Coach nunca fue marcado como miembro del gimnasio
- **THEN** su fila en el listado muestra la columna "Inicio en el gimnasio" vacía

#### Scenario: Contacto muestra el email cuando está cargado
- **WHEN** un usuario tiene un email cargado
- **THEN** la columna Contacto de su fila muestra ese email

#### Scenario: Contacto muestra el teléfono cuando no hay email
- **WHEN** un usuario no tiene un email cargado pero sí tiene un número de teléfono
- **THEN** la columna Contacto de su fila muestra ese teléfono

#### Scenario: Sin UUID visible en la fila
- **WHEN** un Dueño o Coach ve cualquier fila del listado de Usuarios
- **THEN** no encuentra el identificador interno (UUID) del usuario mostrado como parte de la fila

### Requirement: Encabezado compacto de la vista Usuarios
En viewports de 640px o más, la vista Usuarios SHALL mostrar un encabezado compacto de una sola
fila con: el título "Usuarios", el total de usuarios listados, el ícono de leyenda, y la acción
primaria de alta de usuario. Debajo de 640px, la acción primaria puede pasar a una segunda fila
del encabezado en vez de compartir la fila con el título, el total y el ícono de leyenda. La
vista SHALL NOT mostrar el bloque de bienvenida con aura ("hero") que usa el Dashboard ni un texto
descriptivo debajo del título. En viewports menores a 768px, la acción primaria SHALL mostrarse
únicamente como ícono, sin el texto del label.

#### Scenario: Encabezado de una fila con título, total, ícono de leyenda y acción primaria
- **WHEN** un Dueño o Coach abre la vista Usuarios en un viewport de 640px de ancho o más
- **THEN** ve, en una única fila de encabezado, el título "Usuarios", el total de usuarios
  listados, el ícono de leyenda y el botón de acción primaria para dar de alta un usuario

#### Scenario: Encabezado en dos filas debajo de 640px
- **WHEN** un Dueño o Coach abre la vista Usuarios en un viewport menor a 640px
- **THEN** el título, el total y el ícono de leyenda pueden compartir una fila y la acción
  primaria puede quedar en una segunda fila del encabezado, en vez de forzar los cuatro elementos
  en una sola fila

#### Scenario: Sin descripción debajo del título
- **WHEN** un Dueño o Coach abre la vista Usuarios
- **THEN** no ve un texto descriptivo debajo del título del encabezado

#### Scenario: Sin hero de bienvenida
- **WHEN** un Dueño o Coach abre la vista Usuarios
- **THEN** no ve el bloque de bienvenida con aura que sí ve en el Dashboard

#### Scenario: Acción primaria solo con ícono en mobile
- **WHEN** un Dueño o Coach abre la vista Usuarios en un viewport menor a 768px
- **THEN** la acción primaria de alta de usuario se muestra solo como ícono, sin el texto del
  label

### Requirement: Leyenda de roles y estados en popover
La leyenda que explica los roles y los estados de membresía SHALL estar disponible desde un ícono
de información ubicado junto al título de la vista Usuarios, mostrada dentro de un popover, en
vez de como una card visible por defecto. El ícono SHALL tener un nombre accesible. El popover
SHALL poder abrirse con click o con teclado, SHALL cerrarse con la tecla Escape, y al cerrarse
SHALL devolver el foco al ícono que lo abrió.

#### Scenario: La leyenda no es una card visible por defecto
- **WHEN** un Dueño o Coach abre la vista Usuarios
- **THEN** no ve una card de leyenda de roles y estados visible sin interacción

#### Scenario: El ícono de información tiene nombre accesible
- **WHEN** un lector de pantalla llega al ícono de información junto al título
- **THEN** anuncia un nombre accesible que identifica su propósito (mostrar la leyenda de roles y
  estados)

#### Scenario: Abrir el popover con click
- **WHEN** el usuario hace click en el ícono de información
- **THEN** se abre un popover con la leyenda de roles y estados

#### Scenario: Abrir el popover con teclado
- **WHEN** el usuario navega al ícono de información con el teclado y presiona Enter o Espacio
- **THEN** se abre el popover con la leyenda de roles y estados

#### Scenario: Cerrar el popover con Escape devuelve el foco
- **WHEN** el popover de leyenda está abierto y el usuario presiona Escape
- **THEN** el popover se cierra
- **THEN** el foco vuelve al ícono de información que lo abrió

#### Scenario: La leyenda usa el mismo popover en mobile
- **WHEN** un Dueño o Coach abre la leyenda de roles y estados en un viewport menor a 768px
- **THEN** la ve dentro del mismo popover que en desktop, sin un drawer o sheet alternativo

### Requirement: Filtro de búsqueda sin etiqueta en mayúsculas
El filtro de búsqueda de la vista Usuarios SHALL NOT mostrar una etiqueta en mayúsculas (por
ejemplo "BUSCAR") sobre el campo de entrada.

#### Scenario: Filtro sin label en mayúsculas
- **WHEN** un Dueño o Coach ve la barra de filtros de la vista Usuarios
- **THEN** no encuentra una etiqueta en mayúsculas del tipo "BUSCAR" sobre el campo de búsqueda

### Requirement: Tabla de Usuarios con scroll interno, encabezado fijo y paginación única
La vista Usuarios SHALL mostrar el encabezado de la página, la barra de filtros, la tabla (con su
encabezado de columnas) y el pie de paginación contenidos dentro de una única card con borde y
fondo de superficie (Level 1, según `docs/design/design.md`). Dentro de esa card, la tabla SHALL
ocupar el alto restante disponible debajo del encabezado y la barra de filtros, con scroll interno
propio cuando el número de filas exceda el alto visible, y con el encabezado de columnas fijo
durante ese scroll. La vista SHALL mostrar un único pie de paginación, ubicado debajo de la tabla,
con el texto de rango ("Mostrando X-Y de Z") a la izquierda y el selector de tamaño de página
junto con los controles de navegación (Anterior / página actual / total de páginas / Siguiente) a
la derecha, en la misma fila — igual que en la tabla de Asistencias. El encabezado de columnas de
la tabla SHALL usar el mismo estilo tipográfico que el de la tabla de Asistencias: texto en
mayúsculas con tracking ampliado, peso bold, color muted, sobre una banda de fondo ligeramente más
clara que la de la card.

#### Scenario: Todo el listado entra sin scroll de página en 1440x900
- **WHEN** un Dueño o Coach abre la vista Usuarios en un viewport de 1440x900 con 10 filas de
  usuarios
- **THEN** el encabezado, la barra de filtros, la tabla completa y la paginación son visibles sin
  necesidad de scrollear la página

#### Scenario: Más filas que el alto disponible solo scrollean la tabla
- **WHEN** el listado de Usuarios tiene más filas que las que entran en el alto disponible
- **THEN** solo la tabla scrollea internamente, sin scrollear la página completa
- **THEN** el encabezado de columnas permanece visible (fijo) durante ese scroll

#### Scenario: Una sola paginación visible
- **WHEN** un Dueño o Coach ve la vista Usuarios
- **THEN** encuentra un único control de paginación, no duplicado

#### Scenario: Pie de tabla con rango a la izquierda y controles a la derecha
- **WHEN** un Dueño o Coach ve el pie de la tabla de Usuarios
- **THEN** encuentra, a la izquierda, el texto de rango "Mostrando X-Y de Z"
- **THEN** encuentra, a la derecha y en la misma fila, el selector de tamaño de página y los
  controles Anterior / página actual / total de páginas / Siguiente

#### Scenario: Encabezado de columnas con la tipografía de Asistencias
- **WHEN** un Dueño o Coach ve el encabezado de columnas de la tabla de Usuarios
- **THEN** el texto se muestra en mayúsculas con tracking ampliado, peso bold y color muted, sobre
  una banda de fondo ligeramente más clara que la de la card, igual que en la tabla de Asistencias

#### Scenario: Toda la vista contenida en una card
- **WHEN** un Dueño o Coach ve la vista Usuarios
- **THEN** el encabezado de la página, la barra de filtros, la tabla con su encabezado de
  columnas y el pie de paginación se muestran dentro de una única card con borde y fondo de
  superficie (Level 1)
- **THEN** dentro de esa card, solo la tabla scrollea internamente cuando hace falta, con su
  encabezado de columnas fijo

### Requirement: Acciones por fila como íconos accesibles
Cada fila del listado de Usuarios SHALL mostrar sus acciones (Ver, Editar y WhatsApp) como
botones de ícono, cada uno con un `aria-label` que describa la acción. El botón de WhatsApp SHALL
mostrarse deshabilitado cuando el usuario de esa fila no tiene un número de teléfono cargado.

#### Scenario: Acciones como botones de ícono con nombre accesible
- **WHEN** un Dueño o Coach ve las acciones de una fila del listado de Usuarios
- **THEN** encuentra botones de ícono para Ver, Editar y WhatsApp, cada uno con un `aria-label`
  que describe su acción

#### Scenario: WhatsApp deshabilitado sin teléfono
- **WHEN** el usuario de una fila no tiene un número de teléfono cargado
- **THEN** el botón de acción de WhatsApp de esa fila se muestra deshabilitado

#### Scenario: WhatsApp habilitado con teléfono
- **WHEN** el usuario de una fila tiene un número de teléfono cargado
- **THEN** el botón de acción de WhatsApp de esa fila está habilitado

### Requirement: Contraste accesible de indicadores de estado y roles
Los puntos de estado y los badges de rol de la vista Usuarios SHALL cumplir un contraste mínimo
AA (WCAG 2.1) contra su fondo, tanto en la tabla como en la leyenda del popover, y tanto en modo
dark como en modo light.

#### Scenario: Contraste AA en modo dark
- **WHEN** un badge de rol o un punto de estado se muestra en modo dark
- **THEN** su contraste de color contra el fondo cumple el mínimo AA de WCAG 2.1

#### Scenario: Contraste AA en modo light
- **WHEN** un badge de rol o un punto de estado se muestra en modo light
- **THEN** su contraste de color contra el fondo cumple el mínimo AA de WCAG 2.1

### Requirement: Permisos de gestión por rol
Un Dueño SHALL poder crear y editar usuarios de cualquier rol, incluyendo cambiar el rol de un
usuario existente. Un Coach SHALL poder crear y editar únicamente usuarios con rol Miembro, y NO
SHALL poder crear ni editar usuarios con rol Dueño o Coach, ni asignar esos roles a un usuario.

#### Scenario: Coach crea un miembro
- **WHEN** un Coach da de alta un usuario con rol Miembro
- **THEN** el sistema permite la operación

#### Scenario: Coach intenta crear un Dueño
- **WHEN** un Coach intenta dar de alta un usuario con rol Dueño
- **THEN** el sistema rechaza la operación con un error de autorización

#### Scenario: Coach intenta editar a otro Coach
- **WHEN** un Coach intenta editar el perfil de otro usuario con rol Coach
- **THEN** el sistema rechaza la operación con un error de autorización

### Requirement: Rename de navegación a "Usuarios"
El link de navegación que hoy dice "Clientes" SHALL mostrar el texto "Usuarios" en el Sidebar, en
el menú mobile del Topbar y en el grupo de resultados de SpotlightSearch.

#### Scenario: Sidebar muestra Usuarios
- **WHEN** un Dueño o Coach ve el Sidebar
- **THEN** el link que antes decía "Clientes" ahora dice "Usuarios"

#### Scenario: SpotlightSearch muestra Usuarios
- **WHEN** un Dueño o Coach abre SpotlightSearch
- **THEN** el grupo de resultados que antes decía "Clientes" ahora dice "Usuarios"

### Requirement: Acciones de membresía desde la ficha del usuario
La card "Membresía" de la ficha del usuario SHALL mostrar, según el estado actual, la acción de
membresía disponible para un Dueño o Coach con permiso de gestión sobre ese usuario (Dueño sobre
cualquier rol; Coach únicamente sobre usuarios con rol Miembro): "Dar de baja la membresía" si el
estado es activo, "Activar membresía" si el estado es sin membresía (nunca tuvo), o "Reactivar
membresía" si el estado es dado de baja. Cada acción SHALL abrir un modal de confirmación antes de
ejecutarse; el modal de baja SHALL permitir ingresar opcionalmente la fecha de baja (incluyendo
fechas retroactivas), sin cambiar el comportamiento ya especificado en "Estado de membresía, fecha
de baja y bloqueo de acceso (según rol)" — si no se indica fecha, se usa el momento actual. Al
confirmar el modal, la ficha SHALL reflejar el nuevo estado de membresía sin necesidad de recargar
la página. Cancelar el modal SHALL NOT producir ningún cambio.

#### Scenario: Ver la acción según el estado activo
- **WHEN** un Dueño o Coach con permiso de gestión ve la card Membresía de un usuario con
  membresía activa
- **THEN** encuentra la acción "Dar de baja la membresía"

#### Scenario: Ver la acción según el estado sin membresía
- **WHEN** un Dueño o Coach con permiso de gestión ve la card Membresía de un usuario que nunca
  tuvo membresía
- **THEN** encuentra la acción "Activar membresía"

#### Scenario: Ver la acción según el estado dado de baja
- **WHEN** un Dueño o Coach con permiso de gestión ve la card Membresía de un usuario cuya
  membresía está dada de baja
- **THEN** encuentra la acción "Reactivar membresía"

#### Scenario: Confirmar la baja con fecha opcional
- **WHEN** un Dueño hace click en "Dar de baja la membresía", se abre el modal de confirmación, y
  confirma sin ingresar una fecha
- **THEN** el sistema da de baja la membresía usando el momento actual como fecha de baja
- **THEN** la card Membresía de la ficha refleja el nuevo estado sin recargar la página

#### Scenario: Confirmar la baja con fecha retroactiva
- **WHEN** un Dueño abre el modal de baja, ingresa una fecha retroactiva, y confirma
- **THEN** el sistema guarda esa fecha indicada como fecha de baja

#### Scenario: Cancelar el modal no cambia nada
- **WHEN** un Dueño o Coach abre cualquiera de los modales de acción de membresía y lo cancela sin
  confirmar
- **THEN** el estado de la membresía del usuario no cambia

### Requirement: Edición de usuario limitada al perfil
El diálogo de edición de usuario SHALL NOT mostrar acciones de membresía (dar de baja, activar,
reactivar) ni acciones de invitación al portal. El diálogo SHALL limitarse a los campos de perfil
(nombre, apellido, fecha de nacimiento, peso, altura, email, teléfono y, únicamente si quien edita
tiene rol Dueño, el rol del usuario) con su acción de guardar.

#### Scenario: Sin sección de membresía en el diálogo de edición
- **WHEN** un Dueño o Coach abre el diálogo de edición de un usuario
- **THEN** no encuentra ninguna acción para dar de baja, activar o reactivar la membresía dentro
  de ese diálogo

#### Scenario: Sin sección de invitación en el diálogo de edición
- **WHEN** un Dueño o Coach abre el diálogo de edición de un usuario con rol Miembro
- **THEN** no encuentra ninguna acción para invitar o reenviar la invitación al portal dentro de
  ese diálogo

#### Scenario: Guardar cambios solo actualiza el perfil
- **WHEN** un Dueño o Coach edita los campos de perfil de un usuario en el diálogo de edición y
  guarda los cambios
- **THEN** el sistema actualiza únicamente los datos de perfil (y el rol, si corresponde), sin
  afectar el estado de membresía ni el de invitación

### Requirement: Verificación manual de contacto (email y teléfono)
La ficha del usuario SHALL mostrar, junto al email y al teléfono, si cada uno está verificado, de
forma independiente. Un Dueño o Coach con permiso de gestión sobre el usuario (Dueño sobre
cualquier rol; Coach únicamente sobre usuarios con rol Miembro) SHALL contar con una única acción
"Verificar contacto", detrás de un solo modal de confirmación, que marca como verificados **todos**
los datos de contacto cargados del usuario que aún no lo estén (email y/o teléfono) en una sola
operación. La acción SHALL estar disponible únicamente cuando el usuario tiene al menos un dato de
contacto cargado y sin verificar; si ambos datos cargados ya están verificados, o si no hay ningún
dato cargado, la acción SHALL NOT ofrecerse. Al confirmar, un dato no cargado SHALL omitirse sin
error, y un dato ya verificado SHALL quedar sin cambios (no se re-verifica ni genera error por sí
solo mientras haya al menos otro dato pendiente). Si al invocar la acción no hay ningún dato para
verificar — porque el usuario no tiene ningún dato cargado, o porque todos los datos cargados ya
están verificados — el sistema SHALL rechazar la operación con un error de conflicto, sin
modificar nada. Si el usuario tiene una invitación al portal **vigente** (no completada, no
revocada y no vencida), confirmar la acción SHALL marcar también como verificados, en esa
invitación, los mismos canales que quedaron verificados en el usuario por esta acción; si ambos
canales quedan verificados de esta forma, el miembro SHALL poder definir su contraseña abriendo
cualquiera de los dos links de invitación (el de email o el de WhatsApp), sin necesidad de abrir
el otro. Si no hay ninguna invitación vigente para el usuario — ya sea porque nunca se invitó o
porque la única invitación existente está vencida sin completar — la acción SHALL afectar
únicamente los datos del usuario, sin modificar ninguna invitación. La verificación manual NO
SHALL por sí misma definir una contraseña ni completar una invitación — no sustituye la
verificación por link. Para un usuario que ya tiene contraseña definida (rol Dueño o Coach), marcar
su email como verificado mediante esta acción SHALL restituir su capacidad de iniciar sesión si la
tenía bloqueada por email sin verificar, dado que el login exige email verificado (ver
`email_verified`); ese es el efecto esperado de la acción para ese caso, no un otorgamiento de
acceso al margen de la contraseña ya existente.

#### Scenario: Ofrecer la acción cuando el email está sin verificar
- **WHEN** un Dueño o Coach con permiso de gestión ve la ficha de un usuario que tiene el email
  cargado y sin verificar, sin importar el estado del teléfono
- **THEN** encuentra la acción "Verificar contacto"

#### Scenario: Ofrecer la acción cuando el teléfono está sin verificar
- **WHEN** un Dueño o Coach con permiso de gestión ve la ficha de un usuario que tiene el teléfono
  cargado y sin verificar, sin importar el estado del email
- **THEN** encuentra la acción "Verificar contacto"

#### Scenario: No ofrecer la acción cuando ambos datos cargados ya están verificados
- **WHEN** un Dueño o Coach ve la ficha de un usuario con email y teléfono cargados y ambos ya
  verificados
- **THEN** no encuentra la acción "Verificar contacto"

#### Scenario: No ofrecer la acción cuando no hay ningún dato cargado
- **WHEN** un Dueño o Coach ve la ficha de un usuario sin email ni teléfono cargados
- **THEN** no encuentra la acción "Verificar contacto"

#### Scenario: Confirmar la acción verifica ambos datos pendientes
- **WHEN** un Dueño confirma "Verificar contacto" para un usuario con email y teléfono cargados y
  ambos sin verificar
- **THEN** el sistema marca el email y el teléfono de ese usuario como verificados
- **THEN** la ficha refleja ambos como verificados sin recargar la página

#### Scenario: Confirmar la acción omite el dato no cargado
- **WHEN** un Dueño o Coach confirma "Verificar contacto" para un usuario con el email cargado y
  sin verificar, y sin teléfono cargado
- **THEN** el sistema marca el email como verificado
- **THEN** el sistema no produce ningún error por el teléfono no cargado

#### Scenario: Confirmar la acción no toca un dato ya verificado
- **WHEN** un Dueño confirma "Verificar contacto" para un usuario con el email ya verificado y el
  teléfono cargado sin verificar
- **THEN** el sistema marca el teléfono como verificado
- **THEN** el email permanece con el mismo estado de verificación que tenía

#### Scenario: Intento de confirmar la acción sin nada pendiente
- **WHEN** se invoca la acción "Verificar contacto" para un usuario sin ningún dato cargado, o con
  todos los datos cargados ya verificados — por ejemplo por un cliente con estado desactualizado o
  dos pestañas abiertas sobre la misma ficha
- **THEN** el sistema rechaza la operación con un error de conflicto
- **THEN** ningún dato del usuario ni de ninguna invitación cambia

#### Scenario: La acción marca en la invitación vigente los canales recién verificados
- **WHEN** un Dueño confirma "Verificar contacto" para un Miembro con una invitación al portal
  vigente (no completada, no revocada, no vencida) que tiene el email cargado y sin verificar, y
  el teléfono ya verificado
- **THEN** el sistema marca el email como verificado también en esa invitación
- **THEN** ese miembro ya no necesita abrir el link de email para que ese canal cuente como
  verificado en su invitación

#### Scenario: Verificar ambos canales permite completar la invitación con cualquiera de los dos links
- **WHEN** un Dueño confirma "Verificar contacto" para un Miembro con una invitación al portal
  vigente que tiene email y teléfono cargados y ambos sin verificar en la invitación
- **THEN** el sistema marca ambos canales como verificados en esa invitación
- **THEN** ese miembro puede definir su contraseña abriendo cualquiera de los dos links recibidos
  (el de email o el de WhatsApp), sin necesidad de abrir el otro

#### Scenario: Verificación sin invitación vigente
- **WHEN** un Dueño confirma "Verificar contacto" para un usuario que no tiene ninguna invitación
  al portal vigente
- **THEN** el sistema marca los datos correspondientes del usuario como verificados sin efecto
  sobre ninguna invitación

#### Scenario: Invitación vencida no se modifica al verificar a mano
- **WHEN** un miembro tiene una invitación al portal vencida sin completar y un Dueño confirma
  "Verificar contacto" para él
- **THEN** los datos del usuario quedan marcados como verificados
- **THEN** la invitación vencida no se modifica

#### Scenario: Verificar el email restaura el login de un Dueño o Coach con contraseña ya definida
- **WHEN** un Dueño confirma "Verificar contacto" para un usuario con rol Dueño o Coach que ya
  tiene contraseña definida y el email sin verificar
- **THEN** ese usuario puede iniciar sesión con sus credenciales existentes

#### Scenario: Coach intenta verificar el contacto de un usuario que no es Miembro
- **WHEN** un Coach intenta confirmar "Verificar contacto" para un usuario con rol Dueño o Coach
- **THEN** el sistema rechaza la operación con un error de autorización

#### Scenario: Estado de verificación visible en la ficha
- **WHEN** un Dueño o Coach ve la ficha de un usuario
- **THEN** ve, junto al email y al teléfono, si cada uno está verificado o no, de forma
  independiente
