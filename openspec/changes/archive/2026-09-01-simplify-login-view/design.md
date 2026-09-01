## Context

`Login.tsx` es un único componente que renderiza layout de dos columnas (marketing + form),
maneja el submit contra `/auth/token`, retry por timeout, y decodifica el JWT si `/auth/me`
falla. `RegisterClient.tsx` es el formulario de registro de cliente, con su propia lógica de
submit contra `/auth/client-register`. Ambas rutas (`/login`, `/register-client`) se renderizan
dentro del mismo `<main>` de auth en `App.jsx`, que hoy aplica la clase `app-main-shell-bg`
(gradientes radiales + vignette) — ese `<main>`, no los componentes de página, es la fuente real
del background decorativo. Todo el comportamiento de negocio (auth, registro) se mantiene
intacto; el cambio es de markup/estilos.

## Goals / Non-Goals

**Goals:**
- Formulario centrado (sin columna de marketing) con solo Usuario, Contraseña, botón Entrar y
  link a registro.
- Background plano y consistente entre `/login` y `/register-client`, sin blobs de blur ni
  vignette decorativo.
- Sin mensajes de estado verbosos (contador, aviso de backend, banner demo, subtítulo) en login.
- Header de marca consistente ("Gym App" + logo) en ambas vistas.
- Mismo ancho de card (`max-w-lg`) en ambas vistas.
- Responsive en un solo layout (no depende de breakpoints `lg:` para mostrar/ocultar contenido
  estructural).

**Non-Goals:**
- No se toca la lógica de auth ni de registro (`onSubmit`, `requestTokenWithRetry`,
  `/auth/client-register`, manejo de JWT/roles).
- No se agregan nuevos campos (ej. "recordarme", SSO, etc.).
- No se cambia el flujo de navegación entre `/login` y `/register-client`.

## Decisions

- **Layout de una sola columna**: se elimina la `<section className="hidden lg:block">` de
  marketing y el grid de dos columnas. El `<form>` pasa a estar centrado con `max-width` fijo
  (`max-w-lg`) dentro del `<main>` de auth, que ya centra con flex.
  Alternativa descartada: mantener la columna oculta en mobile — se descarta porque agrega
  complejidad sin aportar al objetivo de simplificar.
- **Background plano, a nivel `<main>`**: el vignette real vivía en la clase `app-main-shell-bg`
  aplicada al `<main>` de auth en `App.jsx` (no en los componentes de página) — un `div` opaco
  dentro de un flex-item sin ancho/alto explícito no la tapaba, dejándola visible en los bordes.
  Se reemplaza esa clase por `bg-zinc-950` plano directamente en el `<main>`, y los componentes
  de página dejan de declarar su propio `min-h-screen`/background (evita duplicar layout).
  Alternativa descartada: mantener `app-main-shell-bg` y forzar `w-full h-full` en cada página —
  más frágil, dos lugares para mantener el mismo fondo.
- **Header del form**: logo (`/mini-espacio-logo.svg`) + texto "Gym App", igual en Login y
  RegisterClient. Se quitan "Acceso seguro", "Entrenamientos personalizados", "Ingresar al
  panel", y en RegisterClient el eyebrow "Registro de cliente" + título "Crear acceso personal"
  se reemplazan por el mismo header de marca (se conserva el subtítulo explicativo del registro,
  que no es mensajería de estado sino contexto del formulario).
- **Loading state**: el botón "Entrar"/"Crear cuenta y entrar" mantiene su estado disabled +
  texto de progreso durante el submit, sin mensajería adicional.
- **Link de registro**: se conserva el mismo `onClick={() => navigate("/register-client")}`,
  cambia únicamente el texto a "Registrar cuenta".
- **Card sin shadow/backdrop-blur decorativo**: ambos formularios usan `bg-zinc-900/95` sólido
  sin `shadow-[...]` con blur naranja ni `backdrop-blur-xl`, consistente con el fondo plano.
- Se elimina el bloque "Demo operativa lista para seguimiento diario" y el footer de copyright
  de Login por ser mensajería no esencial.

## Risks / Trade-offs

- [Se pierde el timer de "cuanto tarda el login"] → Aceptado explícitamente por el usuario; el
  botón sigue mostrando "Ingresando..." como único feedback de loading.
- [Menos contexto de marca en desktop al quitar el panel de marketing] → Aceptado; el logo +
  nombre en el header del form mantiene la identidad mínima necesaria.
- [Cambiar `app-main-shell-bg` en `App.jsx` afecta el `<main>` compartido por login y registro] →
  Mitigado: esa clase solo se usaba en el wrapper de rutas de auth (`isAuthRoute`), no en el
  `<main>` de la app autenticada (`app-shell-bg`/`app-main-shell-bg` del resto de vistas no se
  tocan).
