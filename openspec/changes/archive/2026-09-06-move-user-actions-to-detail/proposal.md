## Why

Hoy el diálogo "Editar usuario" mezcla dos cosas distintas: un formulario de perfil (guardado
explícito, con botón "Guardar cambios") y acciones operativas inmediatas de membresía (dar de
baja, activar, reactivar) e invitación al portal, que disparan mutaciones propias sin pasar por
"Guardar". Esa mezcla confunde qué botón hace qué y obliga a abrir "Editar" para acciones que no
son edición de datos. Además, hoy no existe forma de que un Dueño o Coach marque a mano el email
o el teléfono de un usuario como verificados, aun cuando el modelo ya soporta ese estado — un
Dueño que confirmó el dato de contacto por otro canal (llamada, en persona) no tiene cómo
reflejarlo, y eso deja a un miembro con invitación pendiente esperando abrir un link que ya no
necesita.

## What Changes

- El diálogo de edición de usuario (`EditUserDialog`) deja de mostrar la sección "Membresía" (dar
  de baja / activar / reactivar) y la sección "Invitación al portal". Queda únicamente como
  formulario de perfil (nombre, apellido, fecha de nacimiento, peso, altura, email, teléfono y,
  si el que edita es Dueño, el rol), con su botón "Guardar cambios".
- Las acciones de membresía (dar de baja, activar, reactivar) se mueven a la card "Membresía" de
  la ficha del usuario (`UserDetail`), cada una detrás de un modal de confirmación. El modal de
  baja conserva el campo de fecha opcional que ya existe hoy.
- La acción de invitar/reenviar invitación al portal se mueve a la card "Invitación al portal" de
  la ficha, detrás de un modal que muestra el resultado (link de email con copiar, link de
  WhatsApp) — mismo contenido funcional que hoy vive en el diálogo de edición.
- Nueva capability: la ficha del usuario muestra si el email y el teléfono están verificados, cada
  uno con su propio estado visible por separado. Un Dueño o Coach con permiso de gestión sobre ese
  usuario cuenta con una única acción **"Verificar contacto"**, detrás de un solo modal de
  confirmación, que marca como verificados **todos los datos de contacto cargados que aún no lo
  estén** (email y/o teléfono) en una sola operación. La acción se ofrece únicamente cuando el
  usuario tiene al menos un dato cargado y sin verificar; si ambos datos cargados ya están
  verificados, o si no hay ningún dato cargado, la acción no se ofrece.
