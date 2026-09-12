# Design: unify-row-action-icons

## Context

El design doc (`docs/design/design.md:275`) ya define el patrón: *"Per-row actions are
`rounded-full` icon-buttons, each with an accessible name"*. Hoy conviven tres patrones distintos
en el frontend:

1. **Icon-button con label compuesto** — `Users.tsx:369,379`, `MembershipPlans.tsx:313,323`,
   `Exercises.tsx:340`: `<Button variant="outline" size="icon-sm" aria-label={\`Editar ${x.name}\`}
   title={...}><Icon className="h-3.5 w-3.5" /></Button>`. Único uso de `size="icon-sm"` fuera de
   `components/dev/DevRoleSwitcher.tsx:138`.
2. **Botón de texto `size="sm"`** — `MembershipPlans.tsx:334,347` (Desactivar/Reactivar),
   `Exercises.tsx:347,356,366` (Desactivar/Reactivar/**Borrar**), `Payments.tsx:360` (Anular),
   `MemberTemplatesCard.tsx:97,105` (Ajustar base / Quitar).
3. **Botón de texto con tinte destructivo ad-hoc** — `MemberTemplatesCard.tsx:108` y
   `RoutineTemplateDetail.tsx:116` repiten a mano el string
   `border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20`.

Verificación del blast radius (no asumido, chequeado sobre el árbol actual):

| Archivo | Acciones de fila | Estado |
|---|---|---|
| `frontend/src/pages/Users.tsx` | `Eye` (:369), `PencilLine` (:379) | ya icon-button; solo `aria-label` |
| `frontend/src/pages/MembershipPlans.tsx` | `PencilLine` (:313), `CircleDollarSign` (:323), Desactivar (:334), Reactivar (:347) | 2 a convertir + 2 labels |
| `frontend/src/pages/Exercises.tsx` | `PencilLine` (:340), Desactivar (:347), Reactivar (:356), **Borrar (:366)** | 3 a convertir + 1 label |
| `frontend/src/pages/Payments.tsx` | Anular (:360) | 1 a convertir |
| `frontend/src/components/MemberTemplatesCard.tsx` | Ajustar base (:97), Quitar (:105) | 2 a convertir |
| `frontend/src/pages/Routines.tsx` | Ver (:154) | 1 a convertir — **omitido en el relevamiento inicial**, ver D10 |

Dos hallazgos que **no** estaban en el listado de entrada de este change y sí caen bajo el
requirement "Identificación por icono, no por texto":

- **`Exercises.tsx:366` "Borrar"**: es una tercera acción de fila, botón de texto, distinta de
  "Desactivar". Entra en alcance (ver D7).
- **`MembershipPlans.tsx:323` "Agregar precio a ${plan.name}"**: ya es icon-button, pero su
  `aria-label` lleva el nombre de la entidad y por lo tanto viola el requirement "Nombre accesible
  como solo el verbo". Entra en alcance solo por el label (ver D8).

`frontend/src/pages/Routines.tsx` se sumó a la tabla **después de la verificación**: el
relevamiento original listó 5 archivos y omitió éste, que es una `<Table>` con
`TableBody`/`TableRow` idéntica a las otras cuatro vistas (`Routines.tsx:95`) y cuya celda de
acciones renderiza un `<Button size="sm">` con el texto "Ver" y
`aria-label={\`Ver plantilla ${template.name}\`}`. Como el requirement está redactado de forma
incondicional ("Toda acción de fila en una tabla del frontend"), publicar la spec con ese botón
vivo dejaría un contraejemplo en la app desde el día uno. Entra en alcance sin excepción: el
tratamiento es el ya decidido —`RowActionButton` con `icon={Eye}`, `label="Ver"`, tono neutro— y lo
único nuevo que hay que decidir es el choque con `stopPropagation` (D10).

Fuera de alcance, confirmado: `RoutineTemplateDetail.tsx:111,119` son acciones de cabecera de
página (la spec las excluye explícitamente) y `DevRoleSwitcher.tsx:138` no es acción de fila.

**`RoutineTemplateDetail.tsx:175` también queda fuera, y no se re-discute**: es un `Switch` con
`aria-label={\`Activar o desactivar ${exercise.name}\`}` dentro de una card de ejercicio de un día,
no una celda de acciones de una fila de `<Table>`. No es un botón, no es icon-button y su estado
(on/off) es la información que el control comunica, así que ni el requirement de "icono, no texto"
ni el de "nombre accesible como solo el verbo" lo alcanzan — un `Switch` sin el nombre de la
entidad sería *menos* accesible, porque en esa card hay uno por ejercicio y no hay fila de tabla
que dé contexto. Es el segundo sobreviviente del grep de `aria-label={\`` sobre `frontend/src`, y
es correcto que sobreviva.

Estado de los tests (verificado archivo por archivo): la mayoría de los fixtures tienen **una sola
fila**, así que varias queries por verbo sobreviven por accidente. Los que rompen seguro son
`Exercises.test.tsx:135` (`"Editar Press de banca"`), `Users.test.tsx:270`
(`/^ver perfil de ana gomez$/i`) y `MembershipPlans.test.tsx:87` (`"Agregar precio a ..."`, si se
aplica D8). El resto (`MembershipPlans.test.tsx:114,135`, `Payments.test.tsx:194,208,212`,
`MemberTemplatesCard.test.tsx:131`, `Exercises.test.tsx:173,178`) sigue pasando tal cual — pero
pasar por casualidad de fixture no es lo mismo que estar bien escrito: D5 los migra igual al patrón
canónico, porque el día que alguien agregue una segunda fila al fixture explotan todos juntos.

## Goals / Non-Goals

**Goals:**

- Un único lugar en el código que decida tamaño, forma, tinte, `aria-label` y `title` de una acción
  de fila, de modo que los requirements de la spec sean verificables en un solo punto y no por
  inspección de 5 archivos.
- Un patrón canónico de test para acciones de fila, escrito acá, que Dev y QA apliquen sin
  improvisar uno distinto por archivo.
- Resolver el choque entre `title` como tooltip y `title` como explicación de por qué un botón está
  deshabilitado.

**Non-Goals:**

- No se toca `backend/`, ni contratos de API, ni el modelo de datos.
- No se toca el comportamiento de las acciones (qué diálogo abren, qué mutación disparan): este
  change es de presentación y de nombre accesible, nada más.
- No se introduce una librería de tooltip. El `title` nativo alcanza y no agrega dependencias.
- No se rediseña `components/ui/button.tsx` para el resto de la app (ver D4).
- No se agregan dependencias nuevas: `lucide-react` ya está en el proyecto y todos los iconos
  (`Eye`, `PencilLine`, `SlidersHorizontal`, `Ban`, `RotateCcw`, `Trash2`) salen de ahí.

## Decisions

### D1. Componente compartido `RowActionButton`, no edición in-situ

**Decisión**: crear `frontend/src/components/RowActionButton.tsx` y reemplazar por él los ~12 call
sites, en vez de editar cada vista a mano.

API propuesta (mínima a propósito — no es un slot genérico, es "acción de fila"):

```tsx
type RowActionButtonProps = {
  icon: LucideIcon;
  label: string;                 // el verbo: "Ver" | "Editar" | "Anular" | ...
  tone?: "neutral" | "destructive";   // default "neutral"
  disabledReason?: string;       // si viene: disabled + title = motivo (ver D3)
  onClick: () => void;
};
```

El componente fija internamente: `type="button"`, `variant="outline"`, `size="icon-sm"`,
`className="rounded-full"` (+ el tinte destructivo si `tone === "destructive"`), el icono a
`className="h-3.5 w-3.5"`, y `aria-label={label}` + `title` según D3. No expone `className` ni
`variant`: si una vista necesitara escaparse del patrón, es señal de que esa acción no es una
acción de fila.

**Alternativa considerada — editar las 5 vistas in-situ**: menos indirección, cero archivos nuevos,
y el diff es literalmente lo que pide la spec. Se descartó por tres razones concretas: (a) el bloque
de 8 líneas ya está copiado 7 veces y este change lo llevaría a 12 — es exactamente el tipo de
duplicación que produjo las tres convenciones distintas que hoy estamos arreglando; (b) el tinte
destructivo es un string de 4 clases que hoy ya está copiado a mano en dos archivos y quedaría en
cuatro; (c) la spec tiene requirements de forma (`rounded-full`, tinte, verbo-solo) que con el
componente se testean **una vez** en `RowActionButton.test.tsx` y con edición in-situ habría que
re-verificar en cada vista futura. El costo real de la alternativa elegida es una capa de
indirección sobre `Button` y un componente más que mantener; a 12 call sites y con requirements de
spec encima, el trade-off cierra a favor del componente.

**Alternativa considerada — una variante `row-action` dentro de `buttonVariants`**: más idiomático
shadcn, pero `cva` no puede encapsular `aria-label`, `title`, el tamaño del `<svg>` ni la lógica de
`disabledReason`, que es justo la mitad de lo que la spec exige. Quedaría el patrón resuelto a
medias y los call sites igual de verbosos.

**Ubicación**: `frontend/src/components/`, **no** `frontend/src/components/ui/`. `ui/` está
reservado a primitivas shadcn (aunque `switch.tsx`/`slot` estén reimplementados a mano en
`6e3f916`, siguen siendo primitivas); `RowActionButton` es composición de dominio de la app
—conoce el concepto "acción de fila"—, del mismo nivel que `MemberTemplatesCard`.

### D2. `aria-label` es el verbo y nada más; `title` acompaña

Se aplica el mapeo cerrado por Producto: `Eye`→"Ver", `PencilLine`→"Editar",
`SlidersHorizontal`→"Ajustar base", `Ban`→"Anular"/"Desactivar" (destructivo),
`RotateCcw`→"Reactivar", `Trash2`→"Quitar"/"Borrar" (destructivo). `Ban` es un único icono para
anular y desactivar: es la misma operación semántica sobre entidades distintas.

Se normalizan también los labels existentes que hoy llevan la entidad
(`Editar ${plan.name}`, `Ver perfil de ${user.full_name}`, `Agregar precio a ${plan.name}`). La
pérdida de contexto para lector de pantalla es aceptable porque la fila ya se anuncia con su
contenido al navegar la tabla, y el requirement de la spec es explícito.

### D3. Se mantienen `aria-label` **y** `title`, con una excepción

**Decisión**: `aria-label={label}` siempre; `title={disabledReason ?? label}`.

- `aria-label` solo, sin `title`: un usuario vidente sin lector de pantalla se queda sin ninguna
  pista de qué hace el icono — que es el costo principal de pasar a icon-only.
- `title` solo, sin `aria-label`: el nombre accesible derivado de `title` es soporte de segunda en
  varios lectores y la spec pide un `aria-label` explícito.
- Los dos, con el mismo string: no hay ambigüedad de nombre accesible — `aria-label` tiene
  precedencia sobre `title` en el algoritmo de accname, así que `title` queda como tooltip visual
  puro. Es lo que el código ya hace hoy; se conserva.

### D4. El caso `isLastActive`: `disabledReason` gana sobre el tooltip

En `MembershipPlans.tsx:334` el botón Desactivar se deshabilita con
`title="No se puede desactivar el último plan activo"`. Con D3, ese `title` chocaría con el `title`
de tooltip.

**Decisión**: cuando `disabledReason` está presente, el botón va `disabled` y `title` pasa a ser el
motivo. La regla es "el `title` explica el estado más informativo": si el botón no se puede usar,
*por qué* no se puede usar importa más que repetir "Desactivar", que además ya está en el
`aria-label`.

**Alternativa considerada — concatenar** (`"Desactivar — No se puede..."`): más completo, pero
produce un tooltip largo en un control de 32px y obliga a los tests a matchear un string compuesto.
Se descartó.

**Nota para Dev**: `Button` con `disabled` trae `disabled:pointer-events-none`
(`button.tsx:8`), así que el `title` nativo **no** se muestra en hover real en el navegador. No se
mitiga en este change (requeriría un wrapper `<span>` o una librería de tooltip, ambas fuera de
alcance): el comportamiento es exactamente el de hoy, no una regresión, y el botón deshabilitado ya
comunica el estado visualmente. El `title` sigue presente en el DOM y es verificable por test.

### D5. Patrón canónico de test: scope por fila, nunca query global por verbo

Ésta era la pregunta abierta del Product Owner. **Decisión**: se resuelve por **contenedor de fila**,
no por índice.

Se agrega a `frontend/src/test/renderWithProviders.tsx` (el barrel de utilidades de test, que ya
re-exporta todo `@testing-library/react`):

```ts
export function getRowByText(text: string | RegExp, selector = "tr"): HTMLElement
// implementación: screen.getByText(text).closest(selector) — falla con un error
// explícito si no encuentra el contenedor.
```

Uso canónico, que Dev aplica en **todos** los tests tocados y QA exige en los nuevos:

```ts
const row = getRowByText("Press de banca");
fireEvent.click(within(row).getByRole("button", { name: "Editar" }));
```

Reglas asociadas:

- Queda **prohibido** `screen.getByRole("button", { name: "<verbo>" })` para acciones de fila,
  aunque el fixture tenga una sola fila. Es la trampa que detona cuando alguien agrega la segunda.
- Para asertar sobre un botón de diálogo cuyo verbo coincide con el de la fila (`"Anular"` en
  `Payments.test.tsx:212`, `"Borrar"` en `Exercises.test.tsx:176`), se sigue usando
  `within(dialog)`, como ya se hace. Fila y diálogo quedan así siempre scopeados, nunca globales.
- `MembershipPlans.test.tsx:135` (contar N botones "Desactivar" con `findAllByRole`) es la única
  excepción legítima a la query global: la aserción *es* sobre la cardinalidad de la columna, no
  sobre una fila.

**Alternativa considerada — `getAllByRole` + índice**: más corto de escribir, pero acopla el test al
orden de renderizado y el mensaje de falla ("expected 2 to be 3") no dice qué fila falló. Se
descartó.

**Alternativa considerada — `getByRole("row", { name: ... })`**: usa el accname computado de la fila
(concatenación de celdas), que en jsdom es frágil ante cambios de columnas y no aplica a
`MemberTemplatesCard`, que no es una tabla. Se descartó.

### D6. `MemberTemplatesCard`: la lista de asignaciones pasa a ser `<ul>/<li>`

`MemberTemplatesCard` no tiene `<tr>`, así que `getRowByText(...)` de D5 no tendría contenedor
estable al que agarrarse (el `div` mapeado solo se identifica por clases de Tailwind). **Decisión**:
Dev convierte el `.map()` de asignaciones en `<ul>` + `<li>` (sin cambio visual: `list-none`), y los
tests usan `getRowByText("Fuerza 4 días", "li")`.

Es scope extra chico y justificable por sí solo — una lista de ítems marcada como lista es mejor
semántica que un `div` —, y evita la alternativa peor: agregar un `data-testid` a producción solo
para que el test pueda scopear. Trade-off: este change toca un poco de markup que la spec no
menciona; se acepta porque sin contenedor estable el patrón canónico de D5 no sería aplicable a este
archivo y volveríamos a tener dos convenciones de test.

### D7. `Exercises.tsx:366` "Borrar" entra en alcance con `Trash2` destructivo

Es una acción de fila con botón de texto, así que el requirement "Identificación por icono" la
alcanza aunque no estuviera en el listado de entrada. Ocupa el slot `Trash2`/destructivo del mapeo
(el mismo de "Quitar"/"Eliminar"), con `aria-label="Borrar"` — se conserva el verbo actual porque el
diálogo de confirmación dice "Borrar ejercicio" y cambiarlo sería un cambio de copy que le
corresponde a Producto, no a este change. Así, una fila de ejercicio queda: `PencilLine` (neutro),
`Ban`/`RotateCcw` (destructivo/neutro), `Trash2` (destructivo).

### D8. `MembershipPlans.tsx:323` "Agregar precio" se normaliza a verbo-solo

El icono `CircleDollarSign` no cambia (queda explícitamente fuera del mapeo de este change), pero su
`aria-label`/`title` pasa de `"Agregar precio a ${plan.name}"` a `"Agregar precio"`: el requirement
de nombre accesible es incondicional para todo icon-button de acción de fila. Dejarlo con la
convención vieja sería exactamente el estado mixto que este change viene a eliminar. Impacta
`MembershipPlans.test.tsx:87` (el `<h2>` del diálogo sigue diciendo `Agregar precio a ${plan.name}`,
solo cambia la query del botón).

### D9. `rounded-full` se aplica en `RowActionButton`, no en `buttonVariants`

El design doc pide `rounded-full` para acciones de fila; `size="icon-sm"` hoy es `size-8` y hereda
`rounded-md` de la base de `buttonVariants` (`button.tsx:8`). **Decisión**: `RowActionButton` agrega
`rounded-full` por `className`; `button.tsx` **no se toca**.

`icon-sm` no es sinónimo de "acción de fila": `DevRoleSwitcher.tsx:138` también lo usa y no es una
fila. Meter `rounded-full` dentro de la variante de tamaño cambiaría ese botón de rebote y acoplaría
una decisión de dominio ("las acciones de fila son redondas") a una primitiva de tamaño. Con el
componente de D1, alinear el design doc cuesta una clase y el radio queda decidido en un solo lugar
— que es justamente lo que el punto 5 pedía resolver.

### D10. `Routines.tsx`: `stopPropagation` se resuelve dentro de `RowActionButton`, no en el call site

La fila de `/routines` es clickeable entera (`Routines.tsx:137-139`: `TableRow` con
`className="cursor-pointer"` y `onClick={() => navigate(\`/routines/${template.id}\`)}`), y por eso
el botón "Ver" hace hoy `event.stopPropagation()` antes de navegar. `RowActionButton` tiene API
cerrada por D1 y su `onClick` es `() => void`: no recibe el evento, así que el call site no puede
frenar la propagación.

**Decisión**: `RowActionButton` llama a `event.stopPropagation()` **siempre**, dentro de su propio
handler, antes de invocar el `onClick` del call site. El `onClick` público sigue siendo
`() => void` y la API cerrada de D1 queda intacta.

```tsx
onClick={(event) => {
  event.stopPropagation();
  onClick();
}}
```

Razón: "una acción de fila nunca debe además disparar la acción de la fila que la contiene" es una
propiedad del patrón, no de la vista. Es exactamente la clase de decisión que D1 dice que va en un
solo lugar; dejarla en cada call site es reabrir la puerta a que la sexta tabla clickeable la
olvide, que es el mismo mecanismo que produjo este hallazgo. En las otras 5 vistas el efecto es
nulo: ninguna tiene `onClick` en el `TableRow`/`<li>` contenedor (verificado), y `stopPropagation`
sobre un evento que nadie escucha más arriba no cambia nada.

**Por qué no rompe el cierre de diálogos ni de popovers** (verificado sobre este repo, no por
analogía con otra librería): **`radix-ui` no es dependencia de Gym App** — `frontend/AGENTS.md` lo
dice explícitamente y `Dialog` está reimplementado a mano sobre `<dialog>` nativo con
`lib/use-modal-dialog.ts`. El mecanismo real es el siguiente:

- `lib/use-modal-dialog.ts` **no cierra por click afuera en absoluto**: solo maneja `cancel`,
  `close` y `animationend`, sin ningún listener de puntero. No hay nada que `stopPropagation` pueda
  romper.
- El único listener de puntero a nivel `document` del repo es `components/ui/popover.tsx:90`, y
  escucha **`pointerdown`**, no `click`. Un `stopPropagation` sobre el `click` sintético de React no
  lo alcanza: para cuando el `click` burbujea, el `pointerdown` ya se despachó y se procesó.
- Ningún call site de `RowActionButton` está dentro de un `Dialog` ni de un `Popover`.

Este párrafo se dejó explícito porque una versión anterior de este design justificaba lo mismo
citando el comportamiento de Radix, que acá no existe: quien mañana agregue un cierre por click
afuera tiene que razonar sobre `use-modal-dialog.ts` y `popover.tsx`, no sobre una librería
ausente. Si ese cierre futuro se implementara escuchando `click` en `document` en vez de
`pointerdown`, **sí** entraría en conflicto con D10 y habría que revisarlo acá.

**Alternativa considerada — que la fila deje de ser clickeable**: elimina el choque de raíz y es la
opción más limpia en accesibilidad (una fila clickeable sin `role`/`tabIndex` no es alcanzable por
teclado). Se descartó porque es un cambio de comportamiento de navegación que la spec de este
change no pide y que Producto no decidió: hoy el usuario llega al detalle con un click en cualquier
parte de la fila y perdería ese gesto. Queda anotado como candidato a change propio.

**Alternativa considerada — abrir la API con `onClick: (event) => void`**: un renglón de diff, pero
rompe la API cerrada de D1 y traslada la responsabilidad al call site, que es lo que se quería
evitar. Además obligaría a los 11 call sites restantes a aceptar un parámetro que no usan.

**Alternativa considerada — envolver el botón en un `<div onClick={stopPropagation}>` en la celda
de `Routines.tsx`**: no toca `RowActionButton`, pero reintroduce boilerplate por call site, agrega
un nodo sin semántica y deja el patrón resuelto a medias.

### D11. El tinte destructivo se declara también en la variante `dark:`

`RowActionButton` compone hoy `border-destructive/30 bg-destructive/10 ...` sin variante `dark:`
sobre `variant="outline"`, que aporta `dark:bg-input/30 dark:border-input dark:hover:bg-input/50`
(`ui/button.tsx:15-16`). Al ser modificadores distintos, `tailwind-merge` no colapsa el par y
sobreviven las dos; como `@custom-variant dark` compila a `:where(...)` (especificidad 0), el
empate lo define el orden en la hoja y gana el neutro. En dark mode —el default de la app— del
tratamiento destructivo solo sobrevive el icono, porque `text-destructive` no tiene contraparte
`dark:` en `outline`.

**Decisión**: agregar al string destructivo `dark:bg-destructive/10 dark:border-destructive/30
dark:hover:bg-destructive/20`. `ui/button.tsx` **no se toca** (I7 intacto): el arreglo vive en el
único punto de decisión de D1.

Es suficiente y no depende del orden de la hoja: con el modificador `dark:` presente en ambas, las
clases caen en el mismo grupo de `tailwind-merge` (`dark:bg-*`, `dark:border-color`,
`dark:hover:bg-*`) y `cn()` recibe el `className` de `RowActionButton` **después** de
`buttonVariants(...)`, así que las de `outline` se descartan en el merge y ni siquiera llegan al
DOM. Eso lo hace asertable en jsdom por `classList`, sin `getComputedStyle` ni navegador real.

**Alternativa considerada — `variant="destructive"` de `buttonVariants` para el tono destructivo**:
usaría una variante existente en vez de un string a mano, pero es un botón sólido rojo (fondo
`bg-destructive` full, texto blanco), demasiado peso visual para 1-2 botones por fila, y la spec
fija el string exacto `border-destructive/30 bg-destructive/10 ...` como requirement. Se descartó.

**Alternativa considerada — agregar el par `dark:` a `buttonVariants`**: viola I7 y afecta a toda la
app por un problema que solo tiene este patrón.

## Risks / Trade-offs

- **[Pérdida de descubribilidad: icono sin texto]** → mitigado por `title` (D3) y por un mapeo
  cerrado de 6 iconos convencionales (`Trash2`, `Ban`, `Eye`, `PencilLine` son estándar de facto).
  Queda como riesgo residual aceptado por Producto: es el punto del change.
- **[`Ban` significa dos cosas ("Anular" pago, "Desactivar" plan/ejercicio)]** → el `aria-label` y el
  `title` distinguen; la decisión de Producto es que semánticamente son la misma operación.
- **[Tests que hoy pasan por tener fixture de una sola fila y no se migran]** → D5 los migra todos
  al patrón canónico en este mismo change, aunque no estén rotos. Si no se hiciera, el change
  dejaría una bomba de tiempo en 4 archivos de test.
- **[Un componente compartido tienta a usarlo fuera de filas]** → la API cerrada de D1 (sin
  `className`, sin `variant`, sin `children`) lo hace incómodo de desviar, y la spec excluye
  explícitamente las acciones de cabecera.
- **[`stopPropagation` incondicional en `RowActionButton` (D10)]** → si alguna vista futura
  necesitara que el click de una acción de fila **sí** burbujee hasta la fila, tendría que romper la
  API cerrada. Se acepta: es el caso improbable, y el opuesto (olvidarse de frenar la propagación)
  ya ocurrió en este mismo change.
- **[El tinte destructivo depende del orden de argumentos de `cn()` (D11)]** → mitigado porque el
  test `mantiene el tinte destructivo en modo dark` asserta sobre el `classList` renderizado, que es
  precisamente el resultado del merge.
- **[`disabled={Boolean(disabledReason)}`: no se puede deshabilitar sin un motivo textual]** →
  **deuda conocida, aceptada**. Es la consecuencia directa de D3/D4: `disabledReason` es a la vez el
  interruptor de `disabled` y el texto del `title`. Hoy no falla, porque el único call site que
  deshabilita es `isLastActive` en `MembershipPlans` y ahí el motivo textual es justamente lo que se
  quiere mostrar. El primer call site que necesite deshabilitar **sin** motivo —típicamente por una
  mutación en vuelo (`mutation.isPending`)— va a tener que elegir entre romper la API cerrada de D1
  (agregando un `disabled?: boolean` separado, que es la salida razonable) o inventar un
  `disabledReason` de relleno, que aparecería como tooltip espurio. Queda anotado acá, y no solo en
  `verification.md`, porque ese archivo se archiva con el change.
- **[El `title` de un botón deshabilitado no se ve en hover real]** → documentado en D4; es el
  comportamiento actual, no una regresión. Si molesta, es un change aparte de tooltips.

## Open Questions (para el Product Owner)

- **"Borrar" vs "Eliminar" en ejercicios** (D7): el mapeo cerrado nombra el slot `Trash2` como
  "Quitar"/"Eliminar", pero `Exercises.tsx` y su diálogo usan el verbo "Borrar". Este design conserva
  "Borrar" para no cambiar copy por la ventana. ¿Se unifica el verbo en un change de copy posterior?
- **"Agregar precio"** (D8): el listado de entrada decía "no se toca", pero el requirement de
  verbo-solo lo alcanza. Este design normaliza el label. Confirmar que es lo esperado.

## Plan de verificación

**Riesgo**: medio — sin cambios tras la verificación. El change altera comportamiento observable
(texto visible reemplazado por iconos y nombres accesibles renombrados) ahora en **6** vistas, toca
un archivo de utilidades de test compartido (`renderWithProviders.tsx`) y, con D10, cambia la
propagación del click en todas las acciones de fila; no cae en ningún gatillo de `alto` (no toca
`models.py`, migraciones, auth, deps ni datos) y sigue sin calificar como `bajo`, que exige que el
diff no cambie comportamiento observable. Los dos arreglos agregados amplían el alcance dentro del
mismo nivel: no introducen un gatillo de `alto` ni acercan el change a `bajo`.

### Invariantes

- I1. Ninguna acción de fila muestra texto de etiqueta junto al icono en `Users`,
  `MembershipPlans`, `Exercises`, `Payments` ni `MemberTemplatesCard`.
- I2. Todo icon-button de acción de fila tiene `aria-label` igual exactamente al verbo, sin el
  nombre de la entidad de la fila.
- I3. Cada acción sigue disparando la misma mutación/diálogo que antes del change: ninguna llamada
  a `api.*` cambia de URL, verbo ni payload.
- I4. `Ban` y `Trash2` llevan el tinte destructivo; `Eye`, `PencilLine`, `RotateCcw`,
  `SlidersHorizontal` y `CircleDollarSign` llevan el outline neutro.
- I5. El botón Desactivar del último plan activo sigue deshabilitado y sigue exponiendo el motivo
  en `title`.
- I6. Ningún test de acción de fila queda con una query global por verbo
  (`screen.getByRole("button", { name: "<verbo>" })`), salvo la aserción de cardinalidad de
  `MembershipPlans.test.tsx`.
- I7. `frontend/src/components/ui/button.tsx` no cambia.
- I8. La única acción de fila de `Routines` es un icon-button sin texto visible con nombre
  accesible exactamente `Ver`, y la fila sigue siendo clickeable y navegando al detalle.
- I9. Un click en una acción de fila no dispara el `onClick` de la fila que la contiene: navega una
  sola vez.
- I10. El tinte destructivo sobrevive en modo dark: el `classList` del botón destructivo incluye
  `dark:bg-destructive/10` y `dark:border-destructive/30` y no incluye `dark:bg-input/30` ni
  `dark:border-input`.
- I11. `frontend/src/pages/RoutineTemplateDetail.tsx` no cambia: su `Switch` por ejercicio conserva
  el `aria-label` con el nombre del ejercicio.

### Tests

| Capa | Archivo | Caso |
|---|---|---|
| frontend | `frontend/src/components/__tests__/RowActionButton.test.tsx` | `expone el verbo como unico nombre accesible y como title` |
| frontend | `frontend/src/components/__tests__/RowActionButton.test.tsx` | `aplica el tinte destructivo solo cuando tone es destructive` |
| frontend | `frontend/src/components/__tests__/RowActionButton.test.tsx` | `deshabilita el boton y usa el motivo como title cuando viene disabledReason` |
| frontend | `frontend/src/components/__tests__/RowActionButton.test.tsx` | `es un icon-button rounded-full sin texto visible` |
| frontend | `frontend/src/pages/__tests__/Users.test.tsx` | `el boton Ver de una fila navega a la ficha del usuario` |
| frontend | `frontend/src/pages/__tests__/MembershipPlans.test.tsx` | `abre el dialogo de nuevo precio y lo envia` |
| frontend | `frontend/src/pages/__tests__/MembershipPlans.test.tsx` | `deshabilita desactivar cuando es el unico plan activo` |
| frontend | `frontend/src/pages/__tests__/MembershipPlans.test.tsx` | `muestra Reactivar en vez de Desactivar en la fila de un plan inactivo` |
| frontend | `frontend/src/pages/__tests__/Exercises.test.tsx` | `muestra el archivo propio cuando el ejercicio tiene archivo y URL externa` |
| frontend | `frontend/src/pages/__tests__/Exercises.test.tsx` | `ofrece desactivar en vez de borrar cuando el ejercicio está en uso` |
| frontend | `frontend/src/pages/__tests__/Exercises.test.tsx` | `muestra las tres acciones de fila como icon-buttons sin texto` |
| frontend | `frontend/src/pages/__tests__/Payments.test.tsx` | `oculta la accion de anular para un Coach` |
| frontend | `frontend/src/pages/__tests__/Payments.test.tsx` | `anula un pago como Dueno tras confirmar` |
| frontend | `frontend/src/components/__tests__/MemberTemplatesCard.test.tsx` | `pide confirmacion antes de quitar una asignacion` |
| frontend | `frontend/src/components/__tests__/MemberTemplatesCard.test.tsx` | `ofrece ajustar base y quitar como icon-buttons en cada asignacion` |
| frontend | `frontend/src/components/__tests__/RowActionButton.test.tsx` | `mantiene el tinte destructivo en modo dark` |
| frontend | `frontend/src/components/__tests__/RowActionButton.test.tsx` | `no propaga el click a la fila que lo contiene` |
| frontend | `frontend/src/pages/__tests__/Routines.test.tsx` | `abre el detalle de la plantilla al hacer click en la fila` |
| frontend | `frontend/src/pages/__tests__/Routines.test.tsx` | `abre el detalle desde el boton Ver de la fila` |
| frontend | `frontend/src/pages/__tests__/Routines.test.tsx` | `muestra la accion Ver de la fila como icon-button sin texto` |
| manual | — | `make dev`, entrar como Dueño (`dev.owner@miniespacio.local` / `devdev123`) y recorrer /users, /plans, /exercises, /payments y la ficha de un miembro con plantillas: verificar que ninguna acción de fila muestra texto, que el hover muestra el tooltip con el verbo, que Desactivar/Anular/Quitar se ven en rojo y el resto neutros, y que con un solo plan activo el botón Desactivar está deshabilitado |
| manual | — | `make dev` en modo dark (el default): en `/plans`, inspeccionar el botón "Desactivar" con DevTools y confirmar por `getComputedStyle` que `background-color` y `border-color` son los del tinte destructivo y no los del outline neutro (es el punto que los screenshots de la verificación no distinguían) |
| manual | — | `make dev`, entrar a `/routines` con al menos una plantilla: la acción de fila es un icon-button `Eye` sin texto, el click en el icono abre el detalle y el click en el resto de la fila también, sin navegación duplicada |
| manual | — | `make lint-frontend` y `make test-frontend` en verde |
