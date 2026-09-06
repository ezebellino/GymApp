# Roles y permisos

Fuente única de quién puede hacer qué en Gym App. El backend (`require_role`,
`require_can_manage_user`) y la navegación del frontend (`navItemsForRole`) deben reflejar
esta matriz; donde hoy no lo hacen, la columna "Hoy en código" lo marca y la brecha va al
backlog.

**Foco del MVP (D10): Dueño y Miembro.** El Coach hoy hace casi lo mismo que el Dueño y en
este MVP conserva exactamente lo que ya tiene en el código. La columna Coach documenta ese
estado para que nadie lo rompa sin querer; su recorte propio se define después del MVP.

Última revisión: 2026-09-06. Ver decisiones D1, D4, D5 y D10 en [00-vision-mvp.md](00-vision-mvp.md).

---

## 1. Los tres roles

| Rol | Código | Descripción | Cómo obtiene acceso |
|---|---|---|---|
| **Dueño** | `owner` | Administra el gimnasio. Puede haber varios. | Lo crea otro Dueño con contraseña a mano (hoy). Objetivo: link de invitación, ver §5. |
| **Coach** | `coach` | Staff. En este MVP equivale al Dueño salvo lo marcado en la matriz. | Lo crea un Dueño con contraseña a mano. Sin cambios en este MVP. |
| **Miembro** | `member` | Quien entrena y paga la cuota. Usa el portal web y, más adelante, la app móvil. | Lo crea un Dueño (o Coach). Verifica email y celular, recibe link y crea su contraseña. |

Reglas de base:

- **Una persona, un registro, un rol.** No hay usuarios con dos roles.
- **Membresía ≠ rol.** Tener membresía activa es un atributo del usuario. Un Coach o Dueño
  puede además ser miembro (paga cuota, hace check-in, tiene rutina) sin perder su rol.
- **Baja lógica.** No se borran usuarios. Dar de baja la membresía de un `member` le bloquea
  el login; dar de baja la membresía de un Coach o Dueño no le toca el acceso.
- **Jerarquía de gestión.** El Dueño gestiona a cualquier rol. El Coach solo crea y edita
  usuarios de rol Miembro, y no puede cambiarle el rol a otra cosa. El Miembro no gestiona a
  nadie. Es la única diferencia Dueño/Coach que el código aplica hoy de forma consistente.

## 2. Matriz de permisos por módulo

Leyenda: ✅ puede · 👤 solo sobre sí mismo · 📱 desde la app móvil (MVP aparte) · ❌ no puede.
La columna **Hoy** marca dónde el código actual difiere de lo que el MVP define. Vacía =
coincide.

### 2.1 Usuarios

| Acción | Dueño | Coach | Miembro | Hoy en código |
|---|---|---|---|---|
| Listar usuarios y ver ficha | ✅ | ✅ | ❌ | |
| Crear usuario rol Miembro | ✅ | ✅ | ❌ | |
| Crear usuario rol Coach o Dueño | ✅ | ❌ | ❌ | Con contraseña a mano. Pasarlo a invitación queda post-MVP (§5). |
| Editar datos personales | ✅ | ✅ solo Miembros | 👤 | El Miembro hoy solo puede cambiar su tema; edición del propio perfil no existe. A definir en `02-usuarios.md`. |
| Cambiar rol | ✅ | ❌ | ❌ | |
| Verificar email / celular a mano | ✅ | ✅ solo Miembros | ❌ | |
| Disparar o reenviar invitación | ✅ | ✅ solo Miembros | ❌ | Solo existe para rol Miembro. |
| Activar / dar de baja membresía | ✅ | ✅ solo Miembros | ❌ | |
| Eliminar usuario | ❌ | ❌ | ❌ | No existe, y no debe existir. |

### 2.2 Membresías y pagos

| Acción | Dueño | Coach | Miembro | Hoy en código |
|---|---|---|---|---|
| Crear / editar / desactivar planes de membresía | ✅ | ✅ (hereda, D10) | ❌ | No existe el concepto de plan (D2). |
| Asignar plan a un miembro | ✅ | ✅ | ❌ | No existe. |
| Registrar pago | ✅ | ✅ | ❌ | |
| Ver pagos de un miembro | ✅ | ✅ | 👤 | **Sin verificación de sesión**: el listado y el detalle de pagos responden sin token. El Miembro no tiene vista de sus pagos. |
| Anular pago | ✅ | ❌ | ❌ | |
| Ver estado de cuota (semáforo) | ✅ | ✅ | 👤 | El Miembro no lo ve en el portal. |

### 2.3 Rutinas y ejercicios

| Acción | Dueño | Coach | Miembro | Hoy en código |
|---|---|---|---|---|
| Ver catálogo de ejercicios | ✅ | ✅ | 👤 los de su rutina | |
| Crear / editar / desactivar ejercicio del catálogo | ✅ | ❌ | ❌ | Sin pantalla de alta; sin video ni tipos. |
| Crear / editar / eliminar plantilla | ✅ | ✅ | ❌ | |
| Activar ejercicios y elegir estrategia por plantilla | ✅ | ✅ | ❌ | |
| Asignar plantilla a un miembro, ajustar base por miembro | ✅ | ✅ | ❌ | |
| Ver plantillas asignadas y plan de series | ✅ | ✅ | 👤 | |
| Registrar una sesión (series con kg y reps) | ✅ por el miembro | ✅ por el miembro | 👤 | Hoy el log es por ejercicio, no por serie; lo reemplaza la sesión de `04-rutinas.md`. |
| Ajustar la carga actual de un miembro | ✅ | ✅ | 👤 en cada sesión | Existe como override de base por ejercicio, no por serie. |
| Ver progreso de un miembro | ✅ | ✅ | 👤 | Existe resumen y PDF; la vista "Mi progreso" del portal no existe. |

