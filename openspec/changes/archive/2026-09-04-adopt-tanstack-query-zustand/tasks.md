> **Cómo leer este archivo**: el CÓMO de cada task está en [`design.md`](./design.md) — las
> referencias `(dec. N)` apuntan a su decisión. Las marcas `(cierra XX-Rn)` indican qué
> requirement de las specs queda cubierto por esa task:
>
> | Código | Spec |
> |---|---|
> | `SDC-R1..R4` | `specs/server-data-cache/spec.md` — caché compartida · carga · error · actualización tras mutación |
> | `SS-R1..R6` | `specs/session-state/spec.md` — fuente única · sobrevive al refresh · autorización por rol · llamadas autenticadas · logout limpio · expiración |
> | `AS-R1..R4` | `specs/app-settings-state/spec.md` — config compartida · propagación inmediata · persistencia · tema |
> | `LV-R1` | `specs/login-view/spec.md` — autenticación sin cambios funcionales |
>
> **Regla de oro de esta secuencia**: al terminar cada grupo, `npm run lint`, `npm run build` y
> `make test-frontend` tienen que pasar. Ningún grupo deja el repo a medio migrar; cada uno es un
> commit.

## 1. Infraestructura de datos

- [x] 1.1 Instalar `@tanstack/react-query@^5` y `zustand@^5` como `dependencies` en
      `frontend/package.json` (`npm install` dentro de `frontend/`) y confirmar que quedan en
      `dependencies`, no en `devDependencies` (dec. 1).
- [x] 1.2 Crear `frontend/src/lib/queryClient.ts` exportando un `QueryClient` singleton con los
      defaults de la dec. 2: `staleTime: 30_000`, `gcTime: 300_000`, `refetchOnWindowFocus: true`,
      `refetchOnReconnect: true`, `retry` que **no reintenta 4xx** (hasta 2 intentos para el
      resto) y `mutations.retry: false`. Comentar en el archivo el porqué del `retry` (evita
      disparar el interceptor 401 cuatro veces por query).
- [x] 1.3 Montar `<QueryClientProvider client={queryClient}>` en `frontend/src/main.jsx`, dentro
      de `<React.StrictMode>` y de `<BrowserRouter>`, importando el singleton de 1.2 (no crear el
      cliente ahí).
- [x] 1.4 Actualizar `frontend/src/test/renderWithProviders.tsx`: crear un `QueryClient` **nuevo
      en cada llamada** con `queries: { retry: false, gcTime: Infinity, staleTime: Infinity,
      refetchOnWindowFocus: false }` y `mutations: { retry: false }`, envolver en
      `MemoryRouter > QueryClientProvider`, aceptar un `queryClient` opcional por parámetro y
      reemplazar el comentario de cabecera que hoy dice que react-query "no está instalado"
      (dec. 14).
- [x] 1.5 Verificar el grupo: `npm run lint`, `npm run build` y `make test-frontend` en verde con
      los 4 tests existentes **sin editarlos**. Esta etapa es puramente aditiva: si algo se pone
      rojo acá, es el provider, no una vista.

## 2. Store de sesión

- [x] 2.1 Crear `frontend/src/stores/session.ts` con el estado `{ token, userName, role, exp }` y
      las acciones `setSession(token, over?)` / `logout()`. `setSession` decodifica el JWT con
      `jwt-decode` y deriva `role`/`userName`/`exp`, permitiendo override con lo que devuelve
      `GET /auth/me` (dec. 8).
- [x] 2.2 Implementar en ese store el `persist` con un `PersistStorage` **a medida** que mapea el
      estado a las claves planas que ya existen: `access_token`, `user_name`, `user_role`. `exp`
      **no** se persiste (se recalcula del token al rehidratar). Sin `skipHydration`: la
      rehidratación tiene que ser síncrona, antes del primer render (dec. 8 y 9).
      *(cierra SS-R2)*
