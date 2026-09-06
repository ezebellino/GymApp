# Gym App · Visión y alcance del MVP

Documento de producto. Define qué es el MVP de Gym App, para quién, qué incluye y qué no,
y cuándo se considera listo. Los documentos por módulo (`02` a `07`) detallan cada área; las
specs de OpenSpec (`openspec/specs/`) siguen siendo la fuente de verdad del comportamiento fino.

Última revisión: 2026-09-06.

---

## 1. Qué es

Gym App es el sistema de gestión de **un** gimnasio: quiénes son sus miembros, qué
membresía pagan y si están al día, qué rutina entrenan, cuándo asisten, y un panel que le
resume al dueño lo relevante del momento. Es una app web responsive con dos caras:

- **Gestión** (Dueño y Coach): operan el gimnasio desde el escritorio o el celular.
- **Portal del miembro**: el miembro entra con su usuario, ve su rutina y registra lo que
  entrena.

Es single-tenant: una instalación, un gimnasio. Multi-gimnasio queda fuera del MVP.

## 2. Problema que resuelve

Hoy un gimnasio chico lleva miembros, cobros y rutinas en planillas, cuadernos o WhatsApp.
Eso produce tres dolores concretos:

1. **No se sabe quién debe.** La mora se detecta tarde y de memoria.
2. **La rutina vive en un papel.** El coach la arma a mano, el miembro la pierde y nadie ve
   el progreso.
3. **No hay foto del día.** El dueño no tiene un lugar que le diga cuántos entraron, cuánto
   se cobró y quién venció.

El MVP ataca los tres con el menor recorte de producto que los resuelve de punta a punta.

## 3. Usuarios

| Rol | Quién es | Qué necesita del sistema |
|---|---|---|
| **Dueño** (`owner`) | Responsable del gimnasio. Puede haber más de uno. | Todo: usuarios, membresías, cobros, rutinas, asistencias, configuración, panel. |
| **Coach** (`coach`) | Entrenador del staff. | Hoy hace casi lo mismo que el Dueño. **En este MVP conserva lo que ya tiene**; su recorte propio queda para después (D10). |
| **Miembro** (`member`) | Quien entrena y paga. | Ver su rutina, registrar sus series, ver su asistencia y su estado de cuota. |

"Admin" y "Dueño" son la misma cosa. En código y en UI el rol se llama **Owner / Dueño**;
no existe un rol Admin separado. Ser miembro del gimnasio (tener membresía) es un atributo
independiente del rol: un Coach puede además entrenar y pagar cuota (ver
[01-roles-y-permisos.md](01-roles-y-permisos.md)).

## 4. Alcance del MVP

Seis módulos más el portal del miembro como capa transversal.

```
                       ┌──────────────────────────────┐
                       │  06 Dashboard (Seguimiento)   │  síntesis del momento + reportes
                       └──────────────┬───────────────┘
                                      │ lee de
   ┌──────────────┬──────────────┬────┴─────────┬──────────────┐
   │ 01 Usuarios  │ 02 Membresías│ 03 Rutinas   │ 04 Asistencias│
   │  y roles     │  y pagos     │  y ejercicios│              │
   └──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┘
          │              │              │              │
          └──────────────┴──────┬───────┴──────────────┘
                                │ configurado por
                       ┌────────┴─────────┐
                       │ 05 Configuración │
                       └──────────────────┘

   Portal del miembro = la cara "member" de 02, 03 y 04.
```

