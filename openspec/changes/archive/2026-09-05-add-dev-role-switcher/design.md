## Context

Hoy no hay forma barata de mirar la app con los ojos de los tres roles. Lo que existe:

- **Un solo usuario de desarrollo con password conocida**: `backend/scripts/create_owner.py` crea
  al Dueño (`manga_aguirre` / `Miniespacio1`, upsert por email). `seed_users.py` crea Miembros
  fake pero con `password_hash=None` y `email_verified=False`, o sea que **ninguno puede
  loguearse** (`POST /auth/token` rechaza con 400 "Tu invitación está pendiente de completar").
  No existe ningún Coach de desarrollo.
- **El flujo de login vive inline en la vista**: `frontend/src/pages/Login.tsx` tiene
  `requestTokenWithRetry(body)` (POST `/auth/token` con reintento único ante `ECONNABORTED`),
  después `GET /auth/me` **con header `Authorization` explícito** (el store todavía no tiene el
  token, así que el interceptor de request de `lib/http.ts` no lo pondría),
  `setSession(token, {name, role, email})`, `setThemeMode(normalizeThemeMode(me.theme_preference))`
  y `navigate("/", { replace: true })`. La ruta `/` de `App.jsx` es un `<Navigate>` que redirige
  según `role` (`/my-routine` para `member`, `/dashboard` para el resto), así que **el aterrizaje
  por rol ya está resuelto por el router**: no hace falta que nadie calcule la home.
- **`App.jsx`** parte en dos: rutas de auth (`/login`, `/invitacion/...`) sin shell, y el resto con
  `Sidebar` (`z-40`) + `Topbar` (`z-30`) + `<main>`. El `<Toaster>` de sileo va `position="top-right"`.
  Todos los chunks de página se cargan con `lazy()`.
- **`import.meta.env` se usa en un solo lugar** (`VITE_API_URL` en `lib/http.ts`). No hay `define`
  custom en `vite.config.js`; `vitest.config.js` lo mergea para no perder el alias `@` ni el plugin
  de React.
- **Gates de login del backend** (`routers/auth.py::login` + `auth.py::get_current_user`), que
  determinan qué campos necesita el Miembro de desarrollo:
  `POST /auth/token` exige que el usuario exista, que `password_hash IS NOT NULL`, que la password
  verifique, y que `is_membership_blocking_login(user)` sea falso — esa función solo bloquea a
  `role == member` con `membership_status == cancelled`. `GET /auth/me` (vía `get_current_user`)
  además exige `is_active` truthy y `email_verified is not False`.
  **Credenciales inválidas devuelven 400, no 401** — importante para el widget y para el
  interceptor de respuesta de `lib/http.ts`, que ante un 401 hace `logout()` + toast +
  `window.location.href = "/login"`.
- **`backend/app/config.py::Settings`** (pydantic-settings, `extra="ignore"`) **no tiene campo
  `ENVIRONMENT`**, aunque tanto `backend/.env.example` como `backend/.env.docker.example` ya
  declaran `ENVIRONMENT=development`: hoy esa variable se ignora silenciosamente.
- **La suite de backend** corre sobre SQLite de archivo con `Base.metadata.create_all()`
  (`backend/tests/conftest.py`), con `backend/` en `sys.path` y `backend/scripts/__init__.py`
  existente — o sea que un test puede importar `scripts.<modulo>` sin trucos. bcrypt cuesta
  ~0,28 s por hash: cada usuario seedeado en un test se paga en tiempo de suite.
- **`make docker-up`** levanta `db` + `backend` (:8010) + `frontend` (:5173, Vite dev server, o sea
  `import.meta.env.DEV === true`). El backend en Docker ve la base como `db:5432`; en modo nativo
  (`make dev`) la ve como `localhost`. Esa asimetría condiciona cómo se invoca el seed.

Restricciones que este diseño no negocia: no se agregan dependencias, no se toca `models.py` (por
lo tanto **no hay migración Alembic**), no se agrega ningún endpoint, y no se crea un cuarto store
de Zustand (`frontend/AGENTS.md` declara que los stores del repo son exactamente tres).

## Goals / Non-Goals

**Goals:**

- Un widget flotante que en modo desarrollo permita loguearse con un click como Dueño, Coach o
  Miembro, y que **no exista** (ni código ni credenciales) en el bundle de `npm run build`.
