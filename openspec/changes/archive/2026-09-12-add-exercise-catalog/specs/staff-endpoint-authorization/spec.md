## ADDED Requirements

### Requirement: Endpoints del catálogo de ejercicios exigen rol Dueño o Coach
Los endpoints del catálogo de ejercicios SHALL exigir sesión vigente de rol Dueño o Coach:
listado, detalle, crear, editar, desactivar, reactivar, borrar y subir o reemplazar el archivo de
media. Una petición sin token, con token inválido, o con sesión de rol Miembro SHALL NOT recibir
datos del catálogo ni producir ningún cambio sobre él.

#### Scenario: Sin token
- **WHEN** se llama a cualquier endpoint del catálogo de ejercicios (listado, detalle, crear,
  editar, desactivar, reactivar, borrar o subir media) sin encabezado de autorización
- **THEN** la API responde 401 y no devuelve ni modifica datos del catálogo

#### Scenario: Miembro autenticado
- **WHEN** un Miembro con sesión vigente llama a cualquier endpoint del catálogo de ejercicios
- **THEN** la API responde 403 y no devuelve ni modifica datos del catálogo

#### Scenario: Dueño o Coach autenticados
- **WHEN** un Dueño o un Coach con sesión vigente llaman a un endpoint del catálogo de ejercicios
  con datos válidos
- **THEN** la API responde 200/201 con el resultado correspondiente
