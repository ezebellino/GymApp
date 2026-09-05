# frontend/AGENTS.md

Instrucciones específicas del frontend. Ver también el [AGENTS.md de la raíz](../AGENTS.md) para
convenciones generales, CodeGraph y OpenSpec (aplican también acá).

## Diseño

[docs/design/design.md](../docs/design/design.md) es la **fuente de verdad del tema visual**
("Kinetic Obsidian": dark tactical + light mode "Crisp Slate"). Cualquier trabajo de estilos,
componentes de `src/components/ui/**`, o la skill `frontend-design`/`shadcn` en este repo debe
partir de ese documento antes de inventar colores, tipografía o espaciados nuevos. Reemplaza a
los tres temas actuales de `frontend/src/lib/theme.ts` (`dark-gold`/`dark-copper`/`dark-olive`),
que se eliminan en favor de un toggle simple dark/light.

## Stack

React 19 + Vite 7 + TypeScript (adopción parcial: `.jsx`/`.tsx` conviven) + Tailwind CSS v4 +
shadcn/ui (componentes en `src/components/ui`, config en `components.json`, sin `radix-ui` como
dependencia — ver más abajo) + React Router 7 + axios + sileo para toasts (`lib/toast.ts`). No
hay un `AlertDialog`/confirm-before-delete genérico hoy: `hooks/useConfirm.tsx` y
`components/ui/alert-dialog.tsx` se borraron por no tener caller (quedaron huérfanos cuando se
vació Payments/Routines) — si una vista nueva necesita confirmar una acción destructiva, hay que
reimplementarlo (ver dec. de `Dialog` sobre `<dialog>` nativo, mismo patrón).

## Estructura

```text
src/
  App.jsx           # rutas de la app
  main.jsx          # entrypoint, monta <QueryClientProvider client={queryClient}>
  components/       # componentes compartidos, incluyendo ui/ (shadcn)
  hooks/            # custom hooks (useDebounce, useDashboardData, useLegacyRefetchBridge)
  lib/              # utilidades (cn, formateo, queryClient.ts, theme.ts, etc.)
  pages/            # una carpeta/archivo por vista, mapea a rutas de App.jsx
  services/         # capa de acceso a datos del servidor, dos archivos por dominio (ver abajo)
  stores/           # estado de cliente con Zustand (session.ts, settings.ts, theme.ts)
  types.ts          # tipos compartidos
```

`src/services/` está desdoblado por dominio en **fetchers** + **hooks**, más dos archivos
transversales:

```text
src/services/
  queryKeys.ts             # única factory de claves del repo (ver Convenciones)
  pagination.ts            # PaginatedResult<T> = { items, total } + readTotalCount(headers, fallback)
  users.ts                  # fetchers puros: fetchUsers, createUser, updateUser, cancelMembership,
                             #   activateMembership, inviteUser (perfil unificado owner/coach/member)
  users.queries.ts           # hooks: useUsersQuery, useCreateUserMutation, useUpdateUserMutation,
                             #   useCancelMembershipMutation, useActivateMembershipMutation,
                             #   useInviteUserMutation
  payments.ts                # fetchers puros + selectores derivados (getPaidClientIds, getPendingClients)
  payments.queries.ts
  attendance.ts
  attendance.queries.ts
  settings.ts
  settings.queries.ts
  search.ts
  search.queries.ts
  me.ts                      # fetchers puros: fetchMe, updateMyTheme (PATCH /auth/me/theme)
  me.queries.ts              # hooks: useMeQuery, useUpdateMyThemeMutation, useSyncUserTheme
```

- **`<dominio>.ts`** (fetchers): funciones async puras, reciben un objeto de params tipado, usan
  el **default export** de `@/lib/http` y devuelven datos normalizados (`PaginatedResult<T>` para
  listas, nunca el `AxiosResponse` crudo). Son las únicas que leen `headers`.
- **`<dominio>.queries.ts`** (hooks): envuelven `useQuery`/`useMutation` sobre esos fetchers.

## Comandos

```bash
make setup-frontend   # npm install + copia .env.example -> .env
make frontend         # vite dev
npm run build          # build de producción (dentro de frontend/)
npm run lint            # eslint, JS y TS/TSX vía typescript-eslint (dentro de frontend/)
npm run typecheck        # tsc --noEmit -p tsconfig.json (dentro de frontend/)
make lint-frontend       # eslint + typecheck juntos, desde la raíz
```

