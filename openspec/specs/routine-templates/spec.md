## Purpose

Plantillas de rutina que un Dueño o Coach arma con sus propios días (1 a 5, cada uno con su
propio grupo muscular) y sus propios ejercicios, agregados desde el catálogo de ejercicios
mediante un buscador. Cada ejercicio dentro de un día tiene su propia base (series × reps · kg) y
su estrategia de progresión, exclusivas de esa combinación (plantilla, día, ejercicio). Cubre
también las reglas de edición y eliminación de plantillas, y el guardado del borrador acumulado de
cambios. Las estrategias en sí se especifican en `progression-strategies`; la asignación a
Miembros, en `routine-assignment`.

## Requirements

### Requirement: Alta de plantilla de rutina
Un Dueño o Coach SHALL poder crear una plantilla de rutina indicando únicamente un nombre y una
etiqueta corta (por ejemplo FUERZA, HIPERTROFIA, RECOMP, INICIO). La creación NO SHALL pedir
selección de días. Toda plantilla recién creada SHALL nacer con exactamente un día (Día 1), sin
grupo muscular asignado todavía y sin ejercicios, listo para configurarse desde el detalle de la
plantilla.

#### Scenario: Crear una plantilla indicando solo nombre y etiqueta
- **WHEN** un Coach crea una plantilla indicando nombre "Full body inicial" y etiqueta "INICIO"
- **THEN** el sistema crea la plantilla con esos datos, sin pedirle seleccionar ningún día

#### Scenario: Una plantilla nueva nace con el Día 1 ya presente
- **WHEN** un Dueño termina de crear una plantilla nueva
- **THEN** al abrir su detalle encuentra un único día, "Día 1", sin grupo muscular asignado y sin
  ejercicios, listo para configurarse

### Requirement: Edición de nombre, etiqueta y días de una plantilla
Un Dueño o Coach SHALL poder editar el nombre y la etiqueta de una plantilla existente, y SHALL
poder agregar o quitar días propios de esa plantilla, hasta un máximo de 5 días y un mínimo de 1
día: la plantilla NO SHALL poder quedar sin ningún día. Cada día pertenece exclusivamente a la
plantilla que lo contiene — editar o quitar un día de una plantilla NO SHALL afectar a ningún día
de ninguna otra plantilla. Quitar un día de una plantilla SHALL eliminar también, junto con él, el
grupo muscular y los ejercicios (con su base y estrategia propias) que ese día tenía configurados.
Cada día SHALL tener asignado un grupo muscular compuesto por uno o más valores del mismo enum de
grupo muscular usado por el catálogo de ejercicios, editable por quien edita la plantilla, y
mostrado como "Día N - <grupos musculares unidos por "/">", donde N es la posición del día
(1..5).

#### Scenario: Renombrar una plantilla
- **WHEN** un Dueño edita el nombre de "Fuerza 4 días" a "Fuerza 4 días · Avanzado"
- **THEN** el sistema guarda el nuevo nombre y lo refleja en cualquier lugar donde se muestre esa
  plantilla

#### Scenario: Agregar un día hasta el máximo de 5
- **WHEN** un Coach agrega días a una plantilla que ya tiene 4 días propios
- **THEN** el sistema permite agregar un quinto día, "Día 5", con grupo muscular sin asignar y sin
  ejercicios

#### Scenario: No se puede agregar un sexto día
- **WHEN** un Coach intenta agregar un día a una plantilla que ya tiene 5 días propios
- **THEN** el sistema rechaza el alta del sexto día y la plantilla conserva sus 5 días

#### Scenario: No se puede quitar el último día de una plantilla
- **WHEN** un Dueño intenta quitar el único día que le queda a una plantilla
- **THEN** el sistema rechaza la eliminación y la plantilla conserva ese día

#### Scenario: Quitar un día distinto del último elimina su configuración
- **WHEN** un Coach quita el Día 3 de una plantilla que tiene 4 días, y ese Día 3 tenía grupo
  muscular y ejercicios configurados
