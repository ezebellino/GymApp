## ADDED Requirements

### Requirement: Disponibilidad de un ejercicio para los días según su grupo muscular
El sistema SHALL ofrecer un ejercicio como opción para agregar a una plantilla en el día de
entrenamiento cuyo grupo muscular coincida con el del ejercicio, y SHALL actualizar esa
disponibilidad de inmediato cada vez que se crea el ejercicio o se le edita el grupo muscular —
sin depender de ninguna otra acción posterior sobre el sistema. Un ejercicio sin grupo muscular
asignado SHALL NOT ofrecerse para ningún día. Esto no altera plantillas que ya tienen el
ejercicio agregado: seguir ofreciéndose (o dejar de ofrecerse) para agregarlo a una plantilla
nueva es independiente de si ya está en uso en una existente (ver "Editar un ejercicio existente").

Un ejercicio recién creado, o que cambia de grupo muscular, SHALL nacer activo para el día que le
corresponde: un Dueño o Coach que lo agrega a una plantilla ya lo encuentra activo ahí, sin
necesitar un paso adicional de activación aparte de agregarlo a la plantilla. Esto es lo que hace
que el recorrido completo — cargar un ejercicio, agregarlo a una plantilla, asignar esa plantilla
a un Miembro — deje al ejercicio visible en "Mi rutina" del Miembro sin ningún paso oculto. Un
Dueño o Coach que no quiera que un ejercicio cuente para una plantilla en particular lo desactiva
ahí explícitamente (ver `routine-templates`, "Composición de una plantilla por día y ejercicio");
esa desactivación es una decisión tomada, no un estado de arranque.

#### Scenario: Un ejercicio nuevo queda disponible y activo para el día de su grupo muscular
- **WHEN** un Dueño crea el ejercicio "Elevaciones laterales" con grupo muscular "Hombros"
- **THEN** el ejercicio aparece entre las opciones para agregar a una plantilla en el día de
  entrenamiento configurado para "Hombros", ya activo para ese día

#### Scenario: Cambiar el grupo muscular mueve el ejercicio al día que corresponde
- **WHEN** un Dueño edita "Aperturas con mancuernas" (grupo muscular "Pecho", ofrecido hoy para el
  día de "Pecho") y le cambia el grupo muscular a "Espalda"
- **THEN** el ejercicio deja de ofrecerse como opción nueva para el día de "Pecho"
- **THEN** el ejercicio pasa a ofrecerse, activo, como opción nueva para el día de "Espalda"

#### Scenario: Un ejercicio sin grupo muscular no se ofrece para ningún día
- **WHEN** un Dueño crea o edita un ejercicio dejándolo sin grupo muscular asignado
- **THEN** el ejercicio no aparece entre las opciones de ningún día de entrenamiento

#### Scenario: Cargar un ejercicio y asignarlo lo deja visible para el Miembro sin pasos ocultos
- **WHEN** un Dueño con el catálogo vacío crea el ejercicio "Sentadilla libre" con grupo muscular
  "Cuádriceps", lo agrega al día correspondiente de la plantilla "Fuerza 4 días" y le asigna esa
  plantilla a un Miembro
- **THEN** ese Miembro ve "Sentadilla libre" en "Mi rutina", en el día de "Cuádriceps", sin que el
  Dueño haya tenido que hacer ninguna acción de activación aparte de agregarlo a la plantilla

### Requirement: El catálogo no se repone automáticamente
El sistema SHALL NOT recrear, reactivar ni volver a ofrecer por su cuenta un ejercicio que un
Dueño o Coach haya borrado o desactivado. El catálogo SHALL poder quedar sin ningún ejercicio
cargado como estado normal y estable, no solo transitorio: nada en el sistema repuebla el
catálogo automáticamente.

#### Scenario: Un catálogo recién instalado no tiene ejercicios
- **WHEN** un gimnasio nuevo entra por primera vez al catálogo de ejercicios
- **THEN** no ve ningún ejercicio hasta que un Dueño o Coach carga el primero a mano

#### Scenario: Un ejercicio borrado no vuelve a aparecer
- **WHEN** un Dueño borra un ejercicio nunca usado y después usa el sistema con normalidad (crea
  otros ejercicios, entra y sale de distintas pantallas)
- **THEN** el ejercicio borrado no vuelve a aparecer en el catálogo en ningún momento posterior

#### Scenario: Un ejercicio desactivado no vuelve a aparecer como disponible por su cuenta
- **WHEN** un Coach desactiva un ejercicio y después usa el sistema con normalidad
- **THEN** el ejercicio sigue inactivo y no se ofrece para agregar a una plantilla nueva, hasta que
  alguien lo reactive explícitamente

### Requirement: Estado vacío accionable en el listado del catálogo
El sistema SHALL mostrar, cuando el catálogo de ejercicios está completamente vacío (sin ningún
filtro ni búsqueda aplicada), un mensaje distinto del que se usa cuando una búsqueda no encuentra
resultados: el mensaje **"Catálogo vacío"** con el texto "Todavía no cargaste ningún ejercicio.
Cargá el primero para empezar a armar tus plantillas de rutina." y una acción **"Crear
ejercicio"** que abre el alta, en vez de mostrar un listado en blanco sin explicación. Esta acción
SHALL ofrecerse tanto a un Dueño como a un Coach, igual que la acción "Crear ejercicio" ya
disponible en la cabecera de la pantalla.

#### Scenario: Catálogo vacío en la pantalla de ejercicios
- **WHEN** un Dueño abre la pantalla del catálogo de ejercicios y todavía no se cargó ningún
  ejercicio, sin ningún filtro ni búsqueda aplicada
- **THEN** la pantalla muestra "Catálogo vacío", el texto "Todavía no cargaste ningún ejercicio.
  Cargá el primero para empezar a armar tus plantillas de rutina." y la acción "Crear ejercicio",
  en vez de una tabla vacía

#### Scenario: Un Coach también puede crear el primer ejercicio desde el estado vacío
- **WHEN** un Coach (no un Dueño) abre la pantalla del catálogo de ejercicios estando vacío
- **THEN** ve la misma acción "Crear ejercicio" que un Dueño, y puede usarla para cargar el primer
  ejercicio

#### Scenario: Una búsqueda sin resultados conserva su propio mensaje
- **WHEN** un Dueño busca por un texto que no coincide con ningún ejercicio, en un catálogo que sí
  tiene ejercicios cargados
- **THEN** el sistema muestra el mensaje de "sin resultados de la búsqueda", no el de catálogo
  vacío, y no ofrece la acción de crear el primer ejercicio
