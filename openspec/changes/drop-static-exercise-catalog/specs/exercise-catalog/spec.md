## ADDED Requirements

> **Ronda 3.** Este delta tenía un tercer requirement, "Disponibilidad de un ejercicio para los
> días según su grupo muscular", que se **retira**: `template-owned-routine-days` (archivado
> después de que este change quedara parado) eliminó el catálogo global de días de entrenamiento.
> Qué días de una plantilla incluyen un ejercicio dejó de derivarse de su `muscle_group` y pasó a
> ser una decisión explícita del Dueño o Coach al editar esa plantilla (ver `routine-templates`,
> "Alta y baja de ejercicios en un día de plantilla mediante búsqueda"). Sincronizar aquel
> requirement ahora contradiría la spec vigente. Lo que sigue siendo de este change es que el
> catálogo arranca y puede quedarse vacío, y que ese vacío se explica en la UI.

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
- **THEN** el ejercicio sigue inactivo y no se ofrece para agregar a un día de plantilla, hasta que
  alguien lo reactive explícitamente

### Requirement: Estado vacío accionable en el listado del catálogo
El sistema SHALL mostrar, cuando el catálogo de ejercicios está completamente vacío (sin ningún
filtro ni búsqueda aplicada, y en la primera página del listado), un mensaje distinto del que se
usa cuando una búsqueda o un filtro no encuentran resultados: el mensaje **"Catálogo vacío"** con
el texto "Todavía no cargaste ningún ejercicio. Cargá el primero para empezar a armar tus
plantillas de rutina." y una acción **"Crear ejercicio"** que abre el alta, en vez de mostrar un
listado en blanco sin explicación. Esta acción SHALL ofrecerse tanto a un Dueño como a un Coach,
igual que la acción "Crear ejercicio" ya disponible en la cabecera de la pantalla. Con cualquier
búsqueda o filtro aplicado — texto, grupo muscular, tipo de entrenamiento o estado — el sistema
SHALL mostrar el mensaje de sin resultados y NO SHALL ofrecer la acción de crear el primer
ejercicio, porque el listado vacío no significa que el catálogo lo esté.

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

#### Scenario: Un filtro sin resultados tampoco muestra el catálogo como vacío
- **WHEN** un Dueño con 20 ejercicios cargados, ninguno de "Hombros", elige el filtro de grupo
  muscular "Hombros" sin escribir ninguna búsqueda
- **THEN** el sistema muestra el mensaje de sin resultados, no "Catálogo vacío", y no ofrece la
  acción de crear el primer ejercicio
