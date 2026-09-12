## Context

Hoy el precio de la cuota es un único escalar global: `AppSettings.default_fee` (`Integer`,
`backend/app/models.py`). Cambiarlo pisa el valor anterior sin dejar rastro, y `Payment.amount`
se carga a mano en cada alta, así que no hay forma de saber qué precio regía cuando se cobró un
pago viejo ni de tener precios distintos por segmento.

Estado del código que este change toca:

- `backend/app/models.py`: `User` concentra perfil + acceso + membresía (`membership_status`,
  `membership_start_date`, `membership_cancelled_at`). `Payment` no referencia nada de precios.
- `backend/app/routers/users.py`: router con `dependencies=[Depends(require_role(owner, coach))]`
  a nivel router, helpers `_serialize_user` / `_serialize_user_single` / `_get_user_or_404`,
  listado con subconsulta correlacionada para evitar N+1, y endpoints de membresía dedicados
  (`/membership/activate`, `/membership/cancel`) — el patrón a copiar.
- `backend/app/routers/routine_templates.py`: patrón más reciente de CRUD con nombre único
  normalizado en Python (`_normalize_name`, `_check_name_collision`, 409).
- `backend/app/deps.py`: `require_can_manage_user` (owner gestiona todo, coach solo Miembros).
  `require_role` vive en `backend/app/auth.py`. Este change **los reutiliza sin tocarlos**.
- `frontend/src/App.jsx`: `<Routes>` con `ProtectedRoute roles={["owner","coach"]}`; las páginas
  del Sidebar se cargan por `routeImporters` (`lib/routePreload.ts`), las que no están en el
  Sidebar (`UserDetail`, `RoutineTemplateDetail`) usan `lazy(() => import(...))` directo.
- `frontend/src/pages/Payments.tsx`: placeholder "en reconstrucción" (una `Card` con título).
- `frontend/src/pages/Users.tsx`: `ListPageLayout` + `Pagination` + `CreateUserDialog` /
  `EditUserDialog`. `frontend/src/services/queryKeys.ts` es el único lugar donde se escribe una
  key de React Query.

Restricciones:

- La suite de backend corre sobre **SQLite de archivo** con el esquema creado por
  `Base.metadata.create_all` (`backend/tests/conftest.py`), no por Alembic: nada de tipos o
  índices que diverjan entre SQLite y Postgres sin declarar los dos dialectos.
- La cadena de migraciones actual termina en `69362a3ad95d_add_routine_templates.py`.
- **El proyecto está en beta, no productivo.** Los datos que hay son de prueba, así que este
  change **no migra datos**: la migración es solo de esquema y los miembros que ya existen quedan
  sin plan, con el requirement "Miembro preexistente sin plan asignado" de la delta spec de
  `user-management` cubriendo ese estado en la UI.

## Goals / Non-Goals

**Goals:**

- Modelar plan de membresía con historial de precios append-only y poder responder "¿qué precio
  tenía el plan X el día D?".
- CRUD de planes para staff, con las reglas de negocio del proposal (nombre único, al menos un
  plan activo, sin borrado destructivo).
- Que todo Miembro dado de alta o reactivado **a partir de este change** tenga siempre un plan, y
  que los que ya existen queden en un estado legible y resoluble desde la UI ("Sin plan" +
  "Asignar plan").
- Dejar la puerta abierta a M3 (el pago congela plan + precio de referencia) sin rediseñar nada.

**Non-Goals:**

- **Migración de datos de ningún tipo**: no se crea un plan "General" automático ni se asigna plan
  a los miembros existentes (el proyecto está en beta, los datos son de prueba).
- Prorrateo, descuentos, promociones o planes con duración/ciclo distinto del mes.
- Precargar el precio en el alta de pago o guardar plan/precio en `Payment` (M3).
- Deprecar `default_fee` (M5), "Mi cuota" en el portal del miembro (M6), link desde Ajustes (C-5).
- Rehacer `Payments.tsx` más allá de agregarle el botón "Planes".
- Multi-moneda: el monto se muestra con la `currency` de `AppSettings`, como hoy.

## Decisions

### D1. Modelo: `MembershipPlan` + `MembershipPlanPrice` append-only, y el plan del miembro como FK en `User`

**Dos tablas nuevas** en `backend/app/models.py`:

```
MembershipPlan
  id (String/uuid, PK)
  name (String, not null)
  name_normalized (String, not null, UNIQUE)   # NFC + strip + casefold en Python
  description (String, nullable)
  is_active (Boolean, not null, default True)
  created_at / created_by_user_id (FK users.id ON DELETE SET NULL)
  updated_at

MembershipPlanPrice
  id (String/uuid, PK)
  plan_id (FK membership_plans.id ON DELETE RESTRICT, not null, index)
  amount (Integer, not null)
  effective_from (Date, not null)
  created_at / created_by_user_id (FK users.id ON DELETE SET NULL)
  UNIQUE (plan_id, effective_from)
  INDEX (plan_id, effective_from DESC)
```

`name_normalized` replica el patrón ya probado de `RoutineTemplate` (design D1 de
`add-routine-templates`): la normalización se hace en Python, no con `lower()` de SQL, porque el
`lower()` de SQLite es ASCII-only y se comportaría distinto de Postgres en la suite de tests.

**Precio vigente a una fecha D** = la fila de `MembershipPlanPrice` del plan con el mayor
`effective_from <= D`; si no hay ninguna (todos los precios son futuros), el plan no tiene precio
vigente y la API devuelve `current_price: null`. Se resuelve en un helper único
`current_price_for(plan_ids, on=date.today())` que hace **una** query agregada para todos los
planes de la página (`DISTINCT ON` en Postgres no: se usa una subconsulta con
`func.max(effective_from)` para que corra igual en SQLite). La unicidad `(plan_id,
effective_from)` hace la resolución determinista sin desempate por `created_at`.

