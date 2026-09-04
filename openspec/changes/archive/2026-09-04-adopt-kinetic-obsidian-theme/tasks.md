## 1. Backend: columna del usuario, migración y contrato

Va primero por el orden de deploy de `design.md` (Migration Plan): el backend es aditivo y no
afecta al frontend viejo, y el frontend nuevo necesita el campo para leer/escribir.

- [x] 1.1 `backend/app/models.py`: agregar `theme_preference = Column(String, nullable=True)` a la
      clase `User` (líneas 17-27). Sin server default: `NULL` significa "nunca eligió" (dec. 6.1).
- [x] 1.2 Generar la migración con `python -m alembic revision --autogenerate -m "add theme
      preference to users"` (dentro de `backend/`, venv activado) y **revisarla a mano**: el
      archivo final tiene que quedar solo con `op.add_column("users", sa.Column(
      "theme_preference", sa.String(length=30), nullable=True))` en `upgrade()` y el
      `op.drop_column` en `downgrade()`; borrar cualquier diff que el autogenerate arrastre de
      otros modelos (largos de `String`, el `Enum` de `UserRole`, índices). Encadenada al head
      actual; no editar `e4d5f6a7b8c9` ni ninguna migración ya aplicada.
- [x] 1.3 Aplicar con `make migrate` y verificar que la columna existe y que `GET /settings` y
      `GET /auth/me` siguen respondiendo 200 (nada de datos por migrar: todas las filas quedan en
      `NULL`).
- [x] 1.4 `backend/app/schemas.py`: agregar `ThemeMode = Literal["dark", "light"]` (al lado de
      `Role`), `theme_preference: Optional[ThemeMode] = None` **solo en `UserOut`** (no en
      `UserBase`, para que `UserCreate`/`UserUpdate` no abran una segunda vía de escritura) y
      `ThemeModeIn` con el único campo `theme_preference: ThemeMode` requerido. No tocar el
      `ThemePreference` viejo de `Settings`/`app_settings` (dec. 6.3 y 6.5).
- [x] 1.5 `backend/app/routers/auth.py`: agregar `PATCH /auth/me/theme` al lado de `me()`, con
      `payload: schemas.ThemeModeIn`, `user: models.User = Depends(get_current_user)` y
      `response_model=schemas.UserOut`. Sin parámetro de `user_id` y sin guard de rol: que cada
      usuario solo pueda tocar el suyo tiene que salir de `get_current_user`, no de un chequeo
      extra (dec. 6.4).
- [x] 1.6 Tests de backend nuevos en `backend/tests/` (hoy no hay ninguno que asserte el cuerpo de
      `/auth/me`): (a) `GET /auth/me` incluye `theme_preference` y devuelve `null` para un usuario
      nuevo; (b) `PATCH /auth/me/theme` con `{"theme_preference": "light"}` responde 200 y un `GET`
      posterior lo devuelve; (c) con `"dark-gold"` u otro valor responde 422; (d) sin token
      responde 401; (e) **aislamiento**: con dos usuarios, el `PATCH` de uno no cambia el valor del
      otro.
- [x] 1.7 `make test-backend` en verde.

## 2. Frontend: capa de tokens Kinetic Obsidian (sin tocar todavía ninguna vista)

Esta fase se puede revisar sola: al terminarla, el modo dark tiene que verse **igual que hoy** y
nada de la UI debe haber cambiado de lugar.

- [x] 2.1 Agregar `@fontsource-variable/plus-jakarta-sans` y `@fontsource-variable/inter`, con un
      único import en `src/index.css` (dec. 9).
- [x] 2.2 `src/index.css`, `@layer base`: definir el juego completo de CSS vars semánticas para los
      dos modos — `:root` (dark) y `:root[data-theme="light"]` (Crisp Slate) — con los valores
      literales de `docs/design/design.md`: `--canvas`, `--surface-1|2|3`, `--foreground`,
      `--muted-foreground`, `--primary`, `--on-primary`, `--primary-strong`, `--border-hairline`,
      `--ring`, `--destructive`, `--shadow-level-2`, `--hero-aura`.
