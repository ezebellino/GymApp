## 1. Backend: endpoint de verificación manual

- [x] 1.1 En `backend/app/routers/users.py`, agregar el helper `_pending_invitation_for(db, user_id)`
      junto a `_live_invitation_for` (línea ~54): misma consulta más `expires_at > datetime.utcnow()`
      (design D2). No modificar `_live_invitation_for`.
- [x] 1.2 En `backend/app/routers/users.py`, agregar el handler `verify_contact_channel` para
      `POST /users/{user_id}/contact/{channel}/verify` (`channel: schemas.InvitationChannel`, sin
      body, `response_model=schemas.UserOut`), ubicado después de los endpoints de membresía:
      `_get_user_or_404` + `require_can_manage_user(current_user, obj.role)`.
- [x] 1.3 En ese handler, implementar las precondiciones: 400 si el canal no tiene dato cargado
      (`obj.email` / `obj.phone` en `None`) y 409 si `obj.<channel>_verified` ya es `True`, con los
      mensajes en castellano de la tabla de design D1.
- [x] 1.4 En ese handler, aplicar el efecto: setear `obj.<channel>_verified = True` y, si
      `_pending_invitation_for` devuelve una invitación, setear su `<channel>_verified_at =
      datetime.utcnow()` solo si estaba en `None`. Commit + `_serialize_user_single(db, obj)`.
      No tocar `password_hash`, `completed_at`, `revoked_at`, `is_active` ni la membresía.
- [x] 1.5 Verificar que `backend/app/models.py` no requirió cambios (design D3) y, por lo tanto, que
      **no** hay migración Alembic nueva en este change.

## 2. Backend: tests del endpoint

- [x] 2.1 Crear `backend/tests/test_contact_verification.py` con docstring de módulo y un helper
      local de miembro sin acceso, siguiendo el estilo de `backend/tests/test_invitations.py`
      (`create_user` de `tests/helpers.py`, fixtures `client` / `owner_user` / `coach_user` /
      `auth_header` / `db_session`).
- [x] 2.2 Agregar `test_owner_verifica_el_email_de_un_miembro` y
      `test_coach_verifica_el_telefono_de_un_miembro` (200 y el flag correspondiente en `true` en
      la respuesta `UserOut`).
- [x] 2.3 Agregar `test_coach_no_puede_verificar_el_contacto_de_otro_coach` (403).
- [x] 2.4 Agregar `test_verificar_un_canal_sin_dato_cargado_responde_400`,
      `test_verificar_un_canal_ya_verificado_responde_409` y
      `test_verificar_un_usuario_inexistente_responde_404`.
- [x] 2.5 Agregar `test_verificacion_manual_marca_el_canal_en_la_invitacion_pendiente` (invitar vía
      `POST /users/{id}/invitation`, verificar el email a mano, assert de `email_verified_at` no
      nulo en la fila de `MemberInvitation`).
- [x] 2.6 Agregar `test_tras_verificar_el_email_a_mano_el_link_de_telefono_habilita_la_contrasenia`
      (tras la verificación manual del email, `GET /invitations/phone/{token}` devuelve
      `can_set_password: true`).
- [x] 2.7 Agregar `test_verificar_sin_invitacion_pendiente_no_crea_ninguna_invitacion` y
      `test_verificacion_manual_no_toca_una_invitacion_vencida` (invitación con `expires_at` en el
      pasado: sus `*_verified_at` quedan en `None`).
- [x] 2.8 Agregar `test_verificacion_manual_no_define_contrasenia_ni_completa_la_invitacion`
      (`password_hash` sigue en `None`, `completed_at` sigue en `None`, la respuesta no trae token).
- [x] 2.9 Correr `make test-backend` y dejar la suite en verde.

## 3. Frontend: servicio y mutación

- [x] 3.1 En `frontend/src/services/users.ts`, exportar `type ContactChannel = "email" | "phone"` y
      `verifyUserContact(id, channel): Promise<User>` contra
      `POST /users/{id}/contact/{channel}/verify`.
- [x] 3.2 En `frontend/src/services/users.queries.ts`, agregar `useVerifyContactMutation()` que
      invalide `queryKeys.users.all` en `onSuccess`.
