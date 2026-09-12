## REMOVED Requirements

### Requirement: Cards de previsualización con acción real
**Reason**: Se revierte la decisión anterior. Las cards de la columna derecha ("Vista previa del
negocio", "Resumen rápido") no se salvan agregándoles un botón o link de acción: se eliminan por
completo junto con la columna derecha, porque siguen repitiendo en texto datos que ya son
editables en el formulario, sea cual sea su nivel de interactividad.
**Migration**: No aplica migración de datos. En UI, el botón "Ver recordatorio en WhatsApp", el
link "Completar WhatsApp" y la función `focusWhatsappField` que les daba soporte se eliminan sin
reemplazo; el formulario de la izquierda pasa a ser la única fuente de esos datos en la vista.

## MODIFIED Requirements

### Requirement: Sin cards informativas redundantes
La vista de Ajustes SHALL NOT mostrar ninguna card puramente informativa que repita en texto lo
que ya está editable en el formulario: ni las 3 `InfoCard` ("Identidad y contacto", "Cobranza
operativa", "Recordatorio mensual"), ni la card lateral "Contexto operativo" del hero, ni las
cards de la columna derecha ("Vista previa del negocio", "Resumen rápido"). El criterio es único
para toda la vista: si un dato ya es editable en el formulario, la vista no lo repite aparte en
una card de solo lectura.

#### Scenario: Carga de Ajustes
- **WHEN** el usuario (Dueño o Coach) navega a `/settings`
- **THEN** no ve las 3 InfoCard, ni la card "Contexto operativo" junto al título, ni las cards
  "Vista previa del negocio" ni "Resumen rápido"

## ADDED Requirements

### Requirement: Formulario de Ajustes en grilla de dos columnas con cards por sección
La vista de Ajustes SHALL presentar el formulario agrupando los campos en cuatro secciones
(Negocio: nombre del gimnasio y moneda; Contacto: responsable, dirección, email, teléfono,
WhatsApp y horario visible; Cobro: efectivo, transferencia, alias y aclaraciones de pago;
Operación: mensaje operativo), cada una dentro de una `Card` (`CardHeader`/`CardTitle` con el
nombre de la sección, `CardContent` con sus campos). A partir del breakpoint `xl` las cards se
distribuyen en una grilla de dos columnas balanceada por altura: Negocio y Cobro en la columna
izquierda, Contacto en la columna derecha, y Operación a lo ancho completo debajo de ambas
columnas; por debajo de `xl` las cuatro cards se apilan en una sola columna. Ninguna columna SHALL
quedar desproporcionadamente más larga que la otra en el layout de dos columnas. Cada campo SHALL
mostrar únicamente su label, sin texto de ayuda debajo. El botón "Guardar cambios" SHALL ubicarse
en una barra de acción al pie del formulario. Que las secciones vuelvan a usar `Card` no reintroduce
las cards de previsualización eliminadas: "Vista previa del negocio" y "Resumen rápido" siguen sin
existir en la vista (ver `## REMOVED Requirements`).

#### Scenario: Grilla de dos columnas en pantallas grandes
- **WHEN** el usuario navega a `/settings` en una pantalla de ancho `xl` o mayor
- **THEN** ve las cards Negocio y Cobro apiladas en la columna izquierda, la card Contacto en la
  columna derecha, y la card Operación ocupando el ancho completo debajo de ambas columnas

#### Scenario: Apilado en pantallas chicas
- **WHEN** el usuario navega a `/settings` en una pantalla más angosta que el breakpoint `xl`
- **THEN** ve las cuatro cards (Negocio, Contacto, Cobro, Operación) apiladas en una sola columna

#### Scenario: Cada sección es una card
- **WHEN** el usuario ve cualquiera de las cuatro secciones del formulario
- **THEN** la sección se presenta como una `Card` con su nombre en un `CardTitle` dentro de
  `CardHeader`, no como un bloque de texto suelto ni una card de previsualización

#### Scenario: Sin texto de ayuda por campo
- **WHEN** el usuario ve el campo "Moneda" en la sección Negocio
- **THEN** encuentra su label y el input, sin ningún texto de ayuda debajo

#### Scenario: Barra de acción al pie
- **WHEN** el usuario llega al final del formulario
- **THEN** encuentra el botón "Guardar cambios" en una barra de acción al pie, no flotando al
  final de una columna lateral

### Requirement: Campos deprecados fuera de la vista
La vista de Ajustes SHALL NOT mostrar como editables los campos deprecados: no hay campo "Cuota
mensual base", no hay campo "Días de tolerancia" y no hay card "Mensaje de recordatorio de pago".

#### Scenario: Campos deprecados ausentes
- **WHEN** el usuario (Dueño o Coach) navega a `/settings`
- **THEN** no encuentra ningún campo editable de "Cuota mensual base" ni de "Días de tolerancia"
- **THEN** no encuentra la card "Mensaje de recordatorio de pago"
