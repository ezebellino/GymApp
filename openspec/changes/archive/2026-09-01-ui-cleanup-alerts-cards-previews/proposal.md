## Why

El issue #6 (Rediseño UI) agrupa la limpieza visual de la app tras simplificar Login/Registro
(ya implementado y mergeado). Quedan 3 ítems del checklist original: sacar el alert que aparece
al entrar a la app, sacar cards puramente informativas/decorativas que no aportan acción, y
convertir las cards de previsualización de Ajustes en algo interactivo (con links/botones) en
vez de solo texto estático.

## What Changes

- **Alert de la entrada**:
  - Eliminar el popup SweetAlert de bienvenida ("Bienvenido"/"Inicio de sesion correcto" y
    "Cuenta creada"/"Ya podés cargar tu progreso...") que se muestra justo después de loguearse
    o registrarse, antes de redirigir. El redirect ocurre inmediato, sin alert intermedio.
  - Eliminar la sección "Alertas de negocio" del Dashboard (las 3 cards de alerta: clientes sin
    pago, sin check-ins hoy, cobranza encaminada / "todo bajo control").
- **Cards informativas**:
  - Eliminar las 3 `InfoCard` de Settings ("Identidad y contacto", "Cobranza operativa",
    "Recordatorio mensual") que solo repiten en texto lo que ya está editable en los formularios
    de abajo.
  - Eliminar las cards laterales de marca/sesión que hoy aparecen junto al título en Dashboard
    ("Mini Espacio" + "Estado de sesión") y en Settings ("Contexto operativo").
- **Previews de Ajustes**:
  - Las cards de la columna derecha de Ajustes ("Vista previa del negocio", "Tema visual",
    "Resumen rápido") pasan de ser solo texto estático a incluir links/botones de acción que
    abren una previsualización real (ej. abrir el mensaje de recordatorio ya resuelto en
    WhatsApp Web, o ver el detalle completo en un modal/drawer), en vez de ser un simple espejo
    de los datos ya visibles en el formulario.
- La lógica de negocio (auth, settings, dashboard KPIs, WhatsApp reminders) no cambia — es un
  cambio de UI/UX.

## Capabilities

### New Capabilities
- `dashboard-view`: Comportamiento esperado de la vista de Dashboard (KPIs, quick actions,
  check-in/pago rápido, seguimiento de cobros), sin alertas de negocio ni cards de marca/sesión
  redundantes.
- `settings-view`: Comportamiento esperado de la vista de Ajustes (formularios editables +
  columna de previsualización con acciones reales), sin InfoCards redundantes ni card de
  contexto operativo.

### Modified Capabilities
(ninguna — no existen specs previas para estas vistas; `login-view`/`register-client-view` del
change anterior no se tocan)

## Impact

- Código afectado:
  - [frontend/src/pages/Login.tsx](../../../frontend/src/pages/Login.tsx) (quitar alert de
    bienvenida)
  - [frontend/src/pages/RegisterClient.tsx](../../../frontend/src/pages/RegisterClient.tsx)
    (quitar alert de cuenta creada)
  - [frontend/src/pages/Dashboard.tsx](../../../frontend/src/pages/Dashboard.tsx) (quitar
    Alertas de negocio y card de marca/sesión)
  - [frontend/src/pages/Settings.tsx](../../../frontend/src/pages/Settings.tsx) (quitar
    InfoCards y card de contexto operativo; agregar acciones a las cards de preview)
- No afecta backend, API, ni modelos de datos.
