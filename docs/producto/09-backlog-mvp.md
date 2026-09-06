# Backlog del MVP

Todas las brechas de los documentos 01 a 07, consolidadas y ordenadas en fases. Cada ítem se
convierte en un change de OpenSpec (`/opsx:propose`); la columna Change se completa cuando
existe. Cuando un change se archiva, el ítem se tacha acá y en su doc de módulo.

Última revisión: 2026-09-06.

---

## Fases

El orden respeta las dependencias entre módulos: primero seguridad y cerrar lo que está a
medias, después el concepto nuevo más grande (planes), después rutinas, después el portal, y
al final el Dashboard que junta todo.

```
 Fase 0            Fase 1              Fase 2              Fase 3            Fase 4          Fase 5
 Cerrar y          Membresías          Rutinas             Portal del        Dashboard       Limpieza
 asegurar          y planes                                miembro
 ─────────         ─────────           ─────────           ─────────         ─────────       ─────────
 P1 sesión en      M1 planes +         R-2 catálogo        M6 Mi cuota       DB-2 Cobros     M5 deprecar
    endpoints         historial           de ejercicios    U-5 Mi perfil     DB-3 Evolución     cuota base
 R-1 archivar      M2 plan del         R-3 días propios    U-4 resetear      DB-4 Hoy        C-2 deprecar
    plantillas        miembro          R-4 series             acceso         A-7 actividad      ajustes
 DB-1 KPI fijo     M3 pago con         R-5 carga actual    A-3 Mis           DB-5 spec       R-9 PDF
 U-2 email            precio           R-6 sesión             asistencias                    README
    obligatorio    U-1 plan en alta    A-2 auto check-in   C-3 El gimnasio
 U-3 SMTP prod                            (API)            R-7 Mi progreso
```

## Fase 0 · Cerrar y asegurar

| # | Ítem | Módulo | Depende de | Change |
|---|---|---|---|---|
| P1 | Configuración, pagos y asistencias exigen sesión y rol (agrupa M4, A-1, C-1) | 02, 04, 05 | — | |
| R-1 | Verificar y archivar `add-routine-templates` tal como está | 04 | — | `add-routine-templates` (verificar + archivar) |
| DB-1 | Retirar el KPI fijo "Rutina base 4 días" | 07 | — | |
| U-2 | Email obligatorio al crear un Miembro | 02 | — | |
| U-3 | SMTP configurado en Railway; el email de invitación llega | 02 | — | operativo, sin change |

## Fase 1 · Membresías y planes

| # | Ítem | Módulo | Depende de | Change |
|---|---|---|---|---|
| M1 | Planes de membresía con historial de precios; migración crea "General" desde la cuota base | 03 | — | |
| M2 | Plan del miembro: cambio desde la ficha, visible en listado y ficha | 03 | M1 | |
| U-1 | Plan obligatorio en el alta de Miembro | 02 | M1 | (mismo change que M2) |
| M3 | El pago precarga el precio del plan y guarda plan y precio de referencia | 03 | M2 | |
| M7 | Filtro por estado de cuota en Usuarios | 03 | M3 | |

## Fase 2 · Rutinas

| # | Ítem | Módulo | Depende de | Change |
|---|---|---|---|---|
| R-2 | Catálogo de ejercicios: pantalla de alta, video/GIF por URL, grupo de lista fija, tipos, desactivación; deprecar base | 04 | R-1 | |
| R-3 | Días propios por plantilla con grupos musculares; retirar catálogo fijo de días; migración | 04 | R-1 | |
| R-4 | Editor de series explícitas; estrategias como generador opcional; tipo de plantilla | 04 | R-3 | |
| R-5 | Carga actual por miembro y serie; edición por el Dueño | 04 | R-4 | |
| R-6 | Sesión del miembro: día, video, kg/reps, marcar, finalizar; reemplaza `WorkoutLog` y selección de días | 04 | R-5 | |
| A-2 | Endpoint de auto check-in del miembro (sin UI web); registrar siempre quién hizo el check-in | 05 | — | |
| A-4 | Un check-in por día con aviso de duplicado | 05 | — | (mismo change que A-2) |

