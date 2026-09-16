## MODIFIED Requirements

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

## ADDED Requirements

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

