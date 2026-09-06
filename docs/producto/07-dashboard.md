# Dashboard (Seguimiento)

Módulo 6 del MVP. Un solo panel para el staff que resume lo relevante del momento y absorbe la
vista Reportes (decisiones D6 y D7). Se alimenta de los otros cinco módulos; no tiene reglas de
negocio propias más allá de cómo agrupa y presenta.

Última revisión: 2026-09-06. Estado: borrador 1, con supuestos a confirmar.

---

## 0. Supuestos a confirmar

| # | Supuesto | Alternativa descartada |
|---|---|---|
| D-1 | El Dashboard es **solo del staff**. El Miembro aterriza en "Mi rutina"; no tiene dashboard propio en el MVP. | Home del miembro con resumen. |
| D-2 | La ruta Reportes **se retira**. Sus gráficos por rango pasan a una sección "Evolución" del Dashboard con selector de rango y granularidad (día / semana / mes). | Mantener Reportes como pestaña. |
| D-3 | El orden de los bloques es por urgencia: **Hoy → Cobros → Evolución**. | Configurable. |
| D-4 | **Ingresos** = pagos registrados en el rango por fecha de registro (caja), no por período cubierto. | Por período. |
| D-5 | "Mes" = mes calendario actual, hora local Argentina. | Últimos 30 días. |
| D-6 | Sin exportar a CSV o PDF en el MVP. | Exportación. |

## 1. Objetivo y usuarios

- **Dueño** (y Coach, D10): abre la app y en una pantalla sabe quién vino hoy, quién está en
  sala, quién debe, cuánto entró este mes y cómo viene la tendencia. Desde ahí hace las dos
  acciones más frecuentes: check-in y pago.

Resuelve el dolor 3 de la visión.

## 2. Bloques

```
 ┌─ HOY ──────────────────────────────────────────────────────────────┐
 │ Check-ins hoy  ·  En sala  ·  Sesiones completadas hoy             │
 │ [Check-in rápido] [Pago rápido] [Nuevo miembro]                    │
 │ Actividad de hoy                                                    │
 │  Miembro · Hora · Plantilla · Día · Estado (Completó/En sala/Sin registro) │
 └────────────────────────────────────────────────────────────────────┘
 ┌─ COBROS ───────────────────────────────────────────────────────────┐
 │ Miembros activos · Al día · En mora · Ingresos del mes · por método │
 │ Morosos: Miembro · Plan · Último período pagado · [Registrar pago]  │
 │ Pagos recientes                                                     │
 └────────────────────────────────────────────────────────────────────┘
 ┌─ EVOLUCIÓN (ex Reportes) ──────────────────────────────────────────┐
 │ Rango [desde – hasta]  Granularidad [día|semana|mes]                │
 │ Ingresos ▁▃▅▇ · Asistencias ▁▃▅▇ · Altas de miembros ▁▃▅▇          │
 │ Detalle de check-ins del rango                                      │
 └────────────────────────────────────────────────────────────────────┘
```

| Bloque | Indicador | Fuente | Regla |
|---|---|---|---|
| Hoy | Check-ins de hoy | 05 | Cantidad de check-ins del día local. |
| Hoy | En sala | 05 + 04 | Check-in hace menos de 2 h sin sesión finalizada (A5). |
| Hoy | Sesiones completadas hoy | 04 | Sesiones finalizadas hoy. |
| Hoy | Actividad de hoy | 05 + 04 | Una fila por miembro con check-in hoy: hora, plantilla y día de la sesión si la hay, estado. |
| Cobros | Miembros activos | 01 | Membresía activa. |
| Cobros | Al día / En mora | 02 | Semáforo de `payment-status-indicator`. |
| Cobros | Ingresos del mes, por método | 02 | Suma de pagos registrados en el mes (D-4, D-5). |
| Cobros | Morosos | 02 | Lista con plan y último período pagado, acción directa de pago. |
| Cobros | Pagos recientes | 02 | Últimos pagos registrados. |
| Evolución | Ingresos, asistencias, altas por bucket | 02, 05, 01 | Rango y granularidad elegidos; lo que hoy hace Reportes. |

## 3. Reglas

- Todo se recalcula con datos vivos: registrar un pago o un check-in desde el Dashboard
  actualiza los indicadores sin recargar (caché compartida, `server-data-cache`).
- Dueño y Coach ven lo mismo (D10). El Miembro no accede.
- Cada bloque carga y falla por separado: un error en Evolución no rompe Hoy.
- Sin indicadores fijos ni decorativos: cada número sale de un dato real.

## 4. Flujos principales

1. **Abrir el día.** Login → Dashboard → Hoy muestra quién vino; Cobros muestra quién debe.
2. **Cobrar a un moroso.** Cobros → fila del moroso → Registrar pago → el semáforo y los
   totales cambian al instante.
3. **Check-in rápido.** Hoy → buscar → registrar → aparece en Actividad de hoy.
4. **Mirar la tendencia.** Evolución → rango último trimestre, granularidad semana → ingresos,
   asistencias y altas.

## 5. Estado actual en el código

| Qué | Cómo está hoy | Spec |
|---|---|---|
| KPIs | Clientes activos, **"Rutina base 4 días" (texto fijo, sin dato real)**, Check-ins de hoy. | `dashboard-view` (solo dice qué se quitó) |
| Acciones rápidas | Check-in rápido, Pago rápido, nuevo miembro. | — |
| Cobros | Pagos recientes y "Seguimiento de cobros" (semáforo por miembro). Sin plan ni último período. | `payment-status-indicator` |
| Ingresos | KPIs de pagos por rango, por método y por canal (Dueño y Coach). | — |
| Evolución | Vive en **Reportes**: ingresos, asistencias, altas por bucket y detalle diario. Solo Dueño. | — |
| Actividad de hoy con plantilla, día y estado | No existe. Depende de la sesión de rutina (R-6). | — |
| En sala, sesiones completadas | No existen. | — |
| Miembro | No accede al Dashboard. | `session-state` |

## 6. Brecha MVP

| # | Brecha | Depende de | Prioridad |
|---|---|---|---|
| DB-1 | Retirar el KPI fijo "Rutina base 4 días". | — | Alta, chica |
| DB-2 | Bloque Cobros completo: al día / en mora como números, lista de morosos con plan y último período, ingresos del mes por método. | M3 | Alta |
| DB-3 | Absorber Reportes: sección Evolución con rango y granularidad; retirar `/reports` y su ítem de menú; habilitar al Coach (D10). | — | Alta |
| DB-4 | Bloque Hoy: en sala, sesiones completadas, Actividad de hoy con plantilla · día · estado. | R-6, A-2 | Media |
| DB-5 | Spec de `dashboard-view` reescrita: hoy solo describe qué se quitó; debe describir qué muestra. | — | Media, documental |

## 7. Fuera de alcance

- Exportación a CSV o PDF (D-6).
- Alertas o notificaciones push.
- Comparativas año contra año, metas y proyecciones.
- Dashboard configurable por usuario (D-3).
- Home con resumen para el Miembro (D-1).
