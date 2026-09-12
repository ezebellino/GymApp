## MODIFIED Requirements

### Requirement: Listado de Usuarios
El sistema SHALL mostrar un listado único con todos los usuarios (Dueños, Coaches y Miembros) en
una tabla con las columnas: Nombre (con un indicador visual de su estado — activo, de baja o
administrativo), Contacto (el email si está cargado; si no hay email, el teléfono; si ninguno
está cargado, vacío o "-"), Rol, Plan, Alta (fecha de creación del registro), Inicio en el
gimnasio, y Acciones. La fila SHALL NOT mostrar el identificador interno (UUID) del usuario. La
columna "Inicio en el gimnasio" SHALL mostrarse únicamente para usuarios con perfil de miembro
(activo o dado de baja); para el resto SHALL mostrarse vacía o "-". La columna "Plan" SHALL
mostrar el nombre del plan vigente únicamente para usuarios con perfil de miembro; para el resto
SHALL mostrarse vacía o "-".

#### Scenario: Ver el listado completo
- **WHEN** un Dueño o Coach abre el listado de Usuarios
- **THEN** ve en la tabla a todos los Dueños, Coaches y Miembros, cada uno con su nombre con
  indicador de estado, contacto, rol, plan vigente (si es miembro), fecha de alta, fecha de
  inicio en el gimnasio y sus acciones disponibles

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

#### Scenario: Plan vigente visible en la fila de un miembro
- **WHEN** un Dueño o Coach ve en el listado la fila de un usuario con perfil de miembro y un
  plan asignado
- **THEN** la columna Plan de esa fila muestra el nombre del plan vigente de ese miembro

#### Scenario: Sin plan visible para quien no es miembro
- **WHEN** un Dueño o Coach ve en el listado la fila de un usuario que nunca fue marcado como
  miembro del gimnasio
- **THEN** la columna Plan de esa fila se muestra vacía o "-"

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

Si el usuario **no tiene ningún plan asignado**, el modal de "Activar membresía" o "Reactivar
membresía" SHALL exigir elegir un plan activo como parte de la misma acción de confirmación, y
activar la membresía y asignar ese plan SHALL ejecutarse como una única operación atómica: si el
plan elegido no existe o está inactivo, la operación SHALL rechazarse sin dejar la membresía
activa. Si el usuario **ya tiene un plan** asignado, el modal SHALL permitir confirmar sin elegir
un plan nuevo, y ese usuario SHALL conservar el plan que ya tenía.

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

#### Scenario: Activar la membresía de un usuario sin plan exige elegir uno en la misma acción
- **WHEN** un Dueño o Coach confirma "Activar membresía" (o "Reactivar membresía") para un usuario
  sin ningún plan asignado, eligiendo un plan activo en el mismo modal
- **THEN** el sistema activa la membresía y asigna ese plan como vigente en una sola operación
- **THEN** la ficha refleja la membresía activa y el plan elegido sin recargar la página

#### Scenario: Activar sin elegir plan y sin tener uno asignado es rechazado
- **WHEN** un Dueño o Coach intenta confirmar "Activar membresía" (o "Reactivar membresía") para un
  usuario sin ningún plan asignado, sin elegir un plan en el modal
- **THEN** el sistema rechaza la operación
- **THEN** la membresía del usuario no queda activa

#### Scenario: Activar con un plan inexistente o inactivo no deja la membresía activa
- **WHEN** un Dueño o Coach intenta confirmar "Activar membresía" (o "Reactivar membresía") para un
  usuario sin plan, eligiendo un plan que no existe o que está inactivo
- **THEN** el sistema rechaza la operación
- **THEN** la membresía del usuario no queda activa ni se le asigna ningún plan

#### Scenario: Un usuario que ya tiene plan se reactiva sin elegir uno nuevo
- **WHEN** un Dueño o Coach confirma "Reactivar membresía" para un usuario que ya tiene un plan
  asignado, sin elegir un plan nuevo en el modal
- **THEN** el sistema activa la membresía
- **THEN** ese usuario conserva el mismo plan que ya tenía

## ADDED Requirements

### Requirement: Plan obligatorio al dar de alta un Miembro
El sistema SHALL exigir un plan activo al dar de alta un usuario con rol Miembro; el alta SHALL
ofrecer un selector limitado a los planes activos existentes. Un intento de alta de Miembro sin
plan seleccionado SHALL ser rechazado sin crear el registro. Un intento de asignar un plan
inactivo SHALL ser rechazado sin crear el registro. Si no existe ningún plan activo en el sistema,
el alta de Miembro SHALL NOT poder completarse, y la interfaz SHALL ofrecer una vía para ir a la
pantalla de Planes.

#### Scenario: Alta de Miembro sin plan seleccionado
- **WHEN** un Dueño o Coach intenta dar de alta un usuario con rol Miembro sin seleccionar un plan
- **THEN** el sistema rechaza el alta y no crea el registro

#### Scenario: Alta de Miembro con un plan inactivo
- **WHEN** un Dueño o Coach intenta dar de alta un usuario con rol Miembro indicando un plan que
  está inactivo
- **THEN** el sistema rechaza el alta y no crea el registro

#### Scenario: Alta de Miembro con un plan activo
- **WHEN** un Dueño o Coach da de alta un usuario con rol Miembro seleccionando un plan activo
  existente
- **THEN** el sistema crea el registro con ese plan asignado como vigente

