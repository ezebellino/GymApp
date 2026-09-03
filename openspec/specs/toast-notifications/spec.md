## Purpose

Sistema de notificaciones toast (no bloqueantes) de la app, basado en **Sileo**, disponible
globalmente vía un `<Toaster />` montado una vez y un helper único de disparo
(`toastError`/`toastSuccess`/`toastInfo`). Complementa a SweetAlert2 (`src/lib/alerts.ts`), que
sigue en uso para confirmaciones bloqueantes (`confirmAction`) y otras pantallas aún no
migradas.

## Requirements

### Requirement: Toaster global montado
La aplicación SHALL montar un único componente `Toaster` (de la librería `sileo`) a nivel raíz,
disponible tanto en rutas de autenticación (`/login`, `/register-client`) como en las rutas del
layout autenticado.

#### Scenario: Toast disparado desde cualquier ruta
- **WHEN** un componente de cualquier ruta de la app dispara un toast (`toastError`,
  `toastSuccess` o `toastInfo`)
- **THEN** el toast se renderiza visible en pantalla, sin necesidad de montar un `Toaster`
  adicional en esa página

### Requirement: Helper único de disparo de toasts
El sistema SHALL exponer un helper centralizado (`src/lib/toast.ts`) con funciones
`toastError`, `toastSuccess` y `toastInfo` que envuelven las llamadas a `sileo.error/success/info`,
de modo que las páginas no invoquen `sileo` directamente.

#### Scenario: Disparo de un toast de error
- **WHEN** se llama a `toastError(mensaje)` (opcionalmente con una descripción)
- **THEN** se muestra un toast de tipo error con ese mensaje, usando el ícono/estilo de error de
  Sileo

#### Scenario: Disparo de un toast de éxito
- **WHEN** se llama a `toastSuccess(mensaje)`
- **THEN** se muestra un toast de tipo éxito con ese mensaje

### Requirement: Error de login mostrado como toast no bloqueante
Cuando el login falla, el sistema SHALL mostrar el error mediante el helper de toast en lugar de
un modal bloqueante, preservando el mensaje según la causa del fallo.

#### Scenario: Credenciales inválidas
- **WHEN** el usuario envía el formulario de login y la API responde 400 o 401
- **THEN** se muestra un toast de error con el mensaje "Credenciales inválidas" (y detalle
  "Verifica usuario y contraseña"), y el formulario permanece interactivo sin modal bloqueante

#### Scenario: Error de conexión con el backend
- **WHEN** el usuario envía el formulario de login y la request falla sin respuesta del servidor
  (error de red/timeout)
- **THEN** se muestra un toast de error con el mensaje "Error de conexión" (y detalle "No se pudo
  contactar al servidor. Intenta de nuevo en unos minutos."), sin bloquear la UI con un modal
