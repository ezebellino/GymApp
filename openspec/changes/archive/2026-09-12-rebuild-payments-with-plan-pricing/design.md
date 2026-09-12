# Design — rebuild-payments-with-plan-pricing

## Context

Este change cierra **M3** de `docs/producto/03-membresias-y-pagos.md`: el pago toma el precio del
plan y guarda la foto de plan + precio de referencia (S3, §3.3, §3.5). Y, como la sección Pagos
quedó como placeholder cuando producto pidió rehacerla, la reconstruye entera.

Estado del código que este change toca:

- `backend/app/models.py`: `Payment` (id, user_id, `amount: Float`, `method`, `method_channel`,
  `note`, `period_month`, `period_year`, `created_at`, `created_by_user_id`; unique
  `(user_id, period_month, period_year)`) **no referencia nada de planes**. `MembershipPlan` +
  `MembershipPlanPrice` (historial append-only) y `User.membership_plan_id` / `plan_since` ya
  existen desde `add-membership-plans`.
- `backend/app/routers/payments.py`: alta, listado (con `join` + `contains_eager` a `User`,
  `X-Total-Count`, filtros `user_id` y `q`), detalle, anulación (`DELETE`, solo Dueño) y **4
  endpoints de reportes** (`/reports/kpis`, `/by_method`, `/by_channel`, `/timeseries`) que
  agregan por `created_at` y suman `Payment.amount`. Autorización endpoint por endpoint
  (`dependencies=[Depends(require_role(...))]`), patrón viejo; `membership_plans.py` y `users.py`
  usan el patrón nuevo a nivel router.
- `backend/app/routers/membership_plans.py`: `current_price_for(db, plan_ids, on=None) ->
  dict[plan_id, MembershipPlanPrice]` — **una** query agregada para N planes, compatible SQLite y
  Postgres. Es el helper que este change reusa; no se toca.
- `backend/app/schemas.py`: `PaymentBase/Create/Out` (con `user: UserSummary`),
  `MembershipPlanSummary {id, name, current_amount}` embebido en `UserOut.membership_plan`.
- `frontend/src/pages/Payments.tsx`: placeholder con el botón "Planes" y nada más.
- `frontend/src/components/NewPaymentDialog.tsx` y `LastPayments.tsx`: sobrevivientes de la
  implementación vieja, con `api.get/post` directo (sin React Query) y el monto precargado desde
  `AppSettings.default_fee`. Los usa `UserCard.tsx`, que usa solo `SpotlightSearch.tsx`.
  `UserCard` además tiene un "pago rápido" que postea `amount: default_fee`.
- Patrón de vista nueva a copiar: `MembershipPlans.tsx` / `Users.tsx` sobre `ListPageLayout` +
  `Pagination`, con `useDebounce(q, 400)`, servicios en `services/<dominio>.ts` +
  `<dominio>.queries.ts` y keys centralizadas en `services/queryKeys.ts`.
- Tema visual: `docs/design/design.md` (Kinetic Obsidian). `ListPageLayout` ya materializa la
  sección "6. List Page"; la tabla y los diálogos siguen "5. Data Tables & Quick Forms".

Restricciones heredadas:

- La suite de backend corre sobre **SQLite de archivo** con el esquema creado por los modelos: lo
  que se escriba tiene que correr igual en SQLite y Postgres (nada de `DISTINCT ON`, nada de
  `lower()` de SQL para normalizar).
- `MembershipPlanPrice.amount` es `Integer` (pesos enteros, design D1 de `add-membership-plans`).
  `Payment.amount` es `Float` y **no cambia** (ver D1).
- El proyecto está en **beta, no productivo** (Railway): no hay datos reales que migrar.

## Goals / Non-Goals

**Goals:**

- Que cada pago guarde una foto inmutable del plan y del precio de referencia vigentes **a la
  fecha de registro** (S3), sin importar qué le pase al plan después.
- Que el monto se precargue con el precio vigente del plan del miembro y siga siendo editable.
- Reconstruir la sección Pagos: indicadores del período, filtros, búsqueda, tabla paginada, alta
  desde Pagos y desde la ficha del miembro, anulación solo para el Dueño.
- Que los 4 endpoints de reportes y el Dashboard sigan devolviendo exactamente lo mismo.
- Unificar el alta de pago en un solo componente: hoy hay dos caminos (`NewPaymentDialog` y el
  pago rápido de `UserCard`) que precargan desde `default_fee`, que es justo lo que se deprecia.

**Non-Goals:**

- Backfill de los pagos existentes (D4): quedan sin plan de referencia, a la vista como tal.
- M5 (deprecar `default_fee`, días de gracia y recordatorios), M6 ("Mi cuota" en el portal),
  M7 (filtro por estado de cuota en Usuarios), DB-2 (bloque Cobros del Dashboard), DB-3
  (absorber Reportes en Evolución).
- Cambiar la regla de estado de cuota (`payment-status-indicator`) o los 4 endpoints de reportes.
- Pagos parciales, prorrateo, descuentos por regla, multi-moneda, sugerir el precio que regía en
  el período pagado (límite explícito de S3, §3.5).
