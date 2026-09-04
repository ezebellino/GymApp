## Context

El `proposal.md` fija el QUÉ: TanStack Query como mecanismo único de lectura de datos del
servidor, Zustand para sesión y ajustes, migración de **cuatro vistas** (Clientes, Dashboard,
Pagos, Asistencia) y baja de `AuthContext` y del evento `"app-settings:updated"`. Este documento
resuelve el CÓMO y deja cerradas las decisiones que, si se toman durante la implementación, van a
salir distintas en cada archivo.

El comportamiento observable lo fijan las specs del change (`specs/server-data-cache/`,
`specs/session-state/`, `specs/app-settings-state/`, `specs/login-view/`). Donde una spec obliga a
una decisión técnica concreta —el mismo tratamiento de carga y error en las cuatro vistas, el
fallo parcial del Dashboard, el tema sin destello en el primer render, no reusar un token de una
sesión cerrada— se cita explícitamente en la decisión correspondiente.

Estado real del repo verificado para diseñar (no asunciones):

**Capa HTTP**
- `src/lib/http.ts` es el **único** seam HTTP: un singleton axios exportado por default que
  importan los 16 archivos que hablan con la API. El request interceptor agrega barra final a
  `/clients`, `/attendance` y `/payments`, y lee `localStorage.getItem("access_token")`. El
  response interceptor, ante un 401, hace `alertError` (SweetAlert), borra el token y
  `window.location.href = "/login"`.
- El total de las listas viene en la cabecera `X-Total-Count`. Hoy se lee en **cuatro** lugares
  con el mismo fallback case-insensitive copiado a mano: `services/clients.ts`, `Attendance.tsx`,
  `Payments.tsx` y dos veces en `Dashboard.tsx`.

**Sesión**
- `src/auth/AuthContext.tsx` **es código muerto**: `AuthProvider` no se monta en ningún lado
  (`main.jsx` solo tiene `BrowserRouter`), y su único consumidor, `src/auth/ProtectedRoute.tsx`,
  tampoco se importa nunca. El `ProtectedRoute` real es `src/components/ProtectedRoute.tsx`, que
  lee `localStorage` en el render y decodifica el JWT con `jwt-decode`.
- Consecuencia importante: **el auto-logout por `exp` que hoy existe en el código nunca se
  ejecuta**. Lo único que corta una sesión vencida es el chequeo de `exp` en el render de
  `ProtectedRoute` (solo al navegar) y el 401 del interceptor.
- Quien escribe la sesión es `Login.tsx` (`access_token`, `user_name`, `user_role`) y
  `RegisterClient.tsx`. Quien la lee suelta: `App.jsx` (en el render, para el redirect de `/`),
  `Sidebar`, `Topbar` (además reconstruye el rol desde el JWT con `atob` y lo reescribe),
  `Footer`, `Dashboard`, `Routines`, `Settings`, `ProtectedRoute` y `http.ts`.

**Ajustes y tema**
- El evento `"app-settings:updated"` lo emiten `Settings.tsx` (x2) y `Payments.tsx` (x2), y lo
  escuchan `App.jsx`, `Dashboard.tsx` y `Footer.tsx`.
- La clave `localStorage["app_settings"]` guarda el objeto `AppSettings` **plano** y la leen
  directo `Footer`, `Dashboard`, `Payments`, `Settings`, `NewPaymentDialog`, `UserCard` y
  `lib/theme.ts::syncThemeFromSettings`. Los dos últimos están fuera de alcance.
- `lib/theme.ts` aplica el tema a `document.documentElement.dataset.theme`, lo espeja en
  `localStorage["app_theme"]` y emite `"app-theme:updated"`, evento que **nadie escucha**.
- `GET /settings` se pide hoy en cinco lugares distintos (`Settings`, `Dashboard`, `Payments`,
  `NewPaymentDialog`, `UserCard`), cada uno con su propio fallback a `localStorage`.

**Las cuatro vistas a migrar**
- `Clients.tsx`: `fetchClients({q, limit, offset})` con `useDebounce(q, 400)`; un `useEffect` que
  resetea `offset` cuando cambian `q`/`limit` y otro que carga con guarda `mounted`. El
  `onSuccess` de `EditClientDialog` repite la llamada a mano.
- `Attendance.tsx`: `GET /attendance` con `q/limit/offset`, `useDebounce(q, 350)`, y ante error de
  carga abre un **modal de SweetAlert**. No tiene mutaciones.
- `Payments.tsx`: `loadWith()` combina `GET /payments` (con `q` o `client_id` según la URL) y
  `loadReminderTargets()`, que a su vez pide `/clients?limit=200` + `/payments?limit=200` para
  derivar los clientes con cuota pendiente. Muta `DELETE /payments/:id` y `PATCH /settings`
  (timestamp de recordatorios).
- `Dashboard.tsx` (1065 líneas): 30 `useState`, `loadDashboard()` con `Promise.allSettled` de 4
  endpoints (`/clients`, `/payments`, `/payments/reports/kpis`, `/attendance` de hoy) y fallback
  de facturación si fallan los KPIs; dos búsquedas debounceadas a mano; mutaciones `POST
  /attendance/checkin`, `POST /payments`, `POST /clients`, todas seguidas de `await
  loadDashboard()`. Escucha el evento `"payments:created"` que emiten `NewPaymentDialog` y
  `UserCard` (ambos fuera de alcance).
- `src/components/CheckinDialog.tsx` **no lo importa nadie**: es código muerto.

**Tests (restricción dura)**
- Vitest + Testing Library sobre jsdom, `globals: false`, config en `vitest.config.js` mergeada
  con `vite.config.js`. Cuatro tests de render: `Login`, `RegisterClient`, `Dashboard`,
  `Settings`, que **no se reescriben**.
- Todos mockean el módulo entero con `vi.mock("@/lib/http")` + `src/test/apiMock.ts`, que resuelve
  el payload por ruta y siempre devuelve `headers: {"x-total-count": "0"}`.
