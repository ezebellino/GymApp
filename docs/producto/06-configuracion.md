# Configuración del gimnasio

Módulo 5 del MVP. Define qué datos del gimnasio se configuran, quién los edita y cómo se
propagan al resto de la app. Es el módulo más simple y el más completo en el código; la brecha
es sobre todo **quitar** cosas que otras decisiones dejaron obsoletas.

Última revisión: 2026-09-06. Estado: borrador 1, con supuestos a confirmar.

---

## 0. Supuestos a confirmar

| # | Supuesto | Alternativa descartada |
|---|---|---|
| C1 | Hay **una sola configuración** (un gimnasio, D single-tenant) y no se guarda historial de cambios. | Auditoría de cambios. |
| C2 | El **horario** sigue siendo un texto libre ("Lun a Vie 7 a 22 h") en el MVP. | Horarios estructurados por día. |
| C3 | Los **planes de membresía** se administran en Pagos → Planes, no en Ajustes. Ajustes solo linkea. | Planes dentro de Ajustes. |
| C4 | La **moneda** es un texto informativo (ARS) que se muestra junto a los montos. No hay conversión ni multi-moneda. | Moneda fija sin campo. |
| C5 | El **mensaje operativo** (hoy "mensaje de bienvenida / onboarding") se muestra al staff en recepción y al miembro en el portal. | Solo staff. |

## 1. Objetivo y usuarios

- **Dueño** (y Coach, D10): carga una vez la identidad del gimnasio, sus datos de contacto y
  qué medios de pago acepta. Lo cambia cuando hace falta.
- **Miembro**: ve en el portal el nombre, contacto, horario y cómo pagar (alias), sin editar.

## 2. Qué se configura

```
 Configuración del gimnasio (única)
 ├── Identidad        nombre del gimnasio, responsable
 ├── Contacto         dirección, email, teléfono, WhatsApp, horario visible
 ├── Medios de pago   efectivo sí/no, transferencia sí/no, alias bancario, notas para pagar
 ├── Operación        mensaje operativo (recepción y portal)
 └── Moneda           texto informativo (C4)

 Se deprecan (D2, D3, tema por usuario):
 ✗ cuota mensual base            → planes de membresía (03)
 ✗ días de gracia                → sin gracia (S2 de membresías)
 ✗ mensaje de recordatorio       → sin recordatorios (D3)
 ✗ fecha del último recordatorio → idem
 ✗ preferencia de tema global    → ya es por usuario (session-state)
```

## 3. Reglas de negocio

- Solo el staff edita (Dueño; Coach hereda, D10). El Miembro lee lo público.
- Los cambios se reflejan **de inmediato en toda la app** sin recargar: nombre en el sidebar y
  el login, contacto en el portal, medios de pago en el diálogo de pago.
- Un medio de pago deshabilitado no se ofrece al registrar un pago. Al menos uno debe quedar
  habilitado.
- El alias bancario y las notas para pagar se muestran al miembro en "Mi cuota" cuando la
  transferencia está habilitada.
- La configuración persiste en el servidor y el servidor manda sobre cualquier copia local.
- El nombre del gimnasio es obligatorio; el resto es opcional y la UI muestra qué falta.

## 4. Flujos principales

1. **Configurar por primera vez.** Ajustes → completar identidad, contacto, medios de pago →
   guardar → la app cambia de nombre al instante.
2. **Cambiar medios de pago.** Ajustes → deshabilitar efectivo → el próximo pago solo ofrece
   transferencia.
3. **Ver datos del gimnasio (Miembro).** Portal → pie o sección "El gimnasio": horario,
   dirección, WhatsApp, cómo pagar.

## 5. Estado actual en el código

| Qué | Cómo está hoy | Spec |
|---|---|---|
| Identidad, contacto, horario, medios de pago, alias, notas, mensaje operativo | Implementado, con previsualización y resumen de datos faltantes en Ajustes. | `app-settings-state`, `settings-view` |
| Propagación inmediata y persistencia | Implementado (store compartido + servidor manda). | `app-settings-state` |
| Endpoints GET / PUT / PATCH | **Responden sin token ni rol** (P1). | — |
| Cuota base, días de gracia, mensaje y fecha de recordatorio | Existen y se editan en Ajustes. **A deprecar.** | `app-settings-state` |
| Preferencia de tema global | Existe en el modelo; el tema ya es por usuario. **A deprecar.** | `session-state` |
| Datos del gimnasio visibles al miembro | No hay sección en el portal. | — |
| Al menos un medio de pago habilitado | No se valida. | — |

## 6. Brecha MVP

| # | Brecha | Depende de | Prioridad |
|---|---|---|---|
| C-1 | Endpoints de configuración exigen sesión; escritura solo staff (parte de P1). | — | Alta |
| C-2 | Deprecar cuota base, gracia, recordatorios y tema global: modelo, API y UI de Ajustes. | M3 de membresías | Media |
| C-3 | Sección "El gimnasio" en el portal del miembro y alias en "Mi cuota" (C5). | M6 | Media |
| C-4 | Validar al menos un medio de pago habilitado. | — | Baja, chica |
| C-5 | Link a Planes de membresía desde Ajustes (C3). | M1 | Baja |

## 7. Fuera de alcance

- Multi-sede o multi-gimnasio.
- Logo, colores, branding personalizado.
- Horarios estructurados, feriados, cierres (C2).
- Multi-moneda, impuestos, facturación (C4).
- Historial de cambios de configuración (C1).