`VITE_API_URL` en `.env` apunta al backend (ver `.env.example`). `typescript` es una
`devDependency` real desde `add-verification-gates-to-opsx-flow` (antes no estaba instalado, así
que nada chequeaba los tipos pese a `tsconfig.json` con `strict: true`); `npm run build` (esbuild
vía Vite) sigue sin chequear tipos — ese chequeo lo hace el gate (`make lint-frontend`/
`make lint`), no el build. Los `PersistStorage` a medida de `stores/session.ts`, `settings.ts` y
`theme.ts` quedaron tipados con la porción `Pick<...>` que efectivamente persisten (no el estado
completo con acciones).

## Convenciones

- **UI**: usar componentes de `src/components/ui` (shadcn) antes de crear uno nuevo desde cero.
  Ver la skill `shadcn` en `.agents/skills/` para patrones de composición/estilos/formularios.
- **Datos del servidor (TanStack Query)**: las llamadas a la API van en `src/services/`, nunca
  directo en componentes de página. El patrón, para que la vista que sigue lo copie sin volver a
  discutir estructura:
  - Nombres de hook: `use<Recurso>Query` para lecturas cacheadas, `use<Acción><Recurso>Mutation`
    para escrituras (`useClientsQuery`, `useCreateClientMutation`) — el sufijo hace explícito en
    el call site si es lectura o escritura, y `grep "Query("` lista todas las lecturas de la app.
  - Las **keys** nunca se escriben inline: siempre `queryKeys.<dominio>.<vista>(params)`, desde
    `src/services/queryKeys.ts` (único archivo del repo donde se define un string de key), con
    jerarquía `[dominio, vista, params]` para poder invalidar por prefijo.
  - Las **mutaciones invalidan por prefijo de dominio** (`queryKeys.<dominio>.all`), no por key
    exacta — alcanza a la lista paginada, a los muestreos de otras vistas y a los KPIs con
    cualquier combinación de params. Cuidado con los cruces de dominio: por ejemplo, editar un
    cliente invalida `clients` **+ `payments` + `attendance`**, porque esas dos respuestas
    embeben el cliente en cada fila.
  - Las listas paginadas usan `placeholderData: keepPreviousData` para no parpadear al paginar o
    tipear en el buscador (se mantiene la página anterior mientras llega la nueva). El indicador
    de carga completo es **solo** `isPending` (primera carga sin dato previo); paginar/buscar se
    atenúa con `isFetching && isPlaceholderData`. Errores de carga van con `<DataError
    onRetry={refetch} />` (`src/components/DataError.tsx`) en el área de contenido — no
    `alertError`/SweetAlert, que queda reservado para errores de **mutación**.
  - `src/lib/queryClient.ts` exporta el `QueryClient` **singleton** (se crea ahí, no dentro de
    `main.jsx`, para que sea accesible fuera de React: `logout()` lo limpia con
    `queryClient.clear()`, el puente de eventos legacy lo invalida). Defaults: `staleTime: 30_000`,
    `gcTime: 5 * 60_000`, `refetchOnWindowFocus: true`, `refetchOnReconnect: true`,
    `mutations.retry: false`. El `retry` de queries **no reintenta un 4xx** (sí hasta 2 intentos
    para el resto): con el default de react-query (3 reintentos), un 401 dispararía el
    interceptor de respuesta de `lib/http.ts` — y su `alertError` + redirect a `/login` — hasta
    cuatro veces por query fallida.
  - **Regla dura heredada de los tests**: los fetchers usan el **default export** de `@/lib/http`
    (`import api from "@/lib/http"`), nunca una instancia de axios propia ni un named export.
    `vi.mock("@/lib/http")` mockea `{ default: api }`; cualquier otra forma de acceso rompe el
    aislamiento de red de la suite.
