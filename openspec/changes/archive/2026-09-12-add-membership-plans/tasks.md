## 1. Modelo y migración de esquema

- [x] 1.1 En `backend/app/models.py`, agregar el modelo `MembershipPlan` (`id` uuid str PK, `name`,
      `name_normalized` único, `description` nullable, `is_active` default `True`, `created_at`,
      `updated_at`, `created_by_user_id` FK `users.id` ON DELETE SET NULL) según D1 del design.
- [x] 1.2 En `backend/app/models.py`, agregar el modelo `MembershipPlanPrice` (`id`, `plan_id` FK
      `membership_plans.id` ON DELETE RESTRICT indexado, `amount` `Integer`, `effective_from`
      `Date`, `created_at`, `created_by_user_id`), con `UniqueConstraint(plan_id, effective_from)`
      e índice `(plan_id, effective_from)`.
- [x] 1.3 En `backend/app/models.py`, agregar a `User` las columnas `membership_plan_id` (FK
      `membership_plans.id` ON DELETE RESTRICT, **nullable**, indexada), `plan_since` (`Date`,
      nullable) y `plan_changed_by_user_id` (FK `users.id` ON DELETE SET NULL, nullable), con las
      relationships correspondientes y `foreign_keys` explícito para evitar la ambigüedad de las
      dos FK a `users`.
- [x] 1.4 Agregar el helper `current_price_for(db, plan_ids, on=date.today())` (una sola query con
      subconsulta `func.max(effective_from)`, sin `DISTINCT ON`, para que corra igual en SQLite y
      Postgres) en `backend/app/routers/membership_plans.py` o un módulo compartido, y el helper de
      normalización de nombre (NFC + strip + casefold) siguiendo `routine_templates.py`.
- [x] 1.5 Confirmar el head actual con `python -m alembic heads` y generar la revision nueva en
      `backend/migrations/versions/` con `down_revision` = ese head (esperado `69362a3ad95d`).
      `upgrade()` hace **solo esquema** (D3): `create_table` de las dos tablas con sus índices y el
      unique, y `add_column` de las tres columnas nullable de `users` con sus FKs y el índice sobre
      `membership_plan_id`. Sin backfill, sin plan "General", sin leer `default_fee`.
- [x] 1.6 Implementar `downgrade()` simétrico: dropea las tres columnas de `users` y luego las
      tablas `membership_plan_prices` y `membership_plans`. Docstring de la revision que aclara que
      el downgrade es destructivo para los planes cargados.
- [x] 1.7 Correr `make migrate` contra la base local y verificar que `alembic upgrade head` y
      `alembic downgrade -1` corren sin error y que ninguna fila preexistente de `users` cambió
      (invariante I6).

## 2. Schemas y API de planes

- [x] 2.1 En `backend/app/schemas.py`, agregar `MembershipPlanBase`, `MembershipPlanCreate`
      (`name`, `description?`, `amount >= 0`), `MembershipPlanUpdate` (`name?`, `description?`),
      `MembershipPlanPriceCreate` (`amount`, `effective_from?`), `MembershipPlanPriceOut`,
      `MembershipPlanOut` (con `current_price: MembershipPlanPriceOut | None` y `members_count:
      int`), `MembershipPlanDetail` (+ `price_history`) y `MembershipPlanSummary` (`id`, `name`,
      `current_amount`).
- [x] 2.2 Crear `backend/app/routers/membership_plans.py` con
      `APIRouter(prefix="/membership-plans", tags=["membership-plans"],
      dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))])` y registrarlo en
      `backend/app/main.py`.
- [x] 2.3 Implementar `GET /membership-plans/` con filtros `q` e `is_active`, paginación
      (`limit` 1..200 default 50, `offset`), header `X-Total-Count`, precio vigente resuelto con
      una sola query y `members_count` por plan con un `group by` único (sin N+1, sin header
      `Link`).
