## ADDED Requirements

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
