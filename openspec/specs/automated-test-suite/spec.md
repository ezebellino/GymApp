## Purpose

Suite de tests automatizados del repo: el piso mínimo ejecutable que permite verificar un change
corriendo comandos en vez de a mano. Cubre autenticación y separación de roles en el backend
(pytest) y el render de las vistas con spec en el frontend (Vitest), y se ejecuta desde la raíz con
`make test`. Existe para destrabar al rol `role-qa` y al gate `/opsx:verify`, que sin ella marcan
como NO VERIFICABLE todo escenario que requiera ejecución.

No persigue cobertura: lo que queda fuera (flujos de UI, reportes/KPIs, E2E) está declarado
explícitamente en `AGENTS.md` para que nadie infiera una red que no existe.

## Requirements

### Requirement: Punto de entrada único para correr la suite
El repositorio SHALL exponer desde la raíz el comando `make test`, que ejecuta la suite de
backend y la de frontend, y SHALL terminar con código de salida distinto de cero si al menos un
test falla. El comando MUST reportar en su salida qué test falló y en qué app.

#### Scenario: Suite completa en verde
- **WHEN** un agente o desarrollador corre `make test` desde la raíz del repo con todos los tests
  pasando
- **THEN** la salida muestra el resultado de la suite de backend y el de la de frontend
- **THEN** el comando termina con código de salida 0

#### Scenario: Un test falla
- **WHEN** se corre `make test` y al menos un test de cualquiera de las dos apps falla
- **THEN** la salida identifica el test que falló y el motivo del fallo
- **THEN** el comando termina con código de salida distinto de cero

#### Scenario: Los comandos son descubribles
- **WHEN** un agente o desarrollador corre `make help` desde la raíz
- **THEN** ve listados `test`, `test-backend` y `test-frontend` con su descripción

### Requirement: Comandos de suite por aplicación
El repositorio SHALL exponer `make test-backend` y `make test-frontend`, que ejecutan
únicamente la suite de la app correspondiente y propagan su resultado como código de salida.

#### Scenario: Correr solo la suite de backend
- **WHEN** se corre `make test-backend`
- **THEN** se ejecutan solo los tests del backend, sin ejecutar los del frontend
- **THEN** el código de salida refleja si esos tests pasaron o fallaron

#### Scenario: Correr solo la suite de frontend
- **WHEN** se corre `make test-frontend`
- **THEN** se ejecutan solo los tests del frontend, sin ejecutar los del backend
- **THEN** el código de salida refleja si esos tests pasaron o fallaron

#### Scenario: Los comandos no requieren la app levantada a mano
- **WHEN** se corre `make test`, `make test-backend` o `make test-frontend` sin haber ejecutado
  antes `make dev`, `make backend`, `make frontend` ni `make docker-up`
- **THEN** las suites se ejecutan igual y devuelven un resultado

### Requirement: Smoke de autenticación del backend
La suite de backend SHALL cubrir el camino feliz de autenticación de punta a punta contra la API:
alta de cuenta de cliente, login con esas credenciales y consulta de la identidad autenticada con
el token obtenido.

#### Scenario: Registro de cliente devuelve una sesión utilizable
- **WHEN** el test registra una cuenta de cliente nueva vía `POST /auth/client-register` con
  nombre, email y contraseña válidos
- **THEN** la respuesta es exitosa e incluye un `access_token` de tipo `bearer`

#### Scenario: Login con credenciales válidas
- **WHEN** el test hace `POST /auth/token` con el email y la contraseña de una cuenta existente
- **THEN** la respuesta es exitosa e incluye un `access_token` de tipo `bearer`

#### Scenario: Login con contraseña incorrecta
- **WHEN** el test hace `POST /auth/token` con un email existente y una contraseña equivocada
- **THEN** la API responde con error de credenciales y no devuelve ningún token

