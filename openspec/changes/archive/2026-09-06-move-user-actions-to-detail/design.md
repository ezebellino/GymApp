## Context

Hoy `frontend/src/components/EditUserDialog.tsx` (486 líneas) hace tres cosas: formulario de
perfil con guardado explícito, acciones de membresía (`useCancelMembershipMutation`,
`useActivateMembershipMutation`) e invitación al portal (`useInviteUserMutation` + panel de
resultado con copiar/WhatsApp). Ese diálogo se monta desde dos lugares —
`frontend/src/pages/Users.tsx:377` (acción Editar de cada fila; queda **montado** después de
cerrar, porque `selectedUser` no se limpia) y `frontend/src/pages/UserDetail.tsx:258` (botón
Editar del hero; ahí sí se desmonta al cerrar).

`frontend/src/pages/UserDetail.tsx` ya tiene las tres cards donde la propuesta quiere las
acciones (Perfil, Membresía, Invitación al portal), pero hoy son de solo lectura y la ficha no
sabe si quien mira puede gestionar a ese usuario: la regla vive únicamente en backend
(`backend/app/deps.py:18`, `require_can_manage_user`).

Del lado de backend ya existe todo el estado necesario pero no la operación:
`models.User.email_verified` / `phone_verified` (Boolean not null default False) y
`models.MemberInvitation.email_verified_at` / `phone_verified_at`. Hoy esos campos solo los
escriben el flujo público de invitación (`backend/app/routers/invitations.py`), el alta con
password y el `PATCH /users/{id}` que setea password (`routers/users.py:314`). No hay forma de
que un Dueño/Coach marque un canal como verificado a mano.

Restricciones que condicionan el diseño:

- `backend/app/auth.py:70` rechaza con 403 a cualquier usuario con `email_verified is False`.
  Escribir ese flag no es cosmético: cambia si un usuario **con password** puede autenticarse.
- `schemas.UserUpdate` deliberadamente **no** acepta `email_verified`/`phone_verified`, y este
  change encima achica el diálogo que lo consume.
- `frontend/src/components/ui/` **no** tiene `alert-dialog.tsx` (el comentario de
  `frontend/src/test/setup.ts:35` que lo menciona quedó viejo). El único primitivo modal es
  `ui/dialog.tsx`, sobre `<dialog>` nativo, sin Radix.
- Tema visual: `docs/design/design.md` ("Kinetic Obsidian") y `frontend/AGENTS.md`.

## Goals / Non-Goals

**Goals:**

- Dejar `EditUserDialog` como formulario de perfil puro: una sola mutación (`updateUser`), un solo
  botón de guardado.
- Mover baja / activación / reactivación de membresía y disparo de invitación a `UserDetail`,
  cada una detrás de un modal, sin cambiar su semántica de negocio ni sus endpoints.
- Agregar la verificación manual de contacto como **una sola** acción que cubre email y teléfono:
  endpoint nuevo en backend, con la misma regla de permisos que el resto del ABM, y su efecto
  sobre la invitación vigente.
- Que la ficha muestre el estado de verificación de **cada** dato por separado y ofrezca la acción
  única solo cuando corresponde (al menos un dato cargado y sin verificar, viewer con permiso de
  gestión).

**Non-Goals:**

- No se toca `require_can_manage_user` ni ninguna regla de permisos existente: el endpoint nuevo
  la **usa**, no la modifica.
- No se toca el flujo público de invitación (`routers/invitations.py`): sigue siendo el único que
  define contraseña y emite token.
- No se agrega verificación por código/OTP ni reenvío de email de verificación: "verificar a mano"
  es una afirmación del admin, no una prueba de posesión del canal.
- No se toca `is_active` (bloqueo de cuenta) ni el borrado de usuarios.
- No se cambia el listado `Users.tsx` más allá de que su "Editar" abre el mismo diálogo, ya
  acotado a perfil.
- No se rediseñan las cards de la ficha: se les agregan acciones dentro del layout actual.

## Decisions

### D1. Endpoint nuevo: `POST /users/{user_id}/contact/verify` (una sola acción, ambos canales)