*Alternativas consideradas:* (a) columna `amount` en `MembershipPlan` + tabla de auditoría —
rechazada: el dato "histórico" queda en una tabla que nadie consulta y no se puede responder el
precio a una fecha sin reconstruirlo; (b) `valid_from`/`valid_to` por fila — rechazada: obliga a
**actualizar** la fila anterior al insertar una nueva, que es exactamente lo que el invariante
append-only quiere prohibir; el `valid_to` es derivable con una ventana.

*Tipo del monto:* `Integer` (pesos enteros), no `Float` ni `Numeric`. `AppSettings.default_fee`
ya es `Integer` y la migración copia de ahí; `Float` es lo que usa `Payment.amount` hoy y no
queremos propagar su error de redondeo a un **precio de referencia** que M3 va a congelar;
`Numeric(12,2)` obligaría a lidiar con `Decimal` en la serialización y con el soporte parcial de
SQLite en la suite. Costo aceptado: no se pueden expresar centavos (no hay caso de uso en el MVP).

**Plan del miembro: tres columnas en `users`**, no una tabla de historial:

```
users.membership_plan_id        FK membership_plans.id ON DELETE RESTRICT, nullable, index
users.plan_since                Date, nullable
users.plan_changed_by_user_id   FK users.id ON DELETE SET NULL, nullable
```

*Alternativa considerada y rechazada:* tabla `user_plan_assignment` (plan, desde, autor) con el
plan vigente derivado. Es el modelo temporalmente "correcto", pero acá no paga:

- Contra **S5** (el cambio de plan aplica a los próximos pagos, sin prorrateo y sin reescribir
  los ya registrados): justamente porque no hay prorrateo, nadie necesita reconstruir "qué plan
  tenía el 14 del mes pasado". El único consumidor de esa pregunta sería el cálculo de un pago
  retroactivo, que la spec descarta.
- Contra **M3** (el pago guarda plan y precio de referencia): M3 **desnormaliza** `plan_id` +
  `price_amount` sobre la fila de `Payment` en el momento del alta. Esa fila es el registro
  histórico auditable, y es mejor que un historial de asignaciones porque guarda el precio real
  cobrado, no el que *debería* haber regido. Con la tabla de historial tendríamos dos fuentes de
  verdad del pasado que pueden discrepar.
- Costo de la FK: leer el plan de un usuario es un `JOIN` (o un `outerjoin` en el listado), no
  una subconsulta de "último assignment"; el listado paginado de Usuarios no paga N+1.

Trade-off aceptado y explícito: **no queda la lista completa de planes que tuvo un miembro** hasta
que M3 empiece a acumular pagos con plan congelado. Lo que sí queda es el último cambio
(`plan_since` + `plan_changed_by_user_id`), que es lo que la ficha muestra. Si más adelante hace
falta el historial completo, agregar la tabla es aditivo: las tres columnas de `users` pasan a ser
una caché del último registro.

`membership_plan_id` queda **nullable en la base**: un Dueño/Coach sin membresía, un miembro
`cancelled` y todo miembro creado antes de este change no tienen plan. El invariante "membresía
activa ⇒ plan" se sostiene solo en la capa de aplicación (alta, activación y cambio de plan) —
ver D3 para por qué no hay backfill ni `CHECK`.

### D2. Contrato de API

Router nuevo `backend/app/routers/membership_plans.py`, registrado en `backend/app/main.py`.
Autorización **a nivel router**, igual que `users.py` (no endpoint por endpoint como
`payments.py`, que es el patrón viejo):

```python
router = APIRouter(
    prefix="/membership-plans",
    tags=["membership-plans"],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
```

Eso da gratis `401` sin sesión y `403` con rol `member` en todos los endpoints, que es lo que el
delta de `staff-endpoint-authorization` necesita.

| Verbo y ruta | Body | Respuesta | Errores |
|---|---|---|---|
| `GET /membership-plans/` | — (query: `q`, `is_active`, `limit` 1..200 def. 50, `offset`) | `200 List[MembershipPlanOut]` + header `X-Total-Count` | — |
| `GET /membership-plans/{plan_id}` | — | `200 MembershipPlanDetail` (incluye `price_history`) | `404` |
| `POST /membership-plans/` | `MembershipPlanCreate{name, description?, amount}` | `201 MembershipPlanOut` + `Location` | `409` nombre duplicado, `422` `amount < 0` |
| `PATCH /membership-plans/{plan_id}` | `MembershipPlanUpdate{name?, description?}` | `200 MembershipPlanOut` | `404`, `409` nombre duplicado |
| `POST /membership-plans/{plan_id}/prices` | `MembershipPlanPriceCreate{amount, effective_from?}` | `201 MembershipPlanPriceOut` | `404`, `400` `effective_from` anterior a hoy, `409` ya hay precio con ese `effective_from` |
| `POST /membership-plans/{plan_id}/deactivate` | — | `200 MembershipPlanOut` | `404`, `409` ya inactivo, `409` es el último plan activo |
| `POST /membership-plans/{plan_id}/activate` | — | `200 MembershipPlanOut` | `404`, `409` ya activo |
| `POST /users/{user_id}/plan` | `UserPlanChangeIn{membership_plan_id}` | `200 UserOut` | `404` usuario o plan, `400` el usuario nunca fue miembro (`membership_status = 'none'`), `400` plan inactivo, `409` ya tiene ese plan |
| `POST /users/{user_id}/membership/activate` | `MembershipActivateIn{membership_plan_id?}` | `200 UserOut` | `409` ya activa, `400` sin plan asignado y sin `membership_plan_id`, `404` plan inexistente, `400` plan inactivo, `400` plan distinto del que ya tiene (D2.2) |

Decisiones del contrato y su porqué:

- **El precio inicial es obligatorio en `POST /membership-plans/`.** Un plan sin precio no sirve
  para nada y habilitaría el estado "plan activo sin precio vigente" en el selector del alta.
