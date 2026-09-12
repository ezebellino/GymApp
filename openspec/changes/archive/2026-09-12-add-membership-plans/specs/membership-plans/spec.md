## ADDED Requirements

### Requirement: Crear un plan de membresía con nombre único
El sistema SHALL permitir a un Dueño o Coach crear un plan de membresía indicando nombre,
descripción opcional y un precio inicial. El plan SHALL nacer activo. El nombre SHALL ser único
entre los planes existentes (sin distinguir mayúsculas/minúsculas ni espacios al inicio/final); un
intento de crear un plan con un nombre ya usado SHALL ser rechazado sin crear el registro.

#### Scenario: Crear un plan válido
- **WHEN** un Dueño o Coach crea un plan con nombre "Estudiante", descripción opcional y un
  precio inicial
- **THEN** el sistema crea el plan como activo, con ese precio como el primer valor de su
  historial

#### Scenario: Nombre de plan duplicado rechazado
- **WHEN** un Dueño o Coach intenta crear un plan con un nombre que ya usa otro plan existente
  (activo o inactivo)
- **THEN** el sistema rechaza la operación sin crear un plan nuevo

### Requirement: Historial de precios del plan, agregado y no editable
El sistema SHALL mantener el precio de un plan como un historial de valores, cada uno con monto,
fecha desde la que rige y quién lo registró. Cambiar el precio SHALL agregar un nuevo valor al
historial; el sistema SHALL NOT editar ni borrar ningún valor anterior del historial. Agregar un
precio nuevo SHALL NOT modificar el monto ni el precio de referencia de ningún pago ya registrado.

#### Scenario: Cambiar el precio agrega un valor al historial
- **WHEN** un Dueño o Coach agrega un nuevo precio a un plan existente, indicando monto y fecha
  desde la que rige
- **THEN** el sistema agrega ese valor al historial de precios del plan
- **THEN** el valor de precio anterior sigue presente en el historial, sin modificarse

#### Scenario: Los pagos ya registrados no cambian
- **WHEN** se agrega un nuevo precio a un plan que tiene pagos ya registrados con un precio de
  referencia anterior
- **THEN** ninguno de esos pagos cambia su monto ni su precio de referencia

### Requirement: Editar nombre y descripción de un plan
El sistema SHALL permitir a un Dueño o Coach editar el nombre y la descripción de un plan
existente, sujeto a la misma regla de unicidad de nombre. Editar nombre o descripción SHALL NOT
alterar el historial de precios del plan.

#### Scenario: Editar nombre y descripción
- **WHEN** un Dueño o Coach edita el nombre y la descripción de un plan existente con un nombre
  que no está en uso por otro plan
- **THEN** el sistema guarda los nuevos valores
- **THEN** el historial de precios del plan queda igual que antes de la edición

#### Scenario: Editar a un nombre ya usado por otro plan
- **WHEN** un Dueño o Coach intenta editar el nombre de un plan para que coincida con el de otro
  plan existente
- **THEN** el sistema rechaza la edición y el nombre del plan no cambia

### Requirement: Desactivar un plan y regla de al menos un plan activo
El sistema SHALL permitir a un Dueño o Coach desactivar un plan activo. Un plan desactivado SHALL
dejar de ofrecerse como opción al asignar plan a un miembro (en el alta o en un cambio de plan),
pero los miembros que ya lo tienen asignado SHALL conservarlo sin cambios hasta que se les asigne
otro plan explícitamente. El sistema SHALL NOT permitir desactivar el único plan activo que quede
en el sistema.

#### Scenario: Desactivar un plan con otros planes activos
- **WHEN** un Dueño o Coach desactiva un plan mientras existe al menos otro plan activo
- **THEN** el plan queda inactivo
- **THEN** ese plan ya no aparece entre las opciones para asignar a un miembro nuevo o para
  cambiar el plan de un miembro existente

#### Scenario: Los miembros que ya tienen el plan lo conservan
- **WHEN** se desactiva un plan que tiene miembros con ese plan asignado
- **THEN** esos miembros conservan ese plan sin cambios
- **THEN** los pagos ya registrados de esos miembros no se ven afectados

#### Scenario: No se puede desactivar el último plan activo
- **WHEN** un Dueño o Coach intenta desactivar el único plan que queda activo en el sistema
- **THEN** el sistema rechaza la operación y el plan permanece activo

### Requirement: No se puede borrar un plan con miembros o pagos asociados
El sistema SHALL NOT permitir borrar un plan que tiene o tuvo, en cualquier momento, algún miembro
asignado o algún pago registrado con ese plan como referencia. Un intento de borrado sobre un plan
en esa condición SHALL ser rechazado sin eliminar el registro.

#### Scenario: Intento de borrar un plan con miembros asignados
- **WHEN** un Dueño o Coach intenta borrar un plan que tiene o tuvo algún miembro asignado
- **THEN** el sistema rechaza la operación y el plan sigue existiendo

#### Scenario: Intento de borrar un plan con pagos registrados
- **WHEN** un Dueño o Coach intenta borrar un plan que tiene pagos registrados con ese plan como
  referencia, aunque ya no tenga miembros asignados actualmente
- **THEN** el sistema rechaza la operación y el plan sigue existiendo

### Requirement: Listado de planes con búsqueda y filtro por estado
El sistema SHALL mostrar un listado de planes con búsqueda por nombre y filtro por estado (activo
/ inactivo), siguiendo el mismo patrón del listado de Usuarios: acciones de crear, editar, agregar
precio y desactivar disponibles en diálogos desde ese listado.

#### Scenario: Buscar un plan por nombre
- **WHEN** un Dueño o Coach busca un plan por parte de su nombre en el listado de Planes
- **THEN** el listado muestra únicamente los planes cuyo nombre coincide con la búsqueda

#### Scenario: Filtrar por planes inactivos
- **WHEN** un Dueño o Coach filtra el listado de Planes por estado "inactivo"
- **THEN** el listado muestra únicamente los planes desactivados

