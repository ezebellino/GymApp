## Purpose

Vocabulario visual de las acciones por fila en las tablas del frontend. Toda acción de fila se
identifica por su **icono**, no por texto, con un mapeo cerrado (`Eye`=Ver, `PencilLine`=Editar,
`LineChart`=Progreso, `Ban`=Anular/Desactivar, `RotateCcw`=Reactivar,
`Trash2`=Quitar/Borrar, `CircleDollarSign`=Agregar precio) y un nombre accesible reducido al
verbo de la acción. El patrón se implementa una sola vez en
`frontend/src/components/RowActionButton.tsx`, de API cerrada a propósito.

Deriva de `docs/design/design.md` ("Per-row actions are `rounded-full` icon-buttons, each with an
accessible name"), que fijaba la forma sin fijar qué icono corresponde a cada acción. El mapeo
concreto y sus reglas de uso están documentados en `frontend/AGENTS.md` (sección Convenciones).

## Requirements

### Requirement: Identificación por icono, no por texto
Toda acción de fila en una tabla del frontend SHALL representarse como un icon-button
(`rounded-full`, sin texto visible), no como un botón de texto.

#### Scenario: Fila de una tabla con acciones
- **WHEN** el usuario ve una fila de una tabla que expone acciones (ej. plan de membresía,
  ejercicio, pago, plantilla asignada)
- **THEN** cada acción se muestra como un icon-button, sin texto de etiqueta junto al icono

### Requirement: Nombre accesible como solo el verbo
Todo icon-button de acción de fila SHALL exponer un `aria-label` compuesto únicamente por el
verbo de la acción (ej. "Ver", "Editar", "Desactivar", "Anular", "Reactivar", "Quitar", "Ajustar
base"), sin el nombre de la entidad de esa fila.

#### Scenario: Nombre accesible de una acción de edición
- **WHEN** un lector de pantalla enfoca el icon-button de editar en cualquier fila de cualquier
  tabla
- **THEN** el nombre accesible anunciado es exactamente "Editar", sin el nombre del registro de
  esa fila

#### Scenario: Nombre accesible de una acción de ver detalle
- **WHEN** un lector de pantalla enfoca el icon-button de ver detalle/perfil en cualquier fila
- **THEN** el nombre accesible anunciado es exactamente "Ver", sin el nombre del registro de esa
  fila

#### Scenario: Nombre accesible de una acción que ya era icon-button
- **WHEN** un lector de pantalla enfoca el icon-button de "Agregar precio" en una fila de plan de
  membresía
- **THEN** el nombre accesible anunciado es exactamente "Agregar precio", sin el nombre del plan
  de esa fila

### Requirement: Verbos distintos para la misma acción de fila conservan su propio nombre accesible
Dos acciones de fila que comparten icono y tratamiento visual pero representan operaciones distintas SHALL conservar cada una su propio verbo en el `aria-label`, en vez de unificarse a un único verbo compartido.

#### Scenario: Borrar un ejercicio frente a quitar una asignación
- **WHEN** el usuario ve el icon-button `Trash2` en una fila de ejercicio y el icon-button
  `Trash2` en una fila de plantilla asignada a un miembro
- **THEN** el primero expone `aria-label` "Borrar" y el segundo expone `aria-label` "Quitar",
  sin unificarse a un verbo común

### Requirement: Toggle de icono según estado activo/inactivo
En toda fila con una acción de activar/desactivar, el icono SHALL depender del estado `is_active`
del registro de esa fila: `Ban` con `aria-label` "Desactivar" (o "Anular" cuando la operación es
anular un pago) cuando el registro está activo, `RotateCcw` con `aria-label` "Reactivar" cuando
el registro está inactivo.

#### Scenario: Fila de un registro activo
- **WHEN** la fila representa un registro con `is_active = true`
- **THEN** la acción de fila muestra el icono `Ban` con `aria-label` "Desactivar" (o "Anular" para
  pagos)

#### Scenario: Fila de un registro inactivo
- **WHEN** la fila representa un registro con `is_active = false`
- **THEN** la acción de fila muestra el icono `RotateCcw` con `aria-label` "Reactivar"

### Requirement: Distinción visual de acciones destructivas
Las acciones de fila que sacan de circulación o eliminan un registro (`Ban` para desactivar/anular, `Trash2` para quitar/borrar/eliminar) SHALL llevar tratamiento visual destructivo (`border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20`), distinguible del tratamiento neutro de las demás acciones de fila (`Eye`, `PencilLine`, `RotateCcw`, `LineChart`, `CircleDollarSign`).

#### Scenario: Acción destructiva en una fila
- **WHEN** el usuario ve el icon-button de "Desactivar", "Anular", "Quitar" o "Borrar" en una fila
- **THEN** ese icon-button lleva el tratamiento visual destructivo, distinto del resto de
  acciones de esa misma fila

#### Scenario: Acción neutra en una fila
- **WHEN** el usuario ve el icon-button de "Ver", "Editar", "Reactivar", "Progreso" o "Agregar
  precio" en una fila
- **THEN** ese icon-button lleva el tratamiento visual outline neutro, no el destructivo

### Requirement: Acciones de cabecera de página fuera de alcance
Las acciones de cabecera de página (no asociadas a una fila de tabla, ej. las de `RoutineTemplateDetail`) SHALL conservar el patrón icono + texto y no están sujetas a los requirements anteriores.

#### Scenario: Botón de cabecera de página
- **WHEN** el usuario ve un botón de acción en la cabecera de una página de detalle (no en una
  fila de tabla)
- **THEN** ese botón puede mostrar icono junto con texto, sin necesidad de ser un icon-button
  `rounded-full` con `aria-label` de solo verbo

### Requirement: Controles de fila que no son botones de acción quedan fuera de alcance
Un control dentro de una fila de tabla o de card que no dispare una acción por sí mismo (ej. un `Switch` que alterna un estado en línea) SHALL quedar fuera de los requirements de esta capability, que aplican únicamente a botones de acción de fila.

#### Scenario: Switch dentro de una fila o card
- **WHEN** el usuario ve un `Switch` que alterna el estado de un ítem dentro de una fila o card
  (ej. `RoutineTemplateDetail`)
- **THEN** ese control no está sujeto a los requirements de icono, tono ni nombre accesible
  reducido al verbo que aplican a los botones de acción de fila

### Requirement: Icono de Progreso en la fila de un Miembro
La fila de un Miembro en la tabla de Usuarios SHALL exponer un tercer icon-button de acción,
"Progreso" (`LineChart`, el mismo icono que identifica "Seguimiento" en la navegación lateral),
junto a los de "Ver" y "Editar" ya existentes, con tratamiento visual neutro y `aria-label`
exactamente "Progreso".

#### Scenario: Fila de un Miembro en la tabla de Usuarios
- **WHEN** un Coach ve la fila de un Miembro en la tabla de Usuarios
- **THEN** ve tres icon-buttons de acción: "Ver", "Editar" y "Progreso", en ese orden de aparición
  junto a las demás acciones de la fila

#### Scenario: Nombre accesible del icono de Progreso
- **WHEN** un lector de pantalla enfoca el icon-button de Progreso en la fila de un Miembro
- **THEN** el nombre accesible anunciado es exactamente "Progreso", sin el nombre del Miembro de
  esa fila