- Un único camino de login en el frontend, compartido por `Login.tsx` y el widget: si mañana el
  login suma un paso (p. ej. sincronizar otra preferencia), no hay una segunda copia que se olvide.
- Un seed idempotente que garantice que los tres usuarios existen y **pueden loguearse de verdad**
  (los tres pasan los gates de `POST /auth/token` y de `GET /auth/me`), con doble candado para no
  poder correrlo fuera de desarrollo.
- Un solo comando (`make seed-dev`) que funcione tanto en el stack Docker como en modo nativo, para
  que el mensaje de error del widget pueda nombrar un comando exacto.
- Que `role-qa`, `role-dev` y `run-app` conozcan la herramienta, para que probar los tres roles deje
  de ser opcional por fricción.

**Non-Goals:**

- Impersonar un usuario arbitrario, elegir de una lista, o un endpoint de impersonación en el
  backend (el widget usa exactamente el mismo `POST /auth/token` público que el login manual).
- Sembrar actividad (pagos, asistencias, rutinas) para el Miembro de desarrollo: el seed crea
  cuentas, no datos de negocio (ver pregunta abierta 2).
- Cambiar el comportamiento observable del login manual, de `session.ts` o de `lib/http.ts`.
- Resolver la deuda conocida de `Login.tsx`: si `GET /auth/me` devuelve **401**, el interceptor de
  respuesta ya redirigió a `/login` antes de que el `catch` local pueda degradar a
  `setSession(token)`. Es preexistente y queda igual (ver Riesgos).
- Un toggle en runtime (tipo `?dev=1` o una flag en `localStorage`) para activar el widget en un
  build de producción: contradice el requirement "ausente del bundle".

## Decisions

### 1. La guarda de build es un ternario `import.meta.env.DEV` **a nivel de módulo** en `App.jsx`

```jsx
// App.jsx, junto a los demás lazy()
const DevRoleSwitcher = import.meta.env.DEV
  ? lazy(() => import("./components/dev/DevRoleSwitcher"))
  : null;

// ... dentro del render, fuera del bloque de rutas (visible también en /login):
{DevRoleSwitcher && (
  <Suspense fallback={null}>
    <DevRoleSwitcher />
  </Suspense>
)}
```

En `npm run build` Vite reemplaza `import.meta.env.DEV` por el literal `false` **antes** de que
Rollup optimice, así que el ternario se pliega a `null`, el `import()` dinámico queda inalcanzable
y el chunk no se emite. Nada de `components/dev/**` entra al grafo del bundle, y con él tampoco las
credenciales.

**Alternativa considerada — `lazy()` a nivel de módulo + guarda en el render** (`{import.meta.env.DEV
&& <DevRoleSwitcher />}`): más legible, pero el `lazy(() => import(...))` se ejecuta
incondicionalmente al cargar el módulo. Rollup tendría que probar que la llamada a `lazy()` no
tiene efectos para eliminarla; si no lo prueba, **emite el chunk igual** y las credenciales quedan
en `dist/` como un archivo suelto que nadie mira. Descartada: el requirement es binario y no se
puede depender de una heurística de tree-shaking.

**Alternativa considerada — flag propia vía `define` en `vite.config.js`** (`__DEV_TOOLS__`):
equivalente en resultado, pero agrega un concepto nuevo al proyecto (una global sintética con su
declaración de tipos) para reemplazar una que Vite ya garantiza. Descartada por costo/beneficio.

**Alternativa considerada — entry point separado (`main.dev.jsx`) o un plugin de Vite que strippee
el import**: la más hermética, pero duplica el bootstrap (o suma un plugin propio a mantener) para
un widget de tres botones. Descartada por desproporcionada.

**Verificación mecánica, no confianza** (task 5.4): tras `npm run build`, buscar en `dist/` el
centinela `dev-role-switcher` (el `data-testid`/`aria-label` del widget) y el email
`dev.owner@miniespacio.local`. Cero coincidencias es la condición de aprobación; una sola
coincidencia invalida el change.

### 2. Todo el widget vive bajo `frontend/src/components/dev/`, con una única importación entrante

