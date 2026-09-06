## ADDED Requirements

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