> Revisión post-verify: la spec pasó de dos acciones por canal a **una sola** "Verificar
> contacto". Esta decisión reemplaza la versión anterior (`POST
> /users/{user_id}/contact/{channel}/verify`), que ya está implementada en el working tree y hay
> que deshacer. La ruta vieja nunca llegó a `main` (ver "Migration Plan"), así que no hay
> compatibilidad que preservar.

- **Método/ruta**: `POST /users/{user_id}/contact/verify`, **sin** `channel`. Handler
  `verify_contact` en `backend/app/routers/users.py`, junto a los de membresía.
- **Entrada**: sin body. La operación no tiene parámetros: *qué* se verifica lo decide el servidor
  a partir del estado del usuario, no el cliente (ver alternativa 2).
- **Salida**: `schemas.UserOut` vía `_serialize_user_single(db, obj)` — mismo contrato que
  `activate_membership` / `cancel_membership`, así el frontend recibe el usuario completo y
  recalculado (incluido `invitation_status`) sin un GET extra.
- **Permisos**: el router ya exige `require_role(owner, coach)`; el handler llama
  `require_can_manage_user(current_user, obj.role)` como los otros endpoints de gestión. Sin
  cambios respecto de la versión por canal.
- **Cálculo de los canales pendientes** (lo primero que hace el handler, después de los chequeos
  de existencia y permisos):

  ```
  pending = []
  if obj.email and not obj.email_verified:  pending.append("email")
  if obj.phone and not obj.phone_verified:  pending.append("phone")
  ```

  Un dato **no cargado** simplemente no entra en la lista: se omite sin error (spec, "Confirmar la
  acción omite el dato no cargado"). Un dato **ya verificado** tampoco entra: queda intacto (spec,
  "Confirmar la acción no toca un dato ya verificado"). Con eso, las dos precondiciones que antes
  eran errores por canal (400 "sin dato cargado" y 409 "ya verificado") dejan de ser errores y
  pasan a ser filtros — el **400 desaparece del endpoint**.
- **Efecto** (solo si `pending` no está vacía): para cada canal en `pending`, setea
  `obj.<canal>_verified = True`; y si existe una invitación **vigente** del usuario
  (`_pending_invitation_for`, D2), setea también `invitation.<canal>_verified_at = utcnow()` si
  estaba en `None` (no pisa un timestamp previo). Los canales que **no** están en `pending` no se
  tocan en ninguno de los dos objetos: si el teléfono ya estaba verificado en el usuario, su
  `phone_verified_at` de la invitación queda como esté. Nada más: no toca `password_hash`,
  `completed_at`, `revoked_at`, `is_active` ni la membresía, y no emite token.
- **Códigos de error**:
  | Situación | Código | Detail |
  |---|---|---|
  | Usuario inexistente | 404 | `_get_user_or_404` ("Usuario no encontrado") |
  | Viewer sin permiso de gestión sobre ese rol | 403 | `require_can_manage_user` ("Insufficient permissions") |
  | `pending` vacía (nada cargado, o todo lo cargado ya verificado) | 409 | "No hay datos de contacto para verificar" |

  El 409 lo pide la spec explícitamente ("el sistema SHALL rechazar la operación con un error de
  conflicto, sin modificar nada") y es consistente con los endpoints hermanos
  (`activate_membership` responde 409 "La membresía ya está activa"). Un solo mensaje para los dos
  casos que lo disparan: desde el punto de vista del que llama son el mismo — no hay nada que
  hacer. El costo (un doble click devuelve error) se mitiga igual que antes: botón deshabilitado
  mientras la mutación está pendiente y modal que cierra al éxito.
- **La respuesta no informa qué canales se verificaron.** `UserOut` ya trae `email_verified` y
  `phone_verified`; agregar un `verified_channels: list[...]` obligaría a extender el schema (o a
  devolver un envelope distinto al de los endpoints hermanos) para un dato que el cliente puede
  derivar comparando con el estado que ya tenía en pantalla — y que, de hecho, el modal ya conoce
  antes de confirmar, porque de ahí sale su copy (D8). Se descarta.

**Alternativas consideradas**

1. **Conservar el endpoint por canal y que el frontend lo llame una o dos veces.** Rechazada: la
   spec describe "una sola operación"; dos requests abren ventana de inconsistencia (el segundo
   falla y el usuario queda medio verificado), obligan al cliente a decidir qué está pendiente
   —convirtiéndolo en autoridad de una regla del dominio— y complican el 409 ("¿conflicto de cuál
   de los dos?").
2. **`POST /users/{id}/contact/verify` con `{"channels": ["email"]}` en el body.** Rechazada: deja
   que el cliente elija qué verificar, cuando la spec define la acción como "todos los datos
   cargados que aún no lo estén". Con body, un cliente podría pedir verificar un canal sin dato
   cargado y habría que reintroducir el 400; sin body, ese caso es imposible por construcción.
3. **Extender `PATCH /users/{id}` con `email_verified`/`phone_verified`.** Rechazada: mete un flag
   privilegiado (que gobierna el login, ver `auth.py:70`) en el mismo payload que el formulario de
   perfil, justo en el change que está achicando ese formulario; y no puede expresar el efecto
   colateral sobre la invitación vigente sin volverse mágico.
4. **Idempotencia (200 con `pending` vacía) en vez de 409.** Rechazada: la spec pide conflicto
   explícito. Además la UI ya no ofrece la acción en ese estado, así que una llamada así es un
   cliente desactualizado y callarlo esconde el bug.
5. **Marcar la invitación en un endpoint aparte.** Rechazada: dejaría al frontend orquestando dos
   requests para una operación que la spec describe como una sola, con ventana de inconsistencia
   si la segunda falla.

### D2. Qué cuenta como "invitación pendiente"

`_live_invitation_for` (`routers/users.py:54`) filtra `revoked_at IS NULL` y
`completed_at IS NULL`, pero **no** filtra vencidas: `_invitation_status_for` distingue
`pending` de `expired` recién después, comparando `expires_at`. La spec habla de invitación
"pendiente de completar", y marcar un canal en una invitación cuyos links ya murieron no sirve
para nada (el miembro no puede abrir ninguno de los dos).

Decisión: helper local nuevo `_pending_invitation_for(db, user_id)` = `_live_invitation_for(...)`
**más** `expires_at > utcnow()`. Se agrega como wrapper delgado en vez de cambiarle la semántica a
`_live_invitation_for`, que hoy usan la serialización (`_serialize_user_single`, `list_users`) y
el reenvío (`create_or_resend_invitation`) y que necesitan seguir viendo las vencidas.

**Alternativa**: agregar un parámetro `include_expired=True` a `_live_invitation_for`. Rechazada:
tres call sites tendrían que pasar el flag para conservar su comportamiento actual — más diff y
más riesgo que un wrapper de tres líneas.

La revisión a una sola acción (D1) **no cambia esta decisión**: `_pending_invitation_for` se
mantiene tal como está implementado. La diferencia es que ahora se llama **una vez por request** y
su resultado se reusa para los uno o dos canales pendientes, en vez de una vez por canal.

### D3. Sin migración Alembic

`User.email_verified`, `User.phone_verified`, `MemberInvitation.email_verified_at` y
`MemberInvitation.phone_verified_at` ya existen en `backend/app/models.py` (columnas creadas por
migraciones previas; `_serialize_user` ya expone las dos primeras en `UserOut`). El change **no**
agrega, borra ni cambia ninguna columna, índice o constraint ⇒ no corresponde migración. Si al
implementar apareciera cualquier edición de `models.py`, la regla del proyecto vuelve a aplicar y
hay que agregar la migración antes de mergear.

### D4. Cliente HTTP y cache

- `frontend/src/services/users.ts`: `verifyUserContact(id: string): Promise<User>` →
  `api.post<User>(\`/users/${id}/contact/verify\`, {})`. Mismo shape que `activateMembership`.
  El tipo `ContactChannel` **se elimina**: nació solo para este endpoint y con la acción única
  ningún consumidor lo necesita (el `Literal` del canal sigue existiendo en backend para
  `/invitations/{channel}/{token}`, que este change no toca).
- `frontend/src/services/users.queries.ts`: `useVerifyContactMutation()` con
  `mutationFn: (id: string) => verifyUserContact(id)` y
  `onSuccess: invalidateQueries({ queryKey: queryKeys.users.all })`. Firma de un solo `string`,
  como `useActivateMembershipMutation`.
- **La invalidación vive en el hook de mutación, no en el componente.** `queryKeys.users.all` es
  `["users"]`, prefijo de `users.detail(id)` y de `users.list(params)`: una sola invalidación
  refresca ficha y listado, que es lo que piden los escenarios "la ficha refleja el nuevo estado
  sin recargar la página". Los modales nuevos por lo tanto **no** reciben prop `onSuccess`.
- `useInviteUserMutation` hoy no invalida nada (dependía del `onSuccess?.()` que le pasaba el
  llamador). Se le agrega la invalidación de `queryKeys.users.all`: invitar mueve
  `invitation_status` de `none`/`expired` a `pending` y la card tiene que reflejarlo.
- Membresía y verificación **no** invalidan `payments`/`attendance`: esas filas embeben
  `UserSummary` (nombre), que ninguna de estas acciones cambia. Solo la edición de perfil lo hace,
  y `useUpdateUserMutation` ya las invalida (`users.queries.ts:54-56`).
- `EditUserDialog` conserva su prop `onSuccess` tal cual: `Users.tsx` y `UserDetail.tsx` la usan y
  tocarla es churn fuera de alcance.

### D5. Descomposición de componentes del frontend

Las cuatro acciones no son homogéneas: tres son confirmaciones puras (activar/reactivar
membresía, verificar email, verificar teléfono), una es confirmación + campo opcional + copy que
depende del rol (baja de membresía) y otra es un flujo de dos fases con resultado, copiado y
WhatsApp (invitar). Un único componente parametrizado por `mode` terminaría en un árbol de
condicionales; cinco componentes sin base común repetirían cinco veces el mismo esqueleto de
`Dialog` + footer + botón deshabilitado mientras `isPending`.

Decisión: **una base presentacional + un wrapper por acción**, todos en
`frontend/src/components/` (plano, junto a `EditUserDialog.tsx`, `CreateUserDialog.tsx`,
`UserCard.tsx`; meter solo los nuevos en un subdirectorio `users/` partiría la familia en dos
lugares, y mover los viejos es churn fuera de alcance).

| Archivo | Rol |
|---|---|
| `frontend/src/components/ConfirmActionDialog.tsx` | Base tonta sobre `ui/dialog.tsx`: props `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `pendingLabel`, `destructive?`, `isPending`, `error?`, `children?` (slot para campos extra) y `onConfirm`. No conoce mutaciones ni `User`. |
| `frontend/src/components/CancelMembershipDialog.tsx` | Usa la base. Dueña del estado del `datetime-local` de fecha de baja, del copy que hoy vive en `handleCancelMembership` (Miembro pierde acceso vs. Dueño/Coach lo conserva), de `useCancelMembershipMutation` y del toast. |
| `frontend/src/components/ActivateMembershipDialog.tsx` | Usa la base. `useActivateMembershipMutation`; label "Activar membresía" si `membership_status === "none"`, "Reactivar membresía" si `"cancelled"`. |
| `frontend/src/components/VerifyContactDialog.tsx` | Usa la base. `{ open, onOpenChange, user }` (**sin** prop `channel`); `useVerifyContactMutation`; copy dinámico según lo pendiente (D8). |
| `frontend/src/components/InviteUserDialog.tsx` | **No** usa la base (dos fases, no una confirmación). `Dialog` propio con el bloque de resultado, `useInviteUserMutation`, `copyLink` y `openWhatsApp` migrados tal cual desde `EditUserDialog`. |

Todos toman `{ open, onOpenChange, user }` y nada más. No se agrega ninguna dependencia: se
descarta traer `@radix-ui/react-alert-dialog` (shadcn `alert-dialog`) solo por el `role="alertdialog"`
— `ui/dialog.tsx` ya da modal + cierre por Escape sobre `<dialog>` nativo, y sumar un paquete que
hay que mantener y polyfillear en jsdom no se paga con esa diferencia semántica.

`UserDetail` mantiene **un solo** estado de acción abierta en vez de cinco booleanos:

```
const [action, setAction] = useState<
  null | "edit" | "cancel-membership" | "activate-membership" | "invite" | "verify-contact"
>(null);
```

y monta cada modal condicionalmente (`{action === "invite" ? <InviteUserDialog ... /> : null}`),
extendiendo el patrón que ya usa hoy con `editOpen`. Montar-al-abrir hace que cada modal arranque
con estado limpio sin necesidad de un `useEffect` de reset.

### D6. Qué queda de `EditUserDialog` (y qué se le saca)

**Se elimina**: `handleCancelMembership`, `handleActivateMembership`, `handleInvite`, `copyLink`,
`openWhatsApp`, el estado `cancelDate` e `inviteResult`, los bloques JSX de "Membresía" e
"Invitación al portal", las constantes `MEMBERSHIP_STATUS_LABEL` / `INVITATION_STATUS_LABEL` y
`formatDate` (quedan sin uso; sus equivalentes ya viven en `UserDetail.tsx`), los imports de
`useCancelMembershipMutation` / `useActivateMembershipMutation` / `useInviteUserMutation`, los
iconos `Copy` / `MessageCircle` y la variable `isMemberRole`. Se actualiza el copy del header
("Actualiza el perfil, la membresía y el acceso al portal…" pasa a hablar solo del perfil).

**Se conserva**: el `useEffect` con deps `[open, user.id]`, pero con el comentario reescrito. El
motivo original citaba `inviteResult` y las mutaciones propias del diálogo, que dejan de existir;
el motivo que **sobrevive** es más chico pero real: `user` es un prop derivado de una query, y
cualquier invalidación de `["users"]` disparada desde otro lado (el modal de baja abierto sobre la
misma ficha, el refetch del listado al tipear en el buscador de `Users.tsx`) le cambia la
identidad al objeto mientras el diálogo está abierto. Además `Users.tsx` deja el diálogo
**montado** después de cerrarlo (`selectedUser` no se limpia), así que sin este efecto reabrirlo
para otra fila mostraría los valores de la anterior. Deps y `eslint-disable` quedan igual; el
comentario se reduce a esas dos razones.

**Alternativa considerada**: borrar el efecto y pasar `key={user.id}` + montaje condicional en los
dos call sites. Rechazada: obliga a tocar `Users.tsx` (que hoy no se toca) y cambia su ciclo de
vida de montaje por un beneficio de legibilidad, en un change que ya mueve mucha UI.

### D7. Cómo decide la ficha qué acciones mostrar

`UserDetail` lee el rol del viewer con `useSessionStore((s) => s.role)` (`/users/:id` ya está
detrás de `<ProtectedRoute roles={["owner", "coach"]}>`, `frontend/src/App.jsx:127`) y calcula:

```
canManage = viewerRole === "owner" || (viewerRole === "coach" && user.role === "member")
```

Esa expresión se extrae a `frontend/src/lib/permissions.ts` como
`canManageUser(viewerRole: Role | null, targetRole: Role): boolean` — función pura, espejo exacto
de `require_can_manage_user` (`backend/app/deps.py:18`), para no repetir el booleano en cinco
puntos de render y para poder testearla. Es la única regla de permisos que el frontend duplica; el
backend sigue siendo la autoridad (defensa en profundidad: el 403 existe igual).

**Ocultar, no deshabilitar.** Si `!canManage`, las acciones de membresía, invitación y
verificación no se renderizan; la ficha queda de solo lectura, como hoy. Un botón deshabilitado
sin explicación para un Coach que mira la ficha de otro Coach es ruido permanente (nunca va a
poder habilitarlo), mientras que el deshabilitado se reserva para estados transitorios y
resolubles (WhatsApp sin celular cargado: cargá el celular y se habilita; mutación en vuelo). El
trade-off aceptado es que el Coach no ve *por qué* no hay acciones — se asume tolerable porque la
regla "un Coach solo gestiona Miembros" ya es visible en el resto del ABM.

### D8. Estado por dato, acción única en el footer de la card Perfil

> Revisión post-verify: reemplaza la versión anterior de esta decisión, que ponía un botón
> "Verificar" en cada fila.

**El badge sigue siendo por dato; la acción es una sola.** La spec separa explícitamente las dos
cosas: "SHALL mostrar, junto al email y al teléfono, si cada uno está verificado, **de forma
independiente**" y, aparte, "SHALL contar con una **única** acción 'Verificar contacto'".

`InfoRow` (`UserDetail.tsx:79`) conserva la prop opcional `trailing?: ReactNode`, renderizada a
continuación del valor. Se prefiere un slot genérico antes que props específicas
(`verified?: boolean`) para no meterle a un componente de presentación el vocabulario de una sola
fila.

`ContactVerificationStatus` queda **solo presentacional**: pierde las props `canManage` y
`onVerify` y ya no renderiza ningún botón. Por cada canal, la fila de Perfil renderiza en
`trailing`:

| Estado del canal | Badge |
|---|---|
| Sin cargar (`null`) | ninguno |
| Cargado y verificado | `Verificado` con `BadgeCheck`, tono neutro/muted |
| Cargado y sin verificar | `Sin verificar`, tono ámbar (outline) |

El verde queda **deliberadamente fuera**: en esta app ya significa "al día con la cuota" en el
indicador de membresía (`INDICATOR_DOT_CLASS`, `UserDetail.tsx:48`), y dos verdes distintos en la
misma pantalla compiten por el mismo lenguaje visual — el mismo criterio que documenta el
comentario de `ROLE_BADGE_CLASS`. "Verificado" es el estado normal y aburrido (neutro); "Sin
verificar" es el accionable (ámbar, el tono que la paleta ya usa para "requiere atención").
Tokens y variantes salen de `docs/design/design.md`; los badges usan `ui/badge.tsx` con
`variant="outline"`, como los de rol.

**Dónde vive el botón único**: en un `CardFooter` de la card **Perfil**, exactamente el mismo
patrón que ya usa la card Membresía para su acción única (`UserDetail.tsx:337-353`: footer con
`border-t border-border pt-4`, un solo botón, envuelto en `canManage ? ... : null`). Una card = un
footer = la acción de esa card. Condición de visibilidad:

```
hasPendingContact =
  (!!user.email && !user.email_verified) || (!!user.phone && !user.phone_verified)
// el footer se renderiza si canManage && hasPendingContact
```

Es el espejo exacto de `pending != []` del backend (D1), así que la UI nunca ofrece una acción que
el servidor vaya a rechazar con 409. El botón abre `VerifyContactDialog` vía
`setAction("verify-contact")`.

**Alternativas consideradas**

1. **Un botón "Verificar contacto" en el hero, al lado de "Editar".** Rechazada: separa la acción
   de los datos sobre los que opera (email y teléfono viven en la card Perfil) y compite con
   "Editar" por la jerarquía del encabezado.
2. **Un botón junto al primer dato pendiente.** Rechazada: la posición del botón saltaría de fila
   según el estado y sugeriría que solo afecta a ese dato, que es justo la lectura que la spec
   nueva quiere evitar.
3. **Botón siempre visible, deshabilitado cuando no hay nada pendiente.** Rechazada: contradice la
   spec ("SHALL NOT ofrecerse") y rompe la regla de D7 — deshabilitado solo para estados
   transitorios y resolubles.

**Copy del modal** (`VerifyContactDialog`, sin prop `channel`). El diálogo calcula la misma lista
de pendientes que el backend y arma la enumeración:

| Pendientes | Frase |
|---|---|
| email | "el email" |
| phone | "el celular" |
| ambos | "el email y el celular" |

Descripción: `Vas a marcar como verificados <frase> de <full_name>. Es una afirmación tuya, no una
prueba de que el usuario abrió un link: no le define ninguna contraseña.` Y, **solo si el email
está entre los pendientes y `user.invitation_status === "access_active"`** (que en backend equivale
exacto a `password_hash is not None`, ver `_invitation_status_for`), se agrega una segunda línea de
advertencia: `Esta persona ya tiene contraseña definida: al verificar su email vas a restituirle el
acceso al sistema.` Esto cierra el hallazgo menor 4 de `verification.md` — el copy anterior decía
"no le da acceso", que es falso justamente en ese caso, y la spec ahora lo declara efecto esperado.
Se condiciona en vez de ponerlo siempre porque para un Miembro con invitación pendiente (el caso
mayoritario) la frase sería directamente incorrecta.

El toast de éxito usa la misma enumeración (`El email y el celular de X quedaron marcados como
verificados.`), calculada **antes** de disparar la mutación: después del refetch la lista de
pendientes queda vacía.

Efecto colateral bienvenido: con un solo botón desaparecen los dos controles con nombre accesible
"Verificar" en la misma pantalla (hallazgo menor 5 de `verification.md`), sin necesidad de
`aria-label` de desambiguación.

### D9. Acciones en las cards Membresía e Invitación

- **Card Membresía** (visible siempre): si `canManage`, un botón en el footer de la card según
  `user.membership_status` — `active` → "Dar de baja la membresía" (destructivo, abre
  `CancelMembershipDialog`); `none` → "Activar membresía"; `cancelled` → "Reactivar membresía"
  (ambos abren `ActivateMembershipDialog`). Exactamente un botón por estado.
- **Card Invitación al portal** (solo `user.role === "member"`, como hoy): si `canManage` y
  `user.invitation_status !== "access_active"`, un botón "Invitar" (cuando el estado es `none`) o
  "Reenviar invitación" (`pending` / `expired`) que abre `InviteUserDialog`.
- **Dentro de `InviteUserDialog`**: el bloque de resultado (input readonly del link de email +
  botón copiar + botón WhatsApp) se renderiza **desde que abre el modal**, con el input vacío y
  las acciones deshabilitadas hasta que haya resultado. Lo exige el escenario "WhatsApp
  deshabilitado sin teléfono", que ocurre *al abrir* el modal, antes de generar nada; el botón de
  WhatsApp queda además deshabilitado siempre que `!user.phone`.
- **Errores de precondición (400) dentro del modal**: la spec pide que el modal *muestre* el error
  ("hace falta cargar el celular"), así que va inline como `<p role="alert">` con
  `error?.response?.data?.detail`, y **no** como toast — un solo canal por error, y el inline es
  el que está bajo el foco del usuario y es directamente testeable. Los toasts de éxito
  (`toastSuccess`) se mantienen en las cinco acciones, igual que hoy.

### D10. Blast radius del rework (qué se deshace de lo ya implementado)

El change ya está implementado por canal en el working tree (nada commiteado, ver "Migration
Plan"). El cambio de requirement toca **solo** la cadena de verificación de contacto; las
secciones 1-8 de `tasks.md` que no la tocan (achicar `EditUserDialog`, modales de membresía,
modal de invitación, `permissions.ts`, `ConfirmActionDialog`) quedan como están.

| Símbolo / archivo | Qué pasa |
|---|---|
| `verify_contact_channel` (`backend/app/routers/users.py:395`) | se reescribe como `verify_contact`, sin `channel`; único call site es la ruta |
| Ruta `POST /users/{id}/contact/{channel}/verify` | se reemplaza por `POST /users/{id}/contact/verify` |
| `_CONTACT_CHANNEL_LABEL` (`routers/users.py`) | sigue, pero para armar el detail del 409 y nada más; si queda sin uso, se borra |
| `_pending_invitation_for` | **sin cambios** (D2); pasa de una llamada por canal a una por request |
| `backend/tests/test_contact_verification.py` | se reescribe entero (11 tests por canal → tabla nueva del Plan) |
| `ContactChannel` (`frontend/src/services/users.ts:77`) | se borra; consumidores: `users.queries.ts`, `VerifyContactDialog.tsx` |
| `verifyUserContact` | pierde el parámetro `channel` |
| `useVerifyContactMutation` | `mutationFn` pasa de `{ id, channel }` a `id`; único consumidor es `VerifyContactDialog` |
| `VerifyContactDialog` | pierde la prop `channel`, gana copy dinámico; único consumidor es `UserDetail` |
| `ContactVerificationStatus` (`UserDetail.tsx:109`) | pierde `canManage` y `onVerify`; queda badge puro |
| `DetailAction` (`UserDetail.tsx:150`) | `"verify-email" \| "verify-phone"` → `"verify-contact"` |
| `InfoRow` / `trailing` | **sin cambios** |
| `frontend/src/pages/__tests__/UserDetail.test.tsx` | el bloque `verificacion manual de contacto` se reescribe; se suman dos casos de membresía (cierre de hallazgos 2 y 3) |
| `backend/app/models.py`, `migrations/`, `auth.py`, `deps.py` | **sin cambios**, igual que antes (D3) |

Nada fuera de esa lista consume la cadena de verificación: `Users.tsx`, `payments`, `attendance` y
el flujo público de invitación no la referencian.

## Risks / Trade-offs

- **Verificar el email habilita el login de un usuario que ya tiene contraseña** → `auth.py:70`
  bloquea con 403 a quien tenga `email_verified is False`. Para un Miembro con invitación
  pendiente no hay riesgo (no tiene `password_hash`, no puede loguearse), pero un Dueño/Coach con
  password y el email sin verificar recupera el acceso al marcarlo. La spec nueva lo declara
  efecto **esperado**, no accidente. Mitigación: el endpoint exige `require_can_manage_user` (la
  misma barra que cambiarle el rol o darlo de baja), el copy del modal lo avisa cuando aplica
  (D8), y hay invariante + test que fijan que la verificación no crea contraseña.
- **La acción única agranda el radio de un click**: confirmar verifica email *y* teléfono a la vez.
  Quien solo quería confirmar el celular deja el email verificado de paso, y si hay invitación
  vigente eso alcanza para que cualquiera de los dos links defina la contraseña. Es exactamente lo
  que pide la spec (y `proposal.md` lo asume de forma explícita), no un descuido; la mitigación
  disponible es de copy: el modal enumera qué va a verificar antes de confirmar (D8). Volver atrás
  requeriría cambiar el requirement, no el diseño.
- **409 sin nada pendiente con UI desactualizada** → dos pestañas abiertas sobre la misma ficha dan
  un error en la segunda. Mitigación: botón deshabilitado mientras la mutación está pendiente +
  invalidación de `["users"]` al éxito; el detail del 409 es legible en castellano.
- **Regla de permisos duplicada en el frontend** (`canManageUser` vs `require_can_manage_user`) →
  si mañana cambia la regla, hay dos lugares. Mitigación: una sola función pura, con el docstring
  apuntando a `backend/app/deps.py`, y el backend sigue rechazando con 403 igual.
- **`UserDetail.tsx` gana cinco modales y un estado de acción** → riesgo de que la página se
  convierta en el nuevo cajón de sastre que era `EditUserDialog`. Mitigación: cada modal es
  autónomo (dueño de su mutación, su estado y su toast) y `UserDetail` solo decide *cuál* está
  abierto; el balance neto es negativo en líneas (`EditUserDialog` pierde ~130).
- **Regresión silenciosa en el diálogo de edición** al borrar tanto código → `EditUserDialog` no
  tiene ni un test hoy. Mitigación: el change crea
  `frontend/src/components/__tests__/EditUserDialog.test.tsx`, que fija tanto lo que se fue como
  lo que queda.

## Migration Plan

Deploy convencional, sin pasos manuales: no hay migración de esquema (D3) ni cambio de contrato en
endpoints existentes — solo se **agrega** una ruta. La ruta por canal
(`/users/{id}/contact/{channel}/verify`) nunca llegó a `main`: existe únicamente en el working
tree de este change, así que reemplazarla por `/users/{id}/contact/verify` no rompe ningún cliente
desplegado y no hace falta deprecarla ni mantener las dos. Backend y frontend pueden desplegarse
en cualquier orden: un frontend viejo simplemente no llama a la ruta nueva; un frontend nuevo
contra un backend viejo recibe 404 en la acción de verificar, y las demás acciones (que ya
existían) siguen funcionando. Rollback = revertir el commit; los `email_verified` /
`phone_verified` que se hayan marcado a mano quedan y son estado válido, indistinguible del que
produce el flujo de invitación.

## Open Questions

Ninguna que bloquee la implementación. Los tres huecos que reportó la versión anterior de este
diseño ya los cerró la spec revisada: el efecto de verificar el email sobre el login de un
Dueño/Coach con contraseña (ahora es un escenario explícito y declarado como esperado), qué hace
la API cuando no queda nada por verificar (409, escenario "Intento de confirmar la acción sin nada
pendiente") y que una invitación **vencida** no cuenta como vigente (escenario "Invitación vencida
no se modifica al verificar a mano", que confirma lo que D2 asumía).

Queda anotado, fuera del alcance de este change y ya registrado en `proposal.md`: reenviar una
invitación vencida no hereda las verificaciones manuales previas (el link nuevo arranca con ambos
canales sin verificar en esa invitación).

## Plan de verificación

**Riesgo**: alto — el change agrega un endpoint que escribe `User.email_verified`, exactamente el
flag que `backend/app/auth.py:70` evalúa para dejar pasar o rechazar con 403 en `get_current_user`:
altera, vía datos, si un usuario puede autenticarse. Además expone
`require_can_manage_user` en una superficie nueva. Por la regla "ante la duda, el nivel más alto",
no baja de alto aunque `auth.py`, `models.py` y `migrations/` no aparezcan en el diff.

### Invariantes

- I1. `EditUserDialog` no dispara ninguna mutación que no sea `updateUser` (`PATCH /users/{id}`).
- I2. La verificación manual nunca escribe `password_hash`, nunca setea `completed_at` de una
  invitación y nunca devuelve un token de acceso.
- I3. Un Coach no puede verificar el contacto de un usuario con rol Dueño o Coach: 403, la misma
  regla que ya aplica a editar, dar de baja y activar.
- I4. La verificación manual solo toca la invitación vigente (no completada, no revocada, no
  vencida) del usuario, y dentro de ella solo los canales que esta acción acaba de verificar; si
  no hay ninguna invitación vigente, no crea ni modifica ninguna fila de `MemberInvitation`.
- I8. La verificación manual nunca cambia un dato de contacto que ya estaba verificado ni falla
  por un dato no cargado: los canales no pendientes se omiten, y solo si **no queda ninguno**
  pendiente la operación se rechaza con 409 sin escribir nada.
- I9. La ficha ofrece "Verificar contacto" exactamente cuando el backend la aceptaría: el criterio
  de visibilidad del frontend es el espejo de `pending != []` (D1/D8), así que un usuario con
  permiso nunca ve un botón que responda 409.
- I5. Las acciones de membresía siguen usando los mismos endpoints y la misma semántica (fecha de
  baja opcional, 409 si el estado no corresponde): el change mueve dónde se disparan, no qué
  hacen.
- I6. `backend/app/models.py` no cambia, por lo tanto no hay migración Alembic nueva.
- I7. Un viewer sin permiso de gestión sobre el usuario de la ficha no ve ninguna acción de
  membresía, invitación ni verificación en esa ficha.

### Tests

| Capa | Archivo | Caso |
|---|---|---|
| backend | `backend/tests/test_contact_verification.py` | `test_owner_verifica_los_dos_datos_pendientes_de_un_miembro` |
| backend | `backend/tests/test_contact_verification.py` | `test_verificar_con_el_telefono_ya_verificado_solo_toca_el_email` |
| backend | `backend/tests/test_contact_verification.py` | `test_verificar_sin_telefono_cargado_verifica_el_email_sin_error` |
| backend | `backend/tests/test_contact_verification.py` | `test_verificar_sin_nada_pendiente_responde_409_y_no_cambia_nada` |
| backend | `backend/tests/test_contact_verification.py` | `test_verificar_un_usuario_sin_datos_de_contacto_responde_409` |
| backend | `backend/tests/test_contact_verification.py` | `test_coach_verifica_el_contacto_de_un_miembro` |
| backend | `backend/tests/test_contact_verification.py` | `test_coach_no_puede_verificar_el_contacto_de_otro_coach` |
| backend | `backend/tests/test_contact_verification.py` | `test_verificar_un_usuario_inexistente_responde_404` |
| backend | `backend/tests/test_contact_verification.py` | `test_verificacion_manual_marca_en_la_invitacion_vigente_solo_los_canales_recien_verificados` |
| backend | `backend/tests/test_contact_verification.py` | `test_tras_verificar_ambos_canales_cualquier_link_habilita_la_contrasenia` |
| backend | `backend/tests/test_contact_verification.py` | `test_verificar_sin_invitacion_vigente_no_crea_ninguna_invitacion` |
| backend | `backend/tests/test_contact_verification.py` | `test_verificacion_manual_no_toca_una_invitacion_vencida` |
| backend | `backend/tests/test_contact_verification.py` | `test_verificacion_manual_no_define_contrasenia_ni_completa_la_invitacion` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `muestra el estado de verificacion junto al email y al telefono` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `ofrece verificar el contacto cuando hay un dato cargado sin verificar` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `no ofrece verificar el contacto cuando ambos datos ya estan verificados` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `no ofrece verificar el contacto cuando no hay datos cargados` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `verifica el contacto desde el modal y la ficha refleja ambos datos verificados` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `cancelar el modal de verificacion no dispara ninguna mutacion` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `da de baja la membresia desde el modal de confirmacion y refleja el nuevo estado` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `da de baja la membresia con la fecha elegida como cancelled_at` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `cancelar el modal de baja no dispara ninguna mutacion` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `ofrece activar la membresia cuando el usuario nunca tuvo membresia` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `ofrece reactivar la membresia cuando esta dada de baja` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `abre el modal de invitacion y muestra el link de email con accion de copiar` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `deshabilita el boton de WhatsApp cuando el miembro no tiene celular` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `muestra el error de precondicion dentro del modal de invitacion` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `no ofrece la accion de invitar cuando el acceso ya esta activo` |
| frontend | `frontend/src/pages/__tests__/UserDetail.test.tsx` | `un coach no ve acciones de gestion en la ficha de otro coach` |
| frontend | `frontend/src/components/__tests__/EditUserDialog.test.tsx` | `no ofrece acciones de membresia` |
| frontend | `frontend/src/components/__tests__/EditUserDialog.test.tsx` | `no ofrece acciones de invitacion al portal` |
| frontend | `frontend/src/components/__tests__/EditUserDialog.test.tsx` | `guarda solo los datos de perfil` |
| manual | — | Con `make seed-dev` y `make dev`: entrar como `dev.owner@miniespacio.local` / `devdev123`, ir a `/users`, abrir la ficha de `dev.member@miniespacio.local`, verificar que "Editar" ya no ofrece membresía ni invitación, dar de baja la membresía desde la card con fecha retroactiva, reactivarla, invitar al portal y copiar el link, y usar "Verificar contacto" en el footer de la card Perfil (el modal debe enumerar los datos pendientes y, al confirmar, dejar los dos badges en "Verificado" sin recargar). Repetir logueado como `dev.coach@miniespacio.local` sobre un usuario con rol Coach: la ficha no debe ofrecer ninguna acción. |
| manual | — | Restitución de login (escenario "Verificar el email restaura el login de un Dueño o Coach con contraseña ya definida"): con el stack levantado, poner `email_verified = false` por SQL a un Coach que ya tiene contraseña, comprobar que `GET /auth/me` con su token responde 403, confirmar "Verificar contacto" sobre su ficha como Dueño y comprobar que el mismo token vuelve a responder 200. |

Notas sobre la tabla:

- `verifica el contacto desde el modal y la ficha refleja ambos datos verificados` es el único test
  que **ejecuta** la cadena `useVerifyContactMutation` → `verifyUserContact` → `POST`: tiene que
  afirmar la URL exacta (`/users/u-1/contact/verify`) y que, tras el refetch, las dos filas
  muestran "Verificado". Cierra el hallazgo mayor 1 de `verification.md`.
- `da de baja la membresia con la fecha elegida como cancelled_at` y `ofrece activar la membresia
  cuando el usuario nunca tuvo membresia` cierran los hallazgos menores 2 y 3. Entran acá porque el
  rework ya obliga a tocar `UserDetail.test.tsx`; no habilitan más scope que ese archivo.
- `un coach no ve acciones de gestion en la ficha de otro coach` se conserva y **se amplía**: además
  de membresía e invitación, tiene que afirmar la ausencia de "Verificar contacto" (cubre el
  escenario "Coach intenta verificar el contacto de un usuario que no es Miembro" del lado UI).
