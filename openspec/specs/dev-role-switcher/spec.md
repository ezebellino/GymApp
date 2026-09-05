## Purpose

Herramienta de desarrollo para mirar la app con los ojos de los tres roles sin fricción: un widget
flotante, presente solo en builds de desarrollo, que loguea con un click como uno de tres usuarios
fijos (Dueño, Coach, Miembro con membresía activa), y un seed idempotente (`make seed-dev`) que
garantiza que esos tres usuarios existen y pueden loguearse. Reutiliza el mismo camino de
autenticación que el login manual (`POST /auth/token` → `GET /auth/me` → sesión), no agrega ningún
endpoint de impersonación, y está completamente ausente del bundle de producción (código y
credenciales). Existe para que `role-qa`, `role-dev` y la skill `run-app` prueben los tres roles de
verdad en vez de confiar en un solo punto de vista.

## Requirements

### Requirement: El widget solo existe en builds de desarrollo
El widget de cambio de rol SHALL estar presente en el modo de desarrollo del frontend y SHALL
estar completamente ausente de un build de producción: ni renderizado, ni oculto, ni deshabilitado
— sin rastro de su código ni de las credenciales de los usuarios de desarrollo en el bundle
generado por `npm run build`.

#### Scenario: Visible en desarrollo
- **WHEN** se corre el frontend en modo desarrollo (`make frontend`, `make dev` o
  `make docker-up`) y se abre cualquier ruta de la app, incluida `/login`
- **THEN** el widget flotante de cambio de rol está visible en la pantalla

#### Scenario: Ausente en producción
- **WHEN** se genera un build de producción del frontend (`npm run build`) y se inspecciona el
  resultado
- **THEN** no aparece ningún componente, string ni credencial asociados al widget de cambio de rol
  en los archivos generados

### Requirement: Tres usuarios de desarrollo fijos, uno por rol
El widget SHALL ofrecer exactamente tres usuarios de desarrollo predefinidos, uno por cada rol del
producto: Dueño, Coach y Miembro con membresía activa. Sus credenciales SHALL estar documentadas
en la skill `run-app` para que cualquier agente o persona las conozca sin tener que leer el
código del seed.

#### Scenario: Las tres opciones están disponibles
- **WHEN** se abre el widget en cualquier estado de sesión (logueado o no)
- **THEN** se ven exactamente tres opciones de usuario, una etiquetada como Dueño, otra como
  Coach y otra como Miembro

### Requirement: Cambiar de usuario hace login real y limpia la sesión anterior
Al elegir un usuario desde el widget, el sistema SHALL cerrar la sesión activa (si la hay) antes
de iniciar la nueva, y SHALL loguear al usuario elegido mediante el mismo camino de autenticación
que usa la vista de login (`POST /auth/token` con las credenciales fijas de ese usuario, seguido
de `GET /auth/me` y `setSession`). El sistema SHALL NOT introducir ningún endpoint ni mecanismo
de autenticación distinto del que ya usa el login manual.

#### Scenario: Cambiar de un rol a otro sin restos de la sesión anterior
- **WHEN** un usuario logueado como Coach elige "Miembro" en el widget
- **THEN** la sesión de Coach se cierra (se descarta su token, su caché de datos y su estado en
  el store de sesión) antes de que se establezca la sesión de Miembro
- **THEN** al terminar, la UI muestra el nombre, el rol y los datos del usuario Miembro, sin
  ningún resto del Coach anterior

#### Scenario: Elegir un usuario sin tener sesión previa
- **WHEN** una persona sin sesión (en `/login`) elige "Dueño" en el widget
- **THEN** el sistema loguea a ese usuario y establece su sesión, sin pasos manuales adicionales

### Requirement: Aterrizaje en la home del rol tras el cambio
Después de un cambio de usuario exitoso, el sistema SHALL llevar a la persona a la vista inicial
correspondiente al rol del usuario recién logueado, igual que un login manual.

#### Scenario: Dueño o Coach aterrizan en el dashboard
- **WHEN** se elige "Dueño" o "Coach" en el widget desde cualquier ruta
- **THEN** la app navega a `/dashboard`

