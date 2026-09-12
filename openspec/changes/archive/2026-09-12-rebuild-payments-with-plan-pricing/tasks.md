# Tasks — rebuild-payments-with-plan-pricing

Orden por dependencia: modelo y migración → API → tests de backend → servicios/tipos del
frontend → diálogo y puntos de entrada → vista → tests de frontend → cierre.
Referencias: `design.md` (D1..D6) y `specs/payments-view/spec.md`.

## 1. Modelo y migración

- [x] 1.1 En `backend/app/models.py`, agregar a `Payment` las tres columnas de D1 —
  `membership_plan_id` (`String`, FK `membership_plans.id` `ondelete="RESTRICT"`, nullable,
  `index=True`), `plan_name_at_payment` (`String`, nullable) y `plan_amount_at_payment`
  (`Integer`, nullable)— con un docstring que diga que son una **foto inmutable** del alta y que
  la nulabilidad existe solo para los pagos anteriores a la migración (D2/D4). No tocar
  `Payment.amount` (sigue siendo `Float` = monto pagado, invariante I1).
- [x] 1.2 Confirmar el head con `cd backend && python -m alembic heads` (se espera
  `6c1a341f03a2`) y generar la revision nueva en `backend/migrations/versions/` con ese
  `down_revision`.
- [x] 1.3 Escribir el `upgrade()` de la revision: `add_column` de las tres columnas (todas
  nullable), `create_foreign_key` a `membership_plans.id` con `ondelete="RESTRICT"` e índice sobre
  `membership_plan_id`. **Sin backfill** (D4); dejarlo dicho en el docstring de la revision junto
  con que el `downgrade()` es destructivo para las fotos ya registradas.
- [x] 1.4 Correr `make migrate` sobre la base local y verificar que `alembic heads` queda en la
  revision nueva y que `alembic downgrade -1` / `upgrade head` van y vuelven sin error.

## 2. Schemas y contrato de API

- [x] 2.1 En `backend/app/schemas.py`: `PaymentCreate.amount` pasa a `Optional[float] = None`
  (`ge=0`) separándolo de `PaymentBase` si hace falta para no aflojar `PaymentOut`; agregar
  `PaymentPlanRef {id: str | None, name: str, reference_amount: int | None}` y
  `PaymentOut.plan: Optional[PaymentPlanRef] = None` (D3.1, D3.2).
- [x] 2.2 En `backend/app/schemas.py`, agregar `PaymentsPeriodSummaryOut {period_year,
  period_month, payments_count, amount_sum, members_active, members_paid, members_pending}` (D3.4).
- [x] 2.3 En `backend/app/routers/payments.py`, `create_payment`: después del chequeo de membresía
  activa y antes del de período duplicado, rechazar con `400 "El miembro no tiene un plan
  asignado. Asignale un plan desde su ficha antes de registrar el pago"` si
  `target.membership_plan_id is None` (D2, requirement "Miembro sin plan no admite pagos").
- [x] 2.4 En `create_payment`, resolver la foto en el servidor con `current_price_for(db,
  [target.membership_plan_id])` (importado de `routers/membership_plans.py`) y escribir
  `membership_plan_id`, `plan_name_at_payment` y `plan_amount_at_payment`. Si el helper no
  devuelve precio vigente (caso defensivo, inalcanzable por la API), responder `400` apuntando al
  precio. Si `payload.amount` es `None`, usar el precio de referencia como monto pagado (D3.1).
- [x] 2.5 En `backend/app/routers/payments.py`, agregar un helper `_plan_ref(payment)` que arme
  `PaymentPlanRef` desde las columnas de la fila y usarlo en alta, detalle y listado. **Sin join
  ni query extra** (invariante I6, D3.2).
- [x] 2.6 En `list_payments`, agregar los filtros opcionales `period_month` (`1..12`),
  `period_year` (`2020..2100`) y `method` (`cash|transfer`), combinables con `user_id` y `q`, sin
  tocar el orden ni el header `X-Total-Count` (D3.3).
- [x] 2.7 Agregar `GET /payments/summary` (rol Dueño o Coach) según D3.4: tres queries agregadas
  —conteo y suma de pagos del período, miembros con membresía activa, miembros activos con pago de
  ese período— y `members_pending` derivado. No tocar los 4 endpoints de `/reports/*`.