```
frontend/src/components/dev/
  DevRoleSwitcher.tsx   # UI + orquestación del cambio de usuario
  devUsers.ts           # las 3 credenciales fijas (única definición del lado frontend)
```

**Invariante**: el único `import` hacia `components/dev/**` desde fuera de esa carpeta es el
`import()` del ternario de la decisión 1. Cualquier otro (un test que importe el widget directo, un
`index.ts` de barril que lo reexporte, una constante compartida) lo reintroduce al grafo del bundle
de producción. Se documenta en `frontend/AGENTS.md` para que no se rompa por descuido.

**Alternativa considerada — credenciales en `.env.development` como `VITE_DEV_*`**: parece más
"correcto" que hardcodear, pero es peor: cualquier `VITE_*` referenciado queda **inlineado en el
bundle** en el momento en que el código que lo lee sobrevive, agrega fricción de setup (`.env`
nuevo que copiar) y contradice el requirement de que las credenciales estén documentadas en
`run-app` y no haya que buscarlas. Descartada.

### 3. El flujo de login se extrae a `services/auth.ts` (red) + `hooks/useSignIn.ts` (efectos)

Hoy la secuencia está inline en `Login.tsx`. Se parte en dos piezas y **`Login.tsx` pasa a usarlas**
(no se duplica nada):

- `frontend/src/services/auth.ts` — fetchers puros, con el **default export de `@/lib/http`** (regla
  dura del repo, de la que depende `vi.mock("@/lib/http")`):
  - `requestToken({ username, password })`: el `requestTokenWithRetry` actual, movido tal cual
    (timeout 8000, un reintento a los 2 s ante `ECONNABORTED`/timeout).
  - `fetchMeWithToken(token)`: `GET /auth/me` con `Authorization` explícito.
  - `signIn({ username, password })`: compone las dos y devuelve `{ accessToken, me }`, con
    `me: null` si `/auth/me` falló. **No toca stores ni navegación.**
- `frontend/src/hooks/useSignIn.ts` — `useSignIn()` devuelve
  `signIn(credentials, { resetPreviousSession = false })`, que hace: `services/auth.signIn` →
  (opcional) `logout()` → `setSession(...)` → `setThemeMode(normalizeThemeMode(me?.theme_preference))`
  → `navigate("/", { replace: true })`.

`Login.tsx` lo llama sin opciones; el widget con `resetPreviousSession: true`. El aterrizaje por rol
sale gratis: `navigate("/")` cae en el `<Navigate>` de `App.jsx`, que ya lee `role` del store
—recién escrito por `setSession`— y manda a `/dashboard` o `/my-routine`.

**Alternativa considerada — duplicar la secuencia dentro del widget**: cero riesgo de regresión en
`Login.tsx`, pero garantiza deriva (el `setThemeMode` es exactamente el tipo de paso que se olvida
en la copia) y el widget dejaría de cumplir "el mismo camino de autenticación que usa la vista de
login" en cuanto el login cambie. Descartada.

**Alternativa considerada — `useMutation` de TanStack Query en `services/auth.queries.ts`**: sería
el patrón del repo para escrituras, pero el login no es estado de servidor cacheable, no invalida
ninguna key, y su valor está entero en los efectos (store + tema + navegación) que `useMutation` no
aporta. Sumaría ceremonia y haría más pesado el mock en `Login.test.tsx`. Descartada.

**Alternativa considerada — un helper en `lib/` que escriba el store directo** (sin hook): `lib/`
puede importar stores (`lib/http.ts` ya lo hace), pero necesitaría `navigate`, que fuera de React
obliga a un router singleton que el repo no tiene. Descartada.

### 4. Primero la red, después el switch de sesión: un login fallido deja la sesión anterior intacta

Orden dentro de `useSignIn`:

1. `POST /auth/token` + `GET /auth/me` (nada de estado local todavía).
2. Recién con éxito: `logout()` (limpia el store **y** `queryClient.clear()`), y a continuación
   `setSession(nuevo)` + `setThemeMode` + `navigate`.

