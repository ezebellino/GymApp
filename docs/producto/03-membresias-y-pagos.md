# Membresías y pagos

Módulo 2 del MVP. Define los planes de membresía, cómo se asocian a cada miembro, cómo se
registra un pago y cómo se deriva el estado de cuota. Introduce el concepto nuevo más grande
del MVP: el **plan con historial de precios** (decisión D2 en
[00-vision-mvp.md](00-vision-mvp.md)).

Última revisión: 2026-09-06. Estado: borrador 1, con supuestos a confirmar.

---

## 0. Supuestos a confirmar

Reglas que el código no define y que este borrador asume. Cambiar cualquiera de ellas
modifica la sección 3.

| # | Supuesto | Alternativa descartada |
|---|---|---|
| S1 | Todo plan es **mensual**: un pago cubre un período mes/año, como hoy. | Planes trimestrales o anuales. |
| S2 | La mora se calcula por **período calendario**: al empezar un mes sin pago de ese mes, el miembro está en mora. No hay días de gracia. | Vencimiento a N días del último pago, o gracia configurable (hoy existe `late_fee_grace_days`, pero solo se usa en el texto del recordatorio, que se deprecó con D3). |
| S3 | Al registrar un pago, el monto **se sugiere** desde el precio vigente del plan del miembro y **se puede editar** (descuento puntual, redondeo). El sistema guarda ambos: lo pagado y el precio de referencia. | Monto fijo no editable. |
| S4 | Cada miembro tiene **exactamente un plan** vigente a la vez. | Varios planes simultáneos. |
| S5 | Cambiar el plan de un miembro aplica a **los próximos pagos**. No se recalcula ni prorratea el período ya pagado. | Prorrateo. |
| S6 | Un plan **desactivado** no se puede asignar a miembros nuevos, pero los que ya lo tienen lo conservan hasta que se les cambie. | Reasignación forzada al desactivar. |
| S7 | Todo miembro con membresía activa debe tener plan. En la migración, se crea un plan "General" con el precio de la tarifa única actual y se asigna a todos los miembros existentes. | Miembros sin plan permitidos. |

## 1. Objetivo y usuarios

- **Dueño** (y Coach, D10): define los planes y sus precios, asigna el plan a cada miembro,
  registra los pagos y ve quién está al día y quién no.
- **Miembro**: ve en el portal qué plan tiene, cuánto vale, si está al día y su historial de
  pagos ("Mi cuota").

Resuelve el dolor 1 de la visión: saber quién debe, sin memoria ni planilla.

## 2. Conceptos

```
 Plan de membresía                  Precio del plan (historial)
 ┌──────────────────────┐          ┌───────────────────────────┐
 │ nombre  "Estudiante" │ 1 ──── * │ monto        18.000        │
 │ descripción          │          │ vigente desde 2026-09-01   │
 │ activo   sí/no       │          │ quién lo cambió            │
 └──────────┬───────────┘          └───────────────────────────┘
            │ 1
            │
            │ *
 ┌──────────┴───────────┐          ┌───────────────────────────┐
 │ Miembro (User)       │ 1 ──── * │ Pago                      │
 │ plan vigente         │          │ período   mes/año          │
 │ plan desde           │          │ monto pagado               │
 │ estado de membresía  │          │ plan y precio de referencia│  ← foto al momento del pago
 └──────────────────────┘          │ método    efectivo/transf. │
                                   │ canal     mercadopago, ... │
                                   │ nota, quién lo registró    │
                                   └───────────────────────────┘
```

| Concepto | Qué es | Ejemplos |
|---|---|---|
| **Plan de membresía** | Una categoría de cuota con nombre y precio vigente. | General, Socio del club, Jubilado, Estudiante. |
| **Precio del plan** | Cada valor que tuvo el plan, con fecha desde la que rige. Solo se agrega, nunca se edita ni borra. | General: 30.000 desde 2026-01-01; 34.000 desde 2026-09-01. |
| **Plan del miembro** | Qué plan tiene asignado hoy cada miembro y desde cuándo. | Marina → Socio del club desde 2026-03-12. |
| **Pago** | Registro de que el miembro pagó un período. Guarda el monto pagado y una foto del plan y precio vigentes en ese momento. | Marina, 09/2026, 34.000, transferencia, Mercado Pago. |
| **Período** | Mes y año que cubre un pago. Un miembro tiene a lo sumo un pago por período. | 09/2026. |
| **Estado de cuota** | Al día, en mora o de baja. Derivado, no se guarda. | Ver §3.4. |

## 3. Reglas de negocio

### 3.1 Planes

- El Dueño crea un plan con nombre único, descripción opcional y precio inicial. Nace activo.
- El precio se cambia agregando un nuevo valor con fecha "vigente desde" (por defecto hoy).
  El valor anterior queda en el historial. **Ningún pago ya registrado cambia**: cada pago
  tiene su propia foto de precio (S3).
- Un plan se puede desactivar. No se puede borrar si tiene o tuvo miembros o pagos. Un plan
  desactivado deja de ofrecerse al asignar (S6).
- Debe existir siempre al menos un plan activo.

### 3.2 Plan del miembro

- Al dar de alta un miembro se elige su plan; es obligatorio (S7).
- El plan se cambia desde la ficha del miembro. El cambio registra desde cuándo rige y quién
  lo hizo. Aplica a los próximos pagos (S5).
- La ficha y el listado de usuarios muestran el plan vigente.

### 3.3 Pagos

- Solo se registra un pago a un miembro con membresía activa.
- Un pago cubre un período (mes/año). No puede haber dos pagos del mismo miembro para el
  mismo período. Se pueden registrar períodos futuros (pagar por adelantado).
