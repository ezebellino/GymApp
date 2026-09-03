## 1. Dependencia y Toaster global

- [x] 1.1 Agregar la dependencia `sileo` (`npm install sileo` en `frontend/`).
- [x] 1.2 Montar `<Toaster position="top-right" />` (de `sileo`) en `src/App.jsx`, dentro del
      `div.app-shell-bg` raíz, fuera del `if` que distingue rutas de auth vs. dashboard.
- [x] 1.3 Verificar visualmente que el toast se ve correctamente en tema claro y oscuro.
      (la app es dark-only — `theme="dark"` fijo en el `Toaster`, no hay modo claro que probar)

## 2. Helper de toasts

- [x] 2.1 Crear `src/lib/toast.ts` con `toastError(message, description?)`,
      `toastSuccess(message, description?)` y `toastInfo(message, description?)` sobre
      `sileo.error/success/info({ title, description })`.
- [x] 2.2 Tipar las funciones (TypeScript) siguiendo la convención de `src/lib/alerts.ts`.

## 3. Reemplazo en Login

- [x] 3.1 En `src/pages/Login.tsx`, reemplazar la llamada a `alertError("Credenciales invalidas", ...)`
      (caso 400/401) por `toastError(...)` con el mismo mensaje.
- [x] 3.2 Reemplazar la llamada a `alertError("Error de conexion", ...)` (catch genérico) por
      `toastError(...)` con el mismo mensaje.
- [x] 3.3 Quitar el `import` de `alertError` en `Login.tsx` si ya no se usa ningún otro helper de
      `alerts.ts` en ese archivo.

## 4. Verificación manual

- [x] 4.1 Probar login con credenciales inválidas: confirmar que aparece el toast de error y el
      formulario sigue interactivo (sin modal bloqueante). Verificado en Docker
      (localhost:5173) con Chrome DevTools MCP: toast "Credenciales Invalidas" de Sileo, no
      bloqueante.
- [x] 4.2 Probar login con backend caído/inaccesible: confirmar el toast de "Error de conexión".
      Verificado con el backend apagado: toast "Error De Conexion" de Sileo, se autodescarta solo.
- [x] 4.3 Correr `npm run lint` en `frontend/` y confirmar que no hay errores nuevos.
      (también se corrió `npm run build`, compila sin errores de TS)

## 5. OpenSpec

- [x] 5.1 Correr `/opsx:sync` para llevar la spec `toast-notifications` a `openspec/specs/`.
      También se actualizó el escenario "Credenciales inválidas" en
      `openspec/specs/login-view/spec.md` (mencionaba una "alerta" bloqueante; ahora referencia
      el toast no bloqueante).
- [x] 5.2 Confirmar con el usuario que el comportamiento es el esperado antes de `/opsx:archive`.
      Confirmado: el usuario invocó `/opsx:archive` tras la revisión.
