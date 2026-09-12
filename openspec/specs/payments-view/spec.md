# payments-view Specification

## Purpose

La sección Pagos: dónde se registra que un miembro pagó un período, con listado, filtros,
búsqueda, alta (desde Pagos y desde la ficha del miembro) y anulación. Cada pago guarda, además
del monto pagado, una foto inmutable del plan y del precio de referencia vigentes al momento de
registrarlo (ver `membership-plans` para el historial de precios del plan en sí, y
`payment-status-indicator` para cómo se deriva el semáforo de estado de cuota a partir de los
pagos).

## Requirements

### Requirement: Registrar pago solo a membresía activa
El sistema SHALL permitir registrar un pago únicamente para un miembro cuya membresía esté
activa. Un intento de registrar un pago a un miembro con membresía dada de baja SHALL ser
rechazado sin crear el pago.

#### Scenario: Pago a membresía activa
- **WHEN** un Dueño o Coach registra un pago para un miembro con membresía activa
- **THEN** el sistema crea el pago

#### Scenario: Pago rechazado a membresía dada de baja
- **WHEN** un Dueño o Coach intenta registrar un pago para un miembro cuya membresía está dada de
  baja
- **THEN** el sistema rechaza la operación y no crea ningún pago

### Requirement: Un pago por miembro y período, con adelantos permitidos
El sistema SHALL aceptar como máximo un pago por miembro para cada período (mes y año). Un
segundo intento de registrar un pago para un período que ya tiene uno SHALL ser rechazado. El
sistema SHALL permitir registrar pagos de períodos futuros al mes/año actual (pago adelantado).

#### Scenario: Dos pagos del mismo miembro para el mismo período
- **WHEN** un Dueño o Coach intenta registrar un segundo pago para un miembro en un período que ya
  tiene un pago registrado
- **THEN** el sistema rechaza la operación y el pago original permanece sin cambios

#### Scenario: Pago de un período futuro
- **WHEN** un Dueño o Coach registra un pago para un miembro indicando un período posterior al
  mes/año actual
- **THEN** el sistema crea el pago normalmente

### Requirement: El alta rechaza a un miembro sin plan
El sistema SHALL rechazar el registro de un pago para un miembro que no tiene ningún plan de
membresía asignado, sin crear el pago. Esta regla aplica solo al **alta**: los pagos registrados
antes de que el miembro tuviera plan asignado se siguen mostrando en el listado con el plan
vacío, sin que eso los invalide.

#### Scenario: Intento de pago a un miembro sin plan
- **WHEN** un Dueño o Coach intenta registrar un pago para un miembro que no tiene plan asignado
- **THEN** el sistema rechaza la operación, no crea el pago y comunica que el miembro necesita un
  plan asignado antes de poder cobrarle

#### Scenario: Un pago con plan vacío se sigue listando
- **WHEN** el listado de Pagos incluye un pago registrado antes de que su miembro tuviera un plan
  asignado
- **THEN** ese pago se muestra igual, con la columna de plan en blanco ("Sin plan"), sin bloquear
  el resto del listado

### Requirement: Precarga del monto con el precio vigente del plan al momento de registrar
Al iniciar el alta de un pago para un miembro con plan asignado, el sistema SHALL precargar el
monto con el precio vigente del plan del miembro **a la fecha de registro** del pago (no el del
período que el pago cubre). Este monto precargado SHALL quedar editable antes de guardar.

#### Scenario: Precarga con el precio vigente al registrar
- **WHEN** un Dueño o Coach abre el alta de pago para un miembro cuyo plan tiene un precio vigente
  de 34.000 en la fecha de hoy
- **THEN** el campo de monto se precarga con 34.000

#### Scenario: Pago atrasado toma el precio vigente al registrar, no el del período cubierto
- **WHEN** un Dueño o Coach registra el 02/09/2026 un pago para el período 08/2026 (atrasado) de
  un miembro cuyo plan pasó de 30.000 a 34.000 el 01/09/2026
- **THEN** el monto se precarga con 34.000 (el precio vigente al registrar), no con 30.000 (el
  precio que regía durante 08/2026)

### Requirement: Monto editable y precio de referencia distinto del monto pagado
El sistema SHALL permitir editar el monto precargado antes de guardar el pago (por ejemplo, para
aplicar un descuento puntual). El pago SHALL guardar tanto el monto efectivamente pagado como el
precio de referencia del plan con el que se sugirió el monto, y ambos valores SHALL poder
diferir entre sí.

