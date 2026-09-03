## ADDED Requirements

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
- **THEN** encuentra un botón que abre el mensaje de recordatorio de pago (con placeholders
  resueltos, usando datos de ejemplo) en WhatsApp

#### Scenario: Resumen rápido con acción cuando falta un dato
- **WHEN** un dato clave (ej. WhatsApp principal) está sin cargar
- **THEN** el "Resumen rápido" ofrece un link/botón que lleva al campo correspondiente del
  formulario para completarlo

### Requirement: Formularios de Ajustes sin cambios funcionales
La edición y guardado de la configuración del negocio (identidad, cobranza, recordatorio,
tema visual) SHALL seguir funcionando igual que antes de este cambio.

#### Scenario: Guardar cambios
- **WHEN** el Dueño edita un campo y hace click en "Guardar cambios"
- **THEN** el sistema persiste la configuración vía `PUT /settings` como antes