- **Estado de cliente (Zustand)**: `src/stores/session.ts` (token/usuario/rol, fuente única de la
  sesión), `src/stores/settings.ts` (ajustes del negocio) y `src/stores/theme.ts` (modo de tema del
  usuario logueado) son los **tres** stores del repo. Los tres persisten con un `PersistStorage` a
  medida sobre las claves planas de `localStorage` que ya existían (`access_token`/`user_name`/
  `user_role`, `app_settings`, `app_theme`) en vez del wrapper `{state,version}` que usaría
  `createJSONStorage` — **deuda declarada, con fecha de vencimiento**: es un shim de compatibilidad
  (dec. 8 de `design.md` de `adopt-tanstack-query-zustand`) para no desloguear a nadie en el
  deploy y para que los lectores fuera de alcance de `localStorage` (`NewPaymentDialog`,
  `UserCard`, el propio `Settings.tsx`) sigan funcionando sin tocarlos. El siguiente change que
  toque estos stores puede pasar al `persist` default y migrar las claves de una sola vez.
  - **Ajustes: un único escritor.** `useSettingsStore.setSettings(next)` es la única vía para
    escribir el store — la escribe `useSyncSettings()` (montado una vez en `App.jsx`, sincroniza
    lo que devuelve `useSettingsQuery()`) y, tras guardar, `Settings.tsx`/`Payments.tsx`. Ninguna
    vista nueva debe escribir `localStorage["app_settings"]` a mano ni disparar un evento: si
    necesita enterarse de un cambio de ajustes, se suscribe al store (`useSettingsStore(selector)`
    o `useSettingsStore.subscribe`). El evento `"app-settings:updated"` ya no existe.
  - **Tema: store propio, alimentado por la sesión del usuario, no por Ajustes.** El modo
    (`"dark" | "light"`, tipo `ThemeMode` en `lib/theme.ts`) **ya no vive en `settings.ts`**
    (`app_settings.theme_preference` queda legacy y sin uso — es config del negocio, no de cada
    persona): es una preferencia de **cada usuario logueado**, que lo sigue entre dispositivos y
    sesiones. `useThemeStore` (`{ mode, setMode }`) aplica `data-theme`/`color-scheme` en el
    `<html>` y persiste en `app_theme` como caché de pintado local; la fuente autoritativa es la
    columna `theme_preference` de `users` en el backend, servida por `GET /auth/me` y escrita por
    `PATCH /auth/me/theme` (`src/services/me.ts`/`me.queries.ts` — `useMeQuery`,
    `useUpdateMyThemeMutation`, `useSyncUserTheme`, montado una sola vez en `App.jsx`). El toggle
    de modo dark/light vive en `components/Topbar.tsx` (no en Ajustes: es el único componente del
    shell que ven los tres roles — Dueño, Coach y portal cliente), aplica al instante y dispara el
    `PATCH` sin bloquear la UI si falla. Ver `docs/design/design.md` y
    `openspec/changes/adopt-kinetic-obsidian-theme/` para el detalle de decisiones.
  - **Puente temporal `"payments:created"`**: `NewPaymentDialog` y `UserCard` (fuera de alcance de
    la migración a Query) siguen emitiendo ese evento tras cobrar. `useLegacyRefetchBridge()`
    (`src/hooks/useLegacyRefetchBridge.ts`, montado una vez en `App.jsx`) es el **único oyente** en
    todo el repo y lo traduce a `invalidateQueries({ queryKey: queryKeys.payments.all })` — dec. 13
    de ese `design.md`. Se borra entero cuando esos diálogos migren a `useMutation`; no agregues
    un segundo oyente ni un nuevo emisor de este evento.
- **Roles**: `"owner" | "coach" | "member"` (`types.ts::Role`; `member` reemplaza al `"user"` de
  antes de `unify-clients-into-users` — el modelo `Client` se fusionó en `User`). La UI difiere por
  rol (Dueño, Coach, portal miembro) — el rol vive en `useSessionStore` (`role`, derivado del JWT
  en `setSession` vía `normalizeRole()`, que mapea el legacy `"user"` -> `"member"` para sesiones
  abiertas antes del deploy, mismo patrón que `normalizeThemeMode`) y lo lee `ProtectedRoute` en
  `src/components/ProtectedRoute.tsx`; revisar ese guard y las rutas de `App.jsx` antes de agregar
  una vista nueva.