- [x] 2.4 Implementar `GET /membership-plans/{plan_id}` devolviendo `MembershipPlanDetail` con el
      `price_history` completo ordenado por `effective_from` descendente; `404` si no existe.
- [x] 2.5 Implementar `POST /membership-plans/`: crea el plan activo más su primer
      `MembershipPlanPrice` (`effective_from` = hoy) en la misma transacción; `201` + header
      `Location`; `409` por nombre duplicado (chequeo previo normalizado **y** captura del
      `IntegrityError` del índice único); `422` si `amount < 0`.
- [x] 2.6 Implementar `PATCH /membership-plans/{plan_id}` (solo `name` y `description`, nunca
      precio ni `is_active`): `404`, `409` por nombre duplicado.
- [x] 2.7 Implementar `POST /membership-plans/{plan_id}/prices`: inserta una fila nueva sin tocar
      las anteriores; `400` si `effective_from < date.today()`; `409` si ya hay un precio con ese
      `effective_from`; `404` si el plan no existe. Registra `created_by_user_id`.
- [x] 2.8 Implementar `POST /membership-plans/{plan_id}/deactivate` y
      `POST /membership-plans/{plan_id}/activate`: `404`; `409` si ya está en ese estado; `409`
      "No se puede desactivar el último plan activo" cuando es el único activo restante.

## 3. API de usuarios: plan del miembro

- [x] 3.1 En `backend/app/schemas.py`, sumar `membership_plan_id: Optional[str]` a `UserCreate`,
      `membership_plan: Optional[MembershipPlanSummary]` y `plan_since: Optional[date]` a
      `UserOut`, y agregar `UserPlanChangeIn { membership_plan_id }`.
- [x] 3.2 En `backend/app/routers/users.py`, validar en `create_user`: `role == member` sin
      `membership_plan_id` ⇒ `400 "Un Miembro necesita un plan de membresía"`; plan inexistente o
      inactivo ⇒ `400`; rol distinto de Miembro con `membership_plan_id` ⇒ `400`. Al crear, setear
      `membership_plan_id`, `plan_since = hoy` y `plan_changed_by_user_id = current_user.id`.
- [x] 3.3 En `backend/app/routers/users.py`, exigir plan en `activate_membership`: si el usuario no
      tiene `membership_plan_id` ⇒ `400 "Asigná un plan antes de activar la membresía"`.
- [x] 3.4 Implementar `POST /users/{user_id}/plan` en `backend/app/routers/users.py` con
      `require_can_manage_user`, sirviendo tanto al cambio de plan como a la asignación inicial de
      un miembro preexistente **sin plan** (mismo endpoint, ver D3): `404` usuario o plan, `400` si
      la membresía no está activa, `400` si el plan está inactivo, `409` si ya tiene ese plan; en
      el éxito actualiza `membership_plan_id`, `plan_since = hoy` y `plan_changed_by_user_id` y
      devuelve `UserOut`.
- [x] 3.5 Ajustar `_serialize_user` / `_serialize_user_single` para recibir el
      `MembershipPlanSummary` ya resuelto (o `None` cuando el miembro no tiene plan), y en
      `list_users` agregar el `outerjoin` a `membership_plans` más **una** query de precios
      vigentes para los `plan_id` distintos de la página (invariante I7: sin N+1).

## 4. Seed de desarrollo

- [x] 4.1 Ajustar `backend/scripts/seed_dev_users.py` para que **cree él mismo** un plan activo con
      su precio inicial (reusándolo por `name_normalized` si ya existe, de forma idempotente) y se
      lo asigne a `dev.member@miniespacio.local` con `plan_since` antes de dejarlo con membresía
      activa — no hay backfill que se lo dé (D3/D5). Verificar con `make seed-dev`.

## 5. Tests de backend

- [x] 5.1 Agregar en `backend/tests/helpers.py` (o el `conftest.py`) un helper para crear planes de
      prueba vía API, reutilizable por los archivos de tests nuevos.
