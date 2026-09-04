## ADDED Requirements

### Requirement: Configuración del negocio compartida por toda la app
La app SHALL mantener una única fuente de verdad para la configuración del negocio (nombre del
gimnasio, datos de contacto, cobranza y recordatorio de pago), compartida por todas las vistas y
componentes que la muestran o la usan. Todas SHALL mostrar el mismo valor en todo momento.

#### Scenario: Un mismo dato se ve igual en toda la app
- **WHEN** el Dueño abre la app con una configuración de negocio ya guardada
- **THEN** el nombre del gimnasio y los datos de contacto se ven iguales en el pie de página, en
  el Dashboard y en Ajustes, sin discrepancias entre pantallas

### Requirement: Los cambios de configuración se propagan de inmediato
Toda la UI que usa un dato de configuración SHALL reflejar su cambio de inmediato apenas se
guarda desde cualquier vista, sin recargar la página y sin que el usuario tenga que navegar a
otra vista y volver.

#### Scenario: Guardar el nombre del negocio
- **WHEN** el Dueño cambia el nombre del gimnasio en `/settings` y guarda
- **THEN** el pie de página muestra el nombre nuevo de inmediato, sin recargar la página
- **THEN** al navegar a `/dashboard`, el nombre nuevo también aparece ahí

#### Scenario: Configuración actualizada desde otra vista
- **WHEN** el Dueño envía los recordatorios de pago desde `/payments` y eso actualiza la fecha
  del último recordatorio enviado
- **THEN** las vistas que muestran ese dato lo reflejan actualizado sin recargar la página

#### Scenario: Una vista nueva no necesita suscribirse a nada
- **WHEN** se agrega una pantalla que muestra un dato de configuración y esa configuración
  cambia mientras la pantalla está visible
- **THEN** la pantalla refleja el valor nuevo sin requerir que quien la escribió registre una
  suscripción manual a un evento global

### Requirement: La configuración persiste entre recargas
La configuración vigente SHALL persistir localmente para que la app pueda pintar sus valores
apenas carga, sin esperar a la respuesta del servidor, y SHALL alinearse con el servidor cuando
este responde.

#### Scenario: Recargar la página
- **WHEN** el Dueño guarda un cambio de configuración y recarga la página
- **THEN** ve el valor guardado, sin volver a la configuración anterior ni a un valor por defecto

#### Scenario: El servidor manda sobre lo persistido
- **WHEN** la app carga con una configuración persistida y el servidor devuelve valores distintos
- **THEN** la UI pasa a mostrar los valores del servidor

### Requirement: El tema visual se aplica en toda la app y persiste
El tema visual elegido SHALL aplicarse a toda la app apenas se cambia, sin recargar la página, y
SHALL seguir aplicado en la siguiente carga.

#### Scenario: Cambiar el tema
- **WHEN** el Dueño elige otro tema visual en `/settings`
- **THEN** la apariencia de la app cambia de inmediato en toda la pantalla, incluidos menú
  lateral, barra superior y pie de página

#### Scenario: El tema sobrevive a recargar
- **WHEN** el Dueño cambia el tema y recarga la página
- **THEN** la app se muestra con el tema elegido desde el primer render, sin destello del tema
  anterior
