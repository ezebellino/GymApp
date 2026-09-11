## Context

Tres routers del backend quedaron con endpoints sin dependencia de auth, mezclados con endpoints
del mismo dominio que sí la tienen:

| Archivo | Endpoint | Hoy | Debe quedar |
|---|---|---|---|
| `backend/app/routers/settings.py:8` | `GET /settings` | público | sesión de cualquier rol |
| `backend/app/routers/settings.py:8` | `PUT`/`PATCH /settings` | público | Dueño o Coach |
| `backend/app/routers/payments.py:95,145` | `GET /payments/`, `GET /payments/{id}` | público | Dueño o Coach |
| `backend/app/routers/attendance.py:14` | `GET /attendance/` | público | Dueño o Coach |

El router de settings no declara ninguna dependencia. El de payments declara
`dependencies=[Depends(require_role(...))]` endpoint por endpoint en **todos** los demás
(`create_payment`, `delete_payment`, los cuatro `reports/*`), así que las dos lecturas abiertas son
la excepción, no la regla. El de attendance sí tiene una dependencia a nivel router,
`Depends(optional_bearer)` (`backend/app/security.py:12`), pero `optional_bearer` **no valida
nada**: su `OAuth2PasswordBearer` va con `auto_error=False` y la función devuelve el token tal
cual, sin decodificarlo; su único efecto real es declarar el esquema en OpenAPI para que el botón
"Authorize" de Swagger adjunte el header. Es la trampa de este change: el router *parece*
protegido y no lo está.

El patrón de auth ya existente y que no se toca: `get_current_user` (`backend/app/auth.py:47`,
401 si falta/no valida el token, y también 401 —deliberado— si la membresía del Miembro está dada
de baja) y la factory `require_role(*roles)` (`backend/app/auth.py:86`, 403 si el rol no está en
la lista), que depende de `get_current_user`.

Del lado del frontend hay un acoplamiento que convierte "proteger `GET /settings`" en un riesgo de
login: `useSyncSettings()` (`frontend/src/services/settings.queries.ts:23`) se monta en
`frontend/src/App.jsx:62`, **fuera** del split `isAuthRoute`, así que su `useQuery` dispara
`GET /settings` también en `/login` y en `/invitacion/:channel/:token`. Con el endpoint protegido,
ese fetch pasa a devolver 401 y el interceptor de respuesta de `frontend/src/lib/http.ts:28`
ejecuta, sin mirar dónde está el usuario, `toastError("Sesión expirada")` + `logout()` +
`window.location.href = "/login"`. Resultado sin este change: la pantalla de login saluda con un
toast de sesión expirada y una recarga dura.

Hay precedente exacto para la solución: `useMeQuery` (`frontend/src/services/me.queries.ts:16`) ya
gatea su fetch con `enabled: !!token` y su comentario se refiere a sí mismo como "análogo exacto de
`useSyncSettings`/`useSettingsQuery`" — la simetría estaba planeada y nunca se aplicó del otro
lado. Por eso `/auth/me` hoy no dispara este problema y `/settings` sí.

Restricciones que el diseño hereda:

