# Verificación: unify-row-action-icons

**Fecha**: 2026-09-12
**Veredicto**: PASA
**Diff verificado**: working tree sin commitear, acotado a los archivos de este change
**Riesgo declarado**: medio (confirmado por Code Reviewer contra la tabla de criterio de `role-architect`)
**Paso 0**: lint OK · test OK · plan OK

> **Historial**: la primera vuelta cerró en PASA CON RESERVAS por los hallazgos 1 y 2. Ambos se
> corrigieron (grupo de tasks `## 8. Correcciones post-verificación`) y se re-verificaron con un
> Code Reviewer y un QA acotados al delta. Los dos quedan **cerrados**; el detalle de cada uno se
> conserva abajo con su cierre.

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=unify-row-action-icons` | OK (`riesgo=medio`, 21 casos presentes en disco) |
| Lint | `make lint` | OK (0 errores; 43 warnings preexistentes de `no-explicit-any` y 1 de `exhaustive-deps`, ninguno introducido por este change) |
| Tests | `make test` | OK (backend 242 passed · frontend 174 passed en 33 archivos) |

Los tres en verde ⇒ se lanzaron Code Reviewer y QA en paralelo. Cifras de la segunda vuelta, tras
las correcciones; la primera vuelta también cerró el paso 0 en verde (170 tests de frontend).

## Escenarios de la spec

Capability `data-table-row-actions`. QA verificó con el stack Docker levantado, usuarios de
`make seed-dev`, snapshot de accesibilidad de Chrome DevTools y screenshots recortados por botón.

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| Fila de una tabla con acciones | UI: `/users`, `/plans`, `/exercises`, `/payments`, ficha de miembro | PASA |
| Nombre accesible de acción de edición | Snapshot a11y en `/users` (40 filas) y `/plans`: name = `Editar` exacto | PASA |
| Nombre accesible de acción de ver detalle | Snapshot a11y en `/users`: name = `Ver` exacto | PASA |
| Nombre accesible de "Agregar precio" | Snapshot a11y en `/plans` (3 filas): name = `Agregar precio`, sin nombre del plan | PASA |
| Verbos distintos para el mismo icono | `Trash2` con `Borrar` en `/exercises` y `Quitar` en ficha de miembro | PASA |
| Acción de fila activa (`Ban`) | `/plans`, `/exercises` y `/payments` (pago creado ad-hoc) | PASA |
| Acción de fila inactiva (`RotateCcw`) | Desactivación en vivo de un plan y un ejercicio; estado restaurado al final | PASA |
| Distinción visual destructivo | Screenshots por botón + `getComputedStyle` en dark y light (2.ª vuelta) | PASA |
| Distinción visual neutro | Mismos screenshots: outline gris, sin rojo | PASA |
| Acciones de cabecera fuera de alcance | `/routines/:id`: `Editar` y `Eliminar` conservan icono + texto | PASA |
| Acción de fila en `/routines` (2.ª vuelta) | Snapshot a11y: `Eye` sin texto, name = `Ver`; navegación por botón y por fila, sin historial duplicado | PASA |

## QA manual

QA corrida por riesgo medio. Los 10 escenarios de la spec dieron PASA; ninguno quedó
NO VERIFICABLE. Puntos que el brief marcó como críticos y quedaron cubiertos:

- **Payments**: se registró un pago real desde la UI (Dev Miembro, período 09/2026) para
  materializar una fila; apareció el botón `Ban`/"Anular" y el diálogo "Anular pago" abrió
  correctamente. El diálogo se canceló sin confirmar, para no alterar datos de más.
- **Toggle en ambas direcciones**: verificado en vivo en `/plans` y `/exercises`, con el estado
  original restaurado al terminar.
- **`isLastActive`**: con un solo plan activo, su botón quedó `disabled`, nombre accesible
  `Desactivar` y `title` = "No se puede desactivar el último plan activo". Coincide con D4.
- **Consola y red**: sin errores ni warnings nuevos en ninguna de las vistas recorridas.

Sin cubrir por QA en la primera vuelta: roles Coach/Miembro contra estas vistas (el change es de
presentación pura, no de autorización), y la aserción de color por `getComputedStyle`.

**Segunda vuelta de QA** (acotada a las dos reservas, tras las correcciones): ambas PASAN.
`/routines` verificado por snapshot de accesibilidad (nombre accesible exacto `Ver`, sin texto,
navegación por botón y por fila, sin historial duplicado) y el tinte destructivo medido con
`getComputedStyle` en dark y en light — los valores concretos están en el cierre del hallazgo 2.
El estado de la app se restauró al terminar (el toggle de tema volvió a dark; no se crearon ni se
dejaron datos modificados).

**Segunda vuelta de Code Reviewer** (acotada al delta): confirmó los dos arreglos por **mutación**
—revirtió cada fix y verificó que el test correspondiente efectivamente cae—, de modo que los
casos nuevos prueban comportamiento y no pasan por construcción:

| Mutación aplicada | Test que cae |
|---|---|
| Quitar las tres clases `dark:` de `RowActionButton.tsx` | `mantiene el tinte destructivo en modo dark` |
| Quitar `event.stopPropagation()` de `RowActionButton.tsx` | `no propaga el click a la fila que lo contiene` |
| Quitar el `onClick` del `TableRow` de `Routines.tsx` | `abre el detalle de la plantilla al hacer click en la fila` |

## Hallazgos

1. **[mayor]** `frontend/src/pages/Routines.tsx:154-166` — Queda una acción de fila de tabla sin
   migrar. `Routines.tsx:95` es una `<Table>` con `TableBody`/`TableRow` igual que las otras
   cuatro vistas, y su celda de acciones renderiza un `<Button size="sm">` con el **texto "Ver"**
   y `aria-label={`Ver plantilla ${template.name}`}`.

   Falla con: entrar a `/routines` con cualquier plantilla cargada. La celda muestra texto junto
   a (sin) icono, violando el escenario "Fila de una tabla con acciones" (*"sin texto de etiqueta
   junto al icono"*), y el lector de pantalla anuncia "Ver plantilla Fuerza 4 días", violando
   "Nombre accesible de una acción de ver detalle" (*"el nombre accesible anunciado es exactamente
   'Ver'"*).

   La spec está redactada de forma incondicional ("Toda acción de fila en una tabla del
   frontend"), así que `/opsx:sync` publicaría en `openspec/specs/` un requirement con un
   contraejemplo vivo en la app desde el día uno. El relevamiento de blast radius de
   `design.md:22-28` listó 5 archivos y omitió éste. Verificado de forma independiente: el grep de
   `aria-label={\`` sobre `frontend/src` deja exactamente dos sobrevivientes, y este es uno.

   El bloque no lo toca ninguno de los otros changes sin commitear, así que no es interferencia
   de scope.

   **CERRADO** (tasks 8.1–8.5). El botón pasó a `RowActionButton` con `icon={Eye}`, `label="Ver"`,
   tono neutro. Como el `TableRow` es clickeable y el `onClick` del componente es `() => void` sin
   evento, D10 resolvió que `RowActionButton` llame a `event.stopPropagation()` en su propio
   handler — la API cerrada de D1 queda intacta. QA verificó en la app: nombre accesible exacto
   `Ver`, sin texto, navegación por el botón y por la fila, y "atrás" del navegador vuelve a
   `/routines` en un solo paso (sin doble navegación). Code Reviewer confirmó por mutación que
   `abre el detalle de la plantilla al hacer click en la fila` —que antes clickeaba el botón pese
   a su nombre— ahora cae si se rompe la navegación de la fila.

2. **[menor]** `frontend/src/components/RowActionButton.tsx:29-33` — El tinte destructivo pierde
   fondo y borde en modo dark; sobrevive solo el icono rojo.

   `RowActionButton` compone `bg-destructive/10 border-destructive/30` **sin variante `dark:`**
   sobre `variant="outline"`, que aporta `dark:bg-input/30 dark:border-input`
   (`ui/button.tsx:15-16`). `tailwind-merge` no colapsa el par (modificadores distintos) y
   `@custom-variant dark` compila a `:where(...)`, que suma 0 a la especificidad: empate a una
   clase, gana la que va más tarde en la hoja. El Code Reviewer lo midió sobre el bundle
   (`.bg-destructive/10` en el offset 38547 vs `.dark:bg-input/30` en 84676;
   `.border-destructive/30` en 34291 vs `.dark:border-input` en 83587).

   Falla con: `/plans` en modo dark (el default de la app). El botón "Desactivar" renderiza
   `background-color`/`border-color` de un botón neutro.

   No es una regresión de este change — el mismo string ya estaba copiado a mano en
   `MemberTemplatesCard` y `RoutineTemplateDetail` —, pero ahora es el único punto de decisión de
   5 vistas y la spec promete ese tratamiento exacto. Arreglarlo cuesta agregar
   `dark:bg-destructive/10 dark:border-destructive/30 dark:hover:bg-destructive/20`.

   **Discrepancia entre roles, resuelta a favor del Code Reviewer**: QA marcó este escenario como
   PASA a partir de screenshots, pero declaró explícitamente no haber medido `getComputedStyle`.
   El rojo que observó se explica por `text-destructive` (el icono), que sí sobrevive al empate.
   El criterio visual "se ve rojo" pasa igual con solo el icono tinturado, así que la evidencia de
   QA no refuta el mecanismo. Queda pendiente confirmarlo con `getComputedStyle` sobre el botón.

   **CERRADO** (tasks 8.6–8.9). Se agregaron `dark:bg-destructive/10 dark:border-destructive/30
   dark:hover:bg-destructive/20` (D11). QA midió `getComputedStyle` en `/exercises`, fila "Banco
   Scott", comparando el botón destructivo contra el neutro de la misma fila:

   | Modo | Botón | `backgroundColor` | `borderColor` |
   |---|---|---|---|
   | Dark | `Editar` (neutro) | `oklab(0.999994 … / 0.0235294)` | `rgba(255,255,255,0.08)` |
   | Dark | `Desactivar`/`Borrar` | `oklab(0.636841 0.187884 0.0889429 / 0.1)` | mismo oklab a `/ 0.3` |
   | Light | `Editar` (neutro) | `rgb(248,250,252)` | `rgb(226,232,240)` |
   | Light | `Borrar` | `oklab(0.577107 0.191166 0.0987778 / 0.1)` | mismo oklab a `/ 0.3` |

   Fondo y borde del destructivo difieren del neutro en **ambos** modos: el tinte completo está
   vivo, no solo el icono. Sin regresión en light.

   **Corrección al mecanismo diagnosticado**: el análisis estático original (empate de
   especificidad resuelto por orden en la hoja) resultó equivocado. `cn()`/`tailwind-merge`
   colapsa el grupo `dark:bg-*`/`dark:border-*` en el `className` del elemento, así que
   `dark:bg-input/30` y `dark:border-input` **nunca llegan al DOM** — no hay empate que resolver.
   Verificado por dos vías independientes: Code Reviewer sobre la salida de `cn()` (quitando los
   modificadores `dark:` del string destructivo, las tres clases del outline reaparecen), y QA
   sobre el DOM real. El fix no depende del orden de la hoja de estilos, y el test que asserta por
   `classList` prueba algo real: cae al revertir el fix.

3. **[menor]** `frontend/src/components/RowActionButton.tsx:36` — `disabled={Boolean(disabledReason)}`
   hace imposible deshabilitar sin un motivo textual. Hoy no falla: el único call site es
   `isLastActive`, y es lo que pide la task 1.3. Queda anotado porque el primer caso que necesite
   deshabilitar por una mutación en vuelo tendrá que romper la API cerrada de D1 o inventar un
   `disabledReason` de relleno, que aparecería como tooltip.

   **ACEPTADO como deuda conocida**, no se corrige en este change. Quedó registrado en
   `design.md` (`## Risks / Trade-offs`) —no solo acá, porque `verification.md` se archiva junto
   con el change— con la salida propuesta para cuando aparezca el primer caso: un `disabled?:
   boolean` separado, no un `disabledReason` de relleno.

4. **[menor, doc]** `design.md` (justificación de D10) — La primera redacción sostenía que el
   `stopPropagation()` global no rompe el cierre de diálogos "porque Radix escucha `pointerdown`
   en `document`". **La premisa es falsa**: `radix-ui` no es dependencia de este repo
   (`frontend/AGENTS.md`), y `Dialog` está reimplementado sobre `<dialog>` nativo en
   `lib/use-modal-dialog.ts`. La conclusión se sostiene igual, pero por otro mecanismo, que el
   Code Reviewer verificó: `use-modal-dialog.ts` no cierra por click afuera en absoluto, el único
   listener de puntero a nivel `document` es `components/ui/popover.tsx:90` y escucha
   `pointerdown` (que un `stopPropagation` sobre el `click` sintético no alcanza), y ningún call
   site de `RowActionButton` vive dentro de un `Dialog` ni de un `Popover`.

   **CORREGIDO** en `design.md` antes de cerrar la verificación, con el mecanismo real y con el
   disparador concreto que obligaría a revisar D10 en el futuro (que alguien implemente el cierre
   por click afuera escuchando `click` en vez de `pointerdown`). Se corrigió en vez de dejarlo
   pasar porque `design.md` sobrevive al archive: un lector futuro razonaría sobre una librería
   que no existe en este repo y podría sacar la conclusión opuesta.

## Sin verificar

- **El `title` del caso `isLastActive` no es observable en hover real**: `button.tsx:8` aplica
  `disabled:pointer-events-none`, así que el tooltip nativo no dispara. El design lo documenta
  como comportamiento preexistente, no como regresión, y decide no mitigarlo acá. QA lo confirmó
  vía snapshot de accesibilidad (donde sí aparece como description), no por hover.
- **Color destructivo por `getComputedStyle`**: ver hallazgo 2. La verificación se apoyó en
  screenshots, que no distinguen "fondo + borde + icono rojos" de "solo icono rojo".
- **Roles Coach y Miembro** contra las vistas migradas: no se probaron. El change es de
  presentación y no toca autorización.
- **La task 7.2** (verificación manual en `make dev`) estaba marcada `[x]` antes de esta
  verificación sin evidencia registrada en el change. La corrida de QA de hoy la cubre de hecho,
  salvo por el punto del hallazgo 2 — que es justamente lo que esa task habría detectado.
