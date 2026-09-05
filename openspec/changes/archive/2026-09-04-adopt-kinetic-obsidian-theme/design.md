## Context

Motivación y alcance: ver [proposal.md](proposal.md). Fuente de verdad visual:
[docs/design/design.md](../../../docs/design/design.md). Este documento decide el **cómo**.

Estado actual del tema en el frontend (relevado con CodeGraph + lectura dirigida):

- **`frontend/src/lib/theme.ts`**: `AppThemeId = "dark-gold" | "dark-copper" | "dark-olive"`,
  `APP_THEMES` (metadata + swatch de preview), `DEFAULT_THEME_ID`, `isAppThemeId`,
  `getStoredTheme()` (lee `localStorage["app_theme"]`) y `applyTheme(id)` (escribe
  `document.documentElement.dataset.theme` **y** `localStorage["app_theme"]`).
- **`frontend/src/stores/settings.ts`**: la fuente de verdad del tema hoy es
  `settings.theme_preference` dentro del store de ajustes — es decir, **configuración del negocio**
  (`app_settings` es una fila única). En el módulo (líneas 99-103) se aplica el tema de forma
  sincrónica al importar + `subscribeWithSelector` para los cambios posteriores. El
  `PersistStorage` a medida serializa **solo el objeto `AppSettings`** en la clave plana
  `app_settings` (shim de compatibilidad, dec. 8 de `adopt-tanstack-query-zustand`).
- **`frontend/src/stores/session.ts`**: `token`/`userName`/`role`/`exp` con `PersistStorage` sobre
  las claves planas `access_token`/`user_name`/`user_role`; `setSession(token, over?)` acepta
  `{name, role}` de `/auth/me` y, si falta, los deriva del JWT. **No guarda nada más del usuario.**
- **`/auth/me` se llama solo al loguearse**, en `pages/Login.tsx:61` y
  `pages/RegisterClient.tsx:47` (con el `Authorization` explícito, porque el store todavía no tiene
  el token). En un F5 **no hay llamada a `/auth/me`**: el store rehidrata de `localStorage` y
  decodifica el JWT. Hoy no existe ninguna query de TanStack sobre el usuario.
- **`frontend/src/App.jsx`**: `Topbar` + `Sidebar` se montan **solo fuera** de `/login` y
  `/register-client` (`!isAuthRoute`, líneas 54-58); las rutas de auth usan un `<main>` propio con
  `bg-zinc-950`. Además el `<Toaster theme="dark">` (línea 52) está hardcodeado.
- **`frontend/src/components/Sidebar.tsx`**: rail `fixed` con plaqueta de marca, links filtrados
  por rol y, al pie (líneas 105-119), una `<section>` "Contexto" con `Vista {roleLabel(role)}` y un
  párrafo descriptivo de dos variantes. No muestra ningún dato del usuario logueado.
- **`frontend/src/components/Topbar.tsx`**: barra `sticky` con logo, buscador global (oculto para
  `role === "user"`), botón "Nuevo cliente" (solo `owner`), Logout y, en mobile, un panel
  desplegable con ramas separadas para `role === "user"` y el resto. Es el único componente del
  shell que ven los **tres** roles.
- **`frontend/src/pages/Settings.tsx`**: card "Tema visual" (líneas ~567-615) que mapea
  `APP_THEMES` a 3 botones con swatch; `handleThemeChange` aplica + persiste al toque (el tema es
  "solo este dispositivo"); `save()` manda `payload = { ...settings }`, o sea **incluye
  `theme_preference`** en el `PUT /settings`.
- **`frontend/src/services/settings.queries.ts`**: `useSyncSettings` ya **descarta**
  `theme_preference` de la respuesta del servidor (el tema es local al dispositivo).
- **`frontend/src/index.css`**: `@import "tailwindcss"` + `tw-animate-css`. **No hay bloque
  `@theme`** (confirmado): las variables son CSS vars a mano (`--theme-accent-*`,
  `--theme-body-*`, `--theme-shell-*`) en `:root`, con overrides por
  `:root[data-theme="dark-copper"]` / `[data-theme="dark-olive"]`, más 10 clases utilitarias
  (`surface-panel`, `warm-glow`, `warm-border`, `warm-accent-text`, `warm-accent-bg`,
  `app-shell-bg`, `app-main-shell-bg`, `theme-chip`, `warm-scrollbar`, `subtle-scrollbar`).
  `color-scheme: dark` está **hardcodeado** y el fix de autofill tiene `rgba(24,24,27,.7)` fijo.
- **Backend, tema de negocio (lo que existe hoy)**: `ThemePreference = Literal["dark-gold",
  "dark-copper", "dark-olive"]` (`backend/app/schemas.py:12`), usado por
  `SettingsBase.theme_preference` y `SettingsUpdate.theme_preference`; `put_settings` recibe
  `payload: Settings` y asigna todos los campos del `model_dump()`. En el ORM la columna es
  `theme_preference = Column(String, nullable=True)` (`backend/app/models.py:148`, tabla
  `app_settings`) y en la base es `VARCHAR(30)` con `'dark-gold'` seedeado
  (`migrations/versions/e4d5f6a7b8c9_*`).
- **Backend, usuario**: `models.User` (`models.py:17-27`) tiene `id`, `full_name`, `email`,
  `password_hash`, `email_verified`, `role`, `client_id`, `is_active`, `created_at` — **ninguna
  preferencia de UI**. `GET /auth/me` (`routers/auth.py:79`) devuelve `schemas.UserOut`
  (`UserBase` + `id` + `email_verified`) y su única dependencia es `get_current_user`
  (`app/auth.py:33`), que resuelve el usuario del `sub` del JWT. `UserUpdate` (schemas.py:36-42)
  incluye `role`, `is_active`, `password` y `client_id`.
- **Tests de backend**: `backend/tests/` cubre auth, roles, health e isolation; **no hay ningún
  test que toque `/settings`** ni que asserte el cuerpo de `/auth/me`.
- **Fuentes**: `frontend/index.html` no carga ninguna webfont; `body` usa `"Inter", system-ui`
  sin que Inter esté disponible realmente.

Blast radius medido:

- `codegraph impact applyTheme` → 6 símbolos, 3 archivos (`lib/theme.ts`, `stores/settings.ts`,
  `pages/Settings.tsx`). El *contrato* del tema es chico.
- El blast radius real está en los estilos: **~900 ocurrencias de `amber-*` / `zinc-*`
  hardcodeadas en 25 archivos** de `src/pages` y `src/components` (top: `Routines.tsx` 140,
  `Settings.tsx` 136, `Dashboard.tsx` 87, `Reports.tsx` 65, `Payments.tsx` 58, `NewCoach.tsx` 57),
  más 4 usos en `src/components/ui/**` (`input.tsx`).
- Las 10 clases utilitarias del `index.css` tienen solo **17 call sites** en 15 archivos: son un
  buen *seam* para concentrar el cambio.
