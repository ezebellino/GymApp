# exercise-catalog Specification

## Purpose

Catálogo de ejercicios compartido: nombre único, descripción, grupo muscular (lista fija, uno por
ejercicio) y tipos de entrenamiento (lista fija, cero o más), con media de demostración (archivo
propio y/o URL externa) y estado activo/inactivo. Cubre el CRUD para Dueño y Coach, la regla de
que un ejercicio en uso (referenciado por alguna plantilla de rutina o alguna sesión/registro de
entrenamiento) no se puede borrar y solo se puede desactivar, y el listado con búsqueda y filtros.
La composición de ejercicios dentro de una plantilla — activarlos o desactivarlos por plantilla,
su estrategia de progresión y su base (series × reps · kg) — se especifica en
`routine-templates`; la asignación de plantillas a Miembros, en `routine-assignment`.

## Requirements

### Requirement: Crear un ejercicio con nombre único
El sistema SHALL permitir a un Dueño o Coach crear un ejercicio indicando nombre (obligatorio),
descripción, grupo muscular y tipos de entrenamiento (todos opcionales). El nombre SHALL ser
único entre los ejercicios existentes (sin distinguir mayúsculas/minúsculas ni espacios al
inicio/final); un intento de crear un ejercicio con un nombre ya usado SHALL ser rechazado sin
crear el registro. El ejercicio SHALL nacer activo.

#### Scenario: Crear un ejercicio válido
- **WHEN** un Dueño o Coach crea un ejercicio con nombre "Press de banca", sin grupo muscular ni
  tipos ni media
- **THEN** el sistema crea el ejercicio como activo, sin media asociada

#### Scenario: Nombre de ejercicio duplicado rechazado
- **WHEN** un Dueño o Coach intenta crear un ejercicio con un nombre que ya usa otro ejercicio
  existente (activo o inactivo), sin importar mayúsculas ni espacios extra al principio o final
- **THEN** el sistema rechaza la operación sin crear un ejercicio nuevo

#### Scenario: Nombre vacío rechazado
- **WHEN** un Dueño o Coach intenta crear un ejercicio sin indicar nombre, o con un nombre que
  son solo espacios
- **THEN** el sistema rechaza la operación sin crear el registro

### Requirement: Editar un ejercicio existente
El sistema SHALL permitir a un Dueño o Coach editar el nombre, la descripción, el grupo
muscular, los tipos de entrenamiento y la media de un ejercicio existente, sujeto a la misma
regla de unicidad de nombre. Editar un ejercicio SHALL NOT alterar las plantillas o sesiones que
ya lo referencian.

#### Scenario: Editar nombre y descripción
- **WHEN** un Dueño o Coach edita el nombre y la descripción de un ejercicio existente con un
  nombre que no está en uso por otro ejercicio
- **THEN** el sistema guarda los nuevos valores

#### Scenario: Editar a un nombre ya usado por otro ejercicio
- **WHEN** un Dueño o Coach intenta editar el nombre de un ejercicio para que coincida (sin
  distinguir mayúsculas ni espacios extra) con el de otro ejercicio existente
- **THEN** el sistema rechaza la edición y el nombre del ejercicio no cambia

#### Scenario: Editar un ejercicio usado en una plantilla no afecta la plantilla
- **WHEN** un Dueño o Coach edita la descripción o el grupo muscular de un ejercicio que ya está
  agregado a una o más plantillas
- **THEN** el sistema guarda los cambios
- **THEN** las plantillas que lo referencian lo siguen mostrando actualizado, sin perder la
  referencia

### Requirement: Grupo muscular de lista fija, uno por ejercicio
El sistema SHALL permitir asignar a un ejercicio, como máximo, un grupo muscular elegido de la
lista fija del sistema (Pecho, Espalda, Hombros, Bíceps, Tríceps, Antebrazo, Core, Glúteos,
Cuádriceps, Isquios, Gemelos, Cuerpo completo). El grupo muscular SHALL ser opcional. El sistema
SHALL NOT aceptar un valor de grupo muscular que no esté en esa lista.