- El monto se precarga con el **precio vigente del plan del miembro a la fecha del pago** y
  se puede editar (S3). Se guardan el monto pagado, el plan y el precio de referencia.
- Método: efectivo o transferencia, con canal opcional para transferencia (Mercado Pago,
  Cuenta DNI, etc.). Solo se ofrecen los métodos habilitados en Configuración.
- Anular un pago lo elimina del historial y recalcula el estado de cuota. Solo el Dueño.

### 3.4 Estado de cuota

Se deriva en tiempo real, con la regla que ya existe en `payment-status-indicator`:

```
 membresía dada de baja ─────────────────────────────▶ 🔴 De baja
 membresía activa, último pago ≥ período actual ─────▶ 🟢 Al día
 membresía activa, sin pago o último pago < actual ──▶ 🟡 En mora
```

Sin días de gracia (S2). El estado se muestra en el listado de usuarios, en la ficha, en el
Dashboard (bloque Cobros) y en el portal del miembro.

### 3.5 Qué pasa cuando cambia el precio

Ejemplo, plan General 30.000 → 34.000 vigente desde el 1/9/2026:

| Pago | Período | Fecha de registro | Precio de referencia | Monto pagado |
|---|---|---|---|---|
| Marina | 08/2026 | 05/08/2026 | 30.000 | 30.000 |
| Marina | 09/2026 | 03/09/2026 | 34.000 | 34.000 |
| Julián | 08/2026 | 02/09/2026 (atrasado) | 34.000 | 30.000 (editado, nota "precio viejo") |

El tercer caso muestra el límite de S3: la referencia es el precio vigente **al registrar**,
no el del período. Si producto prefiere que un pago atrasado sugiera el precio que regía en
ese período, es un cambio a S3 y hay que decirlo ahora.

## 4. Flujos principales

1. **Crear plan.** Ajustes o Pagos → Planes → Nuevo → nombre, descripción, precio → queda
   activo y disponible para asignar.
2. **Cambiar precio.** Planes → plan → Nuevo precio → monto y fecha desde → el historial
   muestra ambos valores. Los miembros del plan pasan a pagar el nuevo valor.
3. **Alta de miembro con plan.** Al crear un usuario rol Miembro, el plan es un campo
   obligatorio. Después puede cambiarse desde la ficha.
4. **Registrar pago.** Ficha del miembro o Pagos → Nuevo pago → período precargado con el
   mes actual, monto precargado con el precio del plan → método y canal → guardar. El
   semáforo pasa a verde al instante.
5. **Ver quién debe.** Listado de usuarios filtrado por estado, y bloque Cobros del
   Dashboard con la lista de miembros en mora.
6. **Mi cuota (Miembro).** Plan, precio vigente, estado de este mes, historial de pagos.

## 5. Estado actual en el código

| Qué | Cómo está hoy | Spec |
|---|---|---|
| Pago | `Payment`: miembro, monto, método (`cash`/`transfer`), canal, nota, período mes/año, quién lo registró. Un pago por período. Solo a membresía activa. | Sin spec propia; reglas en código. |
| Estado de cuota | Derivado como en §3.4. Semáforo en el listado de usuarios. | `payment-status-indicator` |
| Precio | **Tarifa única global** `default_fee` en Configuración. El diálogo de nuevo pago la precarga. | `app-settings-state` |
| Planes | No existen. | — |
| Historial de precios | No existe. Cambiar `default_fee` no deja rastro. | — |
| KPIs | Totales, promedio, por método, por canal y serie temporal de pagos por rango de fechas (Dueño y Coach). | Sin spec; consumidos por Dashboard y Reportes. |
| Anular pago | Existe, solo Dueño. | — |
| Portal del miembro | No ve pagos ni estado. | — |
| Seguridad | Listado y detalle de pagos responden **sin token**. | Brecha P1 |
| Recordatorios | Mensaje, alias y días de gracia en Configuración. **Se deprecan** (D3). | `app-settings-state` |

## 6. Brecha MVP

En orden de implementación sugerido. Cada ítem es un change de OpenSpec.

| # | Brecha | Depende de | Prioridad |
|---|---|---|---|
| M1 | Planes de membresía con historial de precios: entidad, CRUD, migración que crea "General" desde `default_fee` y lo asigna a todos los miembros. | — | Alta |
| M2 | Plan del miembro: obligatorio en el alta, cambio desde la ficha, visible en listado y ficha. | M1 | Alta |
| M3 | El pago toma el precio del plan: precarga desde el plan del miembro, guarda plan y precio de referencia. | M2 | Alta |
| M4 | Endpoints de pagos exigen sesión y rol (parte de P1). | — | Alta |
| M5 | Deprecar `default_fee`, `late_fee_grace_days` y los campos de recordatorio de Configuración, con su UI. | M3 | Media |
| M6 | "Mi cuota" en el portal del miembro: plan, estado, historial. | M3 | Media |
| M7 | Filtro por estado de cuota en el listado de usuarios y lista de morosos en el Dashboard (se detalla en `07-dashboard.md`). | M3 | Media |

## 7. Fuera de alcance

- Recordatorios de cobro por cualquier canal (D3).
- Cobro online, pasarelas, débito automático.
- Pagos parciales, cuotas de una cuota, saldo a favor.
- Prorrateo al cambiar de plan a mitad de mes (S5).
- Planes no mensuales, packs de clases, pases diarios (S1).
- Descuentos automáticos por reglas (hermanos, anticipado). El descuento puntual se resuelve
  editando el monto (S3).
- Facturación electrónica y comprobantes.
