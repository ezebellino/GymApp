# Verificación: move-user-actions-to-detail

**Fecha**: 2026-09-05 (segunda pasada, tras el rework de la sección 9 de `tasks.md`)
**Veredicto**: PASA CON RESERVAS
**Diff verificado**: working tree sin commitear sobre `main` (`0ee1ccc` + `b0368aa`), acotado a los
archivos del change (lista abajo). Los cambios del change `dev-role-switcher` y los directorios
`docs/propuestas/` y `openspec/changes/add-routine-templates/` presentes en el mismo working tree
son de otras sesiones y quedaron fuera del alcance.
**Riesgo declarado**: alto
**Paso 0**: lint OK · test OK · plan OK

Archivos del change: `backend/app/routers/users.py`, `backend/tests/test_contact_verification.py`,
`backend/AGENTS.md`, `frontend/AGENTS.md`, `frontend/src/lib/permissions.ts`,
`frontend/src/services/users.ts`, `frontend/src/services/users.queries.ts`,
`frontend/src/components/{ConfirmActionDialog,CancelMembershipDialog,ActivateMembershipDialog,VerifyContactDialog,InviteUserDialog,EditUserDialog}.tsx`,
`frontend/src/components/__tests__/EditUserDialog.test.tsx`, `frontend/src/pages/UserDetail.tsx`,
`frontend/src/pages/__tests__/UserDetail.test.tsx`.

## Historial

- **Primera pasada** (misma fecha): implementación por canal (dos botones "Verificar", endpoint
  `POST /users/{id}/contact/{channel}/verify`). Paso 0 verde, QA PASA en 29 escenarios, Code
  Reviewer PASA CON RESERVAS con 12 hallazgos (1 mayor: la cadena de verificación del frontend no la
  ejecutaba ningún test; 11 menores).
- **Cambio de requirement**: el usuario pidió una sola acción "Verificar contacto" que marque email
  y celular juntos. PO reescribió el requirement y sus 15 escenarios, Arquitecto reescribió D1/D8/D10
  y el Plan de verificación, Dev implementó la sección 9 (25 tasks). Esa sección cerró además los
  hallazgos 1, 2, 3, 4 y 5 de la primera pasada; los 6-11 quedaron fuera de scope a propósito.