- [x] 5.2 `backend/tests/test_membership_plans.py`: `test_crear_plan_devuelve_201_con_precio_inicial`
- [x] 5.3 `backend/tests/test_membership_plans.py`: `test_crear_plan_con_nombre_duplicado_devuelve_409`
- [x] 5.4 `backend/tests/test_membership_plans.py`: `test_nuevo_precio_inserta_fila_y_no_modifica_la_anterior`
- [x] 5.5 `backend/tests/test_membership_plans.py`: `test_nuevo_precio_retroactivo_devuelve_400`
- [x] 5.6 `backend/tests/test_membership_plans.py`: `test_desactivar_el_ultimo_plan_activo_devuelve_409`
- [x] 5.7 `backend/tests/test_membership_plans.py`: `test_listado_filtra_por_activo_y_expone_total_count`
- [x] 5.8 `backend/tests/test_membership_plans.py`: `test_planes_sin_sesion_devuelve_401_y_con_rol_member_403`
- [x] 5.9 `backend/tests/test_user_plan.py`: `test_alta_de_miembro_sin_plan_devuelve_400`
- [x] 5.10 `backend/tests/test_user_plan.py`: `test_alta_de_miembro_con_plan_inactivo_devuelve_400`
- [x] 5.11 `backend/tests/test_user_plan.py`: `test_cambiar_plan_registra_plan_since_y_autor`
- [x] 5.12 `backend/tests/test_user_plan.py`: `test_cambiar_plan_no_modifica_los_pagos_existentes`
- [x] 5.13 `backend/tests/test_user_plan.py`: `test_activar_membresia_sin_plan_devuelve_400`
- [x] 5.14 `backend/tests/test_user_plan.py`: `test_asignar_plan_a_miembro_preexistente_sin_plan_devuelve_200`
- [x] 5.15 `backend/tests/test_user_plan.py`: `test_listado_de_usuarios_expone_el_plan_vigente_y_null_si_no_tiene`
- [x] 5.16 `backend/tests/test_user_plan.py`: `test_cambiar_plan_sin_sesion_devuelve_401_y_con_rol_member_403`
- [x] 5.17 `backend/tests/test_dev_seed.py`: `test_seed_dev_users_crea_plan_y_lo_asigna_al_miembro_activo`

## 6. Frontend: tipos y capa de datos

- [x] 6.1 En `frontend/src/types.ts`, agregar `MembershipPlan`, `MembershipPlanPrice` y
      `MembershipPlanSummary`, y sumar a `User` los campos **opcionales** `membership_plan?:
      MembershipPlanSummary | null` y `plan_since?: string | null` (D5: los `makeUser` de los tests
      construyen `User` literal).
- [x] 6.2 En `frontend/src/services/queryKeys.ts`, agregar `membershipPlans = { all, list(params),
      detail(id) }` — único lugar donde se escriben keys.
- [x] 6.3 Crear `frontend/src/services/membershipPlans.ts` con `fetchMembershipPlans` (usando
      `readTotalCount` como `users.ts`), `fetchMembershipPlan`, `createMembershipPlan`,
      `updateMembershipPlan`, `addMembershipPlanPrice`, `deactivateMembershipPlan` y
      `activateMembershipPlan`.
- [x] 6.4 Crear `frontend/src/services/membershipPlans.queries.ts` con las queries y mutations;
      toda mutación de plan invalida `queryKeys.membershipPlans.all`.
- [x] 6.5 En `frontend/src/services/users.ts` y `users.queries.ts`, agregar `changeUserPlan`
      (`POST /users/{id}/plan`) y su mutation, que invalida `queryKeys.users.all` y
      `queryKeys.membershipPlans.all`; sumar `membership_plan_id` al payload de `createUser`.

## 7. Frontend: pantalla de Planes

