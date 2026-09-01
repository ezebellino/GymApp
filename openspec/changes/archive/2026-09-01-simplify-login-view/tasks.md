## 1. Layout

- [x] 1.1 Eliminar la `<section>` de marketing (hero + tarjetas de features) y el grid de dos
      columnas en [frontend/src/pages/Login.tsx](../../../frontend/src/pages/Login.tsx).
- [x] 1.2 Centrar el `<form>` (ancho final `max-w-lg`) dentro del `<main>` de auth, que ya centra
      con flex; verificado en mobile y desktop.
- [x] 1.3 Identificar que el vignette/gradiente real vivía en `app-main-shell-bg` del `<main>` de
      auth en [frontend/src/App.jsx](../../../frontend/src/App.jsx), no en Login.tsx; reemplazarlo
      por `bg-zinc-950` plano y sacar el `min-h-screen`/background duplicado de Login.tsx.

## 2. Header del formulario

- [x] 2.1 Dejar solo logo (`/mini-espacio-logo.svg`) + texto de marca como header del form,
      eliminando "Acceso seguro", "Entrenamientos personalizados" e "Ingresar al panel".
- [x] 2.2 Renombrar la marca mostrada de "Mini Espacio" a "Gym App" (texto y `alt` del logo) en
      Login.tsx.

## 3. Campos y submit

- [x] 3.1 Verificar que los campos "Usuario" y "Contraseña" (con toggle mostrar/ocultar) queden
      sin cambios funcionales, solo ajustando estilos si hace falta por el nuevo layout.
- [x] 3.2 Mantener el botón "Entrar" con estado disabled + texto "Ingresando..." durante el
      loading, sin agregar mensajería adicional.

## 4. Mensajes verbosos

- [x] 4.1 Eliminar el subtítulo "Usa tus credenciales para entrar al sistema."
- [x] 4.2 Eliminar el párrafo con contador "Conectando con el servidor... Xs" y el aviso de
      "backend puede estar reactivandose" (y el estado `elapsed`/`useEffect` asociado si queda
      sin uso).
- [x] 4.3 Eliminar el banner "Demo operativa lista para seguimiento diario".
- [x] 4.4 Eliminar el footer de copyright ("{year} Mini Espacio").

## 5. Link de registro

- [x] 5.1 Cambiar el texto del botón/link de "Soy cliente y quiero crear mi acceso" a
      "Registrar cuenta", manteniendo el `onClick` a `/register-client`.

## 6. Verificación

- [x] 6.1 Correr `npm run lint` en `frontend/` y corregir warnings introducidos.
- [x] 6.2 Probar manualmente el flujo de login (éxito y credenciales inválidas) y la navegación
      a "Registrar cuenta" en mobile y desktop (`make frontend`).

## 7. RegisterClient consistente con Login

- [x] 7.1 Sacar el wrapper `relative overflow-hidden bg-[#0b0b0b]` y el `shadow-[...]` +
      `backdrop-blur-xl` del card en
      [frontend/src/pages/RegisterClient.tsx](../../../frontend/src/pages/RegisterClient.tsx),
      dejando el mismo fondo plano (`bg-zinc-900/95`) que Login.
- [x] 7.2 Reemplazar el eyebrow "Registro de cliente" + título "Crear acceso personal" por el
      mismo header de marca (logo + "Gym App") que Login.
- [x] 7.3 Confirmar que el card use el mismo `max-w-lg` que Login.
- [x] 7.4 Probar manualmente `/register-client` en mobile y desktop, y el flujo de registro
      (éxito y contraseñas no coincidentes).