#### Scenario: Crear un ejercicio sin grupo muscular
- **WHEN** un Dueño o Coach crea un ejercicio sin elegir grupo muscular
- **THEN** el sistema lo crea sin grupo muscular asignado

#### Scenario: Asignar un grupo muscular válido
- **WHEN** un Dueño o Coach crea o edita un ejercicio eligiendo "Espalda" como grupo muscular
- **THEN** el sistema guarda ese ejercicio con grupo muscular "Espalda"

#### Scenario: Valor de grupo muscular fuera de la lista fija rechazado
- **WHEN** se intenta guardar un ejercicio con un grupo muscular que no pertenece a la lista fija
  del sistema
- **THEN** el sistema rechaza la operación y el ejercicio no queda con ese valor

### Requirement: Tipos de entrenamiento de lista fija, cero o más por ejercicio
El sistema SHALL permitir asignar a un ejercicio cero, uno o varios tipos de entrenamiento
elegidos de la lista fija del sistema (Fuerza, Hipertrofia, Resistencia, Cardio, Movilidad,
Funcional, Rehabilitación). El sistema SHALL NOT aceptar un valor de tipo que no esté en esa
lista.

#### Scenario: Crear un ejercicio con varios tipos
- **WHEN** un Dueño o Coach crea un ejercicio y elige los tipos "Fuerza" e "Hipertrofia"
- **THEN** el sistema guarda el ejercicio con ambos tipos asociados

#### Scenario: Crear un ejercicio sin ningún tipo
- **WHEN** un Dueño o Coach crea un ejercicio sin elegir ningún tipo de entrenamiento
- **THEN** el sistema lo crea sin tipos asociados

#### Scenario: Valor de tipo fuera de la lista fija rechazado
- **WHEN** se intenta guardar un ejercicio con un tipo de entrenamiento que no pertenece a la
  lista fija del sistema
- **THEN** el sistema rechaza la operación y el ejercicio no queda con ese tipo

### Requirement: Media independiente — archivo propio y URL externa
El sistema SHALL permitir asociar a un ejercicio, de forma independiente y opcional, un archivo
de media propio (subido por el staff) y una URL de media externa. Un ejercicio SHALL poder tener
uno de los dos, los dos, o ninguno. Cuando un ejercicio tiene ambos, el sistema SHALL mostrar el
archivo propio como la media principal; la URL externa queda guardada pero no se muestra como
principal mientras exista el archivo propio.

#### Scenario: Solo archivo propio
- **WHEN** un ejercicio tiene un archivo propio subido y ninguna URL externa
- **THEN** el sistema muestra el archivo propio como la demostración del ejercicio

#### Scenario: Solo URL externa
- **WHEN** un ejercicio tiene una URL externa cargada y ningún archivo propio
- **THEN** el sistema muestra la URL externa como la demostración del ejercicio

#### Scenario: Archivo propio y URL externa a la vez
- **WHEN** un ejercicio tiene tanto un archivo propio subido como una URL externa cargada
- **THEN** el sistema muestra el archivo propio como la demostración del ejercicio
- **THEN** la URL externa queda guardada en el ejercicio, disponible aunque no sea la que se
  muestra

#### Scenario: Ningún archivo ni URL
- **WHEN** un ejercicio no tiene archivo propio ni URL externa cargada
- **THEN** el sistema lo muestra sin demostración de media, sin marcarlo como error

#### Scenario: Quitar el archivo propio deja visible la URL externa
- **WHEN** un ejercicio tiene archivo propio y URL externa, y el Dueño o Coach quita el archivo
  propio
- **THEN** el sistema conserva la URL externa
- **THEN** el sistema pasa a mostrar la URL externa como la demostración del ejercicio

### Requirement: Validación de la URL externa
El sistema SHALL validar que el valor cargado como URL externa de media tenga formato de URL
válida. Un valor que no sea una URL válida SHALL ser rechazado, sin modificar el ejercicio.

#### Scenario: URL externa válida
- **WHEN** un Dueño o Coach carga una URL de YouTube o de un GIF alojado con formato de URL
  válido