## 3. Tests de backend (`backend/tests/test_payments.py`)

- [x] 3.1 Ajustar los dos casos existentes que arman el payload de alta o leen su respuesta:
  `test_crear_leer_y_borrar_un_pago` y `test_coach_lista_y_lee_un_pago` (ahora el miembro de la
  fixture necesita plan con precio, y la respuesta trae `plan`). Agregar en
  `backend/tests/helpers.py` un helper para crear plan + precio y asignárselo a un miembro, si no
  existe ya uno reusable en `test_membership_plans.py`.
- [x] 3.2 `test_alta_congela_plan_y_precio_vigente_del_miembro`
- [x] 3.3 `test_alta_sin_amount_usa_el_precio_de_referencia_del_plan`
- [x] 3.4 `test_alta_con_amount_editado_guarda_lo_pagado_y_la_referencia`
- [x] 3.5 `test_alta_ignora_plan_y_precio_enviados_en_el_payload`
- [x] 3.6 `test_alta_de_miembro_sin_plan_responde_400_y_no_crea_el_pago`
- [x] 3.7 `test_alta_de_miembro_dado_de_baja_responde_400`
- [x] 3.8 `test_alta_de_periodo_futuro_se_acepta`
- [x] 3.9 `test_segundo_pago_del_mismo_periodo_responde_409`
- [x] 3.10 `test_listado_tolera_pagos_previos_sin_foto_de_plan`
- [x] 3.11 `test_cambiar_el_precio_del_plan_no_reescribe_pagos_registrados`
- [x] 3.12 `test_renombrar_o_desactivar_el_plan_no_cambia_la_foto_del_pago`
- [x] 3.13 `test_listado_devuelve_la_foto_del_plan_de_cada_pago`
- [x] 3.14 `test_listado_filtra_por_periodo_y_por_metodo`
- [x] 3.15 `test_resumen_del_periodo_devuelve_cobrado_pagados_y_pendientes`
- [x] 3.16 `test_resumen_del_periodo_con_miembro_responde_403`
- [x] 3.17 `test_reportes_suman_el_monto_pagado_y_no_el_de_referencia`
- [x] 3.18 Correr `make test-backend` y dejar la suite en verde antes de pasar al frontend.

## 4. Servicios, tipos y mocks del frontend

- [x] 4.1 En `frontend/src/types.ts`: agregar `PaymentPlanRef {id, name, reference_amount}` y
  `Payment.plan: PaymentPlanRef | null`.
- [x] 4.2 En `frontend/src/services/payments.ts`: `PaymentsParams` gana `period_month`,
  `period_year` y `method`; `CreatePaymentInput.amount` pasa a `number | undefined`; agregar
  `fetchPaymentsSummary(period)` y `deletePayment(id)` (D5.5).
- [x] 4.3 En `frontend/src/services/queryKeys.ts`: agregar `payments.summary(period)` (único lugar
  del repo donde se escribe una key).
- [x] 4.4 En `frontend/src/services/payments.queries.ts`: agregar `usePaymentsSummaryQuery` y
  `useDeletePaymentMutation` (invalida `queryKeys.payments.all` **y** `queryKeys.users.all`,
  invariante I9).
- [x] 4.5 En `frontend/src/test/apiMock.ts`: soportar `GET /payments/summary`, `DELETE
  /payments/:id`, los filtros nuevos de `GET /payments` y devolver `plan` en los pagos mockeados.

## 5. Diálogo de pago reusable y puntos de entrada

- [x] 5.1 Crear `frontend/src/components/PaymentDialog.tsx` según D5.2: props `{ open,
  onOpenChange, user?, onSuccess? }`; sin `user`, buscador de miembro con `useUsersQuery({ q:
  debounced, limit: 20 })`; precarga de monto con `user.membership_plan.current_amount`, período
  mes/año actuales; métodos limitados a `allow_cash`/`allow_transfer` de `useSettingsStore`; envío
  por `useCreatePaymentMutation` omitiendo `amount` si el usuario no lo editó; sigue despachando
  `CustomEvent("payments:created")` para `hooks/useLegacyRefetchBridge.ts`.
