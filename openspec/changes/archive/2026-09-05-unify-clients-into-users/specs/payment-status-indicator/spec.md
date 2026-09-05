## ADDED Requirements

### Requirement: Los tres estados de membresía/pago
Un usuario con perfil de miembro SHALL estar en uno de tres estados: **al día** (membresía activa
y con el pago del período actual registrado), **en mora** (membresía activa pero sin pago
registrado para el período actual) o **dado de baja** (membresía desactivada). El estado "al
día"/"en mora" SHALL derivarse de si el período (mes y año) del último pago registrado es igual o
posterior al período actual; el estado "dado de baja" SHALL prevalecer sobre cualquier estado de
pago mientras la membresía esté desactivada.

#### Scenario: Sin pagos registrados y membresía activa
- **WHEN** un miembro con membresía activa no tiene ningún pago registrado
- **THEN** el sistema lo considera en mora

#### Scenario: Último pago del período actual o futuro
- **WHEN** el último pago registrado de un miembro con membresía activa corresponde al mes/año
  actual o a uno posterior
- **THEN** el sistema lo considera al día

#### Scenario: Último pago de un período anterior
- **WHEN** el último pago registrado de un miembro con membresía activa corresponde a un mes/año
  anterior al actual
- **THEN** el sistema lo considera en mora

#### Scenario: Membresía dada de baja
- **WHEN** la membresía de un usuario está dada de baja
- **THEN** el sistema lo considera en estado "dado de baja", sin importar el período de su último
  pago registrado

### Requirement: Indicador visual de 3 colores en el listado de Usuarios
El listado de Usuarios SHALL mostrar, antes del nombre de cada fila, un círculo verde cuando el
usuario está al día, un círculo naranja cuando está en mora, y un círculo rojo cuando su
membresía está dada de baja. Un usuario que nunca tuvo perfil de miembro (por ejemplo, un Dueño o
Coach que no entrena en el gimnasio) SHALL NOT mostrar ningún círculo.

#### Scenario: Miembro activo al día
- **WHEN** un usuario con membresía activa está al día con los pagos
- **THEN** su fila muestra un círculo verde antes del nombre

#### Scenario: Miembro activo en mora
- **WHEN** un usuario con membresía activa está en mora (no pagó el período actual)
- **THEN** su fila muestra un círculo naranja antes del nombre

#### Scenario: Miembro dado de baja
- **WHEN** la membresía de un usuario está dada de baja
- **THEN** su fila muestra un círculo rojo antes del nombre

#### Scenario: Usuario que nunca fue miembro
- **WHEN** un usuario (por ejemplo, un Coach) nunca fue marcado como miembro del gimnasio
- **THEN** su fila no muestra ningún círculo de estado

### Requirement: El rojo refleja el estado de membresía, no directamente el acceso
El círculo rojo SHALL mostrarse para cualquier usuario con perfil de miembro cuya membresía esté
dada de baja, sin importar su rol. El bloqueo de login que puede o no acompañar a esa baja se
rige por la capability `user-management` ("Estado de membresía, fecha de baja y bloqueo de
acceso"): un usuario con rol Miembro dado de baja queda sin acceso, mientras que un Dueño o Coach
que además es miembro y da de baja esa condición conserva su acceso administrativo aunque su fila
siga en rojo.

#### Scenario: Miembro dado de baja se ve rojo y pierde el acceso
- **WHEN** se da de baja la membresía de un usuario con rol Miembro
- **THEN** su fila se muestra en rojo en el listado
- **THEN** ese usuario ya no puede iniciar sesión

#### Scenario: Coach-miembro dado de baja se ve rojo pero conserva el acceso
- **WHEN** se da de baja la condición de miembro de un usuario con rol Coach
- **THEN** su fila se muestra en rojo en el listado
- **THEN** ese usuario sigue pudiendo iniciar sesión y usar sus funciones de Coach

#### Scenario: Reactivación restaura el color real
- **WHEN** un Dueño reactiva la membresía de un usuario que estaba dado de baja
- **THEN** su indicador en el listado deja de mostrarse en rojo y pasa a reflejar su estado real
  de pago (verde o naranja)

### Requirement: Cálculo del indicador en tiempo real
El estado de pago (verde/naranja) SHALL calcularse a partir de los pagos registrados en cada
consulta del listado, sin depender de un campo cacheado que pueda quedar desactualizado. El
estado rojo (dado de baja) SHALL calcularse a partir del estado explícito de membresía, no de los
pagos.

#### Scenario: Un pago nuevo actualiza el indicador
- **WHEN** se registra un pago del período actual para un miembro que figuraba en naranja
- **THEN** al recargar el listado de Usuarios, ese miembro pasa a mostrarse en verde