- `Dashboard.test.tsx` siembra `localStorage["user_role"]`/`["user_name"]` en un `beforeEach`;
  `setup.ts` hace `localStorage.clear()` en `afterEach`.
- `renderWithProviders.tsx` hoy envuelve solo en `MemoryRouter` y su comentario dice
  explícitamente que react-query "no está instalado": ese comentario queda obsoleto con este
  change.

## Goals / Non-Goals

**Goals:**
- Dejar **un solo patrón** de lectura de datos (query keys + hooks en `src/services/`) y de
  escritura (mutación + invalidación por prefijo de dominio), lo bastante explícito como para que
  el change siguiente migre el resto de las vistas sin volver a discutir estructura.
- Una única fuente de verdad de sesión y de ajustes, disponible **sincrónicamente en el primer
  render** (sin flash de rol incorrecto) y también fuera de React (interceptores de axios, tema).
- Convivencia con lo que queda fuera de alcance: los componentes y vistas no migrados tienen que
  seguir funcionando sin tocarlos, incluidos los que leen `localStorage["app_settings"]` a mano.
- `make test-frontend` en verde **sin editar los cuatro archivos de test**; los helpers de
  `src/test/` sí se tocan.
- Cero cambios de backend, de contratos y de contenido visible más allá de carga y error.

**Non-Goals:**
- Migrar `Routines`, `Reports`, `Settings`, `UserRoutine`, `NewCoach`, `RegisterClient`, `Login`
  ni los diálogos con fetch propio a `useQuery`/`useMutation` (change posterior).
- Convertir `Login`/`RegisterClient` en mutaciones: solo pasan a escribir la sesión por el store.
- Instalar React Query Devtools, un persister de caché (`persistQueryClient`), Immer o el router
  loader de React Router. Cada uno es una dependencia y una decisión que este change no necesita.
- Agregar tests nuevos, tipar el proyecto entero o mover a `src/services/` las llamadas de las
  vistas fuera de alcance.
- Refactorizar el layout, los estilos o la lógica de negocio de las vistas migradas.

## Decisions

### 1. Dependencias: `@tanstack/react-query` v5 y `zustand` v5

`@tanstack/react-query@^5` (~13 kB gzip) y `zustand@^5` (~1 kB gzip) como `dependencies` de
`frontend/package.json`. Ambas son las versiones vigentes y compatibles con React 19; v5 es la que
trae `gcTime`, `isPending` y `placeholderData: keepPreviousData` (la API que usa este diseño).

Costo de mantenerlas: dos librerías más en el radar de upgrades, y un salto de major de
react-query implica revisar los defaults del cliente y la firma de los hooks. Se acepta porque
reemplazan ~16 implementaciones caseras del mismo trío `useState`/`useEffect`/`axios` y el store
de sesión, que es donde hoy están los bugs.

*Alternativa considerada*: SWR (más chico, sin mutaciones/invalidación de primera clase) y
Context + `useReducer` a mano (cero dependencias, pero es reescribir react-query peor). Se
descartan: el problema del proposal es justamente caché compartida + invalidación, que es el
núcleo de react-query.

### 2. `src/lib/queryClient.ts`: un singleton exportado, no creado dentro de `main.jsx`

El `QueryClient` se crea en `src/lib/queryClient.ts` y se exporta. `main.jsx` solo lo importa y
lo pasa a `<QueryClientProvider client={queryClient}>`, adentro de `<BrowserRouter>` y del
`StrictMode` que ya existen.

Motivo: la caché tiene que ser accesible **fuera de React** (el `logout()` del store la limpia, el
puente de eventos legacy la invalida). Si el cliente se instancia dentro del componente raíz, esa
puerta no existe y aparecen soluciones peores (context leaks, singletons implícitos).

Defaults, y el porqué de cada uno para esta app (gimnasio chico, uno o dos operadores
simultáneos, datos que cambian por acción humana):

| Opción | Valor | Razón |
|---|---|---|
| `staleTime` | `30_000` | Volver de Pagos a Dashboard pinta al instante desde caché (el síntoma nº1 del proposal) sin quedarse viejo: 30 s es menos que el tiempo humano entre dos operaciones de mostrador. |
| `gcTime` | `5 * 60_000` | La caché sobrevive a navegar entre vistas y volver, pero no acumula memoria en un tablet que queda abierto todo el día. |
| `retry` | función: `false` si `4xx`, si no hasta 2 intentos | **Crítico**: con el default (3 reintentos) un 401 dispararía el interceptor —y su SweetAlert + redirect— cuatro veces por query. Un `4xx` no mejora reintentando; un `5xx` o una caída de red sí. |
| `refetchOnWindowFocus` | `true` | Es el mecanismo que resuelve "datos viejos" cuando otro dispositivo cobró o registró un check-in. Con `staleTime: 30_000` no genera tormenta de requests. |
| `refetchOnReconnect` | `true` | El `Footer` ya muestra estado offline: al volver la conexión los datos se refrescan solos. |
| `mutations.retry` | `false` | Reintentar un `POST /payments` puede duplicar un cobro. Nunca automático. |

*Alternativa considerada*: `staleTime: 0` (comportamiento más parecido al actual, pero refetchea
en cada montaje y no arregla las pantallas en blanco) y `staleTime: 5 min` (menos requests, pero
reintroduce el problema de datos viejos que motiva el change). 30 s es el punto medio explícito.

### 3. Estructura de la capa de datos: todo bajo `src/services/`, dos archivos por dominio

`frontend/AGENTS.md` ya manda que las llamadas a la API vivan en `src/services/`. Se respeta y se
extiende, sin carpetas nuevas de primer nivel:

