# Verificación: unify-clients-into-users

**Fecha**: 2026-09-05 (tercera y última pasada)
**Veredicto**: PASA
**Diff verificado**: working tree sin commitear sobre `feat/kinetic-obsidian-theme` (`git diff HEAD`,
~74 archivos) — **no** `main...HEAD`, que incluye commits previos no relacionados a este change.

Suites automatizadas en verde: `pytest` 60/60 (51 originales + 9 nuevos: hallazgos 1, 2, 9, N3,
N4×2, N5), `vitest` 33/33, `eslint` limpio, `npm run build` OK.

## Historia de esta verificación

1. **Primera pasada**: FALLA, 10 hallazgos (1 bloqueante, 2 mayores, 7 menores).
2. Se corrigieron los 10. **Segunda pasada** (code review + QA sobre esos fixes): los 10 quedaron
   confirmados resueltos, pero apareció una regresión nueva (**N1**, mayor, causada por el fix del
   hallazgo 5) y 5 hallazgos menores nuevos (N2, N4, N5, N8, N9). Veredicto: PASA CON RESERVAS — se
   corrigió N1 de inmediato (bloqueaba el veredicto) y se re-verificó en la app real; las 5
   reservas menores quedaron documentadas para que el usuario decida.
3. El usuario pidió corregir también las 5 reservas. Se corrigieron y se re-verificaron con una
   **tercera pasada** de code review + QA: las 5 quedaron confirmadas, y el code review encontró un
   punto concreto en el propio fix de N2 (password sin validar `min_length=6` client-side, riesgo
   de crashear el toast con el `detail` de un 422 de pydantic) y una extensión del riesgo de N5 (la
   transacción de DB quedaba abierta durante la llamada bloqueante a SMTP, algo que el orden viejo
   evitaba). Se corrigieron ambos y las suites siguen en verde. Sin hallazgos bloqueantes ni
   mayores pendientes: **PASA**.

## Escenarios de la spec