| # | Módulo | Documento | Resumen del alcance MVP |
|---|---|---|---|
| 1 | Gestión de usuarios y roles | [02-usuarios.md](02-usuarios.md) | Un registro por persona con rol Dueño/Coach/Miembro. Alta por el Dueño (o Coach para miembros), verificación de email y celular, link de invitación para crear contraseña. Baja lógica, sin borrado físico. |
| 2 | Membresías y pagos | [03-membresias-y-pagos.md](03-membresias-y-pagos.md) | CRUD de **planes de membresía** con precio (general, socio del club, jubilado, estudiante, etc.). Cada miembro tiene un plan asignado. Registro de pagos por período con el precio vigente al momento del pago. Historial de precios: cambiar el precio de un plan no altera pagos anteriores. Semáforo al día / en mora / de baja. |
| 3 | Rutinas y ejercicios | [04-rutinas.md](04-rutinas.md) | CRUD de ejercicios con descripción, video o GIF, grupo muscular y tipo de entrenamiento. Plantillas con nombre, tipo y días propios; cada día planifica grupos musculares y lleva ejercicios con series explícitas (reps · kg). Asignación a miembros (activa / alternativa). El miembro entrena la sesión, ajusta kilos y marca series; su progresión de peso se trackea. |
| 4 | Asistencias | [05-asistencias.md](05-asistencias.md) | El Dueño marca la asistencia del miembro desde esta app, por búsqueda de nombre, email o teléfono. Historial y calendario por miembro. Solo miembros con membresía activa. El auto check-in del miembro es del MVP móvil; acá solo se deja lista la API. |
| 5 | Configuración del gimnasio | [06-configuracion.md](06-configuracion.md) | Identidad (nombre, contacto, dirección, horarios), medios de pago habilitados, mensaje operativo. Exclusiva del Dueño. |
| 6 | Dashboard | [07-dashboard.md](07-dashboard.md) | Un solo panel con bloques condicionados por rol: hoy (check-ins, en sala), cobros (al día, vencidos, ingresos del mes) y **absorbe la vista Reportes** (series de ingresos, asistencia y altas por rango). |

## 5. Decisiones de alcance tomadas

Registro de las decisiones de producto que condicionan los seis documentos. Fecha: 2026-09-06.

| # | Tema | Decisión |
|---|---|---|
| D1 | Admin vs Dueño | Mismo rol. Se mantiene el nombre **Owner / Dueño**. No hay rol Admin. |
| D2 | Modelo de cuota | Hay **planes de membresía** distintos (CRUD), cada miembro tiene uno asignado. El precio de un plan puede cambiar; los pagos guardan el monto pagado y el plan/precio vigente en ese momento, así el historial no se pierde ni se reescribe. |
| D3 | Recordatorios de pago | **Fuera del MVP.** Solo el indicador de estado en pantalla. Los campos de recordatorio existentes en configuración se deprecan. |
| D4 | Alta y acceso | El Dueño crea el usuario. Puede verificar email y celular. El sistema envía un link con el que la persona crea su contraseña y accede. (El Coach puede hacerlo para miembros.) |
| D5 | Check-in | El miembro hará su propio check-in **desde la app móvil** (MVP aparte, D9). En esta app web el **Dueño** marca la asistencia. La API de este MVP debe dejar el endpoint de auto check-in listo para que la app móvil lo consuma. |
| D6 | Dashboard | **Uno solo**, con bloques condicionales por rol. |
| D7 | Reportes | La vista Reportes **desaparece como módulo**; el Dashboard absorbe su funcionalidad. |
| D8 | Rutinas | Lo implementado en `add-routine-templates` es el piso. Encima: CRUD de ejercicios con video, días propios por plantilla con grupos musculares, series explícitas en vez de derivadas por estrategia, y sesión del miembro con progresión de peso. Detalle en `04-rutinas.md`. |
| D9 | App móvil | **Fuera.** Tiene su propio MVP (`openspec/changes/add-expo-mobile-app`). El portal web responsive es la cara del miembro en este MVP. |
| D10 | Rol Coach | Coach y Dueño hacen hoy casi lo mismo. **El MVP avanza con Dueño y Miembro.** El Coach conserva los permisos que ya tiene en el código; definir su recorte propio es un gap posterior al MVP. |

## 6. Fuera de alcance explícito

- Recordatorios de cobro por WhatsApp, email o cualquier canal (D3).
- App móvil nativa (D9).
- Auto check-in del miembro desde esta app web, QR, control de acceso físico. El auto check-in
  lo cubre el MVP móvil; este MVP solo garantiza el endpoint (D5).
- Recorte de permisos propio del rol Coach (D10).
- Multi-gimnasio / multi-sede.
- Cobro online (pasarelas de pago, débito automático). El pago se registra a mano.
- Integración con API de WhatsApp Business. Donde exista, WhatsApp es un link `wa.me` que
  abre el WhatsApp del staff.
- Clases grupales, turnos y cupos.
- Nutrición, mediciones corporales más allá de peso y altura.

## 7. Qué hay que deprecar o corregir del código actual