- [x] 2.3 Agregar el bloque `@theme inline` que mapea esas vars a tokens de Tailwind: colores
      semánticos (`--color-canvas`, `--color-surface-1|2|3`, `--color-foreground`,
      `--color-muted-foreground`, `--color-primary`, `--color-on-primary`, `--color-border`,
      `--color-ring`), tipografía (`--font-display` Plus Jakarta Sans, `--font-ui` Inter, y los
      `--text-headline-hero|headline-lg|headline-md|metric-kpi|body-*|label-caps|label-code` con su
      `line-height`/`letter-spacing`), radios (`sm|DEFAULT|md|lg|xl|full`) y espaciados
      (`--spacing-sidebar: 240px`, `--spacing-gutter: 1.25rem`, `--container-app: 1600px`).
      `metric-kpi` con `font-variant-numeric: tabular-nums` (dec. 3).
- [x] 2.4 En el mismo `@theme inline`, definir los nombres del contrato shadcn apuntando a las
      mismas vars (`background`, `foreground`, `card`, `card-foreground`, `popover`, `primary`,
      `primary-foreground`, `secondary`, `muted`, `muted-foreground`, `accent`, `destructive`,
      `border`, `input`, `ring`, `--radius`), que es lo que revive los tokens hoy muertos de
      `src/components/ui/**`.
- [x] 2.5 Declarar `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))`
      para que las utilidades `dark:*` que ya existen en `ui/**` (p. ej. `dark:bg-input/30` en
      `input.tsx`) sigan significando "modo dark" (dec. 2).
- [x] 2.6 Sacar el `color-scheme: dark` hardcodeado de `:root` (pasa a aplicarse por modo desde
      `applyThemeMode`, tarea 3.1) y reemplazar los `rgba(24,24,27,.7)` de los dos bloques de
      autofill por la var de superficie, para que el autofill no quede oscuro en light mode.
- [x] 2.7 Reimplementar sobre los tokens nuevos el cuerpo de las utilidades existentes, **sin
      cambiarles el nombre** (`surface-panel`, `warm-glow`, `warm-border`, `warm-accent-text`,
      `warm-accent-bg`, `app-shell-bg`, `app-main-shell-bg`, `warm-scrollbar`,
      `subtle-scrollbar`), incluyendo hairline border por modo, sombra Level 2 y el `hero-aura`
      radial. Borrar los overrides `:root[data-theme="dark-copper"|"dark-olive"]` y la clase
      `theme-chip` (dec. 10).
- [x] 2.8 `npm run build` sin errores y chequeo visual de que el modo dark quedó igual que antes de
      esta fase (baseline de regresión).

## 3. Frontend: el modo de tema y su fuente (la sesión del usuario)

- [x] 3.1 Reescribir `src/lib/theme.ts` como módulo puro: `export type ThemeMode = "dark" |
      "light"`, `THEME_MODES` (id + label + description para el copy), `DEFAULT_THEME_MODE =
      "dark"`, `isThemeMode`, `normalizeThemeMode` (los 3 ids legacy, `null`, vacío y basura →
      `"dark"`) y `applyThemeMode(mode)` (setea `data-theme` **y** `color-scheme` en el
      `documentElement`, sin tocar `localStorage`). Eliminar `AppThemeId`, `APP_THEMES`,
      `AppThemeDefinition`, `DEFAULT_THEME_ID`, `isAppThemeId`, `getStoredTheme` y `applyTheme`.
- [x] 3.2 Crear `src/stores/theme.ts`: `useThemeStore` con `{ mode, setMode }`, `persist` sobre la
      clave plana existente `app_theme` (mismo patrón de `PersistStorage` a medida que
      `session.ts`/`settings.ts`, valor plano sin envoltorio `{state,version}`), apply sincrónico
      en el scope del módulo y `subscribeWithSelector` para los cambios posteriores. Precedencia de
      arranque: `app_theme` → `app_settings.theme_preference` (lectura legacy de un solo tiro) →
      `"dark"` (dec. 5 y 7).