El proposal dice "antes de loguear al nuevo usuario, cierra la sesión anterior", y eso se cumple:
`logout()` corre estrictamente antes de `setSession`, así que no hay una sola línea de tiempo en la
que convivan el token viejo y los datos nuevos, ni cache del Coach visible para el Miembro. Lo que
**no** se cumple literalmente es "cierra la sesión antes de *empezar* el login", y es deliberado: el
escenario "seed no corrido" pide explícitamente que la sesión anterior no quede a medio cerrar.
Deslogueando primero, un 400 dejaría a la persona sin sesión en una ruta protegida → redirect a
`/login` → el mensaje de error del widget se pierde en la navegación. Con este orden, un fallo no
mueve nada: la sesión anterior sigue vigente y el error se lee en el widget.

**Alternativa considerada — `logout()` primero, literal**: descartada por lo anterior.
**Alternativa considerada — snapshot del estado y rollback si falla**: reimplementa a mano lo que el
orden correcto da gratis, y no hay forma de "des-limpiar" `queryClient`. Descartada.

### 5. Mapeo de errores del widget: 400/401 significan "el seed no corrió"

`POST /auth/token` devuelve **400** para usuario inexistente, password incorrecta e invitación
pendiente — los tres casos en los que un usuario de desarrollo no está bien seedeado. Se agrupan
400 y 401 (401 por si el backend cambia el código en el futuro) en un único mensaje accionable:

> **Usuario de desarrollo no encontrado.** Corré `make seed-dev` y volvé a intentar.

Cualquier otro fallo (red, 5xx, timeout tras el reintento) da un mensaje genérico:

> No se pudo cambiar de usuario. ¿Está levantado el backend?

El error se pinta **inline dentro del widget** (`role="alert"`), no con `toastError`: tiene que
seguir visible mientras se corre el comando, y así el test lo afirma sin depender del `<Toaster>`.

El interceptor global de `lib/http.ts` no interfiere: solo reacciona a **401**, y el caso normal de
"seed no corrido" es 400. Si `GET /auth/me` diera 401 el interceptor sí redirigiría — es el mismo
comportamiento preexistente de `Login.tsx` y queda documentado como riesgo, no se parchea acá.

### 6. Doble submit: un único `busyUserId` local

`const [busyUserId, setBusyUserId] = useState<DevUserId | null>(null)`. El handler arranca con
`if (busyUserId) return;` (cubre la carrera de dos clicks en el mismo tick, que `disabled` sola no
cubre) y las **tres** opciones se renderizan `disabled={busyUserId !== null}`; la elegida además
muestra el spinner con `aria-busy`. Un `aria-live="polite"` anuncia "Cambiando a …".

### 7. El colapsado va en `localStorage` directo, no en un store nuevo

Key `dev_role_switcher_collapsed` (namespaced, alineada con las claves planas que ya usa el repo),
valores `"1"`/`"0"`. Lectura con inicializador lazy de `useState` y escritura en el toggle (no en un
`useEffect`), ambas envueltas en `try/catch` — en un navegador con storage bloqueado el widget tiene
que degradar a "siempre expandido", nunca romper el render de la app entera.

**Alternativa considerada — un cuarto store de Zustand con `persist`**: sería consistente con
`session`/`settings`/`theme`, pero `frontend/AGENTS.md` declara que esos **tres** son los stores del
repo, y un booleano de una herramienta de desarrollo no justifica cambiar esa afirmación. Peor: el
store viviría en `src/stores/`, fuera de `components/dev/`, rompiendo el invariante de la decisión 2
y metiendo código del widget en el grafo de producción. Descartada por las dos razones.

### 8. Los tres usuarios de desarrollo

| Rol | Email (= `username` del login) | Password | Nombre visible en el widget | `first_name` / `last_name` |
|---|---|---|---|---|
| Dueño | `dev.owner@miniespacio.local` | `devdev123` | Dev Dueño | `Dev` / `Dueño` |
| Coach | `dev.coach@miniespacio.local` | `devdev123` | Dev Coach | `Dev` / `Coach` |
| Miembro | `dev.member@miniespacio.local` | `devdev123` | Dev Miembro | `Dev` / `Miembro` |

`Login.tsx` manda el email en el campo `username` del form OAuth2, y `routers/auth.py::login` busca
por `models.User.email` — así que el email **es** la credencial. El TLD `.local` deja explícito que
no son direcciones ruteables ni pueden colisionar con un usuario real.

Campos que el seed fija en los tres, derivados de los gates de `auth.py` (no son decorativos):