- **`PATCH` no toca precio ni `is_active`.** Cambiar el precio es un `POST` a un subrecurso
  porque *inserta* (invariante append-only, I1): si fuera un campo del `PATCH`, la semántica
  natural sería "actualizá el valor" y el primer dev que pase lo va a implementar así.
  Activar/desactivar va por endpoints dedicados, replicando `users.py`
  (`/membership/activate|cancel`), porque llevan reglas de negocio propias (el 409 del último
  plan activo) que no entran en un `PATCH` genérico.
- **`effective_from` no puede ser retroactivo** (`< date.today()` ⇒ `400`). Un precio retroactivo
  cambiaría, a posteriori, qué precio "regía" en un período ya cobrado — justo lo que S5
  prohíbe. El default es hoy.
- **No hay `DELETE`.** El proposal pide "no se puede borrar un plan que tiene o tuvo miembros o
  pagos"; como "tuvo" no es barato de probar (y con D1 sería imposible una vez que el miembro se
  movió a otro plan), este change no expone borrado: desactivar cubre la necesidad real (sacarlo
  del selector) y el `ON DELETE RESTRICT` de las FK defiende la base. *Alternativa:* `DELETE` con
  chequeo de referencias — rechazada por ser una puerta que solo se puede usar los primeros cinco
  minutos de vida de un plan.
- **Sin header `Link`** en el listado (sí `X-Total-Count`): el `Pagination` del frontend solo
  consume el total (`services/pagination.ts`), y el `Link` de `users.py` no lo lee nadie.
