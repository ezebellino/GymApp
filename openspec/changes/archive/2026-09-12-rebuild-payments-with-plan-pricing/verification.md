# Verificación: rebuild-payments-with-plan-pricing

**Fecha**: 2026-09-12 (tercera pasada)
**Veredicto**: PASA CON RESERVAS
**Diff verificado**: working tree contra `main` (sin commitear), rama `feat/secure-staff-endpoints`
**Riesgo declarado**: alto
**Paso 0**: lint OK · test OK · plan OK

| Pasada | Veredicto | Hallazgos |
|---|---|---|
| 1 | FALLA | 1 bloqueante, 1 mayor, 5 menores — cerrados en el grupo 9 |
| 2 | FALLA | 1 bloqueante (el mismo defecto por otro camino), 1 mayor nuevo, 5 menores — cerrados en el grupo 10 |
| 3 | **PASA CON RESERVAS** | sin bloqueantes ni mayores; 3 reservas menores y 3 nits |

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=rebuild-payments-with-plan-pricing` | OK (exit 0, `riesgo=alto`) |
| Lint | `make lint` | OK (ruff limpio; eslint 0 errores / 47 warnings preexistentes; `tsc --noEmit` limpio) |
| Tests | `make test` | OK (backend 208 passed; frontend 31 archivos / 154 passed) |

## Escenarios de la spec

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| Todo alta de pago manda el monto que muestra la pantalla | UI: sin editar (16.000), editado (16.000 → 13.500), desde Pagos y desde la ficha; los tres coinciden con lo grabado | PASA |
| "Cobrar cuota" del Dashboard usa el precio del plan y no la cuota base | `default_fee` 30.000 vs plan 16.000 → la tarjeta y el pago quedaron en 16.000 | PASA |
| "Cobrar cuota" respeta los métodos habilitados | Con Transferencia deshabilitada solo aparece Efectivo; con los dos deshabilitados, aviso y botón deshabilitado | PASA |
| "Cobrar cuota" no se ofrece a un miembro sin plan | Aviso "Este cliente no tiene un plan asignado" y botón deshabilitado | PASA |
| La nota y el período no se borran al refetchear el usuario | Lectura de código (deps `[open, user?.id]`) + prueba manual de cambio de mes con nota cargada | PASA (el refetch real quedó NO VERIFICABLE, ver abajo) |
| Precarga del monto con el precio vigente del plan | UI | PASA |
| Foto del plan inmutable | Reasigné el plan del miembro y el pago de julio siguió mostrando "General" / 16.000 | PASA |
| Rechazos: sin plan, dado de baja, período duplicado | API: 400, 400 y 409 | PASA |
| Período futuro permitido | Alta de 12/2026 → 201 | PASA |
| Anulación solo Dueño, con recálculo de la mora | Coach → 403 y sin botón en la UI; Dueño → 204 y el indicador pasó a `overdue` | PASA |
| Pagos viejos sin foto de plan se listan | Fila con "Sin plan" / "-" | PASA |
| El Dashboard completo sigue funcionando | KPIs, pagos recientes, seguimiento de cobros y `/reports`, sin errores de consola | PASA |
| Miembro con plan pero sin precio vigente | Inalcanzable por la API (`POST /membership-plans/` exige `amount` y crea el primer precio con `effective_from = hoy`) | NO VERIFICABLE |

## QA manual

QA corrida por riesgo alto, con el contenedor `backend` reiniciado y la configuración restaurada al
terminar (`allow_cash`, `allow_transfer` y `default_fee` como estaban; el plan del miembro de prueba
devuelto a "General").

## Confirmación de los hallazgos de las pasadas anteriores

Los 7 hallazgos de la segunda pasada están cerrados. El bloqueante quedó cerrado **por
construcción**, no tapando el disparador: `amountEdited` no existe más en ningún archivo, y el
payload (`PaymentDialog.tsx:151`, `amount: Number(amount)`) sale del mismo estado que renderiza el
input (`:287`, `value={amount}`), leído en el mismo closure del click. El Code Reviewer buscó el
contraexemplo en los seis caminos conocidos —incluido el reprecio del plan con el diálogo abierto,
donde pantalla y payload quedan viejos **juntos**— y no lo encontró.

`canSubmit` (`:130-137`) se apoya en la sanitización de `<input type="number">`: espacios y texto no
numérico llegan como `""` y deshabilitan el submit; los negativos los corta `>= 0`. Ver nits 4 y 5.

El backend sigue aceptando la omisión de `amount` (`schemas.py:194`), con su test vivo
(`test_alta_sin_amount_usa_el_precio_de_referencia_del_plan`), y los dos cobros rápidos la siguen
ejercitando. Búsqueda de un cuarto cliente que mande `default_fee` como monto de un pago: no queda
ninguno — las referencias vivas son el editor del ajuste en `Settings.tsx`, el tipo y el store.

## Hallazgos

Ninguno bloqueante ni mayor.

1. **[menor]** `frontend/src/pages/Dashboard.tsx:523` — copy huérfano: el bloque sigue diciendo
   "Registrá la cuota mensual desde el dashboard **usando el valor actual de Ajustes**", cuando ahora
   usa el precio del plan. Con un plan a 45.000 y `default_fee` a 30.000, la tarjeta dice "Cuota
   vigente $45.000" y el subtítulo promete otra cosa. Los dos roles lo reportaron por separado.
2. **[menor]** `frontend/src/pages/Dashboard.tsx:130-132` y `:96-100` — `selectedPaymentClient` se
   deriva del resultado de búsqueda en vez de guardarse en estado, y la query no tiene
   `placeholderData`. Al elegir un cliente, la key cambia a los 300 ms del debounce y el bloque
   parpadea a "Seleccioná un cliente" hasta que vuelve el `GET /users`. Si ese request falla, el
   bloque queda **permanentemente** en ese estado con `paymentClientId` ya seteado, y la única
   salida es volver a buscar. Se cierra guardando el `User` elegido en el `onClick`. Los tests no lo
   ven porque el mock devuelve el mismo usuario para cualquier `q`.
3. **[menor]** `frontend/src/components/UserCard.tsx:86-110` y `:626-634` — el cobro rápido de
   `UserCard` quedó como el único de los tres que **no** chequea plan antes de ofrecer el botón: a un
   miembro sin plan le ofrece cobrar y el 400 del backend sale por toast. El mensaje es accionable y
   no se pierden datos, pero el criterio quedó asimétrico con `PaymentDialog.tsx:122-129` y
   `Dashboard.tsx:137-142`, que lo bloquean con aviso y "Asignar plan". Es la misma clase de omisión
   que el hallazgo 2 de la segunda pasada, un archivo más allá — vale la pena cerrarlo antes de que
   lo encuentre una cuarta pasada.
4. **[nit]** `frontend/src/components/PaymentDialog.tsx:135-136` — `canSubmit` acepta `0`: se puede
   registrar un pago de $0 que marca el período como cobrado y aparece con badge "editado". Pantalla
   y payload coinciden, así que no es el bloqueante; pero si la regla de producto es que un pago es
   mayor que cero, el piso debería ser `> 0`. Es una decisión de producto, no un bug.
5. **[nit]** `frontend/src/components/PaymentDialog.tsx:130-137` — `canSubmit` no usa
   `Number.isFinite`: el invariante "el input tiene un número válido" se apoya enteramente en el
   `type="number"`. Hoy es inalcanzable, pero si ese input pasara a `type="text"`, `"Infinity"`
   pasaría el chequeo, `JSON.stringify` lo serializaría como `null` y el backend caería en el
   fallback del precio del plan: pantalla y payload divergiendo otra vez, por la misma puerta. Una
   guarda ancla el invariante al código en vez de al tipo del input.
6. **[nit]** `frontend/AGENTS.md:456,461-462` — la documentación quedó una pasada atrás: sigue
   listando el test `omite el monto del payload si no se editó` (reemplazado en el grupo 10) y
   describiendo el estado `amountEdited`, que ya no existe. Tampoco registra los 3 tests nuevos de
   `Dashboard.test.tsx` ni el del CTA de `UserCard`.

## Sin verificar

- **El `refetchOnWindowFocus` real en el navegador**: el entorno de chrome-devtools no dispara
  blur/focus reales. Se cubrió por lectura de código y por prueba manual del efecto colateral
  (cambiar de mes con una nota cargada). Es una limitación del entorno de QA, no del change.
- **Miembro con plan pero sin precio vigente**: inalcanzable por la API.
- **Enforcement de métodos habilitados en el backend**: sigue siendo enforcement solo de UI (D5.2).
  Entre las tres pasadas aparecieron tres selectores distintos que había que arreglar a mano; si
  alguna vez se decide endurecerlo, el lugar es el backend.
- **Concurrencia** en el alta de pagos del mismo miembro y período.