- `password_hash = hash_password("devdev123")` → sin esto, `POST /auth/token` responde 400
  "invitación pendiente" (ese es el estado en que quedan los usuarios de `seed_users.py`).
- `email_verified = True` → sin esto, `GET /auth/me` responde 403 y el login queda a mitad.
- `is_active = True` → sin esto, `get_current_user` responde 401.
- `role` = el de la fila.
- Solo el Miembro: `membership_status = MembershipStatus.active` (con `cancelled`,
  `is_membership_blocking_login` lo rechaza en el login **y** en cada request) y
  `membership_start_date = utcnow()` al crear. Dueño y Coach quedan en `MembershipStatus.none`, que
  es lo que esa función ignora por rol.

**Definición duplicada a propósito, una por lado**: `frontend/src/components/dev/devUsers.ts` y
`backend/scripts/seed_dev_users.py`, con los mismos valores, documentados en `run-app`.
**Alternativa considerada — un JSON compartido en la raíz leído por ambos**: elimina la deriva, pero
el frontend tendría que importar un archivo fuera de `src/` (rompe el invariante de la decisión 2 y
mete el path en la config de Vite) y el backend tendría que resolver una ruta relativa al repo que
no sobrevive al contenedor. Descartada: la deriva acá se paga barato — si los valores no coinciden,
el widget devuelve exactamente el 400 de la decisión 5 y el mensaje dice qué correr.

### 9. Guarda de entorno del seed: doble candado (`ENVIRONMENT` + host de `DATABASE_URL`)

Se agrega a `backend/app/config.py::Settings`:

```python
ENVIRONMENT: str = "production"   # default seguro: si nadie la declara, no es desarrollo
```

Es aditivo y sin riesgo (`extra="ignore"` ya venía tragando la variable; ambos `.env*.example` ya la
traen con `development`, así que no hay nada que documentar de nuevo, solo empezar a leerla).

`main()` del seed, **antes de crear el engine** (el orden importa: no queremos ni abrir una conexión
a una base que no es de desarrollo):

1. `settings.ENVIRONMENT.strip().lower()` debe estar en `{"development", "local", "test"}`.
2. El host de `settings.DATABASE_URL` (parseado con `urllib.parse.urlsplit`) debe estar en
   `{"localhost", "127.0.0.1", "db", ""}` (`""` cubre SQLite de archivo).

Si cualquiera falla: mensaje explicando **cuál** de los dos candados cerró y `sys.exit(1)`.

**Por qué dos y no uno**: el escenario que hay que hacer imposible es "alguien con `ENVIRONMENT` mal
seteado en su shell apunta a la base de producción". Cada candado por separado tiene un agujero
plausible (`.env` copiado de un ambiente a otro; un túnel a producción sobre `localhost`); juntos
hay que equivocarse dos veces.

**Alternativa considerada — reusar `settings.DEBUG`**: existe y no requiere campo nuevo, pero es una
flag de verbosidad, nadie garantiza que sea `False` en un staging, y no se autodocumenta. Descartada.
**Alternativa considerada — un flag `--force` de escape**: descartado, vacía el requirement.
**Alternativa considerada — `print` + `return` (patrón de `create_owner.py`) en vez de `sys.exit(1)`**:
descartada; una negativa que sale con código 0 se ve como éxito desde `make` y desde CI.

### 10. El script expone `seed_dev_users(db)` importable, separada de `main()`

`main()` = guardas de entorno + engine/sesión + chequeo de que la tabla `users` existe (mismo
`SELECT 1 FROM users LIMIT 1` con captura de `ProgrammingError`/`OperationalError` que
`create_owner.py`) + `seed_dev_users(db)` + resumen impreso con las credenciales.

`seed_dev_users(db)` = upsert por email (buscar, y si existe pisar nombre/password/rol/flags; si no,
crear), sin `commit` por usuario sino uno al final, devolviendo `{"created": n, "updated": m}`.

Esto habilita el test de idempotencia sobre la sesión SQLite de la suite sin tocar entorno ni
engine, que es justo lo que el escenario "correr el seed dos veces no duplica usuarios" necesita
probar. **Alternativa considerada — dejar la idempotencia como deuda documentada**: descartada,
porque separar la función cuesta tres líneas y el escenario es verificable exactamente donde el
riesgo vive (el upsert), sin depender de una corrida manual.