## Fase 3 · Portal del miembro

| # | Ítem | Módulo | Depende de | Change |
|---|---|---|---|---|
| M6 | Mi cuota: plan, estado, historial, cómo pagar | 03 | M3 | |
| C-3 | Sección "El gimnasio" en el portal; alias en Mi cuota | 06 | M6 | (mismo change que M6) |
| A-3 | Mis asistencias: calendario y racha | 05 | — | |
| R-7 | Mi progreso y seguimiento en la ficha: kilo máximo por semana, récords, sesiones, racha, "+kg vs. anterior" | 04 | R-6 | |
| U-4 | Resetear acceso desde la ficha | 02 | — | |
| U-5 | Mi perfil: peso, altura, celular | 02 | — | |

## Fase 4 · Dashboard

| # | Ítem | Módulo | Depende de | Change |
|---|---|---|---|---|
| DB-2 | Bloque Cobros: al día / en mora, morosos con plan y último período, ingresos del mes por método | 07 | M3 | |
| DB-3 | Absorber Reportes en Evolución; retirar `/reports`; habilitar al Coach | 07 | — | |
| DB-4 | Bloque Hoy: en sala, sesiones completadas, Actividad de hoy (agrupa A-7, R-8) | 07 | R-6, A-2 | |
| DB-5 | Reescribir la spec `dashboard-view` para que describa qué muestra | 07 | DB-2..4 | (parte de cada change) |
| A-5 | Aviso de mora al registrar check-in | 05 | M3 | |

## Fase 5 · Limpieza

| # | Ítem | Módulo | Depende de | Change |
|---|---|---|---|---|
| M5 | Deprecar cuota base, días de gracia y recordatorios: modelo, API y Ajustes (agrupa C-2) | 03, 06 | M3 | |
| C-4 | Validar al menos un medio de pago habilitado | 06 | — | (mismo change que M5) |
| C-5 | Link a Planes desde Ajustes | 06 | M1 | (mismo change que M5) |
| R-9 | Retirar PDF y resumen viejo de progreso | 04 | R-7 | |
| A-6 | Borrar check-in del día, solo Dueño, con auditoría | 05 | — | |
| U-6 | Confirmación al dar de baja con pagos futuros | 02 | — | |
| — | Actualizar README: stack (Railway), roles, módulos | — | — | sin change |

## Post-MVP

| # | Ítem | Origen |
|---|---|---|
| P6 | Recorte propio del rol Coach; invitación por link para staff; retirar `NewCoach` | 01 (D10) |
| — | App móvil: auto check-in con QR o ubicación, Mi rutina nativa | `add-expo-mobile-app` (D9) |
| — | Recordatorios de cobro | D3 |
| — | Subida de video/imagen para ejercicios, catálogos administrables de grupos y tipos | 04 (R1, R2) |
| — | Planes no mensuales, pagos parciales, prorrateo | 03 (S1, S5) |
| — | Exportación del Dashboard | 07 (D-6) |

## Supuestos pendientes de confirmar

Cada doc abre con sus supuestos. Mientras no se confirmen, la implementación los toma como
válidos. Resumen:

| Doc | Supuestos | Los que más cambian el trabajo |
|---|---|---|
| 02 Usuarios | U1–U6 | U2 email obligatorio · U5 resetear acceso sin autoservicio |
| 03 Membresías | S1–S7 | S2 mora sin gracia · S3 monto editable y referencia al registrar · S5 sin prorrateo |
| 04 Rutinas | R1–R9 | R1 video por URL · R4 asignación en vivo, no copia · R7 estrategias como generador |
| 05 Asistencias | A1–A5 | A1 uno por día · A3 moroso puede entrar con aviso |
| 06 Configuración | C1–C5 | C3 planes viven en Pagos |
| 07 Dashboard | D-1–D-6 | D-2 Reportes se retira · D-4 ingresos por fecha de registro |