- [x] 7.1 Crear `frontend/src/pages/MembershipPlans.tsx` con `ListPageLayout` (título "Planes",
      `count` con el total, `primaryAction` "Crear plan" con `aria-label` fijo y texto en
      `<span className="hidden md:inline">`), toolbar con buscador `q` y filtro
      Activos/Inactivos/Todos, tabla Nombre · Precio vigente · Vigente desde · Miembros · Estado ·
      acciones, footer con `<Pagination>` y empty state.
- [x] 7.2 Registrar la ruta `/plans` en `frontend/src/App.jsx` con
      `<ProtectedRoute roles={["owner","coach"]}>` y `lazy(() => import("./pages/MembershipPlans"))`
      directo (sin pasar por `lib/routePreload.ts`, que es solo para rutas del Sidebar).
- [x] 7.3 Agregar el botón "Planes" (`<Button variant="outline" asChild><Link to="/plans">`) en el
      `CardHeader` de `frontend/src/pages/Payments.tsx`, sin tocar el resto del placeholder.
- [x] 7.4 Crear `frontend/src/components/CreateMembershipPlanDialog.tsx` (nombre, descripción,
      precio inicial) con manejo del `409` de nombre duplicado.
- [x] 7.5 Crear `frontend/src/components/EditMembershipPlanDialog.tsx` (nombre, descripción).
- [x] 7.6 Crear `frontend/src/components/NewPlanPriceDialog.tsx` (monto + vigente desde, con el
      historial de precios visible para dejar claro que agrega y no pisa).
- [x] 7.7 Cablear desactivar/reactivar con `ConfirmActionDialog` desde el listado, mostrando el
      mensaje del `409` cuando es el último plan activo y deshabilitando la acción en ese caso.

## 8. Frontend: alta, ficha y listado de usuarios

- [x] 8.1 En `frontend/src/components/CreateUserDialog.tsx`, mostrar el selector de plan cuando
      `role === "member"` (poblado con la query de planes filtrada a activos), sumar el plan al
      payload de `createUser` e incorporar `missingRequiredPlan` a la guarda del botón Guardar.
- [x] 8.2 En `frontend/src/components/CreateUserDialog.tsx`, cuando no hay ningún plan activo,
      reemplazar el selector por el aviso "No hay planes activos" con un botón "Ir a Planes" que
      cierra el diálogo y navega a `/plans`, dejando Guardar deshabilitado.
- [x] 8.3 Crear `frontend/src/components/ChangeMembershipPlanDialog.tsx` (selector de planes
      activos + aviso "aplica a los próximos pagos"), con el copy del título y del botón de
      confirmación parametrizado para servir tanto a "Cambiar plan" como a "Asignar plan".
- [x] 8.4 En `frontend/src/pages/UserDetail.tsx`, agregar a la Card "Membresía" la fila "Plan"
      (nombre, precio vigente y "desde {plan_since}"), sin renderizar la sección para usuarios sin
      perfil de miembro.
- [x] 8.5 En `frontend/src/pages/UserDetail.tsx`, cubrir el estado **miembro sin plan** (caso
      preexistente, D3): la fila dice "Sin plan" y el botón del `CardFooter` dice "Asignar plan"
      en vez de "Cambiar plan", abriendo el mismo `ChangeMembershipPlanDialog` contra el mismo
      endpoint; tras asignar, la ficha queda idéntica a la de un miembro con plan desde el alta.
- [x] 8.6 En `frontend/src/components/ActivateMembershipDialog.tsx`, mostrar el selector de plan
      cuando el usuario no tiene plan asignado, y propagar el copy del `400` del backend.
- [x] 8.7 En `frontend/src/pages/Users.tsx`, agregar la columna "Plan" después de la de membresía,
      con `hidden lg:table-cell`, distinguiendo los tres estados (invariante I9): nombre del plan,
      "Sin plan" atenuado para un miembro sin plan, y "-" para quien no tiene perfil de miembro.

## 9. Tests de frontend

