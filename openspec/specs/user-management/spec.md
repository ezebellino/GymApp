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
El sistema SHALL mostrar un listado único con todos los usuarios (Dueños, Coaches y Miembros),
con las columnas: nombre completo, rol, fecha de alta (creación del registro) y fecha de
comienzo en el gimnasio. La fecha de comienzo en el gimnasio SHALL mostrarse únicamente para
usuarios con perfil de miembro (activo o dado de baja); para el resto SHALL mostrarse vacía o "-".

#### Scenario: Ver el listado completo
- **WHEN** un Dueño o Coach abre el listado de Usuarios
- **THEN** ve en la tabla a todos los Dueños, Coaches y Miembros, cada uno con su nombre completo,
  rol, fecha de alta y fecha de comienzo en el gimnasio

#### Scenario: Fecha de comienzo en el gimnasio para quien no es miembro
- **WHEN** un usuario con rol Coach nunca fue marcado como miembro del gimnasio
- **THEN** su fila en el listado muestra la columna "fecha de comienzo en el gimnasio" vacía

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