- **THEN** el sistema elimina ese día junto con su grupo muscular y sus ejercicios configurados
  para esa plantilla, sin afectar a ningún otro día de ninguna plantilla

#### Scenario: Editar el grupo muscular de un día
- **WHEN** un Dueño edita el Día 1 de una plantilla y selecciona "Pecho" y "Tríceps" como grupos
  musculares
- **THEN** el día pasa a mostrarse como "Día 1 - Pecho/Tríceps"

#### Scenario: Editar el grupo muscular de un día de una plantilla no afecta a otras
- **WHEN** un Coach edita el grupo muscular del Día 1 de la plantilla "Fuerza 4 días" sin tocar la
  plantilla "Hipertrofia 3 días"
- **THEN** el Día 1 de "Hipertrofia 3 días" conserva su grupo muscular sin cambios

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
Un Dueño o Coach SHALL poder eliminar una plantilla únicamente si no tiene ninguna copia asignada en estado **Activo** a ningún Miembro. Si la plantilla tiene al menos una copia Activa, el sistema SHALL rechazar la eliminación indicando cuántos miembros la tienen asignada como Activa. Una plantilla cuyas únicas copias asignadas estén en estado Alternativa SHALL poder eliminarse: esas copias y su histórico de progreso SHALL sobrevivir intactos, dejando de depender de la plantilla eliminada.

#### Scenario: Eliminar una plantilla sin ninguna asignación
- **WHEN** un Dueño elimina una plantilla que no tiene ninguna copia asignada a ningún Miembro
- **THEN** el sistema la elimina

#### Scenario: Rechazar la eliminación de una plantilla con una copia Activa
- **WHEN** un Coach intenta eliminar la plantilla "Fuerza 4 días", que 2 Miembros tienen como copia
  Activa
- **THEN** el sistema rechaza la eliminación e indica que 2 miembros la tienen asignada como Activa

#### Scenario: Eliminar una plantilla cuyas únicas copias son Alternativas
- **WHEN** un Dueño elimina la plantilla "Full body inicial", de la que solo existen copias en
  estado Alternativa (ningún Miembro la tiene como Activa)
- **THEN** el sistema elimina la plantilla
- **THEN** las copias Alternativas que se habían originado de "Full body inicial", y el progreso
  que sus Miembros ya registraron contra ellas, se conservan intactos

### Requirement: Listado y ficha de plantillas
El sistema SHALL mostrar a Dueño y Coach un listado de las plantillas existentes con, al menos, su
nombre, etiqueta y la cantidad de días que incluye. Al seleccionar una plantilla, SHALL mostrar
únicamente los días propios de esa plantilla, cada uno con su título "Día N - <grupos
musculares>" y, por cada día, sus ejercicios propios con su base y su estrategia elegida.

#### Scenario: El listado solo muestra los días de la plantilla seleccionada
- **WHEN** un Coach selecciona la plantilla "Full body inicial", que tiene 2 días propios
- **THEN** el sistema muestra únicamente esos dos días, cada uno con su título "Día N - <grupos
  musculares>"

### Requirement: Alta y baja de ejercicios en un día de plantilla mediante búsqueda
Un Dueño o Coach SHALL poder agregar ejercicios a un día de una plantilla mediante una barra
buscadora sobre el catálogo de ejercicios. El buscador SHALL ofrecer únicamente ejercicios activos
del catálogo, mostrando de cada uno su nombre, su grupo muscular y sus tipos de entrenamiento. Un
ejercicio ya agregado a ese día NO SHALL volver a ofrecerse en el buscador de ese mismo día. Cada
ejercicio agregado SHALL mostrarse como una card individual con un botón para quitarlo (trash) de
ese día. Al agregar un ejercicio, su base dentro de ese día arranca en un valor fijo por defecto de
3 series × 10 repeticiones × 0 kg, y su estrategia arranca en Constante (ver
`progression-strategies`); a partir de ahí ambas son propias de esa combinación (plantilla, día,
ejercicio) — editarlas no afecta al catálogo ni a ninguna otra plantilla. Un Dueño o Coach SHALL
poder también reordenar los ejercicios dentro de un día; el orden elegido SHALL persistirse.