- **Usuarios** (antes "Clientes"): `pages/Users.tsx` (ruta `/users`, con redirect desde `/clients`
  para bookmarks) es el listado único de Dueños/Coaches/Miembros, migrado al patrón "list page"
  (`components/ListPageLayout.tsx`, ver `docs/design/design.md` sección "6. List Page"): encabezado
  compacto de una sola fila (título "Usuarios" + total + ícono de leyenda + acción primaria, sin
  hero ni descripción), barra de filtros y tabla con scroll interno propio, todo dentro de una
  única `Card` Level 1. La leyenda de roles y estados de membresía ya no es una card visible por
  defecto: vive en un popover (`components/ui/popover.tsx`) que abre el ícono `Info` junto al
  título. El círculo de 3 colores + ausente (`components/MembershipDot.tsx`) mapea directo
  `User.membership_indicator` del servidor (`up_to_date`/`overdue`/`suspended`/`none`) — **sin
  lógica propia**: la precedencia (baja > mora) ya la resuelve el backend. El badge de rol usa un
  color fijo por rol (`ROLE_BADGE_CLASS` en `Users.tsx`/`UserDetail.tsx`: violeta=Dueño,
  celeste=Coach, índigo=Miembro), deliberadamente distinto de verde/naranja/rojo del indicador de
  membresía para que "quién es" y "cómo está" no compitan por el mismo lenguaje visual. El botón
  "Crear usuario" del encabezado abre `components/CreateUserDialog.tsx` (alta con perfil mínimo,
  rol restringido a Miembro para un Coach; icon-only debajo de 768px); las acciones por fila (Ver,
  Editar, WhatsApp) son botones de ícono accesibles — "Ver" navega a `pages/UserDetail.tsx`
  (`/users/:id`, fuera de `routePreload.ts` como `NewCoach`: no tiene entrada en el Sidebar), la
  ficha de solo lectura del perfil/membresía/invitación, con su propio botón "Editar".
  `components/EditUserDialog.tsx` es el ABM (perfil, rol si sos owner, membresía con dar de
  baja/reactivar, e invitación si el rol es Miembro) — no hay acción de eliminar, la única baja
  posible es la de membresía; se monta solo mientras está abierto (nunca queda persistente en el
  árbol con `open=false`, ver nota de `Dialog` más abajo).
  `pages/InvitationAccept.tsx` (`/invitacion/:channel/:token`, ruta pública) es donde un Miembro
  invitado verifica sus dos canales y define su contraseña; reemplaza al viejo `/register-client`
  (retirado, ya no hay auto-registro).
- **Estilos**: Tailwind v4 (config vía `@tailwindcss/vite`, sin `tailwind.config.js` clásico si
  no existe — confirmar antes de asumir). Evitar CSS inline salvo casos puntuales.
- **Layout del shell autenticado**: el contenedor de contenido (gutter horizontal y ancho máximo)
  vive en un único lugar, la utilidad `.app-container` (`index.css`, `@layer utilities`), que
  comparten el `<div>` de `App.jsx` que envuelve el `<Suspense>` de las rutas con sidebar y el
  contenedor interno de `Topbar.tsx` — mismos bordes izquierdo/derecho para los dos. El gutter
  vertical (`py-page-y`) va aparte, solo en `App.jsx`: el Topbar centra contra su alto fijo
  (`h-topbar`), no contra ese padding. Una vista nueva bajo ese shell **no necesita padding
  propio**: su wrapper raíz va con `space-y-*` y nada más (o, si es una list page, ver
  `ListPageLayout` arriba). No dupliques `.app-container`/`mx-auto max-w-* px-*` en el wrapper de
  una página.
- **Tokens de shadcn vía `@theme inline`**: `index.css` define las vars semánticas por modo
  (`--canvas`, `--surface-1|2|3`, `--foreground`, `--primary`, …) en `@layer base` y un bloque
  `@theme inline` que las mapea a los nombres que Tailwind v4 y shadcn esperan (`background`,
  `foreground`, `card`, `primary`, `border`, `input`, `ring`, `--radius`, etc.). Las utilidades de
  `src/components/ui/**` (`border-input`, `ring-ring`, `text-muted-foreground`, `dark:bg-input/30`,
  …) **sí generan CSS** y cambian de valor solo con el modo (`data-theme` en `<html>`), sin tocar
  el call site. Usá esos tokens (nunca una clase cruda `zinc-*`/`amber-*`) al tocar un componente de
  `ui/`; el `@custom-variant dark (...)` de `index.css` hace que `dark:*` siga significando "modo
  dark" atado a `data-theme`, no a la clase `.dark`.
- **Tipado**: el proyecto está en transición a TypeScript. Los archivos nuevos de lógica no
  trivial preferí `.tsx`/`.ts`; páginas simples pueden seguir en `.jsx` si el resto del módulo lo
  está.
