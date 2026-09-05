## Context

Hoy hay **dos tablas para la misma persona**:

- `users` (`backend/app/models.py:17`): `id`, `full_name`, `email` (UNIQUE NOT NULL), `password_hash`
  (NOT NULL), `email_verified`, `role` (enum `owner|coach|user`), `client_id` (FK opcional 1:1 a
  `clients`), `is_active`, `created_at`, `theme_preference`.
- `clients` (`backend/app/models.py:30`): `id`, `full_name`, `phone`, `email` (no único),
  `join_date`, `is_active`, `created_by_user_id`.

El historial cuelga **de `clients`**: `payments.client_id`, `attendances.client_id`,
`workout_logs.client_id` (los tres FK a `clients.id`). Las columnas de auditoría
(`created_by_user_id`, `coach_id`, `assigned_by_user_id`) cuelgan de `users.id`.

Hallazgos de CodeGraph / lectura que condicionan el diseño:

1. **`TrainingDayExercise` NO referencia clientes.** Tiene `day_id`, `exercise_id`,
   `assigned_by_user_id` (FK a `users`). La asignación de rutinas hoy es **global** (un set de
   ejercicios activos por día, igual para todos), no por persona. El proposal la lista en el
   remap de FKs, pero no hay `client_id` que remapear: queda fuera, y la feature "asignar rutina a
   un miembro" (declarada fuera de alcance) será la que agregue esa columna.
2. **Ya existe la lógica de "al día"**, inline en `routers/clients.py::client_status`
   (`clients.py:138-166`), con `utils.current_period()`. El frontend tiene una segunda
   implementación con otra semántica (`services/payments.ts::getPaidClientIds` /
   `getPendingClients`): "quién no pagó *este período puntual*", que alimenta Dashboard.
3. **El link cuenta↔cliente ya existe y se usa**: `routers/clients.py` `GET/POST
   /clients/{id}/portal-access` y `routers/auth.py::client_register` crean un `User` con
   `client_id`, y `routers/routines.py::_get_user_client_or_403` resuelve todo el portal del
   miembro a través de él. Cualquier fila con `users.client_id IS NOT NULL` es un par que hay que
   colapsar.
4. **`_build_token_for_user` (`routers/auth.py:14`) mete `client_id` en el JWT**, y
   `stores/session.ts` deriva el rol del JWT. Sacar la columna sin tocar eso rompe el login.
5. **`get_current_user` devuelve 403 si `email_verified is False`** (`auth.py:55`). Hay incluso un
   script de rescate (`backend/scripts/mark_coaches_verified.py`). Si la migración deja staff
   existente con `email_verified=False`, se quedan afuera del sistema.
6. **`DELETE /coaches/{id}` borra físicamente un `User`** (`routers/coaches.py`), y `DELETE
   /clients/{id}` borra un cliente con cascade a pagos/asistencia/rutinas. Ambos contradicen
   "no hay eliminación física".
7. **La suite de tests corre sobre SQLite de archivo** con `Base.metadata.create_all()`
   (`backend/tests/conftest.py`): las migraciones no se ejecutan ahí y **nada que use `date_trunc`
   es testeable**. Esto condiciona cómo se calcula el indicador de pago.
8. `codegraph impact Client` → 22 símbolos: `types.ts` (`Client`, `EmbeddedClient`, `Payment`,
   `Attendance`), `pages/Clients.tsx`, `pages/Dashboard.tsx`, `pages/UserRoutine.tsx`,
   `components/UserCard.tsx`, `components/EditClientDialog.tsx`, `components/SpotlightSearch.tsx`.
   `codegraph impact RegisterClient` → solo `pages/RegisterClient.tsx` y `App.jsx` (más su test y
   el link de `Login.tsx:166`, que no es una arista de código sino un string de ruta).

Restricciones: base única PostgreSQL (Supabase) de un gimnasio chico — el volumen de filas es de
cientos, no millones; una ventana de mantenimiento de minutos es aceptable. Sin cola de jobs, sin
proveedor de email ni de WhatsApp contratado hoy.

## Goals / Non-Goals

**Goals:**

- Una sola tabla `users` con perfil completo, rol y estado de membresía; `clients` desaparece.
- Migración Alembic que mueve **esquema y datos** en un solo paso atómico, preservando pagos,
  asistencia y rutinas, y colapsando los pares cuenta↔cliente ya linkeados.
- ABM de usuarios sin eliminación física, con permisos por rol, y el indicador de pago calculado
  en el servidor en tiempo real.
- Flujo de invitación con dos canales verificables por separado, expiración de 7 días y reenvío
  que invalida el anterior.
- Retiro completo de `/register-client` y `POST /auth/client-register`.

**Non-Goals:**

- Asignación de rutinas por miembro (`TrainingDayExercise` sigue global).
- Contratar/integrar un proveedor de WhatsApp Business API (ver dec. 12).
- Recuperación de contraseña / cambio de contraseña por el propio usuario.
- Limpiar el copy "Clientes" en specs fuera de este change (`app-shell`, `dashboard-view`, etc.),
  ya declarado como seguimiento en el proposal.
- Migrar `NewPaymentDialog`/`UserCard` a `useMutation` (deuda del change de TanStack Query).

## Decisions

### 1. Una tabla `users` fusionada, no dos tablas con una vista

**Decisión**: `clients` se elimina; sus columnas y su historial pasan a `users`.

Alternativa considerada — **mantener las dos tablas y exponer una vista `v_users` unificada**:
evita la migración de datos riesgosa y no toca las FKs. Descartada porque no resuelve ninguno de
los tres problemas del proposal: seguiría habiendo dos filas por persona que sincronizar (una
vista no es escribible sin triggers), un Coach seguiría sin poder ser miembro sin duplicarse, y el
ABM tendría que decidir en cada escritura a qué tabla va cada campo. Cambia el costo de "una
migración dolorosa una vez" por "complejidad permanente en cada escritura".

Alternativa considerada — **`users` + tabla satélite `memberships` (1:1)**: más ortodoxo
relacionalmente y deja `users` chica. Descartada: la relación es 1:1 estricta y siempre se lee
junta (el listado necesita rol + fecha de comienzo + estado de pago en la misma fila), así que
solo agrega un JOIN a toda consulta; y el volumen (cientos de filas) no justifica separar.

### 2. Esquema de la tabla `users` fusionada