#### Scenario: Sin ningún plan activo en el sistema
- **WHEN** un Dueño o Coach intenta dar de alta un usuario con rol Miembro y no existe ningún plan
  activo en el sistema
- **THEN** el sistema impide completar el alta
- **THEN** la interfaz de alta ofrece una vía para ir a la pantalla de Planes

### Requirement: Cambio de plan desde la ficha del miembro
El sistema SHALL permitir a un Dueño o Coach con permiso de gestión sobre un miembro cambiar su
plan vigente desde la ficha del usuario, eligiendo entre los planes activos existentes. El cambio
SHALL registrar la fecha desde la que rige el nuevo plan y qué usuario lo realizó. El cambio de
plan SHALL aplicar únicamente a los próximos pagos que se registren para ese miembro; SHALL NOT
modificar el plan ni el precio de referencia de ningún pago ya registrado (S5).

#### Scenario: Cambiar el plan de un miembro
- **WHEN** un Dueño o Coach con permiso de gestión cambia el plan de un miembro a otro plan activo
  desde su ficha
- **THEN** el sistema actualiza el plan vigente del miembro
- **THEN** el sistema registra la fecha desde la que rige el nuevo plan y quién hizo el cambio

#### Scenario: El cambio de plan no reescribe pagos anteriores
- **WHEN** se cambia el plan de un miembro que ya tiene pagos registrados con el plan anterior
- **THEN** ninguno de esos pagos cambia su plan ni su precio de referencia

#### Scenario: El nuevo plan aplica a los próximos pagos
- **WHEN** se cambia el plan de un miembro y luego se registra un pago nuevo para ese miembro
- **THEN** ese pago nuevo toma como referencia el plan vigente al momento de registrarlo, no el
  plan que tenía antes del cambio

### Requirement: Miembro preexistente sin plan asignado
Un usuario con perfil de miembro creado antes de que existiera esta capability SHALL quedar sin
plan asignado, en vez de asignársele uno automáticamente. El listado de Usuarios y la ficha SHALL
mostrar "Sin plan" para ese miembro en lugar de un nombre de plan. La ficha de un miembro sin plan
SHALL ofrecer una acción "Asignar plan" que, al usarse, sigue la misma regla de "Cambio de plan
desde la ficha del miembro" (solo planes activos, registra fecha y quién lo hizo); una vez
asignado, ese miembro SHALL quedar indistinguible de uno que tuvo plan desde su alta.

#### Scenario: Listado muestra "Sin plan" para un miembro preexistente
- **WHEN** un Dueño o Coach ve en el listado de Usuarios la fila de un miembro creado antes de
  esta capability, sin ningún plan asignado
- **THEN** la columna Plan de esa fila muestra "Sin plan" en vez de un nombre de plan o un espacio
  vacío ambiguo

#### Scenario: Ficha de un miembro sin plan ofrece asignar uno
- **WHEN** un Dueño o Coach con permiso de gestión abre la ficha de un miembro sin plan asignado
- **THEN** ve "Sin plan" en la sección de plan de la ficha
- **THEN** encuentra la acción "Asignar plan" en esa sección

#### Scenario: Asignar plan a un miembro que no tenía deja el mismo estado que un alta con plan
- **WHEN** un Dueño o Coach usa "Asignar plan" para darle un plan activo a un miembro que no
  tenía ninguno
- **THEN** ese miembro queda con ese plan como vigente, con la fecha desde la que rige y quién lo
  asignó registrados
- **THEN** el listado y la ficha de ese miembro muestran su plan igual que el de un miembro que
  tuvo plan desde su alta

#### Scenario: Asignar plan a un miembro dado de baja lo habilita a reactivar su membresía
- **WHEN** un Dueño o Coach usa "Asignar plan" para darle un plan activo a un miembro cuya
  membresía está dada de baja y que no tenía ningún plan asignado
- **THEN** el sistema le asigna ese plan sin exigir que la membresía esté activa
- **THEN** ese miembro queda en condiciones de que un Dueño reactive su membresía, dado que ya
  cuenta con un plan asignado

#### Scenario: Asignar plan no cambia por sí solo el estado de la membresía
- **WHEN** se asigna un plan a un miembro dado de baja
- **THEN** la membresía de ese miembro sigue dada de baja hasta que se la reactive explícitamente
- **THEN** asignar el plan no habilita por sí solo pagos, check-ins ni acceso al portal para ese
  miembro

#### Scenario: Asignar plan a quien nunca fue miembro es rechazado
- **WHEN** un Dueño o Coach intenta usar "Asignar plan" sobre un usuario que nunca fue marcado
  como miembro del gimnasio (sin perfil de miembro)
- **THEN** el sistema rechaza la operación y ese usuario sigue sin sección de plan en su ficha

### Requirement: Plan vigente visible en la ficha del usuario
La ficha de un usuario con perfil de miembro SHALL mostrar su plan vigente. Un usuario sin perfil
de miembro SHALL NOT mostrar una sección de plan en su ficha.

#### Scenario: Ver el plan vigente en la ficha de un miembro
- **WHEN** un Dueño o Coach abre la ficha de un usuario con perfil de miembro y un plan asignado
- **THEN** ve el nombre del plan vigente de ese miembro en su ficha

#### Scenario: Sin sección de plan para quien no es miembro
- **WHEN** un Dueño o Coach abre la ficha de un usuario que nunca fue marcado como miembro del
  gimnasio
- **THEN** no encuentra una sección de plan en esa ficha