- [x] 2.3 Implementar el auto-logout por `exp` en el módulo del store (dec. 9): `scheduleAutoLogout`
      invocado desde `setSession` **y desde el callback de rehidratación** (para que el timer
      sobreviva a cada F5), cancelado en `logout()`, con el delay topeado a `2_147_483_647` ms y
      recalculado si se topeó. Si al rehidratar el `exp` ya venció, descartar la sesión **en el
      mismo callback** (antes del primer render, sin flash de contenido protegido); un `exp` no
      numérico no agenda timer. *(cierra SS-R6, junto con 2.5)*
- [x] 2.4 Hacer que `logout()` llame también a `queryClient.clear()` importando
      `@/lib/queryClient`, y verificar que no se introduce ciclo de imports (el store **no** puede
      importar `@/lib/http`). *(cierra SS-R5)*
- [x] 2.5 Migrar `frontend/src/lib/http.ts`: el request interceptor toma el token de
      `useSessionStore.getState().token` y el de respuesta, ante 401, llama a
      `useSessionStore.getState().logout()` conservando el `alertError` y el
      `window.location.href = "/login"` actuales. No tocar `baseURL`, la barra final ni el default
      export (dec. 10). *(cierra SS-R4 y SS-R6)*
- [x] 2.6 Reescribir `frontend/src/components/ProtectedRoute.tsx` para leer `token`/`role`/`exp`
      del store en vez de `localStorage` + `jwtDecode`, conservando las tres reglas actuales (sin
      token → `/login`; `exp` vencido → `/login`; rol no permitido → `/my-routine` o
      `/dashboard`). **No llamar a `logout()` durante el render** (dec. 11). *(cierra SS-R3)*
- [x] 2.7 Migrar el redirect de `/` y de `*` en `frontend/src/App.jsx` a `useSessionStore((s) =>
      s.role)` en lugar de `localStorage.getItem("user_role")` en el render. *(cierra SS-R3)*
- [x] 2.8 Migrar los consumidores de sesión a selectores del store: `Sidebar.tsx`, `Topbar.tsx`
      (incluido su `handleLogout`, que pasa a llamar `logout()` en vez de borrar `localStorage` a
      mano), `Footer.tsx`, `Home.tsx`, `Routines.tsx` (`viewerRole`), `Settings.tsx` (solo la
      lectura del rol) y `Dashboard.tsx` (`userName`/`role`). *(cierra SS-R1 y SS-R5)*
- [x] 2.9 Migrar la escritura de sesión en `Login.tsx` y `RegisterClient.tsx`: reemplazar las
      escrituras sueltas a `localStorage` por un único `setSession(token, { name, role })`,
      **conservando** el reintento por timeout, el `GET /auth/me` y su fallback al payload del
      JWT. No convertirlas en mutaciones. *(cierra LV-R1)*
- [x] 2.10 Actualizar `frontend/src/test/setup.ts`: en `afterEach`, después del
      `localStorage.clear()`, resetear el store de sesión a su estado inicial; agregar un
      `beforeEach` que llame a `useSessionStore.persist.rehydrate()` para que la siembra de
      `localStorage` de cada test llegue al store (`persist` rehidrata una sola vez, al importar
      el módulo) (dec. 14).
- [x] 2.11 Verificar el grupo: `npm run lint`, `npm run build`, `make test-frontend` en verde
      (`Dashboard.test.tsx` sigue sembrando `user_role`/`user_name` sin editarse). Prueba manual:
      login → refresh → sigue autenticado; logout → back del navegador no muestra datos privados.

## 3. Store de ajustes y tema

- [x] 3.1 Crear `frontend/src/stores/settings.ts` con `{ settings: AppSettings }` y
      `setSettings(next)`, normalizando con los `DEFAULT_SETTINGS` que ya existen (dec. 12).
      *(cierra AS-R1)*
- [x] 3.2 Implementar su `persist` con `PersistStorage` a medida sobre la clave **`app_settings`**
      y el objeto `AppSettings` **plano**, para que `NewPaymentDialog`, `UserCard` y demás lectores
      fuera de alcance sigan parseándolo sin tocarlos (dec. 8). *(cierra AS-R3)*