| Columna | Tipo | Null | Origen / nota |
|---|---|---|---|
| `id` | String PK | no | **se preserva `users.id`** (ver dec. 5) |
| `first_name` | String | no | split de `full_name` |
| `last_name` | String | **sí** en DB | requerido en el schema de alta; nullable en DB porque el backfill no lo puede garantizar |
| `birth_date` | Date | sí | edad **derivada**, nunca almacenada |
| `weight_kg` | Float | sí | |
| `height_cm` | Float | sí | unidad explícita en el nombre |
| `email` | String | **sí** (pasa a nullable) | UNIQUE **parcial** `WHERE email IS NOT NULL` |
| `email_verified` | Boolean | no, default False | ya existe |
| `phone` | String | sí | ← `clients.phone` |
| `phone_verified` | Boolean | no, default False | nuevo |
| `password_hash` | String | **sí** (pasa a nullable) | NULL = sin acceso de login todavía |
| `role` | Enum `owner\|coach\|member` | no | ver dec. 3 |
| `membership_status` | Enum `none\|active\|cancelled` | no, default `none` | ver dec. 4 |
| `membership_start_date` | DateTime | sí | ← `clients.join_date` ("fecha de comienzo en el gimnasio") |
| `membership_cancelled_at` | DateTime | sí | fecha de baja; cargable a mano (retroactiva) o `now()` por default; vuelve a NULL al reactivar |
| `is_active` | Boolean | no, default True | **cuenta** habilitada, NO membresía |
| `created_at` | DateTime | no | "fecha de alta (creación del registro)" |
| `created_by_user_id` | String FK `users.id` | sí | ← `clients.created_by_user_id`, ahora auto-FK |
| `theme_preference` | String | sí | ya existe |
| `legacy_client_id` | String | sí, indexado | **temporal**, ver dec. 6 |
| ~~`client_id`~~ | — | — | **se elimina** |

**`full_name` como `hybrid_property`, no como columna.** El nombre completo lo consumen hoy
`payments`/`attendance` embebidos, `SpotlightSearch`, `UserCard`, el PDF de progreso y el `ORDER
BY` / `ilike` del listado. Un `hybrid_property` de SQLAlchemy da las dos caras con una sola
definición: a nivel instancia concatena en Python; a nivel clase emite
`first_name || ' ' || coalesce(last_name,'')`, así que `filter`, `order_by` y `ilike` siguen
funcionando igual que hoy.
Alternativas: (a) **columna `full_name` persistida** mantenida por la app — descartada, duplica
el dato y deriva en cuanto alguien escriba por SQL; (b) **columna generada de Postgres
(`GENERATED ALWAYS AS`)** — descartada porque la suite corre sobre SQLite con `create_all()` y no
la soporta, dejando el ordenamiento del listado sin cobertura.

**`email` nullable con UNIQUE parcial.** La spec exige poder dar de alta con solo nombre, apellido
y rol, y `email` es hoy `UNIQUE NOT NULL` y a la vez el identificador de login. Un índice único
parcial (`CREATE UNIQUE INDEX ... WHERE email IS NOT NULL`) permite N filas sin email y sigue
garantizando un solo login por dirección.
Alternativa: **placeholder sintético** (`sin-email-<uuid>@local`) para conservar el `NOT NULL` —
descartada: contamina el dato, se filtra a la UI y a los `mailto:`, y hay que acordarse de
filtrarlo en cada query.

**`password_hash` nullable.** Es la señal canónica de "no tiene acceso al portal": la usa el guard
de login (dec. 11) y el estado de invitación (dec. 10). Alternativa: un booleano
`has_portal_access` aparte — descartada, es un segundo dato que puede contradecir al primero.

### 3. Rol: renombrar el valor `user` → `member`

**Decisión**: el enum pasa a `owner | coach | member`, con `ALTER TYPE userrole RENAME VALUE
'user' TO 'member'`.

Después de fusionar, **todo el mundo es un `User`**: un rol llamado `user` deja de significar
nada. El costo es acotado y mecánico: `models.UserRole.user`, `schemas.Role`, los
`require_role(UserRole.user)` de `routers/routines.py`, `types.ts::Role`, `ProtectedRoute
roles={["user"]}`, los dos `role === "user"` de `App.jsx` y `Sidebar.tsx` — todos archivos que
este change ya toca.

Alternativa considerada — **dejar el valor `user` en el wire y cambiar solo el copy**: cero
riesgo de migración, pero deja el término más ambiguo del dominio incrustado en el JWT, en las
rutas protegidas y en los tests, justo en el change que existe para desambiguarlo. Descartada.

**Compatibilidad con tokens en vuelo**: los JWT emitidos antes del deploy traen `role: "user"` y
`client_id`. Se agrega un `normalizeRole()` en `stores/session.ts` que mapea `"user" → "member"`
(mismo patrón que el `normalizeThemeMode` de `lib/theme.ts`), y `_build_token_for_user` deja de
emitir el claim `client_id`. Sin el normalizador, todo el que tenga sesión abierta queda con un
rol desconocido y sin rutas.

Si el `ALTER TYPE ... RENAME VALUE` diera problema en la versión de Postgres de Supabase, el
fallback es crear un tipo nuevo y castear la columna (`ALTER TABLE users ALTER COLUMN role TYPE
userrole_new USING ...`).

### 4. Membresía: un enum de tres estados + fecha de baja, y **dos derivaciones separadas**

**Decisión**: `membership_status ∈ {none, active, cancelled}` + `membership_cancelled_at`.

Las specs piden distinguir **tres** situaciones, no dos:
- indicador del listado: sin círculo para `none`, verde/naranja para `active`, rojo para
  `cancelled`;