El upsert **pisa** los datos de una fila existente con ese email (mismo criterio que
`create_owner.py`). Ver pregunta abierta 4.

### 11. `make seed-dev`: un solo target que detecta Docker vs. nativo

El backend en Docker ve la base como `db:5432` y el nativo como `localhost`, así que el mismo comando
no sirve en los dos modos. El widget, en cambio, tiene que nombrar **un** comando exacto (requirement
del escenario "seed no corrido"). Se resuelve con un target que elige la rama y **dice cuál eligió**:

```make
seed-dev: ## Crea/actualiza los 3 usuarios de desarrollo (Dueño, Coach, Miembro)
	@if docker compose ps --status running --services 2>/dev/null | grep -qx backend; then \
		echo "==> stack Docker detectado: seedeando dentro del contenedor backend"; \
		docker compose exec -T backend python -m scripts.seed_dev_users; \
	else \
		echo "==> modo nativo: seedeando con el venv de backend/"; \
		cd backend && ../$(PYTHON) -m scripts.seed_dev_users; \
	fi
```

Va con su `## descripción` (lo lista `make help`) y sumado a `.PHONY`.

**Alternativa considerada — dos targets (`seed-dev` y `docker-seed-dev`)**: más explícito y sin
lógica en el Makefile, pero obliga al mensaje de error del widget a explicar dos caminos, que es
exactamente lo que el requirement quiere evitar. Descartada; el `echo` de cada rama conserva la
mayor parte de la explicitud.

**Alternativa considerada — correr el seed desde el entrypoint del contenedor backend, después de
`alembic upgrade`**: cómodo, pero acopla el arranque del stack a fixtures de desarrollo, el
entrypoint es el mismo que se usa para el deploy (donde la guarda de entorno lo abortaría, sumando
ruido en cada boot) y recrearía en silencio usuarios que alguien borró a propósito. Descartada: el
seed queda **manual**, mencionado en `run-app`.

### 12. Forma y ubicación del widget

`fixed bottom-4 right-4 z-50`. Abajo a la derecha porque el `<Toaster>` de sileo está arriba a la
derecha y el `Sidebar` es `fixed` a la izquierda. `z-50` lo pone por encima de `Sidebar` (`z-40`) y
`Topbar` (`z-30`); no puede tapar un modal, porque `DialogContent` es un `<dialog>` nativo y el top
layer del navegador siempre gana sobre cualquier z-index.

- **Colapsado**: un botón redondo de ~40 px con ícono, `aria-expanded={false}` y `aria-label`. Es lo
  que satisface "no bloquea el contenido de la vista debajo".
- **Expandido**: card con el estado de sesión arriba (`Dueño` / `Coach` / `Miembro` / `sin sesión`,
  leídos de `useSessionStore`) y las tres opciones debajo.
- **Tokens semánticos, nunca colores crudos** (`docs/design/design.md`): `border border-border`,
  `bg-surface-2/95 backdrop-blur-xl`, `text-foreground`, `text-muted-foreground` para lo secundario,
  `rounded-2xl`. Los botones usan `Button` de `components/ui`.
- Se monta **fuera** del split `isAuthRoute` de `App.jsx`, hermano del `<Toaster>`, para que también
  aparezca en `/login` (requirement explícito).

## Risks / Trade-offs

- **Que el widget se filtre al bundle de producción por una importación nueva** (un test que importe
  `DevRoleSwitcher` directo, un barril, una constante "compartida") → la verificación con `grep`
  sobre `dist/` (task 5.4) es parte del criterio de aceptación, y el invariante de "una sola
  importación entrante" queda escrito en `frontend/AGENTS.md`. El test de Vitest **no** cubre esto:
  simula el modo, no ejecuta el build.
- **Que `vi.stubEnv("DEV", false)` deje de funcionar** en una versión futura de Vitest → si pasa, el
  fallback es extraer la guarda a `components/dev/isDevBuild.ts` (`export const isDevBuild = () =>
  import.meta.env.DEV`) y mockearla con `vi.mock`. Se documenta el fallback en la task para que el
  Dev no improvise si el test sale flaky.
- **Deriva entre las credenciales del widget y las del seed** (decisión 8) → el síntoma es
  exactamente el 400 mapeado en la decisión 5, con mensaje accionable; y la tabla vive en `run-app`,
  que es lo que lee tanto un agente como una persona.
