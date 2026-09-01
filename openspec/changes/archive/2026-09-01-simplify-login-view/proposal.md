## Why

La vista de Login actual mezcla el formulario de acceso con una columna de marketing, mensajes
de estado verbosos (contador de conexión, avisos de "backend reactivandose", banner de demo) y un
background con efectos decorativos pesados. Esto la hace más lenta de escanear y más difícil de
mantener responsive. Se simplifica a lo esencial: usuario, contraseña y el link a registro.

## What Changes

- Eliminar la columna de marketing (hero + tarjetas de features) que hoy se muestra en desktop
  (`lg:block`). El login queda como un único formulario centrado.
- Simplificar el background: quitar los círculos de blur/glow decorativos y el vignette
  (`app-main-shell-bg`) del `<main>` de rutas de auth en `App.jsx`; queda un fondo plano
  (`bg-zinc-950`) compartido por login y registro.
- Simplificar el header del formulario: solo logo + nombre de marca. Se elimina el eyebrow
  "Acceso seguro", el subtítulo "Entrenamientos personalizados" y el título "Ingresar al panel".
- Renombrar la marca mostrada de "Mini Espacio" a "Gym App" en el header del formulario (texto y
  `alt` del logo) tanto en Login como en RegisterClient.
- Eliminar mensajes verbosos del formulario de login:
  - Contador "Conectando con el servidor... Xs" durante el loading.
  - Aviso "Si el acceso tarda unos segundos... backend puede estar reactivandose".
  - Banner "Demo operativa lista para seguimiento diario".
  - Subtítulo "Usa tus credenciales para entrar al sistema."
- Simplificar el texto del link de registro: de "Soy cliente y quiero crear mi acceso" a
  "Registrar cuenta".
- Aplicar el mismo tratamiento visual a `/register-client`: mismo ancho de card (`max-w-lg`),
  mismo fondo plano, sin shadow/backdrop-blur decorativos, y con el mismo header de marca
  (logo + "Gym App") que Login.
- Mantener y garantizar el comportamiento responsive del formulario (mobile-first, sin depender
  de la columna que se elimina).
- La lógica de autenticación (submit, manejo de errores, retry con timeout, decodificación de
  JWT, registro de cliente) no cambia — es un cambio puramente de UI.

## Capabilities

### New Capabilities
- `login-view`: Vista de login simplificada (usuario, contraseña, link a registro), responsive,
  sin mensajería de estado verbosa ni panel de marketing.
- `register-client-view`: Vista de registro de cliente con el mismo tratamiento visual
  simplificado (card centrado, fondo plano, header de marca) que login.

### Modified Capabilities
(ninguna — no existen specs previas para estas vistas)

## Impact

- Código afectado:
  - [frontend/src/pages/Login.tsx](../../../frontend/src/pages/Login.tsx)
  - [frontend/src/pages/RegisterClient.tsx](../../../frontend/src/pages/RegisterClient.tsx)
  - [frontend/src/App.jsx](../../../frontend/src/App.jsx) (wrapper `<main>` de rutas de auth)
- No afecta backend, API, ni modelos de datos.