```text
src/services/
  queryKeys.ts          # factory central de claves (único lugar donde se escribe un string de key)
  pagination.ts         # readTotalCount(headers) + type PaginatedResult<T> = { items, total }
  clients.ts            # fetchers puros: fetchClients, createClient, updateClient   (ya existe)
  clients.queries.ts    # hooks: useClientsQuery, useCreateClientMutation, ...
  payments.ts           # fetchers puros + selectores derivados puros
  payments.queries.ts
  attendance.ts
  attendance.queries.ts
  settings.ts
  settings.queries.ts
  search.ts             # ya existe; gana search.queries.ts
```

Reglas de la convención (esto es lo que copia el change siguiente):

1. **Fetchers** (`<dominio>.ts`): funciones async puras que reciben un objeto de params tipado,
   usan el default export de `@/lib/http` y devuelven datos ya normalizados. Las listas devuelven
   `PaginatedResult<T>`, nunca el `AxiosResponse`. Son las únicas que tocan `headers`.
2. **Hooks** (`<dominio>.queries.ts`): envuelven `useQuery`/`useMutation`. Nombre
   `use<Recurso>Query` / `use<Acción><Recurso>Mutation` — el sufijo hace explícito en el call site
   si es lectura cacheada o escritura, y `grep "Query("` lista todas las lecturas de la app.
3. **Keys**: nunca inline. Siempre `queryKeys.<dominio>.<vista>(params)`, con jerarquía
   `[dominio, vista, params]` para poder invalidar por prefijo:

```ts
export const queryKeys = {
  clients: {
    all: ["clients"] as const,
    list: (p: ClientsParams) => ["clients", "list", p] as const,
    search: (q: string)      => ["clients", "search", q] as const,
  },
  payments: {
    all:  ["payments"] as const,
    list: (p: PaymentsParams) => ["payments", "list", p] as const,
    kpis: (p: PeriodRange)    => ["payments", "kpis", p] as const,
  },
  attendance: {
    all:   ["attendance"] as const,
    list:  (p: AttendanceParams) => ["attendance", "list", p] as const,
    count: (p: PeriodRange)      => ["attendance", "count", p] as const,
  },
  settings: { all: ["settings"] as const },
};
```

*Regla dura heredada de los tests*: los fetchers **tienen que seguir importando el default export
de `@/lib/http`**. Nada de crear otra instancia de axios ni de exportar named helpers desde
`http.ts`: `vi.mock("@/lib/http")` devuelve `{ default: api }` y cualquier otra forma de acceso
rompe el aislamiento de red de la suite.

*Alternativas consideradas*: (a) carpeta `src/queries/` separada de `src/services/` — dos lugares
para mirar por dominio y contradice el AGENTS.md; (b) todo en un solo archivo por dominio —
mezcla código React con funciones puras y complica reutilizar un fetcher desde un
`prefetchQuery` o un test; (c) keys inline en cada `useQuery` — es exactamente cómo se
desincronizan las invalidaciones.

### 4. Listas paginadas: `placeholderData: keepPreviousData` y el total dentro de `data`

Las tres listas paginadas (Clientes, Pagos, Asistencia) usan:

```ts
useQuery({
  queryKey: queryKeys.clients.list({ q: debouncedQ, limit, offset }),
  queryFn: () => fetchClients({ q: debouncedQ, limit, offset }),
  placeholderData: keepPreviousData,
});
```

- `keepPreviousData` evita que la tabla parpadee al paginar o al tipear en el buscador: se
  mantiene la página anterior mientras llega la nueva. El indicador de "cargando" pasa a ser
  `isFetching && isPlaceholderData` (atenuar la tabla), y el estado de carga completo queda
  **solo** para `isPending` (primera carga sin dato previo, ver decisión 5).
- `X-Total-Count` viaja **dentro del `data` de la query** (`{ items, total }`), no en un `useState`
  aparte: si estuviera afuera, el total quedaría desincronizado con los items al usar
  `placeholderData`. `readTotalCount(headers)` centraliza el fallback case-insensitive que hoy
  está copiado en cuatro lugares.
- `useDebounce` **se conserva** tal cual y se aplica antes de armar la key: es lo que evita una
  entrada de caché por tecla. El `useEffect` que resetea `offset` al cambiar `q`/`limit` también
  se conserva (es estado de UI, no de servidor).

*Alternativa considerada*: `useInfiniteQuery`. Se descarta: las tres vistas usan el componente
`Pagination` con páginas numeradas, no scroll infinito.

### 5. Estados de carga y error: un componente de error compartido; la carga se queda como está

La spec `server-data-cache` pide indicador de carga "equivalente en las cuatro vistas", error
visible, en español, recuperable sin recargar, y que **un fallo parcial no rompa la vista
entera**. Hoy cada vista inventa el suyo (`Clients` tiene `SkeletonRow`, `Attendance` abre un
modal de SweetAlert, `Payments` y `Dashboard` tienen su propio texto).

**Decisión del usuario (opción conservadora)**: no se crea un `<DataLoading />` ni se unifica la
presentación de carga en este change. Cada vista conserva su indicador actual —`Clients` sigue con
su `SkeletonRow`— y lo que se unifica es el **criterio** de cuándo mostrarlo: `isPending` para la
primera carga sin dato previo, atenuación con `isFetching && isPlaceholderData` para refetch y
paginado, y **ninguna vista queda con área en blanco sin indicación**. El requisito de la spec se
cumple en el comportamiento observable (siempre hay indicador, nunca hay blanco), no en un
componente único de presentación.

Sí se agrega **un solo componente** en `src/components/`:

- `<DataError onRetry={refetch} title description />`: bloque en el área de contenido con mensaje
  en español y botón "Reintentar" cableado al `refetch` de la query. **Los textos se reusan de lo
  que cada vista ya muestra hoy** (p. ej. `Attendance`: "No se pudieron cargar las asistencias" /
  "Intenta nuevamente en unos segundos."); donde una vista hoy no tiene texto de error, se usa el
  mismo tono de esos strings. Reemplaza el `alertError` de SweetAlert en la **carga** de
  `Attendance`. SweetAlert se conserva para los errores de **mutación**, que sí son la respuesta
  modal a una acción explícita del usuario (comportamiento actual; la spec no pide cambiarlo).