- **Tests**: Vitest + Testing Library sobre jsdom. Se corre con `make test-frontend` desde la
  raíz o `npm run test` acá (`npm run test:watch` para iterar). Los tests viven junto al código
  que prueban, en `src/**/__tests__/*.test.tsx`; los helpers en `src/test/`.
  - Config en `frontend/vitest.config.js`, que **combina `vite.config.js` con `mergeConfig`**: si
    existe un `vitest.config.*`, Vitest ignora el `vite.config.*` por completo, y sin el merge se
    pierden el alias `@ -> ./src` y el plugin de React. No metas la clave `test` en
    `vite.config.js`: esa es la config de build de producción.
  - `globals: false`: los tests importan explícitamente de `vitest`
    (`import { describe, it, expect, vi } from "vitest"`).
  - `src/test/setup.ts` registra los matchers de jest-dom, polyfillea `matchMedia` y
    `ResizeObserver` (jsdom no los trae y los necesita vaul) y
    `HTMLDialogElement.prototype.showModal/close/show` (ídem para `Dialog`/`AlertDialog`, ver más
    abajo). En `afterEach` hace
    `cleanup()` + `localStorage.clear()` **y resetea los tres stores de Zustand** (`session`,
    `settings`, `theme`) a su estado inicial; en `beforeEach` llama a
    `useSessionStore.persist.rehydrate()` / `useSettingsStore.persist.rehydrate()` /
    `useThemeStore.persist.rehydrate()`. Esto último no es opcional: `persist` rehidrata una sola
    vez, al importar el módulo, así que un test que siembra `localStorage` (p. ej.
    `Dashboard.test.tsx` con `user_role`/`user_name`) necesita esa rehidratación explícita para que
    la siembra le llegue al store. `renderWithProviders` **vuelve a rehidratar** justo antes de
    renderizar, porque los `setupFiles` corren antes que el `beforeEach` propio de cada archivo de
    test: si la siembra vive en ese `beforeEach` del test (el caso común), el `beforeEach` de
    `setup.ts` ya pasó y esa siembra todavía no estaba. **Sembrá `localStorage` en tu propio
    `beforeEach`, nunca dentro del `it` después de haber renderizado** — a esa altura ya se
    rehidrató y el componente ya leyó su selector; escribir `localStorage` más tarde no lo
    actualiza.
  - **Aislamiento de red**: los tests mockean el módulo entero con `vi.mock("@/lib/http")` usando
    el helper `src/test/apiMock.ts`, que resuelve por ruta. No uses `vi.spyOn(api, "get")`:
    cualquier llamada no prevista se iría a XHR real de jsdom y dispararía los interceptores de
    `lib/http` (el 401 redirige a `/login` y dispara un toast). Las suites corren sin backend.
  - `src/test/renderWithProviders.tsx` envuelve en `MemoryRouter > QueryClientProvider` y
    reexporta las utilidades de RTL. Crea un `QueryClient` **nuevo en cada llamada** (nunca
    reusa el singleton de `lib/queryClient.ts`: compartir caché entre tests haría que uno viera
    datos de otro) con `retry: false`, `gcTime: Infinity`, `staleTime: Infinity` y
    `refetchOnWindowFocus: false` — sin esto un fetcher que rechaza reintenta con backoff y el
    test se cuelga hasta el timeout, y jsdom puede disparar refetches después del `cleanup()`.
    Acepta un `queryClient` propio por parámetro para tests que lo necesiten.
  - Cobertura actual: un test de render por cada vista con spec (`Login`, `Dashboard`, `Settings`),
    más `Users.tsx` (columnas de la spec y los 4 estados del círculo — verde/naranja/rojo/ausente,
    afirmando sobre el texto accesible del indicador, no la clase de color; también que "Crear
    usuario" abre `CreateUserDialog` y que "Ver" navega a la ficha — este segundo con un `<Routes>`
    propio en el test, no la ruta real de `App.jsx`) e `InvitationAccept.tsx` (formulario de
    contraseña deshabilitado con un solo canal verificado, habilitado con los dos), más
    `UserDetail.tsx` (perfil/membresía/invitación de la ficha, y que la sección de invitación no
    aparece para un rol que no es Miembro) y `Sidebar` (accesos ocultos por rol, badge de rol, card
    de identidad, y el rename de nav "Clientes" -> "Usuarios"). `RegisterClient` ya no tiene test de
    render: la vista se retiró junto con `/auth/client-register` (ver `unify-clients-into-users`),
    reemplazada por `InvitationAccept`. `Login.test.tsx` mockea `/auth/me` incluyendo
    `theme_preference` y ya no asume un link "Registrar cuenta" (retirado de `login-view`). Suma de
    tema (`adopt-
    kinetic-obsidian-theme`): `lib/__tests__/theme.test.ts` (`normalizeThemeMode` — los 3 ids
    legacy, `null`, string vacío y basura resuelven a `"dark"`) y
    `components/__tests__/Topbar.test.tsx` (el click del toggle cambia `data-theme`, persiste en
    `app_theme` y dispara `PATCH /auth/me/theme`, resuelto por ruta con el helper `apiMock`). Suma
    de `redesign-list-page-layout`: `components/__tests__/ListPageLayout.test.tsx` (los slots se
    renderizan en el orden esperado, la raíz es una Card, `title` sale como `h1`), `components/ui/
    __tests__/popover.test.tsx` (cerrado no renderiza contenido, click abre y pone
    `aria-expanded="true"`, el trigger es un `<button>` nativo, Escape cierra y devuelve el foco,
    click afuera cierra), `lib/__tests__/navigation.test.ts` (drift entre `NAV_ITEMS` y
    `routeImporters`), `services/__tests__/pagination.test.ts` (`getPageRange` con `total=0`,
    última página parcial y `offset` fuera de rango) y `lib/__tests__/utils.test.ts` (`cn` conserva
    los nueve tamaños custom de `index.css` frente a un color en conflicto — drift test contra los
    `--text-*` que declara ese archivo). `components/ui/popover.tsx` (`Popover`,
    `PopoverTrigger`, `PopoverContent`) es un componente nuevo de `ui/`, sin Radix ni portal, mismo
    patrón controlado que `Dialog` — ver el comentario de cabecera del archivo para la limitación
    de clipping dentro de contenedores con `overflow`. Hay tests de interacción puntuales (el
    toggle de tema) pero no una suite de interacción general ni
    E2E. `radix-ui` ya no es una dependencia del proyecto: `Switch`, `Slot` y `Dialog`
    (`components/ui/switch.tsx`, `lib/slot.tsx`, `components/ui/dialog.tsx`) están reimplementados
    a mano sin ningún primitivo de Radix debajo — `Dialog` sobre el `<dialog>` nativo (ver
    `lib/use-modal-dialog.ts`: showModal/close, Escape vía el evento `cancel`, scroll-lock del
    body, y un timeout de seguridad por si `animationend` no llega a disparar — jsdom no lo
    simula). `AlertDialog` (`components/ui/alert-dialog.tsx`) tuvo el mismo tratamiento pero se
    borró junto con `hooks/useConfirm.tsx`, su único caller, al quedar huérfano (ver Stack). Por
    eso `Switch`/`Dialog` son los únicos componentes de `ui/` con test propio
    (`components/ui/__tests__/switch.test.tsx`, `dialog.test.tsx`): a diferencia del resto de
    `ui/` (que en su momento delegaban foco/teclado/ARIA/animación a Radix), acá esa a11y es código
    de este repo. `src/test/setup.ts` polyfillea `HTMLDialogElement.prototype.showModal/close/show`
    porque jsdom solo refleja el atributo `open`, no implementa esos métodos.
    **Trampa de `DialogContent` con clases de Tailwind sobre `<dialog>` nativo**: cualquier clase
    de autor que fije `display` o `margin` en el propio `<dialog>` gana SIEMPRE sobre la hoja de
    estilos del user-agent (`dialog:not([open]){display:none}` y `dialog:modal{margin:auto}`), sin
    importar especificidad — el origen "author" le gana a "UA". Por eso `DialogContent` nunca deja
    esas dos propiedades a un default implícito: `display` alterna explícito entre `"grid"`
    (abierto/cerrando) y `"hidden"` (cerrado), y la posición va con `fixed inset-0 m-auto`
    explícitos en vez de confiar en el centrado nativo. Sin esto, un diálogo montado una vez con
    `open=false` (el patrón normal en este repo: `<Dialog open={state}>` en vez de
    trigger/portal descontrolado) queda visible y focuseable en la esquina superior izquierda
    aunque nunca se llamó a `showModal()` — un bug real que solo aparece en un navegador de verdad
    (jsdom no implementa esa hoja de estilos del UA, así que la suite no lo detecta) y que
    `dialog.test.tsx` cubre con un caso montado-cerrado que afirma sobre las clases, no sobre
    estilos computados.
