## Purpose

Cómo el frontend lee, cachea, refresca e invalida los datos del servidor (clientes, pagos,
asistencia), y qué ve el usuario mientras cargan o fallan. Alcance actual: Clientes (`/clients`),
Dashboard (`/dashboard`), Pagos (`/payments`) y Asistencia (`/attendance`), incluida la
actualización automática tras cada mutación.

## Requirements

### Requirement: Caché compartida de datos del servidor entre vistas
Los datos que el frontend lee del servidor (clientes, pagos, asistencia) SHALL vivir en una
caché compartida por toda la app, no en una copia por vista. Cuando dos vistas muestran los
mismos datos, ambas SHALL leer de la misma fuente y mostrar los mismos valores.

Alcance de esta entrega: Clientes (`/clients`), Dashboard (`/dashboard`), Pagos (`/payments`) y
Asistencia (`/attendance`).

#### Scenario: Volver a una vista ya visitada no muestra pantalla vacía
- **WHEN** el Dueño abre `/clients`, espera a que cargue la lista, navega a `/payments` y vuelve
  a `/clients` dentro de un lapso breve
- **THEN** la lista de clientes se muestra de inmediato con los datos ya conocidos, sin estado de
  carga vacío intermedio
- **THEN** el sistema no emite una nueva petición de la lista de clientes para pintar esa vista

#### Scenario: Dos vistas muestran el mismo dato con el mismo valor
- **WHEN** el Dueño ve el total de clientes activos en `/dashboard` y luego abre `/clients`
- **THEN** la cantidad de clientes activos listados coincide con el valor mostrado en el
  Dashboard, sin discrepancias por copias desactualizadas

#### Scenario: Revalidación en segundo plano sin interrumpir la lectura
- **WHEN** el Dueño vuelve a una vista cuyos datos ya expiraron su ventana de frescura
- **THEN** la vista se pinta de inmediato con los últimos datos conocidos
- **THEN** el sistema pide los datos actualizados en segundo plano y la vista se refresca sola
  cuando llegan, sin pasar por una pantalla vacía

### Requirement: Estado de carga consistente
Mientras no haya datos que mostrar, Clientes, Dashboard, Pagos y Asistencia SHALL mostrar un
indicador de carga con el mismo tratamiento visual y textual en las cuatro vistas. Ninguna de
ellas SHALL mostrar un área en blanco sin indicación de que está cargando.

#### Scenario: Primera carga de cada vista
- **WHEN** el Dueño abre por primera vez `/clients`, `/dashboard`, `/payments` o `/attendance` y
  los datos todavía no llegaron
- **THEN** ve un indicador de carga en el área de contenido
- **THEN** el indicador es equivalente en las cuatro vistas (mismo tratamiento, no uno distinto
  por pantalla)

#### Scenario: El indicador desaparece al llegar los datos
- **WHEN** los datos de la vista terminan de cargar
- **THEN** el indicador de carga desaparece y se muestra el contenido

### Requirement: Estado de error consistente y recuperable
Cuando la lectura de datos del servidor falla, Clientes, Dashboard, Pagos y Asistencia SHALL
mostrar un mensaje de error visible con el mismo tratamiento en las cuatro vistas, y SHALL NOT
quedar indefinidamente en estado de carga ni mostrar un área vacía sin explicación. El estado de
error SHALL ser recuperable sin recargar la página a mano.

#### Scenario: La API no responde
- **WHEN** el Dueño abre `/payments` y la petición de datos falla
- **THEN** ve un mensaje de error en el área de contenido, en español
- **THEN** la vista no queda mostrando el indicador de carga de forma indefinida

#### Scenario: Recuperación tras un error transitorio
- **WHEN** la vista está mostrando el estado de error, el servidor vuelve a responder y el
  usuario vuelve a entrar a la vista
- **THEN** el sistema reintenta la lectura y muestra los datos, sin necesidad de recargar la
  página desde el navegador

#### Scenario: Fallo parcial no rompe la vista completa
- **WHEN** en `/dashboard` falla una de las lecturas de datos y las otras responden bien
- **THEN** el bloque afectado muestra su estado de error
- **THEN** el resto del Dashboard sigue mostrando sus datos normalmente

### Requirement: Actualización automática después de una mutación
Toda vista que muestre datos afectados por una mutación SHALL reflejar el cambio sin que el
usuario recargue la página, ya sea que el usuario registre un pago, borre un pago, haga un
check-in, cree un cliente o edite un cliente. El usuario SHALL NOT tener que navegar a otra
vista y volver, ni apretar F5, para ver el resultado de su propia acción.

#### Scenario: Registrar un pago
- **WHEN** el Dueño registra un pago desde `/payments`
- **THEN** el pago aparece en la lista de pagos y los totales de la vista se actualizan solos
- **THEN** al navegar a `/dashboard`, los pagos recientes y el seguimiento de cobros ya incluyen
  ese pago, sin recargar la página

#### Scenario: Borrar un pago
- **WHEN** el Dueño borra un pago desde `/payments`
- **THEN** el pago desaparece de la lista y los totales se recalculan solos
- **THEN** el Dashboard deja de mostrarlo en pagos recientes al volver a esa vista

#### Scenario: Registrar un check-in
- **WHEN** el Coach registra un check-in de un cliente
- **THEN** el contador "Check-ins de hoy" del Dashboard refleja el nuevo check-in sin recargar
  la página
- **THEN** la vista `/attendance` muestra el check-in registrado al abrirla

#### Scenario: Crear un cliente
- **WHEN** el Dueño da de alta un cliente nuevo desde `/clients`
- **THEN** el cliente aparece en la lista de clientes
- **THEN** el Dashboard actualiza la cantidad de clientes activos y el cliente queda disponible
  para elegir al registrar un pago o un check-in, sin recargar la página

#### Scenario: Editar un cliente
- **WHEN** el Dueño edita el nombre de un cliente existente
- **THEN** la lista de clientes muestra el nombre nuevo
- **THEN** las demás vistas que nombran a ese cliente (pagos, asistencia, Dashboard) muestran el
  nombre nuevo, sin recargar la página

#### Scenario: Una mutación fallida no deja datos falsos en pantalla
- **WHEN** el usuario confirma una de estas acciones y el servidor la rechaza
- **THEN** el sistema informa el error al usuario
- **THEN** las vistas siguen mostrando los datos reales del servidor, sin dejar en pantalla el
  cambio que no se llegó a guardar
