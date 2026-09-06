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
  hooks/            # custom hooks (useDebounce, useDashboardData, useLegacyRefetchBridge, useSignIn)
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
  auth.ts                    # fetchers puros del login: requestToken (con reintento), fetchMeWithToken, signIn
  routineTemplates.ts         # fetchers de plantillas, base del catálogo y asignaciones (ver "Rutinas" abajo)
  routineTemplates.queries.ts # hooks de esos fetchers, incluido el autosave del chip de estrategia
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
- **Login: un único camino.** `services/auth.ts` (red: `requestToken` con el reintento único ante
  timeout, `fetchMeWithToken` con `Authorization` explícito porque el store todavía no tiene el
  token, y `signIn` que compone las dos y devuelve `{ accessToken, me }`) + `hooks/useSignIn.ts`
  (efectos, en este orden fijo: red → `logout()` opcional → `setSession` → `setThemeMode` →
  `navigate("/")`, que cae en el `<Navigate>` por rol de `App.jsx`). `pages/Login.tsx` y el widget
  de desarrollo lo usan; **no dupliques la secuencia** en otra vista — si el login suma un paso, va
  ahí. Primero la red y después el switch de sesión: un login fallido deja la sesión anterior
  intacta (dec. 4 de `add-dev-role-switcher`). Los errores se propagan; el llamador decide el
  mensaje.
- **Widget de cambio de rol (solo desarrollo)**: `components/dev/DevRoleSwitcher.tsx` +
  `components/dev/devUsers.ts` (capability `dev-role-switcher`). Card flotante abajo a la derecha
  (`fixed bottom-4 right-4 z-50`, visible también en `/login`) que loguea con un click como uno de
  los tres usuarios fijos de `make seed-dev` (Dueño / Coach / Miembro, ver tabla en el
  `AGENTS.md` raíz) vía `useSignIn` con `resetPreviousSession: true`. Reglas que no se negocian:
  - **Ausente del bundle de producción, no oculto.** `App.jsx` lo monta con un ternario
    `import.meta.env.DEV ? lazy(() => import(...)) : null` **a nivel de módulo**: Vite reemplaza
    `DEV` por `false` antes de que Rollup optimice, el `import()` queda inalcanzable y el chunk no
    se emite. Un `lazy()` incondicional con guarda en el render **no** sirve (el chunk sobrevive
    al build). La prueba es mecánica: tras `npm run build`, `grep -r -e "dev-role-switcher" -e
    "dev.owner@miniespacio.local" -e "devdev123" dist/` tiene que dar cero coincidencias.
  - **Una sola importación entrante a `components/dev/**`**: el `import()` de `App.jsx`. Un test
    fuera de esa carpeta que importe el widget, un barril que lo reexporte o una constante
    "compartida" lo devuelven al grafo de producción con las credenciales adentro. Chequeo:
    `grep -rn "components/dev" src --include="*.ts" --include="*.tsx" --include="*.jsx"` debe
    listar solo `App.jsx` (y comentarios dentro de la propia carpeta). Por eso `devUsers.ts` es la
    única definición de credenciales del lado frontend, y la del backend
    (`backend/scripts/seed_dev_users.py`) está duplicada a propósito.
  - **El colapsado va en `localStorage["dev_role_switcher_collapsed"]` (`"1"`/`"0"`), no en un
    store**: los stores del repo siguen siendo tres, y un store viviría en `src/stores/` — fuera
    de `components/dev/`, rompiendo el invariante anterior. Lectura con inicializador lazy de
    `useState` y escritura en el toggle, ambas en `try/catch` (storage bloqueado ⇒ siempre
    expandido, nunca romper el render).
  - Errores inline con `role="alert"`, no toast: 400/401 de `/auth/token` ⇒ "Usuario de desarrollo
    no encontrado. Corré `make seed-dev`…"; el resto ⇒ mensaje genérico de backend caído. Un
    fallo no toca la sesión previa.
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
  (`/users/:id`, fuera de `routePreload.ts` como `NewCoach`: no tiene entrada en el Sidebar).
  `components/EditUserDialog.tsx` es **solo** el formulario de perfil (nombre, apellido, fecha de
  nacimiento, peso, altura, email, teléfono y, si edita un Dueño, el rol) con su botón "Guardar
  cambios" — no dispara ninguna otra mutación (`move-user-actions-to-detail`: las acciones de
  membresía, invitación y verificación de contacto que antes vivían acá se movieron a la ficha).
  `pages/UserDetail.tsx` es la ficha: perfil (con badge de verificación de email/teléfono —
  `Verificado` neutro con `BadgeCheck`, `Sin verificar` en ámbar, sin botón por fila — `move-user-
  actions-to-detail`, rework: es un badge puramente presentacional; la acción vive una sola vez en
  el footer de la card) con el botón único "Verificar contacto" en el `CardFooter`, visible solo
  si `canManage` y queda algún dato cargado sin verificar (`hasPendingContact`, espejo de la regla
  del backend), membresía (botón único en el footer de la card según `membership_status`) e
  invitación al portal (botón "Invitar"/"Reenviar invitación" si `canManage` y el acceso no está
  activo), cada acción detrás de un modal — no hay acción de eliminar, la única baja posible es la
  de membresía. `canManage` sale de `lib/permissions.ts::canManageUser(viewerRole, targetRole)`,
  espejo en frontend de `require_can_manage_user` (Dueño gestiona cualquier rol, Coach solo
  Miembros) — **oculta**, no deshabilita, las acciones cuando el viewer no puede gestionar a ese
  usuario. Los modales nuevos: `components/ConfirmActionDialog.tsx` (base presentacional sin
  mutaciones: `title`/`description`/`confirmLabel`/`onConfirm`/slot `children`),
  `CancelMembershipDialog.tsx` (fecha de baja opcional) y `ActivateMembershipDialog.tsx` sobre esa
  base, `VerifyContactDialog.tsx` (sin prop `channel`: deriva adentro la lista de datos pendientes
  con el mismo criterio del backend y arma el copy dinámico — "el email"/"el celular"/"el email y
  el celular" — más una advertencia condicional si el email está pendiente y el usuario ya tiene
  acceso activo, `useVerifyContactMutation`) también sobre esa base, e `InviteUserDialog.tsx`
  (`Dialog` propio: dos fases, muestra el link de email con copiar y el botón de WhatsApp —
  deshabilitado sin celular cargado — desde que abre, vacíos hasta que hay resultado; el error de
  precondición 400 va inline con `role="alert"`, no toast). `UserDetail` guarda un único estado
  `action` (no cinco booleanos) y monta cada modal condicionalmente.
  `services/users.ts`/`users.queries.ts` exponen `verifyUserContact(id)` (sin canal, `POST
  /users/{id}/contact/verify`) y `useVerifyContactMutation()` (`mutationFn: (id: string) =>
  ...`), único consumidor `VerifyContactDialog`. `pages/InvitationAccept.tsx`
  (`/invitacion/:channel/:token`, ruta pública) es
  donde un Miembro invitado verifica sus dos canales y define su contraseña; reemplaza al viejo
  `/register-client` (retirado, ya no hay auto-registro).