### 2.4 Asistencias

| Acción | Dueño | Coach | Miembro | Hoy en código |
|---|---|---|---|---|
| Marcar asistencia de un miembro | ✅ | ✅ | ❌ | |
| Registrar el propio check-in | ❌ | ❌ | 📱 | **No existe el endpoint.** Lo necesita el MVP móvil; este MVP lo deja listo en la API sin exponerlo en la web (D5). |
| Ver historial de asistencias | ✅ | ✅ | 👤 | **Sin verificación de sesión** en el listado. El Miembro no tiene vista propia. |
| Borrar un check-in | ✅ | ❌ | ❌ | No existe; a definir si el MVP lo necesita. |

### 2.5 Configuración del gimnasio

| Acción | Dueño | Coach | Miembro | Hoy en código |
|---|---|---|---|---|
| Ver configuración pública (nombre, contacto, medios de pago) | ✅ | ✅ | ✅ | El frontend la usa para la marca en toda la app. |
| Editar configuración | ✅ | ✅ (hereda, D10) | ❌ | **Sin verificación de sesión ni rol**: GET/PUT/PATCH responden sin token. |

### 2.6 Dashboard (Seguimiento)

Un solo dashboard con bloques condicionales (D6, D7). Mientras el Coach herede lo del Dueño
(D10), ambos ven los mismos bloques; el condicional que importa en este MVP es Miembro vs
staff.

| Bloque | Dueño | Coach | Miembro | Hoy en código |
|---|---|---|---|---|
| Hoy: check-ins, quién está en sala | ✅ | ✅ | ❌ | |
| Cobros: al día / vencidos, seguimiento por miembro | ✅ | ✅ | ❌ | |
| Ingresos: totales, por método, evolución por rango | ✅ | ✅ | ❌ | |
| Altas y asistencia por rango (ex Reportes) | ✅ | ✅ | ❌ | Vive en `/reports`, hoy solo Dueño. Al absorberlo el Dashboard, el Coach lo ve como el resto. |

## 3. Navegación por rol

Lo que cada rol ve en el menú lateral y en el menú mobile. Es consecuencia de la matriz, no
una regla aparte.

```
 Dueño / Coach            Miembro
 ─────────────            ─────────────
 Seguimiento              Mi rutina
 Usuarios                 Mi progreso      (nuevo)
 Pagos                    Mis asistencias  (nuevo)
 Rutinas                  Mi cuota         (nuevo, a definir)
 Asistencias
 Ajustes
 ── Reportes se retira: lo absorbe Seguimiento (D7)
```

## 4. Efecto del estado de membresía

| Estado de membresía | Miembro (`member`) | Coach / Dueño con membresía |
|---|---|---|
| Nunca fue miembro (`none`) | No aplica: un `member` siempre nace con membresía activa. | Acceso normal. Sin rutina, pagos ni check-in. |
| Activa | Acceso al portal. Puede recibir pagos, check-in y plantillas. | Idem, más su rol. |
| Dada de baja (`cancelled`) | **Login bloqueado.** Conserva historial. No recibe pagos ni check-in ni asignaciones nuevas; las asignaciones que ya tenía se conservan. | Conserva acceso y rol. Deja de recibir pagos, check-in y asignaciones nuevas. |
| Reactivada | Recupera el acceso. | Vuelve a recibir pagos y check-in. |

Indicador visual en el listado de usuarios: verde al día, amarillo en mora, rojo de baja.
Se calcula en tiempo real a partir del último pago y el estado (ver
`openspec/specs/payment-status-indicator/spec.md`).

## 5. Alta y acceso (D4)

Flujo del MVP para el **Miembro**, que es el usuario que el sistema da de alta todos los días:

```
 Dueño (o Coach)
   │ crea el usuario con nombre, rol Miembro, email, celular
   ▼
 Usuario sin contraseña ── el Dueño puede marcar email y/o celular como verificados a mano
   │ "Invitar"
   ▼
 Link único (por email, y wa.me prellenado para mandar por WhatsApp)
   │ la persona abre el link → verifica el canal que faltaba
   ▼
 Define contraseña ── recién con ambos canales verificados
   │
   ▼
 Login habilitado
```

Este flujo ya existe (`member-invitation`). Dueño y Coach se siguen creando con contraseña a
mano por un Dueño; unificarlos en la invitación queda post-MVP junto con el recorte del Coach
(D10), y ahí se decide si al staff le alcanza con verificar email.

Falta en el MVP: **recuperar contraseña**. Hoy no hay forma de resetearla sin que un Dueño la
escriba a mano. Propuesta: reutilizar el mismo mecanismo de link.

## 6. Brechas de este documento para el backlog

| # | Brecha | Módulo | Prioridad |
|---|---|---|---|
| P1 | Endpoints de configuración, pagos y asistencias sin verificación de sesión | 05, 02, 04 | Alta: es seguridad. |
| P2 | Endpoint de auto check-in del miembro (API lista para la app móvil, sin UI web) | 04 | Media: lo necesita el MVP móvil. |
| P3 | Recuperar contraseña | 01 | Media. |
| P4 | Vistas propias del Miembro: mi cuota, mis asistencias | 02, 04 | Media, define el valor del portal. |
| P5 | Edición del propio perfil por el Miembro (peso, altura, contacto) | 01 | Baja. |
| P6 | Recorte propio del rol Coach, invitación por link para staff, retirar `NewCoach` | 01 | Post-MVP (D10). |
