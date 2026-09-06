# Asistencias

Módulo 4 del MVP. Define el check-in del miembro, quién lo registra, qué se ve del historial y
qué API queda lista para la app móvil (D5).

Última revisión: 2026-09-06. Estado: borrador 1, con supuestos a confirmar.

---

## 0. Supuestos a confirmar

| # | Supuesto | Alternativa descartada |
|---|---|---|
| A1 | **Un check-in por miembro por día** calendario. Un segundo intento el mismo día avisa "ya registrado a las HH:MM" y no duplica. | Permitir varios (hoy es así). |
| A2 | El Dueño puede **borrar un check-in del día** registrado por error. Los de días anteriores no se tocan. | Sin borrado. |
| A3 | Un miembro **en mora puede hacer check-in**; el staff ve un aviso amarillo al registrarlo. La baja sí lo impide. | Bloquear al moroso. |
| A4 | El endpoint de **auto check-in** para la app móvil exige sesión de Miembro con membresía activa y aplica A1 y A3. Sin geolocalización ni QR en la API de este MVP: eso lo define el MVP móvil. | Validar ubicación en el backend ahora. |
| A5 | **"En sala"** = hizo check-in hoy hace menos de 2 horas y no finalizó una sesión de rutina. Es una convención para el Dashboard, no un estado guardado. | Registrar salida (check-out). |

## 1. Objetivo y usuarios

- **Dueño** (y Coach, D10): marca la asistencia del miembro que llega, ve quién vino hoy y el
  historial de cada uno.
- **Miembro**: en este MVP ve su calendario de asistencias en el portal. Más adelante, hace
  su propio check-in desde la app móvil.

Alimenta el dolor 3 de la visión (la foto del día) y el seguimiento de adherencia de rutinas.

## 2. Conceptos

```
 Check-in
 ┌──────────────────────────────────────┐
 │ miembro                              │
 │ fecha y hora (hora local Argentina)  │
 │ registrado por  staff | el miembro   │   ← el segundo caso llega desde la app móvil
 └──────────────────────────────────────┘
        │ se cruza con
        ▼
 Sesión de rutina del mismo día (04-rutinas) → estado "Completó / En sala / Sin registro"
```

| Concepto | Qué es |
|---|---|
| **Check-in** | Registro de que el miembro vino al gimnasio un día. Uno por día (A1). |
| **Registrado por** | Quién lo hizo: un usuario del staff, o el propio miembro desde la app móvil. |
| **Calendario** | Vista mensual con los días en que el miembro vino. |
| **En sala** | Convención derivada (A5) para el Dashboard. |

## 3. Reglas de negocio

- Solo se registra check-in a un miembro con **membresía activa**. La baja lo impide; la mora
  no, pero avisa (A3).
- El staff busca al miembro por nombre, email o celular; la búsqueda solo trae miembros con
  membresía activa, para que un homónimo del staff no gane el match.
- Uno por día (A1). La hora es la local del gimnasio.
- El historial se filtra por miembro y por rango de fechas; se ordena del más reciente.
- El calendario del miembro vive en su ficha (staff) y en "Mis asistencias" (portal).
- Borrar solo el del día, solo el Dueño (A2). Queda registrado quién borró.
- El check-in no borra nunca al dar de baja al miembro: es historial.

## 4. Flujos principales

1. **Marcar asistencia.** Asistencias → buscar → elegir → Registrar. También desde el
   Dashboard con "Check-in rápido".
2. **Ver quién vino hoy.** Asistencias, listado del día por defecto; Dashboard, bloque Hoy.
3. **Historial de un miembro.** Ficha → calendario mensual y lista.
4. **Mis asistencias (Miembro).** Portal → calendario y racha.
5. **Corregir.** Asistencias → check-in de hoy → Eliminar → confirmación (A2).
6. **Auto check-in (app móvil, fuera de esta web).** La app llama al endpoint con la sesión del
   miembro; el backend aplica las mismas reglas (A4).

## 5. Estado actual en el código

| Qué | Cómo está hoy | Spec |
|---|---|---|
| Check-in por staff, por id o búsqueda, solo membresía activa | Implementado. Guarda el coach si lo hizo un Coach; si lo hizo un Dueño no guarda quién. | Sin spec propia. |
| Listado con búsqueda, filtro por miembro y rango, paginado | Implementado. **Responde sin token** (P1). | — |
| Calendario en la ficha del miembro | Implementado. | `user-management` (mención) |
| Check-in rápido y "Check-ins de hoy" en el Dashboard | Implementado. | `dashboard-view` |
| Reporte de asistencias por día/semana/mes y detalle diario | Implementado en Reportes, solo Dueño. Pasa al Dashboard (D7). | — |
| Uno por día (A1) | No: se pueden registrar varios. | — |
| Borrar check-in (A2) | No existe. | — |
| Aviso de mora al registrar (A3) | No existe. | — |
| Auto check-in del miembro (A4) | No existe el endpoint. | — |
| Mis asistencias en el portal | No existe. | — |

## 6. Brecha MVP

| # | Brecha | Depende de | Prioridad |
|---|---|---|---|
| A-1 | Listado de asistencias exige sesión y rol (parte de P1). | — | Alta |
| A-2 | Endpoint de auto check-in del miembro, sin UI web (P2, A4). Registrar siempre quién hizo el check-in, incluido el Dueño. | — | Media |
| A-3 | "Mis asistencias" en el portal: calendario y racha. | — | Media |
| A-4 | Un check-in por día con aviso de duplicado (A1). | — | Media, chica |
| A-5 | Aviso de mora al registrar (A3). | M3 de membresías | Baja |
| A-6 | Borrar check-in del día, solo Dueño, con auditoría (A2). | — | Baja |
| A-7 | Bloque Hoy del Dashboard con actividad por miembro (se detalla en `07-dashboard.md`). | R-6 de rutinas | Media |

## 7. Fuera de alcance

- QR, código de acceso, torniquete o cualquier control físico.
- Check-out y tiempo de permanencia real (A5 es una convención).
- Aforo, cupos, turnos y reservas.
- Geolocalización en el backend (A4).
- Recordatorios por inasistencia.
