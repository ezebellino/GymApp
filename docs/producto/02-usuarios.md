# Gestión de usuarios

Módulo 1 del MVP. Define quién es un usuario, cómo se da de alta, cómo obtiene acceso, cómo
se lo da de baja y qué ve el staff en el listado y la ficha. Los permisos por rol están en
[01-roles-y-permisos.md](01-roles-y-permisos.md) y no se repiten acá.

Última revisión: 2026-09-06. Estado: borrador 1. Es el módulo más maduro del código: la mayor
parte de lo que sigue ya está implementado y con spec; la brecha es chica y concreta.

---

## 0. Supuestos a confirmar

| # | Supuesto | Alternativa descartada |
|---|---|---|
| U1 | Un `member` **nace con membresía activa** y con su plan asignado (S7 de membresías). No existe "miembro en espera". | Alta sin membresía, activación posterior. |
| U2 | El **email es obligatorio** para un Miembro nuevo, porque sin email no hay invitación. El celular es obligatorio para poder invitar, pero no para crear el registro. | Ambos opcionales, alta "solo en papel". |
| U3 | La invitación vence a los **7 días** y se puede reenviar sin límite; cada reenvío invalida el link anterior. | Sin vencimiento. |
| U4 | El Miembro puede **editar su propio perfil** en el portal: peso, altura, celular. No puede cambiar email (identifica la cuenta) ni fecha de nacimiento. | Perfil solo lectura. |
| U5 | **Recuperar contraseña** reutiliza el link de invitación: el Dueño lo dispara desde la ficha ("Resetear acceso") y el miembro define una contraseña nueva. No hay "olvidé mi contraseña" autoservicio en el MVP. | Autoservicio por email. |
| U6 | No se puede dar de baja la membresía de un miembro con **pagos de períodos futuros** sin confirmar explícitamente. | Bloquear la baja. |

## 1. Objetivo y usuarios

- **Dueño** (y Coach, D10): da de alta a las personas, les da acceso, mantiene sus datos, da
  de baja y reactiva membresías, y encuentra a cualquiera en segundos.
- **Miembro**: recibe su invitación, crea su contraseña, entra al portal y mantiene sus datos
  básicos.

Resuelve la base de los tres dolores: sin un registro único de personas no hay cobros, rutinas
ni asistencias que se puedan cruzar.

## 2. Conceptos

```
 Usuario (User)                                 Invitación (MemberInvitation)
 ┌────────────────────────────────────────┐    ┌──────────────────────────────┐
 │ identidad  nombre, apellido            │    │ token email  / token celular │
 │ contacto   email ✔?, celular ✔?        │ 1─*│ vence       +7 días          │
 │ perfil     nacimiento, peso, altura    │    │ email verificado el          │
 │ rol        owner | coach | member      │    │ celular verificado el        │
 │ acceso     contraseña (o ninguna)      │    │ completada el / revocada el  │
 │ membresía  none | active | cancelled   │    └──────────────────────────────┘
 │            desde, dada de baja el      │
 │ plan       (ver 03-membresias)         │
 │ auditoría  creado el, por quién        │
 └────────────────────────────────────────┘
```

| Concepto | Qué es |
|---|---|
| **Usuario** | Toda persona que toca el sistema. Un registro, un rol. |
| **Rol** | Dueño, Coach o Miembro. Define permisos, no si entrena. |
| **Membresía** | Atributo del usuario: nunca fue (`none`), activa, dada de baja. Independiente del rol. |
| **Acceso** | Tener contraseña y no estar bloqueado. Un usuario puede existir sin acceso (miembro invitado que todavía no completó). |
| **Verificación de contacto** | Email y celular se marcan verificados por separado: al abrir el link del canal, o a mano por el Dueño. |
| **Invitación** | Link único de 7 días que verifica canales y permite definir la contraseña. |
| **Edad** | Derivada de la fecha de nacimiento; no se guarda. |

## 3. Reglas de negocio

### 3.1 Identidad

- Una persona, un registro, un rol. El sistema no impide dos registros con el mismo nombre,
  pero **el email es único** entre los que lo tienen.
- Datos mínimos para crear: nombre, apellido, rol. Para un Miembro además email (U2) y plan.
- El resto del perfil (nacimiento, peso, altura, celular) es opcional y editable después.
- El rol lo cambia solo el Dueño. Cambiar un Miembro a Coach no le quita la membresía; cambiar
  un Coach a Miembro lo somete al bloqueo por baja.

### 3.2 Alta y acceso

Dos caminos, según el rol (D4, D10):

```
 Miembro                                   Dueño / Coach (sin cambios en este MVP)
 ───────                                   ─────────────────────────────────────
 crear (sin contraseña)                    crear con email + contraseña a mano
   │                                         │
   ├─ el Dueño verifica a mano lo que         └─ acceso inmediato
   │  ya comprobó (email y/o celular)
   │
   └─ "Invitar" → link por email
                + wa.me prellenado para WhatsApp
        │
        ├─ abre link de email   → email verificado
        ├─ abre link de WhatsApp → celular verificado
        │
        └─ ambos verificados → define contraseña → acceso
```

- Un Miembro **no puede** recibir contraseña al crearlo; solo por invitación.
- Sin celular cargado no se puede invitar. Sin email tampoco (U2).
- Un Miembro con invitación pendiente no puede loguearse aunque adivine credenciales.
- Reenviar genera un link nuevo y mata el anterior (U3).
- La ficha muestra el estado: sin acceso, invitación pendiente (con qué canal falta), acceso
  activo.

### 3.3 Membresía y baja

