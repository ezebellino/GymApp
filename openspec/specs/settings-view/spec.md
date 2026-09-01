## Purpose

Vista de Ajustes (`/settings`): formularios editables de configuración del negocio (identidad,
cobranza, recordatorio, tema visual) acompañados de una columna de previsualización con acciones
reales, sin cards puramente informativas/redundantes.

## Requirements

### Requirement: Sin cards informativas redundantes
La vista de Ajustes SHALL NOT mostrar las cards puramente informativas que repiten en texto lo
que ya está editable en los formularios: las 3 `InfoCard` ("Identidad y contacto", "Cobranza
operativa", "Recordatorio mensual") y la card lateral "Contexto operativo" del hero.

#### Scenario: Carga de Ajustes
- **WHEN** el usuario (Dueño o Coach) navega a `/settings`
- **THEN** no ve las 3 InfoCard ni la card "Contexto operativo" junto al título

### Requirement: Cards de previsualización con acción real
Las cards de la columna derecha de Ajustes ("Vista previa del negocio", "Tema visual", "Resumen
rápido") SHALL incluir al menos un link o botón de acción cada una, en vez de ser solo texto
estático.

#### Scenario: Preview del negocio con acción
- **WHEN** el usuario ve la card "Vista previa del negocio"
- **THEN** encuentra un botón "Ver recordatorio en WhatsApp" que abre `wa.me` con el mensaje de
  recordatorio de pago resuelto (placeholders reemplazados por datos de ejemplo/reales)
- **THEN** el botón está deshabilitado si no hay `whatsapp_phone` cargado

#### Scenario: Resumen rápido con acción cuando falta un dato
- **WHEN** el dato "WhatsApp principal" está sin cargar
- **THEN** el "Resumen rápido" muestra un link "Completar WhatsApp" que enfoca el campo
  correspondiente del formulario

### Requirement: Formularios de Ajustes sin cambios funcionales
La edición y guardado de la configuración del negocio (identidad, cobranza, recordatorio,
tema visual) SHALL seguir funcionando igual que antes de este cambio.

#### Scenario: Guardar cambios
- **WHEN** el Dueño edita un campo y hace click en "Guardar cambios"
- **THEN** el sistema persiste la configuración vía `PUT /settings` como antes