- **El refactor de `Login.tsx` a `useSignIn` toca un camino de producción** → es el único punto de
  regresión real del change. Mitigación: `Login.test.tsx` ya cubre esa vista y **no se toca**; si
  pasa sin cambios, el comportamiento observable se preservó. Es la task que hay que revisar con más
  cuidado en el gate.
- **`GET /auth/me` con 401 dispara el redirect global del interceptor** antes de que el widget pueda
  mostrar su error → preexistente, mismo comportamiento que el login manual. Solo se alcanza si el
  usuario de desarrollo quedó con la membresía dada de baja o `is_active=False`, y correr
  `make seed-dev` lo repara (el upsert reescribe esos flags). No se parchea acá: tocar el
  interceptor es un change propio.
- **+~3 s en la suite de backend** por los hashes bcrypt del test de seed (6 hashes al seedear dos
  veces + 3 verificaciones de login) → aceptado; es la única forma de probar de verdad "cada uno
  puede loguearse contra `POST /auth/token`". Si molesta, el test de login puede reducirse al
  Miembro (el único con gates no obvios).
- **Conflicto con `add-verification-gates-to-opsx-flow`**, que toca `role-qa` y `role-dev` → los
  cambios de este change se acotan a **una sección nueva al final** de cada skill, sin reescribir
  las existentes, para que la resolución sea un append y no un merge de párrafos.
- **`docker compose ps --status running --services` en el target `seed-dev`** depende de una versión
  de Compose v2 razonablemente moderna; en una versión vieja el `grep` no matchea y el target cae a
  la rama nativa, que va a fallar con un error de conexión claro (no silencioso). Aceptado.

## Plan de verificación

**Riesgo**: bajo — no hay cambio de esquema ni migración Alembic, ni endpoint nuevo, ni cambio de contrato de API; el 90 % del código nuevo es dev-only y desaparece del build de producción. Los únicos dos archivos de producción tocados son `App.jsx` (una constante de guarda + un bloque de render condicional) y `config.py` (un campo con default seguro que hoy ya se ignoraba). El punto más caliente —y lo que impide declararlo trivial— es el refactor de `Login.tsx` a `useSignIn`, cubierto por un test existente que no se modifica. El daño potencial de mayor severidad (seed corriendo contra una base real, credenciales conocidas en producción) está cubierto por dos guardas independientes y una verificación mecánica sobre `dist/`.

### Invariantes

Si alguna se rompe, el change no pasa:

- I1. `dist/` tras `npm run build` no contiene `dev-role-switcher` ni ninguno de los tres emails
  `dev.*@miniespacio.local` ni la password `devdev123`.
- I2. `components/dev/**` tiene exactamente **una** importación entrante en todo `src/`: el `import()`
  del ternario de `App.jsx`.
- I3. Un fallo de login desde el widget deja la sesión previa vigente (`useSessionStore.getState().token`
  sin cambios) y el error visible en el widget.
- I4. `logout()` corre estrictamente antes de `setSession` en el camino exitoso (sin ventana con token
  viejo + datos nuevos).
- I5. Correr `seed_dev_users(db)` N veces deja exactamente 3 filas con esos emails.
- I6. El seed no abre conexión a la base si alguna guarda de entorno falla.
- I7. `make test` verde y `make agents-check` sin drift.

### Tests

Cada fila es una task obligatoria para `role-dev` (archivo + caso concreto):

