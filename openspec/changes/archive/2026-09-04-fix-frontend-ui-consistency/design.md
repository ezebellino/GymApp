# Design — fix-frontend-ui-consistency

## Context

Tres inconsistencias visuales del frontend (ver `proposal.md`), sin backend ni contratos de API
involucrados. El estado actual relevante:

**Shell autenticado.** `frontend/src/App.jsx:59` renderiza todas las vistas con sidebar dentro de
`<main className="app-main-shell-bg min-h-screen px-4 pb-6 pt-14 lg:pl-64">`. Ese `<main>` mezcla
dos cosas de naturaleza distinta:

- **offsets estructurales**: `pt-14` compensa el `Topbar` fijo (`h-14`, `Topbar.tsx:80`) y
  `lg:pl-64` compensa el `Sidebar` fijo (`w-64`); sin ellos el contenido queda tapado.
- **gutters de contenido**: `px-4 pb-6`, que es padding de lectura y se suma al que aplica cada
  página.

Encima de eso, cada página trae su propio wrapper y no hay dos iguales:

| Vista | Wrapper raíz actual |
|---|---|
| `Dashboard.tsx:280` | `mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8` (referencia de la spec) |
| `Routines.tsx:634` | `mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8` |
| `NewCoach.tsx:91` | `mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8` |
| `UserRoutine.tsx:172` | `mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8` |
| `Clients.tsx:130`, `Payments.tsx:251`, `Attendance.tsx:103`, `Reports.tsx:238`, `Settings.tsx:243` | `space-y-8` (sin gutter ni `max-w` propios) |

Efecto neto hoy: Dashboard tiene 32px de gutter horizontal en mobile (16 del `<main>` + 16 del
wrapper) y Clientes tiene 16px, con anchos máximos de 7xl / 6xl / 5xl / sin límite según la vista.

**Sidebar.** `Sidebar.tsx:57` lleva `warm-scrollbar` (utilidad de `index.css:201-225`:
`::-webkit-scrollbar` de **10px** con thumb de gradiente ámbar y borde) sobre un `<aside>` con
`overflow-y-auto`; el bloque "Atajos" (`Sidebar.tsx:109-150`) agrega tres botones que ya están en
el nav principal y ~200px de alto, que es justamente lo que hace que el sidebar desborde y muestre
esa barra.

**Login / contraste.** Dos hallazgos que condicionan el diseño:

1. **No hay `color-scheme` declarado en ningún lado** (`grep -rn "color-scheme" src/ index.html`
   no devuelve nada). El documento es dark-only en sus tres temas, pero el navegador asume
   `light`: todos los internals que pinta el UA (highlight de autofill, *preview* de la sugerencia
   del gestor de contraseñas, color de placeholder por defecto, popup de los `<select>` nativos,
   ícono de `input[type=date]`, scrollbars por defecto) usan la paleta clara → texto oscuro sobre
   `bg-zinc-900/70`.
2. **`index.css` no tiene bloque `@theme`**, así que los tokens que asume shadcn no existen como
   utilidades de Tailwind v4: en `components/ui/input.tsx:11`, `placeholder:text-muted-foreground`,
   `border-input`, `dark:bg-input/30` y `focus-visible:ring-ring/50` **no generan CSS**. El input
   no declara color de texto propio (lo hereda de `body { color: var(--foreground) }`,
   `index.css:61`) y su placeholder cae al gris oscuro por defecto del UA en esquema claro.

La regla de `index.css:93-103` ya fuerza `-webkit-text-fill-color` para `:-webkit-autofill`, pero
cubre sólo el estado "autofill aceptado", no el estado *previewed* del gestor de contraseñas que
muestra el screenshot del reporte (campo con foco, dropdown de sugerencias abierto).

## Goals / Non-Goals

**Goals:**

- Un único lugar en el código que defina gutter horizontal, gutter vertical y ancho máximo del
  contenido autenticado, sin suma de paddings anidados.
- Que una vista nueva herede ese layout sin tener que acordarse de nada (la inconsistencia actual
  existe porque hoy hay que acordarse).
- Legibilidad del texto de los inputs del login en los cuatro estados de la spec, atacando la
  causa raíz (esquema de color del documento) y no sólo el síntoma en una vista.
- Sidebar sin "Atajos" y con scroll discreto, sin cambiar el estilo de scroll de componentes que
  nadie reportó.

**Non-Goals:**

- Unificar el ritmo vertical interno (`space-y-6` vs `space-y-8`) de las páginas: la spec unifica
  padding y ancho máximo, no la separación entre secciones. Queda como deuda anotada.
- Agregar el bloque `@theme` que le falta a Tailwind v4 para revivir los tokens de shadcn
  (`--color-foreground`, `--color-input`, `--color-ring`, ...). Es un change propio, con blast
  radius sobre todos los componentes de `ui/`.
