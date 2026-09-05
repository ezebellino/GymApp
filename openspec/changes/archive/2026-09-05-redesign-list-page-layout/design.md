# Design — redesign-list-page-layout

> Este documento responde el **CÓMO**. El QUÉ está en [proposal.md](./proposal.md) y en las delta
> specs de [`specs/app-shell/spec.md`](./specs/app-shell/spec.md) y
> [`specs/user-management/spec.md`](./specs/user-management/spec.md), ya escritas por el Product
> Owner, más sus [respuestas de producto](./po-answers.md). Este diseño está alineado con esas
> specs: si algo de acá suena a requirement nuevo, es un error.

## Context

### Estado actual verificado (no asumido)

Shell autenticado (`frontend/src/App.jsx:61-167`):

| Pieza | Clases hoy | Consecuencia |
|---|---|---|
| `Sidebar` | `fixed left-0 top-0 h-screen w-sidebar` (240px), oculto `lg:flex` | no ocupa lugar en el flujo |
| `Topbar` | `sticky top-0 z-30 border-b lg:pl-sidebar` + interior `mx-auto flex h-14 px-4 sm:px-6 lg:px-8` | **sin `max-w`**: el interior se estira a todo el ancho disponible |
| `main` | `min-h-screen pt-14 lg:pl-sidebar` | ver "dos bugs de alto" abajo |
| contenedor | `mx-auto w-full max-w-[var(--container-app)] px-4 py-6 sm:px-6 lg:px-8` | único gutter/ancho máximo del shell (dec. D1 heredada) |

**Causa exacta de la desalineación**: el `div` interior del Topbar tiene el mismo `mx-auto` y los
mismos `px-*` que el contenedor de `main`, pero **le falta `max-w-[var(--container-app)]`**. En
viewports por debajo de 1600px + 240px el resultado coincide por casualidad; por encima, el
contenido de `main` se centra dentro de 1600px y el del Topbar no, y el toggle de tema se va hacia
el borde derecho de la ventana.

**Alturas que no cierran** (medido sobre el markup, no estimado):

- Topbar: `h-14` (56px) + `border-b` (1px) ⇒ su borde inferior cae en **57px**.
- Placa de marca del Sidebar (`Sidebar.tsx:63-80`): `p-4` del wrapper (16px) + `section p-3.5`
  (14px) + logo `h-10` (40px) + 14px + 2px de borde ⇒ su borde inferior cae en **86px**.
- Delta: **29px**. No hay ningún token compartido entre las dos: `h-14` es un literal en Topbar y
  la altura de la placa es emergente del contenido.

**Dos bugs de alto en `main`** (ambos empujan la tabla fuera del viewport, y explican parte del
"solo entran 4 filas"):

1. `pt-14` **suma** al alto del Topbar en vez de compensarlo. El comentario de `App.jsx:70-75`
   dice que el Topbar "sí ocupa lugar en el flujo" (correcto: `sticky` no lo saca del flujo) y a
   la vez que `pt-14` "compensa su altura" — las dos cosas no pueden ser ciertas. El resultado es
   una banda muerta de 56px arriba del contenido.
2. `min-h-screen` sobre un `main` que ya arranca 56px abajo del top del documento ⇒ el documento
   mide **100vh + 56px como piso**, o sea que *siempre* hay barra de scroll de página aunque la
   vista esté vacía.

Vista Usuarios (`frontend/src/pages/Users.tsx`, 390 líneas): hero `hero-aura` + card "Leyenda" en
un grid `lg:grid-cols-[1.35fr_0.85fr]` (~260px de alto), luego una `Card` con título +
descripción + input con label caps + **`Pagination` completo dentro del header** (líneas 244-252)
+ `<table>` escrita a mano (los primitivos `components/ui/table.tsx` existen y tienen **cero
callers** en todo el repo) + **`Pagination` otra vez** en el pie (líneas 362-370). Cada fila usa
celdas `p-4` y muestra el UUID como segunda línea del nombre.

### Blast radius (medido)

`codegraph impact` sobre símbolos de páginas devuelve solo el propio archivo: el índice no sigue
las aristas de JSX ni los `lazy(routeImporters[...])`, así que la tabla de abajo cruza CodeGraph
con `grep` sobre `frontend/src`.

| Símbolo | Callers reales | Tests que lo tocan |
|---|---|---|
| `Topbar` | `App.jsx:5,68` (único) | `components/__tests__/Topbar.test.tsx` (toggle de tema) |
| `Sidebar` | `App.jsx:4,67` (único) | `components/__tests__/Sidebar.test.tsx` (2 casos por rol) |
| `Users` | `App.jsx:21` vía `routeImporters["/users"]` | `pages/__tests__/Users.test.tsx` (7 casos) |
| `Pagination` | `pages/Users.tsx` (×2), `pages/Attendance.tsx:272` | ninguno directo |
| `Table` y familia (`ui/table.tsx`) | **0 callers** | ninguno |
| `routeImporters` | `App.jsx:12`, `Sidebar.tsx:15` | ninguno |

Lecturas: (a) cualquier cambio de firma de `Pagination` tiene que ser **retrocompatible** o tocar
también `Attendance.tsx` (que está fuera de alcance); (b) `ui/table.tsx` se puede extender con
riesgo cero; (c) el shell tiene un solo call site por componente, así que el cambio de tokens de
altura no se propaga a ningún lugar inesperado.

### Restricciones

- **Sin radix-ui.** El repo lo viene sacando (`Dialog`, `AlertDialog`, `Switch`, `Slot`
  reimplementados a mano). Un `Popover` nuevo no puede reintroducirlo ni traer `floating-ui`.
- El contenedor de contenido vive **en un solo lugar** (`App.jsx`) — requirement vigente de
  `app-shell`: "Layout de contenido unificado entre vistas autenticadas". Una list page no puede
  poner su propio `mx-auto max-w-* px-*`.
- Tokens visuales solo desde `docs/design/design.md`; nada de hex crudo fuera de `index.css`.
- `frontend/src/pages/Payments.tsx` (19 líneas) y `Routines.tsx` (21) están vaciadas;
  `Attendance.tsx` (285) todavía no. La plantilla tiene que servirles después sin rediseño.

## Goals / Non-Goals

**Goals:**

1. Topbar y contenido de `main` comparten bordes izquierdo/derecho en cualquier viewport, con
   **una sola** definición del contenedor.
2. ~~Topbar y placa de marca del Sidebar comparten borde inferior, derivado de **un token**, no de
   dos literales que hay que acordarse de mover juntos.~~ **Retirado por el dueño** (dec. 16 y 17):
   la placa no lleva borde inferior y su alto se desacopla del Topbar. `--spacing-topbar` sigue
   siendo el token del Topbar y el insumo de `--list-page-height`.
3. Los labels de navegación salen de una **fuente única** en vez de estar copiados en tres lugares
   (`Sidebar.tsx:26`, el menú mobile de `Topbar.tsx`, `SpotlightSearch`). El objetivo original
   incluía el nombre de sección en el Topbar; **el dueño lo retiró** (dec. 13), pero la
   deduplicación de `NAV_ITEMS` sigue en pie con dos consumidores.
4. Una plantilla reutilizable de "list page" que garantice, en desktop, cero scroll de página: el
   scroll vertical vive dentro del cuerpo de la tabla y el pie de paginación siempre visible.
5. `Users.tsx` migrada a esa plantilla y a `components/ui/table.tsx`, sin perder skeleton, error,
   vacío ni ninguna capacidad funcional.
6. `Popover` accesible propio, sin radix, reutilizable.

**Non-Goals:**

- Backend, contratos de API, migraciones: **nada**. Este change es 100% frontend.
- Reimplementar Pagos / Asistencias / Rutinas. `Attendance.tsx` solo se toca si un cambio
  retrocompatible en `Pagination` lo obligara — y por diseño no lo obliga.
- Dashboard: conserva su hero con aura y no adopta la plantilla.
- Rediseñar el drawer mobile del Topbar. Se toca únicamente lo mínimo para que los labels salgan
  de la fuente única (Decisión 3).
- Virtualización de filas, orden por columna, filtros de rol/estado, selección múltiple. La
  plantilla deja el slot listo (Decisión 6) pero este change no los implementa.
- Portal de miembro (`/my-routine`) y vistas de auth (`/login`, `/invitacion`).

## Decisions

### 1. El contenedor del shell se extrae a una utilidad CSS y la comparten Topbar y `main`

Se define en `frontend/src/index.css`, dentro del `@layer utilities` que ya existe (línea 227):

```css
.app-container {
  @apply mx-auto w-full max-w-[var(--container-app)] px-4 sm:px-6 lg:px-8;
}
```

`App.jsx` pasa a `<div className="app-container py-page-y">` y el `div` interior del Topbar a
`<div className="app-container flex h-topbar items-center justify-between">`.

**El gutter vertical (`py-*`) queda fuera de la utilidad a propósito**: es del área de contenido,
no del Topbar (que centra verticalmente contra su alto fijo). Meterlo adentro obligaría al Topbar
a anularlo.

*Alternativas descartadas:*
- **Repetir las clases literales en los dos archivos.** Es lo que hay hoy y ya derivó (al Topbar
  le falta el `max-w`). Cero garantía de que no vuelva a pasar.
- **Componente `<AppContainer>` en React.** Funciona, pero mete un nodo/import en dos archivos que
  hoy solo componen clases, y no sirve para el caso "quiero el gutter pero no el `div`". La
  utilidad CSS es composable con cualquier otra clase.
- **`@utility app-container` (API nueva de Tailwind v4).** Equivalente y más idiomática, pero el
  archivo ya tiene 9 utilidades en `@layer utilities` y ninguna con `@utility`; se prioriza
  consistencia con lo que ya está.

### 2. Alturas: token `--spacing-topbar`, y la placa de marca se ajusta a él (no al revés)

> **Parcialmente superada por la revisión del dueño (dec. 16 y 17).** El token
> `--spacing-topbar` y su uso en el Topbar y en `--list-page-height` siguen vigentes; lo que se
> cae es que el Sidebar lo consuma y que las dos barras compartan borde inferior.

En el bloque `@theme inline` de `index.css`, junto a `--spacing-sidebar` (línea 107):