- Migrar `payments.py` al patrón de autorización a nivel router: cambiaría el rol exigido por
  endpoint (`DELETE` es solo Dueño) y eso está fuera de este change.

## Decisions

### D1. Modelo: FK al plan **más** nombre y monto desnormalizados en la fila de `Payment`

Tres columnas nuevas en `Payment` (`backend/app/models.py`), todas **nullable**:

```
payments.membership_plan_id      FK membership_plans.id ON DELETE RESTRICT, nullable, index
payments.plan_name_at_payment    String,  nullable   # foto del nombre del plan
payments.plan_amount_at_payment  Integer, nullable   # precio de referencia (no lo pagado)
```

`Payment.amount` (`Float`) **no cambia de significado**: sigue siendo el monto efectivamente
pagado. `plan_amount_at_payment` es la referencia. Los dos conviven a propósito: el caso de S3
(descuento puntual) es exactamente "pagó 30.000 cuando la referencia eran 34.000".

Por qué las tres juntas y no un subconjunto:

- **Solo FK al plan + monto copiado** (alternativa a): si mañana renombran "General" a "Plan
  base", el listado de pagos de agosto pasa a decir "Plan base". El requisito es que el listado
  muestre lo que correspondía al momento del pago ⇒ el nombre hay que copiarlo.
- **Solo FK a la fila de `MembershipPlanPrice`** (alternativa b): la fila de precio es
  inmutable (invariante I1 de `add-membership-plans`), así que el monto queda congelado gratis —
  pero el nombre del plan se sigue leyendo por `price.plan.name`, que es mutable, y el caso
  "miembro con plan sin precio vigente" (todos los precios futuros) no tendría dónde apoyarse:
  el pago perdería también el plan. Rechazada.
- **Solo columnas desnormalizadas, sin FK** (alternativa c): pierde poder agrupar pagos por plan
  en reportes futuros (DB-2) y hace imposible linkear desde el pago a la pantalla del plan.
  Rechazada.

**No se agrega `membership_plan_price_id`.** Lo único que aportaría sobre `plan_amount_at_payment`
es el `effective_from` de la fila usada, para el que no hay caso de uso en el MVP; a cambio suma
una cuarta columna nullable y una arista `ON DELETE RESTRICT` de `payments` a
`membership_plan_prices` que congelaría para siempre cualquier limpieza del historial de precios.
Es aditivo: si aparece el caso, se agrega después sin rediseñar nada.

`ON DELETE RESTRICT` en `membership_plan_id`, igual que `users.membership_plan_id`: un plan con
pagos no se puede borrar de la base (y, de todos modos, la API no expone `DELETE` de planes).

Tipo del monto de referencia: `Integer`, para ser el mismo tipo que `MembershipPlanPrice.amount`
del que se copia. No se propaga el `Float` de `Payment.amount`, que es deuda vieja.

### D2. La foto la resuelve el **backend**, en el alta; la precarga del formulario sale de datos que el frontend ya tiene

Dos cosas distintas que conviene no mezclar:

1. **Qué se guarda** (la foto). La resuelve `create_payment` en el servidor, siempre, con
   `current_price_for(db, [target.membership_plan_id], on=date.today())` — el helper que ya existe
   y ya está testeado. El payload **no puede** aportar plan ni precio de referencia: si el cliente
   mandara la foto, un bug del frontend (o un cliente malicioso) escribiría historia falsa. Es
   invariante I4.
2. **Qué muestra el formulario** (la sugerencia). Sale de `user.membership_plan.current_amount`,
   que `UserOut` **ya devuelve** desde `add-membership-plans`, tanto en `GET /users/` como en
   `GET /users/{id}`. No hace falta ningún endpoint de "quote".

*Alternativa considerada:* `GET /payments/quote?user_id=...` que devuelva plan + monto sugerido +
período por default. Rechazada: agrega un endpoint y un round-trip para devolver un dato que la
respuesta de usuarios ya trae; y como la foto igual se recalcula en el alta, el quote no sería
autoritativo — sería una segunda fuente de verdad del mismo número, que puede divergir si el
precio cambia entre el quote y el submit (ahí manda el servidor, y está bien que mande).

*Alternativa considerada:* resolver la sugerencia en el frontend a partir de la lista de planes
(`useMembershipPlansQuery`) cruzada con el plan del usuario. Rechazada: duplica en TypeScript la
regla "precio vigente = mayor `effective_from <= hoy`" que ya vive en `current_price_for`.

**Miembro sin plan: el alta se rechaza** (requirement "Miembro sin plan no admite pagos"). Es un
estado alcanzable de primera clase desde `add-membership-plans` (D3 de ese design dejó a los
miembros preexistentes sin plan), así que el camino existe y hay que cerrarlo explícitamente:

- `create_payment` responde `400 "El miembro no tiene un plan asignado. Asignale un plan desde su
  ficha antes de registrar el pago"` y **no crea nada**.