| Capa | Archivo | Caso |
|---|---|---|
| backend | `backend/tests/test_dev_seed.py` | `test_seed_dev_users_crea_los_tres_usuarios_una_vez_por_rol` |
| backend | `backend/tests/test_dev_seed.py` | `test_seed_dev_users_dos_veces_no_duplica_usuarios` |
| backend | `backend/tests/test_dev_seed.py` | `test_cada_usuario_de_desarrollo_puede_loguearse` |
| backend | `backend/tests/test_dev_seed.py` | `test_seed_se_niega_a_correr_fuera_de_desarrollo` |
| backend | `backend/tests/test_dev_seed.py` | `test_seed_se_niega_con_database_url_remota` |
| frontend | `frontend/src/components/dev/__tests__/DevRoleSwitcher.test.tsx` | `muestra exactamente tres opciones: Dueño, Coach y Miembro` |
| frontend | `frontend/src/components/dev/__tests__/DevRoleSwitcher.test.tsx` | `colapsar escribe dev_role_switcher_collapsed y oculta las opciones` |
| frontend | `frontend/src/components/dev/__tests__/DevRoleSwitcher.test.tsx` | `con la key sembrada monta colapsado, como tras recargar la página` |
| frontend | `frontend/src/components/dev/__tests__/DevRoleSwitcher.test.tsx` | `con /auth/token en 400 muestra el mensaje con make seed-dev y deja la sesión previa intacta` |
| frontend | `frontend/src/components/dev/__tests__/DevRoleSwitcher.test.tsx` | `mientras /auth/token está pendiente deshabilita las tres opciones y muestra carga` |
| frontend | `frontend/src/components/__tests__/App.devSwitcher.test.tsx` | `en modo desarrollo renderiza el widget de cambio de rol` |
| frontend | `frontend/src/components/__tests__/App.devSwitcher.test.tsx` | `en modo producción no renderiza el widget ni sus tres usuarios` |
| frontend | `frontend/src/pages/__tests__/Login.test.tsx` | `aplica el theme_preference que devuelve /auth/me al loguearse` |
| manual | — | Con el stack Docker arriba y `make seed-dev` corrido: elegir Dueño desde `/login` (aterriza en `/dashboard`), pasar a Coach, pasar a Miembro (aterriza en `/my-routine`, sin restos del Coach en el shell), colapsar, recargar (sigue colapsado), y correr una vez la app **sin** seedear para ver el mensaje de error. |
| manual | — | `npm run build` + `grep` de los centinelas sobre `dist/` (invariante I1). |

Notas sobre la tabla:

- El caso de login end-to-end (`test_cada_usuario_de_desarrollo_puede_loguearse`) está
  parametrizado por los tres usuarios; prueba de verdad los gates de la decisión 8, en particular
  el Miembro (`membership_status=active`, `email_verified=True`).
- Los dos casos de guarda cubren el escenario "el seed se niega a correr fuera de desarrollo":
  `main()` levanta `SystemExit` con código distinto de 0, no crea usuarios y no llama a
  `create_engine` (I6).
- El caso de colapsado con la key sembrada simula la recarga con siembra + remount, que es como el
  repo prueba el resto de la persistencia (escenario "el estado sobrevive a recargar").
- `Login.test.tsx` **no se modifica** en este change: que su caso existente siga pasando después
  del refactor a `useSignIn` es la prueba de no-regresión de la decisión 3.
- El test de `App.devSwitcher` simula el modo (`vi.stubEnv`), no ejecuta el build: I1 se verifica
  solo con la fila manual de `grep` sobre `dist/`.

## Preguntas abiertas para el Product Owner

1. **El Miembro de desarrollo arranca sin datos.** El seed crea la cuenta pero no pagos, asistencias
   ni rutina asignada, así que `/my-routine` se va a ver vacío. ¿Alcanza para el objetivo (mirar la
   pantalla como Miembro), o el seed también debería sembrar actividad mínima para que la vista sea
   representativa? Se implementa la versión mínima (solo cuentas) salvo indicación contraria.
2. **¿El widget debería ofrecer "cerrar sesión" como cuarta acción?** La spec pide "exactamente tres
   opciones de usuario"; se interpreta que no, y para volver a "sin sesión" se usa el logout normal
   del `Topbar`.
3. **Upsert destructivo.** Si en la base de desarrollo ya existe un usuario real con uno de esos tres
   emails, el seed le pisa nombre, rol, password y flags (mismo criterio que `create_owner.py`).
   Improbable con el TLD `.local`, pero es un borrado silencioso de datos. ¿Se confirma el upsert, o
   preferís que el seed aborte si encuentra una fila con `legacy_client_id`/actividad asociada?
4. **Sesión activa que no vino del widget.** El widget refleja el rol leyendo `useSessionStore`, así
   que si alguien se loguea a mano o cierra sesión desde el `Topbar`, el indicador se actualiza solo.
   Se asume que es lo esperado y que no hace falta marcar "esta sesión no es una de las tres de
   desarrollo".