- [x] 3.3 Importar `stores/theme.ts` desde `src/main.jsx` antes del `createRoot`, para que el apply
      de import-time corra siempre.
- [x] 3.4 `src/stores/settings.ts`: eliminar `themeFromSettings`, el `applyTheme` de import y la
      suscripción de tema. El tema desaparece del store de ajustes.
- [x] 3.5 `frontend/index.html`: agregar el `<script>` inline de pre-paint en el `<head>`, antes
      del bundle, que lee `app_theme`, aplica el mismo mapeo de ids legacy y setea `data-theme` +
      `color-scheme` en el `<html>`. Comentario que apunta a `lib/theme.ts` como fuente de verdad
      (dec. 8).
- [x] 3.6 Crear `src/services/me.ts` con los fetchers puros `fetchMe()` y `updateMyTheme(mode)`
      (`PATCH /auth/me/theme`), usando el **default export** de `@/lib/http`; y agregar
      `queryKeys.me` en `src/services/queryKeys.ts`.
- [x] 3.7 Crear `src/services/me.queries.ts` con `useMeQuery()` (`enabled: !!token`),
      `useUpdateMyThemeMutation()` y `useSyncUserTheme()`, que empuja
      `normalizeThemeMode(data.theme_preference)` al store de tema (`null` → `"dark"`, no la caché
      local).
- [x] 3.8 `src/App.jsx`: montar `useSyncUserTheme()` una sola vez, al lado de `useSyncSettings()`
      (no dentro de `Topbar`, para no obligar a los tests de vista a mockear `/auth/me`), y pasar
      el modo del store al `<Toaster theme={...}>` de la línea 52, que hoy está hardcodeado en
      `"dark"`.
- [x] 3.9 `src/pages/Login.tsx` y `src/pages/RegisterClient.tsx`: agregar `theme_preference` al
      tipo de la respuesta de `/auth/me` que ya piden, y empujarlo al store de tema en el mismo
      punto donde llaman a `setSession`.
- [x] 3.10 `src/services/settings.queries.ts`: dejar el descarte de `theme_preference` en
      `useSyncSettings` pero actualizar el comentario — la razón ya no es "solo este dispositivo",
      es que el campo de `app_settings` quedó legacy sin uso (dec. 5.1 y 6.5).
- [x] 3.11 `src/pages/Settings.tsx`: eliminar la card "Tema visual" completa (el
      `APP_THEMES.map(...)`, `handleThemeChange`, el estado `themeId` y los imports de
      `lib/theme`), excluir `theme_preference` del payload del `PUT` en `save()`, y sacar las
      hidrataciones de tema del `useEffect` inicial. La card se elimina, no se deja vacía (la spec
      de `settings-view` exige que cada card de la columna tenga acción real).
- [x] 3.12 `src/types.ts`: dejar `AppSettings.theme_preference` como campo legacy deprecado (tipo
      laxo + comentario de deprecación) y actualizar los defaults hardcodeados de
      `stores/settings.ts` y `pages/Settings.tsx` para que no mencionen `"dark-gold"` como si fuera
      un tema vigente.
- [x] 3.13 `src/components/Topbar.tsx`: agregar el toggle de modo en los **dos** call sites — el
      cluster de escritorio (`hidden ... lg:flex`) y el panel desplegable de mobile, **fuera** del
      `if` de `role === "user"` para que lo vean los tres roles. `Button variant="outline"
      size="icon"` con `Sun`/`Moon` de `lucide-react`, `aria-label` que nombra la acción y
      `aria-pressed`. Al click: `setMode` (aplica al instante + cachea) +
      `useUpdateMyThemeMutation`; si el `PATCH` falla, el modo queda aplicado y el error se avisa
      con `alertError`, sin rollback visual (dec. 7 y 11).