- [x] 5.2 En `PaymentDialog`, el caso **miembro sin plan**: aviso inline "Este miembro no tiene un
  plan asignado" + link "Asignar plan" a `/users/:id` y submit deshabilitado (D2).
- [x] 5.3 En `frontend/src/pages/UserDetail.tsx`, agregar el botón "Registrar pago" en el
  `CardFooter` de la card "Membresía" (junto a "Cambiar plan"), visible con `canManage` y
  `membership_status === "active"`; abre `PaymentDialog` con el usuario cargado e invalida
  `queryKeys.payments.all` y `queryKeys.users.detail(id)` al confirmar (D5.4).
- [x] 5.4 En `frontend/src/components/UserCard.tsx`: reemplazar `NewPaymentDialog` por
  `PaymentDialog`, hacer que `handleQuickPayment` deje de mandar `amount` (el backend usa el
  precio del plan) y sacar el `useEffect` de `default_fee` que quede muerto. Verificar que
  `frontend/src/components/SpotlightSearch.tsx` sigue compilando y renderizando `UserCard`.
- [x] 5.5 Borrar `frontend/src/components/NewPaymentDialog.tsx` y actualizar los comentarios que lo
  nombran (`frontend/src/App.jsx`, `frontend/src/stores/settings.ts`,
  `frontend/src/hooks/useLegacyRefetchBridge.ts`). **`default_fee` no se deprecia acá** (es M5).
- [x] 5.6 En `frontend/src/components/LastPayments.tsx`: mostrar el nombre del plan de la foto
  junto al monto (`payment.plan?.name ?? "Sin plan"`). No se migra a React Query.

## 6. Vista Pagos

- [x] 6.1 Reescribir `frontend/src/pages/Payments.tsx` sobre `ListPageLayout` + `Pagination`
  siguiendo `MembershipPlans.tsx`: estado de `q` (con `useDebounce(q, 400)`), período (mes/año,
  default el actual), método, `limit`/`offset` con reset de `offset` al cambiar cualquier filtro.
- [x] 6.2 Header de la vista: `title="Pagos"`, `count`, y `primaryAction` con los dos botones —
  "Planes" (`variant="outline"`, `asChild` + `<Link to="/plans">`, **se conserva textual**) y
  "Registrar pago" (ícono + `aria-label` fijo + `<span className="hidden md:inline">`).
- [x] 6.3 Slot `toolbar`: tira compacta de indicadores del período desde `usePaymentsSummaryQuery`
  ("Cobrado de MM/AAAA", "Pagos registrados", "Miembros al día / activos") y debajo los controles
  de búsqueda, período y método (D5.1).
- [x] 6.4 Tabla: Miembro, Período, Plan (nombre de la foto o "Sin plan"), Precio de referencia,
  Monto pagado (con `currency` de `useSettingsStore` y badge "editado" cuando difiere de la
  referencia), Método + canal, Registrado el. Estados de carga/error/vacío como en
  `MembershipPlans.tsx`.
- [x] 6.5 Acción "Anular" por fila, visible solo para rol Dueño, con diálogo de confirmación y
  `useDeletePaymentMutation`.
- [x] 6.6 `footer` con `<Pagination total limit offset onChange />`.

## 7. Tests de frontend

- [x] 7.1 `frontend/src/pages/__tests__/Payments.test.tsx`: `muestra el plan y el monto de cada
  pago en la tabla`
- [x] 7.2 `frontend/src/pages/__tests__/Payments.test.tsx`: `muestra Sin plan en un pago sin plan
  de referencia`
- [x] 7.3 `frontend/src/pages/__tests__/Payments.test.tsx`: `muestra los indicadores del periodo
  seleccionado`
- [x] 7.4 `frontend/src/pages/__tests__/Payments.test.tsx`: `filtra por periodo y por metodo`
- [x] 7.5 `frontend/src/pages/__tests__/Payments.test.tsx`: `ofrece un boton Planes que navega a la
  vista de planes` (el caso ya existe: conservarlo funcionando contra la vista nueva)
- [x] 7.6 `frontend/src/pages/__tests__/Payments.test.tsx`: `oculta la accion de anular para un
  Coach`