- [x] 9.1 `frontend/src/pages/__tests__/MembershipPlans.test.tsx`: `muestra los planes con su precio vigente y filtra por activos`
- [x] 9.2 `frontend/src/pages/__tests__/MembershipPlans.test.tsx`: `abre el dialogo de nuevo precio y lo envia`
- [x] 9.3 `frontend/src/pages/__tests__/MembershipPlans.test.tsx`: `deshabilita desactivar cuando es el unico plan activo`
- [x] 9.4 `frontend/src/components/__tests__/CreateUserDialog.test.tsx`: `bloquea el alta de un Miembro cuando no hay planes activos`
- [x] 9.5 `frontend/src/components/__tests__/CreateUserDialog.test.tsx`: `envia el plan elegido al crear un Miembro`
- [x] 9.6 `frontend/src/pages/__tests__/UserDetail.test.tsx`: `muestra el plan vigente del miembro y permite cambiarlo`
- [x] 9.7 `frontend/src/pages/__tests__/UserDetail.test.tsx`: `muestra Sin plan y ofrece asignar plan a un miembro sin plan`
- [x] 9.8 `frontend/src/pages/__tests__/Users.test.tsx`: `muestra la columna de plan en el listado`
- [x] 9.9 `frontend/src/pages/__tests__/Users.test.tsx`: `muestra Sin plan para un miembro sin plan y guion para quien no es miembro`
- [x] 9.10 `frontend/src/pages/__tests__/Payments.test.tsx`: `ofrece un boton Planes que navega a la vista de planes`

## 10. Verificación final

- [x] 10.1 Manual: correr `make migrate` sobre una base de desarrollo con miembros ya cargados y
      confirmar en la UI que esos miembros aparecen como "Sin plan", que "Asignar plan" los deja
      igual que a uno creado con plan, y que ninguna fila de usuarios cambió fuera de eso.
- [x] 10.2 Manual: con `make seed-dev` y el usuario `dev.owner@miniespacio.local`, verificar que el
      miembro de desarrollo nace con plan, desactivar todos los planes salvo uno y comprobar el 409
      al desactivar el último, y luego en `/users` crear un Miembro verificando que el selector de
      plan es obligatorio.
- [x] 10.3 Correr `make lint` y `make test` y dejarlos en verde.

## 11. Corrección: bloqueo mutuo entre plan y reactivación de membresía (design D2.1)

Detectado durante la implementación: un miembro **dado de baja y sin plan** no puede salir de ese
estado (para activarse necesita plan, para tener plan necesitaba estar activo). Aplica el arreglo
(b) del design: `change_user_plan` deja de exigir membresía activa.

- [x] 11.1 En `backend/app/routers/users.py`, en `change_user_plan`: reemplazar el chequeo
      `membership_status != MembershipStatus.active` (400 "La membresía no está activa") por
      `membership_status == MembershipStatus.none` ⇒ 400 "El usuario no tiene perfil de miembro".
      Un miembro `cancelled` pasa a poder recibir plan. `activate_membership` **no se toca**.
- [x] 11.2 En `backend/app/routers/users.py`, actualizar el comentario de sección del endpoint de
      plan para que cite D2.1 y diga explícitamente que acepta miembros dados de baja.
- [x] 11.3 `backend/tests/test_user_plan.py`: `test_asignar_plan_a_miembro_dado_de_baja_devuelve_200`
- [x] 11.4 `backend/tests/test_user_plan.py`: `test_asignar_plan_no_cambia_el_estado_de_membresia`
      (invariante I11: el `membership_status` y el `membership_cancelled_at` quedan igual).
- [x] 11.5 `backend/tests/test_user_plan.py`: `test_asignar_plan_a_usuario_que_nunca_fue_miembro_devuelve_400`
- [x] 11.6 `backend/tests/test_user_plan.py`: `test_miembro_dado_de_baja_sin_plan_puede_recibir_plan_y_reactivarse`
      (invariante I10, cierra el ciclo: asignar plan y después `POST /membership/activate` ⇒ 200).
