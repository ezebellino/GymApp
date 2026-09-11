## Why

Los endpoints de configuración, pagos y asistencias tienen brechas de autorización: `GET/PUT/PATCH
/settings` no exigen ni sesión ni rol, y `GET /payments/`, `GET /payments/{id}` y `GET
/attendance/` responden sin token a cualquiera (el resto de esos routers ya usa `require_role`).
Es la brecha P1 del backlog del MVP (Fase 0, `docs/producto/09-backlog-mvp.md`), que agrupa M4 de
`03-membresias-y-pagos.md` §6, A-1 de `05-asistencias.md` y C-1 de `06-configuracion.md`. Es
seguridad pura, no depende de ningún otro ítem del backlog, y corresponde cerrarla antes de seguir
construyendo sobre estos módulos.

## What Changes

- `GET/PUT/PATCH /settings`: dejan de responder sin autenticar. La lectura exige sesión vigente de
  cualquier rol (Dueño, Coach o Miembro), acorde a "ver configuración pública" en la matriz de
  permisos (§2.5). La escritura (`PUT`/`PATCH`) exige además rol Dueño o Coach.
- `GET /payments/` y `GET /payments/{id}`: exigen sesión de rol Dueño o Coach (§2.2). Un Miembro
  autenticado recibe 403 al día de hoy en este change: la matriz prevé una vista propia de pagos,
  pero esa vista ("Mi cuota", ítem M6) todavía no existe — ver "Huecos de producto resueltos" más
  abajo.
- `GET /attendance/` (historial): exige sesión de rol Dueño o Coach (§2.4). Igual que con pagos,
  un Miembro autenticado recibe 403 hasta que exista su vista propia ("Mis asistencias", ítem
  A-3).
- Ningún otro endpoint de estos tres routers cambia: `create_payment`, `delete_payment`, los KPIs
  de pagos y el `checkin` de asistencia ya exigen sesión y rol y quedan igual.
- Las vistas públicas del frontend que no requieren sesión — `/login` y
  `/invitacion/:channel/:token` — siguen funcionando sin sesión: un visitante ve el formulario o el
  flujo de invitación normalmente, sin toast de "sesión expirada" ni redirección en bucle, aun
  cuando la app dispare en segundo plano una llamada a un endpoint que ahora exige sesión (hoy es
  el caso de `GET /settings`, que la app consulta fuera del árbol autenticado). Cómo se logra esto
  en el frontend — dejar de llamar ese endpoint desde ahí, o que el manejo de un 401 no dispare el
  flujo de "sesión expirada" cuando la vista actual es pública — es una decisión del rol
  Arquitecto; este proposal solo fija el comportamiento observable que no puede romperse.

## Capabilities

### New Capabilities
- `staff-endpoint-authorization`: qué sesión y qué rol exige cada uno de los endpoints de
  configuración, pagos y asistencias listados arriba, y qué le pasa a un Miembro autenticado que
  no tiene vista propia todavía. Se agrupan estos tres dominios en una sola capability porque el
  cambio de comportamiento es el mismo patrón (401 sin token, 403 con rol sin permiso) aplicado de
  manera uniforme a los tres; si más adelante alguno de estos dominios gana un endpoint con reglas
  propias (por ejemplo, la vista "Mi cuota" del Miembro), esa funcionalidad nueva se describe en
  una capability propia de ese dominio.

### Modified Capabilities
- `session-state`: agrega el requirement de que expirar sesión (401) en una vista pública (login,
  invitación) no dispare el flujo de "sesión expirada" ni redirija en loop — hoy ese flujo asume
  que un 401 siempre ocurre con una vista protegida de por medio.

## Impact

- Backend: `backend/app/routers/settings.py`, `backend/app/routers/payments.py`,
  `backend/app/routers/attendance.py` (agregar dependencias de auth/rol; sin cambios de esquema ni
  de modelo).
- Frontend: posible ajuste en `frontend/src/App.jsx` (`useSyncSettings`) y/o
  `frontend/src/lib/http.ts` (interceptor de 401) para no romper `/login` ni `/invitacion` — a
  definir por el rol Arquitecto.
- Tests: `backend/tests/test_payments.py`, `backend/tests/test_attendance.py` y un archivo nuevo
  de tests de `settings` deben cubrir 401 sin token, 403 con rol Miembro y 200 con Dueño/Coach.
- Sin cambios de modelo de datos ni migración.
