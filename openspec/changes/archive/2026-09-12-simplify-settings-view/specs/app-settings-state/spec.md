## MODIFIED Requirements

### Requirement: Los cambios de configuración se propagan de inmediato
Toda la UI que usa un dato de configuración SHALL reflejar su cambio de inmediato apenas se
guarda desde cualquier vista, sin recargar la página y sin que el usuario tenga que navegar a
otra vista y volver.

#### Scenario: Guardar el nombre del negocio
- **WHEN** el Dueño cambia el nombre del gimnasio en `/settings` y guarda
- **THEN** el pie de página muestra el nombre nuevo de inmediato, sin recargar la página
- **THEN** al navegar a `/dashboard`, el nombre nuevo también aparece ahí

#### Scenario: Una vista nueva no necesita suscribirse a nada
- **WHEN** se agrega una pantalla que muestra un dato de configuración y esa configuración
  cambia mientras la pantalla está visible
- **THEN** la pantalla refleja el valor nuevo sin requerir que quien la escribió registre una
  suscripción manual a un evento global

## ADDED Requirements

### Requirement: Campos deprecados fuera del modelo de configuración
La configuración del negocio (`AppSettings`) SHALL NOT incluir los campos `default_fee`,
`late_fee_grace_days`, `payment_reminder_message`, `payment_reminder_last_sent_at` ni
`theme_preference`, ni en el modelo de datos, ni en la API, ni en el estado compartido del
frontend. Los campos vigentes que SHALL seguir existiendo sin cambios son: `gym_name`,
`currency`, `allow_cash`, `allow_transfer`, `admin_name`, `address`, `contact_email`,
`contact_phone`, `whatsapp_phone`, `business_hours`, `payment_alias`, `payment_notes` y
`onboarding_message`.

#### Scenario: GET /settings sin campos deprecados
- **WHEN** cualquier cliente autenticado consulta `GET /settings`
- **THEN** la respuesta no incluye `default_fee`, `late_fee_grace_days`,
  `payment_reminder_message`, `payment_reminder_last_sent_at` ni `theme_preference`

#### Scenario: PUT o PATCH /settings rechaza los campos deprecados
- **WHEN** un cliente envía `default_fee`, `late_fee_grace_days`, `payment_reminder_message`,
  `payment_reminder_last_sent_at` o `theme_preference` en el body de `PUT /settings` o
  `PATCH /settings`
- **THEN** el servidor no los persiste ni los acepta como parte del schema de configuración

#### Scenario: El estado compartido del frontend no expone los campos deprecados
- **WHEN** cualquier vista o componente lee el estado compartido de configuración del negocio
- **THEN** el tipo y los datos disponibles no incluyen `default_fee`, `late_fee_grace_days`,
  `payment_reminder_message`, `payment_reminder_last_sent_at` ni `theme_preference`

#### Scenario: Los campos vigentes se mantienen intactos
- **WHEN** cualquier cliente autenticado consulta `GET /settings`
- **THEN** la respuesta sigue incluyendo `gym_name`, `currency`, `allow_cash`, `allow_transfer`,
  `admin_name`, `address`, `contact_email`, `contact_phone`, `whatsapp_phone`, `business_hours`,
  `payment_alias`, `payment_notes` y `onboarding_message`