- [x] 11.7 En `frontend/src/pages/UserDetail.tsx`, verificar que "Asignar plan" se ofrece también
      cuando la membresía está dada de baja (hoy la condición puede estar atada a membresía
      activa); el diálogo y el endpoint son los mismos.
- [x] 11.8 En `frontend/src/components/ActivateMembershipDialog.tsx`, cuando el miembro no tiene
      plan, encadenar las dos llamadas: `POST /users/{id}/plan` y después
      `POST /users/{id}/membership/activate`, cortando y mostrando el error si la primera falla.
      Invalidar `queryKeys.users.all` una sola vez al final.
- [x] 11.9 `frontend/src/pages/__tests__/UserDetail.test.tsx`: `ofrece asignar plan a un miembro dado de baja sin plan`
- [x] 11.10 Manual: dar de baja a un miembro, quitarle el plan por SQL (o usar uno preexistente
      sin plan), y comprobar desde la UI que se le puede asignar plan y después reactivar la
      membresía, sin quedar trabado en ningún paso.

## 12. Correcciones del gate de verificación

Del veredicto FALLA de `/opsx:verify` (ver `verification.md`), en orden de prioridad: primero el
bloqueante (1), después los mayores (2 y 3), después los menores (4 a 10).

- [x] 12.1 **[bloqueante]** `frontend/src/pages/UserDetail.tsx`: la sección de plan (fila "Plan" y
      botón "Cambiar plan"/"Asignar plan") pasa de condicionarse a `isMemberRole` (`user.role ===
      "member"`) a un `isMemberProfile` propio (`user.membership_status !== "none"`) — mismo
      predicado que ya usan `Users.tsx` y `change_user_plan` en el backend. `isMemberRole` sigue
      igual para lo que sí es específico del rol (invitación al portal, `MemberTemplatesCard`).
      `frontend/src/pages/__tests__/UserDetail.test.tsx` suma los dos casos: un Coach con
      `membership_status: "active"` ve la sección de plan, y un rol Miembro con
      `membership_status: "none"` no la ve.
- [x] 12.2 **[mayor]** Helper de fecha compartido `formatDate` en `frontend/src/lib/utils.ts`: los
      campos `date`-only (`birth_date`, `plan_since`, `effective_from`) se parsean por
      componentes locales en vez de dejar que `new Date("YYYY-MM-DD")` los interprete como
      medianoche UTC. `UserDetail.tsx` (borra su copia local), `NewPlanPriceDialog.tsx` y
      `MembershipPlans.tsx` pasan a importarlo. `frontend/src/lib/__tests__/utils.test.ts` cubre
      el caso con un huso detrás de UTC (`America/Argentina/Buenos_Aires`) forzado vía `TZ`.
- [x] 12.3 **[mayor]** `backend/app/routers/membership_plans.py`: `_commit_or_conflict_on_name`
      envuelve el `commit` de `create_membership_plan` y `update_membership_plan`, capturando el
      `IntegrityError` del índice único (`uq...name_normalized`) y traduciéndolo al mismo 409 que
      ya usa `_check_name_collision`, en vez de dejarlo escalar a un 500 sin `detail`. La task 2.5
      queda desmarcada hasta este punto y se remarca acá, ya con la captura real.
      `backend/tests/test_membership_plans.py`:
      `test_nombre_duplicado_concurrente_devuelve_409_no_500` (monkeypatch de
      `_check_name_collision` a no-op para simular la carrera).
- [x] 12.4 **[menor]** `backend/tests/test_membership_plans.py`:
      `test_resto_de_endpoints_de_planes_sin_sesion_devuelve_401_y_con_rol_member_403` — suma
      401/403 para `POST /`, `PATCH`, `/prices`, `/deactivate` y `/activate` (antes solo cubiertos
      los dos `GET`).