Granularidad: en Clientes, Pagos y Asistencia el estado cubre el área de contenido (una sola
query dominante). En Dashboard es **por bloque**: cada sección (KPIs, últimos pagos, pendientes de
cobro) mira el estado de la query que la alimenta, que es lo que satisface el escenario "fallo
parcial no rompe la vista completa" — hoy imposible, porque un único `loadDashboard()` con
`throw` deja la vista entera sin datos.

La recuperación "sin recargar la página" sale de dos lados: el botón de reintento y el hecho de
que react-query refetchea automáticamente una query en error al volver a montarla (volver a
entrar a la vista) y al recuperar el foco de la ventana.

*Alternativa considerada*: `throwOnError` + un `ErrorBoundary` por vista. Es más elegante para
errores globales, pero rompe el requisito de fallo parcial (el boundary tumba el subárbol entero)
y arrastra `<Suspense>` a vistas que hoy no lo usan.

### 6. Invalidación: por prefijo de dominio, en el `onSuccess` de la mutación

Cada mutación invalida el **prefijo del dominio**, no la key exacta. Con `queryKeys.payments.all
= ["payments"]`, `invalidateQueries({ queryKey: queryKeys.payments.all })` alcanza a la lista
paginada de Pagos, al muestreo del Dashboard y a los KPIs, con cualquier combinación de params.

| Mutación | Origen | Invalida |
|---|---|---|
| `POST /clients` | Dashboard (alta rápida) | `clients.all` |
| `PATCH /clients/:id` | `EditClientDialog` vía `onSuccess` en Clientes | `clients.all` + `payments.all` + `attendance.all` |
| `POST /payments` | Dashboard (cobro rápido) | `payments.all` |
| `DELETE /payments/:id` | Pagos | `payments.all` |
| `POST /attendance/checkin` | Dashboard | `attendance.all` |
| `payments:created` (evento legacy) | `NewPaymentDialog`, `UserCard` | `payments.all` |

Dos asimetrías de la tabla, ambas deliberadas y verificadas contra el código:

