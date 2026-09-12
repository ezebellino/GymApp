## Why

La vista de Ajustes tiene 14 campos editables pero solo 3 tienen un consumidor real
(`gym_name`, `currency`, `allow_cash`/`allow_transfer`); los otros 5 no los lee nadie y uno de
ellos (`default_fee`) miente activamente: un Dueño que lo edita cree que está cambiando el precio
de las cuotas, cuando ese precio lo cobran los planes de membresía desde que cerró M3. Es la
brecha C-2 del backlog, bloqueada hasta ese cierre y ahora desbloqueada. Además, la columna
derecha de la vista ("Vista previa del negocio" y "Resumen rápido") repite en texto lo que ya es
editable en el formulario de la izquierda — una limpieza que un change anterior dejó a medias al
retirar 3 `InfoCard` redundantes pero salvar estas dos cards a cambio de pegarles un botón de
acción real. Ese botón fue el precio de admisión, no una razón de fondo.

## What Changes

- **BREAKING**: se eliminan 5 campos de `AppSettings` — columna de base de datos, schema de API,
  tipo de frontend y UI — sin backfill: `default_fee`, `late_fee_grace_days`,
  `payment_reminder_message`, `payment_reminder_last_sent_at`, `theme_preference`.
- Se elimina por completo la columna derecha de Ajustes: las cards "Vista previa del negocio" y
  "Resumen rápido", el botón "Ver recordatorio en WhatsApp", el link "Completar WhatsApp" y la
  función `focusWhatsappField` que le daba soporte.
- La vista mantiene 4 secciones — Negocio (nombre, moneda) / Contacto (responsable, dirección,
  email, teléfono, WhatsApp, horario) / Cobro (toggles efectivo y transferencia, alias,
  aclaraciones de pago) / Operación (mensaje operativo) —, cada una en su propia `Card`, repartidas
  en una grilla de dos columnas desde `xl` (izquierda Negocio + Cobro, derecha Contacto; Operación
  a lo ancho completo debajo de ambas) y apiladas en una sola columna por debajo de ese breakpoint.
  Se retira el `max-w-3xl`: la vista usa el ancho completo. *(Revisado el 2026-09-12, ver
  `## Registro de revisiones`.)*
- Ningún campo lleva texto de ayuda: cada uno muestra únicamente su label, asociado al input con
  `htmlFor`/`id`. *(Revisado el 2026-09-12: la versión original de este proposal sumaba un helper
  corto por campo; se retiró a pedido del usuario.)*
- El botón "Guardar cambios" se reubica en una barra de acción al pie del formulario, fuera de la
  grilla de dos columnas, ya que la columna derecha donde vivía desaparece.
- Se actualiza `docs/producto/06-configuracion.md` (cierre de la brecha C-2) y
  `docs/producto/09-backlog-mvp.md` (se tacha C-2 y se completa su columna Change).

## Fuera de alcance

- Upload del logo del gimnasio: se evaluó y se posterga a un change propio, después de que
  aterrice `add-exercise-catalog` (que trae `backend/app/storage.py`, un puerto `ObjectStorage`
  reutilizable).
- Logo en el PDF de progreso: el generador de PDF actual (`routines.py`) arma el documento con
  operadores crudos sin soporte de imágenes; es trabajo de un change propio sobre el generador,
  no de este.
- Los campos que no se tocan porque tienen consumidor vivo o planificado: `gym_name`, `currency`,
  `allow_cash`/`allow_transfer`, la ficha de contacto del negocio (`admin_name`, `address`,
  `contact_email`, `contact_phone`, `whatsapp_phone`, `business_hours`), `payment_alias` y
  `payment_notes` (los ve el miembro en "Mi cuota"), y `onboarding_message`.

## Capabilities

### Modified Capabilities
- `settings-view`: se revierte el requirement "Cards de previsualización con acción real" (las
  cards de preview y de resumen se eliminan sin conservarse con botón; no vuelven bajo ninguna
  forma, la `Card` que ahora envuelve cada sección es un contenedor de campos editables, no una
  card informativa); se documenta el nuevo layout en grilla de dos columnas con cards por sección,
  sin texto de ayuda por campo, y la barra de acción al pie.
- `app-settings-state`: salen del estado de configuración los 5 campos deprecados
  (`default_fee`, `late_fee_grace_days`, `payment_reminder_message`,
  `payment_reminder_last_sent_at`, `theme_preference`).

## Impact

- Riesgo **alto**: toca el modelo de datos borrando 5 columnas de `AppSettings` vía migración
  Alembic solo de esquema, sin backfill, lo que pide más tests y una verificación más cuidada —
  aunque ninguna de las columnas que se van tiene lector en backend ni frontend hoy.
- Backend: modelo `AppSettings`, schemas de configuración, nueva migración Alembic.
- Frontend: `frontend/src/pages/Settings.tsx` (rediseño completo), tipos de configuración,
  cualquier componente que aún referencie los campos deprecados (preview de WhatsApp).
- Specs afectadas: `settings-view`, `app-settings-state`.
- Documentación de producto: `docs/producto/06-configuracion.md`,
  `docs/producto/09-backlog-mvp.md`.

## Registro de revisiones

- **2026-09-12** — El usuario revisó la vista ya implementada y pidió tres cambios de layout. El
  PO ajustó este proposal (y `role-architect` el `design.md` y `role-product-owner` la spec) para
  reflejar el diseño real: (1) cada sección vuelve a ser una `Card` en vez de un `<section>` con
  separador; (2) el layout es una grilla de dos columnas desde `xl` en vez de una sola columna
  `max-w-3xl`; (3) se retira el helper text por campo. La versión original de este documento (antes
  de esta fecha) describía una sola columna sin cards y con helpers por campo — eso ya no es lo que
  la vista implementa ni lo que verifican los tests. El resto del proposal (los 5 campos
  deprecados, el riesgo alto, el alcance y fuera de alcance) no cambió.