- [x] 12.5 **[menor]** `backend/tests/test_membership_plans.py`:
      `test_nuevo_precio_inserta_fila_y_no_modifica_la_anterior` suma una aserción de
      `GET /membership-plans/{id}` confirmando que `current_price` sigue siendo el precio viejo
      antes de la fecha de vigencia del nuevo (el filtro `effective_from <= on`).
- [x] 12.6 **[menor]** `backend/app/models.py`: `MembershipPlan.prices` pasa de
      `cascade="all, delete-orphan"` a `cascade="save-update, merge"` — el historial de precios es
      append-only (invariante I1), y `delete-orphan` contradecía eso aunque hoy no haya ningún
      camino que lo dispare. Cambio de comportamiento ORM, no de esquema: sin migración Alembic.
- [x] 12.7 **[menor]** `docs/producto/03-membresias-y-pagos.md` y `docs/producto/09-backlog-mvp.md`:
      la descripción de M1 deja de decir "migración que crea 'General' ... y lo asigna a todos los
      miembros" y pasa a "migración de esquema (sin backfill)", acorde a D3.
- [x] 12.8 **[menor]** `frontend/src/components/ChangeMembershipPlanDialog.tsx` y
      `ActivateMembershipDialog.tsx`: reusan el mismo aviso "No hay planes activos" + botón "Ir a
      Planes" que ya tenía `CreateUserDialog.tsx`, en vez de dejar el selector vacío con el botón
      deshabilitado sin explicación.
- [x] 12.9 **[menor]** `frontend/src/pages/MembershipPlans.tsx`: la query de conteo de planes
      activos pasa de `limit: 1` a `limit: 200` (el fallback de `readTotalCount` sin header
      `X-Total-Count` quedaba pegado en 1 para siempre) y `isLastActive` deja de tratar
      `undefined` (query en vuelo) como 0, evitando deshabilitar "Desactivar" en todas las filas
      mientras carga. `frontend/src/pages/__tests__/MembershipPlans.test.tsx` suma
      `habilita desactivar con dos planes activos aunque falte X-Total-Count`.
- [x] 12.10 **[menor]** `backend/tests/helpers.py`: `assign_plan_to_member(db_session, member)`
      reemplaza la copia literal de `_assign_plan` en `test_membership.py` y
      `test_routine_assignments.py`.
- [x] 12.11 Correr `make check-plan CHANGE=add-membership-plans`, `make lint` y `make test` y
      dejarlos en verde.

## 13. Correcciones de la segunda pasada de verificación (design D2.2)

Bloqueante 1 de `verification.md` (segunda pasada): un usuario con `membership_status = "none"` no
puede activar su membresía por ningún camino — regresión sobre `openspec/specs/user-management/spec.md:317`.
Arreglo (a) del design: `activate_membership` acepta el plan en el body y activa en una sola
operación atómica. Las tasks 13.9 a 13.12 son los hallazgos menores 2 a 5 de esa misma pasada.

- [x] 13.1 En `backend/app/schemas.py`, agregar `MembershipActivateIn` con
      `membership_plan_id: Optional[str] = None` (mismo patrón que `MembershipCancelIn`, para que
      el `{}` que ya manda el frontend siga siendo válido).
- [x] 13.2 En `backend/app/routers/users.py`, `activate_membership` recibe
      `payload: schemas.MembershipActivateIn`. Si el usuario no tiene plan: `membership_plan_id`
      obligatorio (si falta, el `400` actual "Asigná un plan antes de activar la membresía"), plan
      inexistente ⇒ `404`, plan inactivo ⇒ `400`. Si ya tiene plan y viene uno distinto ⇒ `400`
      "Para cambiar el plan usá la acción Cambiar plan". Un solo `commit` para plan + estado.
- [x] 13.3 En el mismo endpoint, cuando asigna plan escribir las **tres** columnas juntas
      (`membership_plan_id`, `plan_since = date.today()`, `plan_changed_by_user_id`), igual que
      `change_user_plan` (invariante I12).
