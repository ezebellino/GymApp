## Why

El frontend hoy ofrece 3 paletas dark seleccionables (`dark-gold`, `dark-copper`, `dark-olive`)
que son variaciones de la misma identidad y no dan opción de modo claro. El issue
[#24](https://github.com/ezebellino/GymApp/issues/24) pide un rediseño visual con una identidad
única y consistente ("Kinetic Obsidian"), ya documentada en detalle en
[docs/design/design.md](../../../docs/design/design.md), más la posibilidad de elegir entre modo
oscuro y modo claro — algo que hoy no existe y que resuelve un pedido real de usuarios que
prefieren trabajar con la app en ambientes muy iluminados. El modo (dark/light) es una preferencia
de cada persona, no del negocio: dos personas que usan la misma cuenta de gimnasio pueden querer
verla distinto al mismo tiempo, sin pisarse.

## What Changes

- Reemplazar las 3 paletas actuales (`dark-gold`, `dark-copper`, `dark-olive`) por un único tema
  visual, "Kinetic Obsidian", con dos modos: dark (tactical) y light ("Crisp Slate"). **BREAKING**
  para cualquier preferencia de tema ya persistida: los 3 ids de paleta dejan de ser válidos y se
  resuelven a uno de los dos modos.
- El modo dark/light pasa a ser una **preferencia del usuario logueado**, no de la configuración
  del negocio: cada persona (Dueño, Coach o cliente del portal) elige su propio modo, que la sigue
  entre dispositivos y sesiones, sin afectar lo que ven otros usuarios logueados al mismo tiempo.
  Deja de vivir en la configuración de Ajustes.
- El control para alternar el modo (toggle/switch dark ↔ light) pasa a vivir en el shell
  autenticado (barra superior), no en la vista de Ajustes, para que sea alcanzable por los 3 roles
  — incluido el cliente del portal, que no tiene acceso a Ajustes.
- El modo elegido se sigue aplicando a toda la app apenas se cambia (sin recargar) y sigue
  persistiendo entre recargas y entre dispositivos, igual que el comportamiento actual de tema —
  solo cambia el dueño del dato: pasa de ser un valor compartido por todo el negocio a ser propio
  de cada usuario.
- Aplicar la nueva identidad visual (colores, tipografía, spacing, formas, elevación) descripta en
  `docs/design/design.md` a todo el shell autenticado: sidebar, barra superior, hero del
  Dashboard, KPI cards, tablas, botones y formularios. Es un cambio de tema global, no de una
  vista puntual.
- El Sidebar reemplaza la card única "Contexto" (párrafo descriptivo del rol) por dos elementos
  separados: un badge corto de rol (mismo texto que hoy, "Vista {Dueño/Coach/Usuario}") y, debajo,
  una card compacta de identidad con el nombre y el email del usuario logueado. El nombre ya
  existe en la sesión (`useSessionStore.userName`); el email hoy **no** se persiste ahí
  (`stores/session.ts` solo guarda `token`, `userName`, `role`, `exp` — el JWT lo trae pero no se
  decodifica a estado), así que hace falta agregarlo a la sesión o resolverlo de otra fuente (el
  Arquitecto puede evaluar si conviene reusar la query a `GET /auth/me` que ya suma el `design.md`
  para el tema, en vez de tocar el decode del JWT).
- No hay cambios de funcionalidad de producto ni de roles/permisos: todo lo que ya funciona
  (guardar configuración de negocio en Ajustes, formularios, etc.) sigue funcionando igual. Único
  cambio de navegación acotado: el botón "Nuevo cliente" del top bar (Dueño) se reemplaza por el
  toggle de tema en los dos call sites de `Topbar.tsx`, ver `design.md` dec. 11 — el atajo de
  creación de cliente sigue disponible desde el Dashboard y desde `/clients`. El único cambio de
  modelo de datos es el descripto en Impact para soportar el modo por usuario.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `app-settings-state`: se elimina el requirement "El tema visual se aplica en toda la app y
  persiste" — el modo de tema deja de ser configuración del negocio y se muda a `session-state`.
- `session-state`: nuevo requirement de preferencia de tema visual propia de cada usuario —
  aplicación inmediata sin recargar, persistencia entre recargas y entre dispositivos/sesiones (le
  sigue al usuario, no al dispositivo ni al negocio), e independencia entre usuarios logueados al
  mismo tiempo (cambiar el propio modo no afecta lo que ven los demás).
- `app-shell`: el shell autenticado agrega un control (toggle dark/light) alcanzable desde
  cualquier rol logueado, no solo desde Ajustes; y el Sidebar reemplaza la card "Contexto" por un
  badge de rol + una card de identidad (nombre y email) del usuario logueado.
- `settings-view`: la vista de Ajustes deja de tener una card/control de tema visual (se mudó a
  `app-shell`); se corrigen las menciones a "tema visual" en el Purpose y en los requirements de
  cards de previsualización y de formularios sin cambios funcionales.

## Impact

- Frontend: `frontend/src/lib/theme.ts` (tipos y helpers de tema), el shell autenticado (barra
  superior, donde pasa a vivir el toggle, y `frontend/src/components/Sidebar.tsx`, donde la card
  "Contexto" se reemplaza por badge de rol + card de identidad), y los estilos globales/tokens que
  consumen el tema actual (sidebar, top bar, Dashboard, tablas, botones, forms). La vista de
  Ajustes deja de tener una card de tema visual. Posiblemente `stores/session.ts` sume el email
  del usuario (o se resuelva vía `GET /auth/me`), a definir por el Arquitecto.
- Backend: cambio de modelo de datos, mínimo e indispensable. El tema deja de ser un campo de
  `app_settings` (fila única del negocio) y pasa a ser un dato del usuario: nueva columna
  `theme_preference` en `users` (modelo `User`, `backend/app/models.py`), con la migración Alembic
  correspondiente (agrega la columna; usuarios existentes quedan en `NULL` y el frontend cae a un
  default razonable — dark — hasta que cada uno elige el suyo). `UserOut`/`GET /auth/me` se
  extiende para exponer el campo, y se agrega una vía para que el usuario autenticado actualice su
  propia preferencia (endpoint exacto a definir por Arquitecto/Dev, `GET/PATCH /auth/me` es el
  candidato natural en `backend/app/routers/auth.py`). Cada usuario solo puede leer/tocar su
  propio valor, sin permisos de rol especiales de por medio.
- `backend/app/schemas.py` (`ThemePreference` a nivel de `Settings`/`app_settings`) **ya no
  cambia**: el tema deja de formar parte de la configuración del negocio.
- No hay cambios en el resto del contrato de Ajustes (`PUT/PATCH /settings`) ni en otros campos de
  `app_settings`.
