## Why

Hoy el frontend pide datos al backend "a mano": 16 archivos bajo `frontend/src/` repiten el mismo
trío `useState` + `useEffect` + `axios`, cada uno con su propio `loading`, su propio manejo de
error y su propia copia de los datos. El costo lo pagan el usuario y el equipo:

- **Pantallas en blanco evitables**: `/clients`, `/payments`, `/attendance` y `/settings` se
  vuelven a pedir desde cero en cada vista y en cada visita, sin caché compartida. El Dueño que
  va de Dashboard a Pagos y vuelve espera dos veces por datos que ya tenía hace tres segundos.
- **Datos viejos después de operar**: no hay invalidación tras una mutación. Cuando el Coach
  registra un check-in o cobra un pago, cada vista decide a mano qué re-fetchear; lo que no se
  acordó de refrescar queda desactualizado hasta recargar la página.
- **Carga y error inconsistentes**: cada pantalla inventa su propio estado de "cargando" y de
  "falló", así que la experiencia de espera y de error cambia según dónde estés parado.
- **Sesión duplicada y frágil**: `src/auth/AuthContext.tsx` mantiene token y usuario, pero
  `App.jsx`, `Sidebar`, `Topbar`, `Footer`, `ProtectedRoute`, `Dashboard`, `Routines`, `Settings`
  y `lib/http.ts` leen `localStorage.getItem("access_token" / "user_role")` por su cuenta. Nadie
  se entera cuando la sesión cambia: la UI puede mostrar el menú de un rol y el contenido de otro
  hasta que se recarga.
- **Sincronización por evento global invisible**: los ajustes del negocio y el tema se propagan
  con `window.dispatchEvent(new Event("app-settings:updated"))` desde `Settings` y `Payments`,
  escuchado en `App.jsx`, `Dashboard` y `Footer`. Quien agregue una pantalla y olvide emitir o
  escuchar el evento deja la UI desincronizada, y no hay nada que lo advierta.

Ahora es el momento: cada vista nueva replica el patrón manual, así que el costo de estandarizar
sube en cada iteración. Establecer el patrón sobre las cuatro vistas más usadas deja el camino
marcado para el resto.

## What Changes

- Se adopta **TanStack Query** como mecanismo único de lectura de datos del servidor en el
  frontend: un proveedor de datos montado a nivel app (`src/main.jsx`) y una capa de acceso a
  datos compartida sobre `src/services/`, con claves de caché y hooks reutilizables entre vistas.
- Se migran a esa capa **cuatro vistas clave**: **Clientes**, **Dashboard**, **Pagos** y
  **Asistencia**. Pasan a compartir la caché de `/clients`, `/payments` y `/attendance` en vez de
  mantener cada una su copia, y a mostrar estados de carga y error consistentes.
- Las mutaciones de esas vistas (alta y edición de cliente, registro de pago, borrado de pago,
  check-in) **invalidan los datos afectados**: la UI se actualiza sola, sin re-fetch a mano ni
  recarga de página.
- Se adopta **Zustand** para el estado de cliente:
  - **Sesión**: token, usuario y rol viven en un único store persistido. Se elimina
    `src/auth/AuthContext.tsx` y las lecturas sueltas de `localStorage` en componentes, guards y
    `src/lib/http.ts`. Login y registro de cliente escriben la sesión a través del store en vez
    de tocar `localStorage` directamente (toque mínimo, sin migrarlas a mutaciones).
  - **Ajustes y tema**: pasan a un store compartido. Se elimina el evento
    `"app-settings:updated"` como mecanismo de sincronización.
- **BREAKING (interno)**: desaparecen `AuthContext` / `useAuth()` y el evento
  `"app-settings:updated"`. Es ruptura de contratos internos del frontend; no cambia ningún
  endpoint, payload ni comportamiento del backend.
- El helper de render compartido de tests (`src/test/renderWithProviders.tsx`) pasa a proveer el
  contexto de datos, para que la suite actual de Vitest siga pasando sin reescribir tests.

### Fuera de alcance (change posterior)

- **Migrar el resto de las vistas y componentes**: `Routines`, `Reports`, `Settings`,
  `UserRoutine`, `NewCoach`, `RegisterClient`, `Login` y los diálogos/componentes con fetch
  propio (`EditClientDialog`, `NewPaymentDialog`, `CheckinDialog`, `LastPayments`, `UserCard`,
  `AttendanceCalendar`, `SpotlightSearch`). Quedan como están y se migran después, sobre el
  patrón ya establecido por este change.
- Rediseñar vistas o cambiar su contenido visible más allá de los estados de carga y error.
- Cambiar endpoints, contratos o comportamiento del backend.
- Ampliar la cobertura de tests: la restricción es que la suite actual siga en verde.

## Capabilities

### New Capabilities

- `server-data-cache`: cómo el frontend lee, cachea, refresca e invalida los datos del servidor, y
  qué ve el usuario mientras cargan o fallan. Alcance de esta entrega: Clientes, Dashboard, Pagos
  y Asistencia, incluida la actualización automática tras cada mutación.
- `session-state`: fuente única de verdad de la sesión (token, usuario autenticado, rol) para toda
  la app: persistencia entre recargas, disponibilidad para los guards por rol y para las llamadas
  a la API, y propagación inmediata de logout y expiración de token a toda la UI.
- `app-settings-state`: configuración del negocio y tema visual compartidos entre vistas, con
  propagación inmediata al guardar, sin recargar la página y sin eventos globales de `window`.

### Modified Capabilities

- `login-view`: el requirement "Autenticación sin cambios funcionales" describe hoy que el login
  exitoso guarda `access_token`, `user_name` y `user_role` en `localStorage`. Pasa a describirse
  en términos del store de sesión (la sesión queda establecida y persistida, sobrevive al
  refresh y su rol queda disponible para toda la app), sin cambiar lo que el usuario ve ni el uso
  de `POST /auth/token`.

## Impact

- **Dependencias**: `frontend/package.json` suma `@tanstack/react-query` y `zustand`. Backend sin
  cambios.
- **Código afectado**: `src/main.jsx` (proveedor de datos), `src/services/` (capa de acceso a
  datos), `src/pages/Clients.tsx`, `src/pages/Dashboard.tsx` (~1065 líneas),
  `src/pages/Payments.tsx` (~648 líneas), `src/pages/Attendance.tsx`;
  `src/auth/AuthContext.tsx` (se elimina), `src/auth/ProtectedRoute.tsx`,
  `src/components/ProtectedRoute.tsx`, `src/App.jsx`, `src/components/{Sidebar,Topbar,Footer}.tsx`,
  `src/pages/{Login,RegisterClient,Home,Routines,Settings}.tsx` y `src/lib/http.ts` (pasan a leer
  la sesión del store), `src/lib/theme.ts` y los emisores/escuchas del evento de ajustes.
- **Tests (restricción dura)**: `src/test/renderWithProviders.tsx` debe envolver también en el
  proveedor de datos; los tests existentes (`Dashboard`, `Login`, `RegisterClient`, `Settings`)
  y su mock (`vi.mock("@/lib/http")` + `src/test/apiMock.ts`) deben seguir pasando sin
  reescribirse. `make test-frontend` y `make test` en verde son criterio de aceptación.
- **Documentación**: `frontend/AGENTS.md` debe describir el patrón nuevo, para que las vistas que
  quedan fuera de alcance se migren igual y las nuevas nazcan con él.
- **Riesgo**: la mayor parte del cambio se concentra en Dashboard y Pagos, las dos vistas más
  largas del repo; la migración se hace vista por vista para acotar el blast radius.
