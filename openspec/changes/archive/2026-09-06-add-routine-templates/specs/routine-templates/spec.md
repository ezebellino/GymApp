## ADDED Requirements

### Requirement: Alta de plantilla de rutina
Un Dueño o Coach SHALL poder crear una plantilla de rutina indicando nombre, una etiqueta corta
(por ejemplo FUERZA, HIPERTROFIA, RECOMP, INICIO) y un subconjunto ordenado de los días del
catálogo compartido (Día 1..4). Una plantilla nueva SHALL incluir al menos un día.

#### Scenario: Crear una plantilla con dos días
- **WHEN** un Coach crea una plantilla indicando nombre "Full body inicial", etiqueta "INICIO" y
  selecciona el Día 1 y el Día 4 del catálogo
- **THEN** el sistema crea la plantilla con esos dos días, en el orden elegido

#### Scenario: No se puede crear una plantilla sin días
- **WHEN** un Dueño o Coach intenta crear una plantilla sin seleccionar ningún día
- **THEN** el sistema rechaza la creación y no persiste ninguna plantilla

### Requirement: Edición de nombre, etiqueta y días de una plantilla
Un Dueño o Coach SHALL poder editar el nombre y la etiqueta de una plantilla existente, y SHALL
poder agregar o quitar días de su selección. Quitar un día de la plantilla NO SHALL borrar la
configuración (activo/inactivo y estrategia) que tenían sus ejercicios para esa plantilla; si el
día se vuelve a agregar después, esa configuración SHALL reaparecer sin cambios.

#### Scenario: Renombrar una plantilla
- **WHEN** un Dueño edita el nombre de "Fuerza 4 días" a "Fuerza 4 días · Avanzado"
- **THEN** el sistema guarda el nuevo nombre y lo refleja en cualquier lugar donde se muestre esa
  plantilla

#### Scenario: Quitar y volver a agregar un día conserva su configuración
- **WHEN** un Coach quita el Día 3 de una plantilla que ya tenía ejercicios activos con
  estrategias elegidas para ese día, y luego lo vuelve a agregar
- **THEN** el Día 3 reaparece en la plantilla con los mismos ejercicios activos/inactivos y las
  mismas estrategias que tenía antes de quitarlo

### Requirement: Composición de una plantilla por día y ejercicio
Un Dueño o Coach SHALL poder activar o desactivar, para cada combinación (plantilla, día,
ejercicio) de los días incluidos en la plantilla, el ejercicio correspondiente en esa plantilla en
particular. Un ejercicio desactivado para una plantilla SHALL conservar su configuración
(estrategia elegida) sin cambios, únicamente deja de contarse en el plan de esa plantilla para el
cliente.

#### Scenario: Desactivar un ejercicio conserva su estrategia
- **WHEN** un Dueño desactiva "Aperturas con mancuernas" en el Día 1 de la plantilla "Fuerza
  4 días", habiendo tenido elegida la estrategia Pirámide
- **THEN** el ejercicio queda desactivado para esa plantilla y su estrategia sigue siendo Pirámide
  si se reactiva después

#### Scenario: El mismo ejercicio con distinta configuración por plantilla
- **WHEN** "Press banca plano" está activo con estrategia Pirámide en la plantilla "Fuerza 4 días"
  y activo con estrategia Constante en la plantilla "Hipertrofia 3 días"
- **THEN** cada plantilla mantiene su propia configuración de ese ejercicio de forma independiente

### Requirement: Nombre de plantilla único
El sistema SHALL rechazar la creación o el renombre de una plantilla si su nombre coincide, sin
distinguir mayúsculas/minúsculas ni espacios en los bordes, con el de otra plantilla ya existente.
El sistema SHALL indicar con un mensaje claro que el nombre ya está en uso.

#### Scenario: Rechazar un nombre duplicado por mayúsculas
- **WHEN** ya existe una plantilla llamada "Fuerza 4 días" y un Coach intenta crear una plantilla
  llamada "FUERZA 4 DÍAS"
