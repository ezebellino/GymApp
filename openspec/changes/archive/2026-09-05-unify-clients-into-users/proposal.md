## Why

Hoy la gestión de personas está partida en dos tablas desconectadas: `users` (cuenta de login +
rol) y `clients` (ficha de gimnasio: teléfono, alta, pagos, asistencia, rutinas), linkeadas 1:1 de
forma opcional. Esto obliga a mantener dos registros sincronizados para la misma persona (un
cliente con portal tiene un `User` Y un `Client`), no permite modelar que un Coach también entrene
en el gimnasio como miembro, y no tiene un flujo real de alta con invitación (hoy el admin le
escribe la contraseña a mano al cliente). Unificar en una sola tabla de Usuarios con rol, agregar
un indicador de estado de pago visible en el listado, y armar un flujo de invitación por link con
verificación de email y WhatsApp resuelve estos tres problemas de una sola vez y refleja mejor el
negocio: todo el que usa la plataforma es un Usuario con un rol; los que además entrenan en el
gimnasio (los "miembros") tienen encima rutinas, asistencia y pagos.

## What Changes

- Reemplazar las tablas `users` + `clients` por una única tabla `users`: TODA persona que
  interactúa con la plataforma (Dueño, Coach, Miembro) es una fila, con un rol. **BREAKING**:
  cambia el modelo de datos; requiere migrar los datos existentes de ambas tablas hacia el modelo
  unificado (no solo el esquema), preservando el historial de pagos, asistencia y rutinas.
- El **rol** (Dueño / Coach / Miembro) define qué puede hacer el usuario en el sistema. Ser
  "miembro del gimnasio" (con rutinas, asistencia y pagos) es un atributo funcional aparte del
  rol: un Dueño o un Coach puede además marcarse como miembro si también entrena en el gimnasio,
  sin perder su rol ni sus permisos administrativos.
- Nuevos atributos de perfil por usuario: nombre y apellido (separados), fecha de nacimiento (la
  edad se deriva de ahí, no se carga por separado), peso, altura, email (verificado) y celular
  (verificado).
- Nuevo estado de **membresía/suscripción** (activa / dada de baja) con una **fecha de baja** que
  el admin puede cargar manualmente al dar de baja (permite fechas retroactivas) y que, si no se
  especifica, el sistema completa con la fecha y hora actuales. Dar de baja a un usuario nunca
  borra el registro ni su historial. El bloqueo de acceso a la aplicación (login deshabilitado)
  por la baja SHALL aplicar solo cuando el rol del usuario es Miembro: para un Dueño o Coach que
  además esté marcado como miembro, dar de baja esa condición lo saca del seguimiento de
  pagos/asistencia/rutinas pero **no** le quita su acceso administrativo — la baja de membresía no
  es lo mismo que deshabilitar la cuenta de un Dueño/Coach (eso no forma parte de este change).
- El listado de "Clientes" pasa a ser el listado de **Usuarios**: nombre completo, rol, fecha de
  alta y fecha de comienzo en el gimnasio, con un indicador de 3 estados (círculo verde / naranja
  / rojo) antes del nombre para quienes tienen membresía: **verde** = membresía activa y al día
  con los pagos, **naranja** = membresía activa pero en mora (no pagó el mes en curso), **rojo** =
  membresía dada de baja (usuario deshabilitado, sin acceso a la aplicación). Quien nunca tuvo
  membresía (p. ej. un Dueño o Coach que no entrena en el gimnasio) no muestra indicador.
- ABM de usuarios: alta y edición completas; **no existe eliminación física** — la única "baja"
  posible es la de la membresía/suscripción, que además de bloquear el acceso registra su fecha.
- Nuevo flujo de invitación: el admin/coach dispara la invitación de un miembro recién creado; el
  sistema genera un link único, lo envía por email, y ofrece un link `wa.me` prellenado con ese
  mismo link para que el admin lo reenvíe manualmente por WhatsApp al celular cargado (mismo
  patrón que ya existe hoy para recordatorios de pago — **no** hay integración con ninguna API de
  WhatsApp Business ni envío automático de ese canal). El miembro define su contraseña y verifica
  ambos canales por separado antes de tener acceso de login al portal. Este flujo reemplaza al
  auto-registro libre existente en `/register-client`, cuyo link en `/login` también se retira
  (ver capabilities modificadas `login-view` y `register-client-view`).
- Rename de navegación: el link "Clientes" pasa a llamarse "Usuarios" en Sidebar, Topbar (menú
  mobile) y SpotlightSearch.

## Capabilities

