## Context

`frontend/src/lib/alerts.ts` envuelve SweetAlert2 (`Swal.fire`) para mostrar errores/éxitos como
modales bloqueantes. `Login.tsx` usa `alertError` en el catch del submit para credenciales
inválidas y errores de conexión. Vamos a usar **Sileo** (`sileo`, https://sileo.aaryan.design/),
un componente de toasts para React ("An opinionated toast component for React. SVG morphing,
spring physics, and a minimal API"), instalable con `npm install sileo`. Expone un componente
`<Toaster />` para montar en la raíz y un objeto `sileo` con métodos `success`/`error`/`info`
(y variantes `action`, `promise`, `icon`) que se invocan desde cualquier parte del código:

```javascript
import { sileo, Toaster } from "sileo";

<Toaster position="top-right" />
sileo.error({ title: "Error", description: "..." });
```

El proyecto ya tenía `sonner` instalado (con un wrapper shadcn sin usar en
`src/components/ui/sonner.tsx`) pero nunca se llegó a montar ni a usar — este cambio no lo
adopta; usa Sileo en su lugar según lo pedido.

## Goals / Non-Goals

**Goals:**
- Agregar la dependencia `sileo` y montar `<Toaster />` una única vez, a nivel de app, disponible
  tanto en rutas de auth (`/login`, `/register-client`) como en el layout autenticado.
- Reemplazar el error de login (hoy `alertError`) por `sileo.error(...)`, manteniendo el mismo
  copy de mensajes ("Credenciales inválidas" / "Error de conexión").
- Dejar un helper único (`src/lib/toast.ts`) para disparar toasts, para que el resto de la app no
  importe `sileo` directo y se pueda ajustar posición/copy en un solo lugar.

**Non-Goals:**
- Migrar `alertSuccess`, `alertInfo`, `alertSuccessAutoClose` o `confirmAction` (SweetAlert2) de
  otras pantallas a Sileo — queda para cambios futuros, capability por capability.
- Eliminar `sweetalert2` del proyecto o de `package.json`.
- Remover la dependencia `sonner` preexistente ni su wrapper en `src/components/ui/sonner.tsx`
  (queda sin usar, fuera de alcance de este cambio).
- Cambiar el copy o la lógica de validación de credenciales del login.

## Decisions

- **Sileo sobre mantener SweetAlert2 para este caso**: Sileo es no bloqueante, con animaciones
  livianas (morfismo SVG, spring physics) y API minimalista, evitando el modal pesado de
  SweetAlert2 para un error de formulario. SweetAlert2 se mantiene para `confirmAction`
  (confirmaciones que sí necesitan bloquear con acción explícita del usuario), fuera de alcance.
- **Sileo sobre adoptar el `sonner` ya instalado**: pedido explícito del usuario; Sileo cubre el
  mismo caso de uso (toast no bloqueante) con una API equivalente (`Toaster` + métodos por
  tipo). El `sonner`/`src/components/ui/sonner.tsx` preexistente queda sin tocar.
- **Un solo `<Toaster />` global en `App.jsx`**, no uno por página: Sileo está diseñado para un
  único `<Toaster />` montado en la raíz que escucha los `sileo.*()` disparados desde cualquier
  componente. Se ubica dentro del `div.app-shell-bg` raíz de `App.jsx`, fuera del `if` que
  distingue rutas de auth vs. dashboard, para que esté presente en ambos casos.
- **Helper `src/lib/toast.ts` en vez de llamar `sileo` directo desde `Login.tsx`**: mantiene
  consistencia con el patrón ya usado por `alerts.ts` (funciones nombradas por intención:
  `toastError`, `toastSuccess`, `toastInfo`) y da un único punto para ajustar posición/estilos a
  futuro sin tocar cada call site.
- **No se remueve `alertError` de `alerts.ts`**: otras pantallas lo siguen usando; se retira caso
  por caso en cambios posteriores para no ampliar el blast radius de este PR.

## Risks / Trade-offs

- [Riesgo] Sileo es una librería nueva/poco conocida (no forma parte del stack ya sancionado en
  `frontend/AGENTS.md`, que menciona SweetAlert2/sonner) → Mitigación: se aísla su uso detrás del
  helper `toast.ts`, así que si hay que revertir a `sonner` u otra librería más adelante, el
  cambio queda acotado a ese archivo y al `<Toaster />` en `App.jsx`.
- [Riesgo] Doble sistema de notificaciones conviviendo (SweetAlert2 + Sileo) mientras dura la
  migración incremental → Mitigación: cada capability que se toque documenta cuál usa, y el
  helper `toast.ts` es el único punto de entrada nuevo para no mezclar imports de `sileo` sueltos.
- [Riesgo] Si `<Toaster />` no se monta en el árbol correcto (p. ej. solo dentro de rutas
  autenticadas), los toasts de login no se verían → Mitigación: se monta en `App.jsx` a nivel
  raíz, fuera del `if` de rutas de auth vs. dashboard.
- [Trade-off] El error de login deja de ser un modal bloqueante; un usuario que no vea el toast
  (p. ej. mirando otra parte de la pantalla) puede perderlo más fácil que con un modal → aceptado
  como parte del objetivo de UX (menos fricción); posición y duración por defecto de Sileo se
  ajustan si el usuario lo pide en QA manual.

## Migration Plan

1. Agregar la dependencia `sileo` (`npm install sileo` en `frontend/`).
2. Montar `<Toaster />` (de `sileo`) en `App.jsx`.
3. Crear `src/lib/toast.ts` con `toastError`/`toastSuccess`/`toastInfo` sobre `sileo`.
4. Reemplazar las dos llamadas a `alertError` en el catch de `Login.tsx` por `toastError`.
5. Verificación manual: login con credenciales inválidas y con backend caído, confirmar que
   aparece el toast de Sileo y no el modal de SweetAlert2.
6. Sin rollback especial: revertir el commit restaura `alertError` en `Login.tsx` y remueve la
   dependencia `sileo`; no hay migración de datos ni de API.

## Open Questions

- Ninguna bloqueante para este cambio. Queda abierto para un cambio futuro: si migrar el resto de
  `alerts.ts` a Sileo por completo, y qué hacer con la dependencia `sonner` que queda sin uso.