- **THEN** el sistema la guarda como la URL externa del ejercicio

#### Scenario: Texto que no es una URL rechazado
- **WHEN** un Dueño o Coach intenta cargar como URL externa un texto que no tiene formato de URL
- **THEN** el sistema rechaza la operación y el ejercicio no queda con ese valor

### Requirement: Validación de formato y tamaño al subir un archivo de media
El sistema SHALL aceptar, como archivo propio de media, un video o una imagen (incluye GIF
animado) dentro de un tamaño máximo definido por el sistema. Un archivo de un formato no
soportado, o que supere el tamaño máximo, SHALL ser rechazado sin guardarse ni reemplazar la
media existente del ejercicio.

#### Scenario: Subir un archivo de formato y tamaño soportados
- **WHEN** un Dueño o Coach sube un video o una imagen en un formato soportado y dentro del
  tamaño máximo permitido
- **THEN** el sistema lo guarda como el archivo propio del ejercicio

#### Scenario: Formato no soportado rechazado
- **WHEN** un Dueño o Coach intenta subir un archivo de un formato no soportado (por ejemplo, un
  documento)
- **THEN** el sistema rechaza la subida, informa el motivo, y el ejercicio conserva la media que
  tenía antes del intento

#### Scenario: Archivo que excede el tamaño máximo rechazado
- **WHEN** un Dueño o Coach intenta subir un archivo que supera el tamaño máximo permitido por el
  sistema
- **THEN** el sistema rechaza la subida, informa el motivo, y el ejercicio conserva la media que
  tenía antes del intento

### Requirement: La subida de un archivo nuevo reemplaza al anterior
El sistema SHALL permitir reemplazar el archivo propio de un ejercicio subiendo uno nuevo válido;
el archivo anterior SHALL dejar de estar asociado al ejercicio una vez completado el reemplazo.
Si la subida del archivo nuevo falla, el sistema SHALL conservar el archivo anterior sin cambios.

#### Scenario: Reemplazar un archivo propio existente
- **WHEN** un Dueño o Coach sube un archivo nuevo válido a un ejercicio que ya tenía un archivo
  propio
- **THEN** el sistema asocia el archivo nuevo al ejercicio como su media principal
- **THEN** el archivo anterior deja de mostrarse en el ejercicio

#### Scenario: Falla la subida del archivo de reemplazo
- **WHEN** falla la subida de un archivo nuevo destinado a reemplazar el archivo propio de un
  ejercicio
- **THEN** el ejercicio conserva el archivo propio que tenía antes del intento, sin cambios

### Requirement: Desactivar un ejercicio en vez de borrarlo cuando está en uso
El sistema SHALL permitir a un Dueño o Coach desactivar un ejercicio activo. El sistema SHALL NOT
ofrecer un ejercicio desactivado como opción para agregarlo a una plantilla nueva. Las
plantillas y sesiones que ya referencian a ese ejercicio SHALL conservarlo sin cambios. Para un
ejercicio que está en uso (referenciado por alguna plantilla de rutina o alguna sesión/registro
de entrenamiento), desactivar SHALL ser la única forma de retirarlo del catálogo activo — el
sistema SHALL NOT permitir borrarlo (ver requirement "Borrar un ejercicio que nunca se usó" para
el caso en que sí se puede borrar).

#### Scenario: Desactivar un ejercicio no usado
- **WHEN** un Dueño o Coach desactiva un ejercicio que no está en ninguna plantilla
- **THEN** el ejercicio queda inactivo
- **THEN** deja de aparecer entre las opciones para agregar a una plantilla nueva

#### Scenario: Desactivar un ejercicio usado en una plantilla
- **WHEN** un Dueño o Coach desactiva un ejercicio que ya está agregado a una o más plantillas, o
  que tiene sesiones registradas
- **THEN** el ejercicio queda inactivo
- **THEN** las plantillas y sesiones que ya lo referencian lo conservan sin cambios

#### Scenario: Reactivar un ejercicio
- **WHEN** un Dueño o Coach reactiva un ejercicio previamente desactivado
- **THEN** el ejercicio vuelve a ofrecerse como opción para agregar a una plantilla nueva