- Orden de chequeos en el alta: `404` usuario inexistente → `400` membresía no activa → `400` sin
  plan → `409` ya hay pago para ese período. Los tres primeros son sobre el estado del miembro y
  se resuelven antes de mirar el período.
- El diálogo no deja llegar al submit: si el miembro elegido no tiene plan, muestra un aviso
  inline "Este miembro no tiene un plan asignado" con un link **"Asignar plan"** a su ficha
  (`/users/:id`, donde la card "Membresía" ya ofrece esa acción desde `add-membership-plans`) y
  deja el botón de guardar deshabilitado. El backend igual valida: la UI es conveniencia, no la
  regla.

*Alternativa considerada y descartada por la spec:* permitir el alta y guardar la foto en `NULL`
(era la decisión de la primera versión de este design). El Product Owner decidió lo contrario y
manda el requirement: un pago sin plan de referencia es un registro contable sin la trazabilidad
que este change viene a construir, y el arreglo —asignar el plan— está a un click en la ficha.

**Consecuencia importante para la lectura**: la regla es sobre el **alta**, no sobre el listado.
Los pagos anteriores a la migración quedan con la foto en `NULL` (D4, sin backfill) y **se siguen
mostrando** con "Sin plan" en la columna Plan. Por eso las tres columnas son nullable en la base y
`PaymentOut.plan` es `| None` (D1, D3.2): la nulabilidad modela historia vieja, no un camino de
escritura vivo. De acá en adelante, todo pago creado por la API tiene plan y precio de referencia.

**Plan asignado pero sin precio vigente hoy**: por construcción no es alcanzable desde la API —
`POST /membership-plans/` exige precio inicial y lo crea con `effective_from = hoy`, y el historial
es append-only, así que un plan siempre tiene un precio con `effective_from <= hoy`. Se cubre igual
de forma defensiva (el helper puede devolver vacío si alguien cargó datos a mano): mismo `400` que
el caso sin plan, con el texto apuntando al precio. No es un caso de producto, es un guard.

### D3. Contrato de API

#### D3.1. `POST /payments/` — **BREAKING** en la semántica de `amount`

```
PaymentCreate {
  user_id, method, method_channel?, note?, period_month, period_year,
  amount?: float >= 0        # antes: obligatorio
}
```

- `amount` **omitido o `null`** ⇒ se usa el precio de referencia del plan del miembro. Como el alta
  ya exigió que el miembro tenga plan con precio vigente (D2), esa referencia **siempre existe**
  cuando se llega a este punto: no hay un caso "sin monto y sin referencia".
- `amount` presente ⇒ se guarda tal cual (caso descuento/corrección de S3).
- En los dos casos el servidor escribe la foto (D2). Cualquier campo de plan que venga en el
  payload se ignora (`PaymentCreate` simplemente no lo declara).
- Errores: `404` usuario inexistente, `400` sin membresía activa, **`400` sin plan asignado**
  (nuevo, D2), `409` ya hay pago para ese período. Rol Dueño o Coach, sin cambios.