- [x] 3.14 `src/stores/session.ts`: agregar `email: string | null` a `SessionState`. `TokenPayload`
      ya declara `email?`, así que alcanza con (a) guardarlo en `setSession` desde el payload
      decodificado, (b) aceptarlo en el parámetro `over` para que `Login.tsx`/`RegisterClient.tsx`
      pasen el valor de `/auth/me` como ya hacen con `name`/`role`, y (c) recalcularlo del token en
      `sessionPersistStorage.getItem`, igual que `exp`. **Sin clave nueva en `localStorage`** y sin
      migración de sesiones (dec. 12).

## 4. Frontend: aplicar la identidad visual, por capas

Cada subtarea se cierra chequeando la vista en **los dos modos**. La tabla de mapeo
(`zinc-*`/`amber-*` → tokens) es la de la dec. 4 de `design.md`; no re-decidir el mapeo por
archivo.

- [x] 4.1 Shell: `App.jsx`, `components/Sidebar.tsx`, `components/Topbar.tsx`,
      `components/Footer.tsx`. Incluye pasar el offset del sidebar al token de 240px
      (`lg:pl-64`/`w-64` → `lg:pl-sidebar`/`w-sidebar`) y el `bg-zinc-950` del `<main>` de las
      rutas de auth.
- [x] 4.2 `components/Sidebar.tsx`, pie del rail: **reemplazar** la `<section>` "Contexto" (líneas
      105-119: eyebrow, `Vista {roleLabel(role)}` y el párrafo de dos variantes) por (a) un
      badge/pill `rounded-full` con punto de estado y el rol en `label-caps` — mayúsculas por CSS
      (`uppercase`), dejando el `textContent` como `Vista Dueño`/`Vista Coach`/`Vista Usuario` — y
      (b) debajo, una card compacta de identidad con avatar/ícono circular, `userName` y `email`
      del store de sesión, con `truncate` + `title` porque el rail son 240px fijos. Si no hay
      email, no se renderiza esa fila. Composición nueva, con los tokens de la fase 2 (dec. 12).
      Depende de 3.14.
- [x] 4.3 Dashboard: hero operativo (badge `CENTRO OPERATIVO`, aura radial, quick actions) y KPI
      cards (label `label-caps`, número `metric-kpi`, contenedor circular del ícono, hover con
      `translateY(-2px)` y borde ámbar).
- [x] 4.4 Componentes transversales de datos y formularios: `src/components/ui/**` donde haga falta
      un ajuste explícito, más `Pagination.tsx`, `DataError.tsx`, `LastPayments.tsx`,
      `AttendanceCalendar.tsx`, `EditClientDialog.tsx`, `NewPaymentDialog.tsx`,
      `SpotlightSearch.tsx`, `UserCard.tsx` (tablas con divisores hairline, headers `label-caps`,
      focus ring de 2px en inputs, botones primario/ghost/destructivo).
- [x] 4.5 Vistas restantes, en orden de volumen: `Routines.tsx`, `Settings.tsx`, `Reports.tsx`,
      `Payments.tsx`, `NewCoach.tsx`, `Clients.tsx`, `Attendance.tsx`, `UserRoutine.tsx`,
      `RegisterClient.tsx`, `Login.tsx`, `Home.tsx`. Las tres últimas van solo al pase de tokens
      (legibilidad en light mode), sin rediseño.
- [x] 4.6 Gate: `grep -rE '\b(zinc|amber|orange|lime)-[0-9]{2,3}\b' frontend/src --include='*.tsx'
      --include='*.jsx'` devuelve **0** resultados (el único lugar con color crudo es `index.css`).
- [x] 4.7 Pase de contraste en light mode: verificar que el ámbar de texto/acento usa el
      `--primary` del modo claro (`#D97706`, no `#F59E0B`) y que el texto sobre relleno ámbar usa
      `--on-primary`, nunca blanco.

## 5. Tests de frontend

- [x] 5.1 `src/test/setup.ts`: resetear el store de tema en el `afterEach` y rehidratarlo en el
      `beforeEach`, igual que los otros dos; `src/test/renderWithProviders.tsx`: agregar la
      rehidratación del tercer store antes de renderizar.