- [x] 7.7 `frontend/src/pages/__tests__/Payments.test.tsx`: `anula un pago como Dueno tras
  confirmar`
- [x] 7.8 `frontend/src/components/__tests__/PaymentDialog.test.tsx`: `precarga el monto con el
  precio vigente del plan del miembro`
- [x] 7.9 `frontend/src/components/__tests__/PaymentDialog.test.tsx`: `precarga el precio vigente
  al registrar y no el del periodo cubierto`
- [x] 7.10 `frontend/src/components/__tests__/PaymentDialog.test.tsx`: `bloquea el alta y ofrece
  asignar plan si el miembro no tiene plan`
- [x] 7.11 `frontend/src/components/__tests__/PaymentDialog.test.tsx`: `solo ofrece los metodos
  habilitados en Configuracion`
- [x] 7.12 `frontend/src/components/__tests__/PaymentDialog.test.tsx`: `omite el monto en el
  payload si el usuario no lo edito`
- [x] 7.13 `frontend/src/pages/__tests__/UserDetail.test.tsx`: `abre el dialogo de pago desde la
  ficha de un miembro activo`
- [x] 7.14 `frontend/src/pages/__tests__/Dashboard.test.tsx`: `sigue mostrando la facturacion del
  mes con pagos que traen plan`

## 8. Cierre

- [x] 8.1 Verificación manual (filas `manual` del Plan de verificación): `make migrate` y revisar
  que los pagos previos aparecen "Sin plan"; con `make seed-dev`, registrar un pago desde la ficha
  de `dev.member@miniespacio.local`, cambiarle después el precio al plan y confirmar que el pago
  registrado conserva el precio viejo; desactivar "Efectivo" en Configuración y confirmar que el
  diálogo ya no lo ofrece.
- [x] 8.2 Correr `make check-plan CHANGE=rebuild-payments-with-plan-pricing` (ahora que los tests
  existen, tiene que salir en verde), `make lint` y `make test`, y dejar los tres en verde.

## 9. Correcciones del gate de verificación

Referencias: `verification.md` (veredicto FALLA), hallazgos 1 a 7.

- [x] 9.1 **[bloqueante, hallazgo 1]** `frontend/src/components/PaymentDialog.tsx`: unificar el
  reset de `amount`/`amountEdited` en un solo efecto (el que depende de `[open, selectedUser?.id]`)
  para que un cambio de identidad de la prop `user` (misma persona, objeto nuevo) no reviva
  `amountEdited=false` sin tocar `amount`. Test en
  `frontend/src/components/__tests__/PaymentDialog.test.tsx` que simule la prop `user` cambiando
  de identidad con el diálogo abierto y el monto ya editado, y afirme que el payload sigue
  llevando el `amount` editado. Confirmar que el test falla revirtiendo el fix antes de marcar la
  task.

  Re-verificado en esta sesión (el gate había reportado la task marcada sin el fix real): el
  efecto de `amount`/`amountEdited` ya vive unificado y depende de `[open, selectedUser?.id]`
  (no de `[open, user]`), que es justo lo que hace que un cambio de identidad de `user` con el
  mismo `id` no dispare el reset. Confirmado revirtiendo esa dependencia a `[open, user]`: el test
  del hallazgo 1 pasa a fallar exactamente como describía el gate (`34000` en vez de `30000`), y
  vuelve a pasar al restaurar `[open, selectedUser?.id]`. No hizo falta tocar
  `PaymentDialog.tsx` para este hallazgo.
- [x] 9.2 **[mayor, hallazgo 2]** `frontend/src/components/UserCard.tsx`: el cobro rápido lee
  `allow_cash`/`allow_transfer` de `useSettingsStore` (igual que `PaymentDialog.tsx:48-56`); si
  queda un solo método habilitado ofrece solo ese, y si no hay ninguno no ofrece el cobro rápido.
  Test nuevo que cubra el caso de un solo método habilitado (y opcionalmente el de ninguno).
- [x] 9.3 **[menor, hallazgo 3]** `backend/app/schemas.py`: `model_validator` en `PaymentCreate`
  que rechace `method_channel` cuando `method == "cash"`. Test en
  `backend/tests/test_payments.py`.