#### Scenario: Agregar un ejercicio mediante el buscador
- **WHEN** un Coach busca "Press banca plano" en el buscador del Día 1 de una plantilla y lo
  selecciona
- **THEN** el sistema agrega ese ejercicio al Día 1 como una card, con base 3×10 · 0 kg y
  estrategia Constante

#### Scenario: El buscador no ofrece ejercicios inactivos
- **WHEN** un Coach busca en el buscador de un día de plantilla un ejercicio que está inactivo en
  el catálogo
- **THEN** el buscador no lo muestra entre las opciones

#### Scenario: El buscador no vuelve a ofrecer un ejercicio ya agregado a ese día
- **WHEN** "Press banca plano" ya está agregado al Día 1 de una plantilla y un Coach vuelve a
  buscarlo en el buscador de ese mismo día
- **THEN** el buscador no lo ofrece entre las opciones, aunque siga activo en el catálogo

#### Scenario: Buscador sin resultados
- **WHEN** un Coach busca en el buscador de un día de plantilla un término que no coincide con
  ningún ejercicio activo disponible para agregar
- **THEN** el sistema indica que no hay resultados, sin ofrecer ninguna opción

#### Scenario: Quitar un ejercicio de un día con el botón trash
- **WHEN** un Dueño presiona el botón trash de la card de "Aperturas con mancuernas" en el Día 1
  de una plantilla
- **THEN** el ejercicio se quita de ese día, junto con la base y la estrategia que tenía
  configuradas para esa combinación

#### Scenario: El mismo ejercicio con distinta configuración por plantilla
- **WHEN** "Press banca plano" está agregado con estrategia Pirámide y base 4×8 · 45 kg en el
  Día 1 de "Fuerza 4 días", y agregado con estrategia Constante y base 3×10 · 30 kg en el Día 1 de
  "Hipertrofia 3 días"
- **THEN** cada plantilla mantiene su propia base y estrategia de ese ejercicio de forma
  independiente

#### Scenario: Reordenar los ejercicios de un día
- **WHEN** un Coach cambia el orden de los ejercicios del Día 2 de una plantilla
- **THEN** el sistema guarda ese nuevo orden y lo muestra así la próxima vez que se abra el día

### Requirement: Guardado explícito de un borrador acumulado de días y ejercicios
El sistema SHALL acumular como un borrador local, sin persistirlos de inmediato, los cambios sobre
los días y ejercicios de una plantilla (agregar o quitar días, editar el grupo muscular de un día,
agregar o quitar ejercicios de un día, reordenarlos, y editar su base o su estrategia), y SHALL
persistirlos todos juntos en una única operación al confirmar el guardado. Si un Dueño o Coach
intenta salir de la edición de una plantilla con cambios acumulados sin guardar, el sistema SHALL
advertírselo antes de salir, y SHALL permitirle descartar el borrador en vez de guardarlo.

#### Scenario: Varios cambios se persisten en un solo guardado
- **WHEN** un Coach agrega un día, le asigna grupo muscular, agrega dos ejercicios y edita la base
  de uno de ellos, todo sin confirmar el guardado todavía, y luego confirma el guardado
- **THEN** el sistema persiste los cuatro cambios juntos en una única operación

#### Scenario: Aviso al salir con cambios sin guardar
- **WHEN** un Dueño edita el grupo muscular de un día y luego intenta salir de la edición de la
  plantilla sin haber confirmado el guardado
- **THEN** el sistema le advierte que tiene cambios sin guardar antes de dejarlo salir

#### Scenario: Descartar el borrador
- **WHEN** un Coach tiene cambios acumulados sin guardar en la edición de una plantilla y elige
  descartarlos
- **THEN** el sistema descarta el borrador y la plantilla queda tal como estaba antes de esos
  cambios, sin persistir nada
