## Purpose

Vista de Dashboard (`/dashboard`): panel operativo diario para Dueño/Coach con KPIs, acciones
rápidas, check-in/pago rápido, pagos recientes y seguimiento de cobros, sin alertas de negocio ni
cards de marca/sesión redundantes.

## Requirements

### Requirement: Sin alerta de bienvenida al loguear
El sistema SHALL redirigir directo del login/registro exitoso a la vista correspondiente
(`/` o `/my-routine`), sin mostrar un popup de alerta de bienvenida intermedio.

#### Scenario: Login exitoso sin alert
- **WHEN** el usuario ingresa credenciales válidas y confirma el login
- **THEN** el sistema redirige a `/` sin mostrar un popup "Bienvenido"

#### Scenario: Registro exitoso sin alert
- **WHEN** el usuario completa el registro de cliente con datos válidos
- **THEN** el sistema redirige a `/my-routine` sin mostrar un popup "Cuenta creada"

### Requirement: Dashboard sin sección de alertas de negocio
La vista de Dashboard SHALL NOT mostrar la sección "Alertas de negocio" (clientes sin pago,
check-ins del día, cobranza encaminada).

#### Scenario: Carga del Dashboard
- **WHEN** el usuario (Dueño o Coach) navega a `/dashboard`
- **THEN** no ve una sección titulada "Alertas de negocio" ni sus cards asociadas

### Requirement: Dashboard sin card lateral de marca/sesión
El hero del Dashboard SHALL mostrar únicamente el bloque principal (título, descripción y
acciones), sin la card lateral de marca/estado de sesión.

#### Scenario: Hero del Dashboard
- **WHEN** el usuario navega a `/dashboard`
- **THEN** el hero no muestra una card lateral con logo, rol actual y período visible

### Requirement: Comportamiento funcional sin cambios
Los KPIs, quick actions, check-in rápido, pago rápido, pagos recientes y seguimiento de cobros
SHALL seguir funcionando igual que antes de este cambio.

#### Scenario: KPIs siguen visibles
- **WHEN** el usuario navega a `/dashboard`
- **THEN** ve las cards de "Clientes activos", "Rutina base" y "Check-ins de hoy" con sus
  valores actualizados