- `useSyncSettings` es el **único** sincronizador servidor → store de ajustes y se monta una sola
  vez (dec. 12 de `adopt-tanstack-query-zustand`, y `frontend/AGENTS.md` → "Ajustes: un único
  escritor"). No se puede resolver duplicando el hook ni moviéndolo a cada vista.
- `frontend/src/stores/settings.ts` persiste en `localStorage["app_settings"]` y arranca de
  `DEFAULT_SETTINGS`, así que la marca del negocio está disponible aun sin sesión y sin fetch.
- `Settings.tsx:136,163`, `UserCard.tsx:70` y `NewPaymentDialog.tsx:53` llaman a `/settings` con
  `api.get`/`api.put` directo (deuda declarada, dec. 13/15). Los tres viven dentro de rutas
  protegidas, así que el request interceptor (`http.ts:22`) ya les adjunta el token.
- Sin cambios de modelo ni de esquema: no hay migración Alembic en este change.

## Goals / Non-Goals

**Goals:**

- Cerrar las cinco brechas de la tabla de arriba con el patrón de auth que el repo ya usa
  (`get_current_user` / `require_role`), sin inventar una capa nueva.
- Que `/login` y `/invitacion/:channel/:token` sigan funcionando exactamente igual que hoy para
  alguien sin sesión: sin toast de "sesión expirada", sin redirección, sin recarga.
- Dejar el manejo de 401 con una noción de "vista pública" que sea **una sola definición** en el
  repo, no una lista de rutas copiada en dos archivos.
- No cambiar ninguna regla de autorización de los endpoints que ya estaban protegidos.

**Non-Goals:**

- No se crean las vistas propias del Miembro ("Mi cuota" M6, "Mis asistencias" A-3). Un Miembro
  autenticado recibe 403 en `/payments/*` y `/attendance/` y eso es el comportamiento correcto
  *hoy*, tal como fija el proposal.
- No se toca `backend/app/auth.py`, `backend/app/security.py`, `backend/app/deps.py` ni
  `backend/app/routers/auth.py`: el change usa lo que ya existe.
- No se migran los tres lectores directos de `/settings` a la capa de servicios (dec. 8 más
  abajo).
- No se revisa el resto de la superficie de la API. `reports.py` ya es owner-only y `users.py` ya
  filtra por rol; ninguno entra en este change.
- No se cambia el logo ni la marca de la pantalla de login (hoy es estático,
  `/mini-espacio-logo.svg`), así que perder el fetch de `/settings` sin sesión no tiene efecto
  visual.

## Decisions

### D1. Settings: piso de sesión a nivel router + escalada de rol por endpoint

`settings.py` declara `router = APIRouter(prefix="/settings", tags=["settings"],
dependencies=[Depends(get_current_user)])` y, además, `PUT` y `PATCH` agregan su propia
`dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))]`.

Por qué mixto y no uniforme: los tres endpoints comparten un piso ("ninguna lectura de
configuración es pública") pero no comparten techo (lectura = cualquier rol, escritura = Dueño o
Coach). Expresar el piso a nivel router lo vuelve *default-deny*: un endpoint nuevo agregado a este
archivo mañana nace autenticado aunque quien lo escriba se olvide de la dependencia, que es
exactamente el modo de falla que estamos arreglando. La escalada por endpoint queda al lado de la
firma que la necesita.

No hay costo de performance: FastAPI cachea las dependencias dentro de una misma request, así que
`require_role` reusa el `get_current_user` ya resuelto por el router — una sola decodificación de
JWT y un solo `db.get(User, ...)`.

Alternativas consideradas:

- **Todo por endpoint** (como payments). Trade-off: diff más chico y homogéneo con el resto del
  repo, pero pierde el default-deny justo en el router donde el olvido de la dependencia ya ocurrió
  una vez.
- **Todo a nivel router con `require_role(owner, coach)`**. Rechazada: le sacaría a un Miembro la
  lectura de configuración que la matriz de permisos §2.5 le concede, y que la spec exige
  explícitamente ("igual para los tres roles").

### D2. Payments y Attendance: dependencia por endpoint, sin dependencia de router

`list_payments`, `get_payment` y `list_attendance` suman cada uno
`dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))]`, en el decorador, igual que
sus vecinos. Sin dependencia a nivel router.

Por qué acá **no** aplico el default-deny de D1: estos dos routers son el destino conocido de
endpoints con reglas distintas. "Mi cuota" (M6) y "Mis asistencias" (A-3) son endpoints de rol
Miembro que van a vivir en `payments.py` y `attendance.py`. Un `require_role(owner, coach)` a nivel
router los bloquearía desde arriba y el bug resultante ("mi endpoint de miembro da 403 y la
dependencia del endpoint dice `member`") es de los caros de diagnosticar, porque la causa está a 200
líneas de distancia. En settings ese conflicto no existe: su piso (`get_current_user`) es
compatible con cualquier rol futuro.

Regla que queda, y que conviene explicitar para el próximo router: **dependencia a nivel de router
solo cuando todos los endpoints presentes y previsibles comparten ese piso**; si el dominio va a
tener endpoints con audiencias distintas, la dependencia va por endpoint.

Alternativa considerada: dependencia de router en los tres archivos, uniforme. Rechazada por lo
anterior.

### D3. Sacar `optional_bearer` del router de attendance, sin tocar `security.py`

`attendance.py:13` pierde `dependencies=[Depends(optional_bearer)]` y el import correspondiente.

Una vez que los dos endpoints del router (`GET /` por D2, `POST /checkin` que ya lo tenía) exigen
token vía `require_role` → `get_current_user` → `strict_oauth2`, el esquema de seguridad ya aparece
en el OpenAPI de ambos y el "Authorize" de Swagger sigue funcionando: `optional_bearer` no aporta
nada y su presencia sugiere una protección que no ejerce. Dejarlo sería dejar la trampa puesta.

`optional_bearer` **no** se borra de `backend/app/security.py`: sigue teniendo un caller legítimo,
`backend/app/routers/auth.py:11`, donde el router sí tiene endpoints públicos de verdad
(`POST /auth/token`). Además, tocar `security.py` es uno de los gatillos de riesgo alto del repo
sin ninguna ganancia acá.

Alternativa considerada: dejar `optional_bearer` en attendance "por si acaso". Rechazada: no tiene
efecto y desinforma a quien lea el archivo.

### D4. Frontend: gatear `useSettingsQuery` con `enabled: !!token`, sin mover `useSyncSettings`

`useSettingsQuery` pasa a leer el token del store de sesión y a declarar `enabled: !!token`,
copiando literalmente lo que ya hace `useMeQuery` (`me.queries.ts:11-19`). `useSyncSettings` no se
mueve: sigue montado una sola vez en `App.jsx:62`.

Consecuencias:

- Sin sesión no sale el request: el 401 no ocurre y el caso no depende de que el interceptor lo
  maneje bien. La corrección del interceptor (D5/D6) es la red de contención, no la solución.
- Al loguearse, `token` pasa de `null` a string, la query se habilita sola y sincroniza el store; no
  hace falta invalidar nada a mano.
- Al desloguear, `logout()` ya hace `queryClient.clear()` y la query se deshabilita; el store de
  ajustes persiste en `localStorage`, así que la marca no parpadea a defaults en `/login`.

Alternativas consideradas:

- **Mover `useSyncSettings()` dentro del bloque `!isAuthRoute` de `App.jsx`.** Rechazada: el split
  es por `location.pathname`, así que el hook se montaría y desmontaría en cada transición
  login ↔ app, y montarlo condicionalmente rompe la garantía de "se monta una sola vez" de la dec.
  12. Además seguiría disparando el fetch para un usuario con sesión vencida que aún no fue
  redirigido.
- **Envolver el hook en un componente `<AuthenticatedSync />`.** Mismo problema de montaje
  condicional, más un componente nuevo, para el mismo resultado que dos líneas de `enabled`.
- **Dejar `GET /settings` público.** Lo prohíbe la spec.

### D5. Una sola definición de "ruta pública", en `lib/navigation.ts`

Se agregan a `frontend/src/lib/navigation.ts` un `PUBLIC_ROUTE_PREFIXES = ["/login",
"/invitacion"]` y un predicado `isPublicPath(pathname: string): boolean` que hace el mismo
`startsWith` que hoy tiene inline `App.jsx:56-57`. `App.jsx` pasa a calcular `isAuthRoute` con ese
predicado y `http.ts` lo usa contra `window.location.pathname`.

Por qué ahí: `navigation.ts` ya es, por decisión previa (dec. 3 de `redesign-list-page-layout`), la
fuente única de la navegación del shell, precisamente porque el mismo par ruta/label había derivado
copiado en tres archivos. Este es el mismo problema con otra forma: si la lista de rutas públicas
vive duplicada en `App.jsx` y en `http.ts`, agregar mañana una tercera vista pública (recuperar
contraseña, por ejemplo) la arregla en un lado y la rompe en el otro, y el síntoma —un toast de
sesión expirada en una pantalla sin sesión— es difícil de atribuir. Bonus: `navigation.ts` es un
módulo sin dependencias de React ni de axios y ya tiene suite propia
(`frontend/src/lib/__tests__/navigation.test.ts`), así que el predicado se testea sin renderizar
nada.

`http.ts` lee `window.location.pathname` y no el router: el interceptor vive fuera del árbol de
React y no tiene acceso al `useLocation`. Es consistente con lo que ese mismo bloque ya hace
(`window.location.href = "/login"`) y con `BrowserRouter`, donde `location.pathname` es la ruta
real.

Alternativa considerada: un módulo nuevo `lib/publicRoutes.ts`. Rechazada: un archivo de dos
constantes que se solapa conceptualmente con `navigation.ts`, contra la misma regla de fuente única
que motivó ese archivo.

### D6. En vista pública, el 401 no toastea, no redirige **y tampoco desloguea**; el error se sigue rechazando

El bloque `if (status === 401)` de `http.ts` queda así: si `isPublicPath(window.location.pathname)`
es verdadero, no hace nada de las tres cosas (toast, `logout()`, redirección) y cae directo al
`return Promise.reject(error)` que ya existe. Si es falso, el comportamiento actual queda intacto,
byte por byte.

Lo discutible acá es el `logout()`. La spec de `session-state` solo exige no toastear y no
redirigir; deslogear sería defendible ("no dejes un token zombi"). No lo hago, por un motivo
concreto: la vista pública por excelencia es `/login`, y el propio flujo de login llama a la API
*después* de `setSession` (`services/auth.ts` → `fetchMeWithToken`). Un `logout()` disparado por una
respuesta 401 rezagada de otra petición borraría la sesión recién creada, y ese bug —login que "no
toma" una de cada tantas veces— es infinitamente peor que el token viejo que estamos evitando. Y el
token viejo, además, ya tiene dos barrenderos: el auto-logout por `exp` de `stores/session.ts` y
`ProtectedRoute`, que sin token válido nunca deja pasar a una vista protegida.

Se mantiene el `Promise.reject(error)` en ambas ramas: quien llamó tiene que seguir viendo el error
(react-query lo marca como query fallida y no reintenta 4xx, por `shouldRetry` en
`lib/queryClient.ts`). Tragarse el error convertiría el 401 en un estado de carga eterno.

Alternativas consideradas:

- **Desloguear también en vista pública.** Riesgo de carrera con el login descrito arriba.
- **Decidir por endpoint en vez de por vista** (una allowlist de URLs que pueden dar 401 sin
  consecuencias). Rechazada: la spec está escrita en términos de vista, es la dimensión que el
  usuario percibe, y una allowlist de URLs habría que mantenerla cada vez que se agrega un fetch.

### D7. El 403 sigue sin manejo global

El interceptor no maneja 403 hoy y este change no lo agrega. Un Miembro autenticado no tiene forma
de llegar a `/payments`, `/attendance` ni al `PUT /settings`: `ProtectedRoute` restringe esas rutas
a `owner`/`coach` y `navItemsForRole` ni siquiera le muestra los links. El 403 nuevo es una defensa
de servidor para el caso de llamada directa a la API, no un estado de UI que haya que pintar.
Cuando existan "Mi cuota" y "Mis asistencias" habrá que revisitarlo; hoy sería código sin caller.

### D8. Los tres lectores directos de `/settings` no se migran

`Settings.tsx`, `UserCard.tsx` y `NewPaymentDialog.tsx` siguen con su `api.get("/settings")`
directo. Los tres se montan dentro de rutas protegidas (`/settings`, `/users`, `/payments`), el
request interceptor les adjunta el token del store y con D1 siguen respondiendo 200 para Dueño y
Coach. Migrarlos a la capa de servicios es la deuda ya declarada de la dec. 13; meterla acá
inflaría un change de seguridad con refactor no relacionado.

### D9. Sin cambio de contrato de API

Ningún schema, ningún path, ningún código de respuesta de éxito cambia. Lo único que cambia es qué
requests son rechazadas. Por eso no hay tarea de cliente más allá de las de D4/D5/D6, y ninguna
firma de `frontend/src/services/*.ts` se toca.

**Detalle de implementación que muerde**: las rutas de settings están declaradas como
`@router.get("")` sobre el prefijo `/settings`, o sea el path exacto es `/settings` **sin** barra
final; las de payments/attendance sí la llevan (`/payments/`, `/attendance/`). En el frontend eso ya
lo resuelve el request interceptor (`slashEndpoints` en `http.ts:16`); en los tests de backend hay
que escribir el path exacto o `TestClient` sigue un 307 hacia una ruta que no existe y el assert
falla por el motivo equivocado.

## Risks / Trade-offs

- **[Romper el login en producción]** → Es el riesgo principal. Mitigación en tres capas: D4 evita
  que el request salga, D6 evita que un 401 de cualquier otro origen escale a toast+redirect, y la
  tabla de tests cubre las dos capas por separado. Verificación manual obligatoria en el gate (ver
  el procedimiento en la fila `manual`).
- **[Ventana de bundle viejo tras el deploy]** → Railway despliega backend y frontend del mismo
  commit, pero un navegador con el bundle anterior ya cargado y parado en `/login` haría
  `GET /settings` → 401 → toast + `window.location.href = "/login"`. Esa redirección es una carga
  completa de documento, que trae el `index.html` nuevo y con él el bundle corregido: el efecto se
  autolimita a un toast y una recarga, sin loop (el destino de la redirección es la misma ruta
  pública en la que ya está). Aceptado; no justifica un deploy en dos fases.
- **[Un Miembro logueado que hoy ve algo deja de verlo]** → No aplica en la UI actual: ninguna vista
  de rol `member` (`/my-routine`) consume `/payments/`, `/attendance/` ni escribe settings. Se
  verifica igual en el paso manual, entrando con `dev.member@miniespacio.local`.
- **[Cliente externo no contemplado]** → Si algo fuera del frontend (un script, un dashboard, un
  monitor de uptime) estuviera consumiendo `GET /settings` o `GET /attendance/` sin token, empieza a
  recibir 401. Es exactamente el objetivo del change; se documenta acá para que no se lea como
  regresión si aparece.
- **[`isPublicPath` con `startsWith`]** → `"/loginzarosa"` daría "pública" por prefijo. Se mantiene
  el `startsWith` porque es idéntico a lo que `App.jsx` ya hace hoy (cualquier ruta no reconocida
  bajo ese prefijo cae en el `<Route path="*">` que redirige a `/login`, o sea que ya se comporta
  como pública). Cambiarlo a match exacto rompería `/invitacion/:channel/:token`, que es
  paramétrica. Queda anotado, no arreglado.
- **[Trade-off de D6: token zombi]** → Un token inválido-pero-no-vencido puede sobrevivir en
  `localStorage` mientras el usuario esté en una vista pública. Aceptado a cambio de no arriesgar el
  flujo de login (D6); el siguiente login lo sobrescribe.

## Migration Plan

1. Sin migración Alembic: no hay cambios en `models.py` ni en el esquema.
2. Backend y frontend viajan en el mismo commit y se despliegan juntos en Railway. No hay orden
   requerido entre servicios (ver el riesgo de bundle viejo, que se autolimita).
3. Rollback: `git revert` del commit y redeploy. No queda estado persistido nuevo, ni en la base ni
   en `localStorage`, así que revertir devuelve el sistema al estado exacto anterior.
4. Post-deploy (smoke, 2 minutos): abrir `/login` en una ventana privada y confirmar que no aparece
   ningún toast; loguearse como Dueño y confirmar que `/settings`, `/payments` y `/attendance`
   cargan.

## Open Questions

1. Cuando existan "Mi cuota" (M6) y "Mis asistencias" (A-3), ¿esos endpoints van a ser rutas nuevas
   con scope propio (`GET /payments/my`, `GET /attendance/my`) o va a ser el mismo listado con
   filtro implícito por `user_id` de la sesión? La decisión afecta si el 403 de hoy sobrevive o se
   convierte en 200-filtrado. No bloquea este change; sí explica por qué D2 evita la dependencia a
   nivel de router.
2. ¿Conviene, en un change aparte, un chequeo automatizado que liste todas las rutas de
   `app.routes` sin dependencia de auth y falle si aparece una nueva no declarada como pública?
   Sería el arreglo estructural de la clase de bug que este change corrige caso por caso. Fuera de
   alcance acá.

## Plan de verificación

**Riesgo**: alto — el diff altera qué rol exige un endpoint (`require_role` nuevo en
`settings.py`, `payments.py` y `attendance.py`), que es gatillo directo de nivel alto en la tabla
de criterio de riesgo de `.agents/skills/role-architect/SKILL.md`, y además modifica el manejo
global de 401 del frontend, con capacidad de romper el login.

### Invariantes

- I1. Ningún endpoint de `/settings`, `/payments` ni `/attendance` responde 200 sin un token válido.
- I2. `GET /settings` responde 200 para los tres roles (Dueño, Coach y Miembro) con el mismo cuerpo.
- I3. Los endpoints que ya exigían rol antes del change conservan exactamente el mismo rol:
  `POST /payments/` y `POST /attendance/checkin` = Dueño o Coach, `DELETE /payments/{id}` = solo
  Dueño, `GET /payments/reports/*` = Dueño o Coach.
- I4. Un visitante sin sesión en `/login` o en `/invitacion/:channel/:token` no ve toast de "sesión
  expirada" ni es redirigido fuera de esa ruta.
- I5. Sin token en el store de sesión, la app no emite ningún `GET /settings`.
- I6. Con sesión y token vencido en una vista protegida, el 401 sigue haciendo toast + logout +
  redirección a `/login`, sin cambios respecto de hoy.
- I7. `useSyncSettings` sigue siendo el único escritor servidor → `useSettingsStore` y se sigue
  montando una sola vez en `App.jsx`.
- I8. `backend/app/auth.py`, `backend/app/security.py`, `backend/app/deps.py` y
  `backend/app/routers/auth.py` no aparecen en el diff.

### Tests

| Capa | Archivo | Caso |
|---|---|---|
| backend | `backend/tests/test_settings.py` | `test_get_settings_sin_token_responde_401` |
| backend | `backend/tests/test_settings.py` | `test_get_settings_con_token_invalido_responde_401` |
| backend | `backend/tests/test_settings.py` | `test_get_settings_con_miembro_responde_200` |
| backend | `backend/tests/test_settings.py` | `test_get_settings_con_owner_y_con_coach_responde_200` |
| backend | `backend/tests/test_settings.py` | `test_put_settings_sin_token_responde_401_y_no_modifica` |
| backend | `backend/tests/test_settings.py` | `test_patch_settings_con_miembro_responde_403_y_no_modifica` |
| backend | `backend/tests/test_settings.py` | `test_put_settings_con_coach_actualiza` |
| backend | `backend/tests/test_payments.py` | `test_list_payments_sin_token_responde_401` |
| backend | `backend/tests/test_payments.py` | `test_list_payments_con_miembro_responde_403` |
| backend | `backend/tests/test_payments.py` | `test_get_payment_sin_token_responde_401` |
| backend | `backend/tests/test_payments.py` | `test_get_payment_con_miembro_responde_403` |
| backend | `backend/tests/test_payments.py` | `test_coach_lista_y_lee_un_pago` |
| backend | `backend/tests/test_payments.py` | `test_coach_no_puede_anular_un_pago` |
| backend | `backend/tests/test_attendance.py` | `test_list_attendance_sin_token_responde_401` |
| backend | `backend/tests/test_attendance.py` | `test_list_attendance_con_miembro_responde_403` |
| backend | `backend/tests/test_attendance.py` | `test_coach_lista_el_historial_de_asistencias` |
| frontend | `frontend/src/lib/__tests__/navigation.test.ts` | `isPublicPath reconoce /login y /invitacion/:channel/:token como publicas` |
| frontend | `frontend/src/lib/__tests__/navigation.test.ts` | `isPublicPath no marca publica una ruta protegida` |
| frontend | `frontend/src/lib/__tests__/http.test.ts` | `un 401 en una vista publica no toastea sesion expirada ni cierra la sesion` |
| frontend | `frontend/src/lib/__tests__/http.test.ts` | `un 401 en una vista protegida toastea sesion expirada y cierra la sesion` |
| frontend | `frontend/src/services/__tests__/settings.queries.test.tsx` | `no pide GET /settings cuando no hay sesion` |
| frontend | `frontend/src/services/__tests__/settings.queries.test.tsx` | `pide GET /settings cuando hay token en la sesion` |
| manual | — | Con `make dev` y `make seed-dev`: en ventana privada abrir `http://localhost:5173/login`, confirmar que no aparece toast de "sesión expirada" y que la pestaña Network no muestra ningún `GET /settings`; entrar con `dev.owner@miniespacio.local` / `devdev123` y confirmar que `/settings`, `/payments` y `/attendance` cargan datos; guardar un cambio en Ajustes y confirmar que persiste tras F5; desloguear, entrar con `dev.member@miniespacio.local` y confirmar que `/my-routine` funciona y que el sidebar no ofrece Pagos, Asistencias ni Ajustes. |
| manual | — | Contra el backend levantado (`make backend`): `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8001/settings http://127.0.0.1:8001/payments/ http://127.0.0.1:8001/attendance/` debe imprimir `401` tres veces. |