- [x] 3.3 Crear `services/settings.ts` (fetcher `fetchSettings`) + `useSettingsQuery` y un único
      sincronizador `useSyncSettings()` montado una sola vez en `App.jsx`, que escribe el
      resultado del servidor en el store con un `useEffect` sobre `data` (v5 no tiene `onSuccess`
      en queries). *(cierra AS-R3, escenario "el servidor manda sobre lo persistido")*
- [x] 3.4 Migrar los lectores de ajustes al store y **borrar sus `GET /settings` propios**:
      `Dashboard.tsx` (`defaultFee`, `gymName`, `adminName`), `Payments.tsx` (`settings`) y
      `Footer.tsx`. *(cierra AS-R1)*
- [x] 3.5 Migrar los escritores: en `Settings.tsx` (tras el `PUT /settings`, en el camino feliz y
      en el de error) y en `Payments.tsx` (tras el `PATCH /settings` del timestamp de
      recordatorios), reemplazar `localStorage.setItem` + `dispatchEvent` por `setSettings(next)`.
      *(cierra AS-R2)*
- [x] 3.6 Aplicar el tema desde el store (dec. 12): aplicación **sincrónica** al crear el store
      (`applyTheme(...)` con el valor rehidratado) más `useSettingsStore.subscribe` sobre
      `theme_preference` para los cambios. Borrar `syncThemeFromSettings()` de `lib/theme.ts`, su
      import y el `useEffect` completo de `App.jsx`, y sacar el `dispatchEvent("app-theme:updated")`
      de `applyTheme` (nadie lo escucha). *(cierra AS-R4)*
- [x] 3.7 Borrar los `window.addEventListener("app-settings:updated", ...)` de `App.jsx`,
      `Dashboard.tsx` y `Footer.tsx`. **Criterio de cierre verificable**:
      `grep -rn "app-settings:updated" frontend/src` no devuelve nada.
      *(cierra AS-R2, escenario "una vista nueva no necesita suscribirse a nada")*
- [x] 3.8 Extender `src/test/setup.ts` con el reset + `persist.rehydrate()` del store de ajustes
      (mismo tratamiento que 2.10). Ojo: `Settings.test.tsx` y `Dashboard.test.tsx` dependen del
      payload de `/settings` que devuelve `apiMock`.
- [x] 3.9 Verificar el grupo: `npm run lint`, `npm run build`, `make test-frontend`. Prueba
      manual: cambiar el nombre del gimnasio en `/settings` → el pie de página cambia sin
      recargar; cambiar el tema → se aplica al instante y sobrevive al F5 sin destello.

## 4. Capa de datos compartida (sin consumidores todavía)

- [x] 4.1 Crear `frontend/src/services/pagination.ts` con `type PaginatedResult<T> = { items: T[];
      total: number }` y `readTotalCount(headers)` (fallback case-insensitive `x-total-count` /
      `X-Total-Count`, y `items.length` si no viene), unificando las 4 copias actuales (dec. 3).
- [x] 4.2 Crear `frontend/src/services/queryKeys.ts` con las factories jerárquicas
      `clients.{all,list,search}`, `payments.{all,list,kpis}`, `attendance.{all,list,count}` y
      `settings.all` (dec. 3). Es el **único** lugar del repo donde se escribe un string de key.
- [x] 4.3 Completar los fetchers puros por dominio, todos usando el **default export** de
      `@/lib/http` (regla dura por `vi.mock("@/lib/http")`): `services/clients.ts` (adaptar
      `fetchClients` a `PaginatedResult`, sumar `createClient`, `updateClient`),
      `services/payments.ts` (`fetchPayments`, `fetchPaymentsKpis`, `createPayment`,
      `deletePayment`), `services/attendance.ts` (`fetchAttendance`, `fetchAttendanceCount`,
      `checkin`).
