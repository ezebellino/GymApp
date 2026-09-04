## Why

Tres inconsistencias visuales del frontend afectan la percepción de calidad de la app: el input
de usuario del login pierde legibilidad en ciertos estados (texto oscuro sobre fondo oscuro), el
sidebar tiene una sección "Atajos" redundante con la navegación principal más una barra de scroll
antiestética, y el padding/ancho de contenido varía de una vista autenticada a otra en vez de
seguir el estándar que ya usa Dashboard.

## What Changes

- **Login — contraste del input de usuario**: el texto de los campos "Usuario" y "Contraseña"
  SHALL leerse con contraste suficiente en todos sus estados (vacío, tipeado, focus,
  autocompletado del navegador con o sin gestor de contraseñas), no solo en el caso ya cubierto
  hoy.
- **Sidebar — sin sección "Atajos"**: se elimina el bloque "Atajos" (título, descripción y
  botones de acceso directo) del sidebar, que duplica navegación ya presente en el nav principal.
  Se mantiene el bloque "Contexto" (selector de vista Dueño/Coach).
- **Sidebar — scroll discreto**: la barra de scroll vertical del sidebar deja de ser un elemento
  visual prominente y permanente.
- **Layout — padding/ancho unificado**: todas las vistas del shell autenticado (Dashboard,
  Clientes, Pagos, Asistencia, Rutinas, Mi rutina, Reportes, Ajustes) usan el mismo padding
  horizontal, padding vertical y ancho máximo de contenido que Dashboard hoy, sin padding
  duplicado por contenedores anidados.
- No cambia lógica de negocio ni contratos de API — es un cambio de UI/UX y consistencia visual.

## Capabilities

### New Capabilities
- `app-shell`: comportamiento transversal del shell autenticado (sidebar de navegación y
  layout/padding compartido por todas las vistas con sidebar), independiente del contenido
  particular de cada vista.

### Modified Capabilities
- `login-view`: se agrega el requirement de contraste legible en los campos de usuario y
  contraseña en todos sus estados (incluyendo autocompletado del navegador).

## Impact

- Código afectado (referencia, no exhaustivo — el mecanismo lo define `design.md`):
  - `frontend/src/pages/Login.tsx`, `frontend/src/components/ui/input.tsx`,
    `frontend/src/index.css` (contraste del input).
  - `frontend/src/components/Sidebar.tsx`, `frontend/src/index.css` (sección "Atajos" y
    `.warm-scrollbar`).
  - `frontend/src/App.jsx` y los wrappers raíz de `Dashboard.tsx`, `Clients.tsx`, `Payments.tsx`,
    `Attendance.tsx`, `Routines.tsx`, `UserRoutine.tsx`, `NewCoach.tsx`, `Reports.tsx`,
    `Settings.tsx` (padding/ancho unificado).
- Fuera de alcance: `Login.tsx` y `RegisterClient.tsx` no comparten el shell con sidebar, no se
  les aplica el requirement de layout unificado. Los estados de `loading` internos de cada
  página no cambian. `frontend/src/components/Layout.tsx` no se usa en el árbol real, no aplica.
- No afecta backend, API ni modelos de datos.