El código llegó hasta acá por iteraciones y hay piezas que contradicen las decisiones de
arriba. Esta lista se convierte en changes de OpenSpec; acá solo queda el inventario.

| Qué | Dónde | Por qué | Decisión |
|---|---|---|---|
| Tarifa única global (`default_fee`) y `late_fee_grace_days` | `AppSettings` | Contradice D2: la cuota es por plan, no global. | Reemplazar por planes de membresía. Evaluar si la gracia sigue teniendo sentido a nivel gimnasio. |
| Mensaje y fecha de último recordatorio de pago | `AppSettings.payment_reminder_*` | D3: sin recordatorios. | Deprecar campos y UI asociada. |
| Vista **Reportes** como página y sección de navegación | `frontend/src/pages/Reports.tsx`, `/reports` | D7. | Mover su contenido al Dashboard y retirar la ruta. |
| Rutina "legacy" por usuario (selección de días por usuario, log por ejercicio con `sets_count`), catálogo fijo de 4 días, base por ejercicio y PDF de progreso | `backend/app/routers/routines.py`, `TrainingDay`, `TrainingDayExercise`, `WorkoutLog`, `Exercise.base_*` | Contradicen el modelo de `04-rutinas.md`: días propios por plantilla, series explícitas, sesión por series. | Reemplazar según la brecha R-2 a R-9 de `04-rutinas.md`. |
| Página **Nuevo coach** con contraseña a mano | `frontend/src/pages/NewCoach.tsx` | Duplica el diálogo de alta de usuario y contradice D4 (acceso por link). | Unificar en el alta de usuario + invitación. |
| Endpoints sin verificación de sesión ni rol | `settings` (GET/PUT/PATCH), `payments` (listado y detalle), `attendance` (listado) | Cualquier request sin token los lee o escribe. | Corregir según la matriz de [01-roles-y-permisos.md](01-roles-y-permisos.md). |
| README con stack viejo (Supabase, Render, Vercel; roles "Dueño y Coach") | `README.md` | Prod corre en Railway y existe el rol Miembro. | Actualizar al cerrar el MVP. |

## 8. Criterio de "MVP listo"

El MVP está listo cuando un gimnasio real puede operar un mes completo solo con el sistema.
Concretamente, cuando todo esto es verdad y está cubierto por escenarios de spec verificados:

1. El Dueño da de alta un miembro, le asigna un plan, el miembro recibe el link, crea su
   contraseña y entra al portal.
2. El Dueño o Coach registra el pago del mes con el precio vigente del plan del miembro. El
   listado de usuarios muestra el semáforo correcto. Al mes siguiente, sin pago, pasa a mora.
3. El Dueño cambia el precio de un plan. Los pagos anteriores conservan su monto; los nuevos
   toman el precio nuevo.
4. El Dueño arma una plantilla, la asigna al miembro, y el miembro ve su plan de series en
   "Mi rutina" y registra lo que hizo.
5. El Dueño marca la asistencia del miembro; el calendario del miembro y el Dashboard lo
   reflejan. Existe el endpoint para que el miembro registre su propio check-in desde la app
   móvil, aunque esta app web no lo exponga.
6. El Dueño ve en el Dashboard, sin ir a otra pantalla: check-ins de hoy, cobros al día y
   vencidos, ingresos del mes y la evolución por rango.
7. El Dueño edita nombre, contacto, horarios y medios de pago del gimnasio, y toda la app lo
   refleja.
8. Ningún endpoint responde sin sesión, y ningún rol puede hacer lo que la matriz de permisos
   le niega.

## 9. Cómo se usa este conjunto de documentos

- Estos docs dicen **qué** hace el producto y **por qué**, a nivel módulo.
- Cada brecha listada en un doc de módulo nace como change con `/opsx:propose`. El change
  escribe o modifica specs en `openspec/specs/`, que son la verdad del comportamiento fino
  (requirements + escenarios).
- Cuando un change se archiva, el doc del módulo actualiza su sección "Estado actual" y tacha
  la brecha. No se copian escenarios a estos docs: se linkea la spec.
- [09-backlog-mvp.md](09-backlog-mvp.md) es la lista priorizada de brechas de todos los
  módulos, con su change asociado cuando existe.