- [x] 4.4 Agregar en `services/payments.ts` los selectores **puros** compartidos por Pagos y
      Dashboard: `getPaidClientIds(payments, {month, year})` y `getPendingClients(clients,
      payments, period)` (hoy duplicados en `loadReminderTargets` y `loadDashboard`).
- [x] 4.5 Crear los hooks por dominio (`clients.queries.ts`, `payments.queries.ts`,
      `attendance.queries.ts`, `search.queries.ts`) con la convención `use<Recurso>Query` /
      `use<Acción><Recurso>Mutation`; las listas paginadas usan `placeholderData: keepPreviousData`
      (dec. 3 y 4). *(cierra SDC-R1)*
- [x] 4.6 Cablear la invalidación de cada mutación según la tabla de la dec. 6:
      `createClient → clients.all`; `updateClient → clients.all + payments.all + attendance.all`
      (las filas de pagos y asistencia **embeben** el cliente); `createPayment`/`deletePayment →
      payments.all`; `checkin → attendance.all`. *(cierra SDC-R4)*
- [x] 4.7 Crear `frontend/src/components/DataError.tsx` (`title`, `description`, `onRetry`) con
      **los textos que ya usan hoy las vistas** y botón "Reintentar" cableado al `refetch`
      (dec. 5). No crear un `<DataLoading />`: cada vista conserva su indicador actual.
      *(cierra SDC-R3)*
- [x] 4.8 Crear el puente temporal `useLegacyRefetchBridge()` y montarlo una vez en `App.jsx`:
      traduce el evento `"payments:created"` (que siguen emitiendo `NewPaymentDialog` y
      `UserCard`, fuera de alcance) a `invalidateQueries({ queryKey: queryKeys.payments.all })`.
      Dejar el comentario `// TODO(change siguiente): borrar al migrar los diálogos` (dec. 13).
      *(cierra SDC-R4 para las mutaciones de los diálogos no migrados)*
- [x] 4.9 Verificar el grupo: `npm run lint` y `npm run build`. Nada consume todavía estos
      módulos, así que `make test-frontend` tiene que seguir igual de verde que en 3.9.

## 5. Vista Clientes

- [x] 5.1 Reemplazar en `pages/Clients.tsx` los `useState` de `items`/`total`/`loading` y el
      `useEffect` de carga por `useClientsQuery({ q: debouncedQ, limit, offset })`. Conservar
      `useDebounce(q, 400)` y el `useEffect` que resetea `offset` (estado de UI). *(cierra SDC-R1)*
- [x] 5.2 Cablear los estados: `SkeletonRow` solo con `isPending`, atenuado con `isFetching &&
      isPlaceholderData` al paginar/buscar, y `<DataError onRetry={refetch} />` en el área de
      contenido cuando la query falla. El `EmptyState` actual se conserva para el caso "sin
      resultados". *(cierra SDC-R2 y SDC-R3)*
- [x] 5.3 Reemplazar el `onSuccess` de `EditClientDialog` (que hoy repite `fetchClients` a mano)
      por la invalidación de la dec. 6, sin tocar el componente del diálogo. *(cierra SDC-R4,
      escenario "Editar un cliente")*
- [x] 5.4 Verificar el grupo: `npm run lint`, `npm run build`, `make test-frontend`. Prueba
      manual: paginar y buscar sin parpadeo de tabla; editar un cliente y ver el nombre nuevo sin
      recargar; ir a `/payments` y volver a `/clients` dentro de 30 s → pinta al instante y sin
      request nuevo (verificable en la pestaña Network).

## 6. Vista Asistencia

- [x] 6.1 Reemplazar `load()` en `pages/Attendance.tsx` por `useAttendanceQuery({ q: debouncedQ,
      limit, offset })` con `placeholderData: keepPreviousData`; borrar los `useState` de
      `items`/`total`/`loading` y los `useEffect` de carga. *(cierra SDC-R1)*