| Capability | Escenario | Cómo se verificó | Resultado |
|---|---|---|---|
| user-management | Coach que también entrena (rol único) | API: crear Coach+miembro activo, login conserva `role: coach` | PASA |
| user-management | Alta con datos mínimos (nombre, apellido, rol) | API `POST /users/` | PASA |
| user-management | Edad derivada de fecha de nacimiento (y ausente si no hay fecha) | API `PATCH birth_date` → `age` calculada / `null` | PASA |
| user-management | Baja con fecha manual retroactiva / sin fecha (`now()`) | API `POST membership/cancel` con y sin `cancelled_at` | PASA |
| user-management | Baja no borra historial | automatizado + manual (pago sigue existiendo) | PASA |
| user-management | Baja de rol Miembro bloquea login | API `POST /auth/token` → 400 | PASA |
| user-management | Baja de Coach-miembro NO bloquea acceso | UI end-to-end (botón real + confirm) | PASA |
| user-management | Reactivar restaura acceso de un Miembro | API: cancel→login 400, activate→login 200 | PASA |
| user-management | No existe eliminación física (UI ni API) | snapshot a11y del diálogo + `DELETE /users/{id}` → 405, `DELETE /coaches/{id}` → 404 | PASA |
| user-management | Fecha de comienzo vacía para no-miembro | UI: "-" para Coach/Dueño sin membresía | PASA |
| user-management | Coach crea Miembro (OK) / crea Dueño (403) / edita otro Coach (403) | automatizado + manual | PASA |
| user-management | Rename de navegación a "Usuarios" (Sidebar, Topbar desktop y mobile, SpotlightSearch) | snapshot + UI | PASA |
| user-management | Coach gestiona la membresía de un Dueño/otro Coach → 403 | API real + `pytest` × 2 | PASA |
| user-management | Coach sigue pudiendo dar de baja/reactivar a un Miembro normal | API real | PASA |
| user-management | Alta de Dueño/Coach: password y email son obligatorios, no opcionales (UI) | UI real: submit deshabilitado sin ambos o con password < 6 | PASA |
| payment-status-indicator | 4 estados del indicador (verde/naranja/rojo/ausente) con `title`/`aria-label` | UI, los 4 casos | PASA |
| payment-status-indicator | Rojo prevalece sobre pago al día (Coach-miembro dado de baja) | UI: rojo + login simultáneo | PASA |
| payment-status-indicator | Recalculo en tiempo real (pago nuevo, reactivación) | UI end-to-end | PASA |
| member-invitation | Invitar (rechazos: no-miembro, sin teléfono, sin email) | API, 3 casos 400 | PASA |
| member-invitation | Verificación independiente por canal | API `GET /invitations/{channel}/{token}` × 2 | PASA |
| member-invitation | Completar con ambos verificados → login automático | UI end-to-end | PASA |
| member-invitation | Completar con un solo canal → 409, la UI nombra el canal faltante | API + UI real | PASA |
| member-invitation | Link expirado / reenvío invalida el anterior / token inexistente | automatizado + manual | PASA |
| member-invitation | Reenvío no pierde el link vigente si falla el envío de email | `pytest` (mock de `NotificationSender` que revienta) | PASA |
| member-invitation | Baja durante o después de una invitación completada bloquea el login | API: password se guarda, no se entrega token | PASA |
| member-invitation | `PATCH /users/{id}` con `password` sin invitación (rol Miembro) → 400, incluso para el owner | API real + `pytest` | PASA |
| member-invitation | Promover un Miembro sin email a Coach/Dueño con `password` por PATCH → 400 | `pytest` | PASA |
| member-invitation | Entrega automática por WhatsApp | diseño: es manual por `wa.me`, ya aceptado como hueco resuelto por PO | NO VERIFICABLE (por diseño) |
| member-invitation | Entrega real por SMTP | sin credenciales de correo en el entorno de verificación | NO VERIFICABLE (entorno) |
| login-view | Sin link "Registrar cuenta" | snapshot | PASA |
| register-client-view | `/register-client` y `/auth/client-register` inaccesibles | navegación + API 404 | PASA |
| automated-test-suite | Suite ya no depende de `client-register`/`RegisterClient.test` | `make test` verde | PASA |
| (fuera de spec, regresión) | Sesión abierta de un Miembro: baja → siguiente request 401 inmediato | UI end-to-end (2 pestañas) | PASA |
| (fuera de spec, regresión) | Dashboard: Dueño/Coach sin membresía no cuenta como "cliente activo" ni en el hint "N registrados en total" | UI real, comparado contra conteo directo en DB | PASA |
| (fuera de spec, regresión) | Check-in por búsqueda de texto no confunde a un Dueño/Coach homónimo con el Miembro real | API real + `pytest` × 2 | PASA |
| (fuera de spec, regresión) | `EditUserDialog` no pierde el link de invitación recién generado ni una edición sin guardar durante un refetch en segundo plano | UI real, 2 escenarios | PASA |

## Hallazgos — todos resueltos (14 en total, a lo largo de 3 pasadas)

**Primera pasada** (1 bloqueante, 2 mayores, 7 menores):
1. `PATCH /users/{id}` aceptaba `password` sin restricción de rol/invitación.
2. `activate_membership`/`cancel_membership` no pasaban por `require_can_manage_user`.
3. El Dashboard filtraba "cliente activo" por `is_active` (cuenta habilitada) en vez de
   `membership_status`.
4. `UserCard.tsx` usaba el tipo borrado `ClientProgressSummary`.
5. `EditUserDialog` no refrescaba su snapshot local tras dar de baja/reactivar/invitar.
6. `InvitationAccept` no mostraba qué canal faltaba en el 409 de completar invitación.
7. `member_invitations.user_id` tenía `ondelete=CASCADE` en vez de `RESTRICT`.
8. La migración pisaba `role='member'` para pares linkeados, rompiendo "Coach que también
   entrena".
9. `POST /users` permitía password sin exigir email para roles no-miembro.
10. Topbar desktop no tenía el rename "Buscar cliente" → "Buscar usuario".

**Segunda pasada** (sobre los fixes de arriba):
- N1 [mayor] — el fix del hallazgo 5 rompía `EditUserDialog`: perdía ediciones sin guardar y el
  link de invitación recién generado en cada refetch en segundo plano.
- N2 [menor] — `CreateUserDialog` etiquetaba password/email como opcionales para Dueño/Coach
  cuando el backend los exige.
