## 1. Alert de la entrada

- [x] 1.1 Eliminar el `await alertSuccess("Bienvenido", ...)` antes del `navigate("/")` en
      [frontend/src/pages/Login.tsx](../../../frontend/src/pages/Login.tsx).
- [x] 1.2 Eliminar el `await alertSuccess("Cuenta creada", ...)` antes del
      `navigate("/my-routine")` en
      [frontend/src/pages/RegisterClient.tsx](../../../frontend/src/pages/RegisterClient.tsx).
- [x] 1.3 Eliminar la sección "Alertas de negocio" (JSX) en
      [frontend/src/pages/Dashboard.tsx](../../../frontend/src/pages/Dashboard.tsx).
- [x] 1.4 Si `businessAlerts`, `alertToneClasses` y `alertIcons` quedan sin otro uso, eliminarlos
      para evitar código muerto y warnings de lint.

## 2. Cards informativas

- [x] 2.1 Eliminar la card lateral de marca/sesión del hero de Dashboard.tsx (logo + "Mini
      Espacio" + rol/periodo, y la card "Estado de sesión").
- [x] 2.2 Eliminar la `<section>` con las 3 `InfoCard` en
      [frontend/src/pages/Settings.tsx](../../../frontend/src/pages/Settings.tsx).
- [x] 2.3 Eliminar la card lateral "Contexto operativo" del hero de Settings.tsx.
- [x] 2.4 Si el componente `InfoCard` queda sin otro uso, eliminar su definición.

## 3. Previews de Ajustes con acción real

- [x] 3.1 Agregar botón en la card "Vista previa del negocio" que arme la URL de WhatsApp
      (`https://wa.me/<whatsapp_phone>?text=<mensaje resuelto>`) usando
      `payment_reminder_message` con placeholders de ejemplo, y la abra en una pestaña nueva.
- [x] 3.2 Agregar en "Resumen rápido" un link/botón que lleve al campo correspondiente cuando un
      dato clave (ej. WhatsApp principal) está sin cargar.
- [x] 3.3 Confirmar que "Tema visual" ya cumple (selector interactivo existente) — sin cambios
      si ya tiene acción real.

## 4. Verificación

- [x] 4.1 Correr `npm run lint` en `frontend/` y corregir warnings introducidos.
- [x] 4.2 Probar manualmente: login/registro sin popup, Dashboard sin alertas/card lateral,
      Ajustes sin InfoCards/Contexto operativo, y el botón de preview de WhatsApp funcionando.