- `src/components/ui/**` (16 componentes shadcn) referencia tokens (`border-input`, `ring-ring`,
  `text-muted-foreground`, `dark:bg-input/30`, `bg-primary`, …) que **hoy no generan CSS** porque
  falta el `@theme` (documentado en `frontend/AGENTS.md`).
- Backend (dec. 6): 3 archivos + 1 migración de schema — `app/models.py` (columna nueva en
  `User`), `app/schemas.py` (tipo `ThemeMode`, `UserOut`, schema de entrada) y
  `app/routers/auth.py` (endpoint nuevo). Es **aditivo**: no se angosta ningún `Literal` existente
  ni se toca `app_settings`.

Restricciones que este diseño no puede violar:

1. El escenario ya especificado en `app-settings-state` exige tema aplicado **desde el primer
   render, sin destello del tema anterior**.
2. `settings-view` exige que las cards de la columna de previsualización — hoy incluida "Tema
   visual" — tengan al menos un control de acción real.
3. La regla del repo: `useSettingsStore.setSettings` es el **único escritor** de `app_settings`;
   nadie escribe `localStorage` de ajustes a mano.
4. `backend/AGENTS.md`: cambio en `models.py` ⇒ migración Alembic nueva; no se editan migraciones
   ya aplicadas en producción.
5. Convención de datos del servidor: las llamadas van en `src/services/` desdoblado en fetchers +
   `*.queries.ts`, con las keys desde `queryKeys.ts`; nunca `api.get` dentro de un componente
   nuevo.

> **Pivot de producto (v3 de este diseño).** El tema **no** es config de negocio ni de
> dispositivo: es una **preferencia de cada usuario**, que lo sigue entre dispositivos y sesiones
> ("Es algo propio de cada usuario, debe ser una configuración de usuario"). Eso reemplaza por
> completo las decisiones 5 y 6 de las versiones anteriores de este documento (primero
> "local-only", después "campo de `app_settings`"). El `proposal.md` y las `specs/` los está
> actualizando el Product Owner con este alcance; las decisiones de abajo asumen ese alcance
> nuevo. Lo que **no** cambió y sigue vigente tal cual: tokens dark/light (dec. 3), pase de las
> utilidades hardcodeadas (dec. 4), `data-theme` + `@custom-variant` + `color-scheme` (dec. 2),
> fuentes (dec. 9), utilidades de `index.css` (dec. 10) y el snippet anti-flash (dec. 8).

## Goals / Non-Goals

**Goals:**

- Un único tipo `ThemeMode = "dark" | "light"` que reemplaza a `AppThemeId`, con un solo aplicador
  y un solo lugar de persistencia.
- Una capa de tokens derivada de `docs/design/design.md` que permita cambiar de modo **sin tocar
  call sites**, y que revive los tokens que `src/components/ui/**` ya asume.
- Light mode legible y con contraste AA en **toda** la app autenticada (no solo en las vistas que
  el proposal enumera): es condición necesaria del toggle, no alcance nuevo.
- El modo es una **preferencia del usuario**: viaja con su cuenta, la puede cambiar cualquier rol
  (Dueño, Coach y portal cliente) y la elección de uno no afecta a los demás.
- Cambio de backend **aditivo**: una columna nueva en `users`, un campo nuevo en la respuesta de
  `/auth/me` y un endpoint para actualizarla. Sin angostar tipos existentes, sin tocar
  `app_settings`, sin migración de datos.
- Sin destello: el modo correcto ya está aplicado en el primer paint, incluso antes de que haya
  respuesta del servidor.
- Pie del Sidebar recompuesto según el mockup: badge de rol + card de identidad del usuario
  logueado (nombre + email), en reemplazo de la card "Contexto" (dec. 12). Es lo único de este
  change que es **composición nueva** y no re-tema de algo existente.
- Mantener el comportamiento ya especificado: aplica al instante sin recargar y sigue aplicado en
  la carga siguiente.

**Non-Goals:**

- Modo "seguir al sistema" / `prefers-color-scheme` como tercera opción o como default inicial.
- Tema como configuración **del negocio**: el campo `app_settings.theme_preference` queda sin uso
  (ver dec. 6.5); este change no lo borra ni cambia su `Literal`.
- Endpoint genérico de autoservicio para editar el perfil (nombre, email, password): el único
  campo autoeditable que agrega este change es el tema (dec. 6.4).
- Tema para usuarios no autenticados como preferencia persistida en el servidor: en `/login` no
  hay usuario, así que sólo hay caché local (dec. 5.3).
- Rediseño de navegación, IA, jerarquía de vistas o componentes nuevos.
- Rediseño de `/login`, `/register-client` y el portal cliente: reciben solo el pase mecánico a
  tokens para no romperse en light mode, sin rediseño.

## Decisions

### 1. `ThemeMode = "dark" | "light"` como unión de strings

`lib/theme.ts` pasa a exportar `export type ThemeMode = "dark" | "light"`, `THEME_MODES`
(metadata mínima: `id`, `label`, `description` para el copy del toggle), `DEFAULT_THEME_MODE =
"dark"` (el design doc llama a dark el "Default Operational State"), `isThemeMode`,
`normalizeThemeMode` y `applyThemeMode`. Se eliminan `AppThemeId`, `APP_THEMES`,
`DEFAULT_THEME_ID`, `isAppThemeId` y `getStoredTheme` en su forma actual.

- **Alternativa: `boolean isDark`.** Descartada: en el `localStorage`, en el atributo del `<html>`
  y en el copy de la UI hay que serializarlo igual a un string; el booleano solo agrega una
  traducción en el medio y hace ilegible el valor persistido.
- **Alternativa: incluir `"system"` desde ya.** Descartada: el proposal habla de dos opciones y de
  un toggle; sumar un tercer estado obliga a `matchMedia`, a distinguir "modo elegido" de "modo
  efectivo" y a un requirement que nadie escribió. El tipo unión deja la puerta abierta a
  agregarlo después sin refactor.

### 2. `data-theme` en `<html>` como único interruptor, con `dark:` de Tailwind atado a él

`applyThemeMode(mode)` sigue haciendo `document.documentElement.dataset.theme = mode` (misma
mecánica que hoy, solo cambia el vocabulario de valores) y agrega
`document.documentElement.style.colorScheme = mode`. En `index.css` se declara

