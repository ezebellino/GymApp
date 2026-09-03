## Why

Hoy el error de login (credenciales inválidas, error de conexión) se muestra con `alertError`
(`src/lib/alerts.ts`), un wrapper sobre SweetAlert2 que renderiza un modal bloqueante. Es una UX
pesada para un error de formulario: interrumpe el flujo, exige un click para cerrar y no se
integra con el resto del sistema de diseño (shadcn/Tailwind). Vamos a adoptar **Sileo**
(`sileo`, https://sileo.aaryan.design/) — un componente de toasts para React con morfismo SVG y
física de resorte, API minimalista (`sileo.success/error/info(...)` + `<Toaster />`) — como
sistema de notificaciones toast, empezando por el error de login, dejando la base lista para
migrar el resto de los usos de `alertError`/`alertSuccess`/etc. en cambios futuros.

## What Changes

- Agregar la dependencia `sileo` (`npm install sileo`) a `frontend/package.json`.
- Montar `<Toaster />` (de `sileo`) una sola vez a nivel global, en `src/App.jsx`, para que esté
  disponible en rutas de auth y del dashboard.
- Reemplazar el uso de `alertError` en `Login.tsx` (login fallido: credenciales inválidas / error
  de conexión) por `sileo.error({ title, description })`.
- Agregar un helper delgado en `src/lib/toast.ts` que centralice las llamadas a
  `sileo.success/error/info`, para no invocar `sileo` directo desde las páginas y mantener un
  único punto de estilo/posición/copy.
- **BREAKING (interno, no de API)**: el error de login deja de bloquear la UI con un modal; pasa
  a ser un toast no bloqueante. No cambia el copy de los mensajes existentes.
- Fuera de alcance de este cambio: migrar el resto de los usos de `alertError`/`alertSuccess`/
  `confirmAction` (SweetAlert2) en otras pantallas — se hace en cambios posteriores, cambio por
  cambio, para no expandir el blast radius de este PR.
- Nota: el proyecto ya tenía `sonner` instalado (con un wrapper shadcn sin usar en
  `src/components/ui/sonner.tsx`); no se usa en este cambio, se deja tal cual para no generar
  ruido — se puede remover en un cambio de limpieza aparte si queda sin uso.

## Capabilities

### New Capabilities
- `toast-notifications`: sistema de notificaciones toast (no bloqueantes) basado en **Sileo**,
  disponible globalmente en la app vía un `<Toaster />` montado una vez y un helper único de
  disparo (`toastError`/`toastSuccess`/`toastInfo`).

### Modified Capabilities
- (ninguna spec existente en `openspec/specs/` cubre hoy el feedback de error de login; no hay
  requirement de una capability ya documentada que cambie — se deja vacío)

## Impact

- `frontend/package.json`: se agrega la dependencia `sileo`.
- `frontend/src/App.jsx`: se agrega el `<Toaster />` global de sileo.
- `frontend/src/pages/Login.tsx`: se reemplaza la llamada a `alertError` en el catch de login por
  el nuevo helper de toast.
- `frontend/src/lib/toast.ts` (nuevo): helper de disparo de toasts sobre `sileo`.
- Sin impacto en backend, API ni modelos de datos.
- `sweetalert2` sigue instalado y en uso para el resto de los flujos (fuera de alcance).
- `sonner` queda instalado sin usar (preexistente); no se toca en este cambio.