- [x] 3.3 En `frontend/src/services/users.queries.ts`, agregar a `useInviteUserMutation` la
      invalidación de `queryKeys.users.all` en `onSuccess` (design D4).
- [x] 3.4 Crear `frontend/src/lib/permissions.ts` con
      `canManageUser(viewerRole: Role | null, targetRole: Role): boolean`, con comentario que
      apunte a `backend/app/deps.py` (`require_can_manage_user`) como fuente de verdad.

## 4. Frontend: componentes de modal

- [x] 4.1 Crear `frontend/src/components/ConfirmActionDialog.tsx` sobre `@/components/ui/dialog`:
      props `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `pendingLabel`,
      `destructive?`, `isPending`, `error?`, `children?`, `onConfirm`. Sin mutaciones ni tipo
      `User` adentro. Tokens visuales según `docs/design/design.md`.
- [x] 4.2 Crear `frontend/src/components/CancelMembershipDialog.tsx` (`{ open, onOpenChange, user }`):
      usa `ConfirmActionDialog`, estado del `Input type="datetime-local"` de fecha de baja en el
      slot `children`, copy dependiente del rol migrado desde `EditUserDialog.handleCancelMembership`,
      `useCancelMembershipMutation` y `toastSuccess`/`toastError`.
- [x] 4.3 Crear `frontend/src/components/ActivateMembershipDialog.tsx` (`{ open, onOpenChange, user }`):
      usa `ConfirmActionDialog` con `useActivateMembershipMutation`; label "Activar membresía" si
      `membership_status === "none"`, "Reactivar membresía" si es `"cancelled"`.
- [x] 4.4 Crear `frontend/src/components/VerifyContactDialog.tsx`
      (`{ open, onOpenChange, user, channel }`): usa `ConfirmActionDialog` con
      `useVerifyContactMutation`; el copy aclara que verificar a mano no le da acceso ni contraseña
      al usuario.
- [x] 4.5 Crear `frontend/src/components/InviteUserDialog.tsx` (`{ open, onOpenChange, user }`):
      `Dialog` propio, `useInviteUserMutation`, y `copyLink` / `openWhatsApp` migrados desde
      `EditUserDialog` (WhatsApp deshabilitado si `!user.phone`).
- [x] 4.6 En `InviteUserDialog`, renderizar el bloque de resultado (input readonly del link de
      email + botón copiar + botón WhatsApp) **desde que abre el modal**, vacío y deshabilitado
      hasta que haya resultado, y mostrar el error de precondición inline como `<p role="alert">`
      con `error?.response?.data?.detail` (design D9).

## 5. Frontend: ficha del usuario

- [x] 5.1 En `frontend/src/pages/UserDetail.tsx`, leer el rol del viewer con
      `useSessionStore((s) => s.role)` y derivar `canManage` con `canManageUser` de
      `@/lib/permissions`.
- [x] 5.2 Reemplazar el estado `editOpen` por un único `action` (`null | "edit" |
      "cancel-membership" | "activate-membership" | "invite" | "verify-email" | "verify-phone"`) y
      montar cada modal condicionalmente, incluido el `EditUserDialog` ya existente.
- [x] 5.3 Agregar a `InfoRow` la prop opcional `trailing?: ReactNode`, renderizada después del
      valor.
- [x] 5.4 En la card Perfil, pasar por `trailing` el badge de verificación de email y de teléfono
      (sin badge si el dato está sin cargar; "Verificado" neutro con `BadgeCheck`; "Sin verificar"
      en ámbar), según la tabla de design D8.
- [x] 5.5 En esas mismas filas, agregar el botón "Verificar" (ghost) solo si el dato está cargado,
      no está verificado y `canManage`; abre `VerifyContactDialog` con el canal correspondiente.
- [x] 5.6 En la card Membresía, agregar el botón único según `membership_status` ("Dar de baja la
      membresía" destructivo / "Activar membresía" / "Reactivar membresía"), visible solo si
      `canManage`, que abre el modal correspondiente.
- [x] 5.7 En la card Invitación al portal, agregar el botón "Invitar" / "Reenviar invitación"
      (según `invitation_status`), visible solo si `canManage` y `invitation_status !==
      "access_active"`, que abre `InviteUserDialog`.

## 6. Frontend: achicar `EditUserDialog`

- [x] 6.1 En `frontend/src/components/EditUserDialog.tsx`, borrar `handleCancelMembership`,
      `handleActivateMembership`, `handleInvite`, `copyLink`, `openWhatsApp`, los estados
      `cancelDate` e `inviteResult` y los bloques JSX de "Membresía" e "Invitación al portal".
- [x] 6.2 Borrar lo que queda huérfano: `MEMBERSHIP_STATUS_LABEL`, `INVITATION_STATUS_LABEL`,
      `formatDate`, `isMemberRole`, los imports de `useCancelMembershipMutation` /
      `useActivateMembershipMutation` / `useInviteUserMutation` y los iconos `Copy` /
      `MessageCircle`.
- [x] 6.3 Actualizar el copy del diálogo (`DialogDescription` y el texto de la card de encabezado)
      para que hable solo del perfil, sin mencionar membresía ni acceso al portal.
- [x] 6.4 Conservar el `useEffect` con deps `[open, user.id]` y el `eslint-disable`, pero reescribir
      su comentario con las dos razones que sobreviven (identidad de `user` cambiando por
      invalidaciones de `["users"]` externas; `Users.tsx` deja el diálogo montado tras cerrarlo),
      quitando la referencia a `inviteResult` y a las mutaciones propias (design D6).
- [x] 6.5 Verificar que `frontend/src/pages/Users.tsx` sigue compilando y funcionando sin cambios
      (mismo contrato de props de `EditUserDialog`).

## 7. Frontend: tests

- [x] 7.1 Crear `frontend/src/components/__tests__/EditUserDialog.test.tsx` con `renderWithProviders`
      y `createApiMock`, y los casos `no ofrece acciones de membresia`,
      `no ofrece acciones de invitacion al portal` y `guarda solo los datos de perfil` (este último
      afirma que el submit llama `api.patch` a `/users/{id}` y que no hubo ningún `api.post`).
- [x] 7.2 En `frontend/src/pages/__tests__/UserDetail.test.tsx`, agregar los casos de verificación:
      `muestra el estado de verificacion junto al email y al telefono`,
      `ofrece verificar el email cuando esta cargado y sin verificar` y
      `no ofrece verificar un canal sin cargar ni uno ya verificado`.
- [x] 7.3 En el mismo archivo, agregar los casos de membresía:
      `da de baja la membresia desde el modal de confirmacion y refleja el nuevo estado`,
      `cancelar el modal de baja no dispara ninguna mutacion` y
      `ofrece reactivar la membresia cuando esta dada de baja`.
- [x] 7.4 En el mismo archivo, agregar los casos de invitación:
      `abre el modal de invitacion y muestra el link de email con accion de copiar`,
      `deshabilita el boton de WhatsApp cuando el miembro no tiene celular`,
      `muestra el error de precondicion dentro del modal de invitacion` y
      `no ofrece la accion de invitar cuando el acceso ya esta activo`.
- [x] 7.5 En el mismo archivo, agregar `un coach no ve acciones de gestion en la ficha de otro coach`,
      sembrando el rol del viewer con el patrón `seedRole` de
      `frontend/src/components/__tests__/Sidebar.test.tsx` (`access_token` + `user_role` en
      `localStorage`, antes de `renderWithProviders`).
- [x] 7.6 Correr `make test-frontend` y dejar la suite en verde.

## 8. Cierre

- [x] 8.1 Actualizar `frontend/AGENTS.md` y `backend/AGENTS.md` con los tests nuevos y el endpoint
      nuevo, según la convención de cada app.
- [x] 8.2 Correr `make check-plan CHANGE=move-user-actions-to-detail` y dejarlo en verde (todos los
      archivos y casos de la tabla existen).
- [x] 8.3 Correr `make lint` y `make test` y dejar ambos en verde.

## 9. Rework: verificación de contacto con una sola acción (cambio de requirement post-verify)

> El usuario cambió el requirement después de `/opsx:verify` (veredicto PASA CON RESERVAS): la
> verificación manual pasa de dos acciones por canal a **una sola** acción "Verificar contacto".
> Esta sección **reemplaza** lo que hicieron las tasks 1.2, 1.3, 1.4, 2.2 a 2.8, 3.1, 3.2, 4.4,
> 5.2 (el estado `action`), 5.4, 5.5, 7.2 y 8.1 — que quedan marcadas como hechas porque se
> hicieron, no porque sigan vigentes. Las secciones 4 (salvo 4.4), 5.6, 5.7, 6 y el resto de 7 no
> se tocan. Ver `design.md` D1, D8 y D10.

### Backend

- [x] 9.1 En `backend/app/routers/users.py`, reemplazar el handler `verify_contact_channel` y su
      ruta `POST /{user_id}/contact/{channel}/verify` por `verify_contact` en
      `POST /{user_id}/contact/verify` (sin path param de canal, sin body,
      `response_model=schemas.UserOut`). Se conservan `_get_user_or_404` +
      `require_can_manage_user(current_user, obj.role)`.
- [x] 9.2 En ese handler, calcular la lista `pending` de canales pendientes (`email` si `obj.email`
      y no `obj.email_verified`; `phone` si `obj.phone` y no `obj.phone_verified`) y responder
      409 "No hay datos de contacto para verificar" si queda vacía, sin escribir nada. Borrar la
      rama del 400 por dato no cargado y la del 409 por canal ya verificado (design D1).
- [x] 9.3 En ese handler, aplicar el efecto sobre **todos** los canales de `pending`:
      `obj.<canal>_verified = True` y, si `_pending_invitation_for(db, obj.id)` devuelve una
      invitación, su `<canal>_verified_at = datetime.utcnow()` si estaba en `None`. Llamar al
      helper **una sola vez** por request. No tocar los canales fuera de `pending`, ni
      `password_hash`, `completed_at`, `revoked_at`, `is_active` ni la membresía.
- [x] 9.4 Dejar `_pending_invitation_for` como está (design D2) y revisar
      `_CONTACT_CHANNEL_LABEL`: si el detail del 409 ya no lo usa, borrarlo para no dejar código
      muerto.
- [x] 9.5 Reescribir `backend/tests/test_contact_verification.py` con los 13 casos de la tabla del
      Plan de verificación, borrando los que eran por canal (`test_owner_verifica_el_email_...`,
      `test_coach_verifica_el_telefono_...`, `test_verificar_un_canal_sin_dato_cargado_responde_400`,
      `test_verificar_un_canal_ya_verificado_responde_409`,
      `test_verificacion_manual_marca_el_canal_en_la_invitacion_pendiente`,
      `test_tras_verificar_el_email_a_mano_el_link_de_telefono_habilita_la_contrasenia`,
      `test_verificar_sin_invitacion_pendiente_no_crea_ninguna_invitacion`). Se conservan tal cual
      `test_coach_no_puede_verificar_el_contacto_de_otro_coach`,
      `test_verificar_un_usuario_inexistente_responde_404`,
      `test_verificacion_manual_no_toca_una_invitacion_vencida` y
      `test_verificacion_manual_no_define_contrasenia_ni_completa_la_invitacion`, adaptando la URL.
- [x] 9.6 Entre esos casos, cubrir explícitamente que
      `test_verificacion_manual_marca_en_la_invitacion_vigente_solo_los_canales_recien_verificados`
      asserta que el `*_verified_at` del canal que ya estaba verificado en el usuario **no** se
      escribe, y que `test_tras_verificar_ambos_canales_cualquier_link_habilita_la_contrasenia`
      pide `GET /invitations/{canal}/{token}` con **cualquiera** de los dos canales y espera
      `can_set_password: true`.
- [x] 9.7 Correr `make test-backend` y dejar la suite en verde.

### Frontend

- [x] 9.8 En `frontend/src/services/users.ts`, cambiar `verifyUserContact` a `(id: string)` contra
      `POST /users/{id}/contact/verify` y borrar el tipo `ContactChannel` (sin consumidores tras
      9.9 y 9.10).
- [x] 9.9 En `frontend/src/services/users.queries.ts`, cambiar `useVerifyContactMutation` a
      `mutationFn: (id: string) => verifyUserContact(id)` y quitar el import de `ContactChannel`.
      La invalidación de `queryKeys.users.all` en `onSuccess` queda igual.
- [x] 9.10 En `frontend/src/components/VerifyContactDialog.tsx`, quitar la prop `channel` (props:
      `{ open, onOpenChange, user }`) y derivar adentro la lista de datos pendientes con el mismo
      criterio del backend. Título "Verificar contacto", descripción que enumera lo pendiente
      ("el email", "el celular" o "el email y el celular") según la tabla de design D8.
- [x] 9.11 En ese mismo diálogo, agregar la advertencia condicional: si el email está entre los
      pendientes y `user.invitation_status === "access_active"`, sumar que esa persona ya tiene
      contraseña y verificar el email le restituye el acceso (cierra el hallazgo menor 4 de
      `verification.md`). Ajustar el toast de éxito a la misma enumeración, calculada antes de
      disparar la mutación.
- [x] 9.12 En `frontend/src/pages/UserDetail.tsx`, reemplazar en `DetailAction` los valores
      `"verify-email" | "verify-phone"` por `"verify-contact"` y montar `VerifyContactDialog` con
      esa única condición, sin pasarle `channel`.
- [x] 9.13 En `frontend/src/pages/UserDetail.tsx`, dejar `ContactVerificationStatus` como
      componente puramente presentacional: quitarle las props `canManage` y `onVerify` y el botón
      "Verificar"; solo renderiza el badge "Verificado" / "Sin verificar" (o nada si el dato no
      está cargado). Actualizar las dos `InfoRow` que lo usan.
- [x] 9.14 En la card Perfil, agregar un `CardFooter` con el botón único "Verificar contacto",
      siguiendo el mismo patrón visual que el footer de la card Membresía, visible solo si
      `canManage && hasPendingContact` (con `hasPendingContact` derivado como en design D8), que
      hace `setAction("verify-contact")`.
- [x] 9.15 En `frontend/src/pages/__tests__/UserDetail.test.tsx`, reemplazar los casos por canal
      (`ofrece verificar el email cuando esta cargado y sin verificar`,
      `no ofrece verificar un canal sin cargar ni uno ya verificado`) por
      `ofrece verificar el contacto cuando hay un dato cargado sin verificar`,
      `no ofrece verificar el contacto cuando ambos datos ya estan verificados` y
      `no ofrece verificar el contacto cuando no hay datos cargados`. Conservar
      `muestra el estado de verificacion junto al email y al telefono` (badge por dato).
- [x] 9.16 En el mismo archivo, agregar
      `verifica el contacto desde el modal y la ficha refleja ambos datos verificados`: confirmar
      el modal tiene que disparar `api.post` a `/users/u-1/contact/verify` (URL exacta) y, tras el
      refetch, la ficha muestra los dos "Verificado". Cierra el hallazgo mayor 1 de
      `verification.md`.
- [x] 9.17 En el mismo archivo, agregar
      `cancelar el modal de verificacion no dispara ninguna mutacion`.
- [x] 9.18 En el mismo archivo, ampliar
      `un coach no ve acciones de gestion en la ficha de otro coach` para que además afirme la
      ausencia de "Verificar contacto".
- [x] 9.19 En el mismo archivo, agregar
      `da de baja la membresia con la fecha elegida como cancelled_at`, afirmando el valor concreto
      de `cancelled_at` en el body del `api.post` (hoy es `expect.anything()`; hallazgo menor 2).
- [x] 9.20 En el mismo archivo, agregar
      `ofrece activar la membresia cuando el usuario nunca tuvo membresia`
      (`membership_status: "none"` → botón "Activar membresía"; hallazgo menor 3).
- [x] 9.21 Correr `make test-frontend` y dejar la suite en verde.

### Docs y cierre

- [x] 9.22 Actualizar `backend/AGENTS.md`: el endpoint pasa a ser
      `POST /users/{id}/contact/verify` (una sola acción, ambos canales, 409 si no hay nada
      pendiente) y la lista de tests de `test_contact_verification.py`.
- [x] 9.23 Actualizar `frontend/AGENTS.md`: acción única "Verificar contacto" en el footer de la
      card Perfil, `VerifyContactDialog` sin `channel`, y `verifyUserContact` /
      `useVerifyContactMutation` listados en el árbol de `src/services/` (cierra el hallazgo menor
      12 de `verification.md`).
- [x] 9.24 Correr `make check-plan CHANGE=move-user-actions-to-detail` y dejarlo en verde (todos
      los casos de la tabla nueva existen).
- [x] 9.25 Correr `make lint` y `make test` y dejar ambos en verde.