- **Rutinas** (`add-routine-templates`): `pages/Routines.tsx` (`/routines`, owner/coach) es el
  listado de plantillas de rutina, migrado al patrón "list page" igual que `Users.tsx` pero sin
  buscador ni paginación (son unidades, no cientos) — columnas Nombre, Etiqueta (`Badge`), Días,
  Miembros y la acción "Ver" que navega a `pages/RoutineTemplateDetail.tsx` (`/routines/:templateId`,
  fuera de `routePreload.ts` como `UserDetail`: no se navega desde el sidebar). El botón "Crear
  plantilla" abre `components/CreateRoutineTemplateDialog.tsx` (nombre, etiqueta y selección
  múltiple de días, mandados siempre en el orden natural del catálogo — `day_order` — no en el
  orden de click). El detalle sigue el patrón de `UserDetail.tsx` (hero con "Volver a Rutinas",
  "Editar"/"Eliminar") y una `Card` por día con, por ejercicio: su base (editable solo para Dueño
  vía `components/EditExerciseBaseDialog.tsx`, espejo de `require_role(owner)` del endpoint que
  reusa), un `Switch` de activo/inactivo, `components/StrategyChips.tsx` (las cinco estrategias) y
  `components/PlannedSetsList.tsx` (el plan de series, solo lectura). El toggle y los chips son
  **autosave**: la mutación de `useUpdateTemplateExerciseMutation` escribe la respuesta del backend
  (que ya trae el plan recalculado) con `setQueryData`, sin refetch — no hay botón "Guardar" ni
  ninguna fórmula de progresión en `frontend/src/**` (esa cuenta es enteramente del backend).
  `components/EditRoutineTemplateDialog.tsx` y `components/DeleteRoutineTemplateDialog.tsx`
  (esta última sobre `ConfirmActionDialog`, `destructive`) completan el CRUD; el 409 de nombre
  duplicado o de borrado con asignaciones vigentes se muestra tal cual lo redacta el backend.
  La asignación de plantillas a un Miembro vive en su ficha:
  `components/MemberTemplatesCard.tsx` (montada desde `pages/UserDetail.tsx` con un único bloque
  `import` + render condicionado a `isMemberRole`, sin tocar nada más de ese archivo) lista sus
  asignaciones con badge Activa/Alternativa y la autoría del último ajuste de base
  ("Sin ajustes"/"Ajustada por X el dd/mm"), y monta — todas sobre `ConfirmActionDialog`, y **solo
  cuando están abiertas** (nunca con el componente montado y `open={false}`: un `<dialog>` siempre
  presente en el árbol hace que `getByRole("dialog", { hidden: true })` de otro modal abierto en
  simultáneo encuentre dos elementos) — `components/AssignTemplateDialog.tsx`,
  `components/RemoveAssignmentDialog.tsx` y `components/AdjustExerciseBaseDialog.tsx`. El botón
  "+ Asignar plantilla" solo se ofrece con `canManageUser(...)` **y** `membership_status ===
  "active"`; la lista de asignaciones sigue completa aunque la membresía esté dada de baja (la
  regla de membresía activa solo condiciona el alta, nunca oculta lo ya asignado). `pages/
  UserRoutine.tsx` (`/my-routine`, member) es la vista de solo lectura del cliente: elige entre sus
  plantillas asignadas (`useMyTemplatesQuery`), navega los días de la elegida
  (`useMyTemplateQuery`) y muestra `PlannedSetsList` por ejercicio activo — mismo componente que el
  detalle de plantilla, así el plan se ve igual del lado del coach y del cliente. Sin ninguna
  acción de marcar serie como hecha (spec `member-routine-view`, fuera de alcance). Tests:
  `pages/__tests__/Routines.test.tsx`, `pages/__tests__/RoutineTemplateDetail.test.tsx`,
  `pages/__tests__/UserRoutine.test.tsx` y `components/__tests__/MemberTemplatesCard.test.tsx`.
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
    de identidad, y el rename de nav "Clientes" -> "Usuarios"). Suma de
    `move-user-actions-to-detail`: `components/__tests__/EditUserDialog.test.tsx` (sin acciones de
    membresía ni de invitación, y que "Guardar cambios" solo llama `api.patch` — ningún
    `api.post`); `pages/__tests__/UserDetail.test.tsx` suma el badge de verificación de contacto
    (`Verificado`/`Sin verificar` por dato, sin botón por fila), el botón único "Verificar
    contacto" en el footer de la card Perfil (ofrecido con un dato cargado sin verificar, ausente
    con ambos verificados o sin ningún dato cargado), que confirmarlo dispara `api.post` a
    `/users/{id}/contact/verify` y la ficha refleja los dos badges en "Verificado" tras el
    refetch, y que cancelar el modal no dispara ninguna mutación; las acciones de membresía por
    modal (baja con fecha — afirmando el valor concreto de `cancelled_at` enviado, no
    `expect.anything()` —, cancelar no dispara nada, activar cuando nunca hubo membresía,
    reactivar cuando está dada de baja), la invitación por modal (link de email + copiar,
    WhatsApp deshabilitado sin celular, error de precondición inline, sin acción con acceso
    activo) y que un Coach no ve ninguna acción de gestión en la ficha de otro Coach — ni
    membresía, ni invitación, ni "Verificar contacto" — (`seedRole` sembrando `access_token` +
    `user_role` en `localStorage`, patrón de `Sidebar.test.tsx`). `RegisterClient` ya no tiene test de
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
    `--text-*` que declara ese archivo). Suma de `add-dev-role-switcher`:
    `components/dev/__tests__/DevRoleSwitcher.test.tsx` (las tres opciones Dueño/Coach/Miembro;
    colapsar escribe `dev_role_switcher_collapsed` y con la key sembrada en el `beforeEach` monta
    colapsado; con `/auth/token` en 400 muestra el mensaje con `make seed-dev` y
    `useSessionStore.getState().token` sigue siendo el sembrado; con `/auth/token` pendiente las
    tres opciones quedan `disabled`, la elegida con `aria-busy`, y un segundo click no dispara
    otro `POST`) y `components/__tests__/App.devSwitcher.test.tsx` (`vi.stubEnv("DEV", true|false)`
    + `vi.resetModules()` + `await import("@/App")`: con `true` aparece el widget, con `false` no
    aparece ni ninguno de los tres labels — simula el modo, **no** ejecuta el build).
    `Login.test.tsx` no se tocó en ese change: que siga verde tras el refactor a `useSignIn` es la
    prueba de no-regresión del login. `components/ui/popover.tsx` (`Popover`,
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
    estilos computados. Suma de `add-routine-templates`: `pages/__tests__/Routines.test.tsx`
    (columnas de plantilla, click en "Ver" navega al detalle, 409 de nombre duplicado mostrado
    inline en `CreateRoutineTemplateDialog`), `pages/__tests__/RoutineTemplateDetail.test.tsx`
    (solo los días de la plantilla, un chip de estrategia dispara el autosave y el plan mostrado
    ya viene recalculado del backend — sin refetch —, confirmación antes de eliminar),
    `pages/__tests__/UserRoutine.test.tsx` (elegir entre plantillas asignadas, aviso sin
    asignaciones, plan de solo lectura sin ninguna acción de marcar serie) y
    `components/__tests__/MemberTemplatesCard.test.tsx` (estado Activa/Alternativa y autoría del
    ajuste, "+ Asignar plantilla" oculto sin membresía activa pero la lista de asignaciones sigue
    completa, confirmación antes de quitar una asignación). Los cuatro mockean
    `services/routineTemplates.ts` vía `vi.mock("@/lib/http")` (patrón `apiMock.ts`), sin backend.
    Los diálogos siempre montados condicionalmente (nunca `open={false}` con el componente
    presente) evitan que `getByRole("dialog", { hidden: true })` encuentre más de un `<dialog>` —
    ver la nota de `MemberTemplatesCard.tsx` en "Rutinas" arriba.
