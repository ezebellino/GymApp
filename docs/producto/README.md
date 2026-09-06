# Documentación de producto · MVP Gym App

Conjunto de documentos que definen el MVP a nivel producto (qué y por qué). El comportamiento
fino vive en las specs de OpenSpec (`openspec/specs/`); estos docs las referencian, no las
duplican. Ver cómo se relacionan en [00-vision-mvp.md §9](00-vision-mvp.md#9-cómo-se-usa-este-conjunto-de-documentos).

| Doc | Contenido | Estado |
|---|---|---|
| [00-vision-mvp.md](00-vision-mvp.md) | Problema, usuarios, alcance, decisiones, fuera de alcance, qué deprecar, criterio de listo | ✅ borrador 1 |
| [01-roles-y-permisos.md](01-roles-y-permisos.md) | Tres roles, matriz rol × módulo × acción, navegación, membresía, alta y acceso | ✅ borrador 1 |
| [02-usuarios.md](02-usuarios.md) | Identidad, alta e invitación, membresía y baja, listado y ficha, perfil del miembro | ✅ borrador 1, 6 supuestos a confirmar |
| [03-membresias-y-pagos.md](03-membresias-y-pagos.md) | Planes de membresía, asignación, pagos, historial de precios, semáforo | ✅ borrador 1, 7 supuestos a confirmar |
| [04-rutinas.md](04-rutinas.md) | Catálogo de ejercicios con video, plantillas con días propios y series explícitas, asignación, sesión del miembro y progresión de peso | ✅ borrador 1, 9 supuestos a confirmar |
| [05-asistencias.md](05-asistencias.md) | Check-in por el staff, uno por día, historial, calendario, API de auto check-in para la app móvil | ✅ borrador 1, 5 supuestos a confirmar |
| [06-configuracion.md](06-configuracion.md) | Identidad, contacto, medios de pago, mensaje operativo; qué se deprecha | ✅ borrador 1, 5 supuestos a confirmar |
| [07-dashboard.md](07-dashboard.md) | Bloques Hoy, Cobros y Evolución; absorbe Reportes | ✅ borrador 1, 6 supuestos a confirmar |
| [08-glosario.md](08-glosario.md) | Términos del producto con su nombre en código | ✅ borrador 1 |
| [09-backlog-mvp.md](09-backlog-mvp.md) | Todas las brechas en 6 fases, post-MVP y resumen de supuestos | ✅ borrador 1 |

Plantilla de cada doc de módulo (02 a 07): objetivo y usuarios · flujos principales · reglas
de negocio · estado actual (link a specs) · brecha MVP priorizada · fuera de alcance.