- Períodos futuros siguen permitidos (requirement "Un pago por miembro y período, con adelantos
  permitidos"): `period_year` solo se valida contra el rango `2020..2100`, no contra hoy.

Por qué es breaking: un cliente viejo que manda `amount` desde `AppSettings.default_fee` sigue
compilando y devolviendo `201`, pero **registra el monto equivocado** — la cuota deja de ser
`default_fee` y pasa a ser el precio del plan. Es un break semántico, silencioso, y los dos
clientes que lo tienen (`NewPaymentDialog` y el pago rápido de `UserCard`) se actualizan en este
mismo change (D5). Además `PaymentOut` cambia de forma (D3.2).

#### D3.2. `PaymentOut` expone la foto como objeto, leído de la propia fila — N+1 imposible por construcción

```
PaymentPlanRef { id: str | None, name: str, reference_amount: int | None }

PaymentOut {
  ...campos actuales...,
  user: UserSummary | None,
  plan: PaymentPlanRef | None     # None si el pago no tiene foto
}
```

`plan` se arma con `membership_plan_id` / `plan_name_at_payment` / `plan_amount_at_payment` de la
misma fila. **El listado no necesita ningún `join` ni ninguna query extra para devolver el plan
de cada pago**: ese es el beneficio concreto de desnormalizar (D1). `id` es nullable en el ref
porque un plan podría, en teoría, desaparecer de la base; el nombre de la foto sobrevive igual.

*Alternativa considerada:* devolver solo `membership_plan_id` y que el frontend resuelva el nombre
contra la lista de planes. Rechazada: mostraría el nombre **actual**, no el de la foto —
exactamente el bug que D1 evita.

#### D3.3. Filtros nuevos en `GET /payments/`

Se agregan, todos opcionales y combinables con los existentes (`user_id`, `q`, `limit`, `offset`):

| Param | Tipo | Nota |
|---|---|---|
| `period_month` | `int 1..12` | filtra por período del pago, no por `created_at` |
| `period_year` | `int 2020..2100` | |
| `method` | `"cash" \| "transfer"` | |

Orden y `X-Total-Count` se mantienen como están. No se toca la firma de `q` ni el `contains_eager`
de `User`.

#### D3.4. Endpoint nuevo: `GET /payments/summary`

```
GET /payments/summary?period_year=2026&period_month=9        # rol Dueño o Coach
200 {
  period_year, period_month,
  payments_count: int,
  amount_sum: float,          # suma de lo pagado (Payment.amount)
  members_active: int,        # miembros con membresía activa hoy
  members_paid: int,          # de esos, cuántos tienen pago de ese período
  members_pending: int        # members_active - members_paid
}
```

Es lo que alimenta los indicadores del período de la vista. Tres queries agregadas fijas, sin
N+1 y sin traer filas.

*Alternativa considerada:* reusar `GET /payments/reports/kpis` (que ya existe). Rechazada: agrega
por **`created_at`** en un rango de fechas, no por **período mes/año** — un pago de agosto
registrado el 2 de septiembre cae en septiembre. Para un indicador que dice "Cobrado de 09/2026"
sería el número equivocado. Se deja `kpis` intacto: lo consume el Dashboard.

*Alternativa considerada:* calcular los indicadores en el frontend con los pagos ya traídos.
Rechazada: el listado es paginado, así que o el número está mal o hay que traer todo (es el bug
latente del `limit: 200` que ya tiene `useDashboardData`).

#### D3.5. Anulación

`DELETE /payments/{payment_id}` **no cambia**: sigue siendo `204`, sigue siendo solo Dueño. Lo
único nuevo es que la UI lo expone (hoy no hay dónde hacerlo).

### D4. Migración Alembic: solo esquema, sin backfill

Una revision, `down_revision = "6c1a341f03a2"` (confirmar con `python -m alembic heads` al
implementar, por si otra sesión mergeó algo antes). `upgrade()` hace una sola cosa: `add_column`
de las tres columnas de D1 — todas nullable —, la FK a `membership_plans.id` con
`ondelete="RESTRICT"` y el índice sobre `membership_plan_id`. `downgrade()` las dropea.

**Sin backfill, explícitamente.** Se consideró y se rechaza: rellenar los pagos existentes con el
plan actual del miembro y su precio de hoy sería **inventar una foto** de un momento que ya pasó —
el miembro pudo no haber tenido ese plan, y el precio de hoy no es el que regía. Escribiría datos
falsos en la única tabla que este change convierte en registro histórico auditable, para poblar
pagos de prueba de una beta. Los pagos viejos quedan con `plan = null` y la vista los muestra
"Sin plan". Con la regla de D2 (el alta exige plan), esos pagos previos a la migración son **el
único** origen de una foto nula: la nulabilidad de las columnas existe para poder leerlos, no para
poder escribirlos.

Es la misma decisión, y por el mismo motivo, que D3 de `add-membership-plans` (que dejó a los
miembros preexistentes sin plan).

Consecuencia buscada: **ninguna foto de pago existe sin que alguien haya registrado ese pago con
un plan vigente**. No hay un "General" fantasma ni una referencia reconstruida a posteriori.

`backend/scripts/seed_dev_users.py` ya crea un plan y se lo asigna a `dev.member@...` (D3 de
`add-membership-plans`), así que el entorno de desarrollo tiene todo lo necesario para probar el
camino feliz sin tocar el script.

**Despliegue**: `make migrate` (`alembic upgrade head`). La migración es puramente aditiva: si el
código nuevo llega antes, las queries fallan hasta correrla, sin pérdida ni corrupción. Rollback =
revertir el merge; las columnas quedan y el código viejo las ignora.

### D5. Frontend

#### D5.1. Estructura de `frontend/src/pages/Payments.tsx`

Reconstruida sobre `ListPageLayout` + `Pagination`, calcado de `MembershipPlans.tsx` (que es el
consumidor más reciente del patrón) — así la vista hereda el tema sin decisiones visuales nuevas:
`Card` raíz Level 1, header compacto de una fila, toolbar, cuerpo con scroll interno y un único
pie de paginación (`docs/design/design.md`, "6. List Page").

- **Header**: `title="Pagos"`, `count={`${total} pagos`}`.
- **`primaryAction`**: un `<div className="flex gap-2">` con **dos** botones — `Planes`
  (`variant="outline"`, `asChild` + `<Link to="/plans">`, **se conserva tal cual**, incluido el
  rol `link` y el texto que ya testea `Payments.test.tsx`) y `Registrar pago` (primario, con
  ícono + `aria-label` fijo + `<span className="hidden md:inline">`, como exige `ListPageLayout`
  para viewports < 768px).
- **Indicadores del período**: una tira compacta **dentro del slot `toolbar`**, arriba de los
  filtros: "Cobrado de MM/AAAA", "Pagos registrados", "Miembros al día / activos", alimentada por
  `GET /payments/summary` del período seleccionado. *Alternativa considerada:* KPI cards grandes
  fuera de `ListPageLayout` — rechazada: `ListPageLayout` fija
  `lg:h-[var(--list-page-height)]` y cualquier bloque arriba desborda el viewport; la otra salida
  era agregarle un slot `banner`, o sea tocar un componente compartido con Usuarios por una
  necesidad de una sola vista.
- **Filtros** (también en `toolbar`): búsqueda por nombre/email/teléfono con
  `useDebounce(q, 400)`; período (selector de mes + año, default el mes actual); método
  (Todos / Efectivo / Transferencia). Cualquier cambio de filtro resetea `offset` a 0, igual que
  `MembershipPlans`.
- **Tabla**: Miembro (nombre + contacto), Período (`MM/AAAA`), **Plan** (nombre de la foto, o
  "Sin plan" en `text-muted-foreground` — solo para los pagos anteriores a la migración, D2/D4),
  **Precio de referencia** (cuando difiere del pagado), **Monto** (lo pagado, formateado con la `currency` de
  `useSettingsStore`; si difiere de `plan.reference_amount`, un badge discreto "editado" con la
  referencia en el `title`), Método + canal, Registrado el, y acciones.
- **Acciones**: "Anular" solo si el usuario actual es Dueño (`useAuthStore`), en diálogo de
  confirmación, mismo patrón que las acciones de `MembershipPlans.tsx`. Un Coach no ve el botón
  (y si lo viera, el backend responde 403).
- **`footer`**: `<Pagination total limit offset onChange />`.

#### D5.2. `PaymentDialog` nuevo, reusable

`frontend/src/components/PaymentDialog.tsx`, un solo componente para los dos puntos de entrada:

- Props: `{ open, onOpenChange, user?: User | EmbeddedUser, onSuccess? }`. Con `user` ⇒ sin
  selector (entrada desde la ficha o desde una fila). Sin `user` ⇒ un buscador de miembro que usa
  `useUsersQuery({ q: debounced, limit: 20 })` — el listado de `/users/`, no `services/search.ts`,
  porque `UserOut` es el que trae `membership_plan.current_amount` que necesita la precarga (D2).
- Precarga: monto = `user.membership_plan.current_amount`, período = mes/año actuales, método = el
  primero habilitado.
- **Miembro sin plan**: no se precarga nada; aviso inline "Este miembro no tiene un plan asignado"
  + link "Asignar plan" a `/users/:id` y submit deshabilitado (D2). El picker de la vista Pagos
  puede seleccionarlo (el listado de usuarios no filtra por plan), así que el bloqueo vive en el
  diálogo, no en el selector.
- Métodos: solo los habilitados en Configuración (`allow_cash` / `allow_transfer` del
  `useSettingsStore`). Regla ya vigente de `app-settings-state`, no se modifica ahí; acá solo se
  refleja. Si no hay ninguno habilitado, el submit queda deshabilitado con el aviso
  correspondiente.
- Envío: `useCreatePaymentMutation` (React Query, invalida `queryKeys.payments.all`). **Omite
  `amount` si el usuario no lo tocó**, para que la foto y el monto los fije el servidor (D3.1).
  Sigue despachando el `CustomEvent("payments:created")` que consume
  `hooks/useLegacyRefetchBridge.ts` — sacarlo rompería el refresco de `UserCard`/`SpotlightSearch`.

#### D5.3. Qué pasa con lo que sobrevivió de la implementación vieja

- **`NewPaymentDialog.tsx` se elimina** y `UserCard.tsx` pasa a usar `PaymentDialog`. Mantener los
  dos dejaría dos altas de pago con reglas distintas (una precarga `default_fee`, la otra el plan)
  — que es literalmente el bug que este change viene a cerrar.
- **El "pago rápido" de `UserCard` se conserva**, pero deja de mandar `amount`: con `amount`
  opcional (D3.1), omitirlo es exactamente "cobrar el precio del plan". Es la simplificación que
  habilita el contrato nuevo.
- **`LastPayments.tsx` se conserva** con un solo cambio: muestra el nombre del plan de la foto
  junto al monto, para no contradecir la tabla nueva. No se migra a React Query (no hace falta
  para este change y ampliaría el diff sin beneficio).
- El `useEffect` que lee `AppSettings.default_fee` en `UserCard` queda sin uso para pagos; se
  saca lo que quede muerto, pero **`default_fee` no se deprecia acá** (es M5).

#### D5.4. Alta desde la ficha del miembro

En `frontend/src/pages/UserDetail.tsx`, botón **"Registrar pago"** en el `CardFooter` de la card
"Membresía", junto a "Cambiar plan" / "Asignar plan". Visible solo con `canManage` y
`membership_status === "active"` (misma condición que el backend). Abre `PaymentDialog` con el
usuario ya cargado; al confirmar, invalida `queryKeys.payments.all` y
`queryKeys.users.detail(id)` para que el indicador de cuota se actualice al instante (§4, flujo 4:
"el semáforo pasa a verde al instante").

#### D5.5. Servicios y tipos

- `services/payments.ts`: `PaymentsParams` gana `period_month`, `period_year`, `method`;
  `CreatePaymentInput.amount` pasa a `number | undefined`; `fetchPaymentsSummary(period)` y
  `deletePayment(id)` nuevos.
- `services/payments.queries.ts`: `usePaymentsSummaryQuery`, `useDeletePaymentMutation` (invalida
  `queryKeys.payments.all` y `queryKeys.users.all`).
- `services/queryKeys.ts`: `payments.summary(period)` — único lugar del repo donde se escribe una
  key.
- `types.ts`: `Payment` gana `plan: PaymentPlanRef | null`; tipo `PaymentPlanRef` nuevo.
- `test/apiMock.ts`: rutas `/payments/summary` y `DELETE /payments/:id`.

### D6. Blast radius (medido)

`codegraph impact Payment` → 4 símbolos, en 2 archivos: `backend/app/models.py:203` y
`frontend/src/types.ts:72`. `codegraph callers create_payment` y `codegraph callers list_payments`
→ **sin callers**: son endpoints HTTP y el grafo no cruza esa frontera, así que el radio real se
midió por consumidores.

- **Backend**: las ~40 referencias a `models.Payment` viven **todas** en
  `backend/app/routers/payments.py`. Ningún otro router, script ni servicio toca la tabla. El
  radio backend es un archivo más `models.py`, `schemas.py` y la migración.
- **Los 4 endpoints de reportes** (`/reports/kpis`, `/by_method`, `/by_channel`, `/timeseries`)
  agregan por `created_at`, `method` y `method_channel`, y suman `Payment.amount`. Como las
  columnas nuevas son aditivas y `Payment.amount` conserva su significado, **ninguna agregación
  cambia**. El riesgo concreto sería haber guardado la referencia en `amount` (o haber empezado a
  guardar ahí el precio del plan): los cuatro reportes y el KPI del Dashboard cambiarían de
  significado en silencio. Es el invariante I1, y tiene test propio.
- **Dashboard**: `hooks/useDashboardData.ts` usa `usePaymentsQuery({ limit: 200 })`,
  `usePaymentsKpisQuery(monthRange)` y `getPendingClients(...)`; `revenueMonth` sale de
  `/reports/kpis` con fallback sobre `payment.amount`. Todo sigue funcionando sin cambios: los
  filtros nuevos son opcionales y el campo `plan` es aditivo. `pages/Dashboard.test.tsx` no debería
  moverse.
- **Otros consumidores HTTP de `/payments`**: `services/payments.ts` + `.queries.ts`,
  `components/LastPayments.tsx`, `components/UserCard.tsx` (pago rápido + diálogo),
  `components/SpotlightSearch.tsx` (renderiza `UserCard`), `hooks/useLegacyRefetchBridge.ts`
  (evento `payments:created`), `lib/routePreload.ts` y `lib/navigation.ts` (ruta `/payments`, sin
  cambios), `test/apiMock.ts`.
- **Tests existentes que hay que tocar**: `backend/tests/test_payments.py` —
  `test_crear_leer_y_borrar_un_pago` y `test_coach_lista_y_lee_un_pago` construyen el payload y
  leen la respuesta del alta; `frontend/src/pages/__tests__/Payments.test.tsx` — el caso del botón
  "Planes" se conserva, el resto del archivo se reescribe sobre la vista nueva.

## Risks / Trade-offs

- **[Foto desnormalizada que se desincroniza del plan]** → Es deliberado: la foto *tiene* que
  divergir del plan cuando el plan cambia. El riesgo real es que alguien la "arregle" con un
  `UPDATE` masivo. Mitigación: docstring en el modelo, invariante I2 y test de que renombrar o
  cambiar el precio no toca pagos ya registrados.
- **[Los pagos previos a la migración se muestran "Sin plan" para siempre]** → Se acepta: son
  pagos de prueba de la beta y el backfill está descartado (D4). El texto es el mismo que ya usa
  `UserDetail` para un miembro sin plan, así que no introduce vocabulario nuevo.
- **[Rechazar el pago de un miembro sin plan puede frenar un cobro en el mostrador]** → Es la
  regla que fijó producto. Mitigación de UX: el aviso del diálogo lleva directo a "Asignar plan"
  en la ficha, que es una acción de dos clicks y no exige reactivar nada (D2.1 de
  `add-membership-plans` ya la habilitó incluso para miembros dados de baja).
- **[`amount` opcional puede hacer que un bug del frontend cobre de más o de menos en silencio]**
  → Mitigación: el `PaymentDialog` solo omite `amount` cuando el usuario no editó el campo, y el
  monto que se usa al omitirlo es el mismo que el diálogo mostró (el precio vigente del plan);
  más los tests de los dos caminos (con y sin `amount`).
- **[Break semántico silencioso en clientes viejos]** → Los dos clientes viejos se actualizan en
  este change (D5.3) y `NewPaymentDialog` se elimina, así que no queda ninguno que mande
  `default_fee`.
- **[Eliminar `NewPaymentDialog` arrastra `UserCard` y `SpotlightSearch`]** → Diff más grande de
  lo estrictamente necesario. Se acepta: la alternativa (dos altas con reglas distintas) es peor,
  y `UserCard` solo cambia el componente que renderiza y el payload del pago rápido.
- **[`GET /payments/summary` cuenta "miembros activos" hoy, no al cierre del período]** →
  Consultar un período pasado da un denominador del presente. Se acepta para el MVP (no hay
  historial de membresía por fecha); el indicador se lee como "de los miembros activos hoy,
  cuántos tienen pago de este período", que es el uso real (mes corriente).
- **[Índice extra en `payments`]** → Un índice más en una tabla de escritura baja. Costo
  despreciable frente a poder filtrar/agrupar por plan.

## Migration Plan

1. Merge → `make migrate` (`alembic upgrade head`) en el entorno correspondiente. En Railway, por
   CLI, como el resto de las migraciones del proyecto (no corren en el deploy).
2. Orden libre respecto del deploy del código: la migración es aditiva. Si el código llega
   primero, las queries de pagos fallan hasta correrla; no hay pérdida de datos.
3. Rollback: revertir el merge. Las tres columnas quedan en la base y el código viejo las ignora.
   `downgrade()` existe y es destructivo solo para las fotos ya registradas (queda en el docstring
   de la revision).

## Open Questions

- Ninguna bloqueante. Queda anotado para producto (§3.5 del doc de producto ya lo advierte): si
  más adelante se decide que un pago atrasado sugiera el precio que regía **en el período pagado**
  en vez del vigente al registrar, es un cambio a S3 — el modelo de D1 lo soporta sin migrar nada
  (basta cambiar el `on=` que se le pasa a `current_price_for`).

## Plan de verificación

**Riesgo**: alto — el diff toca `backend/app/models.py` y agrega una revision en
`backend/migrations/**`, los dos gatillos fijos de la tabla de riesgo del rol Arquitecto. Además
cambia la semántica de un campo del contrato de alta (`amount`) del que dependen los KPIs de
facturación del Dashboard.

### Invariantes

- I1. `Payment.amount` sigue siendo el monto efectivamente pagado: los 4 endpoints de reportes y
  el KPI de facturación del Dashboard devuelven los mismos números que antes del change.
- I2. La foto (`membership_plan_id`, `plan_name_at_payment`, `plan_amount_at_payment`) es
  inmutable: ningún camino de escritura de la API la modifica después del alta.
- I3. Renombrar un plan, agregarle un precio nuevo o desactivarlo no cambia nada de lo que muestra
  un pago ya registrado.
- I4. El cliente nunca decide la foto: `create_payment` la resuelve en el servidor con
  `current_price_for` y el payload no puede aportarla.
- I5. El alta rechaza con `400` a un miembro sin plan asignado y no crea el pago; la **lectura**
  sigue tolerando pagos con foto nula (los anteriores a la migración), que se muestran "Sin plan".
  De acá en adelante, todo pago creado por la API tiene plan y precio de referencia.
- I6. El listado de pagos resuelve el plan de cada fila sin queries adicionales (la foto vive en
  la fila): el número de queries no depende del tamaño de la página.
- I7. La autorización no cambia: alta, listado, detalle y resumen exigen sesión y rol Dueño o
  Coach; anular sigue siendo solo Dueño.
- I8. Se mantiene un solo pago por miembro y período (unique `(user_id, period_month,
  period_year)`), y se siguen aceptando períodos futuros (pago adelantado).
- I9. Anular un pago no deja estado derivado obsoleto: el indicador de cuota se recalcula solo
  (`payment-status-indicator` no persiste nada) y la UI invalida también `queryKeys.users.all`.

### Tests

| Capa | Archivo | Caso |
|---|---|---|
| backend | `backend/tests/test_payments.py` | `test_alta_congela_plan_y_precio_vigente_del_miembro` |
| backend | `backend/tests/test_payments.py` | `test_alta_sin_amount_usa_el_precio_de_referencia_del_plan` |
| backend | `backend/tests/test_payments.py` | `test_alta_con_amount_editado_guarda_lo_pagado_y_la_referencia` |
| backend | `backend/tests/test_payments.py` | `test_alta_ignora_plan_y_precio_enviados_en_el_payload` |
| backend | `backend/tests/test_payments.py` | `test_alta_de_miembro_sin_plan_responde_400_y_no_crea_el_pago` |
| backend | `backend/tests/test_payments.py` | `test_alta_de_miembro_dado_de_baja_responde_400` |
| backend | `backend/tests/test_payments.py` | `test_alta_de_periodo_futuro_se_acepta` |
| backend | `backend/tests/test_payments.py` | `test_segundo_pago_del_mismo_periodo_responde_409` |
| backend | `backend/tests/test_payments.py` | `test_listado_tolera_pagos_previos_sin_foto_de_plan` |
| backend | `backend/tests/test_payments.py` | `test_cambiar_el_precio_del_plan_no_reescribe_pagos_registrados` |
| backend | `backend/tests/test_payments.py` | `test_renombrar_o_desactivar_el_plan_no_cambia_la_foto_del_pago` |
| backend | `backend/tests/test_payments.py` | `test_listado_devuelve_la_foto_del_plan_de_cada_pago` |
| backend | `backend/tests/test_payments.py` | `test_listado_filtra_por_periodo_y_por_metodo` |
| backend | `backend/tests/test_payments.py` | `test_resumen_del_periodo_devuelve_cobrado_pagados_y_pendientes` |
| backend | `backend/tests/test_payments.py` | `test_resumen_del_periodo_con_miembro_responde_403` |
| backend | `backend/tests/test_payments.py` | `test_reportes_suman_el_monto_pagado_y_no_el_de_referencia` |
| backend | `backend/tests/test_payments.py` | `test_alta_con_method_cash_y_method_channel_responde_422` |
| backend | `backend/tests/test_payments.py` | `test_anular_pago_recalcula_el_indicador_de_cuota_a_mora` |
| backend | `backend/tests/test_payments.py` | `test_cambiar_el_plan_del_miembro_no_cambia_la_foto_del_pago_ya_registrado` |
| frontend | `frontend/src/pages/__tests__/Payments.test.tsx` | `muestra el plan y el monto de cada pago en la tabla` |
| frontend | `frontend/src/pages/__tests__/Payments.test.tsx` | `muestra Sin plan en un pago sin plan de referencia` |
| frontend | `frontend/src/pages/__tests__/Payments.test.tsx` | `muestra los indicadores del periodo seleccionado` |
| frontend | `frontend/src/pages/__tests__/Payments.test.tsx` | `filtra por periodo y por metodo` |
| frontend | `frontend/src/pages/__tests__/Payments.test.tsx` | `ofrece un boton Planes que navega a la vista de planes` |
| frontend | `frontend/src/pages/__tests__/Payments.test.tsx` | `oculta la accion de anular para un Coach` |
| frontend | `frontend/src/pages/__tests__/Payments.test.tsx` | `anula un pago como Dueno tras confirmar` |
| frontend | `frontend/src/components/__tests__/PaymentDialog.test.tsx` | `precarga el monto con el precio vigente del plan del miembro` |
| frontend | `frontend/src/components/__tests__/PaymentDialog.test.tsx` | `bloquea el alta y ofrece asignar plan si el miembro no tiene plan` |
| frontend | `frontend/src/components/__tests__/PaymentDialog.test.tsx` | `precarga el precio vigente al registrar y no el del periodo cubierto` |
| frontend | `frontend/src/components/__tests__/PaymentDialog.test.tsx` | `solo ofrece los metodos habilitados en Configuracion` |
| frontend | `frontend/src/components/__tests__/PaymentDialog.test.tsx` | `conserva el monto editado si la prop user cambia de identidad con el dialogo abierto` |
| frontend | `frontend/src/components/__tests__/PaymentDialog.test.tsx` | `avisa si el miembro tiene plan pero sin precio vigente` |
| frontend | `frontend/src/components/__tests__/PaymentDialog.test.tsx` | `no busca miembros si el miembro ya viene por prop` |
| frontend | `frontend/src/components/__tests__/PaymentDialog.test.tsx` | `siempre manda el amount en el payload, editado o no (verification.md hallazgo 1, segunda pasada)` |
| frontend | `frontend/src/components/__tests__/UserCard.test.tsx` | `ofrece los dos metodos cuando estan habilitados en Configuracion` |
| frontend | `frontend/src/components/__tests__/UserCard.test.tsx` | `ofrece solo el metodo habilitado en Configuracion (verification.md hallazgo 2)` |
| frontend | `frontend/src/components/__tests__/UserCard.test.tsx` | `nombra el medio de cobro en el CTA cuando solo hay un metodo habilitado (verification.md hallazgo 7)` |
| frontend | `frontend/src/components/__tests__/UserCard.test.tsx` | `no ofrece el cobro rapido si no hay ningun metodo habilitado` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `abre el dialogo de pago desde la ficha de un miembro activo` |
| frontend | `frontend/src/pages/__tests__/Dashboard.test.tsx` | `sigue mostrando la facturacion del mes con pagos que traen plan` |
| frontend | `frontend/src/pages/__tests__/Dashboard.test.tsx` | `usa el precio vigente del plan del miembro, no default_fee` |
| frontend | `frontend/src/pages/__tests__/Dashboard.test.tsx` | `solo ofrece los metodos habilitados en Configuracion` |
| frontend | `frontend/src/pages/__tests__/Dashboard.test.tsx` | `no ofrece el cobro rapido si el miembro no tiene plan` |
| backend | `backend/tests/test_payments.py` | `test_alta_con_method_transfer_y_method_channel_responde_201` |
| manual | — | `make migrate` y verificar en Pagos que los pagos previos a la migración aparecen con "Sin plan" y que la tabla no muestra errores |
| manual | — | Con `make seed-dev`: ficha de `dev.member@miniespacio.local` → "Registrar pago" → el monto viene precargado con el precio del plan; guardar; ir a Planes, cambiarle el precio al plan; volver a Pagos y verificar que el pago registrado sigue mostrando el precio viejo |
| manual | — | En Configuración desactivar "Efectivo" y verificar que el diálogo de pago ya no lo ofrece |