### New Capabilities
- `user-management`: modelo unificado de Usuarios (rol + perfil + estado de membresía), listado
  con sus columnas, ABM (alta/edición, sin baja física) y rename de navegación a "Usuarios".
- `payment-status-indicator`: definición de los 3 estados de membresía/pago (al día, en mora,
  dado de baja) y su indicador visual (verde/naranja/rojo/ausente) en el listado de Usuarios.
- `member-invitation`: flujo de invitación por link disparado por admin/coach para que un miembro
  obtenga acceso al portal, con verificación independiente de email y celular (WhatsApp).

### Modified Capabilities
- `register-client-view`: el auto-registro libre de cliente (`/register-client`, endpoint
  `/auth/client-register`) se elimina — el alta de un miembro y su acceso al portal pasan a ser
  siempre iniciados por un admin/coach a través de `member-invitation`. Ver `REMOVED
  Requirements` en la spec de este change.
- `login-view`: se retira el link "Registrar cuenta" (apuntaba a `/register-client`, que este
  change elimina); no se reemplaza por otro link, porque ya no existe una ruta pública de
  registro genérica a la que enlazar.
- `automated-test-suite`: se retira la mención a `register-client-view` y su escenario de render,
  y el smoke de autenticación del backend deja de cubrir el alta vía `/auth/client-register` (usa
  una cuenta ya existente en su lugar).

## Impact

- Backend: `app/models.py` (colapsar `User` + `Client` en un único modelo/tabla `users`;
  `Payment`, `Attendance`, `WorkoutLog`, `TrainingDayExercise` pasan de referenciar `client_id` a
  `user_id`), migración Alembic de esquema **y de datos**, `routers/clients.py` (reemplazo o
  fusión con un router de usuarios), `schemas.py`, `routers/auth.py` (retira
  `/auth/client-register`, agrega el flujo de invitación).
- Frontend: `pages/Clients.tsx` (pasa a ser la vista de Usuarios), `types.ts` (tipo `Client` ->
  perfil unificado de usuario), `EditClientDialog.tsx`, `Sidebar.tsx`/`Topbar.tsx`/
  `SpotlightSearch.tsx` (label de navegación), `LoginView` (retira el link "Registrar cuenta"),
  retiro de la página `/register-client`, nueva UI del flujo de invitación (pantalla pública para
  completar el registro desde el link).
- Tests: `backend/tests/test_auth.py` (el smoke de auth deja de crear la cuenta vía
  `/auth/client-register`, usa una cuenta ya seedeada/creada como parte del setup del test) y el
  test de render de `register-client-view` en frontend se elimina — ver capability modificada
  `automated-test-suite`.
- Decisión de producto (ya resuelta, no queda como asunción abierta): el bloqueo de login por
  baja de membresía está **scopeado por rol**. Rol Miembro + membresía de baja = sin acceso. Rol
  Dueño/Coach marcado como miembro + esa condición de miembro dada de baja = conserva su acceso
  administrativo (solo pierde seguimiento de pagos/asistencia/rutinas). El indicador en rojo del
  listado sigue mostrándose en ambos casos (refleja el estado de membresía, no el de acceso).
- Decisión de producto — alta de Coach/Dueño queda fuera de alcance: `member-invitation` está
  scopeado únicamente a usuarios con rol Miembro. Un Coach o Dueño nuevo sigue dado de alta con su
  contraseña seteada a mano por el admin (el flujo existente, sin cambios). Si más adelante se
  quiere extender la invitación por link a altas de Coach/Dueño, es un change aparte.
- Decisión de producto — "envío por WhatsApp" no es una integración real: no hay API de WhatsApp
  Business ni envío automático de mensajes desde el sistema. Lo que existe es un link `wa.me`
  prellenado que el admin/coach dispara manualmente desde su propio WhatsApp, igual que el patrón
  ya usado hoy para los recordatorios de pago (`openPaymentReminder`). QA SHALL verificar que se
  genera y ofrece ese link, no que el sistema "envía" un WhatsApp de forma automática.
- Fuera de alcance de este change: la asignación de rutinas a miembros (ya es una feature
  separada, "próximamente" según el pedido de negocio) — este change solo deja el modelo de datos
  listo para que esa asignación use `user_id` en vez de `client_id`.
- Deuda de copy identificada pero fuera de alcance: hay menciones sueltas a "Clientes" en specs
  no tocadas por este change (`app-shell`, `dashboard-view`, `session-state`,
  `server-data-cache`) que listan las vistas del shell a modo de ejemplo, o el KPI "Clientes
  activos" del Dashboard. No se actualizan acá para mantener el corte chico; quedan como
  seguimiento de un change de copy/consistencia posterior.