- N3 [menor] — el mismo bug del hallazgo 9 pero por `PATCH`: se podía promover un Miembro sin
  email a Coach/Dueño con password.
- N4 [menor] — el check-in por texto (`q`) podía resolver a un Dueño/Coach homónimo sin membresía
  en vez del Miembro real.
- N5 [menor] — el reenvío de invitación revocaba el link vigente antes de intentar el envío de
  email; un fallo de SMTP dejaba sin ningún link válido.
- N6 [menor] — el chequeo 5 del pre-vuelo quedó diciendo que un par owner/coach linkeado pierde el
  login, cuando el fix del hallazgo 8 hace que no la pierda.
- N7 [menor] — `design.md`/`tasks.md` seguían prescribiendo `role='member'` para el paso 5,
  contradiciendo el fix del hallazgo 8.
- N8 [menor] — el hint "N registrados en total" del KPI "Clientes activos" seguía contando todos
  los roles.
- N9 [menor] — el fallback de error sin `detail` en `InvitationAccept` decía "membresía dada de
  baja" para cualquier error, no solo ese caso.

**Tercera pasada** (sobre los fixes de N2-N9):
- El fix de N2 no validaba `password.trim().length >= 6` (el `min_length` del schema): una
  contraseña corta caía en un 422 de pydantic cuyo `detail` es una lista de objetos, pasada tal
  cual como `ReactNode` a `toastError`. Corregido: se agregó el chequeo de longitud a
  `missingRequiredAccess`.
- El fix de N5 (enviar antes de commitear) dejaba la transacción de lectura de
  `_get_user_or_404` abierta durante toda la llamada bloqueante a SMTP (el orden viejo la cerraba
  con el `commit()` previo). Corregido: `db.rollback()` justo antes del envío, sobre un estado sin
  nada para persistir todavía.
- Nits de paso: ternario muerto (`setRole(isOwner ? "member" : "member")`) y copy de
  `CreateUserDialog` desactualizado ("Solo nombre, apellido y rol son obligatorios").

Todos los tests nuevos: `test_roles.py` (hallazgos 1, 2, 9, N3), `test_attendance.py` (nuevo, N4),
`test_invitations.py::test_reenvio_no_revoca_la_viva_si_falla_el_envio_de_email` (N5).

## Deuda documentada — no bloquea, pre-existente o fuera del alcance de este change

- El check-in por `q` ahora responde `404 "Usuario no encontrado"` para un Miembro dado de baja
  homónimo de alguien sin membresía, en vez del `400 "sin membresía activa"` más específico de
  antes — trade-off aceptado del fix de N4 (evita el falso positivo del hallazgo, pero pierde
  precisión en este caso puntual).
- `frontend/src/services/search.ts` (usado por el buscador global del Dashboard) no filtra por
  `membership_status`: puede ofrecer un Dueño/Coach sin membresía en los resultados y, si se lo
  selecciona para check-in, sigue devolviendo 400. Preexistente, no introducido por N4 (que solo
  tocó la búsqueda por texto de `POST /attendance/checkin`, no `GET /users?q=`).
- `SmtpNotificationSender.send_invitation_email` no tiene `timeout` en el `smtplib.SMTP(...)` —
  deuda preexistente, no introducida por el reorder de N5 (que ya se corrigió por separado con el
  `db.rollback()`).
- El hint del KPI "Clientes activos" (N8) y `activeClients` comparten el límite de muestreo
  `CLIENTS_SAMPLE_LIMIT = 200` (deuda preexistente a este change): con más de 200 usuarios el
  número deja de crecer. Si se quiere exacto, `/users` ya soporta `membership_status` +
  `X-Total-Count` para pedirlo sin muestrear.

## Sin verificar

- Entrega real de email por SMTP: sin credenciales de correo en el entorno de QA. La generación y
  disponibilidad de los links sí quedó confirmada.
- Entrega automática por WhatsApp: por diseño no existe (decisión 12, hueco de spec ya aceptado por
  PO) — se verificó que el link `wa.me` se genera y ofrece, no que "se envía" solo.
- Tasks 1.2 y 13.3 (pre-vuelo y migración contra producción real): operativas, fuera del alcance de
  este entorno, correctamente sin marcar en `tasks.md`.