- Dar de baja pide fecha (puede ser retroactiva); sin fecha, es ahora. Registra quién lo hizo.
- La baja **no borra nada**: pagos, asistencias, rutinas y asignaciones quedan.
- Efecto por rol: `member` pierde el login; Coach o Dueño con membresía lo conservan.
- Con la membresía dada de baja no se registran pagos, check-ins ni asignaciones nuevas.
- Reactivar restaura el acceso del `member` y vuelve a habilitar pagos y check-in. La fecha de
  inicio de membresía original se conserva.
- **No hay eliminación física** de usuarios. Nunca.

### 3.4 Listado y búsqueda

- Un solo listado de Usuarios para todos los roles, con búsqueda por nombre, email o celular,
  y filtros por rol y estado de membresía.
- Cada fila: nombre, rol, plan, contacto (email si hay, si no celular), fecha de comienzo,
  semáforo de cuota. Sin identificadores técnicos visibles.
- Orden por nombre por defecto; también por fecha de alta y de comienzo.
- Búsqueda global (Spotlight) reutiliza la misma búsqueda.

## 4. Flujos principales

1. **Alta de miembro.** Usuarios → Nuevo → nombre, apellido, email, celular, plan → crear →
   la ficha ofrece "Invitar".
2. **Invitar.** Ficha → Invitar → modal con el link de email (copiar) y el botón de WhatsApp
   → el Dueño lo manda desde su WhatsApp. Estado pasa a "invitación pendiente".
3. **Aceptar invitación (Miembro).** Abre el link → ve qué canal quedó verificado y cuál
   falta → con ambos, define contraseña → entra al portal.
4. **Verificar a mano.** Ficha → Verificar contacto → el Dueño marca email y/o celular que ya
   comprobó (lo vio en persona). Reduce lo que el miembro tiene que hacer.
5. **Editar.** Ficha → Editar → perfil, contacto, rol (solo Dueño).
6. **Dar de baja / reactivar.** Ficha → Dar de baja → fecha, confirmación → semáforo rojo.
   Reactivar deshace el bloqueo.
7. **Resetear acceso (U5).** Ficha → Resetear acceso → mismo mecanismo de invitación, para un
   miembro que olvidó su contraseña.
8. **Mi perfil (Miembro, U4).** Portal → Mi perfil → peso, altura, celular. Un cambio de
   celular vuelve a ponerlo como no verificado.

## 5. Estado actual en el código

| Qué | Cómo está hoy | Spec |
|---|---|---|
| Registro único con rol y membresía como atributo | Implementado (`User`, `unify-clients-into-users`). | `user-management` |
| Perfil: nombre, apellido, nacimiento, peso, altura, email, celular; edad derivada | Implementado. | `user-management` |
| Alta por rol: Miembro sin contraseña, staff con contraseña | Implementado. | `user-management`, `member-invitation` |
| Invitación por link, doble verificación, 7 días, reenvío, wa.me | Implementado, solo para rol Miembro. | `member-invitation` |
| Verificación manual de contacto por el Dueño | Implementado. | `member-invitation` |
| Baja con fecha, sin borrado, bloqueo según rol, reactivación | Implementado. | `user-management` |
| Listado único con búsqueda, filtros rol/membresía, semáforo | Implementado. | `user-management`, `payment-status-indicator` |
| Acciones desde la ficha en diálogos (editar, baja, reactivar, invitar, verificar) | Implementado. | `move-user-actions-to-detail` (archivado) |
| Plan del miembro en alta, ficha y listado | **No existe** (M2 de membresías). | — |
| Email obligatorio para Miembro (U2) | Hoy opcional; la falta se detecta recién al invitar. | — |
| Perfil propio del Miembro (U4) | No existe; solo puede cambiar su tema. | `session-state` |
| Resetear acceso (U5) | No existe. Un Dueño puede escribir una contraseña a mano por PATCH. | — |
| Página "Nuevo coach" separada | Existe, duplica el diálogo de alta. Retirarla es post-MVP (P6). | — |
| Envío real del email de invitación | Implementado con SMTP estándar, pero el modo por defecto es `log` (deja el link en un archivo, no manda nada). Producción necesita `NOTIFICATIONS_BACKEND=smtp` y credenciales en Railway; confirmar que están cargadas. | `member-invitation` |

## 6. Brecha MVP

| # | Brecha | Depende de | Prioridad |
|---|---|---|---|
| U-1 | Plan obligatorio en el alta de Miembro, visible en ficha y listado. | M1 de membresías | Alta |
| U-2 | Email obligatorio al crear un Miembro, con mensaje claro (U2). | — | Alta, chica |
| U-3 | Configurar SMTP en producción (variables en Railway) y verificar que el email de invitación llega. | — | Alta: sin esto la invitación depende de WhatsApp. |
| U-4 | Resetear acceso desde la ficha (U5). | — | Media |
| U-5 | Mi perfil en el portal del Miembro (U4). | — | Media |
| U-6 | Confirmación al dar de baja un miembro con pagos futuros (U6). | — | Baja |
| U-7 | Retirar `NewCoach`, invitación para staff, recorte del Coach. | — | Post-MVP (P6) |

## 7. Fuera de alcance

- Autoregistro libre del miembro (se retiró a propósito; el alta la inicia siempre el staff).
- "Olvidé mi contraseña" autoservicio (U5).
- Roles adicionales o permisos personalizados.
- Foto de perfil, documento de identidad, datos de facturación.
- Importación masiva de miembros desde planilla.
- Eliminación física de usuarios o anonimización.