```css
--spacing-topbar: 4rem;    /* 64px */
--spacing-page-y: 1.5rem;  /* 24px — el py-6 de hoy, ahora nombrado */
```

Tailwind v4 genera de ahí `h-topbar`, `pt-topbar`, `top-topbar`, `py-page-y`, igual que ya hace
con `w-sidebar` / `pl-sidebar`.

- Topbar: `h-14` → `h-topbar`.
- Sidebar: la placa de marca sale del `p-4` genérico y pasa a vivir en una **banda de encabezado**
  de `h-topbar` con `border-b border-border`, con la placa (`warm-accent-bg warm-glow rounded-xl`,
  la "Brand Plaque" del design doc) adentro y el logo bajando de `h-10 w-10` a `h-9 w-9` para que
  36px + padding entren holgados en 64px. El nav conserva su `p-4` en el bloque de abajo.
- Resultado: el `border-b` del Topbar y el de la banda de marca son **la misma línea horizontal a
  64px**, y ninguna de las dos alturas es un literal.

**Por qué 64px y no 86px** (el alto actual de la placa): el proposal pide una vista más compacta;
subir el Topbar 30px va en la dirección opuesta y deja una barra desproporcionada para su
contenido real (un buscador + un botón). Es más barato bajar la placa que subir la barra.

*Alternativas descartadas:*
- **Topbar a 86px, Sidebar intacto.** Roba 86px de viewport en cada vista para no tocar 3 líneas
  del Sidebar. Contradice el objetivo del change.
- **Medir el alto de la placa en runtime (`ResizeObserver`) y aplicarlo al Topbar.** Alineación
  perfecta y automática, pero introduce layout dependiente de JS, un flash en el primer paint y un
  observer nuevo en el shell, para resolver algo que un token constante resuelve.
- **Sacarle el `border-b` al Topbar** para que no se note la diferencia. Esconde el síntoma y
  rompe la separación visual entre barra y contenido.

### 3. El nombre de sección sale de una fuente única: `src/lib/navigation.ts`

> **Parcialmente superada por la revisión del dueño (dec. 13).** `NAV_ITEMS` y su consumo desde
> `Sidebar` y el menú mobile del Topbar siguen vigentes; `sectionTitleForPath` y el título de
> sección en el Topbar se eliminan.

Archivo nuevo con lo que hoy vive inline en `Sidebar.tsx:23-32`:

```ts
export type NavItem = { to: string; label: string; icon: FC<{ size?: number }> };
export const NAV_ITEMS: NavItem[] = [ /* mudado tal cual desde Sidebar.tsx */ ];
export function sectionTitleForPath(pathname: string): string | null;
```

- `Sidebar.tsx` importa `NAV_ITEMS` (su filtro por rol queda donde está: es lógica de sidebar).
- `Topbar.tsx` lo usa para **dos** cosas: el título de sección en desktop y los labels del menú
  mobile, que hoy son literales duplicados (`Topbar.tsx:190-247`).
- `sectionTitleForPath` resuelve por **prefijo más largo que matchea**, no por igualdad: así
  `/users/u-1` (ficha de usuario, sin entrada en el nav) devuelve "Usuarios". Sin match (p. ej.
  `/coaches/new`) devuelve `null` y el Topbar **no renderiza nada** — el slot queda como hoy, sin
  inventar un título.

**Relación con `routePreload.ts`**: se mantienen separados. `routeImporters` tiene que quedar como
un objeto literal con `import()` estáticos para que Vite arme los chunks; mezclarlo con labels e
iconos no aporta y sí arriesga el code-splitting. El riesgo de drift (agregar una ruta en un mapa
y olvidarla en el otro) se cubre con un test barato: "toda entrada de `NAV_ITEMS` tiene importer
en `routeImporters`".

**El título de sección se renderiza como `<p>`, no como heading.** El `<h1>` de la vista vive en
el header de la list page (Decisión 6); dos `h1` compitiendo, o un `h1` en el shell que cambia de
significado según la ruta, empeora la navegación por landmarks. El `<header>` ya aporta el
landmark `banner`.

*Alternativas descartadas:*
- **Mapa `ruta -> título` nuevo dentro de `Topbar.tsx`.** Sería la cuarta copia de los mismos
  labels.
- **Que cada página publique su título vía context/store.** Más flexible (permitiría títulos
  dinámicos tipo "Ana Gómez" en la ficha), pero mete estado global y un efecto por página para
  algo que hoy es una función pura de la ruta. Si más adelante hace falta, `sectionTitleForPath`
  es el punto de extensión natural.
- **Breadcrumbs.** No los pide el proposal y con 2 niveles de profundidad no aportan.

### 4. `main`: se saca el `pt-14` y `min-h-screen` pasa a descontar el Topbar

```jsx
<main className="app-main-shell-bg min-h-[calc(100dvh-var(--spacing-topbar))] lg:pl-sidebar">
```

- **`pt-14` se elimina.** El Topbar es `sticky`, o sea que sigue en el flujo y ya ocupa sus 64px
  arriba de `main`; el padding era aditivo (ver Context). Esta es la decisión con más riesgo de
  las seis porque contradice un comentario explícito del código; la task correspondiente incluye
  verificación visual en navegador y el rollback es una sola clase.
- **`lg:pl-sidebar` se conserva**: el Sidebar sí es `fixed` y sí necesita compensación.
- `min-h-screen` → `min-h-[calc(100dvh-var(--spacing-topbar))]`, para que el piso del documento
  sea exactamente el viewport y no viewport + barra.
- `100dvh` (no `100vh`): en mobile la barra de URL dinámica hace que `100vh` sobre-estime el alto
  visible.

*Alternativa descartada:* **hacer el Topbar `fixed` y quedarse con `pt-topbar`.** Es igual de
válido y hasta más explícito para calcular alturas, pero cambia el comportamiento del menú mobile
desplegable (`Topbar.tsx:165-252`), que hoy empuja el contenido en vez de taparlo. Menos cambio =
menos riesgo.

### 5. `Popover` propio en `components/ui/popover.tsx`, sin radix y sin portal

API controlada, calcada del patrón de `dialog.tsx` (context + `open`/`onOpenChange`, sin trigger
descontrolado):

```tsx
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger aria-label="Ver leyenda de roles y estados">
    <Info className="h-4 w-4" />
  </PopoverTrigger>
  <PopoverContent align="start" className="w-72">…</PopoverContent>
</Popover>
```

Comportamiento:

| Aspecto | Resolución |
|---|---|
| Posicionamiento | `PopoverContent` es `absolute` dentro del wrapper `relative inline-flex` que renderiza `Popover`. `align="start" \| "end" \| "center"` mapea a `left-0` / `right-0` / centrado; `side` no se implementa (siempre debajo) hasta que haya un caso real. |
| Montaje | cerrado ⇒ `return null`. Nada oculto pero focuseable en el DOM (el bug que sufrió `Dialog` con `<dialog>` no aplica acá porque no hay hoja de estilos del UA de por medio). |
| ARIA | trigger: `aria-haspopup="dialog"`, `aria-expanded={open}`, `aria-controls={contentId}`. Contenido: `role="dialog"`, `id={contentId}`, `aria-labelledby` al título interno, `tabIndex={-1}`. |
| Foco | al abrir, foco al contenido (`tabIndex={-1}`); al cerrar por Escape o click afuera, **retorno explícito al trigger** (`triggerRef.current?.focus()`). |
| Escape | listener `keydown` en `document` mientras `open`; `onOpenChange(false)` + retorno de foco. |
| Click afuera | listener `pointerdown` en `document`; si el target no está contenido en el wrapper, cierra. `pointerdown` y no `click`, para cerrar antes de que el click active lo que haya debajo (mismo criterio que Radix). |
| Tab afuera | `focusout` del wrapper con `relatedTarget` fuera ⇒ cierra. Sin focus trap: **no es modal**. |
| Estilo | `rounded-xl border border-border bg-surface-1 p-4 shadow-[var(--shadow-level-2)]` — Level 2 del design doc, la misma var que consume `.surface-panel`. Fondo **opaco**, no `/70`: es contenido flotante sobre una tabla densa. |
| Animación | `animate-in fade-in-0 zoom-in-95 duration-150` al abrir. Sin animación de salida ⇒ no hace falta el estado `closing` ni el timeout de seguridad que sí necesita `Dialog`. |

`PopoverTrigger` **no** implementa `asChild` en esta iteración: renderiza un `button` y acepta
`className`/`children`. `lib/slot.tsx` está disponible si un caller futuro lo necesita.

**Limitación declarada, importante para la plantilla**: sin portal, un `PopoverContent` dentro de
un ancestro con `overflow: auto/hidden` queda clippeado. El cuerpo scrollable de la tabla
(Decisión 6) **es** uno de esos ancestros. Por eso el popover de la leyenda vive en el header de
la página, fuera del área scrollable, y queda como regla de uso documentada en el componente.

*Alternativas descartadas:*
- **`@floating-ui/react`.** Resuelve flip/shift/portal de verdad, pero es una dependencia nueva
  (~10kB) en un repo que está sacando dependencias de UI, para un único caso de uso que es un
  panel informativo anclado a un ícono fijo. No se justifica hoy; si aparecen 3 popovers con
  posicionamiento real, se reevalúa.
- **Reusar `Dialog` (un modal chiquito).** Barato, pero un modal para una leyenda bloquea el
  scroll, atrapa el foco y oscurece la vista para mostrar 6 renglones de referencia. Peor UX que
  el problema que resuelve.
- **`title`/tooltip nativo.** El contenido es estructurado (dos grupos, badges y puntos de color)
  y tiene que ser alcanzable por teclado. Un `title` no sirve.
- **`<details>`/`<summary>`.** Cero JS y accesible, pero empuja el layout en vez de flotar, no
  cierra con click afuera y es difícil de estilar como panel elevado.

### 6. `ListPageLayout` en `frontend/src/components/ListPageLayout.tsx`

> **Ajustada por la revisión del dueño**: el slot `description` se elimina (dec. 14) y el marco de
> la tabla pasa de un `div` con borde a un `Card` (dec. 15). El resto —los slots, el alto fijo
> solo en `lg:`, el `min-h-0`, la regla de la acción primaria— sigue igual.

