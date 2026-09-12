# staff-endpoint-authorization Specification

## Purpose
TBD - created by archiving change secure-staff-endpoints. Update Purpose after archive.
## Requirements
### Requirement: Lectura de configuración exige sesión
`GET /settings` SHALL exigir una sesión vigente de cualquier rol (Dueño, Coach o Miembro). Una
petición sin token o con un token inválido SHALL responder 401 y no exponer ningún dato de
configuración.

#### Scenario: Sin token
- **WHEN** se consulta `GET /settings` sin encabezado de autorización
- **THEN** la API responde 401 y no devuelve datos de configuración

#### Scenario: Con token inválido
- **WHEN** se consulta `GET /settings` con un token arbitrario que no fue emitido por la API
- **THEN** la API responde 401

#### Scenario: Dueño, Coach o Miembro autenticado
- **WHEN** se consulta `GET /settings` con el token de un Dueño, de un Coach o de un Miembro con
  sesión vigente
- **THEN** la API responde 200 con la configuración vigente, igual para los tres roles

### Requirement: Escritura de configuración exige rol Dueño o Coach
`PUT /settings` y `PATCH /settings` SHALL exigir, además de sesión vigente, que el rol de la
sesión sea Dueño o Coach. Un Miembro autenticado que intente editar la configuración SHALL
recibir 403 y la configuración SHALL quedar sin modificar.

#### Scenario: Sin token
- **WHEN** se envía `PUT /settings` o `PATCH /settings` sin encabezado de autorización
- **THEN** la API responde 401 y la configuración no cambia

#### Scenario: Miembro autenticado intenta editar
- **WHEN** un Miembro con sesión vigente envía `PUT /settings` o `PATCH /settings`
- **THEN** la API responde 403 y la configuración no cambia

#### Scenario: Dueño o Coach editan
- **WHEN** un Dueño o un Coach con sesión vigente envían `PUT /settings` o `PATCH /settings` con
  datos válidos
- **THEN** la API responde 200 y la configuración queda actualizada

### Requirement: Listado y detalle de pagos exigen rol Dueño o Coach
`GET /payments/` y `GET /payments/{id}` SHALL exigir sesión vigente de rol Dueño o Coach. Una
petición sin token, con token inválido, o con sesión de rol Miembro SHALL NOT recibir datos de
pagos.

#### Scenario: Sin token
- **WHEN** se consulta `GET /payments/` o `GET /payments/{id}` sin encabezado de autorización
- **THEN** la API responde 401 y no devuelve datos de pagos

#### Scenario: Miembro autenticado
- **WHEN** un Miembro con sesión vigente consulta `GET /payments/` o `GET /payments/{id}`
- **THEN** la API responde 403 y no devuelve datos de pagos

#### Scenario: Dueño o Coach autenticados
- **WHEN** un Dueño o un Coach con sesión vigente consultan `GET /payments/` o `GET
  /payments/{id}` de un pago existente
- **THEN** la API responde 200 con los datos correspondientes, igual que antes de este change

### Requirement: Historial de asistencias exige rol Dueño o Coach
`GET /attendance/` SHALL exigir sesión vigente de rol Dueño o Coach. Una petición sin token, con
token inválido, o con sesión de rol Miembro SHALL NOT recibir el historial.

#### Scenario: Sin token
- **WHEN** se consulta `GET /attendance/` sin encabezado de autorización
- **THEN** la API responde 401 y no devuelve historial de asistencias

#### Scenario: Miembro autenticado
- **WHEN** un Miembro con sesión vigente consulta `GET /attendance/`
- **THEN** la API responde 403 y no devuelve historial de asistencias

#### Scenario: Dueño o Coach autenticados
- **WHEN** un Dueño o un Coach con sesión vigente consultan `GET /attendance/`
- **THEN** la API responde 200 con el historial, igual que antes de este change

### Requirement: El check-in y la creación/anulación de pagos no cambian
Los endpoints que ya exigían sesión y rol antes de este change SHALL mantener exactamente las
mismas reglas de autorización que tenían: crear pago (`POST /payments/`), anular pago (`DELETE
/payments/{id}`), los KPIs de pagos (`GET /payments/reports/*`) y marcar asistencia (`POST
/attendance/checkin`).