#### Scenario: Editar el monto precargado
- **WHEN** un Dueño o Coach edita el monto precargado de 34.000 a 30.000 antes de guardar un pago,
  dejando una nota
- **THEN** el sistema guarda el pago con monto pagado 30.000 y precio de referencia 34.000

### Requirement: La foto de plan y precio de un pago es inmutable
Cada pago SHALL conservar el nombre del plan y el precio de referencia con los que se registró,
sin que ningún cambio posterior al plan (nuevo precio, cambio de nombre, desactivación) o al plan
asignado al miembro modifique lo que ese pago ya registrado muestra.

#### Scenario: Un pago histórico no cambia tras un nuevo precio del plan
- **WHEN** se agrega un nuevo precio a un plan que tiene pagos registrados con un precio de
  referencia anterior
- **THEN** esos pagos conservan su monto pagado y su precio de referencia originales sin cambios

#### Scenario: El plan de un pago no cambia si el plan del miembro cambia después
- **WHEN** se cambia el plan de un miembro después de haberle registrado un pago con el plan
  anterior
- **THEN** ese pago sigue mostrando el plan y precio con los que se registró originalmente, no el
  plan nuevo del miembro

#### Scenario: El plan de un pago no cambia si ese plan se desactiva después
- **WHEN** se desactiva un plan que fue usado como referencia en pagos ya registrados
- **THEN** esos pagos siguen mostrando el nombre de ese plan y su precio de referencia sin cambios

### Requirement: Métodos de pago limitados a los habilitados en Configuración
El selector de método de pago del alta SHALL ofrecer únicamente los métodos (efectivo,
transferencia y, para transferencia, el canal) que estén habilitados en Configuración
(`app-settings-state`). Un método deshabilitado SHALL NOT aparecer como opción.

#### Scenario: Un método deshabilitado no aparece como opción
- **WHEN** un Dueño deshabilita el método "transferencia" en Configuración y luego se abre el alta
  de pago
- **THEN** el selector de método solo ofrece "efectivo"

### Requirement: Anular un pago, solo el Dueño, con recálculo de estado de cuota
El sistema SHALL permitir anular (eliminar) un pago únicamente al rol Dueño. Un Coach SHALL NOT
poder anular un pago. Al anular un pago, el estado de cuota del miembro (`payment-status-indicator`)
SHALL recalcularse tomando en cuenta el pago restante más reciente (o su ausencia).

#### Scenario: El Dueño anula un pago
- **WHEN** un Dueño anula el único pago registrado del período actual de un miembro que figuraba
  al día
- **THEN** el pago deja de existir en el historial
- **THEN** el estado de cuota de ese miembro pasa a en mora (o al del pago restante más reciente)

#### Scenario: Un Coach no puede anular un pago
- **WHEN** un Coach intenta anular un pago
- **THEN** el sistema rechaza la operación y el pago permanece sin cambios

### Requirement: Listado de pagos con filtros, búsqueda y plan por pago
La sección Pagos SHALL mostrar un listado de pagos con búsqueda (por nombre, email o teléfono del
miembro) y filtros, indicando para cada pago el período que cubre, el monto pagado, el método (y
canal si aplica), y el plan y precio de referencia con los que se registró. El plan mostrado por
pago SHALL ser el que se guardó como foto al momento de ese pago, no el plan actual del miembro.

#### Scenario: El listado muestra el plan de referencia de cada pago
- **WHEN** un Dueño o Coach abre el listado de Pagos
- **THEN** cada fila muestra, además del período y el monto, el nombre del plan y el precio de
  referencia con los que se registró ese pago

### Requirement: Alta de pago desde Pagos y desde la ficha del miembro
El sistema SHALL permitir iniciar el alta de un pago tanto desde la sección Pagos (eligiendo al
miembro) como desde la ficha de un miembro (con el miembro ya preseleccionado), usando el mismo
diálogo reusable en ambos casos.

#### Scenario: Alta de pago desde la sección Pagos
- **WHEN** un Dueño o Coach inicia un alta de pago desde la sección Pagos y elige un miembro con
  plan asignado
- **THEN** se abre el diálogo de alta con el monto precargado según el plan de ese miembro

#### Scenario: Alta de pago desde la ficha del miembro
- **WHEN** un Dueño o Coach inicia un alta de pago desde la ficha de un miembro
- **THEN** se abre el mismo diálogo de alta con ese miembro ya preseleccionado y el monto
  precargado según su plan
