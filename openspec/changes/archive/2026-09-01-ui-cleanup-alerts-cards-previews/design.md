## Context

- `Login.tsx`/`RegisterClient.tsx` (simplificados en el change anterior) muestran un
  `alertSuccess(...)` justo antes del `navigate(...)` en `onSubmit`. Es un modal bloqueante que
  el usuario debe cerrar (o esperar) antes de ver la app.
- `Dashboard.tsx` calcula `businessAlerts` (useMemo) y renderiza una sección completa con esas
  cards; también tiene una card lateral de marca ("Mini Espacio" + rol/periodo) junto al hero.
- `Settings.tsx` tiene 3 `InfoCard` (componente local, puramente presentacional) y una card
  "Contexto operativo" junto al hero, además de una columna derecha con "Vista previa del
  negocio", "Tema visual" y "Resumen rápido" — hoy solo texto, sin acciones.

## Goals / Non-Goals

**Goals:**
- Loguearse/registrarse redirige directo, sin popup de bienvenida intermedio.
- Dashboard sin sección de "Alertas de negocio" ni card de marca/sesión lateral.
- Settings sin las 3 InfoCard ni la card "Contexto operativo".
- Las cards de preview de Ajustes (columna derecha) incluyen al menos una acción real cada una:
  - "Vista previa del negocio" → botón que abre el mensaje de recordatorio de pago (con
    placeholders resueltos) en WhatsApp Web/API, igual que ya hace `openPaymentReminder` en
    Dashboard pero a nivel de configuración general (sin depender de un cliente puntual, usa un
    mensaje de ejemplo).
  - "Tema visual" y "Resumen rápido" mantienen su función actual (selector de tema ya es
    interactivo; Resumen rápido pasa a incluir un link a la sección de Ajustes correspondiente
    si el dato está incompleto, ej. "Completar WhatsApp" → hace scroll/foco al campo).

**Non-Goals:**
- No se cambia la lógica de negocio de auth, settings, KPIs de dashboard, ni el cálculo de
  `businessAlerts` en sí — se elimina su renderizado, no el cálculo si en el futuro se reusa en
  otro lugar (a evaluar durante implementación: si no se reusa en ningún lado, se elimina
  también el cálculo para no dejar código muerto).
- No se agregan nuevas fuentes de datos ni endpoints nuevos.

## Decisions

- **Alert de bienvenida**: se elimina el `await alertSuccess(...)` antes del `navigate(...)` en
  ambos componentes. El `try/catch` y el resto de la lógica de guardado de sesión no cambian.
  Alternativa descartada: usar un toast no bloqueante (`sonner`, ya presente en el proyecto) en
  vez de eliminarlo — se descarta porque el usuario pidió explícitamente sacarlo, no reemplazarlo.
- **Alertas de negocio (Dashboard)**: se elimina la sección `<section>` completa (líneas de
  "Alertas de negocio" + su `.map`). Si `businessAlerts`/`alertToneClasses`/`alertIcons` quedan
  sin otro uso tras el cambio, se eliminan también (evita código muerto y warnings de lint por
  variables no usadas).
- **Card de marca/sesión (Dashboard) y Contexto operativo (Settings)**: se elimina el `<div>`
  lateral en el hero de ambas vistas, dejando solo el bloque principal (título + descripción +
  acciones) a ancho completo.
- **InfoCard (Settings)**: se elimina la `<section>` con las 3 `InfoCard` y, si el componente
  `InfoCard` queda sin otro uso, se elimina su definición.
- **Preview con acción real**: se agrega un botón "Enviar recordatorio de ejemplo" (o similar)
  dentro de la card "Vista previa del negocio" que arma la URL de WhatsApp
  (`https://wa.me/<whatsapp_phone>?text=<mensaje resuelto>`) igual que
  `openPaymentReminder` en Dashboard, reutilizando `payment_reminder_message` con placeholders
  de ejemplo (`{client_name}` → "Cliente", `{amount}` → cuota actual, etc.).
  Alternativa descartada: abrir un modal con vista previa sin acción — no cumple con "generar
  links/buttons", que pide una acción, no solo mostrar texto.

## Risks / Trade-offs

- [Se pierde feedback inmediato de "login exitoso"] → Aceptado explícitamente por el usuario; el
  redirect a `/` o `/my-routine` ya es señal suficiente de éxito.
- [Se pierde visibilidad rápida de alertas de negocio al entrar al Dashboard] → Aceptado; las
  mismas señales (clientes sin pago, check-ins) siguen disponibles en Pagos/Asistencia.
- [Reutilizar `payment_reminder_message` con datos de ejemplo puede confundir si el owner no
  completó placeholders] → Mitigado con valores de ejemplo claros (ej. "Cliente de ejemplo").