#### Scenario: Coach sigue pudiendo registrar pagos y marcar asistencia
- **WHEN** un Coach con sesión vigente crea un pago o marca la asistencia de un miembro
- **THEN** la API responde 200/201 igual que antes de este change

#### Scenario: Solo el Dueño sigue pudiendo anular un pago
- **WHEN** un Coach con sesión vigente intenta anular un pago (`DELETE /payments/{id}`)
- **THEN** la API responde 403, igual que antes de este change

### Requirement: Las vistas públicas del frontend siguen funcionando sin sesión
Las vistas públicas del frontend SHALL seguir funcionando sin sesión pese a la protección nueva
de estos endpoints: un visitante sin sesión que abre `/login`, o un miembro sin sesión que abre
`/invitacion/:channel/:token`, SHALL poder completar ese flujo con normalidad — ver el
formulario de login, o aceptar la invitación y definir su contraseña — sin ver un toast de
"sesión expirada" ni ser redirigido en un loop, sin importar que la app dispare en segundo plano
una llamada a un endpoint que ahora exige sesión (por ejemplo `GET /settings`).

#### Scenario: Visitante sin sesión en /login
- **WHEN** una persona sin sesión abre `/login`
- **THEN** ve el formulario de login normalmente (usuario, contraseña, botón "Entrar")
- **THEN** no ve ningún toast de "sesión expirada" ni es redirigido a otra ruta antes de someter
  el formulario

#### Scenario: Miembro sin sesión completa su invitación
- **WHEN** un miembro sin sesión abre un link de invitación vigente en
  `/invitacion/:channel/:token`
- **THEN** puede ver el estado de su invitación y definir su contraseña con normalidad, sin ver
  un toast de "sesión expirada" ni ser redirigido fuera de esa ruta antes de completar el flujo

### Requirement: Endpoints de planes de membresía exigen rol Dueño o Coach
Los endpoints de planes de membresía SHALL exigir sesión vigente de rol Dueño o Coach: listado,
detalle, crear, editar, agregar precio y desactivar. Una petición sin token, con token inválido, o
con sesión de rol Miembro SHALL NOT recibir datos de planes ni producir ningún cambio sobre ellos.

#### Scenario: Sin token
- **WHEN** se llama a cualquier endpoint de planes (listado, detalle, crear, editar, agregar
  precio o desactivar) sin encabezado de autorización
- **THEN** la API responde 401 y no devuelve ni modifica datos de planes

#### Scenario: Miembro autenticado
- **WHEN** un Miembro con sesión vigente llama a cualquier endpoint de planes
- **THEN** la API responde 403 y no devuelve ni modifica datos de planes

#### Scenario: Dueño o Coach autenticados
- **WHEN** un Dueño o un Coach con sesión vigente llaman a un endpoint de planes con datos válidos
- **THEN** la API responde 200/201 con el resultado correspondiente

### Requirement: Endpoint de cambio de plan de un miembro exige rol Dueño o Coach
El endpoint que cambia el plan vigente de un miembro SHALL exigir sesión vigente de rol Dueño o
Coach. Una petición sin token, con token inválido, o con sesión de rol Miembro SHALL NOT modificar
el plan de ningún miembro.

#### Scenario: Sin token
- **WHEN** se llama al endpoint de cambio de plan de un miembro sin encabezado de autorización
- **THEN** la API responde 401 y el plan del miembro no cambia

#### Scenario: Miembro autenticado
- **WHEN** un Miembro con sesión vigente llama al endpoint de cambio de plan (el suyo propio o el
  de otro miembro)
- **THEN** la API responde 403 y el plan del miembro no cambia

#### Scenario: Dueño o Coach autenticados
- **WHEN** un Dueño o un Coach con sesión vigente llaman al endpoint de cambio de plan con un plan
  activo válido
- **THEN** la API responde 200 y el plan vigente del miembro queda actualizado