Componente de layout puro (sin estado, sin datos), con cinco slots. La forma sale directo del
requirement "Encabezado compacto de la vista Usuarios": **una sola fila** con título + total +
descripción + acción primaria.

```tsx
<ListPageLayout
  title="Directorio de usuarios"     // renderiza el <h1>
  titleAdornment={<LegendPopover />} // opcional: el ícono de leyenda, junto al título (po-answers #5)
  count={<>{total} usuarios</>}      // el "total de usuarios listados" del requirement
  description="…"                    // una línea; se oculta debajo de md
  primaryAction={<Button>…</Button>}
  toolbar={<>…input de búsqueda…</>}
  footer={<Pagination … />}
>
  {/* children = la tabla */}
</ListPageLayout>
```

Estructura y clases clave:

```
section.flex.flex-col.gap-4.lg:h-[var(--list-page-height)]
├── header  (una fila: h1 + adorno + pill de total + descripción ─── acción primaria)
├── div     (toolbar: barra de filtros)
├── div.flex-1.min-h-0.overflow-hidden.rounded-xl.border  ← marco de la tabla
│   └── {children}   (la tabla, que aporta su propio overflow-auto)
└── footer  (shrink-0: la paginación nunca se va de pantalla)
```

**El conteo va en el header, no en la toolbar.** Un borrador previo de este diseño lo ponía en la
barra de filtros; la spec lo ubica explícitamente en el encabezado, junto al título. La toolbar
queda solo con filtros (hoy: el buscador).

**Acción primaria icon-only en <768px** (requirement "Acción primaria solo con ícono en mobile"):
la responsabilidad es del **caller**, no de la plantilla — `ListPageLayout` recibe el nodo ya
armado, porque cada vista tiene su propio ícono y su propio label. La regla que la plantilla
documenta y el review debe hacer cumplir:

```tsx
<Button aria-label="Crear usuario" onClick={…}>
  <UserPlus className="h-4 w-4 md:mr-2" />
  <span className="hidden md:inline">Crear usuario</span>
</Button>
```

Dos detalles que no son cosméticos:

- **`md:` y no `sm:`**. La spec dice "menores a 768px"; en Tailwind `md` = 768px y `sm` = 640px.
  Usar `sm:` dejaría el texto visible entre 640 y 768px, fuera de spec.
- **El `aria-label` va siempre, no solo en mobile.** `hidden` es `display:none`, y un nodo con
  `display:none` queda fuera del cálculo del nombre accesible: sin el `aria-label` fijo, el botón
  se quedaría **sin nombre** justo en el viewport donde se esconde el texto. Con el `aria-label`
  puesto en los dos casos, el nombre accesible es estable ("Crear usuario") en todos los anchos.

Puntos técnicos que hay que respetar sí o sí:

1. **`--list-page-height` se define derivada en `index.css`**, no se arma con un `calc` inline en
   el className (que en Tailwind exige escapar los espacios con `_` y queda ilegible):
   ```css
   --list-page-height: calc(100dvh - var(--spacing-topbar) - 2 * var(--spacing-page-y));
   ```
   Así el `py-page-y` del contenedor de `App.jsx` (Decisión 1) queda **descontado explícitamente**
   en vez de neutralizado con márgenes negativos, y el requirement de layout unificado de
   `app-shell` sigue valiendo: la list page no cambia el padding del shell, lo consume.
2. **`min-h-0` en el marco de la tabla no es opcional.** El default `min-height: auto` de un ítem
   flex le impide encogerse por debajo de su contenido: sin esto, `flex-1 overflow-auto` no
   scrollea y la tabla desborda la columna. Es el error clásico de este patrón.
3. **El alto fijo aplica solo en `lg:`** (≥1024px, el mismo breakpoint donde el Sidebar deja de
   ser drawer). Debajo de eso la sección es de alto automático y el scroll vuelve a ser el de la
   página. Razones: el menú mobile del Topbar se despliega empujando el contenido (romperia el
   cálculo), el teclado virtual cambia `100dvh` en pleno uso, y anidar scrolls es hostil al gesto
   táctil. En mobile la tabla conserva solo su `overflow-x-auto` (comportamiento del design doc
   para <768px: "horizontally swipeable containers").
4. **El componente no define ancho, `max-w` ni `px`**: los hereda del contenedor del shell.

*Alternativas descartadas:*
- **`h-screen` con `overflow-hidden` en `body` y layout de app tipo "shell fijo".** Es el patrón
  más robusto para "cero scroll de página", pero convierte a *todas* las vistas (Dashboard
  incluido) en scroll interno, lo que está fuera de alcance y rompería el hero del Dashboard.
- **CSS Grid con `grid-template-rows: auto auto 1fr auto`.** Equivalente y hasta más elegante,
  pero `min-h-0` sigue siendo necesario en la fila `1fr` y el resto del repo compone layouts con
  flex. No cambia nada material; se elige consistencia.
- **Tabla virtualizada + alto medido en JS.** La única solución exacta si las filas tuvieran alto
  variable grande. Con 10-100 filas de alto uniforme es sobre-ingeniería.
- **Que cada página arme su propio contenedor de alto fijo.** Es lo que el proposal pide
  explícitamente evitar: Pagos y Asistencias tienen que heredar la plantilla.

### 7. `components/ui/table.tsx` gana `containerClassName` (única forma de que el sticky funcione)

Hoy `Table` envuelve el `<table>` en `<div className="relative w-full overflow-x-auto">` y ese
`className` no es configurable. Eso importa más de lo que parece: `overflow-x: auto` con
`overflow-y: visible` computa a `auto` en ambos ejes, así que **ese div ya es el scroll container**
del `thead` sticky — pero como nunca tiene altura limitada, jamás scrollea en Y y el sticky no se
pega a nada. Envolverlo en otro div scrollable desde afuera no arregla nada: el sticky se resuelve
contra el ancestro scrollable **más cercano**, que sigue siendo el de adentro.

Por eso: `Table` acepta `containerClassName?: string` y la list page le pasa
`"h-full overflow-auto"`. El div interior pasa a ser el contenedor de scroll real.

Además, para el encabezado fijo:

- `position: sticky` va en cada **`th`**, no en el `thead`: con `border-collapse: collapse` (el
  default) varios motores ignoran el sticky aplicado a `thead`/`tr`. Se resuelve con
  `[&_th]:sticky [&_th]:top-0 [&_th]:z-10` en el `TableHeader` del call site.
- El fondo del encabezado tiene que ser **opaco** (`bg-surface-1`). El header actual de `Users.tsx`
  usa `bg-canvas/70 backdrop-blur-xl`: hoy no se nota porque nada scrollea debajo; con scroll
  interno, las filas se leerían a través del encabezado.
- Con `border-collapse: collapse` el borde inferior de una celda sticky no se pinta al scrollear.
  Se dibuja con `shadow-[inset_0_-1px_0_var(--border-hairline)]` en los `th`.

*Alternativas descartadas:*
- **Seguir con `<table>` a mano** (lo que hace `Users.tsx` hoy). Contradice la convención del repo
  ("usar `ui/` antes de crear uno nuevo") y deja a `ui/table.tsx` como código muerto con 0 callers
  eternamente.
- **Reescribir `Table` sacándole el div wrapper.** Rompería el contrato stock de shadcn para
  cualquier call site futuro que espere el scroll horizontal gratis; `containerClassName` es
  aditivo y no rompe a nadie (0 callers hoy).

### 8. Total en el header, rango fuera del footer: `showRange` en `Pagination`

> **Superada por la dec. 19**: el dueño quiere el pie completo, con "Mostrando X-Y de Z" a la
> izquierda y los controles a la derecha. `showRange={false}` se saca del call site y la
> redundancia con el total del header queda aceptada por el PO. La extracción de `getPageRange`
> sigue vigente.

`Pagination.tsx:9-20` calcula `page`, `pages`, `from`, `to` inline y renderiza el texto "Mostrando
X-Y de Z" **junto** con los controles. Con el total ya presente en el header (Decisión 6), el
footer repetiría el mismo número a media pantalla de distancia.

- `Pagination` gana una prop opcional **`showRange?: boolean` con default `true`**. La list page
  la usa con `showRange={false}`: el footer queda solo con el selector de tamaño de página,
  anterior/siguiente y "pág X / Y".
- El default `true` es lo que mantiene a **`Attendance.tsx:272` intacto**: no se toca un archivo
  fuera de alcance.
- La fórmula pura se extrae a `src/services/pagination.ts` (el archivo transversal que ya existe
  con `PaginatedResult` / `readTotalCount`):
  `getPageRange({ total, limit, offset }) => { page, pages, from, to }`, y `Pagination` la consume.
  **Trade-off honesto**: hoy no hay un segundo consumidor, así que esto no se paga solo con
  reutilización. Se justifica por dos cosas concretas: (a) esa aritmética (páginas con `total=0`,
  última página parcial, `offset` fuera de rango) hoy es **intesteable** porque vive dentro de un
  componente que nadie testea, y (b) la plantilla está declarada para tres vistas — Pagos y
  Asistencias la adoptan al reimplementarse — que van a necesitar el mismo cálculo.

*Alternativas descartadas:*
- **Dejar `Pagination` intacta y repetir el total en header y footer.** Cero código, pero muestra
  el mismo número dos veces en una vista cuyo objetivo declarado es ser más compacta.
- **Recalcular `from`/`to` a mano en `Users.tsx`.** Dos fórmulas de la misma cosa; el off-by-one
  aparece en una sola de las dos y nadie se entera.
- **Partir `Pagination` en `<PaginationRange>` + `<PaginationControls>`.** Más limpio a futuro,
  pero obliga a migrar `Attendance.tsx` en este change. Queda anotado como refactor posterior.

### 9. Migración de `Users.tsx`

> **Ajustada por la revisión del dueño**: el título de la página pasa a "Usuarios" y se va la
> descripción (dec. 14); la tabla queda dentro de un `Card` (dec. 15). Las columnas, el fallback
> de Contacto, las acciones como icon-buttons y el popover de leyenda no cambian.

Composición final (de ~390 líneas a ~250 estimadas):

```
<ListPageLayout title="Directorio de usuarios" count={`${total} usuarios`} description
                titleAdornment={<LegendPopover/>} primaryAction={<Crear usuario/>}
                toolbar={<input de búsqueda/>}
                footer={<Pagination showRange={false}/>}>
  <Table containerClassName="h-full overflow-auto"> … </Table>
</ListPageLayout>
```