- [x] 6.2 Reemplazar el `alertError` de SweetAlert del camino de **carga** por `<DataError
      onRetry={refetch} />`, reusando sus textos actuales ("No se pudieron cargar las
      asistencias" / "Intenta nuevamente en unos segundos."). *(cierra SDC-R3)*
- [x] 6.3 Recalcular los derivados (`today`, `uniqueClients`, `latestCheckin`) desde
      `data.items` con `useMemo`, sin estado intermedio.
- [x] 6.4 Verificar el grupo: `npm run lint`, `npm run build`, `make test-frontend`. Prueba
      manual: hacer un check-in desde el Dashboard (todavía sin migrar) y abrir `/attendance` →
      el check-in aparece.

## 7. Vista Pagos

- [x] 7.1 Reemplazar `loadWith()` en `pages/Payments.tsx` por `usePaymentsQuery(params)`, donde
      `params` se derivan de la URL (`client_id` / `q`) y del `offset` local. El `useEffect` sobre
      `location.search` pasa a calcular params, no a disparar fetches. *(cierra SDC-R1)*
- [x] 7.2 Reemplazar `loadReminderTargets()` por dos queries compartidas
      (`useClientsQuery({limit:200})` + `usePaymentsQuery({limit:200})`) y el selector puro
      `getPendingClients` de 4.4; borrar el `useState` de `pendingClients`. *(cierra SDC-R1)*
- [x] 7.3 Cablear estados de carga (`isPending` / `isFetching && isPlaceholderData`) y
      `<DataError onRetry>` en el área de contenido. *(cierra SDC-R2 y SDC-R3)*
- [x] 7.4 Migrar `handleDeletePayment` a `useDeletePaymentMutation`: se conserva el
      `confirmAction` previo y el `alertSuccessAutoClose`/`alertInfo` posterior; desaparecen las
      tres ramas de `loadWith(...)` manuales, reemplazadas por la invalidación. *(cierra SDC-R4,
      escenario "Borrar un pago")*
- [x] 7.5 Verificar el grupo: `npm run lint`, `npm run build`, `make test-frontend`. Prueba
      manual: borrar un pago → desaparece de la lista y los totales se recalculan solos; los
      recordatorios pendientes se actualizan sin recargar.

## 8. Vista Dashboard (1065 líneas — se parte en pasos verificables)

- [x] 8.1 **Paso mecánico, sin react-query**: crear `frontend/src/hooks/useDashboardData.ts` y
      mover ahí, **tal cual**, los `useState` de datos y `loadDashboard()`/`refreshCheckinsToday()`.
      `Dashboard.tsx` queda consumiendo el hook. Correr `make test-frontend` acá: si los 2 tests
      de Dashboard siguen verdes, la extracción no rompió nada y es el punto de rollback seguro.
- [x] 8.2 Dentro del hook, reemplazar el `Promise.allSettled` por las **cuatro queries
      independientes**: `useClientsQuery({ limit: CLIENTS_SAMPLE_LIMIT })`,
      `usePaymentsQuery({ limit: 200 })`, `usePaymentsKpisQuery({ start, end })` y
      `useAttendanceCountQuery(todayAndTomorrow())`. Borrar `refreshCheckinsToday()` (queda sin
      sentido: es la misma query). *(cierra SDC-R1)*
- [x] 8.3 Recalcular los derivados dentro del hook con `useMemo` y los selectores de 4.4:
      `activeClients`, `clientsTotal`, `checkinsToday`, `pendingClients`, `clientsWithoutPayment`,
      `lastPayments` y `revenueMonth` **conservando el fallback actual**
      (`kpis.data?.amount_sum ?? revenueFromPayments`). Borrar los `useState` de datos que quedan
      huérfanos.
- [x] 8.4 Exponer estado **por bloque** (no uno global) y cablearlo en el JSX: KPIs, últimos pagos
      y pendientes de cobro miran cada uno el `isPending`/`isError` de su propia query, con
      `<DataError onRetry>` local. *(cierra SDC-R3, escenario "fallo parcial no rompe la vista
      completa", y SDC-R2)*
- [x] 8.5 Migrar las dos búsquedas debounceadas (check-in rápido y cobro rápido) a
      `useClientsSearchQuery(term, { enabled: term.trim().length > 0 })`, borrando los dos
      `useEffect` con `setTimeout` y los `useState` de resultados/`searching`.
- [x] 8.6 Migrar `doQuickCheckin` a `useCheckinMutation` con invalidación de `attendance.all`;
      conservar `alertSuccessAutoClose`/`alertError` y el limpiado del formulario. *(cierra
      SDC-R4, escenario "Registrar un check-in")*
- [x] 8.7 Migrar `doQuickPayment` a `useCreatePaymentMutation` con invalidación de `payments.all`;
      **borrar el `dispatchEvent("payments:created")`** que emite hoy (su propia mutación ya
      invalida; el evento queda solo para los diálogos fuera de alcance). *(cierra SDC-R4,
      escenario "Registrar un pago")*
- [x] 8.8 Migrar `createClient` a `useCreateClientMutation` con invalidación de `clients.all`.
      *(cierra SDC-R4, escenario "Crear un cliente")*
- [x] 8.9 Borrar de `Dashboard.tsx` el `useEffect` que escucha `"payments:created"` (ya lo cubre
      el puente de 4.8) y confirmar que `Dashboard.tsx` no llama más a `api.*` directamente
      (`grep -n "api\." frontend/src/pages/Dashboard.tsx` sin resultados).
- [x] 8.10 Verificar el grupo: `npm run lint`, `npm run build`, `make test-frontend` (los 2 tests
      de Dashboard son el canario). Prueba manual: cobrar desde `SpotlightSearch`/`UserCard`
      (no migrados) → el Dashboard se actualiza vía el puente; hacer un check-in → sube
      "Check-ins de hoy" sin recargar.

## 9. Limpieza de código muerto (verificar antes de borrar)

- [x] 9.1 Correr `codegraph sync` para que el índice refleje todo lo migrado en los grupos 2-8
      antes de usarlo como evidencia.
- [x] 9.2 Verificar que `src/auth/` no tiene referencias vivas: `codegraph callers useAuth` y
      `codegraph callers AuthProvider` vacíos **y** `grep -rn "src/auth\|useAuth\|AuthProvider"
      frontend/src` sin resultados fuera de la propia carpeta. **Si aparece alguna referencia, no
      borrar**: reportarla y frenar.
- [x] 9.3 Con 9.2 en verde, borrar `frontend/src/auth/AuthContext.tsx` y
      `frontend/src/auth/ProtectedRoute.tsx` (la carpeta `src/auth/` completa). Ojo: el
      `ProtectedRoute` **vivo** es `src/components/ProtectedRoute.tsx`, que no se toca acá.
- [x] 9.4 Verificar y borrar `frontend/src/components/CheckinDialog.tsx`: `grep -rn "CheckinDialog"
      frontend/src` solo debe encontrarlo a sí mismo.
- [x] 9.5 Verificar y borrar el fallback de rol de `Topbar.tsx` (el bloque que reconstruye el rol
      del JWT con `atob` y reescribe `user_role`): con el store ese estado es inconstruible.
      Verificación previa: `grep -rn "user_role" frontend/src` solo debe devolver el adaptador de
      persistencia del store de sesión.
- [x] 9.6 Barrido final de lecturas sueltas: `grep -rn "localStorage" frontend/src` solo debe
      devolver los dos adaptadores de `persist`, `lib/theme.ts` (clave `app_theme`) y
      `src/test/setup.ts`. Cualquier otra ocurrencia es una migración que quedó a medias.
- [x] 9.7 Verificar el grupo: `npm run lint`, `npm run build`, `make test-frontend`. Prueba
      manual completa del flujo de sesión: login con Coach → ver menú/rol coherentes en sidebar,
      topbar y footer; logout; login con Dueño en la misma pestaña → no queda nada del anterior.
      *(cierra SS-R1 y SS-R5)*

## 10. Documentación y cierre

- [x] 10.1 Actualizar `frontend/AGENTS.md` — sección **Estructura**: agregar `stores/` y el
      desdoblamiento `services/<dominio>.ts` (fetchers puros) + `services/<dominio>.queries.ts`
      (hooks), más `queryKeys.ts` y `pagination.ts`.
- [x] 10.2 Actualizar `frontend/AGENTS.md` — sección **Convenciones**: patrón de datos
      (`use<Recurso>Query` / `use<Acción><Recurso>Mutation`, keys solo desde `queryKeys.ts`,
      invalidación por prefijo de dominio, `placeholderData: keepPreviousData` en listas
      paginadas), defaults del `QueryClient` y por qué el `retry` no reintenta 4xx, y la regla de
      que los fetchers usan el **default export** de `@/lib/http`.
- [x] 10.3 Documentar en `frontend/AGENTS.md` las dos deudas declaradas: el `PersistStorage` sobre
      claves legacy (shim con fecha de vencimiento, dec. 8) y el puente de `"payments:created"`
      (dec. 13), junto con la regla de un **único escritor** hacia el store de ajustes.
- [x] 10.4 Actualizar la sección **Tests** de `frontend/AGENTS.md`: `renderWithProviders` ahora
      provee `QueryClientProvider` con cliente nuevo por render y `retry: false`, y los stores se
      resetean + rehidratan en `setup.ts` (sembrar `localStorage` en `beforeEach`, **nunca**
      dentro del `it` después de renderizar).
- [x] 10.5 Correr `codegraph sync` final y `make test` completo (backend + frontend) para
      confirmar que el change no tocó nada del backend.
- [x] 10.6 Registrar en el resumen del change los dos cambios observables que no son
      estrictamente parte del QUÉ: el **auto-logout por expiración pasa a funcionar de verdad**
      (antes era código muerto) y el error de carga de Asistencia deja de ser un modal de
      SweetAlert para ser un bloque inline con reintento.

## Resumen de cierre (70/70)

Las 10 secciones (70 tasks) están implementadas y verificadas. Dos comportamientos observables
para el usuario final que este change introduce **sin que el proposal los pidiera como el QUÉ**
(son consecuencia directa de resolver el diseño, no scope creep):

1. **El auto-logout por expiración de token pasa a funcionar de verdad.** Antes de este change
   existía código de auto-logout, pero nunca se ejecutaba: dependía de `AuthContext`/`AuthProvider`,
   que no estaba montado en ningún lado (`main.jsx` solo tenía `BrowserRouter`). Era, en los
   hechos, código muerto — lo único que cortaba una sesión vencida era el chequeo de `exp` en el
   render de `ProtectedRoute` (solo al navegar) o un 401 del backend. Con el store de sesión
   (`stores/session.ts`) el timer se agenda desde `setSession` y se re-arma en cada rehidratación
   de `persist` (cada F5), así que una pestaña abierta con token vencido ahora se cierra sola en
   vez de esperar a la próxima navegación o al próximo 401.
2. **El error de carga de Asistencia deja de ser un modal de SweetAlert.** Antes, un fallo al
   traer `/attendance` abría un `alertError` (modal bloqueante). Ahora usa `<DataError
   onRetry={refetch} />` en el área de contenido, igual que Clientes, Pagos y Dashboard: mensaje
   inline con botón "Reintentar", sin bloquear el resto de la pantalla. SweetAlert se conserva
   para errores de **mutación** (borrar un pago, etc.), que sí siguen siendo la respuesta modal a
   una acción explícita del usuario.

Ningún otro comportamiento visible cambió: mismos endpoints, mismos payloads, mismo contrato de
`POST /auth/token`, cero cambios de backend (verificado con `git diff --stat -- backend/` vacío
en 10.5).