- columna "fecha de comienzo en el gimnasio": para `active` **y** `cancelled` ("miembro activo o
  dado de baja"), vacía para `none`;
- "rutinas, asistencia y pagos aplican únicamente a usuarios con membresía activa".

Alternativa considerada — **dos booleanos `is_member` + `membership_active`**: expresa lo mismo
pero admite el estado imposible `is_member=false, membership_active=true`, que hay que defender en
cada escritura. El enum lo hace irrepresentable.

**`membership_cancelled_at`**: la baja acepta una fecha manual (puede ser retroactiva) y, si no se
indica, se completa con `now()`. Al reactivar vuelve a `NULL`, porque el campo significa "fecha de
la baja **vigente**", no "última vez que se dio de baja". Trade-off: no queda historial de ciclos
baja/reactivación. Alternativa considerada — tabla de eventos `membership_events` — descartada:
ninguna spec pide auditoría de la membresía y agregar una tabla de historial para un campo que se
consulta en presente es costo sin demanda; si aparece el requisito, la tabla se agrega sin tocar
el modelo actual.

#### Las dos derivaciones no se tocan entre sí

Este es el punto que más fácil se acopla mal, porque las specs lo dicen explícitamente al revés de
como suena la intuición: **el color rojo y el bloqueo de login no son lo mismo**
(`payment-status-indicator`, "El rojo refleja el estado de membresía, no directamente el acceso").
Un Coach-miembro dado de baja **se ve rojo y sigue entrando**.

| | Depende de | NO depende de | Vive en |
|---|---|---|---|
| **(a) `membership_indicator(user)`** → `none \| up_to_date \| overdue \| suspended` | `membership_status` + período del último pago | **el rol** | `app/utils.py` (regla de negocio/presentación, junto a `current_period()`) |
| **(b) `is_membership_blocking_login(user)`** → bool | `role == member` **y** `membership_status == cancelled` | **los pagos** | `app/auth.py` (regla de acceso, junto a `get_current_user`/`require_role`) |

La separación es **física, en módulos distintos**, no solo conceptual: si las dos vivieran en el
mismo helper, el próximo que toque una va a tener la otra a la vista y la tentación de reusar la
condición. Una mora nunca puede bloquear un login, y un rol nunca puede cambiar un color.

**Independencia de `is_active`**: `is_active` es la cuenta (deshabilitada a mano por un admin),
`membership_status` es la suscripción. Dar de baja la membresía **no** toca `is_active` — el
bloqueo de login del rol Miembro se deriva en (b), no se materializa apagando la cuenta. Si lo
materializáramos en `is_active`, reactivar la membresía tendría que acordarse de volver a
encenderla, y una cuenta deshabilitada a mano antes de la baja se reactivaría sola.

**Un Dueño/Coach que también entrena**: `role=owner|coach` + `membership_status=active`. Sus
permisos los define solo `role`, que no se toca — el requirement "conserva sus permisos de Coach"
sale gratis del modelo, y el escenario "Coach-miembro dado de baja se ve rojo pero conserva el
acceso" sale gratis de que (b) mira el rol y (a) no.

### 5. Remap de FKs: la fila que sobrevive es la de `users`

`payments.client_id`, `attendances.client_id`, `workout_logs.client_id` → `user_id`, FK a
`users.id`.

Cuando existe un par (`users.client_id = clients.id`), hay que elegir **qué `id` sobrevive**:

- **Conservar `clients.id`**: cero filas de historial a reescribir, pero cambia el `id` de una
  cuenta que ya está referenciada en `created_by_user_id`, `coach_id`, `assigned_by_user_id`
  (`routines.py::create_my_workout_log` graba `created_by_user_id = current_user.id`, o sea el
  propio miembro) y en el claim `sub` de los JWT vivos.
- **Conservar `users.id`** ← **elegida**: hay que reescribir el `client_id` de las filas de
  historial de ese cliente, pero es un conjunto acotado y conocido (solo los clientes linkeados),
  y ninguna otra tabla ni ningún token referencia `clients.id`.

Para los clientes **sin** cuenta linkeada (la mayoría) se inserta una fila nueva **reusando
`clients.id` como `users.id`**, así su historial no necesita ninguna reescritura.

`ondelete`: los FKs nuevos a `users.id` van con **`RESTRICT`** en vez del `CASCADE` actual. Con
"no hay eliminación física" como requirement, un `CASCADE` solo puede servir para borrar historial
por accidente; `RESTRICT` convierte ese accidente en un error. Se quitan también los
`cascade="all, delete-orphan"` de las relaciones ORM.

`uq_payment_period` pasa a `(user_id, period_month, period_year)`.

### 6. Migración: una sola revisión Alembic (esquema + datos) + script de pre-vuelo read-only

**Decisión**: **los datos se migran dentro de la misma revisión Alembic**, no en un script aparte.

El esquema nuevo no es desplegable sin los datos ya movidos (en el momento en que `payments.user_id`
apunta a `users`, las filas tienen que existir ahí). Un script separado abriría una ventana con la
app rota. Postgres tiene DDL transaccional, así que toda la revisión es atómica: o entra completa o
no entra.

Lo que **sí** va aparte es un **pre-vuelo de solo lectura**,
`backend/scripts/preflight_unify_users.py`, que se corre contra producción **antes** y reporta:
1. `clients.email` que colisionan con un `users.email` existente sin estar linkeados;
2. `users.full_name` / `clients.full_name` de una sola palabra (el split deja `last_name` NULL);
3. clientes sin email y sin teléfono (no van a poder ser invitados);
4. conteo de pares linkeados y de filas de historial a reescribir;
5. **la lista nominal de `clients` con `is_active = false` que además tienen cuenta de portal
   linkeada** — es exactamente la gente a la que le deja de funcionar el login el día del deploy
   (ver más abajo). El gimnasio tiene que ver esa lista *antes*, no enterarse por un reclamo.

Orden de la revisión:

1. Agregar todas las columnas nuevas a `users` como **nullable**, sin default de servidor que
   fuerce un rewrite innecesario.
2. `users.email` → nullable; drop del UNIQUE plano; crear índice único parcial
   `WHERE email IS NOT NULL`. `users.password_hash` → nullable.
3. Backfill de las filas `users` existentes: split de `full_name` (primer token → `first_name`,
   el resto → `last_name`, `NULL` si es una sola palabra), `membership_status='none'`,
   `phone_verified=false`. **`email_verified = TRUE` para todo usuario existente con
   `password_hash` no nulo** — si no, el chequeo de `auth.py:55` deja afuera a todo el staff
   (ver Context, punto 5).
4. Insertar una fila `users` por cada `clients` **sin** cuenta linkeada, con `users.id =
   clients.id`, `role='member'`, `password_hash=NULL`, `email_verified=false`,
   `membership_start_date = clients.join_date`, `membership_status = 'active' if clients.is_active
   else 'cancelled'`, `is_active=true`, `legacy_client_id = clients.id`.
   **Colisión de email**: si `clients.email` ya existe en `users`, se inserta con `email = NULL` y
   se deja registro en el log de la migración. **No** se auto-mergea por email: dos direcciones
   iguales *probablemente* son la misma persona, pero un merge equivocado fusiona el historial de
   dos personas y es irreversible. El pre-vuelo existe para que un humano resuelva esos casos antes.

   **Qué fecha de baja reciben los `clients.is_active = false`** (decisión explícita, porque ahora
   una baja de rol Miembro bloquea el login): se migran como `membership_status = 'cancelled'` con
   `membership_cancelled_at = <timestamp de la migración>`.

   - **No** se migran como `active`: `clients.is_active = false` ya significaba hoy "no opera en
     cobros ni asistencia" — es la semántica que usan el ABM y el listado actuales. Mapearlo a
     `active` inventaría un dato y los mostraría en naranja, como si debieran la cuota del mes.
   - **No** se dejan con `membership_cancelled_at = NULL`: una baja sin fecha es justamente el
     agujero que la spec nueva viene a cerrar, y dejaría gente bloqueada sin registro de cuándo ni
     por qué.
   - El timestamp de la migración es **honesto sobre lo que sabemos**: no sabemos cuándo fue la
     baja real (el dato nunca existió), sabemos que ya estaba de baja al migrar. Y es corregible:
     el campo acepta fechas retroactivas precisamente para esto, así que el admin puede ajustarlo
     desde el ABM sin tocar la base.

   Consecuencia operativa: los que además tengan cuenta de portal (`password_hash` no nulo) **y
   cuyo rol sea Miembro** pierden el login en el deploy (`is_membership_blocking_login` solo mira
   el rol Miembro, dec. arriba). Un Dueño/Coach que también entrena (mismo escenario, "Un
   Dueño/Coach que también entrena" más arriba) conserva su rol y su acceso — solo pierde el
   seguimiento de pagos/asistencia/rutinas. Es el comportamiento correcto según la spec nueva, pero
   es un cambio visible para personas reales, así que sale en el pre-vuelo (ítem 5, acotado a rol
   Miembro) con nombre y email para que el gimnasio avise o reactive antes de migrar.
5. Para cada par linkeado (`users.client_id IS NOT NULL`): copiar el perfil del cliente sobre la
   fila `users` (phone, `membership_start_date`, `membership_status`, `legacy_client_id`),
   dejando **email y nombre de `users` como autoritativos** (son los de la cuenta con la que la
   persona ya se loguea). **El rol NO se toca**: ya es el correcto desde antes de esta migración
   (owner/coach/user) — un Dueño o Coach que además entrena llega acá con `client_id` seteado pero
   su rol administrativo, y pisarlo con `'member'`/`'user'` le borraría los permisos (contradice el
   escenario "Un Dueño/Coach que también entrena" de más arriba). Reescribir
   `payments/attendances/workout_logs` de `client_id = clients.id` a `users.id`.
6. Renombrar la columna `client_id` → `user_id` en las tres tablas, rehacer FKs (→ `users.id`,
   `RESTRICT`), índices y `uq_payment_period`.
7. Drop de `users.client_id` (FK + índice único) y **drop de la tabla `clients`**.
8. `ALTER TYPE userrole RENAME VALUE 'user' TO 'member'`.
9. `SET NOT NULL` en `first_name`, `membership_status`, `phone_verified`, `email_verified`.

**Rollback**: `downgrade()` **levanta `NotImplementedError`**. Una vez fusionadas las filas, la
información de "cuál era cuenta y cuál era ficha" no es reconstruible con fidelidad (los campos de
perfil copiados no tienen a dónde volver). La estrategia de rollback real es **snapshot de la base
inmediatamente antes de `alembic upgrade head`** y restore. La columna `legacy_client_id` queda
como rastro de auditoría para poder cruzar contra el snapshot; se borra en un change posterior,
una vez validado el resultado en producción.
Alternativa considerada — **expand/contract en dos deploys** (escribir en las dos tablas un
tiempo, luego contraer): es lo correcto para un sistema con tráfico 24/7 y rollback caliente
obligatorio. Descartada por costo/beneficio: un gimnasio, una base chica, una ventana de
mantenimiento de minutos es aceptable, y el doble-escritura triplica el trabajo de esta migración.

### 7. `routers/clients.py` → `routers/users.py`, sin router de compatibilidad

**Decisión**: se renombra el archivo y el prefijo (`/clients` → `/users`). No queda alias.

El único consumidor de `/clients` es el frontend de este repo, que se actualiza en el mismo change
(regla dura del rol: cambio de contrato ⇒ task de cliente en el mismo change). Un router alias
dejaría dos contratos para mantener sincronizados y código muerto permanente. Riesgo asumido: el
change `add-expo-mobile-app` (todavía no implementado) tendrá que nacer contra `/users`.

`routers/coaches.py` **se elimina** y se pliega sobre `/users`: hoy es un segundo camino de
escritura sobre la misma tabla con reglas distintas (fuerza `email_verified=True`, setea password
directo, y su `DELETE` borra físicamente un usuario, contra el requirement). `GET /coaches` pasa a
ser `GET /users?role=coach`, `POST /coaches` a `POST /users` con `role=coach`.

Contrato de `/users`:

| Método | Ruta | Rol | Nota |
|---|---|---|---|
| `GET` | `/users` | owner, coach | filtros `q`, `role`, `membership_status`; `limit`/`offset`; `X-Total-Count` + `Link` como hoy |
| `GET` | `/users/{id}` | owner, coach | |
| `POST` | `/users` | owner (cualquier rol), coach (solo `member`) | |
| `PATCH` | `/users/{id}` | owner (cualquiera, incluido cambiar rol), coach (solo usuarios `member`) | |
| `POST` | `/users/{id}/membership/activate` | owner, coach | `none`/`cancelled` → `active`; **limpia `membership_cancelled_at`** (restaura el acceso si el rol es Miembro) |
| `POST` | `/users/{id}/membership/cancel` | owner, coach | `active` → `cancelled`; body opcional `{ cancelled_at?: datetime }`, default `now()`; admite fecha retroactiva |
| `GET` | `/users/{id}/status` | owner, coach | el `ClientStatus` de hoy, renombrado `UserPaymentStatus` |
| `POST` | `/users/{id}/invitation` | owner, coach | crear o reenviar (dec. 10) |
| ~~`DELETE`~~ | — | — | **no existe** (tampoco `DELETE /coaches/{id}`) |

Los `GET/POST /clients/{id}/portal-access` desaparecen: los reemplaza la invitación.

**Membresía por endpoints dedicados, no por `PATCH`**: `is_active` (cuenta) y `membership_status`
(suscripción) son dos campos de nombre parecido en la misma fila; exponer la baja como un campo más
del `PATCH` es la forma más directa de que alguien deslogueé a un miembro creyendo que lo daba de
baja. Dos endpoints con nombre explícito hacen la intención inequívoca y auditable. Costo: dos
rutas más.

**Permisos por rol**: una dependencia `require_can_manage_user(target)` centraliza la regla (owner:
todo; coach: solo si `target.role == member` **y** el `role` del payload es `member`). Va en
`app/deps.py` junto al resto de dependencias inyectables, no reimplementada por endpoint
(convención del `backend/AGENTS.md`).

### 8. Indicador de 3 estados: un solo valor derivado en el servidor, calculado con aritmética entera

**Decisión**: `UserOut` expone **`membership_indicator: "none" | "up_to_date" | "overdue" |
"suspended"`**, derivado en el servidor. El frontend mapea valor → color y nada más; no recibe
`payment_up_to_date` ni recalcula nada.

Un enum de 4 valores en vez de `bool | null`: con tres colores + ausencia, un booleano ya no
alcanza, y mandar `membership_status` + `payment_up_to_date` por separado obligaría al cliente a
reimplementar la precedencia ("`suspended` gana sobre cualquier estado de pago"), que es
exactamente la regla que la spec pone en el servidor. Un solo campo derivado hace imposible que la
tabla y la ficha muestren cosas distintas.

La regla vive en `app/utils.py`, junto a `current_period()`, en dos formas que comparten
definición:

- `membership_indicator(status, last_month, last_year, ref=None)` — pura, para `GET
  /users/{id}/status` y para los tests.
- una expresión SQL equivalente para el listado: un `CASE` sobre `membership_status` que, solo
  para `active`, compara `MAX(period_year * 12 + period_month)` de los pagos del usuario contra
  `current_year * 12 + current_month`, vía subconsulta correlacionada en `GET /users`. Para
  `cancelled` y `none` el `CASE` corta antes y ni mira los pagos — que es literalmente lo que dice
  la spec ("el estado rojo SHALL calcularse a partir del estado explícito de membresía, no de los
  pagos").

Dos razones para la aritmética entera en vez de fechas:

1. **Evita el N+1**: el indicador de todas las filas de la página sale en la misma consulta que el
   listado, en vez de una query de pagos por usuario.
2. **Es testeable**: la suite corre sobre SQLite y no puede ejercitar nada que use `date_trunc`
   (`backend/AGENTS.md`). `period_year * 12 + period_month` funciona igual en los dos motores, así
   que el requirement "cálculo en tiempo real" queda cubierto por tests reales y no por inspección.

Nada se cachea en columna. **Este cálculo no mira el rol** (dec. 4): un Coach-miembro dado de baja
devuelve `suspended` igual que un Miembro dado de baja, aunque uno siga entrando y el otro no.

`services/payments.ts::getPaidClientIds` / `getPendingClients` del frontend **se mantienen**:
responden otra pregunta (quién no pagó *un período dado* dentro de una muestra, para el Dashboard y
los recordatorios). Lo que **no** se hace es calcular el círculo del listado en el cliente.

### 9. Modelo de la invitación: una fila viva por usuario, **dos** tokens

Tabla `member_invitations`:

| Columna | Nota |
|---|---|
| `id` | uuid str PK |
| `user_id` | FK `users.id`, NOT NULL, index |
| `email_token_hash` | SHA-256 del token de email, UNIQUE |
| `phone_token_hash` | SHA-256 del token de whatsapp, UNIQUE |
| `created_at`, `expires_at` | `expires_at = created_at + 7 días` |
| `email_verified_at`, `phone_verified_at` | nullable |
| `completed_at`, `revoked_at` | nullable |
| `created_by_user_id` | FK `users.id` |

**Dos tokens, no uno con parámetro de canal.** La spec exige verificación *independiente* por
canal. Con un solo token y `?canal=email|whatsapp`, quien recibe únicamente el email puede editar
la URL y marcar el celular como verificado: la verificación deja de verificar nada. Dos secretos
independientes hacen que "verificado" signifique de verdad "el mensaje llegó a ese canal".

**Se guarda el hash, no el token.** Mismo criterio que `password_hash`: un dump de la base no debe
alcanzar para tomar cuentas. El token en claro solo existe en memoria durante la request que lo
genera y en el mensaje que se entrega.

**Reenvío = revocar + insertar**, no update in place: se pone `revoked_at = now()` en la fila viva
y se crea una nueva. Un índice único parcial sobre `user_id WHERE revoked_at IS NULL AND
completed_at IS NULL` garantiza a lo sumo **una invitación viva** por usuario, que es exactamente
el requirement "el reenvío invalida el link anterior", impuesto por la base y no por la app.
Alternativa (update in place) descartada: pierde el rastro de cuántas veces se persiguió a alguien.

Un link es válido si `revoked_at IS NULL AND completed_at IS NULL AND expires_at > now()`.

### 10. Endpoints de invitación

Públicos (sin auth: el token *es* la credencial), en `routers/invitations.py`:

- `GET /invitations/{channel}/{token}` — valida y, si el link está vivo, **marca ese canal como
  verificado** y devuelve `{ first_name, email_verified, phone_verified, can_set_password }`.
  Errores diferenciados: `410` si expiró o fue revocado, `404` si el token no existe, `409` si ya
  se completó.
- `POST /invitations/{channel}/{token}/complete` — body `{ password }`. Rechaza con `409` +
  detalle de qué canal falta si `email_verified_at`/`phone_verified_at` no están ambos. Si pasa:
  setea `password_hash`, `email_verified=True`, `phone_verified=True` en el usuario,
  `completed_at` en la invitación, y devuelve el JWT (mismo `_build_token_for_user`) para que el
  miembro quede logueado, igual que hacía `/auth/client-register`.

  Se pide **un solo token** (el del canal desde el que está navegando), no los dos, porque el
  caso real es abrir el mail en la notebook y el WhatsApp en el teléfono: exigir los dos en la
  misma request obliga a copiar un token a mano entre dispositivos. Para ese punto el servidor ya
  registró las dos verificaciones, así que el segundo token no agrega garantía práctica.

  Antes de emitir el JWT pasa por el gate de membresía de la dec. 11: si le dieron de baja mientras
  la invitación estaba en curso, la contraseña se guarda pero no se entrega token. Completar la
  invitación habilita el login **solo mientras la membresía siga activa** (`member-invitation`), y
  la baja no tiene por qué esperar a que el miembro termine un flujo que empezó antes.

Autenticado (owner/coach), en `routers/users.py`:

- `POST /users/{id}/invitation` — crea **o reenvía** (misma ruta: siempre revoca la viva y emite
  una nueva; es idempotente en intención). Rechaza con `400` si `role != member`, si falta
  `phone` (requirement explícito) o si falta `email`; con `409` si el usuario ya tiene
  `password_hash` (acceso activo). Devuelve los dos links en claro **en la respuesta**, para que
  la UI pueda mostrarlos/copiarlos (ver dec. 12).

`UserOut` expone `invitation_status: "none" | "pending" | "expired" | "access_active"`, derivado:
`access_active` si `password_hash IS NOT NULL`; si no, según la invitación viva.

### 11. Login bloqueado: dos gates independientes, en dos puntos de enforcement

Hay **dos** motivos distintos por los que alguien no puede entrar, y no hay que mezclarlos (dan
mensajes distintos y se resuelven de formas distintas):

| Gate | Condición | Aplica a | Mensaje |
|---|---|---|---|
| **Invitación pendiente** | `password_hash IS NULL` | cualquier rol | "Tu invitación está pendiente de completar" |
| **Membresía dada de baja** | `is_membership_blocking_login(user)` → `role == member AND membership_status == cancelled` | **solo rol Miembro** | "Tu membresía está dada de baja" |

El gate de membresía **es el de la dec. 4 (b)** — la misma función, no una copia de la condición.
Un Dueño o Coach con la condición de miembro dada de baja pasa este gate sin problema, que es el
requirement explícito de `user-management`.

Y hay **dos puntos de enforcement**, no uno:

- **`POST /auth/token`**: el gate de invitación pendiente tiene que ir **antes** de
  `verify_password` — llamar a passlib con un hash `None` revienta con excepción, no devuelve
  `False`.
- **`get_current_user`**: sin esto, dar de baja a un Miembro **no lo saca del sistema hasta 10
  horas después**. `ACCESS_TOKEN_EXPIRE_MINUTES` es 600 (`config.py`), así que el JWT que ya tiene
  en el navegador sigue siendo válido y sigue operando. La spec dice "ya no puede iniciar sesión",
  pero el espíritu del requirement (rojo = "usuario deshabilitado, sin acceso a la aplicación",
  proposal) no se cumple si la sesión abierta sobrevive el resto del día.

En `get_current_user` el rechazo va con **401, no 403**: el interceptor de respuesta de
`frontend/src/lib/http.ts` redirige a `/login` y toastea solo en 401 (`frontend/AGENTS.md`). Un 403
dejaría al usuario dado de baja mirando un shell roto con un toast de error en cada request, en vez
de salir limpio a la pantalla de login. Es el mismo tratamiento que ya recibe el chequeo de
`email_verified` de al lado.

Se eliminan `POST /auth/client-register`, `schemas.ClientRegisterIn` y el claim `client_id` de
`_build_token_for_user`.

### 12. Entrega del link: SMTP por biblioteca estándar + WhatsApp por `wa.me` disparado por el admin

**Decisión**: se define una interfaz `NotificationSender` en `app/notifications.py`
(`send_invitation_email(to, link)`), con dos implementaciones seleccionadas por
`NOTIFICATIONS_BACKEND` en `config.py`:

- `"log"` (**default**, y lo que usa la suite de tests): escribe el link en `backend/logs/`.
- `"smtp"`: `smtplib` de la biblioteca estándar con `SMTP_HOST/PORT/USER/PASSWORD/FROM` en `.env`
  — **sin dependencia nueva**.

Para **WhatsApp no se integra ninguna API**: el `POST /users/{id}/invitation` devuelve el link de
canal whatsapp y la UI ofrece un botón que abre `https://wa.me/<phone>?text=<link>` en una pestaña
nueva. Es **el patrón que este repo ya usa** para los recordatorios de pago
(`pages/Clients.tsx::openPaymentReminder`, `Dashboard.tsx`, `UserCard.tsx`): el admin hace un click
y el mensaje sale de su propio WhatsApp.

Alternativa considerada — **WhatsApp Business Cloud API (Meta)**: es la única forma de entrega
*automática*, pero exige verificación de negocio, un número dedicado, plantillas aprobadas por Meta
y costo por conversación; más un SDK/HTTP client y credenciales que hoy no existen. Meter eso acá
convierte un change de modelo de datos en un proyecto de integración. Descartada.
Alternativa considerada — **un proveedor de email transaccional (Resend/SendGrid)**: mejor
entregabilidad que SMTP crudo, pero es una dependencia + una cuenta + una API key para un volumen
de decenas de mails por mes. SMTP con stdlib cubre el caso sin agregar nada al `requirements.txt`.

**Consecuencia que hay que mirar de frente**: con esta decisión el sistema **no entrega el link por
WhatsApp de forma automática** — lo entrega un humano en un click. La spec `member-invitation` dice
"el sistema SHALL entregar el link ... tanto al email como al número de celular (WhatsApp)". Ver
"Huecos de spec detectados".

### 13. Frontend: rename de vista + ruta, con redirect de compatibilidad

- `pages/Clients.tsx` → `pages/Users.tsx`; ruta `/clients` → `/users`, más un
  `<Route path="/clients" element={<Navigate to="/users" replace />} />` para no romper links
  guardados. Actualizar la clave de `lib/routePreload.ts` (es la fuente del `lazy()` de `App.jsx`
  **y** del preload en hover del Sidebar: si se desincronizan, el preload deja de funcionar en
  silencio).
- `types.ts`: `Client` → `User` (perfil unificado: `first_name`, `last_name`, `full_name`,
  `birth_date`, `age`, `weight_kg`, `height_cm`, `email`, `email_verified`, `phone`,
  `phone_verified`, `role`, `membership_status`, `membership_start_date`,
  `membership_cancelled_at`, `created_at`, `is_active`, `membership_indicator`,
  `invitation_status`); `EmbeddedClient` → `EmbeddedUser`;
  `Payment.client_id`/`client` → `user_id`/`user`; ídem `Attendance` y `WorkoutLog.client_id`;
  `Role` pasa a `"owner" | "coach" | "member"`.
- `services/clients.ts` + `clients.queries.ts` → `users.ts` + `users.queries.ts`
  (`useUsersQuery`, `useCreateUserMutation`, `useUpdateUserMutation`,
  `useCancelMembershipMutation`, `useInviteUserMutation`); `queryKeys.clients` →
  `queryKeys.users`. Se mantiene la invalidación cruzada ya documentada (editar una persona
  invalida `users` + `payments` + `attendance`, porque esas respuestas la embeben).
- `EditClientDialog.tsx` → `EditUserDialog.tsx`: campos nuevos, sección de membresía (estado, fecha
  de comienzo, fecha de baja, "Dar de baja la membresía" con **selector de fecha opcional** que por
  default deja `now()`, y "Reactivar"), sección de invitación (estado + Invitar/Reenviar + copiar
  link + abrir WhatsApp). **Se borra** el bloque "Acceso del cliente (vista USER)" con su
  email+password. De paso pasa de `api.patch` directo a `useUpdateUserMutation`, que es la
  convención del repo (`frontend/AGENTS.md`) y hoy incumple.
  Al dar de baja a un usuario con **rol Miembro**, la confirmación tiene que decir que además
  pierde el acceso a la app; al dar de baja la condición de miembro de un Dueño/Coach, que **no**
  lo pierde. Es la única superficie donde esa asimetría es visible para quien la ejecuta.
- Listado: círculo verde / naranja / rojo / ausente **antes del nombre**, mapeando directo
  `membership_indicator` (`up_to_date` → verde, `overdue` → naranja, `suspended` → rojo, `none` →
  nada). **Sin lógica condicional en el componente**: si el frontend vuelve a combinar estado de
  membresía con estado de pago, se duplica la precedencia que la spec puso en el servidor. El
  círculo lleva `title`/`aria-label` con el estado en texto — un color solo no es accesible, y
  verde/naranja/rojo es la peor combinación posible para daltonismo.
  Columnas de la spec: nombre completo, rol, fecha de alta, fecha de comienzo en el gimnasio
  (vacía o "-" si `membership_status === 'none'`). Se conserva la columna **Acciones** (Editar +
  WhatsApp) — la spec fija las columnas de datos y no prohíbe acciones, y sin "Editar" no habría
  ABM.
- Nueva pantalla pública `pages/InvitationAccept.tsx` en `/invitacion/:channel/:token`, en la rama
  no autenticada de `App.jsx`. Ojo: esa rama se elige con
  `location.pathname.startsWith("/login") || startsWith("/register-client")` — hay que agregar
  `/invitacion` ahí o la pantalla se renderiza dentro del shell con sidebar y `ProtectedRoute` la
  patea al login. Estilo: hereda el de la vista de login (la spec `register-client-view` la señala
  como su reemplazo funcional).
- Rename de nav a "Usuarios": `Sidebar.tsx:26`, `Topbar.tsx:204`, `SpotlightSearch.tsx:139`
  (heading del `CommandGroup`) y el copy de `SpotlightSearch.tsx:120`.

### 14. Retiro de `/register-client`

`codegraph impact RegisterClient` acota el blast radius a cuatro puntos, todos de este repo:

1. `frontend/src/pages/RegisterClient.tsx` — borrar.
2. `frontend/src/pages/__tests__/RegisterClient.test.tsx` — borrar.
3. `frontend/src/App.jsx` — sacar el `lazy()` (línea 29), la `<Route path="/register-client">`
   (165) y la condición de `isAuthRoute` (45).
4. `frontend/src/pages/Login.tsx:166` — el botón "Registrar cuenta" que navega ahí queda apuntando
   a una ruta inexistente (caería en el `<Route path="*">` → `/login`). Hay que sacarlo, **pero eso
   contradice un requirement vigente de `login-view`** → ver "Huecos de spec detectados".

Backend: `POST /auth/client-register` y `schemas.ClientRegisterIn`.

### 15. Scripts y seeds existentes

`backend/scripts/` tiene `seed_clients.py`, `import_clients_csv.py`, `reset_clients.py`,
`seed_payments.py`, `seed_attendance.py`, `clients_template.csv`, `mark_coaches_verified.py`.
Todos escriben sobre `clients`/`client_id` y quedan rotos tras la migración. Decisión: **adaptar
los que siguen teniendo sentido** (`seed_users.py`, `import_users_csv.py`, `seed_payments`,
`seed_attendance`) y **borrar `mark_coaches_verified.py`**, cuya razón de existir la absorbe el
paso 3 de la migración. No son parte del arranque de la app, pero dejarlos rotos convierte la
próxima carga de datos en una sesión de arqueología.

## Risks / Trade-offs

- **Pérdida o mezcla de historial en la fusión** → pre-vuelo read-only obligatorio + snapshot de la
  base antes del `upgrade` + `downgrade()` que falla explícito (mejor que un downgrade que
  *parece* funcionar) + `legacy_client_id` como rastro de auditoría.
- **Colisión de emails entre `clients` y `users` no linkeados** → la migración inserta con
  `email = NULL` y loguea; nunca auto-mergea. El pre-vuelo los lista para resolución humana previa.
- **Split de `full_name` mal hecho** (apellidos compuestos: "María del Carmen Rossi Bianchi") →
  heurística documentada (primer token = nombre, resto = apellido), campos editables desde el ABM,
  y el pre-vuelo lista los nombres de una sola palabra. No hay forma automática correcta.
- **Sesiones vivas con `role: "user"` y `client_id` en el JWT** → `normalizeRole()` en
  `stores/session.ts`; si igual algo queda inconsistente, el peor caso es un re-login.
- **Staff bloqueado por `email_verified=False`** (`auth.py:55`) → paso 3 de la migración marca
  verificados a todos los usuarios existentes que ya tienen password.
- **Link de invitación verificado por un prefetch del cliente de mail/WhatsApp** (Gmail y WhatsApp
  hacen preview de URLs) → riesgo aceptado: que el preview dispare la verificación sigue probando
  que el mensaje llegó a esa dirección/número, que es la intención del requirement. La acción
  sensible (definir la contraseña) es un `POST`, que ningún preview dispara. Si más adelante
  molesta, se mueve el marcado a un `POST .../verify` detrás de un botón "Confirmar".
- **N+1 en el indicador de pago del listado** → subconsulta correlacionada en la misma query del
  listado; aritmética entera para que además sea testeable en SQLite.
- **Gente que pierde el login el día del deploy**: los `clients.is_active = false` con cuenta de
  portal migran a `cancelled` y, por rol Miembro, quedan bloqueados → el pre-vuelo los lista con
  nombre y email para aviso previo; la reactivación es un click desde el ABM y restaura el acceso.
- **Acoplar el color del indicador con el bloqueo de acceso** (la trampa central de esta spec: el
  rojo NO implica sin acceso) → las dos reglas viven en módulos distintos (`utils.py` vs
  `auth.py`), ninguna recibe el input de la otra, y hay tests explícitos del caso Coach-miembro
  dado de baja (rojo + sigue entrando).
- **Baja sin efecto inmediato sobre sesiones abiertas** → enforcement también en
  `get_current_user`, no solo en `POST /auth/token`; si no, el bloqueo tarda hasta 10 h
  (`ACCESS_TOKEN_EXPIRE_MINUTES = 600`).
- **`/clients` desaparece sin alias** → redirect en el frontend para los bookmarks; el change
  `add-expo-mobile-app` (no implementado) nace contra `/users`.
- **Sin entrega automática por WhatsApp** → el link se copia/abre desde la UI con el mismo patrón
  `wa.me` que ya usa el repo. Es un click manual del admin, no automatización. Flagged abajo.
- **`ALTER TYPE ... RENAME VALUE`** puede comportarse distinto según la versión de Postgres de
  Supabase → fallback documentado (tipo nuevo + `USING` cast) y verificación de la versión en el
  pre-vuelo.

## Migration Plan

1. Correr `backend/scripts/preflight_unify_users.py` contra producción; resolver a mano las
   colisiones de email que reporte.
2. Snapshot de la base (Supabase point-in-time / `pg_dump`).
3. Ventana de mantenimiento corta (minutos): `make migrate` (`alembic upgrade head`).
4. Deploy de backend y frontend **juntos** — el contrato cambia (`/clients` → `/users`,
   `client_id` → `user_id`, rol `user` → `member`), no hay versión intermedia compatible.
5. Verificación post-deploy: login de owner, login de coach, listado de usuarios con los tres
   colores, un pago existente sigue asociado a su persona, historial de rutinas de un miembro
   migrado, y el caso asimétrico: un Miembro dado de baja no entra, un Coach-miembro dado de baja
   sí entra.
6. Si algo falla: restore del snapshot + rollback del deploy. `downgrade()` **no** es una opción.
7. Change de seguimiento: borrar `legacy_client_id` y limpiar el copy "Clientes" en las specs que
   el proposal dejó fuera de alcance.

## Huecos de spec detectados

Estos puntos requieren decisión de **Product Owner**, no de arquitectura. No están resueltos en
este diseño.

1. **`login-view` conserva un requirement que este change rompe.**
   `openspec/specs/login-view/spec.md` tiene "Requirement: Link a registro de cuenta — El
   formulario SHALL mostrar un link con el texto 'Registrar cuenta' que navega a
   `/register-client`", con su escenario. Al retirar la ruta, ese requirement queda insatisfecho y
   no hay delta de `login-view` en este change. PO debe decidir si el link se elimina (delta
   `REMOVED` sobre `login-view`) o si apunta a otra cosa.

2. **`automated-test-suite` referencia una vista que deja de existir.**
   `openspec/specs/automated-test-suite/spec.md` (req. "Test de render por cada vista con spec")
   nombra explícitamente `register-client-view` y tiene el escenario "Render de la vista de
   registro de cliente". Al borrar `RegisterClient.test.tsx` esa spec queda mintiendo. PO debe
   decidir el delta: quitar `register-client-view` de la lista y, presumiblemente, agregar la
   nueva pantalla pública de invitación en su lugar.

3. **Cómo obtiene su contraseña un Coach o un Dueño nuevo.**
   `user-management` dice que un Dueño puede crear usuarios de cualquier rol, y
   `member-invitation` dice explícitamente que el flujo de invitación **no** aplica a Dueños ni
   Coaches ("Invitación no disponible para Dueños ni Coaches"). Ninguna spec dice entonces cómo se
   le da acceso a un Coach nuevo. Este diseño **preserva el status quo** (el Dueño setea la
   contraseña al crear el usuario no-miembro, como hoy hace `POST /coaches`), pero es una decisión
   de producto sin respaldo en la spec. PO debe confirmarla o definir un flujo propio.

4. **"El sistema entrega el link por WhatsApp" vs. no hay proveedor.**
   `member-invitation` exige entrega automática por ambos canales ("Invitación con ambos datos de
   contacto → el sistema entrega el link por ambos canales"). Este diseño entrega email por SMTP e
   implementa WhatsApp como un click del admin sobre `wa.me` (dec. 12), porque integrar la
   WhatsApp Cloud API es un proyecto aparte con costo y verificación de negocio. QA no va a poder
   verificar ese escenario tal como está escrito. PO debe: (a) aprobar y presupuestar un proveedor
   de WhatsApp, o (b) relajar el requirement a "el sistema genera y pone a disposición el link por
   ambos canales", o (c) aceptar el escenario como pendiente hasta un change de integración.

5. **Alta de un usuario con rol Miembro: ¿la membresía queda activa automáticamente?**
   `user-management` separa el rol del atributo de membresía, pero el escenario "Alta de un miembro
   nuevo" solo dice que se crea el registro con ese rol; no dice si `membership_status` queda
   `active` o `none`. Este diseño **asume `active`** (dar de alta a alguien como Miembro y que no
   cuente como miembro sería sorprendente), y `none` para altas con rol Dueño/Coach.
   Severidad baja: la asunción es consistente con el resto de las specs — un miembro recién creado
   sin pagos queda en **naranja** por el escenario "Sin pagos registrados y membresía activa → en
   mora", que es el comportamiento razonable (debe la cuota del mes). Confirmar igual.

### Resueltos por el Product Owner en la revisión del 2026-09-05

- Indicador de 3 estados (verde/naranja/rojo/ausente) y su precedencia — cerrado en
  `payment-status-indicator`.
- Contradicción "dar de baja no afecta el login" — **reemplazada** por el requirement opuesto, no
  parcheada.
- Alcance del bloqueo por rol (solo rol Miembro; Dueño/Coach-miembro conserva acceso) — cerrado
  explícitamente, incluida la disociación entre el color rojo y el acceso.
- Fecha de baja manual con default `now()` — cerrado.
- Efecto de una baja posterior sobre una invitación ya completada — cerrado en
  `member-invitation`.
- Reactivación de la membresía: la spec ahora dice que restaura el acceso de un rol Miembro. Deja
  de ser un hueco; lo que sigue sin definirse es si tiene alguna condición de negocio (p. ej.
  exigir un pago), que este diseño asume que **no**.