- [x] 5.2 Test unitario de `normalizeThemeMode`: los 3 ids legacy, `null`, string vacío y un valor
      basura resuelven a `"dark"`; `"dark"`/`"light"` pasan tal cual.
- [x] 5.3 Test del toggle en `Topbar`: el click cambia `data-theme` del `documentElement`, persiste
      en `app_theme` y dispara el `PATCH` (resuelto por ruta con el helper `src/test/apiMock.ts`).
      Sembrar `localStorage` en el `beforeEach` propio del archivo, nunca dentro del `it`.
- [x] 5.4 `src/pages/__tests__/Login.test.tsx`: el mock de `/auth/me` devuelve también
      `theme_preference` (y el caso `null` no rompe).
- [x] 5.5 `Settings.test.tsx` sigue en verde tras eliminar la card de tema (no asserta nada sobre
      paletas hoy; confirmar que no quedó un query colgado).
- [x] 5.6 `src/components/__tests__/Sidebar.test.tsx`: reemplazar las dos aserciones de
      `getByText("Contexto")` por el badge de rol y la card de identidad (nombre + email); las de
      `"Vista Dueño"`/`"Vista Coach"` tienen que seguir pasando, porque las mayúsculas son por CSS.
      Sembrar `user_name` y un `access_token` con claim `email` en el `beforeEach` propio del
      archivo.
- [x] 5.7 `make test-frontend` y `npm run lint` en verde.

## 6. Documentación

- [x] 6.1 `frontend/AGENTS.md`: (a) pasan a ser **tres** stores (`session`, `settings`, `theme`) y
      el tema deja de vivir en `settings.ts`; (b) borrar/reescribir la nota "Tokens de shadcn sin
      `@theme`", que queda obsoleta porque este change agrega el bloque; (c) documentar que el
      toggle de modo vive en `Topbar` y que la preferencia es del usuario (`/auth/me` +
      `PATCH /auth/me/theme`); (d) sumar los tests nuevos a la lista de cobertura.
- [x] 6.2 `backend/AGENTS.md`: sumar los tests nuevos de `/auth/me` y `PATCH /auth/me/theme` a la
      sección de Tests (la regla del repo pide documentar tests nuevos en el `AGENTS.md` de la
      app).

## 7. Verificación end-to-end (checklist del Migration Plan)

- [x] 7.1 `GET /auth/me` responde 200 con `theme_preference: null` para un usuario que nunca eligió,
      y la app se ve en dark.
- [x] 7.2 Con `app_theme="dark-copper"` sembrado a mano en `localStorage`: la app arranca en dark,
      sin flash y sin error.
- [x] 7.3 Togglear a light desde el top bar: cambia al instante en toda la pantalla (sidebar, barra
      superior, contenido) sin recargar, y el `PATCH /auth/me/theme` responde 200.
- [x] 7.4 Recargar: sigue en light desde el primer render, sin destello del modo anterior.
- [x] 7.5 Mismo usuario en otro navegador/dispositivo: ve light sin haber tocado nada ahí (el
      escenario que justifica el cambio de backend).
- [x] 7.6 Dos usuarios distintos, cada uno con su modo: el cambio de uno no altera lo que ve el
      otro. Loguear a un segundo usuario en el mismo navegador muestra **su** modo, no el del
      anterior.
- [x] 7.7 Rol cliente (`/my-routine`): encuentra y usa el toggle sin pasar por Ajustes.
- [x] 7.8 `/settings` no ofrece ningún control de tema y "Guardar cambios" sigue respondiendo 200
      (`PUT /settings` ya sin `theme_preference` en el payload).
- [x] 7.9 Pie del Sidebar en los tres roles y en los dos modos: el badge dice el rol correcto y la
      card de identidad muestra nombre + email del usuario logueado, truncado sin desbordar los
      240px. Al recargar (sin pasar por el login) el email sigue estando, porque sale del token.