#### Scenario: Endpoint protegido con token válido
- **WHEN** el test consulta `GET /auth/me` enviando el token obtenido en el login
- **THEN** la API responde exitosamente con los datos del usuario autenticado, incluido su rol

### Requirement: Rechazo de acceso sin credenciales válidas
La suite de backend SHALL verificar que un endpoint protegido responde 401 cuando la petición no
trae token o trae un token que no es válido.

#### Scenario: Petición sin token
- **WHEN** el test consulta `GET /auth/me` sin encabezado de autorización
- **THEN** la API responde con estado 401 y no expone datos de ningún usuario

#### Scenario: Petición con token inválido
- **WHEN** el test consulta `GET /auth/me` con un token arbitrario o manipulado que no fue emitido
  por la API
- **THEN** la API responde con estado 401 y no expone datos de ningún usuario

### Requirement: Autorización por rol en endpoints restringidos
La suite de backend SHALL verificar, para los tres roles del sistema (`owner` = Dueño,
`coach` = Coach, `user` = Cliente), que un rol sin permiso recibe 403 en endpoints restringidos y
que el rol habilitado sí accede. Los tests MUST apuntar a endpoints que hoy declaran restricción
de rol, sin inventar restricciones que la API no tiene.

#### Scenario: Cliente no accede a la gestión de clientes
- **WHEN** el test consulta el listado de clientes (`GET /clients`) con el token de un usuario de
  rol `user` (Cliente)
- **THEN** la API responde con estado 403 y no devuelve el listado

#### Scenario: Coach no accede a un endpoint exclusivo del Dueño
- **WHEN** el test consulta la gestión de coaches (`GET /coaches`) con el token de un usuario de
  rol `coach`
- **THEN** la API responde con estado 403

#### Scenario: Dueño accede al endpoint exclusivo
- **WHEN** el test consulta la gestión de coaches (`GET /coaches`) con el token de un usuario de
  rol `owner`
- **THEN** la API responde exitosamente
- **THEN** queda demostrado que el 403 del escenario anterior se debe al rol y no al endpoint

#### Scenario: Coach accede a lo que sí tiene habilitado
- **WHEN** el test consulta el listado de clientes (`GET /clients`) con el token de un usuario de
  rol `coach`
- **THEN** la API responde exitosamente

### Requirement: Aislamiento y repetibilidad de la suite de backend
La suite de backend SHALL ejecutarse contra un entorno de datos propio y descartable: MUST NOT
conectarse a la base de datos de producción ni a la base de desarrollo del colaborador, y MUST NOT
depender de datos preexistentes. Cada test que necesite usuarios, roles o clientes MUST crearlos
como parte de su propia preparación.

#### Scenario: No toca datos reales
- **WHEN** se corre `make test-backend` en una máquina cuya configuración apunta a una base de
  datos de desarrollo o producción con datos cargados
- **THEN** la suite pasa igual
- **THEN** al terminar, los datos de esa base quedan sin modificar (no aparecen usuarios, clientes
  ni pagos creados por los tests)

#### Scenario: Sin datos previos
- **WHEN** se corre `make test-backend` por primera vez en una máquina limpia, sin seeds ni
  usuarios cargados a mano
- **THEN** la suite pasa sin requerir ningún paso manual de carga de datos

#### Scenario: Dos corridas seguidas dan el mismo resultado
- **WHEN** se corre `make test-backend` dos veces consecutivas sin cambiar código
- **THEN** ambas corridas informan el mismo resultado (mismos tests, mismo veredicto)
- **THEN** la segunda corrida no falla por conflictos con datos dejados por la primera (por
  ejemplo, email ya registrado)

### Requirement: Test de render por cada vista con spec
La suite de frontend SHALL incluir al menos un test de render por cada vista que hoy tiene una
capability en `openspec/specs/`: `login-view`, `register-client-view`, `dashboard-view` y
`settings-view`. Cada test MUST afirmar elementos que la spec de esa vista promete que se ven y,
cuando la spec lo declara explícitamente, que los elementos eliminados no aparecen.