### Requirement: Borrar un ejercicio que nunca se usó
El sistema SHALL permitir a un Dueño o Coach borrar definitivamente un ejercicio que **nunca**
fue referenciado por ninguna plantilla de rutina ni por ninguna sesión/registro de
entrenamiento de un miembro. El vínculo automático entre un ejercicio y el catálogo fijo de días
(generado por el seed a partir del grupo muscular) SHALL NOT contar como uso a este efecto. Si
el ejercicio borrado tenía un archivo propio subido, el sistema SHALL eliminar también ese
archivo del almacenamiento. Un intento de borrar un ejercicio que sí está en uso SHALL ser
rechazado con un mensaje que indique el motivo y ofrezca desactivarlo en su lugar; el ejercicio
SHALL NOT quedar borrado ni modificado por ese intento.

#### Scenario: Borrar un ejercicio nunca usado
- **WHEN** un Dueño o Coach borra un ejercicio recién creado que nunca fue agregado a una
  plantilla ni tiene sesiones registradas
- **THEN** el sistema borra el ejercicio definitivamente
- **THEN** el ejercicio deja de aparecer en el catálogo, incluido en el listado de inactivos

#### Scenario: Borrar un ejercicio nunca usado con archivo propio subido
- **WHEN** un Dueño o Coach borra un ejercicio nunca usado que tiene un archivo propio subido
- **THEN** el sistema borra el ejercicio
- **THEN** el archivo propio queda eliminado del almacenamiento

#### Scenario: Intento de borrar un ejercicio en uso rechazado
- **WHEN** un Dueño o Coach intenta borrar un ejercicio que está agregado a alguna plantilla de
  rutina, o que tiene alguna sesión/registro de entrenamiento
- **THEN** el sistema rechaza el borrado, informa que el ejercicio está en uso, y ofrece
  desactivarlo como alternativa
- **THEN** el ejercicio sigue existiendo, activo y sin cambios

#### Scenario: El vínculo automático del catálogo fijo de días no bloquea el borrado
- **WHEN** un Dueño o Coach intenta borrar un ejercicio que solo tiene el vínculo automático
  generado por el seed del catálogo fijo de días para su grupo muscular, y ninguna plantilla de
  rutina ni sesión lo referencia
- **THEN** el sistema permite el borrado, sin considerar ese vínculo automático como uso

### Requirement: Listado del catálogo con búsqueda y filtros
El sistema SHALL mostrar un listado de ejercicios con búsqueda por texto (nombre), filtro por
grupo muscular, filtro por tipo de entrenamiento, y filtro por estado (activo / inactivo),
combinables entre sí, siguiendo el mismo patrón del listado de Planes: acciones de crear, editar
y desactivar/reactivar disponibles en diálogos desde ese listado.

#### Scenario: Buscar un ejercicio por nombre
- **WHEN** un Dueño o Coach busca un ejercicio por parte de su nombre en el listado del catálogo
- **THEN** el listado muestra únicamente los ejercicios cuyo nombre coincide con la búsqueda

#### Scenario: Filtrar por grupo muscular
- **WHEN** un Dueño o Coach filtra el listado por el grupo muscular "Cuádriceps"
- **THEN** el listado muestra únicamente los ejercicios con ese grupo muscular asignado

#### Scenario: Filtrar por tipo de entrenamiento
- **WHEN** un Dueño o Coach filtra el listado por el tipo "Movilidad"
- **THEN** el listado muestra únicamente los ejercicios que tienen ese tipo entre los suyos

#### Scenario: Filtrar por inactivos
- **WHEN** un Dueño o Coach filtra el listado por estado "inactivo"
- **THEN** el listado muestra únicamente los ejercicios desactivados

#### Scenario: Combinar filtros
- **WHEN** un Dueño o Coach busca por texto y a la vez filtra por grupo muscular y por estado
  "activo"
- **THEN** el listado muestra solo los ejercicios que cumplen las tres condiciones a la vez