- [x] 9.4 **[menor, hallazgo 6]** `backend/tests/test_payments.py`: agregar
  `test_anular_pago_recalcula_el_indicador_de_cuota_a_mora` (invariante I9) y
  `test_cambiar_el_plan_del_miembro_no_cambia_la_foto_del_pago_ya_registrado`. Sumar ambos casos a
  la tabla del `## Plan de verificación` de `design.md`.
- [x] 9.5 **[menor, hallazgo 7]** Documentar en `backend/AGENTS.md` y `frontend/AGENTS.md` los
  tests nuevos de este change (los de 3.x/7.x más los de este grupo 9), y corregir en
  `frontend/AGENTS.md` la sección del puente `"payments:created"` que sigue nombrando a
  `NewPaymentDialog` (eliminado por este change) para que refiera a `PaymentDialog`.
- [x] 9.7 **[menor, hallazgo 4]** `frontend/src/components/PaymentDialog.tsx:95` y `:102-108`: un
  miembro con plan asignado pero sin precio vigente (`membership_plan.current_amount` nulo) deja
  el botón deshabilitado sin ningún aviso porque `hasNoPlan` solo mira `membership_plan`. Agregar
  `hasNoPrice` (plan presente, `current_amount == null`) y un aviso inline como el del caso "sin
  plan", con submit deshabilitado. Test en
  `frontend/src/components/__tests__/PaymentDialog.test.tsx`: `avisa si el miembro tiene plan pero
  sin precio vigente`.
- [x] 9.8 **[menor, hallazgo 5]** `frontend/src/components/PaymentDialog.tsx:62-65` vs `:147`:
  `useUsersQuery` corre aunque el miembro venga por prop y el resultado se descarte. Agregar
  `enabled: !user` (extender `useUsersQuery` en `frontend/src/services/users.queries.ts` con un
  segundo parámetro `{ enabled }` opcional, default `true`, sin tocar los demás callers). Test en
  `frontend/src/components/__tests__/PaymentDialog.test.tsx`: `no busca miembros si el miembro ya
  viene por prop`.
- [x] 9.9 Correr `make check-plan CHANGE=rebuild-payments-with-plan-pricing`, `make lint` y
  `make test`, y dejar los tres en verde.

## 10. Correcciones de la segunda pasada de verificación

Referencias: `verification.md` (veredicto FALLA, segunda pasada), hallazgos 1 a 7.

- [x] 10.1 **[bloqueante, hallazgo 1]** `frontend/src/components/PaymentDialog.tsx` (efecto de
  `[open, selectedUser?.id]` ~104-112 y `handleSubmit` ~144-151): el arreglo del grupo 9 ató el
  reset de `amount`/`amountEdited` a la *identidad del miembro*, no al *precio mostrado* — si
  cambia `membership_plan.current_amount` con el diálogo abierto, el input sigue mostrando el
  precio viejo y el payload lo omite. Arreglo ANCHO: `handleSubmit` manda SIEMPRE
  `amount: Number(amount)` (nunca `undefined`); se retira el estado `amountEdited` por completo,
  ya inútil. `canSubmit` sigue garantizando que el input tiene un valor numérico antes de permitir
  el submit, así que payload y pantalla no pueden divergir. Test en
  `frontend/src/components/__tests__/PaymentDialog.test.tsx`:
  `siempre manda el amount en el payload, editado o no` (reemplaza al test
  `omite el monto en el payload si el usuario no lo edito`, que afirmaba el comportamiento viejo).

  Confirmado revirtiendo el fix en esta sesión: se cambió `handleSubmit` para que omitiera
  `amount` cuando `Number(amount)` coincidía con el precio precargado del plan (simulación fiel
  del bug — "el usuario no tocó el campo"), se corrió el test nuevo con
  `npx vitest run src/components/__tests__/PaymentDialog.test.tsx -t "siempre manda"` y falló
  exactamente como predice el hallazgo (`expected undefined to be 34000`); se restauró
  `amount: Number(amount)` y el test (y la suite completa de `PaymentDialog.test.tsx`, 8/8)
  volvió a pasar.