- Si el usuario tiene una invitación al portal pendiente, confirmar "Verificar contacto" marca
  también en la invitación los canales que quedaron verificados por esta acción (ver "Decisiones
  asumidas").
- Sin cambios de permisos, de eliminación física, ni del listado de Usuarios más allá de que la
  acción "Editar" sigue abriendo el mismo diálogo, ahora acotado a perfil.

## Decisiones asumidas (a confirmar por el usuario)

- **"Activar" se interpreta como activar/reactivar la membresía**, no como habilitar la cuenta de
  acceso (`is_active`/bloqueo de login) — es la misma acción que ya existe hoy
  (`POST /users/{id}/membership/activate`), solo se mueve de lugar.
- **Quién puede verificar a mano**: un Dueño o Coach, bajo las mismas reglas de gestión que ya
  aplican a editar/dar de baja/activar (un Coach solo sobre usuarios con rol Miembro).
- **Una sola acción para los dos canales, no dos botones independientes**: en vez de dos acciones
  separadas (una para email, otra para teléfono), la ficha ofrece una única acción "Verificar
  contacto" con un solo modal de confirmación. Al confirmar, el sistema marca como verificados
  **todos** los datos de contacto cargados del usuario que aún no estén verificados (email y/o
  teléfono) en la misma operación. Un dato no cargado se omite sin error; un dato ya verificado
  queda sin cambios — no se re-verifica ni produce error por sí solo mientras haya al menos otro
  dato pendiente. El modal aclara qué se va a verificar (por ejemplo "Se marcarán como verificados
  el email y el celular" si ambos están pendientes, o solo el que corresponda si es uno solo).
- **Cuándo se ofrece la acción**: se ofrece cuando el usuario tiene al menos un dato de contacto
  cargado y sin verificar. Si ambos datos cargados ya están verificados, o si el usuario no tiene
  ningún dato cargado, la acción no se ofrece.
- **Conflicto a nivel API cuando no hay nada para verificar**: si se invoca la acción para un
  usuario sin ningún dato cargado, o con todos los datos cargados ya verificados (cliente
  desactualizado, dos pestañas abiertas), la API rechaza la operación con un error de conflicto y
  no cambia nada — la UI ya no ofrece la acción en ese caso, pero la API la respalda igual.
- **Efecto sobre una invitación pendiente**: si el usuario tiene una invitación **vigente** (no
  completada, no revocada y no vencida) y al confirmar "Verificar contacto" el sistema marca uno o
  ambos canales como verificados, también los marca como verificados en esa invitación — de modo
  que el miembro necesita completar un canal menos (o ninguno, si ambos quedaron verificados a
  mano) para poder definir su contraseña. Si la acción deja verificados **ambos** canales en la
  invitación, el miembro puede definir su contraseña abriendo **cualquiera** de los dos links
  recibidos (el de email o el de WhatsApp), sin necesidad de abrir el otro — el usuario que pidió
  esta acción conjunta acepta implícitamente esta consecuencia. La verificación manual no define
  contraseña ni completa una invitación por sí misma. Si no hay ninguna invitación vigente —
  porque nunca se invitó o porque la única existente está vencida sin completar — la verificación
  manual solo afecta el/los dato(s) del usuario, sin modificar ninguna invitación. Reenviar una
  invitación vencida se comporta como hoy (link nuevo con ambos canales sin verificar en esa
  invitación): este change no hereda verificaciones manuales previas al reenvío. Si el usuario
  considera que debería heredarlas, lo dejamos marcado como pendiente para una iteración futura,
  no como requirement de este change.
- **La verificación manual no es "no otorga acceso" en términos absolutos**: para un Miembro sin
  contraseña (invitación pendiente) no hay ningún efecto de acceso, pero para un Dueño o Coach que
  ya tiene contraseña definida y el email sin verificar (por ejemplo, un Miembro promovido a
  Coach), marcarle el email como verificado a mano **sí** restituye su capacidad de iniciar
  sesión, porque el login exige `email_verified = true`. Ese es el efecto esperado y deseado de la
  acción en ese caso, no un bug — lo dejamos explícito en la spec en vez de prometer "nunca otorga
  acceso".
## Capabilities

### New Capabilities
- (ninguna) — la verificación manual de contacto se agrega como requirement nuevo dentro de la
  capability existente `user-management`, no como capability propia, porque es un atributo más
  del perfil del usuario que ya cubre esa spec.

### Modified Capabilities
- `user-management`: el formulario de edición queda limitado al perfil (ya no ofrece acciones de
  membresía ni de invitación); las acciones de membresía (dar de baja / activar / reactivar) se
  disparan desde la ficha del usuario, detrás de un modal de confirmación, sin cambiar su
  comportamiento de negocio; se agrega la acción única "Verificar contacto" (email y teléfono
  juntos) desde la ficha.
- `member-invitation`: la acción de invitar/reenviar se dispara desde la ficha (no desde el
  diálogo de edición) y muestra su resultado en un modal; la acción "Verificar contacto" de
  `user-management` cuenta también como verificación de los canales que marca en la invitación
  pendiente.

## Impact

- Frontend: `EditUserDialog.tsx` (se achica a solo perfil), `UserDetail.tsx` (gana acciones de
  membresía, invitación y verificación manual con sus modales), `Users.tsx` (sin cambios de
  comportamiento, sigue abriendo el mismo diálogo de edición).
- Backend: no se proponen cambios de endpoints en este documento — el diseño de qué endpoint(s)
  exponen la verificación manual y cómo actualizan la invitación pendiente queda a cargo del rol
  Arquitecto en `design.md`.