- Borrar `components/Layout.tsx` (código muerto con su propio `<main className="p-4">`). El
  proposal lo declara fuera de alcance.
- Tocar los estados de `loading` internos de cada página, backend, API o modelos.

## Decisions

### D1 — El contenedor de contenido vive en el shell, no en cada página

`App.jsx` se queda con los offsets estructurales y agrega **un** contenedor de contenido que
envuelve al `<Suspense>`:

```jsx
<main className="app-main-shell-bg min-h-screen pt-14 lg:pl-64">
  <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <Suspense fallback={<PageLoader />}>…</Suspense>
  </div>
  <Footer />
</main>
```

y las 4 páginas que traen wrapper propio (`Dashboard`, `Routines`, `UserRoutine`, `NewCoach`)
borran `mx-auto max-w-* px-4 py-6 sm:px-6 lg:px-8` y conservan sólo su `space-y-6`. Las 5 páginas
que hoy sólo tienen `space-y-8` **no se tocan**: heredan el gutter y el `max-w` que les falta.

*Alternativas consideradas:*

- **Componente compartido `<PageContainer>` usado por cada página** (9 archivos + un componente
  nuevo). Es el patrón habitual del repo para UI compartida y permite que una vista futura opte
  por full-bleed o por otro `max-w`. Se descarta porque **no elimina la clase de bug**: una vista
  nueva puede olvidarse de importarlo y volvemos exactamente a este change; además hay que
  resolver aparte el gutter de los estados de `loading` (`Routines.tsx:624`, `UserRoutine.tsx:162`,
  `Settings.tsx:235`, `PageLoader` de `App.jsx:26`), que la spec declara sin cambios, y el del
  `Footer`. Con el contenedor en el shell esos cuatro casos quedan resueltos por construcción.
- **Normalizar la clase a mano en los 9 wrappers y quitar `px-4 pb-6` del `<main>`.** Cero
  abstracción nueva, pero deja el string canónico duplicado 9 veces: es la causa de la
  inconsistencia que estamos arreglando.

*Trade-off aceptado:* una página pierde la posibilidad de escapar del contenedor (full-bleed, mapa,
tabla ancha) sin refactorizar el shell. Hoy ninguna lo necesita, y el día que aparezca la salida es
extraer `<PageContainer>` desde este mismo string y volver a la Opción A sólo para esa vista —
migración local, no global.

### D2 — `max-w-7xl` para todas las vistas, incluida "Mi rutina"

El escenario "Ancho máximo de contenido equivalente" pide que el ancho máximo **coincida con el de
Dashboard**, así que el contenedor único usa `max-w-7xl` (1280px). Consecuencia visual explícita:
`Routines` y `NewCoach` pasan de 6xl (1152px) y `UserRoutine` de 5xl (1024px) a 7xl.

*Alternativa considerada:* mantener un `max-w` por vista vía prop. Se descarta porque contradice el
escenario de la spec y reintroduce el eje de variación que el change viene a eliminar.

*Trade-off:* `UserRoutine` (portal cliente, contenido de una sola columna) gana 256px de ancho
máximo, lo que alarga la línea de lectura. Es lo que pide la spec; queda anotado en Risks para que
QA lo mire de frente y, si molesta, sale por un cambio de spec, no por una excepción silenciosa.

### D3 — El gutter efectivo baja 16px respecto de Dashboard actual

Con D1 el gutter horizontal pasa a ser 16 / 24 / 32px (`px-4 sm:px-6 lg:px-8`) en vez de la suma
actual de Dashboard (32 / 40 / 48px), y el gutter inferior pasa de 48px a 24px. Es la lectura
directa del escenario "Sin padding duplicado": *el resultado es equivalente al de Dashboard, y no
la suma de paddings aplicados por distintos contenedores anidados*. La referencia de la spec es la
**clase de página** de Dashboard aplicada una sola vez, no el total de píxeles que hoy se ve.

*Alternativa considerada:* preservar el total actual de Dashboard (`px-8 sm:px-10 lg:px-12` en el
contenedor único) para que Dashboard no cambie ni un píxel. Se descarta: hace la relación con la
clase de referencia imposible de auditar de un vistazo y las 5 vistas sin gutter propio quedarían
con el doble del padding que necesitan. Lo que la spec exige es igualdad entre vistas, no
inmutabilidad de Dashboard.

### D4 — El `Footer` queda fuera del contenedor

`Footer.tsx:33` ya es una barra con `border-t`, fondo propio y su propio `px-6 py-4`. Se deja como
hijo directo del `<main>`, con lo que pasa a ir de borde a borde del área de contenido en vez de
quedar embutida 16px como hoy.

*Alternativa considerada:* meterla dentro del contenedor. Se descarta porque una barra con fondo y
borde superior centrada a 1280px y con gutter parece un card, no un footer.

