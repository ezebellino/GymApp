## Why

Hoy la cuota es una tarifa única global (`default_fee` en Configuración) y cambiarla no deja
rastro: no hay forma de tener planes distintos (General, Estudiante, Socio del club) ni de saber
qué precio regía cuando se cobró un pago viejo. Esto bloquea M1/M2/U-1 del backlog MVP y es
condición para que el pago pueda precargar el precio del plan (M3, fuera de este change). Sin
plan, tampoco se puede dar de alta un miembro de forma completa según la regla de negocio (S7):
toda membresía activa debe tener un plan.

## What Changes

- Nueva entidad **Plan de membresía**: nombre único, descripción opcional, activo/inactivo.
- Nueva entidad **Precio del plan**: historial de valores (monto, vigente desde, quién lo
  cambió). El precio nunca se edita ni se borra, solo se agrega un valor nuevo.
- CRUD de planes para staff (Dueño y Coach): crear, editar nombre/descripción, agregar nuevo
  precio, desactivar. No se puede borrar un plan que tiene o tuvo miembros o pagos. Debe existir
  siempre al menos un plan activo.
- Nueva entrada de navegación: botón **"Planes"** en la vista de Pagos, que lleva a la pantalla
  de Planes (listado con búsqueda y filtro activo/inactivo, acciones en diálogos, mismo patrón
  que Usuarios). La vista de Pagos hoy es un placeholder "en reconstrucción"; este change solo le
  agrega esa entrada de navegación, no la rehace.
- Plan **obligatorio** al dar de alta un Miembro: selector de planes activos. Si no hay ningún
  plan activo, el alta no se puede completar y el diálogo lleva a Planes.
- Cambio de plan desde la ficha del miembro: registra desde cuándo rige y quién lo hizo. Aplica
  a los próximos pagos, no reescribe los ya registrados (S5).
- Plan vigente visible en el listado de Usuarios y en la ficha del miembro.
- Migración **solo de esquema** (tablas de Plan y precio del plan + la referencia de plan
  vigente, nullable, en `User`). El proyecto está en beta, no productivo: no hay backfill de
  datos. Los miembros que ya existen quedan sin plan; el listado y la ficha los muestran como
  "Sin plan" y desde la ficha se les asigna uno a mano (ver requirement "Miembro preexistente sin
  plan asignado" en la delta spec de `user-management`).
- Endpoints nuevos (planes, cambio de plan del miembro) exigen sesión y rol Dueño o Coach, igual
  que el resto de endpoints de staff (`secure-staff-endpoints`).

**Fuera de alcance** (quedan para changes siguientes del backlog):
- M3: que el pago precargue el precio vigente del plan y guarde plan/precio de referencia.
- M5: deprecar `default_fee`, días de gracia y campos de recordatorio de Configuración.
- M6: "Mi cuota" en el portal del miembro (ver su plan, precio, historial).
- C-5: link a Planes desde Ajustes.
- Rehacer la vista de Pagos más allá del botón "Planes".

## Capabilities

### New Capabilities
- `membership-plans`: entidad Plan de membresía con historial de precios, CRUD para staff
  (Dueño/Coach), reglas de unicidad de nombre, activo/inactivo, no borrado con historial, al
  menos un plan activo.

### Modified Capabilities
- `user-management`: el alta de un Miembro exige elegir un plan activo (bloquea el alta si no
  hay ninguno); la ficha y el listado de usuarios muestran el plan vigente; la ficha permite
  cambiar el plan, registrando desde cuándo rige y quién lo hizo; un miembro creado antes de esta
  capability queda sin plan, se muestra como "Sin plan" en listado y ficha, y se le asigna uno a
  mano desde la ficha.
- `staff-endpoint-authorization`: agrega los requirements de autorización de los endpoints
  nuevos de planes (listado, detalle, crear, editar, nuevo precio, desactivar) y del endpoint de
  cambio de plan de un miembro, todos exigiendo sesión y rol Dueño o Coach.

## Impact

- Backend: modelo nuevo `Plan` y `PlanPrice` (o equivalente), migración Alembic **solo de
  esquema** que los crea y agrega la referencia de plan vigente (nullable) al `User` miembro, sin
  poblar datos; endpoints CRUD de planes y endpoint de cambio de plan del miembro; ajustes a los
  esquemas de alta y ficha de usuario para incluir el plan.
- Frontend: pantalla nueva de Planes (listado + diálogos crear/editar/nuevo precio/desactivar);
  botón "Planes" en `Payments.tsx`; selector de plan obligatorio en el diálogo de alta de
  Miembro; sección/acción de plan (incluyendo "Sin plan" + "Asignar plan") en la ficha de
  usuario; columna de plan en el listado de Usuarios.
- Datos: sin backfill. Los miembros existentes quedan sin plan hasta que se les asigne uno a
  mano; no afecta pagos ya registrados. Decisión tomada porque el proyecto está en beta, no
  productivo.