- **Editar un cliente invalida tres dominios.** Las respuestas de `/payments` y `/attendance`
  **embeben** el cliente (`Payment.client`, `AttendanceRow.client`), así que un cambio de nombre
  deja esas cachés mintiendo. Es literalmente el escenario "Editar un cliente" de la spec ("las
  demás vistas que nombran a ese cliente muestran el nombre nuevo"). Crear un cliente **no**
  necesita esa invalidación: todavía no está embebido en ninguna fila.
- **Cobrar un pago no invalida `clients`.** La lista de "clientes sin pago del mes" se **deriva**
  de las dos cachés (`clients` + `payments`) con una función pura, así que al refrescarse
  `payments` la derivación se recalcula sola. Ese es justamente el motivo de derivar en vez de
  guardar en estado.

*Alternativa considerada*: actualización optimista (`setQueryData`) para el check-in y el cobro
rápido. Se descarta en este change: agrega rollback y estados intermedios en las dos vistas más
grandes, y el proposal solo pide que la UI se actualice sin recarga. Queda como mejora posterior
sobre este mismo patrón.

### 7. Descomposición del Dashboard: cuatro queries independientes + un hook de vista

`Dashboard.tsx` es el archivo más pesado y el de mayor riesgo. Se descompone en tres capas, **sin
tocar el JSX**:

1. Los cuatro `api.get` del `Promise.allSettled` pasan a ser cuatro `useQuery` independientes con
   los hooks compartidos: `useClientsQuery({limit: CLIENTS_SAMPLE_LIMIT})`,
   `usePaymentsQuery({limit: 200})`, `usePaymentsKpisQuery({start, end})` y
   `useAttendanceCountQuery({start, end})` (hoy de hoy).
2. Un hook de vista `src/hooks/useDashboardData.ts` compone esas cuatro queries y devuelve los
   derivados que hoy viven en 8 `useState`: `activeClients`, `clientsTotal`, `checkinsToday`,
   `revenueMonth` (con el mismo fallback: `kpis.data?.amount_sum ?? revenueFromPayments`),
   `pendingClients`, `clientsWithoutPayment`, `lastPayments` y un `isPending`/`isError`
   agregados. `src/hooks/` ya existe (`useDebounce`), así que no se inventa una convención nueva.
3. `Dashboard.tsx` queda con el JSX, el estado **de UI** (diálogos abiertos, campos de formulario,
   `searchOpen`) y las tres mutaciones. Los ~14 `useState` de datos derivados desaparecen.

Beneficio no obvio: `Promise.allSettled` con `throw` selectivo desaparece. La tolerancia a fallos
parciales que hoy está escrita a mano (si fallan los KPIs uso el fallback; si falla asistencia
vuelvo a pedirla con `refreshCheckinsToday`) es el comportamiento nativo de cuatro queries
independientes, y `refreshCheckinsToday()` se borra.

Las dos búsquedas debounceadas (check-in rápido y cobro rápido) pasan a
`useClientsSearchQuery(term, { enabled: term.length > 0 })` reutilizando `searchClients` como
fetcher; comparten caché entre sí cuando el término coincide.

*Alternativa considerada*: partir `Dashboard.tsx` en subcomponentes por sección (KPIs, pendientes,
últimos pagos). Se descarta en este change: es un rediseño de la vista, está fuera de alcance del
proposal y multiplica el diff justo donde más riesgo hay. El hook de vista da el 80% del
beneficio con un diff mecánico y revisable.

### 8. Stores de Zustand en `src/stores/`, persistidos sobre las claves de `localStorage` que ya existen

Dos stores, en `src/stores/session.ts` y `src/stores/settings.ts` (carpeta nueva, hermana de
`hooks/` y `lib/`; `src/auth/` desaparece — ver decisión 11).

```ts
// stores/session.ts  (forma, no implementación)
type SessionState = {
  token: string | null;
  userName: string | null;
  role: Role | null;           // "owner" | "coach" | "user"
  exp: number | null;          // derivado del JWT, NO se persiste aparte
  setSession: (token: string, over?: { name?: string; role?: Role }) => void;
  logout: () => void;
};
```

`setSession` decodifica el JWT con `jwt-decode` (ya es dependencia) y deriva `role`/`userName`/
`exp`, permitiendo override con lo que devuelve `GET /auth/me` (es lo que hace hoy `Login.tsx`).

**Qué se persiste y con qué claves** — la decisión central: ambos stores usan `persist` con un
`PersistStorage` **a medida** que mapea el estado a las claves planas que ya existen, en vez del
`createJSONStorage` default (que escribiría `{"state":{...},"version":0}` bajo una clave nueva):

- `session` → `access_token`, `user_name`, `user_role` (tres claves, como hoy).
- `settings` → `app_settings`, con el objeto `AppSettings` plano, como hoy.

Tres razones, todas verificadas contra el repo:

1. **Cero migración**: nadie se desloguea ni pierde los ajustes cacheados en el deploy.
2. **Los readers fuera de alcance siguen andando sin tocarlos**: `NewPaymentDialog` y `UserCard`
   leen `localStorage["app_settings"]` y parsean el objeto plano. Con la clave default habría que
   editarlos, contradiciendo el "fuera de alcance" del proposal.
3. **Los tests siguen sirviendo**: `Dashboard.test.tsx` siembra `user_role`/`user_name` y
   `setup.ts` hace `localStorage.clear()`. Con el adaptador legacy esa semántica se conserva
   (ver decisión 14).

`exp` no se persiste: se recalcula del token en la rehidratación. Nunca se persiste nada derivable
del token.

Costo: ~25 líneas de adaptador por store y el estado persistido queda "aplanado" (no soporta
versionado/`migrate` de zustand). Se documenta como **shim de compatibilidad** con fecha de
vencimiento: el change que migre el resto de las vistas puede pasar al `persist` default y hacer
la migración de claves de una sola vez.

*Alternativa considerada*: clave única `app_session` + función de migración desde las claves
viejas. Más idiomático, pero obliga a tocar los componentes fuera de alcance y a mantener código
de migración por tiempo indefinido; el beneficio (una clave en vez de tres) no lo paga.

### 9. Hidratación sincrónica, auto-logout en el store y `queryClient.clear()` en el logout

- **Sin flash de rol**: `persist` con storage síncrono rehidrata **durante la creación del store**,
  antes del primer render. Por eso `App.jsx` puede pasar de `localStorage.getItem("user_role")` en
  el render a `useSessionStore((s) => s.role)` sin cambiar el timing del redirect de `/`. No se usa
  `skipHydration` (es lo que introduciría el flash).
- **Auto-logout por `exp`: se activa** (decidido por el usuario; la spec `session-state` solo exige
  el cierre por 401, este diseño suma el proactivo). Se implementa en el módulo del store, no en un
  componente: una función `scheduleAutoLogout(exp)` que corre una sola vez por app, funciona sin
  provider y no depende de que haya un árbol de React montado —que es exactamente por qué hoy no
  corre nunca. Tres puntos de entrada, y los tres importan:
  1. **`setSession(token)`**: agenda el timer con el `exp` recién decodificado y cancela el anterior.
  2. **Rehidratación de `persist`** (callback de `onRehydrateStorage`, es decir en cada recarga de
     página): **el timer se re-arma desde el `exp` del token persistido**. Sin esto el auto-logout
     solo existiría hasta el primer F5, que es el caso más común de una pestaña de mostrador.
  3. **`logout()`**: cancela el timer (`clearTimeout`) para que no dispare sobre una sesión nueva.

  Si al rehidratar el `exp` **ya venció**, el store no espera al timer: descarta la sesión en el
  mismo callback de rehidratación, es decir **antes del primer render**. Así `ProtectedRoute` ve
  `token === null` desde el arranque y redirige a `/login` sin que llegue a pintarse un frame de
  contenido protegido. Con `setTimeout(0)` o con un `useEffect` habría flash.

  Detalle de implementación a respetar: `setTimeout` en navegadores satura arriba de ~24.8 días
  (2³¹−1 ms) y dispararía **de inmediato**. El delay se topea (`Math.min(ms, 2_147_483_647)`); si
  se topeó, al vencer el timer se recalcula en vez de desloguear. Los tokens de esta app duran
  mucho menos, pero el bug sería un logout instantáneo e inexplicable.

  > **Cambio de comportamiento a registrar en el archive**: el auto-logout, hoy inerte por código
  > muerto, pasa a funcionar de verdad. Es visible para el usuario: una pestaña abierta con token
  > vencido ahora se cierra sola en vez de esperar al próximo 401 o a la próxima navegación.
- **`logout()` limpia la caché de datos**: `queryClient.clear()` además de vaciar el store. Sin
  esto, los datos del usuario anterior quedarían en memoria y se pintarían al loguearse otro
  usuario en la misma pestaña. `stores/session.ts` importa `lib/queryClient.ts` (que solo importa
  `@tanstack/react-query`): sin ciclo.

### 10. `http.ts` lee el store con `getState()`, no con un hook

El request interceptor pasa a `useSessionStore.getState().token`; el de respuesta, ante 401, a
`useSessionStore.getState().logout()` y **mantiene** el `window.location.href = "/login"` y el
`alertError` actuales.

Sobre el ciclo de imports, que es la preocupación explícita: la cadena queda
`http.ts → stores/session.ts → lib/queryClient.ts → @tanstack/react-query`. El store **no importa
`http.ts`** porque el login sigue viviendo en `Login.tsx`/`RegisterClient.tsx` (el proposal pide
toque mínimo ahí: llaman a `api.post` y después a `setSession`). No hay ciclo. Si en el futuro el
store necesitara llamar a la API, la regla es inyectar la función, no importar `http`.

Se mantiene el redirect duro (`window.location.href`) en vez de navegar con el router: es un reset
total del estado en memoria, no acopla `lib/` a React Router y no cambia el comportamiento
observable. Cambiarlo por un `navigate` es una mejora aparte.

### 11. Baja de `AuthContext` y de `src/auth/`: es borrar código muerto, no migrarlo

`src/auth/AuthContext.tsx` y `src/auth/ProtectedRoute.tsx` **se eliminan junto con la carpeta
`src/auth/`**: ningún archivo los importa. El único `ProtectedRoute` vivo es
`src/components/ProtectedRoute.tsx`, y es el que se reescribe:

```tsx
const token = useSessionStore((s) => s.token);
const role  = useSessionStore((s) => s.role);
const exp   = useSessionStore((s) => s.exp);
```

Mismas reglas que hoy: sin token → `/login`; `exp` vencido → `/login` (el `logout()` lo hace el
scheduler del store, no el render del guard: **no se llama a `logout()` durante el render**, que
es lo que provocaría un `setState` en render); rol no permitido → `/my-routine` o `/dashboard`. El
`jwtDecode` sale del guard porque el store ya expone `role` y `exp` derivados: el guard vuelve a
ser una comparación.

Riesgo de haberse equivocado de archivo: nulo, verificado por grep (`App.jsx:7` importa
`./components/ProtectedRoute`).

**Se borra todo el código muerto detectado** (decidido por el usuario). Son tres bajas, y ninguna
se hace a ciegas: `tasks.md` exige verificar cada una con CodeGraph/grep **inmediatamente antes**
de borrar, porque el índice puede haber quedado viejo y porque las fases anteriores mueven
imports.

| Baja | Verificación previa obligatoria |
|---|---|
| `src/auth/` completo (`AuthContext.tsx` + `auth/ProtectedRoute.tsx`) | `codegraph callers useAuth` / `AuthProvider` vacío **y** `grep -rn "src/auth\|useAuth\|AuthProvider" frontend/src` sin resultados fuera de la propia carpeta |
| `src/components/CheckinDialog.tsx` | `grep -rn "CheckinDialog" frontend/src` solo se encuentra a sí mismo |
| Fallback de rol de `Topbar` (reconstruye el rol del JWT con `atob` y reescribe `user_role`) | No es un archivo sino un bloque: se borra **después** de que `Topbar` lea el rol del store, y la verificación es que ningún otro punto dependa de que `Topbar` escriba `user_role` (`grep -rn "user_role" frontend/src` debe dar solo el adaptador de persistencia del store) |

La baja del fallback de `Topbar` es la única con contenido semántico: hoy es la red de seguridad
para "hay token pero no hay `user_role`". Con el store ese estado es **imposible de construir**,
porque `role` se deriva del token en `setSession` y en la rehidratación, en el mismo lugar donde
se define `token`.

### 12. Store de ajustes + tema: el evento se reemplaza por una suscripción

- `useSettingsStore` guarda `settings: AppSettings` (normalizados con los `DEFAULT_SETTINGS` que
  ya existen) y expone `setSettings(next)`. Es **estado de cliente espejado desde el servidor**,
  no la caché de la query: se persiste, está disponible sincrónicamente y lo consumen componentes
  fuera de React (el tema) y componentes fuera de alcance (vía `localStorage`).
- El fetch sigue siendo server data: `useSettingsQuery()` (key `["settings"]`) y **un único
  sincronizador** —un `useSyncSettings()` montado una sola vez en `App.jsx`— escribe el resultado
  en el store con un `useEffect` sobre `data` (v5 no tiene `onSuccess` en queries). Un solo
  escritor desde el servidor; el resto solo lee.
- `Dashboard.tsx` y `Payments.tsx` **borran su propio `GET /settings`** y leen del store. Deja de
  haber cinco fetches independientes del mismo recurso.
- `Settings.tsx` (fuera del alcance de la migración a Query, conserva su `useState`/`useEffect`)
  cambia solo dos líneas: después del `PUT /settings` llama a `setSettings(next)` en vez de
  `localStorage.setItem` + `dispatchEvent`. Ídem `Payments.tsx` con su `PATCH /settings`.
- **Tema**: `lib/theme.ts` queda como helpers puros de DOM (`APP_THEMES`, `isAppThemeId`,
  `applyTheme`, `getStoredTheme`). `syncThemeFromSettings()` **se elimina** —su trabajo era leer
  `localStorage["app_settings"]` y aplicar el tema, que ahora es una suscripción:

  ```ts
  // se registra una vez, junto a la creación del store
  applyTheme(useSettingsStore.getState().settings.theme_preference ?? getStoredTheme()); // 1er paint
  useSettingsStore.subscribe((s) => s.settings.theme_preference, applyTheme);            // cambios
  ```

  Las **dos** líneas importan: la spec `app-settings-state` pide que el tema esté aplicado "desde
  el primer render, sin destello del tema anterior". La suscripción sola solo reacciona a
  cambios, así que la aplicación inicial tiene que correr sincrónicamente al crear el store
  (después de la rehidratación de `persist`, antes del primer render de React).

  `App.jsx` pierde su `useEffect` completo (el listener y el import de `syncThemeFromSettings`).
  `applyTheme` deja de emitir `"app-theme:updated"`: ese evento no lo escucha nadie.
- `Footer.tsx` y `Dashboard.tsx` pierden sus listeners de `"app-settings:updated"` y pasan a
  seleccionar del store. Con eso el evento queda sin emisores ni oyentes y desaparece del repo
  (verificable con un grep vacío).

*Alternativa considerada*: que los ajustes sean **solo** una query, sin store. Más limpio en
teoría, pero el tema tiene que aplicarse al `<html>` antes del primer paint y sin red, y
`NewPaymentDialog`/`UserCard` (fuera de alcance) leen `localStorage` sincrónicamente. El espejo es
deliberado, con un solo escritor, y se documenta como tal.

### 13. `payments:created` se conserva como puente temporal, con un solo oyente

`NewPaymentDialog` y `UserCard` están fuera de alcance y siguen emitiendo `"payments:created"`
después de cobrar. Si Dashboard se migra y pierde su listener, esos cobros dejan de refrescar la
UI: sería una **regresión** dentro de un change que promete lo contrario.

Se mantiene el evento, pero con un solo oyente en toda la app: `useLegacyRefetchBridge()`, montado
una vez en `App.jsx`, que traduce `"payments:created"` a
`queryClient.invalidateQueries({ queryKey: queryKeys.payments.all })`. Queda un archivo chico,
marcado con un comentario `// TODO(change: migrar diálogos)`, que se borra entero cuando esos
componentes pasen a `useMutation`.

*Alternativa considerada*: migrar `NewPaymentDialog`/`UserCard` ahora. Ampliaría el alcance que el
proposal cerró (y `UserCard` tiene 400+ líneas y tres subcomponentes con fetch propio). El puente
cuesta 15 líneas y hace explícita la deuda.

### 14. Tests: `QueryClient` nuevo por render, `retry: false`, y rehidratación de stores entre tests

`renderWithProviders` crea **un `QueryClient` nuevo en cada llamada** y envuelve
`MemoryRouter > QueryClientProvider`. Acepta opcionalmente un cliente propio para tests futuros.

```ts
new QueryClient({
  defaultOptions: {
    queries:   { retry: false, gcTime: Infinity, refetchOnWindowFocus: false, staleTime: Infinity },
    mutations: { retry: false },
  },
});
```

El porqué de cada uno:
- **Cliente nuevo por render**: la caché es estado global; compartirla haría que un test vea datos
  de otro y que el orden de ejecución importe.
- **`retry: false`**: con el default, un fetcher que rechaza reintenta con backoff exponencial;
  el test se cuelga hasta el timeout y falla por infraestructura, no por la vista. Es la misma
  razón por la que `apiMock` mockea el módulo entero.
- **`refetchOnWindowFocus: false`**: jsdom emite eventos de foco durante `cleanup()`; un refetch
  después del unmount es ruido y warnings de `act`.
- **`gcTime: Infinity`** y **`staleTime: Infinity`**: eliminan timers de garbage collection y
  refetches de fondo que podrían dispararse después del teardown del test.
- **`mutations.retry: false`**: coherencia con producción.

`src/test/setup.ts` suma, después del `localStorage.clear()` del `afterEach`, el reseteo de los
dos stores a su estado inicial, y un `beforeEach` que llama a `useSessionStore.persist.rehydrate()`
/ `useSettingsStore.persist.rehydrate()`. Esto último es **imprescindible y no obvio**: `persist`
rehidrata una sola vez, al importar el módulo, mientras que `Dashboard.test.tsx` siembra
`localStorage` en su propio `beforeEach`. Sin la rehidratación explícita, esa siembra no llegaría
nunca al store y la semántica del test cambiaría en silencio.

Con esto, los cuatro archivos de test quedan **sin editar**. (Como red de seguridad: los asserts
de `Dashboard.test.tsx` son labels de KPI estáticos — "Clientes activos", "Rutina base",
"Check-ins de hoy" —; `user_role`/`user_name` solo afectan el saludo, que no se assertea.)

También se actualiza el comentario de cabecera de `renderWithProviders.tsx`, que hoy afirma que
react-query no está instalado.

### 15. Qué NO se toca, y por qué

| Queda como está | Por qué |
|---|---|
| `Routines`, `Reports`, `Settings`, `UserRoutine`, `NewCoach` (fetching) | Fuera del alcance del proposal. `Settings` sí cambia sus 4 líneas de persistencia de ajustes. |
| `EditClientDialog`, `NewPaymentDialog`, `LastPayments`, `AttendanceCalendar`, `UserCard`, `SpotlightSearch` | Fuera de alcance. Participan de las vistas migradas **por composición**, así que se integran por el borde: el `onSuccess` de `EditClientDialog` pasa a invalidar en vez de refetchear a mano (cambia el caller, no el componente), y los emisores de `payments:created` quedan cubiertos por el puente de la decisión 13. |
| Presentación de los indicadores de carga (incluido el `SkeletonRow` de Clientes) | Decisión conservadora del usuario: se unifica el criterio, no la estética (decisión 5). |
| `lib/http.ts` (baseURL, barra final, SweetAlert del 401, redirect duro) | Solo cambia de dónde sale el token y a quién le avisa el 401. Todo lo demás es comportamiento en producción que este change no promete cambiar. |
| `Login.tsx` / `RegisterClient.tsx` | Siguen con su `api.post` y su reintento por timeout; solo cambian las 3 escrituras a `localStorage` por un `setSession(token, {...})`. |
| `useDebounce`, `Pagination`, componentes `ui/` | Estado y presentación de UI: react-query no los reemplaza. |
| Backend, endpoints, payloads, migraciones | El change es 100% frontend. |

## Risks / Trade-offs

- **Tormenta de 401 + SweetAlert con refetch automático** (una sesión vencida en una pestaña de
  fondo puede disparar varias queries a la vez, cada una con su modal y su redirect) → `retry`
  que no reintenta 4xx (decisión 2) + auto-logout por `exp` que corta antes de llegar al servidor
  (decisión 9). Verificación manual obligatoria: expirar el token y volver a la pestaña.
- **Fuga de datos entre usuarios en la misma pestaña** (la caché sobrevive al logout) →
  `queryClient.clear()` dentro de `logout()`, y `logout()` como única vía de cierre de sesión
  (`Topbar` deja de borrar `localStorage` a mano).
- **La migración de Dashboard rompe algo sutil** (1065 líneas, 30 `useState`, fallbacks
  encadenados) → se migra **último**, sobre el patrón ya validado en las otras tres vistas, y en
  dos pasos: primero extraer `useDashboardData` con la lógica actual intacta, después reemplazar
  el fetching. Los dos tests de Dashboard son el canario.
- **El adaptador de `persist` sobre claves legacy es más código y no soporta `migrate`** → se
  acepta a cambio de cero migración y de no tocar los componentes fuera de alcance; se documenta
  como shim con fecha de vencimiento en `frontend/AGENTS.md`.
- **El espejo servidor→store de los ajustes es un anti-patrón si se multiplican los escritores**
  → un único sincronizador (`useSyncSettings`) y `setSettings` como única entrada; documentado en
  `frontend/AGENTS.md` para que la próxima vista no agregue un segundo escritor.
- **Queda un evento global de `window` vivo (`payments:created`)** → un único oyente centralizado y
  marcado como deuda; el proposal solo se comprometió a eliminar `"app-settings:updated"`.
- **+14 kB gzip en el bundle** → aceptado explícitamente en la decisión 1; el `lazy()` por ruta que
  ya existe no se ve afectado (las dependencias caen en el chunk principal).
- **Rehidratación de stores en tests**: si un test futuro siembra `localStorage` *después* del
  primer render, el store no se entera. La regla queda escrita en `frontend/AGENTS.md`: sembrar en
  `beforeEach`, nunca dentro del `it` después de renderizar.
- **Auto-logout con un `exp` corrupto o absurdo** (token manipulado, reloj del cliente adelantado)
  → el delay se topea a 2³¹−1 ms y se recalcula al vencer, y un `exp` no numérico se trata como
  "sin expiración conocida" (no agenda timer) en vez de desloguear al instante. Un reloj de
  cliente muy adelantado desloguea antes de tiempo: es el mismo comportamiento que ya tiene el
  chequeo de `exp` en `ProtectedRoute`, no una regresión nueva.
- **"Indicador de carga equivalente en las cuatro vistas" queda cumplido por comportamiento, no
  por un componente único** (decisión 5, decisión conservadora del usuario). Si QA lee el
  escenario de forma estricta, este es el punto que puede discutirse; la mitigación es que
  ninguna vista queda con área en blanco y que el criterio (`isPending` vs `isFetching`) sí es
  idéntico en las cuatro.

## Migration Plan

Fase por fase, cada una cerrable en una sesión y con `make test-frontend` en verde al terminar.
Es la secuencia que después se traduce a `tasks.md`.

1. **Infra**: instalar las dos dependencias; `src/lib/queryClient.ts`; `QueryClientProvider` en
   `main.jsx`; `renderWithProviders` + `setup.ts`. Sin migrar ninguna vista todavía: la suite
   tiene que seguir verde solo con el provider agregado.
2. **Sesión**: `src/stores/session.ts` (con adaptador de persistencia y auto-logout); reescribir
   `components/ProtectedRoute.tsx`; migrar `App.jsx`, `Sidebar`, `Topbar`, `Footer`, `Login`,
   `RegisterClient`, `Home`, `Routines`, `Settings` (solo la lectura del rol) y `lib/http.ts`;
   **borrar `src/auth/`**.
3. **Ajustes y tema**: `src/stores/settings.ts`; `useSettingsQuery` + `useSyncSettings`; podar
   `syncThemeFromSettings` y el `useEffect` de `App.jsx`; migrar los emisores/oyentes del evento.
   Criterio de cierre: `grep -r "app-settings:updated" frontend/src` no devuelve nada.
4. **Capa de datos**: `queryKeys.ts`, `pagination.ts` y los `<dominio>.ts` / `<dominio>.queries.ts`
   sin consumidores todavía.
5. **Vistas, en orden de riesgo creciente**: Clientes → Asistencia → Pagos → Dashboard (esta
   última en dos pasos, ver Risks). Un commit por vista.
6. **Cierre**: `frontend/AGENTS.md` (patrón nuevo, convención de nombres, defaults del cliente,
   reglas de test, deuda declarada) y `codegraph sync`.

**Rollback**: cada fase es un commit revertible por separado. Las fases 2 y 3 son las únicas con
efecto sobre datos persistidos del usuario, y por diseño (decisión 8) escriben las mismas claves
de `localStorage` que hoy, así que un revert no deja sesiones ni ajustes huérfanos. La fase 1 es
puramente aditiva.

## Open Questions

**Resueltas por el usuario** (quedan acá como registro de por qué el diseño dice lo que dice):

- ~~Auto-logout proactivo por `exp`~~ → **se activa**, además del cierre por 401, con el timer
  re-armado en cada rehidratación y cierre en el arranque si ya venció (decisión 9). Es un cambio
  observable respecto de hoy y va anotado para el archive.
- ~~`staleTime` especial para asistencia~~ → **no**: 30 s parejo para todo. La invalidación tras la
  mutación propia ya cubre el check-in que registra el propio operador (decisión 2 y 6).
- ~~Qué se hace con el código muerto~~ → **se borra todo**: `src/auth/` completo, `CheckinDialog` y
  el fallback de rol de `Topbar`, cada uno con verificación previa de referencias como paso
  explícito en `tasks.md` (decisión 11).
- ~~Unificar los indicadores de carga y los textos de error~~ → **opción conservadora**: el
  `SkeletonRow` de Clientes se queda, no se crea `<DataLoading />`, y los textos del error se
  reusan de los que ya muestran las vistas (decisión 5).

**Abiertas:**

1. **`Settings.tsx` sin migrar a Query** mientras es la vista que más ajustes escribe: queda con
   `useState`/`useEffect` para su fetch y solo cambia la persistencia. Confirmar que la spec de
   `app-settings-state` no exige que `Settings` ya lea de `useSettingsQuery` en esta entrega.