- [x] 10.2 **[mayor, hallazgo 2]** `frontend/src/pages/Dashboard.tsx`: el bloque "Cobrar cuota"
  era un tercer cliente de alta de pagos sin migrar — mandaba `amount: defaultFee` y ofrecía
  Efectivo/Transferencia cableados fijos. Migrado igual que `PaymentDialog`/`UserCard`: agrega
  `allowedQuickPaymentMethods` (deriva de `allow_cash`/`allow_transfer` de `useSettingsStore`, con
  el mismo efecto de corrección que `UserCard`), deriva `selectedPaymentClient` del resultado de
  búsqueda y usa su `membership_plan.current_amount` para la tarjeta "Cuota vigente" (con avisos
  "sin plan"/"sin precio vigente" que deshabilitan el submit, igual criterio que
  `PaymentDialog`), y `doQuickPayment` ya no manda `amount` (el backend cobra el precio de
  referencia vigente, igual que el cobro rápido de `UserCard`). Se retiró la lectura de
  `default_fee` del componente (quedó sin uso). Tests nuevos en
  `frontend/src/pages/__tests__/Dashboard.test.tsx`: `usa el precio vigente del plan del miembro,
  no default_fee`, `solo ofrece los metodos habilitados en Configuracion`, `no ofrece el cobro
  rapido si el miembro no tiene plan`.
- [x] 10.3 **[menor, hallazgo 3]** `frontend/src/components/PaymentDialog.tsx`: el efecto que
  resetea `note`/`method_channel`/`memberQuery`/período dependía de `[open, user]` (identidad de
  objeto) — un refetch que cambiara cualquier campo del `user` reseteaba el período a hoy y
  vaciaba la nota aunque fuera "el mismo" miembro. Cambiado a `[open, user?.id]` (deliberadamente
  distinto del efecto del hallazgo 1, que sigue en `[open, selectedUser?.id]`). Cubierto por el
  test ya existente `conserva el monto editado si la prop user cambia de identidad` más la
  revisión manual de que `note`/`method_channel`/período tampoco se resetean en ese escenario.
- [x] 10.4 **[menor, hallazgo 4]** `frontend/src/components/PaymentDialog.tsx`: agregado un efecto
  de corrección análogo al de `UserCard.tsx:81-84` — si `method` deja de estar en
  `allowedMethods` (ej. `allow_cash` pasa a `false` con el diálogo abierto), se reasigna al primer
  método habilitado. Cubierto por el test ya existente `solo ofrece los metodos habilitados en
  Configuracion` (verifica el `<select>` en el momento del cambio de ajuste) — no se agregó un
  test nuevo dedicado a la transición en caliente porque el efecto es simétrico al que ya prueba
  `UserCard.test.tsx`.
- [x] 10.5 **[menor, hallazgo 5]** `backend/tests/test_payments.py`: agregado
  `test_alta_con_method_transfer_y_method_channel_responde_201` (caso válido del validador de
  `method_channel` del grupo 9, hasta ahora solo cubierto para el 422).
- [x] 10.6 **[menor, hallazgo 6]** `openspec/changes/rebuild-payments-with-plan-pricing/design.md`:
  sumados a la tabla del `## Plan de verificación` los tests de frontend que faltaban
  (`conserva el monto editado si la prop user cambia de identidad`, `avisa si el miembro tiene
  plan pero sin precio vigente`, `no busca miembros si el miembro ya viene por prop`, el archivo
  `UserCard.test.tsx` completo) más los tests nuevos de este grupo 10.
- [x] 10.7 **[nit, hallazgo 7]** `frontend/src/components/UserCard.tsx`: con un solo método
  habilitado el CTA ahora dice "Cobro rapido (Transferencia)" o "Cobro rapido (Efectivo)" en vez
  del genérico "Cobro rapido (precio del plan)". `frontend/AGENTS.md` corregido: ya no describe el
  cobro rápido de `UserCard` como "fuera de alcance" de este change (sí le tocó el payload y el
  selector de método; lo único que sigue sin migrar es `api.post` directo en vez de
  `useMutation`). Tests actualizados/agregados en
  `frontend/src/components/__tests__/UserCard.test.tsx`.
- [x] 10.8 Correr `make check-plan CHANGE=rebuild-payments-with-plan-pricing`, `make lint` y
  `make test`, y dejar los tres en verde.