#### Scenario: Miembro aterriza en su portal
- **WHEN** se elige "Miembro" en el widget desde cualquier ruta
- **THEN** la app navega a `/my-routine`

### Requirement: Estado colapsado persistente
El widget SHALL poder colapsarse a una forma mínima (que no tape el contenido principal de la
vista) y expandirse de nuevo, y SHALL recordar ese estado (colapsado o expandido) entre recargas
de página.

#### Scenario: Colapsar el widget
- **WHEN** se colapsa el widget
- **THEN** deja de ocupar el espacio de sus opciones de usuario y no bloquea el contenido de la
  vista debajo

#### Scenario: El estado sobrevive a recargar
- **WHEN** se colapsa el widget y se recarga la página
- **THEN** el widget vuelve a aparecer colapsado, sin necesidad de volver a colapsarlo

### Requirement: Error claro cuando el usuario de desarrollo no existe
El widget SHALL mostrar un mensaje de error que identifique el problema y el comando de seed a
correr cuando el login contra `POST /auth/token` para un usuario de desarrollo falla porque la
cuenta no existe (el seed no corrió), en vez de quedar cargando indefinidamente o fallar en
silencio.

#### Scenario: Seed no corrido
- **WHEN** se elige un usuario de desarrollo desde el widget y la API responde que las
  credenciales no existen
- **THEN** el widget muestra un mensaje de error visible que indica que hay que correr el seed de
  usuarios de desarrollo, con el comando exacto a ejecutar
- **THEN** la sesión anterior (si había una) no queda en un estado a medio cerrar: sigue vigente
  o queda cerrada de forma consistente, sin pantalla rota

### Requirement: Indicador de carga durante el cambio de usuario
El widget SHALL mostrar un indicador de carga mientras el cambio de usuario está en curso (entre
elegir la opción y que la nueva sesión quede establecida) y SHALL NOT permitir iniciar un segundo
cambio de usuario en simultáneo.

#### Scenario: Feedback visible durante el cambio
- **WHEN** se elige un usuario en el widget
- **THEN** el widget muestra un indicador de carga hasta que la nueva sesión queda establecida o
  falla con error

#### Scenario: No se puede disparar un segundo cambio mientras el primero está en curso
- **WHEN** se elige un usuario en el widget y, antes de que termine el cambio, se intenta elegir
  otro
- **THEN** el sistema ignora o bloquea la segunda selección hasta que la primera termine

### Requirement: Seed idempotente de usuarios de desarrollo
El repositorio SHALL exponer un script de seed que crea los tres usuarios de desarrollo (Dueño,
Coach, Miembro con membresía activa) con credenciales fijas si no existen, y que al volver a
correrse sobre una base donde ya existen SHALL dejarlos en el mismo estado esperado sin duplicar
usuarios ni fallar.

#### Scenario: Primera corrida crea los tres usuarios
- **WHEN** se corre el script de seed sobre una base de datos que no tiene esos usuarios
- **THEN** al terminar existen exactamente un usuario Dueño, un usuario Coach y un usuario Miembro
  con membresía activa, con las credenciales documentadas, y cada uno puede loguearse contra
  `POST /auth/token`

#### Scenario: Correr el seed dos veces no duplica usuarios
- **WHEN** se corre el script de seed dos veces seguidas
- **THEN** después de la segunda corrida sigue existiendo exactamente un usuario por rol de
  desarrollo, sin filas duplicadas ni error

### Requirement: El seed se niega a correr fuera de desarrollo
El script de seed SHALL rehusarse a ejecutarse cuando el entorno no es de desarrollo, informando
por qué no corrió, en vez de crear usuarios de desarrollo con credenciales conocidas en una base
que no es de desarrollo.

#### Scenario: Intento de correr el seed en un entorno que no es de desarrollo
- **WHEN** se ejecuta el script de seed con la configuración de entorno de un entorno que no es de
  desarrollo
- **THEN** el script termina sin crear ni modificar usuarios y muestra un mensaje explicando que
  se negó a correr fuera de desarrollo