### D5 — Login: `color-scheme: dark` como causa raíz, más color explícito en el input

Mecanismo en capas, del más barato y más probable al condicional. Dev aplica M1-M4 y **verifica
visualmente en Brave con el gestor de contraseñas activo** (es el navegador del reporte):

- **M1 — `:root { color-scheme: dark; }`** en `@layer base` de `index.css`, junto a las variables
  de tema. Es la causa raíz más probable del screenshot: sin esquema declarado, el estado
  *previewed* del gestor de contraseñas y el highlight de autofill se pintan con la paleta clara
  del UA (texto negro), y ese pintado interno no lo controla `color` de autor. También arregla, de
  paso, el placeholder gris oscuro del escenario "campo con foco antes de tipear".
- **M2 — color de texto explícito en `components/ui/input.tsx`**: agregar `text-zinc-100` a la
  clase base. Hoy el color sólo llega por herencia de `body`, así que cualquier regla del UA o de
  una extensión que setee `color` sobre el `<input>` gana. **No usar `text-foreground`**: sin
  bloque `@theme` esa utilidad no existe en este proyecto (misma razón por la que
  `placeholder:text-muted-foreground` y `border-input` del archivo son hoy no-ops).
- **M3 — placeholder explícito**: reemplazar el no-op `placeholder:text-muted-foreground` por
  `placeholder:text-zinc-400` (≈6.6:1 sobre `zinc-900`, legible sin competir con el valor real).
  Es lo que cubre el escenario "campo con foco antes de tipear" sin depender del default del UA.
- **M4 — regla de `:autofill` en bloque separado** de la de `-webkit-autofill` en `index.css:93`.
  Si se agrega `input:autofill` a la misma lista de selectores, un motor que no lo soporte
  **descarta la regla entera** y se pierde el fix ya existente. Dos bloques con el mismo cuerpo.
- **M5 (condicional, sólo si M1-M4 no alcanzan)**: forzar `-webkit-text-fill-color:
  var(--foreground)` para los inputs también en estado normal/focus, scoped al formulario de login.
  Es la única propiedad que gana sobre el pintado interno de texto de Chromium. Si con esto tampoco
  se resuelve, Dev **para y reporta** en vez de improvisar un tercer mecanismo.

*Alternativa considerada:* tocar sólo `Login.tsx:118` y `:131` con `text-zinc-100`. Es el blast
radius mínimo, pero deja el mismo bug latente en Clients / Payments / Settings / RegisterClient, que
usan el mismo componente. El defecto es del componente y del documento, no de la vista.

### D6 — Se edita `components/ui/input.tsx` (componente de shadcn)

Es código propio del repo (patrón normal de shadcn), y `frontend/AGENTS.md` manda usar
`src/components/ui` antes de crear algo nuevo, así que no se crea un wrapper `<TextField>`.

*Trade-off:* un futuro `shadcn add input --overwrite` revierte el fix. Mitigación: comentario corto
en el archivo explicando por qué el color es explícito y por qué no se usan los tokens.

### D7 — Scrollbar del sidebar: utilidad nueva y scoped, `.warm-scrollbar` intacta

Se le quita `warm-scrollbar` al `<aside>` (`Sidebar.tsx:57`) y se le pone una utilidad nueva
`.subtle-scrollbar` en `index.css`: `scrollbar-width: thin` con `scrollbar-color` de bajo contraste
sobre track transparente, y en WebKit un thumb de ~6px, sin borde y sin gradiente. `overflow-y-auto`
ya garantiza el escenario "el contenido entra completo → no se muestra ninguna barra".

*Alternativas consideradas:*

- **Cambiar `.warm-scrollbar` globalmente.** Un archivo menos, pero arrastra `SpotlightSearch.tsx:137`
  y `:180` y `Reports.tsx:546`, tres superficies que nadie reportó como problema. Se descarta:
  el blast radius se mantiene en la superficie reportada.