- **Cambio de plan como subrecurso de usuario** (`POST /users/{id}/plan`), no como campo de
  `PATCH /users/{id}`: sigue la convención que ya fijó este repo para membresía ("Membresía por
  endpoints dedicados") y necesita registrar autor y fecha, que un `PATCH` genérico no haría.
  Aplica `require_can_manage_user(current_user, obj.role)` como el resto.
- **`POST /users/{id}/plan` NO exige membresía activa** — solo exige que el usuario tenga perfil
  de miembro (`membership_status != 'none'`), es decir acepta `active` **y** `cancelled`. Ver
  D2.1: es el arreglo del bloqueo mutuo con `activate_membership`.

#### D2.1. Asignar plan a un miembro dado de baja (corrige un bloqueo mutuo del diseño anterior)

La versión anterior de este design exigía membresía activa para cambiar de plan **y** plan
asignado para activar la membresía. Con el backfill fuera de alcance (D3), esas dos reglas se
cierran en un ciclo: un miembro preexistente **dado de baja y sin plan** necesita estar activo
para recibir un plan y necesita un plan para poder activarse. Queda atrapado para siempre, sin
salida por la UI.

**Arreglo elegido: `change_user_plan` deja de exigir membresía activa.** Pasa a rechazar solo
`membership_status = 'none'` (usuario que nunca fue miembro, para el que una sección de plan no
tiene sentido según la spec), y acepta `cancelled` igual que `active`.

Por qué:

- **La regla que se saca nunca la pidió el producto.** Ninguna de las tres delta specs exige
  membresía activa para cambiar de plan; fue una precondición que agregó este design. Al
  contrario, el requirement "Miembro preexistente sin plan asignado" dice que la ficha de *un
  miembro sin plan* ofrece "Asignar plan", sin condicionarlo al estado de la membresía. O sea:
  (b) no relaja un invariante del negocio, borra uno inventado de más.
- **Asignar un plan es inerte.** No habilita pagos (`create_payment` chequea
  `membership_status == active` por su cuenta), ni check-ins (`attendance` hace lo mismo), ni
  acceso al portal. El plan es un atributo del perfil del miembro, no una concesión de permisos:
  bloquearlo defendía algo que no estaba en riesgo.
- **I2 sigue intacto.** El invariante que importa —"la API nunca deja a alguien activo sin
  plan"— lo garantiza `activate_membership`, que se queda como está. Lo que cambia es que ahora
  existe un camino para cumplirlo.

*Alternativa considerada y rechazada:* (a) que `activate_membership` acepte un
`membership_plan_id` opcional en el body y asigne el plan en la misma operación. Arregla **un
solo** punto de entrada: el botón "Asignar plan" de la ficha de un miembro dado de baja —que la
spec pide explícitamente— seguiría devolviendo 400, así que habría que tocar los dos endpoints
igual, o esconder la acción de la ficha según el estado de membresía y contradecir la spec.
Además convierte `activate_membership` en una operación compuesta, duplica la validación de plan
(existe / está activo) en dos endpoints y rompe la simetría con `cancel_membership`.

*Costo aceptado:* activar a un miembro sin plan son **dos llamadas** desde
`ActivateMembershipDialog` (`POST /users/{id}/plan` y después
`POST /users/{id}/membership/activate`), no atómicas. El modo de falla es benigno: si la segunda
falla, el miembro queda con plan y dado de baja — exactamente el estado que la spec ya contempla
y que se ve bien en la ficha — y reintentar es idempotente. No justifica un endpoint compuesto.

> **Corregido por D2.2**: la parte de esta decisión que encadenaba dos llamadas desde
> `ActivateMembershipDialog` queda superada. D2.1 sigue vigente en lo que importa —
> `POST /users/{id}/plan` acepta miembros `cancelled`—, pero la activación ya no se arma como dos
> requests: pasa a ser una sola operación atómica.

#### D2.2. Activar la membresía de quien nunca fue miembro (segundo bloqueo mutuo, un escalón antes)

D2.1 cerró el ciclo para `membership_status = 'cancelled'` pero lo dejó vivo para `'none'`, y esta
vez como **regresión sobre una spec ya vigente** ("Acciones de membresía desde la ficha del
usuario", `openspec/specs/user-management/spec.md`, escenario "Ver la acción según el estado sin
membresía"). Hoy:

```
POST /users/{id}/plan                 -> 400 "El usuario no tiene perfil de miembro"
POST /users/{id}/membership/activate  -> 400 "Asigná un plan antes de activar la membresía"
```

El caso real: el Dueño da de alta un Coach y después lo quiere marcar como miembro del gimnasio.
El modal le ofrece el selector de planes, elige uno, confirma, y come un error inline sin salida
por UI. Antes de este change el flujo funcionaba.

**Arreglo elegido: `activate_membership` acepta un `membership_plan_id` opcional en el body y, si
el usuario no tiene plan, lo asigna y activa la membresía en la misma operación atómica** (un solo
`commit`).

Contrato:

- Body `MembershipActivateIn { membership_plan_id: Optional[str] = None }`. Se recibe como objeto
  con default, igual que `MembershipCancelIn`, así que el `{}` que ya manda `activateMembership`
  (`frontend/src/services/users.ts`) sigue siendo válido y **ningún caller existente se rompe**.
- Si el usuario **no tiene plan**: `membership_plan_id` es obligatorio ⇒ si falta, sigue el `400`
  actual ("Asigná un plan antes de activar la membresía"). Plan inexistente ⇒ `404`; plan inactivo
  ⇒ `400`.
- Si el usuario **ya tiene plan**: el campo se puede omitir (caso normal de reactivación). Si
  viene y es **distinto** del actual ⇒ `400` "Para cambiar el plan usá la acción Cambiar plan" —
  no se acepta un cambio de plan encubierto dentro de una activación, para que
  `change_user_plan` siga siendo el único lugar donde se decide un cambio.
- Cuando asigna, escribe **las tres columnas juntas** (`membership_plan_id`, `plan_since = hoy`,
  `plan_changed_by_user_id = current_user.id`), igual que `change_user_plan`: ningún camino de
  escritura deja `plan_since` en `NULL` con plan asignado.

**`change_user_plan` sigue rechazando `none`**, y eso ahora es deliberado y consistente: el plan
es un atributo del *perfil de miembro*, y la spec vigente dice que la ficha de un usuario sin
perfil de miembro no muestra sección de plan. Permitir el plan ahí (opción (b)) crearía un estado
—no-miembro **con** plan— que por spec la UI tiene prohibido mostrar: invisible, inalcanzable
desde la ficha y sin forma de corregirlo. Activar la membresía es, justamente, el acto que crea el
perfil de miembro; es el lugar natural donde el plan entra por primera vez.

Por qué (a) acá y (b) en D2.1 — no es una contradicción, son dos puertas distintas:

| Estado del usuario | Qué ve la ficha | Puerta de entrada del plan |
|---|---|---|
| `none` (nunca fue miembro) | sin sección de plan (spec vigente) | `POST /membership/activate` con plan (D2.2) |
| `cancelled` sin plan | sección de plan + "Asignar plan" | `POST /users/{id}/plan` (D2.1) |
| `active` sin plan (preexistente) | sección de plan + "Asignar plan" | `POST /users/{id}/plan` (D2.1) |

El criterio es el mismo en los dos casos: **el arreglo va en el endpoint que la UI ya invoca en
ese estado**. En `cancelled` la ficha ya ofrece "Asignar plan", así que arreglar la activación no
alcanzaba; en `none` la única acción que existe es "Activar membresía", así que arreglar el
endpoint de plan no alcanza.

*Alternativa considerada y rechazada:* (b) que `change_user_plan` acepte `none` y sea también la
puerta de entrada al perfil de miembro. Rechazada por tres razones: (1) crea el estado invisible
descrito arriba; (2) no hay ninguna acción en la ficha de un `none` que llame a ese endpoint, así
que habría que agregar UI nueva para un estado que la spec quiere vacío; (3) haría que asignar un
plan mute implícitamente `membership_status`, rompiendo **I11**.

*Beneficios laterales:* la activación con plan vuelve a ser **atómica** (desaparece el
trade-off de las dos requests de D2.1 y el riesgo asociado), y `ActivateMembershipDialog` se
simplifica a una sola llamada pasando el plan elegido en el body.


Schemas nuevos en `backend/app/schemas.py`: `MembershipPlanBase`, `MembershipPlanCreate`,
`MembershipPlanUpdate`, `MembershipPlanPriceCreate`, `MembershipPlanPriceOut`,
`MembershipPlanOut` (`id, name, description, is_active, current_price: MembershipPlanPriceOut |
None, members_count: int`), `MembershipPlanDetail` (= `MembershipPlanOut` + `price_history:
list[MembershipPlanPriceOut]`), `MembershipPlanSummary` (`id, name, current_amount`) y
`UserPlanChangeIn`.

Schemas modificados:

- `UserCreate` gana `membership_plan_id: Optional[str] = None`. La obligatoriedad es
  **condicional al rol**, así que se valida en el endpoint (donde ya viven las otras reglas
  cruzadas de `create_user`), no con un `model_validator`: `role == "member"` sin
  `membership_plan_id` ⇒ `400 "Un Miembro necesita un plan de membresía"`; plan inexistente o
  inactivo ⇒ `400`. Para roles no-Miembro, mandar `membership_plan_id` ⇒ `400`.
- `UserOut` gana `membership_plan: Optional[MembershipPlanSummary] = None` y
  `plan_since: Optional[date] = None`. Ambos **opcionales** a propósito (ver D5: los `makeUser`
  de cuatro tests del frontend construyen `User` a mano).
- `activate_membership` pasa a exigir plan: si el usuario no tiene `membership_plan_id` ⇒
  `400 "Asigná un plan antes de activar la membresía"`. Es lo que cierra I2 para los miembros
  `cancelled` y para los preexistentes que quedan sin plan (no hay backfill, ver D3).

Serialización sin N+1: `_serialize_user` recibe el `MembershipPlanSummary` ya resuelto. En
`list_users` se agrega un `outerjoin` a `membership_plans` y **una** query de precios vigentes
para los `plan_id` distintos de la página (los planes son decenas, no miles).

### D3. Migración Alembic: solo esquema, sin migración de datos

Una sola revision, `down_revision = "69362a3ad95d"` (confirmar con `alembic heads` al
implementar, por si otra sesión mergeó algo antes). `upgrade()` hace exactamente dos cosas:

1. `op.create_table` de `membership_plans` y `membership_plan_prices` (+ índices y el unique
   `(plan_id, effective_from)`).
2. `op.add_column` de las tres columnas de `users` — todas **nullable** — con sus FKs y el índice
   sobre `membership_plan_id`.

Nada más: **sin backfill, sin plan "General" automático, sin leer `AppSettings.default_fee` y sin
lógica de idempotencia**. El proyecto está en beta y los datos existentes son de prueba, así que
migrar datos sería escribir sobre filas reales para resolver un problema que no existe. La
migración es puramente aditiva y, por lo tanto, trivialmente reversible y re-aplicable.

*Alternativa considerada:* crear "General" desde `default_fee` y asignarlo a los miembros activos
(era el diseño anterior de este change). Rechazada al confirmarse que no hay producción: agregaba
una rama por `default_fee` nulo o cero, una regla de idempotencia, un helper extraíble para poder
testear el backfill y un procedimiento de despliegue manual — todo para poblar datos de prueba
que el staff puede cargar en dos clicks desde la pantalla de Planes.

**Los miembros que ya existen quedan sin plan.** Es un estado de primera clase, no un accidente:
el requirement "Miembro preexistente sin plan asignado" (delta spec de `user-management`) manda
que el listado y la ficha muestren **"Sin plan"** y que la ficha ofrezca **"Asignar plan"**, que
usa el mismo `POST /users/{id}/plan` que el cambio de plan normal. Una vez asignado, ese miembro
queda indistinguible de uno creado con plan. Consecuencia buscada: la única forma de que un
miembro tenga plan es que alguien lo haya elegido explícitamente — no hay un "General" fantasma
con un precio que nadie decidió.

Como corolario, **I2 aplica solo a las escrituras de la API** (alta, activación y cambio de
plan), no al estado global de la tabla: puede haber miembros activos sin plan hasta que un Dueño
o Coach se los asigne.

**No se agrega un `CHECK (membership_status <> 'active' OR membership_plan_id IS NOT NULL)`.**
Sería el cinturón ideal para I2, pero justamente los miembros preexistentes lo violarían: la
migración fallaría al crearlo. Se puede evaluar en un change posterior, una vez que todos los
miembros tengan plan asignado.

`downgrade()`: dropea las tres columnas de `users` y las dos tablas. Es **destructivo** para los
planes cargados (se documenta en el docstring de la revision); no hay forma de conservarlos sin
las tablas.

**Despliegue**: `make migrate` (`alembic upgrade head`) en el entorno correspondiente. Como la
migración es aditiva y no toca datos, el orden respecto del deploy del código no es crítico: lo
único que pasa si el código nuevo llega antes que la migración es que las queries fallan hasta
que se corra — sin pérdida ni corrupción de datos. Rollback = revertir el merge; las columnas
nuevas quedan y no molestan al código viejo.

**`backend/scripts/seed_dev_users.py` crea el plan él mismo.** Sin backfill, no hay ningún plan
en una base recién migrada, así que el seed de desarrollo tiene que crear (o reusar, por
`name_normalized`) un plan activo con un precio, y asignárselo a `dev.member@miniespacio.local`
antes de dejarlo con membresía activa. Si no, el miembro de desarrollo nace violando I2 y el
frontend lo muestra como "Sin plan" en los tres entornos de desarrollo del equipo. Ver D5: el
script ya aparece en el blast radius de `User`.

### D4. Frontend

- **Ruta**: `/plans`, con `<ProtectedRoute roles={["owner","coach"]}>` en `frontend/src/App.jsx`.
  Página `frontend/src/pages/MembershipPlans.tsx` cargada con `lazy(() => import("./pages/
  MembershipPlans"))` **directo**, sin pasar por `lib/routePreload.ts`: ese mapa es para rutas con
  entrada en el Sidebar (su comentario lo dice), y Planes no la tiene — es el mismo tratamiento
  que `UserDetail` y `RoutineTemplateDetail`.
- **Botón "Planes"**: en el `CardHeader` de `frontend/src/pages/Payments.tsx`, a la derecha del
  título, como `<Button variant="outline" asChild><Link to="/plans">`. Es la única modificación a
  ese archivo; el placeholder queda intacto.
- **Listado**: `ListPageLayout` (título "Planes", `count` con el total, `primaryAction` "Crear
  plan" respetando la regla dura del layout — `aria-label` fijo + `<span className="hidden
  md:inline">` para el texto), `toolbar` con buscador `q` y filtro Activos/Inactivos/Todos, tabla
  con Nombre · Precio vigente · Vigente desde · Miembros · Estado · acciones, y `footer` con
  `<Pagination>`. Se reusa `ConfirmActionDialog` para desactivar/reactivar.
- **Diálogos nuevos** en `frontend/src/components/`: `CreateMembershipPlanDialog` (nombre,
  descripción, precio inicial), `EditMembershipPlanDialog` (nombre, descripción),
  `NewPlanPriceDialog` (monto + vigente desde, con el historial visible para que se entienda que
  agrega y no pisa) y `ChangeMembershipPlanDialog` (selector + aviso "aplica a los próximos
  pagos").
- **Datos**: `frontend/src/services/membershipPlans.ts` (fetch/create/update/addPrice/
  deactivate/activate, con `readTotalCount` como `users.ts`) + `membershipPlans.queries.ts`, y
  `queryKeys.membershipPlans = { all, list(params), detail(id) }` en `services/queryKeys.ts` —
  único lugar donde se escriben keys. Cualquier mutación de plan invalida
  `queryKeys.membershipPlans.all`; el cambio de plan de un usuario invalida además
  `queryKeys.users.all`.
- **Tipos** en `frontend/src/types.ts`: `MembershipPlan`, `MembershipPlanPrice`,
  `MembershipPlanSummary`; `User` gana `membership_plan?: MembershipPlanSummary | null` y
  `plan_since?: string | null`, **opcionales** (ver D5).
- **`CreateUserDialog`**: cuando `role === "member"`, aparece el selector de plan (mismo control
  que ya usa para Rol), poblado con la query de planes filtrada a activos. El plan elegido se
  suma al payload de `createUser`. La guarda del botón Guardar incorpora `missingRequiredPlan`.
- **Sin ningún plan activo**: el selector se reemplaza por un aviso "No hay planes activos" con un
  botón "Ir a Planes" que cierra el diálogo y navega a `/plans`; Guardar queda deshabilitado. Es
  el único bloqueo de alta — la página de Planes en sí muestra su empty state normal.
- **`UserDetail`**: en la Card "Membresía", fila "Plan" con nombre, precio vigente y "desde
  {plan_since}". El `CardFooter` gana "Cambiar plan" cuando `canManage`; si el miembro no tiene
  plan (caso preexistente, ver D3), la fila dice **"Sin plan"** y el botón dice **"Asignar
  plan"** — mismo diálogo, mismo endpoint, solo cambia el copy. La sección de plan no se
  renderiza para usuarios sin perfil de miembro. **La acción no depende de que la membresía esté
  activa** (D2.1): un miembro dado de baja y sin plan también puede recibir uno desde acá, que es
  justamente lo que lo saca del bloqueo mutuo.
- **`ActivateMembershipDialog`**: cuando el usuario no tiene plan, muestra el selector de planes
  activos y al confirmar hace **una sola** llamada, `POST /users/{id}/membership/activate` con
  `{ membership_plan_id }` en el body (D2.2). Si ya tiene plan, manda `{}` y el diálogo se
  comporta como siempre. Sirve igual para `none` (activar) y para `cancelled` (reactivar), que es
  lo que lo vuelve la única puerta que necesita el usuario que nunca fue miembro.
- **`Users.tsx`**: columna "Plan" después de la de membresía, con `hidden lg:table-cell` como el
  resto de las columnas secundarias de esa tabla. Tres estados distintos, y la diferencia
  importa: un **miembro sin plan** muestra "Sin plan" (texto explícito, atenuado), mientras que
  un usuario **sin perfil de miembro** muestra "-" — la spec pide no confundir "todavía no le
  asignaron plan" con "no corresponde".

### D5. Blast radius (CodeGraph)

- `codegraph impact User` → **87 símbolos en 28 archivos** (agrega el modelo de backend y el
  type alias de `frontend/src/types.ts`). En backend solo aparecen `models.py` y cuatro scripts:
  `seed_users.py`, `import_users_csv.py`, `create_owner.py` y **`seed_dev_users.py`**. Este
  último es el hallazgo accionable: crea `dev.member@miniespacio.local` con membresía activa, así
  que tiene que **crear un plan activo con precio y asignárselo** (no hay backfill que se lo dé,
  ver D3) o dejaría un miembro activo sin plan, violando I2 y arrancando todos los entornos de
  desarrollo en el estado "Sin plan". `backend/tests/test_dev_seed.py` lo cubre hoy y hay que
  extenderlo. En frontend, `types.ts` es el nodo central: los ~20
  consumidores (`UserCard`, `SpotlightSearch`, los seis diálogos, `users.ts`, `users.queries.ts`)
  no hacen matching exhaustivo, así que campos **opcionales** son aditivos; los que sí romperían
  son los helpers `makeUser` de `Users.test.tsx`, `UserDetail.test.tsx`, `EditUserDialog.test.tsx`
  y `MemberTemplatesCard.test.tsx`, que construyen un `User` literal — razón concreta por la que
  `membership_plan` y `plan_since` son opcionales en el tipo (D4) aunque el backend siempre los
  mande.
- `codegraph impact UserCreate` → **2 símbolos**, ambos en `backend/app/schemas.py`. Su único
  consumidor es `create_user`; sumarle un campo opcional no alcanza a nadie más.
- `codegraph impact list_users` → **2 símbolos**, ambos en `backend/app/routers/users.py`: es un
  endpoint hoja, nadie lo llama desde Python. Su contrato lo consume `fetchUsers`
  (`frontend/src/services/users.ts`), y el cambio es puramente aditivo.
- `require_role` y `require_can_manage_user` se **reutilizan sin modificarse**: el change no
  altera cómo se emite o valida un token, solo agrega endpoints que usan las dependencias
  existentes.

## Risks / Trade-offs

- **El deploy del código nuevo llega antes que `alembic upgrade head`** → las queries pegan contra
  columnas que no existen y `/users` devuelve 500. *Mitigación*: la migración es aditiva y no
  escribe datos, así que correrla en cualquier momento (antes o después) resuelve el problema sin
  pérdida ni corrupción; no hay ventana de inconsistencia que gestionar.
- **Todos los miembros existentes quedan "Sin plan"** hasta que alguien los asigne uno a uno → en
  una base con muchos miembros sería tedioso. *Mitigación*: es beta con datos de prueba, así que
  el volumen es chico; y es deliberado (D3), porque el plan de un miembro lo tiene que decidir una
  persona. Si el volumen creciera antes del uso real, una acción masiva "asignar plan a todos los
  que no tienen" es un change aparte, no una migración.
- **Miembros `cancelled` o preexistentes sin plan** → reactivar su membresía falla con 400 hasta
  que se les asigne uno. *Mitigación*: `POST /users/{id}/plan` acepta miembros dados de baja
  (D2.1), así que la salida existe por dos caminos: "Asignar plan" en la ficha, o el selector de
  `ActivateMembershipDialog`, que asigna el plan y después activa.
- **Activar la membresía pasa a exigir plan**, cosa que antes de este change no hacía → es un
  cambio de comportamiento sobre una spec vigente ("Acciones de membresía desde la ficha del
  usuario"). *Mitigación*: la acción "Activar membresía" sigue existiendo y funcionando, que es
  lo que esa spec exige; lo nuevo es que el modal pide elegir plan. Está señalado al Product
  Owner para que agregue el requirement que lo describa (ver Open Questions).
- **`activate_membership` queda con dos responsabilidades** (activar y, a veces, asignar plan)
  → riesgo de que mañana alguien le cuelgue el cambio de plan también. *Mitigación*: el `400`
  ante un `membership_plan_id` distinto del actual es explícito justamente para eso; el cambio de
  plan tiene un solo dueño, `change_user_plan`.
- **Sin historial de asignaciones de plan** (D1) → no se puede auditar "qué planes tuvo Juan"
  antes de que M3 empiece a congelar el plan en cada pago. *Mitigación*: `plan_since` +
  `plan_changed_by_user_id` cubren el último cambio; agregar la tabla después es aditivo.
- **Sin `CHECK` en la base para I2** (D3) → una escritura directa por SQL puede dejar un miembro
  activo sin plan, y los preexistentes ya están en ese estado por diseño. *Mitigación*: tests de
  backend sobre los tres caminos de escritura de la API (alta, activación, cambio), que es donde
  el invariante aplica.
- **`Integer` para el monto** → no admite centavos. *Trade-off aceptado*: no hay caso de uso en el
  MVP y evita el error de redondeo de `Float`. Migrar a `Numeric` después es una migración de tipo
  aditiva sobre dos columnas.
- **Nombre único normalizado con índice sobre `name_normalized`** → dos requests concurrentes con
  el mismo nombre pueden pasar el chequeo previo; la que pierde recibe un `IntegrityError`.
  *Mitigación*: el índice único es la garantía real; el endpoint traduce el `IntegrityError` a
  `409` en vez de a `500`, igual que el chequeo previo.

## Plan de verificación

**Riesgo**: alto — el diff sigue tocando `backend/app/models.py` (dos tablas nuevas más tres
columnas en `users`) y `backend/migrations/**`, que son gatillos literales de "alto" en el
criterio fijo de `role-architect`, y el criterio explicita que "alto no se baja por acuerdo entre
roles". Sacar la migración de datos **sí** redujo el daño posible (la migración ya no escribe
ninguna fila existente y el `downgrade` es simétrico), pero no elimina el gatillo: un error de
esquema en `users` sigue rompiendo todos los endpoints de usuarios. Tampoco califica para "bajo",
que exige que el diff no cambie comportamiento observable. Lo que cambia en la práctica es el
costo de la verificación manual, que se reduce a un recorrido de UI.

### Invariantes

- I1. Una fila de `membership_plan_prices` nunca se actualiza ni se borra: cambiar el precio solo
  inserta una fila nueva.
- I2. Todo usuario que la **API** deja con `membership_status = 'active'` (alta, activación o
  cambio de plan) tiene `membership_plan_id` no nulo; los miembros preexistentes quedan fuera de
  este invariante por diseño (D3).
- I3. El sistema nunca pasa de tener al menos un plan activo a no tener ninguno por una
  desactivación: `deactivate` rechaza con 409 al último activo.
- I4. El nombre normalizado (NFC + strip + casefold) de un plan es único entre todos los planes,
  activos e inactivos.
- I5. Cambiar el plan de un miembro no modifica ninguna fila existente de `payments`.
- I6. La migración es **solo de esquema**: no borra ni renombra tablas o columnas existentes y no
  escribe, actualiza ni borra ninguna fila de datos.
- I7. El listado de usuarios resuelve el plan vigente sin N+1 (cantidad de queries independiente
  del tamaño de la página).
- I8. Todos los endpoints de planes y el de cambio de plan devuelven 401 sin sesión y 403 con rol
  `member`.
- I9. Un miembro sin plan se muestra como "Sin plan" y un usuario sin perfil de miembro como "-":
  la UI nunca confunde "todavía no le asignaron plan" con "no corresponde".
- I10. **Ningún usuario queda en un estado sin salida**, para los tres estados de membresía y
  sin importar si tiene plan: `none` se activa eligiendo plan en el propio modal de activación
  (D2.2); `cancelled` o `active` sin plan reciben uno desde "Asignar plan" en la ficha (D2.1). No
  existe una combinación de `membership_status` y plan que se bloquee a sí misma.
- I11. `POST /users/{id}/plan` no modifica el `membership_status` de nadie ni habilita por sí
  solo pagos, check-ins o acceso al portal: el único endpoint que cambia el estado de membresía
  al asignar plan es `activate_membership`, y lo hace porque activar es su propósito declarado.
- I12. Ningún camino de escritura deja un usuario con `membership_plan_id` no nulo y `plan_since`
  nulo: las tres columnas de plan se escriben siempre juntas (incluidos los helpers de test).

### Tests

| Capa | Archivo | Caso |
|---|---|---|
| backend | `backend/tests/test_membership_plans.py` | `test_crear_plan_devuelve_201_con_precio_inicial` |
| backend | `backend/tests/test_membership_plans.py` | `test_crear_plan_con_nombre_duplicado_devuelve_409` |
| backend | `backend/tests/test_membership_plans.py` | `test_nuevo_precio_inserta_fila_y_no_modifica_la_anterior` |
| backend | `backend/tests/test_membership_plans.py` | `test_nuevo_precio_retroactivo_devuelve_400` |
| backend | `backend/tests/test_membership_plans.py` | `test_desactivar_el_ultimo_plan_activo_devuelve_409` |
| backend | `backend/tests/test_membership_plans.py` | `test_listado_filtra_por_activo_y_expone_total_count` |
| backend | `backend/tests/test_membership_plans.py` | `test_planes_sin_sesion_devuelve_401_y_con_rol_member_403` |
| backend | `backend/tests/test_user_plan.py` | `test_alta_de_miembro_sin_plan_devuelve_400` |
| backend | `backend/tests/test_user_plan.py` | `test_alta_de_miembro_con_plan_inactivo_devuelve_400` |
| backend | `backend/tests/test_user_plan.py` | `test_cambiar_plan_registra_plan_since_y_autor` |
| backend | `backend/tests/test_user_plan.py` | `test_cambiar_plan_no_modifica_los_pagos_existentes` |
| backend | `backend/tests/test_user_plan.py` | `test_activar_membresia_sin_plan_devuelve_400` |
| backend | `backend/tests/test_user_plan.py` | `test_asignar_plan_a_miembro_preexistente_sin_plan_devuelve_200` |
| backend | `backend/tests/test_user_plan.py` | `test_asignar_plan_a_miembro_dado_de_baja_devuelve_200` |
| backend | `backend/tests/test_user_plan.py` | `test_asignar_plan_no_cambia_el_estado_de_membresia` |
| backend | `backend/tests/test_user_plan.py` | `test_asignar_plan_a_usuario_que_nunca_fue_miembro_devuelve_400` |
| backend | `backend/tests/test_user_plan.py` | `test_miembro_dado_de_baja_sin_plan_puede_recibir_plan_y_reactivarse` |
| backend | `backend/tests/test_user_plan.py` | `test_activar_membresia_de_quien_nunca_fue_miembro_con_plan_devuelve_200` |
| backend | `backend/tests/test_user_plan.py` | `test_activar_membresia_de_quien_nunca_fue_miembro_sin_plan_devuelve_400` |
| backend | `backend/tests/test_user_plan.py` | `test_activar_membresia_con_plan_distinto_del_asignado_devuelve_400` |
| backend | `backend/tests/test_user_plan.py` | `test_activar_membresia_con_plan_escribe_plan_since_y_autor` |
| backend | `backend/tests/test_user_plan.py` | `test_activar_membresia_con_plan_inexistente_no_activa_la_membresia` |
| backend | `backend/tests/test_membership_plans.py` | `test_patch_de_solo_descripcion_no_traduce_cualquier_integrityerror_a_409` |
| backend | `backend/tests/test_user_plan.py` | `test_listado_de_usuarios_expone_el_plan_vigente_y_null_si_no_tiene` |
| backend | `backend/tests/test_user_plan.py` | `test_cambiar_plan_sin_sesion_devuelve_401_y_con_rol_member_403` |
| backend | `backend/tests/test_dev_seed.py` | `test_seed_dev_users_crea_plan_y_lo_asigna_al_miembro_activo` |
| frontend | `frontend/src/pages/__tests__/MembershipPlans.test.tsx` | `muestra los planes con su precio vigente y filtra por activos` |
| frontend | `frontend/src/pages/__tests__/MembershipPlans.test.tsx` | `abre el dialogo de nuevo precio y lo envia` |
| frontend | `frontend/src/pages/__tests__/MembershipPlans.test.tsx` | `deshabilita desactivar cuando es el unico plan activo` |
| frontend | `frontend/src/components/__tests__/CreateUserDialog.test.tsx` | `bloquea el alta de un Miembro cuando no hay planes activos` |
| frontend | `frontend/src/components/__tests__/CreateUserDialog.test.tsx` | `envia el plan elegido al crear un Miembro` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `muestra el plan vigente del miembro y permite cambiarlo` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `muestra Sin plan y ofrece asignar plan a un miembro sin plan` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `ofrece asignar plan a un miembro dado de baja sin plan` |
| frontend | `frontend/src/components/__tests__/ActivateMembershipDialog.test.tsx` | `activa la membresia de quien nunca fue miembro mandando el plan en una sola llamada` |
| frontend | `frontend/src/components/__tests__/ActivateMembershipDialog.test.tsx` | `muestra el error del backend cuando la activacion falla` |
| frontend | `frontend/src/pages/__tests__/Users.test.tsx` | `muestra la columna de plan en el listado` |
| frontend | `frontend/src/pages/__tests__/Users.test.tsx` | `muestra Sin plan para un miembro sin plan y guion para quien no es miembro` |
| frontend | `frontend/src/pages/__tests__/Payments.test.tsx` | `ofrece un boton Planes que navega a la vista de planes` |
| manual | — | Dar de alta un Coach (que nunca fue miembro), abrir su ficha, usar "Activar membresía" eligiendo un plan y confirmar que queda activo con ese plan y su fecha, sin ningún error inline
| manual | — | Correr `make migrate` sobre una base de desarrollo con miembros ya cargados y confirmar en la UI que esos miembros aparecen como "Sin plan", que "Asignar plan" los deja igual que a uno creado con plan, y que ninguna fila de usuarios cambió fuera de eso |
| manual | — | Con `make seed-dev` y el usuario `dev.owner@miniespacio.local`, verificar que el miembro de desarrollo nace con plan, desactivar todos los planes salvo uno y comprobar el 409 al desactivar el último, y luego en /users crear un Miembro verificando que el selector de plan es obligatorio |

## Open Questions

- **Para el Product Owner**: activar la membresía ahora exige elegir un plan, y eso no lo describe
  ninguna spec. El requirement vigente "Acciones de membresía desde la ficha del usuario" sigue
  cumpliéndose (la acción existe y funciona), y el delta de este change solo cubre "Plan
  obligatorio al dar de alta un Miembro". Falta un requirement o escenario que diga que activar o
  reactivar la membresía de un usuario sin plan exige elegir uno. No lo edité: lo toca el PO.

- ¿El listado de Planes debe mostrar la cantidad de miembros por plan (`members_count`) en este
  change o alcanza con dejarlo para el reporte de M-x? El diseño lo incluye porque es la única
  señal visible de "este plan está en uso" antes de desactivarlo; si el PO lo considera fuera de
  alcance, se saca de `MembershipPlanOut` sin afectar nada más.
- ¿Qué plan crea `seed_dev_users.py` para el miembro de desarrollo (nombre y monto)? No es una
  decisión de producto —solo afecta entornos de desarrollo— pero conviene que coincida con lo que
  el equipo espera ver al abrir la app con `make seed-dev`.