- [x] 13.4 `backend/tests/test_user_plan.py`: `test_activar_membresia_de_quien_nunca_fue_miembro_con_plan_devuelve_200`
      (arranca en `membership_status = "none"`; **falla con el bug presente**).
- [x] 13.5 `backend/tests/test_user_plan.py`: `test_activar_membresia_de_quien_nunca_fue_miembro_sin_plan_devuelve_400`
- [x] 13.6 `backend/tests/test_user_plan.py`: `test_activar_membresia_con_plan_distinto_del_asignado_devuelve_400`
- [x] 13.7 `backend/tests/test_user_plan.py`: `test_activar_membresia_con_plan_escribe_plan_since_y_autor`
- [x] 13.8 `backend/tests/test_user_plan.py`: `test_activar_membresia_con_plan_inexistente_no_activa_la_membresia`
      (atomicidad: tras el `404`, el `membership_status` sigue siendo el de antes).
- [x] 13.9 En `frontend/src/services/users.ts` y `users.queries.ts`, `activateMembership` acepta un
      `membershipPlanId` opcional y lo manda en el body.
- [x] 13.10 En `frontend/src/components/ActivateMembershipDialog.tsx`, reemplazar el encadenado de
      dos llamadas por una sola a `activateMembership` pasando el plan elegido; borrar el uso de
      `useChangeUserPlanMutation` de este diálogo. El selector se ofrece tanto para `none` como
      para `cancelled` sin plan.
- [x] 13.11 Crear `frontend/src/components/__tests__/ActivateMembershipDialog.test.tsx` con el caso
      `activa la membresia de quien nunca fue miembro mandando el plan en una sola llamada`,
      afirmando sobre la **URL y el body** del `api.post` (no solo que el botón existe) y que
      **no** se llama a `/users/{id}/plan`; **falla con el bug presente**.
- [x] 13.12 En ese mismo archivo, el caso `muestra el error del backend cuando la activacion falla`
      con `api.post` rechazando con un `detail`, para cerrar el verde en falso que señaló
      `verification.md` (mock de éxito para cualquier URL).
- [x] 13.13 Manual: dar de alta un Coach, abrir su ficha, "Activar membresía" eligiendo un plan, y
      confirmar que queda activo con ese plan y su fecha, sin error inline.

### Hallazgos menores 2 a 5 de la misma pasada

- [x] 13.14 (hallazgo 2) En `backend/app/routers/membership_plans.py`, `_commit_or_conflict_on_name`
      solo traduce a `409` el `IntegrityError` de la constraint de nombre (inspeccionando
      `e.orig` / el nombre de la constraint); cualquier otro se re-lanza. Que
      `update_membership_plan` no lo invoque cuando el payload no trae `name`.
      Test `backend/tests/test_membership_plans.py`:
      `test_patch_de_solo_descripcion_no_traduce_cualquier_integrityerror_a_409`.
- [x] 13.15 (hallazgo 3) Cerrar el TOCTOU de I3 en `deactivate`: hacer el chequeo de "último plan
      activo" y el `UPDATE` en una sola sentencia condicional (o con `SELECT ... FOR UPDATE` sobre
      los planes activos), de modo que dos desactivaciones concurrentes no puedan dejar el sistema
      en cero planes activos. Dejar el razonamiento en un comentario que cite I3.
- [x] 13.16 (hallazgo 4) En `backend/tests/helpers.py`, `assign_plan_to_member` escribe también
      `plan_since` (y `plan_changed_by_user_id` si el helper recibe autor), para no fabricar filas
      que ningún camino de la API produce (invariante I12).
- [x] 13.17 (hallazgo 5) En `frontend/src/components/MemberTemplatesCard.tsx`, borrar el
      `formatDate` local y usar el compartido de `lib/utils.ts`.
- [x] 13.18 Correr `make lint` y `make test` y dejarlos en verde.