- **Ocultar la barra del todo** (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`).
  Cumple la letra de la spec y es la menor cantidad de CSS, pero elimina el affordance de que hay
  más contenido abajo, que es un problema de accesibilidad peor que el estético que arreglamos.

*Nota de orden:* M1 (`color-scheme: dark`) ya vuelve oscura la scrollbar por defecto del UA, así que
`.subtle-scrollbar` es refinamiento sobre una base ya correcta. Conviene aplicar M1 antes y mirar.
Además, quitar "Atajos" reduce ~200px de alto: en la mayoría de los viewports el sidebar deja de
desbordar y la barra no aparece en absoluto.

*Trade-off:* quedan dos estilos de scrollbar en `index.css`. Mitigación: comentario en `.warm-scrollbar`
indicando que la de superficies de chrome/navegación es `.subtle-scrollbar`.

### D8 — "Atajos" se borra, no se esconde

Se elimina el `<section>` completo de `Sidebar.tsx:110-150` y quedan **sin uso** `useNavigate`,
`Button`, `Plus` y `Search`: hay que borrar esos imports o `npm run lint` falla. `Dumbbell` sigue en
uso (`items`). El `<div className="space-y-4 px-4 pb-6">` (`:109`) se mantiene envolviendo sólo el
bloque "Contexto".

*Alternativa considerada:* dejarlo detrás de un flag. No hay infraestructura de flags en el repo y
la spec dice `SHALL NOT mostrar`; un flag sería código muerto nuevo.

### D9 — Un test de render para el Sidebar; el contraste lo verifica QA a ojo

Se agrega `frontend/src/components/__tests__/Sidebar.test.tsx` con los dos escenarios de la spec
(rol Dueño y rol Coach: ausencia de "Atajos" / "Gestionar clientes" / "Ir a rutinas", presencia de
"Contexto"). Es barato, mapea 1:1 con la spec y evita que "Atajos" vuelva. Usa
`renderWithProviders` (el `NavLink` necesita router) y siembra `user_role` en `localStorage` **en su
propio `beforeEach`**, según la regla de `frontend/AGENTS.md`.

*Alternativa considerada:* tests para layout y contraste. Se descartan: jsdom no computa
`color-scheme`, ni herencia de UA, ni contraste real, y aseverar sobre strings de clases de Tailwind
es un test de la implementación, no del comportamiento. Esos dos frentes son verificación visual de
QA.

## Risks / Trade-offs

- **`color-scheme: dark` es global y toca controles nativos que nadie reportó** (7 `<select>` en
  `Pagination.tsx`, `NewPaymentDialog.tsx`, `UserRoutine.tsx`, `Routines.tsx`, `Reports.tsx`; 2
  `input[type=date]` en `Reports.tsx:311,317`) → El cambio va en la dirección correcta (popups e
  íconos oscuros en una app dark-only), pero Dev y QA incluyen Reportes y Rutinas en la pasada
  visual, no sólo el login.
- **El diagnóstico del login no es 100% verificable por inspección de código** (depende del
  navegador y del gestor de contraseñas) → Mecanismo en capas M1-M4 con M5 condicional y un criterio
  de parada explícito (D5). QA verifica en Brave con gestor activo, y también con autocompletado
  nativo.
- **Dashboard, Routines, UserRoutine y NewCoach cambian de aspecto** (16px menos de gutter, 24px
  menos abajo, `max-w` mayor en tres de ellas) → Es consecuencia buscada de los escenarios de la
  spec (D2, D3); QA compara Dashboard contra otra vista en mobile y en ≥1440px, que es lo que la
  spec pide medir.
- **El Footer pasa a ir de borde a borde** → cambio menor y deliberado (D4); si molesta, se resuelve
  con un `px-*` en el propio `Footer.tsx` sin volver a tocar el shell.
- **Los tests existentes renderizan páginas sin el shell** (`Dashboard.test.tsx`,
  `Settings.test.tsx` usan `renderWithProviders` sobre el componente, no sobre `App`), así que al
  mover el gutter al shell esas vistas quedan sin padding en el test → No afecta las aserciones
  (son de texto), pero hay una task explícita de correr `make test-frontend`.
- **Deuda que este change no paga y conviene no perder de vista**: sin bloque `@theme`, todo token
  shadcn (`border-input`, `ring-ring`, `text-muted-foreground`, `dark:bg-input/30`) es un no-op
  silencioso en `src/components/ui/**`. Se documenta en `frontend/AGENTS.md` para que el próximo
  que agregue un componente de shadcn no asuma que funcionan.

## Migration Plan

Sin migración de datos, sin cambio de contrato y sin variables de entorno nuevas: es CSS y JSX.

1. `npm run lint` y `npm run build` dentro de `frontend/` (el build es el que detecta imports
   muertos de `Sidebar.tsx` y clases mal escritas).
2. `make test-frontend`.
3. Verificación visual (Dev primero, QA después) en Brave: login con y sin gestor de contraseñas,
   sidebar con rol Dueño y Coach, y las 8 vistas del shell en mobile y en ≥1440px.

Rollback: revertir el commit. No hay estado persistido ni feature flag que limpiar.

## Open Questions

- ¿Se unifica el ritmo vertical (`space-y-6` vs `space-y-8`) en un change siguiente, o se deja como
  variación aceptada por vista? Fuera de alcance acá (Non-Goals), pero es el próximo eje de
  inconsistencia visible.
- ¿Se borra `components/Layout.tsx` (muerto, con su propio `<main className="p-4">`) en el mismo
  commit de limpieza? El proposal lo excluye; queda para un change de limpieza.
