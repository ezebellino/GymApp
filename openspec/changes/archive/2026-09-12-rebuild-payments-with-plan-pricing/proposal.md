## Why

Desde que se introdujeron los planes de membresía con historial de precios (`membership-plans`),
el alta de pago sigue sin conocerlos: el backend de pagos no referencia plan ni precio, y la
pantalla de Pagos es un placeholder desde que se eliminó la implementación vieja (stats, filtros,
tabla, alta/baja) a pedido de producto. Sin esto, el Dueño no puede registrar cuotas con el monto
correcto del plan de cada miembro ni tiene dónde hacerlo — es la brecha M3 del backlog MVP,
bloqueante para M5, M6 y M7.

## What Changes

- **BREAKING**: el modelo de pago pasa a requerir una foto del plan y del precio de referencia
  vigentes al momento de registrar el pago (S3 de `03-membresias-y-pagos.md`). Cambia el contrato
  de alta de pago (payload y respuesta del endpoint existente).
- Al registrar un pago, el monto se precarga con el precio vigente del plan del miembro **a la
  fecha de registro** (no el del período que se paga — límite explícito de S3, ver §3.5 del doc
  de producto) y queda editable, para permitir descuentos puntuales o correcciones.
- Cada pago guarda el monto efectivamente pagado y una referencia inmutable al plan y precio con
  los que se sugirió: cambiar el precio de un plan después no reescribe pagos ya registrados.
- Reconstrucción de la sección Pagos (hoy placeholder): listado con filtros y búsqueda, indicador
  de período, monto y plan de cada pago, alta de pago desde la sección y desde la ficha del
  miembro, anulación de pago (solo Dueño). Se conserva el botón "Planes" ya existente en el
  header, que no cambia.
- El selector de método de pago en el alta solo ofrece los métodos habilitados en Configuración
  (regla ya vigente en `app-settings-state`, se refleja en la UI reconstruida, no se modifica ahí).

## Capabilities

### New Capabilities
- `payments-view`: la sección Pagos reconstruida — listado con filtros/búsqueda, alta de pago
  (desde Pagos y desde la ficha del miembro) con precarga de monto desde el plan, anulación por
  el Dueño, visibilidad del plan y precio de referencia por pago.

### Modified Capabilities
(ninguna: no hay capability de "registro de pago" ni de backend de pagos documentada hoy en
`openspec/specs/` — el estado actual vive solo en código, según §5 de
`03-membresias-y-pagos.md`. `payment-status-indicator` deriva el estado de cuota a partir de
pagos existentes y no cambia su contrato con este change.)

## Impact

- Backend: `backend/app/models.py` (agregar referencia a plan y precio en `Payment`, migración
  Alembic nueva), `backend/app/routers/payments.py` y sus schemas (payload de alta, respuesta de
  listado/detalle incluyendo plan), reglas de precarga de monto.
- Frontend: `frontend/src/pages/Payments.tsx` (reemplaza el placeholder), diálogo de alta de pago
  reusable desde Pagos y desde la ficha del miembro, componentes de listado/filtros.
- Fuera de alcance de este change (quedan para brechas posteriores del backlog MVP, no se tocan
  acá): M5 — deprecar `default_fee`, días de gracia y recordatorios de Configuración; M6 — "Mi
  cuota" en el portal del miembro; M7 — filtro por estado de cuota en Usuarios; DB-2 — bloque
  Cobros del Dashboard; DB-3 — absorber Reportes en Evolución.