```css
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

para que las utilidades `dark:*` que ya existen dentro de `src/components/ui/**` (p. ej.
`dark:bg-input/30` en `input.tsx`) sigan significando "en modo dark" en vez de quedar atadas a la
clase `.dark` que nadie pone.

- **Alternativa: togglear la clase `.dark` (default de shadcn/Tailwind).** Descartada como *único*
  mecanismo: `index.css` y `applyTheme` ya usan `data-theme`, y tener dos interruptores (atributo
  + clase) es una fuente de drift garantizada. Atar el variant al atributo da la compatibilidad
  con shadcn sin duplicar estado.
- `color-scheme` deja de ser un literal en CSS y pasa a moverse con el modo: si no, en light mode
  los controles del UA (popup de `<select>`, ícono de `input[type=date]`, autofill, scrollbars
  nativas) quedan pintados en oscuro sobre fondo claro. Los `rgba(24,24,27,.7)` del bloque de
  autofill pasan a `var(--color-surface-2)`.

### 3. Capa de tokens: CSS vars por modo + `@theme inline`

`index.css` queda con dos capas explícitas:

1. **Vars semánticas por modo** en `@layer base`: `:root` (dark, default) y
   `:root[data-theme="light"]` (Crisp Slate) definen el mismo juego de nombres semánticos —
   `--canvas`, `--surface-1`, `--surface-2`, `--surface-3`, `--foreground`, `--muted-foreground`,
   `--primary`, `--on-primary`, `--primary-strong`, `--border-hairline`, `--ring`, `--destructive`,
   más los derivados de sombra/gradiente del design doc (`--shadow-level-2`, `--hero-aura`).
   Valores tomados literalmente de `docs/design/design.md` (dark: `#09090B` canvas, `#18181B`
   surface-1, `#27272A` surface-2, `#F59E0B` primary; light: `#F8FAFC` canvas, `#FFFFFF`
   surface-1, `#E2E8F0` border, `#D97706` primary, `#0F172A` / `#64748B` textos).
2. **`@theme inline`** que mapea esas vars a nombres de token de Tailwind v4 para que se generen
   utilidades: `--color-canvas`, `--color-surface-1|2|3`, `--color-foreground`,
   `--color-muted-foreground`, `--color-primary`, `--color-border`, `--color-ring`, …; los tokens
   de tipografía del design doc (`--font-display`, `--font-ui`, `--text-headline-hero`,
   `--text-metric-kpi`, `--text-label-caps` con su `line-height`/`letter-spacing`); los radios
   (`--radius-sm|DEFAULT|md|lg|xl|full`); y los espaciados
   (`--spacing-sidebar: 240px`, `--spacing-gutter: 1.25rem`, `--container-app: 1600px`).

El mismo `@theme inline` **también define los nombres del contrato shadcn** (`background`,
`foreground`, `card`, `card-foreground`, `popover`, `primary`, `primary-foreground`, `secondary`,
`muted`, `muted-foreground`, `accent`, `destructive`, `border`, `input`, `ring`, `--radius`)
apuntando a las mismas vars. Esto **revive intencionalmente** los tokens que hoy son no-ops en
`src/components/ui/**`: es exactamente lo que el proposal pide para "botones y formularios".

- **Por qué `@theme inline` y no `@theme` pelado**: con `@theme` normal, Tailwind emite los
  `--color-*` en `:root` y las utilidades referencian esos nombres, así que cada override por
  modo tendría que redeclarar los `--color-*` (dos juegos de nombres para lo mismo). Con `inline`
  la utilidad referencia directo la var semántica, la cascada la resuelve en el punto de uso
  (incluye el caso de un elemento que redefine la var y los modificadores de opacidad
  `bg-surface-1/70`), y es el layout oficial de shadcn para Tailwind v4 — o sea que un futuro
  `npx shadcn add <x>` sigue calzando con `components.json` sin parches a mano.
- **Alternativa: solo CSS vars, sin `@theme`.** Descartada: sin tokens no hay utilidades, y cada
  color habría que escribirlo como valor arbitrario (`bg-[var(--surface-1)]`) — verboso, sin
  modificadores de opacidad, sin autocompletado, y los tokens de `ui/**` seguirían muertos, con lo
  cual botones/inputs/dialogs no cambiarían de modo.
- **Alternativa: variante `dark:` en cada call site.** Descartada: son ~900 ocurrencias, obliga a
  mantener dos clases por color para siempre, hace que el *default sin prefijo* sea el light mode
  (al revés de la identidad, que define dark como estado operativo por defecto) y ninguna vista
  nueva se acuerda de poner las dos.
- **Costo aceptado**: la revitalización de los tokens de shadcn cambia todos los componentes de
  `ui/**` de golpe. Mitigado en Riesgos.

### 4. Migración de las ~900 utilidades hardcodeadas: tabla de mapeo + gate por grep

El pase de `zinc-*`/`amber-*` a tokens es mecánico y se hace con una tabla fija (la escribe este
design para que no la re-decida cada archivo):

| Hoy | Pasa a |
|---|---|
| `bg-zinc-950`, `bg-zinc-950/65` | `bg-canvas`, `bg-surface-1/70` |
| `bg-zinc-900`, `bg-zinc-900/70` | `bg-surface-1`, `bg-surface-1/70` |
| `bg-zinc-800`, `bg-white/[0.03]`, `bg-white/[0.05]` | `bg-surface-2` |
| `text-zinc-100`, `text-white` | `text-foreground` |
| `text-zinc-300`, `text-zinc-400`, `text-zinc-500` | `text-muted-foreground` |
| `border-white/10`, `border-amber-200/10` | `border-border` |
| `text-amber-400`, `text-amber-300` | `text-primary` |
| `bg-amber-400`, `bg-amber-500` | `bg-primary` + `text-on-primary` |
| `accent-amber-400`, `focus:ring-amber-*` | `accent-primary`, `ring-ring` |
| `rounded-2xl` en cards | `rounded-xl` (el design fija `1rem` para cards) |
| `lg:pl-64` / `w-64` del shell | `lg:pl-sidebar` / `w-sidebar` (240px, no 256px) |

Gate de cierre (va como task): `grep -rE '\b(zinc|amber|orange|lime)-[0-9]{2,3}\b' frontend/src
--include='*.tsx' --include='*.jsx'` debe devolver **0** resultados (el único lugar donde puede
quedar un hex/paleta cruda es `index.css`).

- **Alternativa: migrar solo las vistas que enumera el proposal** (sidebar, topbar, hero, KPIs,
  tablas, botones, forms) y dejar el resto. Descartada: una clase `text-zinc-100` que sobreviva en
  `Routines.tsx` es texto casi blanco sobre card blanca en light mode. El requirement dice "se
  aplica en toda la app"; el pase completo no es alcance extra, es el costo del toggle.

### 5. El modo vive en un store propio (`src/stores/theme.ts`) alimentado por la **sesión del usuario**

`lib/theme.ts` queda como módulo **puro** (tipos + `normalizeThemeMode` + `applyThemeMode`, sin
tocar `localStorage`). Se agrega un tercer store Zustand chico:

- `useThemeStore` con `{ mode: ThemeMode, setMode(mode) }`.
- `persist` sobre la clave plana ya existente **`app_theme`** con el mismo patrón de
  `PersistStorage` a medida que usan `session.ts` y `settings.ts` (valor plano, sin envoltorio
  `{state,version}`) — así el valor persistido sigue siendo legible/compatible y no se inventa una
  clave nueva.
- Aplicación sincrónica en el scope del módulo + `subscribeWithSelector` para los cambios
  posteriores, calcado de `stores/settings.ts:99-103`.
- `stores/settings.ts` pierde `themeFromSettings`, el `applyTheme` de import y la suscripción; el
  tema **desaparece** del store de ajustes.
- El store se importa desde `main.jsx` (antes del `createRoot`) para garantizar que el apply de
  import-time corra siempre.

**5.1 Reparto de responsabilidades (fuente nueva: el usuario).** Un solo sentido de escritura para
que no haya ciclo — servidor → store de tema → DOM:

```text
GET /auth/me .theme_preference ──(normalizeThemeMode)──┐
                                                       ├─► useThemeStore.mode ─► applyThemeMode(<html data-theme>)
localStorage["app_theme"] (caché de pintado) ──────────┘            │
                                                                    └─► persist en localStorage["app_theme"]

toggle del usuario ─► setMode(mode) ─┬─► useThemeStore (aplica + persiste local)
                                     └─► PATCH /auth/me/theme  (dec. 6.4)
```

- `useThemeStore.mode` es el **modo efectivo aplicado al DOM**; `app_theme` es solo **caché de
  pintado** de este navegador, no la preferencia autoritativa.
- La preferencia autoritativa es la columna del usuario, y **gana cuando llega**: la caché local
  sirve para pintar antes de que haya red, no para discutirle al servidor.
- `useSettingsStore` **no participa**: `useSyncSettings` sigue descartando
  `theme_preference` de `GET /settings`, ahora con el comentario actualizado ("campo legacy del
  negocio, sin uso") en vez del razonamiento de "solo este dispositivo".

**5.2 Dónde se lee el valor del usuario.** Dos entradas, las dos siguiendo lo que ya existe:

- **Al loguearse**: `pages/Login.tsx` y `pages/RegisterClient.tsx` ya llaman a `/auth/me` para
  pasarle `{name, role}` a `setSession`. Se agrega `theme_preference` a ese tipo de respuesta y se
  empuja al store de tema en el mismo lugar. Costo: dos líneas por vista, cero llamadas nuevas.
- **En cada carga con sesión ya persistida** (F5): hoy **no hay** ninguna llamada a `/auth/me`, así
  que hace falta una. Se agrega, siguiendo la convención de `src/services/`:
  `services/me.ts` (`fetchMe`, `updateMyTheme` — fetchers puros sobre el default export de
  `@/lib/http`), `services/me.queries.ts` (`useMeQuery`, `useUpdateMyThemeMutation`,
  `useSyncUserTheme()`), y `queryKeys.me.all` en `queryKeys.ts`. `useSyncUserTheme()` se monta
  **una sola vez en `App.jsx`**, al lado de `useSyncSettings()`, y solo consulta si hay token
  (`enabled: !!token`) — es el análogo exacto de `useSyncSettings` para el usuario.
  - Se llama `me.ts` y no `session.ts` a propósito, para no confundirlo con `stores/session.ts`.
  - Beneficio colateral: `/auth/me` pasa a validarse en cada carga, así que un token válido de un
    usuario desactivado deja de sobrevivir hasta que expire. No es alcance de este change, solo se
    registra.

**5.3 Antes de loguearse (`/login`, `/register-client`): caché local, default `dark`.** El snippet
de pre-paint y el store leen `app_theme` (el último modo visto en **este navegador**) y, si no hay
nada, `dark`.

- **Alternativa: forzar siempre `dark` mientras no haya sesión.** Descartada: quien trabaja en
  light mode vería un salto oscuro → claro justo después de loguearse, en cada login. Reusar la
  caché da continuidad y **cuesta cero** (el snippet ya lee esa clave).
- **Trade-off**: en una computadora compartida, `/login` se muestra con el modo del último usuario
  que la usó. Es sólo un esquema de color — no hay dato de nadie ahí —, y se corrige solo apenas
  responde `/auth/me`.
- **`logout()` no borra `app_theme`** (sí sigue haciendo `queryClient.clear()`): borrarlo dejaría
  la pantalla de login en un modo distinto al que la persona venía usando un segundo antes.
- **Usuario B en el navegador de A**: apenas `/auth/me` responde, gana el valor de B. Si B tiene
  `NULL` (nunca eligió), el modo efectivo es **`dark`**, no la caché de A: la caché es solo un
  hint previo a la respuesta, y así "nunca elegí" significa siempre lo mismo para todos.

- **Alternativa: `useSyncExternalStore` a mano en `lib/theme.ts`,** sin store. Descartada:
  reimplementa persistencia + suscripción selectiva que `persist` + `subscribeWithSelector` ya
  dan, y la convención del repo para estado de cliente es Zustand.
- **Alternativa: guardar el modo dentro de `useSessionStore`** (es, después de todo, "algo del
  usuario logueado"). Descartada: el `PersistStorage` de sesión mapea exactamente las 3 claves
  planas `access_token`/`user_name`/`user_role` y `logout()` borra todo — el modo quedaría atado al
  ciclo de vida de la sesión y `/login` perdería el modo en cada logout, que es justo lo que 5.3
  quiere evitar.
- **Consecuencia documental**: `frontend/AGENTS.md` dice "los dos stores del repo"; pasa a tres, y
  la sección de Zustand describe el tema como parte de `settings.ts` (deja de ser cierto). Hay que
  actualizarlo en este change (task de docs).

### 6. El tema es una columna del usuario, con un endpoint dedicado para cambiarlo

**6.1 Modelo.** `backend/app/models.py`, clase `User` (líneas 17-27):

```python
theme_preference = Column(String, nullable=True)
```

`nullable=True` **sin server default** a propósito: `NULL` significa "este usuario nunca eligió" y
es distinguible de "eligió dark". El frontend resuelve `NULL` al default (`dark`), así que si mañana
se cambia el default no hace falta reescribir filas.

**6.2 Migración Alembic de schema** (acá sí se toca `models.py`, así que la migración es
obligatoria por `backend/AGENTS.md`): revisión nueva encadenada al head actual, generada con
`alembic revision --autogenerate -m "add theme preference to users"` y **revisada a mano** antes de
commitear. La revisión a mano no es ceremonia: los modelos de este repo están escritos a mano y el
autogenerate arrastra diffs no relacionados (largos de `String`, `Enum` de `UserRole`, índices),
así que el archivo final tiene que quedar solo con:

```python
def upgrade() -> None:
    op.add_column("users", sa.Column("theme_preference", sa.String(length=30), nullable=True))

def downgrade() -> None:
    op.drop_column("users", "theme_preference")
```

`String(length=30)` para seguir el precedente de `e4d5f6a7b8c9` (el modelo declara `String` sin
largo y la migración fija 30; mantener la misma asimetría es preferible a inventar una convención
nueva en este change). **Sin migración de datos**: la preferencia previa vivía en `app_settings`, a
nivel negocio, así que no hay nada por usuario que migrar — todos arrancan en `NULL` y el frontend
cae al default.

**6.3 Schemas** (`backend/app/schemas.py`):

- `ThemeMode = Literal["dark", "light"]`, tipo nuevo al lado de `Role`.
- `UserOut` gana `theme_preference: Optional[ThemeMode] = None`. **Solo en `UserOut`**, no en
  `UserBase`: si estuviera en la base, `UserCreate`/`UserUpdate` lo aceptarían y habría dos vías
  de escritura para el mismo dato. Agregar un campo opcional a una respuesta es retrocompatible:
  un cliente viejo lo ignora.
- `ThemeModeIn(BaseSchema)` con un único campo `theme_preference: ThemeMode` (requerido) como body
  del endpoint nuevo.
- El `ThemePreference` viejo (los 3 ids de `app_settings`) **se deja intacto**: ver 6.5.

**6.4 Endpoint: `PATCH /auth/me/theme`, dedicado.** En `backend/app/routers/auth.py`, al lado de
`me()`:

```python
@router.patch("/me/theme", response_model=schemas.UserOut)
def update_my_theme(payload: schemas.ThemeModeIn,
                    user: models.User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    user.theme_preference = payload.theme_preference
    db.commit(); db.refresh(user)
    return user
```

- **Autorización: nada nuevo.** La única dependencia es `get_current_user`, que resuelve el usuario
  del `sub` del JWT; el endpoint no acepta un `user_id` por parámetro, así que "cada usuario sólo
  puede tocar el suyo" es una propiedad **estructural**, no un guard que alguien pueda olvidarse de
  poner. Tampoco hay chequeo de rol: los tres roles (incluido el portal cliente) pueden cambiar su
  propio tema. Nota: el router tiene `dependencies=[Depends(optional_bearer)]` a nivel APIRouter,
  pero el que corta de verdad es `strict_oauth2` dentro de `get_current_user` → sin token es 401.
- **Devuelve `UserOut`** (no 204) para que el frontend reconcilie con el mismo shape de `/auth/me`
  y pueda usar la respuesta como dato fresco de la query `me`.

- **Alternativa: `PATCH /auth/me` genérico** con un `MeUpdate`. Descartada por superficie de
  ataque: el schema natural para reusar sería `UserUpdate`, que incluye `role`, `is_active`,
  `password` y `client_id` — un endpoint de autoservicio con ese body es una escalada de
  privilegios servida en bandeja (`user` PATCHea su `role` a `owner`). Se podría mitigar con una
  whitelist de campos, pero entonces la whitelist es la que hay que no olvidarse de mantener. Un
  endpoint de un solo campo hace la escalada **imposible por construcción**, que es la propiedad
  que quiero. Si más adelante hace falta autoservicio de perfil, ese es su propio change con su
  propio schema restringido.
- **Alternativa: reusar `PUT /users/{id}`** (si existe/se agrega). Descartada: obliga a un guard de
  "sos vos o sos owner" escrito a mano, exactamente lo que 6.4 evita.
- **Alternativa: meter el tema en el JWT** y evitar la lectura de `/auth/me`. Descartada: el token
  no se re-emite al cambiar el tema, así que el claim quedaría viejo hasta el próximo login, y
  metería estado mutable de UI en una credencial.

**6.5 `app_settings.theme_preference` queda sin uso, y no se toca.** Con el tema a nivel usuario,
el campo de negocio no lo lee ni lo escribe nadie. Este change:

- **No** cambia su `Literal` ni borra la columna: dejarlo quieto mantiene el cambio de backend
  100% aditivo (sin riesgo de 422 por un cliente viejo, sin `drop_column` destructivo que
  complique el rollback).
- El frontend **deja de mandarlo**: `Settings.tsx.save()` excluye `theme_preference` del payload
  del `PUT` (es `Optional` con default `'dark-gold'`, así que la fila queda con un valor válido
  para su propio `Literal` y el `GET` sigue respondiendo 200), y `types.ts:41` lo marca como
  deprecado. La card "Tema visual" que lo editaba se va (dec. 11).
- Deuda declarada, con follow-up sugerido fuera de este change: borrar el campo del schema, del
  modelo, del `DEFAULTS` del router y del tipo del frontend, con su migración de `drop_column`.

### 7. Migración de la preferencia ya persistida

`normalizeThemeMode(raw: unknown): ThemeMode`:

- `"dark"` / `"light"` → tal cual.
- `"dark-gold"` / `"dark-copper"` / `"dark-olive"` → `"dark"` (los tres eran variaciones dark; el
  usuario no pierde el "clima" de su elección, solo las variaciones de acento).
- `null`, string vacío, cualquier otra cosa → `"dark"` (default).

La función sirve para dos cosas distintas, las dos en el frontend:

- **Limpiar el `localStorage` viejo**: `app_theme` puede tener cualquiera de los 3 ids legacy en el
  navegador de alguien que ya usó la app, y `app_settings.theme_preference` también.
- **Blindar la lectura del servidor**: `theme_preference` de `/auth/me` viene tipado como
  `ThemeMode | null`, pero la columna es texto libre; normalizar en la entrada evita que un dato
  raro (o un `NULL`) se convierta en un `data-theme` inválido.

**No hay migración de datos del lado del servidor** (dec. 6.2): la preferencia previa era del
negocio, no de cada usuario, así que no hay fila que mapear — todos arrancan en `NULL`.

Orden de precedencia, del primer paint hacia adelante:

1. **Primer paint** (sin red): `localStorage["app_theme"]` → normalizar. Si no existe:
   `JSON.parse(localStorage["app_settings"]).theme_preference` → normalizar (lectura legacy de un
   solo tiro, para el navegador cuyo tema solo vivía en el objeto de ajustes). Si no hay nada:
   `"dark"`.
2. **Cuando responde `/auth/me`** (al loguearse o vía `useSyncUserTheme` en cada carga con
   sesión): gana el usuario del servidor. `theme_preference === null` ⇒ `"dark"` (no la caché
   local, ver 5.3).
3. **Cuando el usuario togglea**: gana la acción del usuario, se aplica al instante, se cachea en
   `app_theme` y se manda `PATCH /auth/me/theme`. Si el `PATCH` falla, el modo **igual queda
   aplicado localmente** (la caché ya se escribió) y se avisa con `alertError` — el error de una
   mutación va por SweetAlert, según la convención del repo; no se hace rollback visual, porque
   revertirle el tema en la cara al usuario es peor que una preferencia que no viajó.

- No hace falta versionar la migración de `persist` ni un `migrate`: la normalización es idempotente
  y el conjunto de ids legacy está congelado (nunca va a aparecer un cuarto).
- **Alternativa: sembrar el modo inicial con `prefers-color-scheme` cuando no hay nada guardado.**
  Descartada: metería en light mode, sin pedirlo, a los usuarios actuales que tengan el SO en
  claro, y "seguir al sistema" es Non-Goal.

### 8. Sin destello: snippet de pre-paint en `frontend/index.html`

Se agrega un `<script>` inline (no módulo, en el `<head>`, antes del bundle) que lee `app_theme`,
aplica el mismo mapeo de los 3 ids legacy y setea `data-theme` + `color-scheme` en el `<html>`
antes del primer paint. El apply de import-time del store queda igual, como fuente de verdad del
lado JS.

- **Alternativa: confiar solo en el apply de import-time** (lo que hay hoy). Descartada: hoy el
  destello es invisible porque los 3 temas son dark y el `:root` default también; con light mode
  pasa a ser un flash negro → blanco en cada carga, y el escenario ya especificado ("sin destello
  del tema anterior") lo prohíbe.
- **Trade-off**: ~10 líneas duplicadas del mapeo en `index.html`. Mitigación: comentario que
  apunta a `lib/theme.ts` como fuente de verdad y aclara que la lista de ids legacy es cerrada.
- **Límite inherente al tema por usuario**: el snippet sólo puede leer la caché local, así que en
  la **primera** carga en un dispositivo nuevo (o después de limpiar el navegador) se pinta el
  default y el modo del usuario entra cuando responde `/auth/me`. Sin cookie de sesión legible
  desde el `<head>` o SSR no hay forma de evitarlo, y las dos cosas están fuera de alcance. A
  partir de la segunda carga en ese dispositivo, la caché ya coincide y no hay salto. Que la app
  aplique el modo "desde el primer render" en el caso normal (misma máquina) se mantiene.

### 9. Tipografía: fuentes self-hosted vía `@fontsource-variable`

Se agregan dos dependencias: `@fontsource-variable/plus-jakarta-sans` y
`@fontsource-variable/inter`, importadas una sola vez desde `index.css`/`main.jsx` y conectadas a
`--font-display` (Plus Jakarta Sans: headings, métricas) y `--font-ui` (Inter: `label-caps`,
`label-code`, headers de tabla). Las métricas (`metric-kpi`) llevan además
`font-variant-numeric: tabular-nums` como pide el design doc.

- **Costo de las deps** (regla del repo: justificar): son paquetes de build-time que vendorean
  `.woff2`; no agregan runtime, Vite los hashea y los sirve del mismo origen.
- **Alternativa: `<link>` a Google Fonts.** Cero dependencias, pero request a un tercero en cada
  carga, otro origen para el CSP y FOUT atado a un host externo.
- **Alternativa: quedarse en `system-ui`.** Descartada: la identidad de `docs/design/design.md`
  está definida por esas dos familias; sin ellas el rediseño es a medias.

### 10. Las clases utilitarias se conservan por nombre y se reimplementan por dentro

`surface-panel`, `warm-glow`, `warm-border`, `warm-accent-text`, `warm-accent-bg`,
`app-shell-bg`, `app-main-shell-bg`, `warm-scrollbar`, `subtle-scrollbar` **mantienen su nombre**
y se reescriben sobre los tokens nuevos (incluyendo los efectos que pide el design: hairline
border por modo, sombra Level 2, `hero-aura` radial). Se borran los overrides
`:root[data-theme="dark-copper"|"dark-olive"]` y la clase `theme-chip` (su único consumidor era el
swatch de las 3 paletas, que desaparece).

- **Ventaja**: los 17 call sites en 15 archivos no se tocan y el diff de la identidad queda
  concentrado en `index.css`.
- **Trade-off aceptado**: los nombres siguen diciendo "warm" aunque el token ahora se llame
  `primary`. Renombrarlos sería churn en 15 archivos sin cambio de comportamiento; si molesta, un
  change posterior los renombra de una.

### 11. El toggle se va de Ajustes al top bar, en el lugar de "Nuevo cliente"

Ajustes (`/settings`) **no puede ser el lugar** con el alcance nuevo: es una vista de configuración
del negocio, `ProtectedRoute roles={["owner","coach"]}` (`App.jsx:127-133`) y editable solo con
`role === "owner"` — el portal cliente (`role === "user"`) no tiene forma de llegar. Si el tema es
de cada usuario, el control tiene que estar donde llegan los tres roles.

- **Ubicación**: `components/Topbar.tsx`, el único componente del shell que ven los tres roles.
  Dos call sites en ese archivo, no uno: el cluster de escritorio (`hidden ... lg:flex`) y el panel
  desplegable de mobile — que además tiene ramas separadas para `role === "user"` y para el resto,
  así que el control va **fuera** del `if` de rol.
- **Reemplaza al botón "Nuevo cliente"** (visible solo para `role === "owner"`) en los dos call
  sites, en vez de sumarse junto a él o junto a Logout. Es una decisión de producto confirmada, no
  un descuido: el atajo de creación de cliente sigue disponible por otras vías (quick action del
  Dashboard, nav a `/clients`), y liberar ese lugar en la barra es lo que permite que el toggle
  quede visible para los tres roles sin apretar el resto de los controles (buscador, Logout) en una
  barra de 56px. Esto corrige el `proposal.md`, que decía "no hay cambios de navegación" — sí los
  hay, acotados a este único botón, y quedan documentados acá en vez de tratarse como regresión.
- **Forma**: `Button variant="outline" size="icon"` con `Sun`/`Moon` de `lucide-react` (ya es
  dependencia), `aria-label` que nombra la acción ("Cambiar a modo claro" / "…oscuro") y
  `aria-pressed`. Un icon button pill (`rounded-full`, como pide el design doc para icon buttons)
  entra en una barra de 56px sin robarle lugar al buscador global.
- **Se aplica al instante**, sin confirmación ni "Guardar": `setMode` → store → `applyThemeMode` +
  `PATCH /auth/me/theme` (dec. 6.4 y 7).
- **Solo con sesión**: `Topbar` no se monta en `/login` ni `/register-client` (`!isAuthRoute` en
  `App.jsx:54`), así que el toggle no existe sin usuario. Coherente con 5.3: sin sesión el modo es
  el de la caché local y no hay dónde persistirlo.
- **La card "Tema visual" de Ajustes se elimina** (con `APP_THEMES` y su swatch). Ojo con el
  requirement de `settings-view`: dejarla como texto sin control **violaría** "cada card de la
  columna de previsualización tiene al menos una acción real", así que se va entera, no se vacía.
  Esto toca la spec de `settings-view` → es del PO.
- **Detalle que se cuela fácil**: `App.jsx:52` tiene `<Toaster theme="dark">` hardcodeado. Pasa a
  leer el modo del store, o los toasts quedan oscuros sobre la app en claro.

- **Alternativa: control segmentado de dos botones** (`aria-pressed` en cada uno) o `Switch` con
  label. Descartados para el top bar por espacio: la barra ya tiene logo + buscador de 288px +
  "Nuevo cliente" + Logout. Un icon button de 36px es lo único que entra sin rediseñar la barra. En
  un menú desplegable de usuario (si el PO prefiere esconderlo ahí) el `Switch` con label sería la
  mejor opción, y `components/ui/switch.tsx` ya está en el repo.
- **Alternativa: dejarlo en Ajustes y además agregarlo al top bar.** Descartada: dos controles para
  el mismo dato, y el de Ajustes seguiría inalcanzable para el portal cliente.

### 12. Sidebar: la card "Contexto" se reemplaza por badge de rol + identidad del usuario

> **Pendiente de confirmación del PO.** Alcance agregado por pedido del usuario; el PO lo está
> sumando a `proposal.md`/specs. La decisión técnica de abajo no depende de cómo quede redactado.

Esto **no es re-tema**: es composición nueva. Hoy el pie del `<aside>` (`Sidebar.tsx:105-119`) es
una sola `<section>` con el eyebrow "Contexto", el título `Vista {roleLabel(role)}` y un párrafo
descriptivo de dos variantes (una para `role === "user"`, otra para el resto). Se reemplaza por:

1. **Badge/pill de rol**: punto de estado + `VISTA DUEÑO` / `VISTA COACH` / `VISTA USUARIO`, con el
   token `label-caps` del design system (Inter 11px, `700`, `tracking 0.08em`) y `rounded-full`,
   que es la forma que el design doc reserva para pills y tags operativos.
2. **Card compacta de identidad** debajo: ícono/avatar circular + nombre + email truncado
   (`truncate` + `title` con el valor completo, porque el rail es de 240px fijos y un email largo
   no entra). Encaja con lo que el design doc ya describe para el rail ("branding, core sections,
   and **contextual owner summaries**").

El párrafo descriptivo de dos variantes desaparece con la card vieja: era texto de relleno y su
única función informativa —qué rol estoy viendo— la cumple el badge.

**De dónde sale el email: del JWT, vía `useSessionStore`.** `stores/session.ts` gana `email` en
`SessionState`, resuelto igual que `userName`/`role`:

- `TokenPayload` **ya declara `email?: string`** (líneas 7-12) y `setSession` ya lo lee como
  fallback de `userName` — el decode ya trae el dato y hoy lo tira. Sólo hay que guardarlo.
- Se agrega `email` al parámetro `over` de `setSession`, para que `Login.tsx`/`RegisterClient.tsx`
  pasen el valor autoritativo de `/auth/me` igual que ya hacen con `name`/`role`.
- **No se persiste en una clave nueva**: se recalcula del token en `sessionPersistStorage.getItem`,
  exactamente como ya se hace con `exp` (líneas 93-99). Cero claves nuevas en `localStorage`, cero
  migración de sesiones.
- Fallback: si el claim no viene, la card muestra sólo el nombre y **no** renderiza la fila del
  email (no un espacio vacío ni un guion).

- **Alternativa: leer el email de `useMeQuery`** (la query que igual se agrega en la dec. 5.2, y
  `UserOut` ya expone `email` porque lo hereda de `UserBase`). Descartada, aunque era la candidata
  natural a "consolidar los datos de cuenta en un lugar": el pie del sidebar es **chrome visible
  desde el primer frame en todas las pantallas**, y el nombre ya está disponible sincrónicamente
  desde `localStorage`. Sacar el email de una query async metería un salto de layout en cada carga
  (nombre instantáneo + email 200ms después), y dejaría la card incompleta si la request falla o
  la app está offline — para un dato que el token ya tiene en la mano. El JWT es sincrónico,
  sobrevive al F5 y no agrega red.
- **Alternativa: mostrar sólo el nombre y no el email.** Descartada: el email es el desempate
  cuando dos personas comparten nombre y es el dato con el que se loguean; es la mitad del valor
  de la card.
- **Nota de accesibilidad y de tests**: las mayúsculas del badge se hacen con CSS (`uppercase`), no
  escribiendo `"VISTA DUEÑO"` en el JSX. Así el `textContent` sigue siendo `Vista Dueño` — lo que
  leen los lectores de pantalla en su forma natural, y lo que ya buscan las aserciones existentes
  de `Sidebar.test.tsx` (`getByText("Vista Dueño")` / `"Vista Coach"` siguen pasando; la única que
  se cae es la de `"Contexto"`, que se elimina a propósito).
- **Fuera de alcance** (registrado para que no se cuele desde el mockup): el toggle "Central |
  Norte" del mockup implica multi-sede, que no existe como feature en la app, y el ícono de usuario
  del top bar no es parte de este pedido.

### 13. Tests

Las 5 suites actuales (`Login`, `RegisterClient`, `Dashboard`, `Settings`, `Sidebar`) no asertan
nada sobre las paletas (`Settings.test.tsx` no menciona "Tema"), así que el cambio no las rompe
por contrato. Dos ajustes obligatorios y dos agregados (van como tasks):

- `src/test/setup.ts` resetea y rehidrata **los dos** stores; tiene que hacer lo mismo con el store
  de tema, o el modo se filtra entre tests.
- `renderWithProviders` rehidrata los dos stores antes de renderizar; sumar el tercero.
- Test unitario de `normalizeThemeMode` (los 3 ids legacy + `null` + basura → `"dark"`).
- Test del toggle en `Topbar`: click cambia `data-theme` del `documentElement`, persiste en
  `app_theme` y dispara el `PATCH` (con el helper `apiMock` resolviendo por ruta).
- `Login.test.tsx` ya mockea `/auth/me`; el mock tiene que devolver también `theme_preference` (o
  al menos no romper si falta, que es el caso `null`).
- `Sidebar.test.tsx` asserta hoy `getByText("Contexto")` en sus dos casos de rol: esa aserción se
  reemplaza por el badge + la card de identidad (dec. 12). Las de `"Vista Dueño"`/`"Vista Coach"`
  sobreviven si las mayúsculas se hacen por CSS. Sembrar `user_name` en el `beforeEach` propio del
  archivo para poder assertar el nombre y el email de la card.
- `useSyncUserTheme` se monta en `App.jsx`, **no** en las páginas, así que los tests de vista
  actuales no salen a pedir `/auth/me` y no hay que tocar sus mocks. Es una razón más para que ese
  hook viva en `App.jsx` y no dentro de `Topbar`.

Y del lado del backend, con `make test-backend` (hoy no hay ningún test que asserte el cuerpo de
`/auth/me`):

- `GET /auth/me` responde 200 e incluye `theme_preference` (`null` para un usuario nuevo).
- `PATCH /auth/me/theme` con `{"theme_preference": "light"}` responde 200, persiste, y un `GET`
  posterior lo devuelve.
- `PATCH /auth/me/theme` con `"dark-gold"` (o cualquier otro valor) responde **422**.
- **Aislamiento entre usuarios**: con dos usuarios, el `PATCH` de uno no cambia el
  `theme_preference` del otro. Es el test que da valor al diseño de 6.4 y encaja con
  `tests/test_isolation.py`, que ya existe.
- Sin token: 401.

## Risks / Trade-offs

- **[Revivir los tokens de shadcn cambia los 16 componentes de `ui/**` de una vez]** → Los tokens
  se mapean a valores del design doc (no a otra paleta), y `cn`/tailwind-merge hace que las clases
  del call site sigan ganando sobre los defaults del componente, así que el efecto es sobre todo
  aditivo (rellena CSS donde antes no había nada). Mitigación operativa: la capa de tokens va en
  su propio commit/task, con revisión visual vista por vista antes de seguir.
- **[Migración parcial de las ~900 clases hardcodeadas deja light mode ilegible]** (texto
  `zinc-100` sobre card blanca) → gate por `grep` con resultado 0 + checklist de vistas; el pase es
  mecánico con la tabla de la dec. 4.
- **[Contraste AA en light mode con el ámbar de marca]** → el design doc ya distingue `#F59E0B`
  (dark) de `#D97706` (light) justamente por eso: `--primary` es distinto por modo y el texto sobre
  ámbar usa `--on-primary`, nunca blanco.
- **[Ventana de deploy: frontend nuevo contra backend viejo]** (sin la columna) → el `PATCH
  /auth/me/theme` responde **404** y `/auth/me` no trae el campo. Degradación tolerable: el modo se
  aplica igual desde la caché local y solo no viaja. Igual el orden correcto es backend primero
  (ver Migration Plan). A diferencia de la versión anterior de este diseño, **no hay riesgo de 422
  cruzado**: el cambio de backend es aditivo, no angosta ningún tipo existente.
- **[`useSyncUserTheme` agrega una llamada a `/auth/me` en cada carga con sesión]** → es una query
  chica, cacheada con el `staleTime: 30_000` del `queryClient`, y en un `enabled: !!token`. Efecto
  lateral deseable: un token de usuario desactivado deja de sobrevivir hasta el `exp`.
- **[La caché `app_theme` es por navegador y puede mostrar el modo de otro usuario en `/login` o en
  el primer frame]** → sólo un esquema de color, sin dato de nadie, y `/auth/me` lo corrige apenas
  responde (dec. 5.3). Explicitado ahí para que no se lea como bug.
- **[`downgrade()` de la migración borra la columna y con ella las preferencias]** → aceptado: es
  una preferencia visual que cada usuario vuelve a elegir en un click, y el `drop_column` es la
  única inversa razonable de un `add_column`.
- **[`app_settings.theme_preference` queda zombi]** → deuda declarada en dec. 6.5: se deja quieta a
  propósito para que el change sea aditivo, con comentario de deprecación en `types.ts` y follow-up
  sugerido para borrarla.
- **[El mapeo legacy duplicado en `index.html` puede desincronizarse de `lib/theme.ts`]** → la
  lista de ids legacy está congelada (no van a aparecer temas nuevos) y el snippet solo hace
  "cualquier cosa que no sea `light` ⇒ `dark`", que es el default correcto ante drift.
- **[Diff grande = review difícil]** → orden de trabajo por capas, cada una verificable sola:
  tokens + modo (sin tocar vistas) → shell (`App.jsx`, `Sidebar`, `Topbar`, `Footer`) → Dashboard
  (hero + KPIs) → tablas/forms/botones → resto de las vistas → docs. Lo detalla `tasks.md`.
- **[Rollback del frontend con un valor nuevo en `localStorage`]** → el código viejo, ante un
  `app_theme` con `"dark"`/`"light"`, resuelve `isAppThemeId(...) === false` y cae a
  `DEFAULT_THEME_ID`: revertir el bundle deja al usuario en `dark-gold` sin errores ni pantalla
  rota, y el campo nuevo en la respuesta de `/auth/me` simplemente lo ignora.

## Migration Plan

Orden de deploy (el cambio de backend es **aditivo**, así que ninguna combinación rompe; igual hay
un orden preferible):

1. **Backend**: `make migrate` (o el `alembic upgrade head` del arranque) + deploy. `add_column`
   nullable sobre `users` es instantáneo y **no** afecta al frontend viejo, que ignora el campo
   nuevo de `/auth/me` y nunca llama al endpoint nuevo.
2. **Frontend**: deploy en Vercel del bundle con `ThemeMode`.
3. **Sin migración de datos por usuario**: todas las filas quedan en `NULL` y el frontend resuelve
   al default (`dark`), que es lo que todo el mundo venía viendo. Lo único que se "migra" es la
   caché local de cada navegador, en runtime: `normalizeThemeMode` sobre `app_theme` (o, si falta,
   sobre `app_settings.theme_preference`).
4. Si se despliega al revés (frontend antes que backend), la degradación es acotada y transitoria:
   el `PATCH /auth/me/theme` da 404 y la elección no viaja, pero el modo se aplica igual local.

Verificación post-deploy:

- `GET /auth/me` responde 200 e incluye `theme_preference: null`.
- Cargar con `app_theme="dark-copper"` sembrado a mano: queda en dark, sin flash.
- Togglear a light desde el top bar: cambia al instante sin recargar y `PATCH /auth/me/theme`
  responde 200.
- Recargar: sigue en light, sin destello, y `/auth/me` devuelve `"light"`.
- Loguearse con **otro** usuario en el mismo navegador: se ve el modo de ese usuario (o `dark` si
  nunca eligió), no el del anterior.
- Loguearse con el **mismo** usuario en otro navegador/dispositivo: se ve `light` sin haber tocado
  nada ahí. Este es el escenario que justifica todo el cambio de backend.
- Guardar un campo cualquiera de Ajustes: `PUT /settings` responde 200 (el payload ya no lleva
  `theme_preference`).

Rollback:

- **Solo frontend**: seguro. El bundle viejo ignora la columna y el campo nuevo; vuelve a
  `dark-gold`. La columna queda ahí, sin uso, esperando el re-deploy.
- **Backend también**: `alembic downgrade -1` (drop de la columna) + revert. Se pierden las
  preferencias elegidas — cosmético, se vuelven a elegir en un click.
- No hace falta ninguna variante en dos fases ni `Literal` transicional: nada se angosta.

## Open Questions

**Resueltas**

- ~~¿Backend intacto (tema local-only) o cambio de backend?~~ → **Cambio de backend**, y además a
  nivel **usuario**: columna en `users` + `PATCH /auth/me/theme` (dec. 6).
- ~~¿Copy "se guarda solo en este dispositivo"?~~ → No aplica: la card se elimina (dec. 11) y el
  tema es del usuario, no del dispositivo ni del negocio.
- ~~¿El Coach puede cambiar el modo si afecta al Dueño?~~ → No aplica: cada usuario tiene su fila,
  y el endpoint sólo toca `current_user` (dec. 6.4). Los tres roles pueden cambiar el propio.
- ~~¿Follow-up para eliminar `theme_preference`?~~ → Vuelve a aplicar, pero como **deuda**, no como
  pregunta: el campo de `app_settings` queda zombi (dec. 6.5) y se borra en un change posterior.

**Abiertas**

- **Ubicación del toggle** (dec. 11, bloqueante para cerrar esa parte): la hipótesis de trabajo es
  el **top bar** junto a Logout, por ser el único lugar del shell que alcanzan los tres roles. Si
  el PO prefiere un menú de usuario desplegable, o mantenerlo también en Ajustes para
  Dueño/Coach, cambia sólo esa decisión. Confirmación del PO pendiente.
- ¿`/login`, `/register-client` y el portal cliente entran en el rediseño visual completo o solo en
  el pase de tokens para que no se rompan en light mode? Este diseño asume **solo el pase**; si se
  quiere rediseño, es alcance del PO, no de este change.
- La spec de `settings-view` afirma que la columna de previsualización tiene la card "Tema visual":
  al eliminarla hay que actualizar ese requirement. Es del PO; lo registro acá para que no se
  archive el change con una spec que describe una card que ya no existe.
