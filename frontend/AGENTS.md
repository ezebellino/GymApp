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
shadcn/ui (componentes en `src/components/ui`, config en `components.json`) + React Router 7 +
axios + sileo para toasts (`lib/toast.ts`) + `AlertDialog` de shadcn para confirmaciones
(`hooks/useConfirm.tsx`).

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
  clients.ts                # fetchers puros: fetchClients, createClient, updateClient
  clients.queries.ts        # hooks: useClientsQuery, useCreateClientMutation, ...
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
npm run lint            # eslint (dentro de frontend/)
```

`VITE_API_URL` en `.env` apunta al backend (ver `.env.example`).

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
- **Roles**: la UI difiere por rol (Dueño, Coach, portal cliente) — el rol vive en
  `useSessionStore` (`role`, derivado del JWT en `setSession`) y lo lee `ProtectedRoute` en
  `src/components/ProtectedRoute.tsx`; revisar ese guard y las rutas de `App.jsx` antes de agregar
  una vista nueva.
- **Estilos**: Tailwind v4 (config vía `@tailwindcss/vite`, sin `tailwind.config.js` clásico si
  no existe — confirmar antes de asumir). Evitar CSS inline salvo casos puntuales.
- **Layout del shell autenticado**: el contenedor de contenido (gutter horizontal, gutter
  vertical y ancho máximo) vive en un único lugar, `App.jsx` (el `<div className="mx-auto w-full
  max-w-7xl px-4 py-6 sm:px-6 lg:px-8">` que envuelve el `<Suspense>` de las rutas con sidebar).
  Una vista nueva bajo ese shell **no necesita padding propio**: su wrapper raíz va con
  `space-y-*` y nada más. No dupliques `mx-auto max-w-* px-* py-*` en el wrapper de una página.
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
  - Cobertura actual: un test de render por cada vista con spec (`Login`, `RegisterClient`,
    `Dashboard`, `Settings`), más `Sidebar` (accesos ocultos por rol, badge de rol y card de
    identidad — nombre + email del usuario logueado, en reemplazo del bloque "Contexto" viejo).
    `Login.test.tsx` mockea `/auth/me` incluyendo `theme_preference`. Suma de tema (`adopt-
    kinetic-obsidian-theme`): `lib/__tests__/theme.test.ts` (`normalizeThemeMode` — los 3 ids
    legacy, `null`, string vacío y basura resuelven a `"dark"`) y
    `components/__tests__/Topbar.test.tsx` (el click del toggle cambia `data-theme`, persiste en
    `app_theme` y dispara `PATCH /auth/me/theme`, resuelto por ruta con el helper `apiMock`). Hay
    tests de interacción puntuales (el toggle de tema) pero no una suite de interacción general ni
    E2E. `radix-ui` ya no es una dependencia del proyecto: `Switch`, `Slot`, `Dialog` y
    `AlertDialog` (`components/ui/switch.tsx`, `lib/slot.tsx`, `components/ui/dialog.tsx`,
    `components/ui/alert-dialog.tsx`) están reimplementados a mano sin ningún primitivo de Radix
    debajo — `Dialog`/`AlertDialog` sobre el `<dialog>` nativo (ver `lib/use-modal-dialog.ts`:
    showModal/close, Escape vía el evento `cancel`, scroll-lock del body, y un timeout de
    seguridad por si `animationend` no llega a disparar — jsdom no lo simula). Por eso son los
    únicos componentes de `ui/` con test propio (`components/ui/__tests__/switch.test.tsx`,
    `dialog.test.tsx`, `alert-dialog.test.tsx`): a diferencia del resto de `ui/` (que en su
    momento delegaban foco/teclado/ARIA/animación a Radix), acá esa a11y es código de este repo.
    `src/test/setup.ts` polyfillea `HTMLDialogElement.prototype.showModal/close/show` porque
    jsdom solo refleja el atributo `open`, no implementa esos métodos.