#### Scenario: Render de la vista de login
- **WHEN** el test renderiza la vista `/login`
- **THEN** encuentra el nombre de marca "Gym App", el campo "Usuario", el campo "Contraseña", el
  botón "Entrar" y el link "Registrar cuenta"
- **THEN** no encuentra banner de demo, contador de conexión ni aviso de reactivación de backend

#### Scenario: Render de la vista de registro de cliente
- **WHEN** el test renderiza la vista `/register-client`
- **THEN** encuentra el header de marca "Gym App", los campos de contraseña y confirmación, y el
  link "Volver al login"
- **THEN** no encuentra el eyebrow "Registro de cliente" ni el título "Crear acceso personal"

#### Scenario: Render de la vista de dashboard
- **WHEN** el test renderiza la vista `/dashboard`
- **THEN** encuentra las cards de KPI "Clientes activos", "Rutina base" y "Check-ins de hoy"
- **THEN** no encuentra una sección titulada "Alertas de negocio"

#### Scenario: Render de la vista de ajustes
- **WHEN** el test renderiza la vista `/settings`
- **THEN** encuentra los formularios de configuración del negocio y la card "Vista previa del
  negocio" con su botón "Ver recordatorio en WhatsApp"
- **THEN** no encuentra las InfoCard "Identidad y contacto", "Cobranza operativa" ni "Recordatorio
  mensual", ni la card "Contexto operativo"

### Requirement: Los tests de frontend detectan una vista rota
Los tests de render SHALL fallar cuando la vista deje de renderizar o desaparezca un elemento que
su spec declara obligatorio, y SHALL ejecutarse sin necesidad de tener el backend levantado.

#### Scenario: Vista que rompe al renderizar
- **WHEN** una de las vistas cubiertas lanza un error durante el render
- **THEN** `make test-frontend` falla e identifica la vista afectada

#### Scenario: Elemento prometido por la spec que desaparece
- **WHEN** se elimina de una vista cubierta un elemento que su spec declara visible (por ejemplo,
  el botón "Entrar" en login)
- **THEN** `make test-frontend` falla señalando el elemento faltante

#### Scenario: Sin backend disponible
- **WHEN** se corre `make test-frontend` sin ningún backend levantado ni base de datos accesible
- **THEN** los tests de render se ejecutan y devuelven un resultado igual que con el backend
  levantado

### Requirement: La documentación de agentes describe la suite existente
La documentación de agentes SHALL reflejar que existe una suite ejecutable: `AGENTS.md` de raíz,
`backend/AGENTS.md` y `frontend/AGENTS.md` MUST indicar cómo correr los tests, y MUST NOT seguir
afirmando que el repo no tiene tests automatizados. La skill `role-qa` MUST describir que la
verificación arranca por correr la suite.

#### Scenario: La raíz documenta el comando
- **WHEN** un agente lee el `AGENTS.md` de la raíz
- **THEN** encuentra `make test`, `make test-backend` y `make test-frontend` documentados
- **THEN** no encuentra la afirmación de que no hay test suite en el repo

#### Scenario: Cada app documenta su suite
- **WHEN** un agente lee `backend/AGENTS.md` o `frontend/AGENTS.md`
- **THEN** encuentra cómo correr los tests de esa app y dónde viven sus archivos de test

#### Scenario: El rol QA sabe que puede ejecutar tests
- **WHEN** un agente adopta el rol `role-qa`
- **THEN** la skill le indica correr la suite automatizada como primer paso de verificación y
  reservar el "NO VERIFICABLE" para lo que la suite y la prueba manual no alcanzan
- **THEN** la skill ya no afirma que toda verificación es manual por falta de tests

#### Scenario: Sin drift entre proveedores
- **WHEN** se corre `make agents-check` después de actualizar la documentación de agentes
- **THEN** no reporta drift entre `.agents/` y los directorios generados de cada proveedor