- **THEN** el sistema rechaza la creación con un mensaje que indica que ese nombre ya está en uso

#### Scenario: Rechazar un nombre duplicado por espacios en los bordes
- **WHEN** ya existe una plantilla llamada "Fuerza 4 días" y un Dueño intenta renombrar otra
  plantilla a " Fuerza 4 días "
- **THEN** el sistema rechaza el renombre con un mensaje que indica que ese nombre ya está en uso

### Requirement: Eliminación de una plantilla sin asignaciones
Un Dueño o Coach SHALL poder eliminar una plantilla únicamente si no tiene ninguna asignación
vigente (ni Activa ni Alternativa) a ningún Miembro. Si la plantilla tiene al menos una asignación
vigente, el sistema SHALL rechazar la eliminación indicando cuántos miembros la tienen asignada.

#### Scenario: Eliminar una plantilla sin asignaciones
- **WHEN** un Dueño elimina una plantilla que no tiene ningún Miembro asignado
- **THEN** el sistema la elimina

#### Scenario: Rechazar la eliminación de una plantilla con asignaciones
- **WHEN** un Coach intenta eliminar la plantilla "Fuerza 4 días", que tiene 2 Miembros asignados
- **THEN** el sistema rechaza la eliminación e indica que 2 miembros la tienen asignada

### Requirement: Base del ejercicio al crear o editar en el catálogo
El flujo existente de alta y edición de un ejercicio del catálogo SHALL permitir indicar su base
(series × reps · kg), acción exclusiva del Dueño sin cambios en ese permiso. Si no se indica al
crear el ejercicio, el sistema SHALL asignarle una base por defecto de 3 series × 10 repeticiones
· 0 kg. La UI de este change cubre la edición de la base de un ejercicio existente del catálogo;
NO SHALL agregar una pantalla de alta de ejercicios nueva — el alta con base sigue disponible solo
por el endpoint existente, como ya ocurre hoy con el resto de los campos del ejercicio.

#### Scenario: Crear un ejercicio indicando su base
- **WHEN** se crea un ejercicio nuevo en el catálogo indicando una base de 4 series × 8
  repeticiones · 45 kg
- **THEN** el sistema guarda el ejercicio con esa base

#### Scenario: Crear un ejercicio sin indicar la base
- **WHEN** se crea un ejercicio nuevo en el catálogo sin indicar una base
- **THEN** el sistema lo crea con la base por defecto de 3 series × 10 repeticiones · 0 kg

#### Scenario: Un Dueño edita la base de un ejercicio existente desde la UI
- **WHEN** un Dueño edita, desde la UI del catálogo de ejercicios, un ejercicio existente y le
  cambia la base a 5 series × 5 repeticiones · 70 kg
- **THEN** el sistema guarda la nueva base, que pasa a usarse como punto de partida del cálculo de
  progresión para las plantillas que incluyen ese ejercicio (salvo que exista un ajuste de base
  por cliente para un Miembro en particular)

#### Scenario: Un Coach no puede editar la base de un ejercicio del catálogo
- **WHEN** un Coach intenta editar la base de un ejercicio del catálogo
- **THEN** el sistema rechaza la operación con un error de autorización, igual que con el resto de
  los campos del ejercicio

### Requirement: Listado y ficha de plantillas
El sistema SHALL mostrar a Dueño y Coach un listado de las plantillas existentes con, al menos, su
nombre, etiqueta y la cantidad de días que incluye. Al seleccionar una plantilla, SHALL mostrar
únicamente los días que esa plantilla incluye, y por cada día, sus ejercicios con su estado
activo/inactivo y su estrategia elegida.

#### Scenario: El listado solo muestra los días de la plantilla seleccionada
- **WHEN** un Coach selecciona la plantilla "Full body inicial", que incluye Día 1 y Día 4
- **THEN** el sistema muestra únicamente esos dos días, sin mostrar el Día 2 ni el Día 3