El `title` es **"Directorio de usuarios"**, distinto del "Usuarios" que muestra el Topbar
(requirement "El título de la página no repite el nombre de sección del Topbar", po-answers #1).

Columnas (6, contra las 5 de hoy — **el `colSpan` de los estados sube de 5 a 6**). Los headers
salen literales del requirement MODIFIED "Listado de Usuarios":

| # | Header | Contenido | Nota |
|---|---|---|---|
| 1 | Nombre | `<MembershipDot/>` + `full_name` | el UUID de la segunda línea se elimina |
| 2 | Contacto | `email` → si no hay, `phone` → si no hay, `"-"` | `truncate` + `title` con el valor completo |
| 3 | Rol | `Badge` con `ROLE_BADGE_CLASS` | sin cambios |
| 4 | Alta | `created_at` en `es-AR` | header renombrado (era "Fecha de alta") |
| 5 | Inicio en el gimnasio | `membership_start_date` o `-` | header renombrado (era "Comienzo en el gimnasio"); misma regla de hoy |
| 6 | Acciones | 3 icon-buttons | el header "Acciones" se mantiene visible, no `sr-only` |

El fallback de Contacto es `"-"` (guion), no "—" ni "Sin contacto": es el literal que fija la spec
y el mismo que ya usa la columna "Inicio en el gimnasio" (po-answers #2).

Otros puntos:

- **Acciones como icon-buttons**: `Button` de `ui/` con `size="icon"` + `variant="outline"`, cada
  uno con `aria-label` **y** `title` (el `aria-label` para lectores de pantalla, el `title` para
  el hover del mouse — un icon-button sin ninguno de los dos es una adivinanza). Textos: "Ver
  perfil de {nombre}", "Editar {nombre}", "Enviar recordatorio por WhatsApp a {nombre}". Incluir
  el nombre hace que la lista de acciones de un lector de pantalla sea navegable (10 filas × 3
  botones idénticos no lo es).
- **WhatsApp sin teléfono**: `disabled` (como hoy) **y** `title`/`aria-label` explicando por qué
  ("… no tiene teléfono cargado"). Un botón deshabilitado sin explicación es un callejón.
- La leyenda (`LEGEND_ROLES`, `LEGEND_INDICATORS`, `INDICATOR_LABEL`, `ROLE_BADGE_CLASS`) se mueve
  tal cual dentro de un componente local `LegendPopover` en el mismo archivo. **No se extrae a
  `components/`**: tiene un solo consumidor; se extrae cuando aparezca el segundo.
- **El popover de leyenda es el mismo en todos los viewports** (requirement "La leyenda usa el
  mismo popover en mobile", po-answers #6): no hay variante drawer/sheet debajo de 768px, aunque
  `components/ui/drawer.tsx` exista. Consecuencia de diseño: `PopoverContent` usa
  `w-[min(18rem,calc(100vw-2rem))]` en vez de un `w-72` fijo, para no desbordar el viewport en
  pantallas de 320px.
- El trigger de la leyenda es un `<button>` real, así que "abrir con Enter o Espacio" y el orden
  de tabulación salen del comportamiento nativo, sin `onKeyDown` propio (requirement "Abrir el
  popover con teclado").
- **`MembershipDot` sí se extrae** a `components/MembershipDot.tsx`: Pagos y Asistencias van a
  necesitarlo cuando se reimplementen, y hoy está duplicado conceptualmente en `UserDetail.tsx`.
- El hero `hero-aura` y la card de leyenda desaparecen de esta vista. `hero-aura` sigue viva como
  utilidad (la usan `Dashboard`, `Reports`, `NewCoach`).
- El label "BUSCAR" en caps sobre el input se va (requirement "Filtro de búsqueda sin etiqueta en
  mayúsculas"); el input queda con `placeholder` + `aria-label="Buscar usuarios"` + ícono `Search`.
  El `aria-label` es obligatorio: al sacar el `<label>` visible, sin él el campo se queda sin
  nombre accesible.
- **Contraste AA** (requirement "Contraste accesible de indicadores de estado y roles"): los
  colores no cambian (`ROLE_BADGE_CLASS` y `INDICATOR_DOT_CLASS` se mudan tal cual), pero ahora
  aparecen sobre dos fondos — la fila de la tabla y la superficie del popover — en dos modos. Eso
  son 4 combinaciones a verificar y no es automatizable en jsdom: va como task manual de
  verificación visual.
- Estados: skeleton / `DataError` / `EmptyState` se conservan **dentro de `<td colSpan={6}>`**,
  como hoy. Mantiene la semántica de tabla y minimiza el diff de los tests.

### 10. Cambios en `docs/design/design.md`

1. **Front-matter, bloque `spacing`**: agregar `topbar-height: 4rem` y `page-gutter-y: 1.5rem`,
   para que los tres tokens de layout (sidebar, topbar, gutter vertical) estén en la misma tabla.
2. **Components → "2. Operational Hero Greeting Card"**: agregar una línea de alcance — es el
   patrón **exclusivo del Dashboard**; ninguna vista de listado lo usa.
3. **Components → nueva "6. List Page"**: las 4 zonas (header compacto de una fila / toolbar /
   cuerpo con scroll propio y encabezado fijo / pie de paginación único), el alto
   `calc(100dvh - topbar - 2×gutter)`, el corte en `lg` para volver al scroll de página en mobile,
   encabezados de columna en `label-caps`, acciones por fila como icon-buttons `rounded-full`, y
   la nota de que Pagos y Asistencias adoptan este patrón al reimplementarse.
4. **Components → "1. Navigation Elements"**: dejar escrito que la Brand Plaque y la Top Utility
   Bar comparten alto y borde inferior (`topbar-height`), y que la barra usa el mismo contenedor
   de ancho máximo que el contenido.
5. **Components → nueva entrada "Popover"** bajo Elevation/Components: superficie Level 2, fondo
   opaco, `rounded-xl`, no modal.

No se tocan Colors, Typography ni la escala de shapes: el change no introduce ningún valor visual
nuevo, solo compone los existentes.

### 11. Tests

**Se rompen (hay que actualizarlos):**

- `pages/__tests__/Users.test.tsx` — los 7 casos. Cambia el texto de 3 headers ("Nombre completo"
  → "Nombre", "Fecha de alta" → "Alta", "Comienzo en el gimnasio" → "Inicio"), aparece "Contacto",
  y el botón "Ver" pasa a `aria-label` (`getByRole("button", { name: /^ver$/i })` deja de
  matchear). Detalle simpático: el comentario de las líneas 63-66 (escopear a la tabla porque
  "Miembro" también aparece en la leyenda del hero) **deja de ser necesario** — la leyenda ya no
  está montada por default. Se puede simplificar o dejar como está (sigue pasando).
- Ninguno más. `Sidebar.test.tsx` afirma sobre texto renderizado, no sobre de dónde salen los
  items, así que mover `NAV_ITEMS` a `lib/navigation.ts` no lo toca. `Topbar.test.tsx` (toggle de
  tema) tampoco.

**Nuevos, mínimos:**

| Archivo | Cubre | Scenario de la spec |
|---|---|---|
| `components/ui/__tests__/popover.test.tsx` | cerrado no renderiza contenido; click en trigger abre y pone `aria-expanded="true"`; Enter/Espacio sobre el trigger abre; Escape cierra **y devuelve el foco al trigger**; click afuera cierra | "Abrir el popover con click" / "con teclado" / "Cerrar con Escape devuelve el foco" |
| `components/__tests__/ListPageLayout.test.tsx` | los 5 slots se renderizan en el orden esperado (header con título + count + acción, toolbar, children, footer); el `title` sale como `h1`; `children` queda dentro del marco `flex-1 min-h-0` | "Encabezado de una fila con título, total, descripción y acción primaria" |
| `lib/__tests__/navigation.test.ts` | `sectionTitleForPath` para `/users`, `/users/u-1` (prefijo), ruta desconocida (`null`); toda entrada de `NAV_ITEMS` tiene importer en `routeImporters` | "Nombre de la sección actual visible en desktop" |
| `services/__tests__/pagination.test.ts` | `getPageRange` con `total=0`, última página parcial, `offset` fuera de rango | soporte de "Una sola paginación visible" |
| `components/__tests__/Topbar.test.tsx` (caso nuevo) | montado en `/users`, el Topbar muestra "Usuarios" | "Nombre de la sección actual visible en desktop" |
| `pages/__tests__/Users.test.tsx` (casos nuevos) | la leyenda **no** está visible por default y aparece al abrir el popover; el título es "Directorio de usuarios" y no repite "Usuarios"; la columna Contacto cae a `phone` sin email y a `"-"` sin ninguno; no se renderiza el UUID; WhatsApp deshabilitado sin `phone` y habilitado con `phone`; un solo control de paginación | "La leyenda no es una card visible por default", "El título de la página no repite el nombre de sección", "Contacto muestra el email/teléfono", "Sin UUID visible", "WhatsApp deshabilitado/habilitado", "Una sola paginación visible" |

**Lo que la suite NO puede verificar** (jsdom no hace layout: no hay `getBoundingClientRect` real,
ni `offsetHeight`, ni scroll, ni media queries que cambien el render): la alineación del Topbar, la
igualdad de alturas con la placa de marca, el alto fijo, el sticky del encabezado, "entra sin
scroll en 1440x900", el icon-only debajo de 768px y el contraste AA. Eso es verificación manual de
QA en navegador, en los dos modos y en ≥1280px / 1024px / <768px, y son los scenarios que las dos
tasks manuales del plan cubren. Escribir asserts sobre strings de clases de Tailwind para simular
esa cobertura es un antipatrón (afirma sobre la implementación, no sobre el comportamiento) y se
evita a propósito — salvo el caso puntual ya establecido en `dialog.test.tsx`, que existe por un
bug de user-agent stylesheet, no por layout.

### 12. Contraste de los puntos de estado en light: tokens semánticos por modo

**Hueco que cierra esta decisión**: la dec. 9 dijo "los colores no cambian" y la task 7.1 mudó
`INDICATOR_DOT_CLASS` literal a `MembershipDot.tsx`. Medido en la implementación, en **light** los
puntos `up_to_date` (`bg-emerald-500`) y `overdue` (`bg-amber-500`) dan ≈2.36 y ≈2.05 en la tabla
(≈2.46 / ≈2.15 en el popover), por debajo del **3:1 de WCAG 1.4.11** para objetos gráficos.
`suspended` (`bg-destructive`) pasa (4.62 / 4.83) y en dark pasan los tres (4.71-9.27). Es un color
preexistente, pero el requirement "Contraste accesible de indicadores de estado y roles" lo vuelve
parte de este change, así que hay que resolverlo acá.

**Elegida: (c) tokens semánticos por modo en `index.css`.** Se agregan `--status-ok`,
`--status-warn` y `--status-danger` a los dos bloques de modo (`:root` y
`:root[data-theme="light"]`, donde ya viven `--primary`, `--destructive`, etc.) y se mapean en
`@theme inline` como `--color-status-ok|warn|danger`, generando `bg-status-ok|warn|danger`.
`INDICATOR_DOT_CLASS` pasa a ser **enteramente** semántico.

Tres razones, y ninguna es estética: (1) `frontend/AGENTS.md` prohíbe explícitamente la clase
cruda de paleta (`nunca una clase cruda zinc-*/amber-*`) para lo que es token-driven, y el mapa hoy
es mitad y mitad (`bg-emerald-500`, `bg-amber-500`, **`bg-destructive`**); (2) la causa raíz es que
`docs/design/design.md` no documenta **ningún** color de estado, así que cada vista los inventa —
`UserDetail.tsx` ya los repite, y Pagos y Asistencias los van a repetir al adoptar la plantilla;
(3) el contraste por modo es exactamente el problema que el archivo de tokens ya resuelve para
`--primary-strong`, que existe porque el amber del 600 no llega a AA como foreground sobre blanco.

Valores y ratios esperados (peor caso = light sobre `#ffffff`; el fondo de la tabla es levemente
más oscuro por el gradiente del shell, así que da un pelo más alto):

| Token | Dark (sin cambio) | Light | Ratio light esperado |
|---|---|---|---|
| `--status-ok` | emerald-500 actual, `oklch(0.696 0.17 162.48)` | emerald-700, `oklch(0.508 0.118 165.612)` | ≈5.3:1 |
| `--status-warn` | amber-500 actual, `oklch(0.769 0.188 70.08)` | amber-700, `oklch(0.555 0.163 48.998)` | ≈5.0:1 |
| `--status-danger` | `var(--destructive)` | `var(--destructive)` (#dc2626) | ≈4.8:1 (ya pasaba) |

Dos notas de implementación: los valores de dark se escriben con los **mismos oklch que la paleta
de Tailwind v4** usa para esos pasos, para que el modo dark quede visualmente idéntico y no haya
regresión; y se eligió el paso **700** y no el 600 en light porque el 600 queda en ≈3.65 (verde) y
≈3.2 (ámbar) — técnicamente por encima de 3:1, pero sin margen para un punto de 10px, donde el
antialiasing del borde curvo se come parte del contraste efectivo. Con 700 los tres estados quedan
en la misma banda de ≈5:1.

*Alternativas descartadas:*
- **(a) `bg-emerald-600 dark:bg-emerald-500` en el className.** Son dos strings y listo, pero deja
  la clase cruda de paleta que la convención prohíbe, ata el valor al paso de una paleta que
  Tailwind ya recalibró una vez (v4 movió todo a oklch: el "emerald-500" de hoy no es el mismo
  color que el de v3), y no le sirve a `UserDetail.tsx` ni a las dos vistas que vienen — cada una
  tendría que acordarse del `dark:`.
- **(b) Anillo/borde de contraste alrededor del punto.** No arregla el color: pasaría a apoyarse en
  el anillo para cumplir 1.4.11, dejando el color semántico como decorativo. Además un punto de
  10px con anillo se lee como un estado "seleccionado/activo" y compite con el lenguaje de los
  pills del design doc.
- **Bajar solo el ámbar y dejar el verde.** Verde en ≈2.4 igual incumple; habría que tocar los dos
  de todos modos.

## Revisión del dueño

Cinco cambios pedidos por el dueño del producto sobre la implementación ya andando (64/65 tasks,
tests y lint en verde), más una corrección posterior sobre el alcance de la Card y un pedido de
paridad visual con la tabla de Asistencias. Van como decisiones 13-19 porque cada una revierte o
reemplaza algo que este documento había decidido antes,
y conviene que quede el rastro de por qué. Fuente: pedido del dueño vía coordinador; el Product
Owner lo está reflejando en `proposal.md`, las specs y la sección "Revisión del dueño" de
`po-answers.md`.

### 13. El Topbar no muestra el nombre de sección, y `sectionTitleForPath` se elimina

Se saca el bloque del slot izquierdo de `Topbar.tsx` (el `const sectionTitle` de la línea ~102 y
el `div.hidden.lg:flex` de ~122-125). En desktop el slot izquierdo queda vacío, como estaba antes
del change.

**`sectionTitleForPath` se borra de `lib/navigation.ts` junto con sus 3 casos de test**, en vez de
quedar como export sin caller. Es la convención establecida del repo — `hooks/useConfirm.tsx` y
`components/ui/alert-dialog.tsx` se borraron por exactamente esto, y hay un commit reciente
("borrar componentes/hooks/servicios sin ningun caller") que lo ratifica. Lo que **sí** se
conserva es `NAV_ITEMS`, que mantiene dos consumidores reales (`Sidebar.tsx` y `navItemsForRole`
en `Topbar.tsx:18`) y su test de drift contra `routeImporters`: el archivo `lib/navigation.ts` no
se elimina, solo se le saca la función.

*Alternativa descartada:* dejar `sectionTitleForPath` "por si vuelve". Un export sin caller no
tiene test que lo proteja de romperse ni consumidor que lo mantenga honesto, y el historial dice
que en este repo esos exports se terminan borrando igual, seis meses después.

**Impacto en la spec** (territorio del PO, anotado en Open Questions): el requirement
"Alineación del Topbar con el contenedor de contenido" de `specs/app-shell/spec.md` pierde el
scenario "Nombre de la sección actual visible en desktop", y el criterio verificable de la
alineación pasa a ser **bordes del contenedor interno del Topbar vs. contenedor de `main`** más el
borde derecho del toggle de tema. Como efecto secundario, esto **resuelve la Open Question** que
este diseño tenía abierta sobre el scenario del buscador global: sin nombre de sección en el slot
izquierdo, ya no hay dos scenarios que se contradigan.

### 14. Encabezado de Usuarios: título "Usuarios", sin descripción, y el slot `description` se elimina

`Users.tsx:231-234` pasa a `title="Usuarios"` y se le saca `description`. El título de la página
vuelve a ser el nombre de la sección, que es coherente con dec. 13: al no estar el nombre en el
Topbar, ya no hay duplicación que evitar, y "Directorio de usuarios" era precisamente una
perífrasis para no repetirlo. Esto revierte po-answers #1.

**La prop `description` se elimina de `ListPageLayout`** (tipo + destructuring + el `<p>` de las
líneas 62-66), no se deja como opcional sin usar: es el mismo criterio de dec. 13, y el bloque
`hidden md:block` que la renderizaba era además el único lugar del layout que ocultaba contenido
por viewport. Se ajusta el caso "no renderiza los slots opcionales que no se pasan" de
`ListPageLayout.test.tsx` y el caso del título en `Users.test.tsx:74`.

*Alternativa descartada:* conservar `description` opcional para Pagos/Asistencias. Es
generalidad especulativa sobre un slot que el dueño acaba de sacar del patrón; re-agregar una prop
opcional cuando aparezca el caso real cuesta cuatro líneas.

### 15. La tabla va dentro de un `Card`, y lo aporta `ListPageLayout`

> **Superada por la dec. 18**: el dueño corrigió el alcance — la Card no envuelve la tabla, sino
> la vista entera. Se conserva acá el razonamiento de *quién* aporta la Card (la plantilla, no la
> vista) y el de los defaults del `Card` stock, que la 18 reutiliza.

El marco de la tabla pasa del `div className="flex-1 min-h-0 overflow-hidden rounded-xl border
border-border"` (`ListPageLayout.tsx:78`) a un `Card` de `components/ui/card.tsx` con
`className="flex-1 min-h-0 gap-0 overflow-hidden py-0"`.

**Lo aporta la plantilla, no `Users.tsx`.** El marco ya vive ahí, y es donde están las dos clases
frágiles del patrón (`flex-1 min-h-0`, sin las cuales el scroll interno no funciona — dec. 6.2):
si el `Card` lo pusiera la vista, o quedarían dos marcos anidados, o cada vista futura tendría que
volver a derivar el `min-h-0` de memoria. Con el `Card` en la plantilla, Pagos y Asistencias lo
heredan.

Tres detalles que el `Card` stock de shadcn obliga a neutralizar, porque está pensado para
contenido con padding y no para un cuerpo scrollable a sangre:

- **`py-0` y `gap-0`**: el `Card` trae `py-6 gap-6` (`card.tsx:10`). Sin anularlos, la tabla
  arrancaría 24px más abajo, el alto útil se recortaría y el `flex-1` competiría con el `gap`.
- **`overflow-hidden`**: necesario para que el `rounded-xl` recorte la primera y la última fila,
  y para que el contenedor scrollable interno de `Table` no se desborde de las esquinas.
- **El fondo del `th` sticky pasa de `bg-surface-1` a `bg-card`** (`STICKY_HEAD_CLASS`,
  `Users.tsx:125-126`). Hoy los dos resuelven al mismo valor (`--color-card: var(--surface-1)`, ver
  `index.css:40`), así que no hay cambio visual: el punto es **atarlos al mismo token** para que
  un futuro retoque de `--color-card` no deje el encabezado sticky de un color y la Card de otro,
  que es justo el bug que el fondo opaco de dec. 7 vino a evitar.

`Card` conserva su `shadow-sm` stock: es el Level 1 del design doc (contención por borde hairline)
y lo que ya usan las demás cards del repo. No se toca.

### 16. El Sidebar no lleva línea horizontal a la altura del Topbar

Se quita `border-b border-border` del `div` que envuelve la placa de marca (`Sidebar.tsx:42`). La
línea existía solo para que el borde inferior del Sidebar y el del Topbar se leyeran como una sola
horizontal continua (dec. 2); el dueño no la quiere, y sin la igualdad de alturas de dec. 17 esa
continuidad ya no es alcanzable de todos modos.

### 17. El alto de la placa de marca se desacopla de `--spacing-topbar`

`Sidebar.tsx:42` pasa de `flex h-topbar items-center px-4` a un contenedor con padding propio
(`px-4 pt-4 pb-2`), sin `h-topbar`: la placa deja de estar pegada al borde superior del viewport y
recupera el aire que tenía antes del change. Hay que **reescribir el comentario de
`Sidebar.tsx:37-41`**, que hoy justifica el `h-topbar` y el borde con la simetría de dec. 2 y
quedaría mintiendo.

`--spacing-topbar` **no se elimina**: sigue siendo la altura del Topbar (`Topbar.tsx:106-107`) y un
insumo de `--list-page-height` (dec. 6.1), que es lo que sostiene el "sin scroll de página". Lo que
cambia es su alcance: pasa de "altura compartida del shell" a "altura del Topbar", y el Sidebar
deja de consumirlo.

El logo queda en `h-9 w-9` (36px). Bajarlo de 40 a 36 fue consecuencia de encajar en 64px
(po-answers #4) y ese constraint desaparece, pero el dueño no pidió revertirlo y volver a 40px
mueve la placa otra vez: fuera de alcance, anotado acá para que no parezca un olvido.

**Trade-off aceptado**: el Sidebar y el Topbar quedan deliberadamente asimétricos en el borde
superior. Se cambia la simetría estructural por el criterio estético explícito del dueño, que es
quien decide.

### 18. La `Card` envuelve la vista entera, no solo la tabla (corrige la 15)

Corrección del dueño sobre el punto 3 de su revisión: la Card tiene que contener **toda** la vista
—encabezado (título, total, leyenda, acción primaria), barra de filtros, tabla y pie de
paginación—, no solamente el cuerpo de la tabla. La vista se lee como un único panel Level 1 en vez
de como cuatro bloques sueltos con un recuadro en el medio.

**La `Card` reemplaza al `section` como raíz de `ListPageLayout`**, y el marco de la tabla vuelve a
ser un `div`:

```
Card  flex flex-col gap-4 p-4 sm:p-5 lg:h-[var(--list-page-height)]   ← raíz (era <section>)
├── header  (título + adorno + total ─── acción primaria)
├── toolbar
├── div  flex-1 min-h-0 overflow-hidden rounded-lg border border-border   ← marco de la tabla
│   └── {children}
└── footer  (shrink-0)
```

**No hace falta `py-0 gap-0`** (que es lo que pedía la dec. 15 para la Card interna): `cn` de este
repo es `twMerge(clsx(...))` (`lib/utils.ts`), y tailwind-merge sabe que `p-*` supersede a `py-*` y
que `gap-4` supersede a `gap-6`, así que pasar `gap-4 p-4 sm:p-5` **elimina** el `py-6 gap-6` que
trae `card.tsx:10` en vez de coexistir con él. Sin `twMerge` esto sería un bug silencioso: en el
orden de utilidades de Tailwind, `py-6` gana sobre `p-5` por posición en la hoja, no por
especificidad, y el padding vertical quedaría en 24px sin que nadie lo pidiera.

Lo que **sí** hay que conservar del layout anterior, porque es lo que sostiene el "sin scroll de
página": `flex flex-col`, el `gap-4` entre zonas, el `lg:h-[var(--list-page-height)]` **en la
raíz** (la Card, no un wrapper extra: `box-sizing: border-box` del preflight hace que el `h-*`
incluya el padding, así que el footprint total no cambia) y el `flex-1 min-h-0 overflow-hidden` del
marco de la tabla.

**Fondo del `th` sticky: `bg-card` sigue siendo correcto y no se toca.** El marco de la tabla es un
`div` sin fondo propio, así que lo que se ve detrás del encabezado sticky es la superficie de la
Card. Si en algún momento ese `div` recibe un fondo distinto (p. ej. `bg-surface-2`), el `th` tiene
que seguirlo — es la misma trampa de la dec. 7: un encabezado sticky con fondo que no coincide con
el de su contenedor deja ver las filas al scrollear.

**Radio anidado**: Card en `rounded-xl` (16px) y marco interno en `rounded-lg` (8px), que es la
escala del design doc (paneles `rounded-xl`, elementos internos `rounded-lg`) y evita el efecto de
esquinas concéntricas mal calzadas.

**Presupuesto de alto, verificado contra la última medición del Dev** (1440x900, 10 filas de 49px):
`--list-page-height` = 900 − 64 (topbar) − 48 (2× gutter) = **788px**. El padding nuevo de la Card
consume 40px (`p-5` arriba y abajo) + 2px de borde. La medición previa dejaba el bottom de la fila
10 en 722 contra un footer que arranca en 845 — **123px de aire**, y el contenedor de la tabla
cerraba con `scrollHeight === clientHeight === 621` para ~530px de contenido real. Descontar ~42px
deja el contenedor en ~579px para esos ~530px: **las 10 filas siguen entrando sin scroll interno**,
con ~80px de margen. Es holgado, pero es lo que hay que re-medir en 11.18 antes de dar por buena la
task.

*Alternativas descartadas:*
- **Card interna solo para la tabla + Card externa.** Dos superficies Level 1 anidadas: el design
  doc no tiene un nivel intermedio y el borde doble se lee como un error de maquetación.
- **Mantener el `section` como raíz y meter la Card adentro con `h-full`.** Un nodo extra que solo
  existe para reenviar el alto, y duplica el lugar donde se define la altura de la vista.
- **Card en `Users.tsx` en vez de en la plantilla.** Mismo argumento que la dec. 15: el alto fijo y
  el `min-h-0` viven en la plantilla; partirlos entre dos archivos es exactamente cómo se rompe
  este patrón.

### 19. Pie de paginación completo y encabezado de columnas igual al de Asistencias

El dueño tomó la tabla de Asistencias como referencia y pidió dos cosas. Van juntas porque las dos
son "que Usuarios se vea como Asistencias", pero tienen causas distintas.

#### 19.1 Pie: se saca `showRange={false}`

`Users.tsx:264` deja de pasar `showRange={false}` y `Pagination` vuelve a su render por defecto:
"Mostrando X-Y de Z" a la izquierda, selector de tamaño + Anterior / pág N / M / Siguiente a la
derecha, todo en una fila (`Pagination.tsx:23`, `sm:flex-row sm:items-center sm:justify-between`).

**No agrega alto en desktop**: el rango y los controles son los dos hijos del mismo flex row a
partir de `sm`. Debajo de `sm` el contenedor es `flex-col` y sí suma una línea, pero ahí la vista
ya está en scroll de página (dec. 6.3), así que no toca el presupuesto de alto.

El total del header **se conserva**: la redundancia entre "128 usuarios" arriba y "de 128" abajo
queda explícitamente aceptada por el PO. Es exactamente el trade-off que la dec. 8 había resuelto
al revés; el criterio de producto cambió y el diseño lo sigue.

**Consecuencia sobre `showRange`**: si al sacar este call site no queda ningún caller pasándolo
(`Attendance.tsx:272` nunca lo pasó, usa el default `true`), la prop queda huérfana y se borra de
`Pagination.tsx`, junto con el condicional que la consume. Es el mismo criterio de las dec. 13 y
14, y acá el riesgo es nulo: el default era `true`, o sea el comportamiento que queda. `getPageRange`
en `services/pagination.ts` **no** se toca — sigue siendo lo que `Pagination` usa para calcular, y
tiene test propio.

#### 19.2 Peso del encabezado: `font-bold` explícito en `STICKY_HEAD_CLASS`

La diferencia visual está identificada y no es el token de tipografía, es la cascada:

- Asistencias usa un `<th>` pelado (`Attendance.tsx:206-211`, `className="px-4 py-3"`), así que
  hereda el `font-weight: bold` de la hoja de estilos del user-agent para `th`.
- Usuarios usa `TableHead` de `ui/table.tsx`, cuya clase base incluye **`font-medium`**
  (`table.tsx:75`) — un author-origin que pisa el default del UA. De ahí que se vea más liviano.

Se agrega **`font-bold`** (700) a `STICKY_HEAD_CLASS` (`Users.tsx:130-131`). Va `font-bold` y no
`font-semibold` por dos razones convergentes: es el peso exacto que hereda Asistencias del UA, y es
el que `docs/design/design.md` fija para `label-caps` (`fontWeight: '700'`). El override funciona
sin `!important` porque `TableHead` compone con `cn(base, className)` y tailwind-merge resuelve el
conflicto de `font-*` a favor del className.

**Lo que NO se hace, y por qué**: la causa de fondo es que `index.css` define
`--text-label-caps` con line-height y letter-spacing pero **sin** el submodificador
`--text-label-caps--font-weight: 700` que Tailwind v4 soporta, así que la utilidad `text-label-caps`
no lleva peso y contradice al design doc. Arreglarlo en el token sería lo correcto de raíz, pero hay
**30 call sites de `text-label-caps` en el repo y ninguno fija peso propio**: pasarlos todos a 700
de golpe es un cambio visual en Dashboard, Reports, Settings, Sidebar, UserCard, SpotlightSearch y
los diálogos, muy fuera del alcance de este change. Queda anotado como deuda en Open Questions.

#### 19.3 Banda de fondo: token `--table-head` por modo

Asistencias logra su banda con `bg-surface-2/40`, que es **translúcido**. La dec. 7 prohíbe eso acá:
el encabezado de Usuarios es `sticky` sobre contenido que scrollea debajo, y con fondo translúcido
las filas se leen a través del header.

Se define en `index.css`, en los dos bloques de modo, junto a `--status-*` (dec. 12):

```css
--table-head: color-mix(in srgb, var(--surface-2) 40%, var(--surface-1));
```

mapeado en `@theme inline` como `--color-table-head`, que genera `bg-table-head`. En
`STICKY_HEAD_CLASS`, `bg-card` → `bg-table-head`.

`color-mix` **resuelve el color a un opaco en tiempo de cómputo**: da el mismo tono que
`bg-surface-2/40` sobre la Card, pero sin canal alfa, así que cumple la restricción de la dec. 7 sin
renunciar al aspecto que pidió el dueño. Es además la técnica que `index.css` ya usa en cinco
lugares (`--shell-gradient-*`, `.app-main-shell-bg`, `.warm-scrollbar`), no un truco nuevo.

**Nota honesta de fidelidad**: la banda de Asistencias mezcla contra el fondo de *página*; ésta
mezcla contra `--surface-1`, que es la superficie de la Card donde ahora vive la tabla (dec. 18).
El tono queda en la misma familia pero no es pixel-idéntico. Igualarlo del todo requeriría que
Asistencias también viviera en una Card, que es justo el follow-up de abajo.

*Alternativas descartadas:*
- **`bg-surface-2` opaco a secas.** Un solo token existente y cero código nuevo, pero es el 100% de
  surface-2: en light salta de un gris casi imperceptible (`#f4f7f9`) a uno marcado (`#e2e8f0`), y
  la banda pasa a competir con las filas en vez de separarlas.
- **`bg-card` + un `bg-[linear-gradient(...)]` de surface-2 al 40% encima.** Reproduce el blend
  exacto manteniendo opacidad real, pero mete dos capas de background en un string de utilidades
  para lo que un `color-mix` nombrado resuelve en una línea, y no es reutilizable por otra vista sin
  copiar el gradiente.

#### 19.4 Follow-up fuera de este change: unificar las tablas

Hay **seis** `<thead>` escritos a mano con `text-label-caps` en el repo (`Attendance.tsx:206`,
`Reports.tsx:458` y `:552`, `Dashboard.tsx:615`, `UserRoutine.tsx:299`, más el de Usuarios que este
change ya migró a `ui/table.tsx`). Que Asistencias adopte `ui/table.tsx` y `bg-table-head` es
deseable —una sola tabla en la app en vez de dos estilos— pero es un change propio: toca vistas
fuera de alcance, una de ellas (`Attendance.tsx`) deliberadamente intacta acá, y las otras cuatro ni
siquiera están en el proposal. **No se implementa en este change**; queda registrado como criterio
para cuando Pagos y Asistencias se reimplementen con la plantilla, que es el momento natural.

## Hallazgos de verificación

El gate dio **FALLA** con 29/30 escenarios en PASA y 12 hallazgos
([verification.md](./verification.md)). Las decisiones 20-23 los resuelven.

### 20. `cn()` descarta los tamaños custom del `@theme`: se extiende tailwind-merge

**El bug** (hallazgo 1, bloqueante y el que tumba el escenario): tailwind-merge no conoce
`text-label-caps`. Como no matchea su patrón de tamaños, lo clasifica en el grupo `text-color`,
donde colisiona con `text-muted-foreground` — que va después en el string y por lo tanto **lo
elimina**. El encabezado termina en 14px sin `letter-spacing` en vez de 11px / 0.08em.

Esto **no es un problema de la tabla**: es un problema de `cn` que afecta a los **nueve** tamaños
custom que `index.css` declara en `@theme inline` (`headline-hero`, `headline-lg`, `headline-md`,
`metric-kpi`, `body-lg`, `body-md`, `body-sm`, `label-caps`, `label-code`). Cualquier componente
que pase uno de esos junto a un `text-*-foreground` por el mismo `cn()` pierde el tamaño en
silencio: sin error, sin warning, solo tipografía equivocada.

**Elegida: (a) `extendTailwindMerge` en `lib/utils.ts`**, declarando los nueve nombres en el grupo
`font-size`:

```ts
export const cn = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["headline-hero", "headline-lg", "headline-md", "metric-kpi",
                             "body-lg", "body-md", "body-sm", "label-caps", "label-code"] }],
    },
  },
});
```

**Verificado ejecutando tailwind-merge 3.3.1** (la versión instalada), no deducido del manual:

| Caso | Antes | Después |
|---|---|---|
| `cn(TableHead base, STICKY_HEAD_CLASS)` conserva `text-label-caps` | `false` | `true` |
| `text-muted-foreground` sobrevive | sí | sí |
| `text-foreground` del base lo pisa el `text-muted-foreground` del className | sí | sí |
| `cn("text-body-md text-label-caps")` colapsa a un solo tamaño | — | `text-label-caps` |

O sea: arregla el tamaño perdido, sigue resolviendo bien los colores y ahora **también** resuelve
colisiones entre dos tamaños custom, que antes convivían rotos en el mismo elemento.

**Guard contra drift**: el listado de nombres es una copia de lo que declara `index.css`, y un
`--text-*` nuevo agregado allá sin tocar acá reintroduce el bug para ese token. Se cubre con un
test que lee `index.css`, extrae los `--text-<nombre>:` y afirma que todos están en la config de
`cn` — mismo patrón que el test de drift `NAV_ITEMS` ↔ `routeImporters` (dec. 3), que ya demostró
servir. Más un test del caso concreto: `cn("text-label-caps", "text-muted-foreground")` conserva
los dos.

*Alternativas descartadas:*
- **(b) Poner `text-label-caps` como string crudo en el `<thead>`/`TableRow` y que los `th` lo
  hereden.** Esquiva `cn` en este call site y deja los otros ocho tokens rotos para el próximo que
  los use. Trata el síntoma.
- **(c) `[&]:text-label-caps` u otra variante que twMerge no colapse.** Funciona por accidente —se
  apoya en que la herramienta no entienda la clase— y deja un patrón críptico que hay que explicar
  en cada uso. Además rompe de verdad la deduplicación: dos tamaños custom en el mismo elemento ya
  no se resuelven.

### 21. Padding del `th`: `px-4` en `STICKY_HEAD_CLASS`, no en el default de `ui/table.tsx`

Hallazgo 2: los `th` heredan `px-2` del base de `TableHead` (`table.tsx:75`) mientras las celdas
usan `px-4 py-2`, así que cada título de columna queda 8px a la izquierda de su contenido.
Asistencias, la referencia que pidió el dueño, tiene `th` y `td` con el mismo `px-4`.

Se agrega **`px-4` a `STICKY_HEAD_CLASS`**, no se toca el default de `ui/table.tsx`. Razón: `p-2`
en `TableCell` y `px-2` en `TableHead` son el par coherente que trae shadcn de fábrica; la vista ya
decidió apartarse de él en las celdas (`px-4 py-2`, para bajar el alto de fila a 49px en la task
10.2), y la corrección tiene que vivir **en el mismo lugar donde se tomó esa decisión**, no en el
primitivo. Cambiar el default de `ui/table.tsx` haría que los dos lados queden desparejos otra vez
para cualquier caller que use las celdas stock.

*Alternativa descartada:* `px-4` en el base de `TableHead`. Hoy es gratis (0 callers fuera de
Users), pero desalinea al primer caller que use `TableCell` stock, que es exactamente el bug que
estamos arreglando, con los papeles invertidos. **Criterio para el futuro**: si una tercera vista
repite `px-4` en head y cell, ese es el momento de una variante de densidad en `ui/table.tsx`, no
de mover el default.

### 22. El menú mobile vuelve a empujar el contenido: `lg:h-topbar` en el `<header>`

Hallazgo 3: el `h-topbar` quedó en el `<header>` (la task 2.2 lo pedía en el `div` interior). Como
el panel del menú mobile se renderiza dentro de ese header de alto fijo y sin `overflow-hidden`,
**desborda** y tapa los ~350px superiores de `main` con un fondo 95% opaco, en vez de empujar el
contenido. Esto contradice de frente la dec. 4, que justificó no hacer el Topbar `fixed`
precisamente para conservar el empuje.

Se aplica la propuesta: `lg:h-topbar` en el `<header>` (`Topbar.tsx:105`) y `h-topbar lg:h-full` en
el `div` interior (`:106`). Chequeo de las tres cosas que esto podría romper:

- **Alineación en desktop**: en `lg`, header 64px + `border-b`, interior `h-full` = 64px. Idéntico a
  hoy; el escenario de bordes que dio PASA no se mueve.
- **`main min-h-[calc(100dvh-var(--spacing-topbar))]`**: debajo de `lg`, con el menú abierto el
  header mide más de 64px y `main` sobre-reserva alto, lo que puede sumar unos píxeles de scroll de
  página. Es aceptable y no rompe nada: debajo de `lg` la list page **no** tiene alto fijo (dec.
  6.3) y el scroll de página es el comportamiento esperado.
- **Sticky**: el header sigue siendo `sticky top-0` y crece con el panel, que es exactamente la
  estructura que tenía antes de este change.

**La línea doble se arregla sola**: hoy el `border-b` del header cae en Y=64 y el `border-t` del
panel también, porque el panel se sale de la caja del header. Cuando el header crece, su `border-b`
pasa a estar debajo del panel y el `border-t` queda como el separador legítimo entre barra y menú.
No hace falta tocar ninguno de los dos bordes.

### 23. Hallazgos menores: qué entra y qué se acepta

| # | Hallazgo | Resolución |
|---|---|---|
| 4 | `docs/design/design.md` se contradice: la línea 248 dice que el pie muestra el rango con redundancia aceptada, las 277-279 dicen que "el total no se repite acá" y que el fondo del header fijo es `bg-card` | **Entra.** Un documento normativo con dos reglas opuestas es peor que uno desactualizado. Se borran las dos afirmaciones viejas (revertidas por dec. 19) y el `bg-card` pasa a `--table-head` |
| 5 | `index.css:121-126`: el comentario de `--spacing-topbar` dice que el Sidebar comparte la var | **Entra.** Falso desde dec. 16/17 |
| 6 | `frontend/AGENTS.md` desactualizado: describe Users con hero y card de leyenda, cita `max-w-7xl` en vez de `.app-container`, no lista los 4 tests nuevos ni `Popover` | **Entra.** El `AGENTS.md` raíz obliga a documentar tests nuevos en el de la app; es la entrada de contexto de todo agente que toque el frontend |
| 7 | El test "Enter y Espacio abren" usa `fireEvent.click`: afirma cobertura que no tiene | **Entra, reformulado.** No hay `@testing-library/user-event` instalado y no se agrega una dependencia por un test. Se renombra a lo que realmente verifica y se agrega la aserción que **sí** da la garantía: que el trigger es un `<button>` nativo (`tagName === "BUTTON"`, no un `div` con `role="button"`) — la activación por Enter/Espacio la da esa semántica, no código nuestro |
| 8 | `popover.tsx:134`: `aria-controls` apunta a un id inexistente con el popover cerrado | **Entra.** `aria-controls={open ? contentId : undefined}` |
| 9 | `Users.tsx:237`: `${total} usuarios` produce "1 usuarios" | **Entra.** Singular/plural condicional |
| 10 | El header es `flex-col` hasta 640px, así que debajo son dos filas y el escenario "una fila" no acota viewport | **Aceptado.** El requirement apunta a la compactación en desktop, donde el hero de 260px era el problema; apilar en `<640px` es la afordancia mobile estándar y QA lo marcó PASA. Existe la opción de forzar una fila siempre (con la acción ya icon-only debajo de 768px, entra en 390px), pero cambia un layout mobile ya verificado para satisfacer una lectura literal que el PO no pidió: si la quiere, es una línea |
| 11 | Filtro por rol duplicado literal entre `Topbar.tsx:18-25` y `Sidebar.tsx:19-25`, sin test de sincronía | **Entra, con extracción.** `navItemsForRole(role)` se muda a `lib/navigation.ts` y lo consumen los dos. El comentario de `Topbar.tsx:14-17` justificaba la duplicación como "lógica de 3 líneas atada a cada consumidor"; el hallazgo la falsea — son 4 líneas **byte a byte idénticas** y un item owner-only agregado solo en Sidebar se filtra a coaches en el menú mobile. Un test de sincronía protegería la copia en vez de eliminarla, y ya existe el lugar canónico donde ponerla |
| 12 | Derivar el menú mobile de `NAV_ITEMS` cambió "Dashboard" por "Seguimiento" y el orden | **Aceptado**, es la consecuencia correcta de la fuente única (dec. 3): el label ahora coincide con el del Sidebar, que es lo que ve el mismo usuario en desktop. **Pero es un cambio visible no anotado**: le corresponde al PO registrarlo en `proposal.md` — queda en Open Questions |

## Risks / Trade-offs

- **Sacar el `pt-14` de `main` contradice un comentario explícito del código.** Si el Topbar
  estuviera efectivamente fuera del flujo, el contenido quedaría tapado 64px. → *Mitigación*: la
  task lo aísla como paso propio con verificación visual en navegador antes de seguir; el rollback
  es reponer una clase. Bajo `sticky` (no `fixed`) el elemento sí ocupa su espacio, así que el
  riesgo real es bajo.
- **Cambiar la placa de marca del Sidebar toca un archivo que no estaba en el alcance original.**
  → *Resuelto*: el PO lo aceptó y `proposal.md` (What Changes + Impact) ya incluye `Sidebar.tsx`
  (po-answers #4). El cambio es puramente dimensional (logo 40→36px): no toca la identidad visual
  de la placa (`warm-accent-bg warm-glow rounded-xl` se conservan).
- **`Popover` sin portal se clippea dentro de contenedores con `overflow`.** → *Mitigación*: regla
  de uso documentada en el componente + el único caller vive en el header, fuera del área
  scrollable. Si aparece un caso dentro de la tabla, ahí sí se evalúa portal o floating-ui.
- **`100dvh` tiene soporte parcial en Safari < 15.4.** → *Mitigación*: el alto fijo solo aplica en
  `lg:` (desktop, donde `dvh ≡ vh`), y el fallback natural (alto automático + scroll de página) es
  exactamente el comportamiento de hoy. Degradación limpia.
- **Con muchas filas y zoom alto (200%), el cuerpo de la tabla queda muy angosto.** Es el
  trade-off explícito del scroll interno: se cambia "todo visible" por "controles siempre
  visibles". → *Mitigación*: el corte en `lg:` cubre el caso extremo, porque zoom alto reduce el
  viewport CSS por debajo de 1024px y la vista vuelve al scroll de página.
- **`getPageRange` toca `services/pagination.ts`, que consumen todos los fetchers.** → El cambio
  es puramente aditivo (una función nueva); `PaginatedResult` y `readTotalCount` no se tocan.
- ~~El header de la list page y el título de sección del Topbar podrían decir lo mismo a 60px de
  distancia.~~ → **Disuelto por dec. 13 y 14**: el Topbar ya no muestra nombre de sección, así que
  la list page usa directamente el nombre de la sección como título ("Usuarios") y no hay
  duplicación posible. Las próximas list pages heredan la regla simple: el título es el nombre de
  la sección.
- **El popover único en mobile puede quedar apretado en 320px** (po-answers #6 descartó el
  drawer). → *Mitigación*: ancho fluido `w-[min(18rem,calc(100vw-2rem))]` en vez de `w-72` fijo, y
  verificación visual en la task manual de mobile.

## Migration Plan

Sin migración de datos ni feature flag: es UI, se despliega con el build. Orden por dependencia
(el detalle granular va en `tasks.md`):

1. **Tokens y utilidad CSS** (`index.css`): `--spacing-topbar`, `--spacing-page-y`,
   `--list-page-height`, `.app-container`. No cambia nada visible todavía.
2. **Shell**: `App.jsx` (contenedor + alturas de `main`), `Topbar.tsx` (contenedor + `h-topbar`),
   `Sidebar.tsx` (banda de marca). ⇒ **Punto de verificación visual #1**: alineación y ausencia de
   scroll de página con el Dashboard actual.
3. **`lib/navigation.ts`** + consumo en `Sidebar` y `Topbar` (título de sección + labels del menú
   mobile).
4. **`ui/popover.tsx`** + su test. Aislado, no depende de nada anterior (podría ir en paralelo).
5. **`ui/table.tsx`**: `containerClassName`. Cambio de 2 líneas, 0 callers.
6. **`services/pagination.ts`** (`getPageRange`) + `Pagination.tsx` (`showRange`, default `true`).
   Verificar que `Attendance.tsx` sigue renderizando igual sin tocarlo.
7. **`ListPageLayout.tsx`** + su test.
8. **`Users.tsx`**: migración completa + `MembershipDot` extraído + actualización de
   `Users.test.tsx`. ⇒ **Punto de verificación visual #2**: 1440x900 con 10 filas sin scroll de
   página, encabezado fijo al scrollear el cuerpo, popover abre/cierra, acción primaria icon-only
   debajo de 768px, y contraste AA de badges y puntos en tabla y popover, en dark y light.
9. **`docs/design/design.md`**: las 5 ediciones de la Decisión 10.
10. `make test-frontend` en verde + `npm run lint`.

**Rollback**: `git revert` del merge. No hay estado persistido, ni claves nuevas de
`localStorage`, ni contrato de API tocado — un usuario con la versión vieja y uno con la nueva ven
exactamente los mismos datos.

## Decisiones del Product Owner aplicadas

Las 7 preguntas que este diseño había dejado abiertas están respondidas en
[`po-answers.md`](./po-answers.md) y ya son requirements con scenario propio en las delta specs.
Dónde impactó cada una:

| # (po-answers) | Decisión | Dónde vive en este diseño |
|---|---|---|
| 1 | Título de página "Directorio de usuarios", Topbar "Usuarios" | Decisiones 3 y 9 |
| 2 | Contacto: email → teléfono → `"-"` | Decisión 9 (tabla de columnas) |
| 3 | Headers: Nombre / Contacto / Rol / Alta / Inicio en el gimnasio / Acciones | Decisión 9 + tests (Decisión 11) |
| 4 | Sidebar en alcance: placa a 64px, logo a 36px | Decisión 2 + `proposal.md` actualizado |
| 5 | Ícono de leyenda junto al título, no en el `<th>` "Nombre" | Decisiones 6 (`titleAdornment`) y 9 |
| 6 | Popover único en todos los viewports, sin drawer | Decisiones 5 y 9 (ancho fluido) |
| 7 | Acción primaria icon-only debajo de 768px | Decisión 6 (regla `md:` + `aria-label` fijo) |

Cambios que estas respuestas provocaron sobre el borrador anterior del diseño: el **total pasó de
la toolbar al header** (requirement "Encabezado compacto…"), lo que a su vez motivó `showRange` en
`Pagination` (Decisión 8), y `ListPageLayout` pasó de 4 a **5 slots** (`count`).

## Open Questions

- ~~La spec de `app-shell` tiene un scenario que no cierra con el requirement que lo contiene~~
  (el borde izquierdo del buscador global vs. el nombre de sección en el slot izquierdo).
  **Resuelto por dec. 13**: al sacarse el nombre de sección, el criterio queda uno solo — bordes
  del contenedor interno del Topbar contra el contenedor de `main`, más el borde derecho del
  toggle.
- **Dependencia con el PO** (no bloquea la implementación, sí el archive): `specs/app-shell/spec.md`
  todavía tiene los scenarios "Nombre de la sección actual visible en desktop" y "Altura del Topbar
  igual a la placa de marca del Sidebar", que las dec. 13 y 17 contradicen. Los requirements son
  del PO: si esos dos scenarios no se actualizan, el change queda con spec y UI desalineadas y el
  gate de `/opsx:verify` debería marcarlo.
- Confirmar en navegador si el hueco de 56px del `pt-14` existe visualmente hoy (paso 2 del plan).
  Es lo único del diseño que depende de una observación de runtime.
- La toolbar queda como `ReactNode` libre y hoy lleva solo el buscador. Filtros de rol/estado no
  están en ningún requirement de este change; agregarlos después no cambia la plantilla.
- **Cambio visible sin registrar** (hallazgo 12, dec. 23): derivar el menú mobile de `NAV_ITEMS`
  renombró "Dashboard" a "Seguimiento" y cambió el orden de las entradas. Es correcto —el label
  ahora coincide con el que ese mismo usuario ve en el Sidebar— pero no está en `proposal.md`, que
  es del PO.
- **Deuda del token `label-caps`** (dec. 19.2): `docs/design/design.md` fija `fontWeight: '700'`
  para `label-caps`, pero `index.css` define `--text-label-caps` sin el submodificador
  `--text-label-caps--font-weight`, así que la utilidad no lleva peso y los 30 call sites del repo
  quedan con el que herede cada contexto. Arreglarlo en el token es lo correcto de raíz y es un
  cambio visual transversal: fuera de alcance acá, candidato a change propio.