- **Segunda pasada** (esta): paso 0 + Code Reviewer + QA sobre el rework.

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=move-user-actions-to-detail` | OK (exit 0, `riesgo=alto`; los 13 tests backend y 16 frontend nombrados existen) |
| Lint | `make lint` | OK (ruff: All checks passed; eslint+tsc: 0 errores, 33 warnings preexistentes) |
| Tests | `make test` | OK (backend 87 passed; frontend 93 passed en 19 archivos) |

## Escenarios de la spec

Verificados por QA con el stack Docker (`docker compose restart backend` para tomar el código;
`make seed-dev`), UI vía chrome-devtools como Dueño y Coach, API vía `curl`, SQL en el contenedor
`db` para timestamps de invitación. Sin errores de consola ni requests fallidos.

### user-management / Verificación manual de contacto (email y teléfono)

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| Ofrecer la acción cuando el email está sin verificar | UI: badge "Sin verificar" + botón único "Verificar contacto" | PASA |
| Ofrecer la acción cuando el teléfono está sin verificar | UI: botón visible, modal dice "el celular" | PASA |
| No ofrecer la acción cuando ambos ya están verificados | UI: dos badges "Verificado", sin botón | PASA |
| No ofrecer la acción cuando no hay ningún dato cargado | UI: sin badges ni botón | PASA |
| Confirmar la acción verifica ambos datos pendientes | UI: modal "el email y el celular" → ambos badges "Verificado" sin recargar; Network: un solo `POST /users/{id}/contact/verify` | PASA |
| Confirmar la acción omite el dato no cargado | API: 200, `email_verified: true`, `phone_verified: false` | PASA |
| Confirmar la acción no toca un dato ya verificado | API: email ya verificado queda igual, solo phone cambia | PASA |
| Intento de confirmar sin nada pendiente | API: 409 "No hay datos de contacto para verificar" (ambos verificados y sin datos cargados), sin cambios | PASA |
| La acción marca en la invitación vigente los canales recién verificados | API+SQL: `email_verified_at` seteado, `phone_verified_at` intacto | PASA |
| Verificar ambos canales permite completar con cualquiera de los dos links | API: `GET /invitations/phone/{token}` → `can_set_password: true` sin abrir el de email | PASA |
| Verificación sin invitación vigente | API+SQL: 200, sin filas en `member_invitations` | PASA |
| Invitación vencida no se modifica al verificar a mano | API+SQL: usuario marcado, invitación con ambos `*_verified_at` NULL | PASA |
| Verificar el email restaura el login de un Dueño o Coach con contraseña | API+SQL: `GET /auth/me` 403 → Dueño verifica → mismo token 200 | PASA |
| Coach intenta verificar el contacto de un no-Miembro | API Coach→Coach 403; UI sin botón | PASA |
| Estado de verificación visible en la ficha | UI: badges independientes junto a email y teléfono | PASA |

### member-invitation

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| Verificación manual reduce lo que falta para definir contraseña | API+SQL: miembro abre link WhatsApp (`phone_verified_at` T0); Dueño confirma "Verificar contacto" → `email_verified_at` nuevo y `phone_verified_at` sigue exactamente T0; `GET /invitations/email/{token}` → `can_set_password: true` | PASA |

### Escenarios de la primera pasada no afectados por el rework

Los 14 escenarios de "Acciones de membresía desde la ficha", "Edición de usuario limitada al
perfil" y "Acción de invitar desde la ficha en modal" dieron PASA en la primera pasada (misma
fecha, mismo código de esas partes). QA repitió no-regresión: "Dar de baja la membresía" abre y
cancela sin cambios; "Invitar" abre y cierra sin generar link; "Editar" sin secciones de membresía
ni invitación; ruta vieja `POST /users/{id}/contact/{channel}/verify` → 404; cancelar el modal de
verificación no dispara la mutación. Todo PASA.

## QA manual

Corrida en ambas pasadas (riesgo alto: no se omite). Veredicto de QA en la segunda pasada: **PASA**.
Notas operativas: el contenedor `backend` corre sin `--reload` y hay que reiniciarlo para que tome
código nuevo; quedaron usuarios de prueba `qa.*`/`qa2.*@example.com` en la base de desarrollo (sin
borrado físico por diseño). El stack quedó levantado.

## Hallazgos

Code Reviewer, segunda pasada. Ninguno bloqueante ni mayor. El endpoint `verify_contact`
(`backend/app/routers/users.py:392-424`) implementa D1 al pie: `pending` calculado como lo describe
el diseño, 409 antes de cualquier escritura, efecto acotado a los canales pendientes y a los
`*_verified_at` que estaban en `None`, un solo commit, permisos `require_role` +
`require_can_manage_user` antes de escribir. El espejo del frontend (`hasPendingContact`,
`pendingChannels`) es la misma regla. Riesgo **alto** correcto. Sin restos de la ruta por canal.

### Cierre de los hallazgos de la primera pasada

| # | Hallazgo | Estado |
|---|---|---|
| 1 (mayor) | Cadena de verificación sin test | **Cerrado**: `UserDetail.test.tsx` ejecuta click → confirmar → `api.post("/users/u-1/contact/verify", {})` → dos badges "Verificado" |
| 2 | `cancelled_at` con `expect.anything()` | **Cerrado**: afirma el ISO concreto de la fecha ingresada |
| 3 | Sin test de `none` → "Activar membresía" | **Cerrado** |
| 4 | Copy no avisa la restitución del login | **Cerrado**: advertencia condicional en `VerifyContactDialog` |
| 5 | Dos botones "Verificar" | **Cerrado**: un solo botón en el footer de Perfil |
| 6-11 | a11y `htmlFor`, paleta cruda ámbar, prop `error` sin uso, "Cerrar" en vuelo, `isReinvite` refetcheado, "Editar" visible sin permiso | **Abiertos**, fuera de scope a propósito; el rework no los agravó |
| 12 | Árbol de `src/services/` en `frontend/AGENTS.md` | **No cerrado** (ver A) |

### Hallazgos nuevos (todos menores)

- **A.** `frontend/AGENTS.md:47-52` — la task 9.23 está marcada hecha pero el árbol de
  `src/services/` sigue sin listar `verifyUserContact` / `useVerifyContactMutation` (solo la prosa
  los documenta). Es el hallazgo 12 sin cerrar; arreglo de dos líneas.
- **B.** `backend/tests/test_contact_verification.py:56-70` —
  `test_verificar_con_el_telefono_ya_verificado_solo_toca_el_email` no discrimina: una
  implementación que ignorara el filtro "ya verificado" lo pasa igual. La regla solo se observa en
  el test de la invitación (`:166-184`). Sugerido: sumarle una invitación vigente y afirmar
  `phone_verified_at is None`.
- **C.** `VerifyContactDialog.tsx:67` — con un solo canal pendiente el copy dice "marcar como
  verificados el email" (plural + singular). El toast sí concuerda número.
- **D.** Interacción con el reenvío de invitación: tras verificar a mano ambos canales, un
  "Reenviar invitación" crea una invitación nueva con ambos `*_verified_at` en NULL, y como el
  usuario ya no tiene nada pendiente la ficha no ofrece "Verificar contacto" (API 409). El miembro
  puede seguir por el camino normal (abrir ambos links), pero el admin no puede volver a asistirlo
  desde la ficha. `design.md` lo registra fuera de alcance solo para invitación vencida; aplica a
  cualquier reenvío. Conviene anotarlo en `proposal.md` con ese alcance.
- **E.** El escenario de mayor riesgo (login restaurado) queda solo como verificación manual en el
  Plan; es automatizable con los fixtures existentes (`GET /auth/me` 403 → verify → 200). QA lo
  re-verificó contra la ruta nueva en esta pasada.

## Sin verificar

- Baja con fecha retroactiva recorrida por UI con un valor concreto (limitación del date picker
  nativo vía accessibility tree). Cubierta a nivel backend por `test_membership.py` y a nivel
  frontend por el test que afirma el `cancelled_at` enviado.
- WhatsApp deshabilitado para un miembro sin teléfono, y error 400 inline del modal de invitación,
  en navegador. Cubiertos por `UserDetail.test.tsx`; no dependían del rework.
