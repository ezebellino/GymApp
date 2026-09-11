## 1. Backend: proteger los endpoints

- [x] 1.1 En `backend/app/routers/settings.py`, importar `get_current_user` y `require_role` de
  `..auth` y `UserRole` de `..models`, y declarar el router con
  `dependencies=[Depends(get_current_user)]` (dec. D1). No cambiar el prefijo ni los paths: siguen
  siendo `@router.get("")` / `put("")` / `patch("")` sobre `/settings`.
- [x] 1.2 En el mismo archivo, agregar a `put_settings` y `patch_settings`
  `dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))]` en el decorador. `GET` no
  lleva nada extra: hereda el piso del router y queda abierto a los tres roles (dec. D1).
- [x] 1.3 En `backend/app/routers/payments.py`, agregar
  `dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))]` a `list_payments`
  (`@router.get("/")`) y a `get_payment` (`@router.get("/{payment_id}")`). Sin dependencia a nivel
  de router (dec. D2). No tocar `create_payment`, `delete_payment` ni los `reports/*`.
- [x] 1.4 En `backend/app/routers/attendance.py`, agregar
  `dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))]` a `list_attendance`
  (`@router.get("/")`), sin tocar `checkin`.
- [x] 1.5 En el mismo archivo, sacar `dependencies=[Depends(optional_bearer)]` del `APIRouter` y
  borrar el import `from ..security import optional_bearer` (dec. D3). **No** modificar
  `backend/app/security.py`: `optional_bearer` sigue en uso en `backend/app/routers/auth.py`.
- [x] 1.6 Correr `make lint-backend` y `make test-backend` y confirmar que la suite existente sigue
  verde antes de escribir tests nuevos (detecta de una si algún test previo dependía de que estos
  endpoints fueran públicos).

## 2. Backend: tests de autorización

- [x] 2.1 Crear `backend/tests/test_settings.py` con docstring de módulo que apunte a la capability
  `staff-endpoint-authorization`. Usar las fixtures de `conftest.py` (`client`, `owner_user`,
  `coach_user`, `client_user`, `auth_header`) y el patrón de `test_roles.py`. Pedir siempre el path
  exacto `/settings`, **sin** barra final (dec. D9: con barra, `TestClient` sigue un 307 a una ruta
  inexistente).
- [x] 2.2 En `backend/tests/test_settings.py`, escribir `test_get_settings_sin_token_responde_401` y
  `test_get_settings_con_token_invalido_responde_401` (este último con
  `headers={"Authorization": "Bearer no-es-un-token"}`); ambos verifican además que el cuerpo no
  trae campos de configuración.
- [x] 2.3 En `backend/tests/test_settings.py`, escribir `test_get_settings_con_miembro_responde_200`
  y `test_get_settings_con_owner_y_con_coach_responde_200`, este último comparando que el cuerpo
  devuelto a Dueño y a Coach es el mismo (invariante I2).
- [x] 2.4 En `backend/tests/test_settings.py`, escribir
  `test_put_settings_sin_token_responde_401_y_no_modifica` y
  `test_patch_settings_con_miembro_responde_403_y_no_modifica`: además del código de respuesta,
  releer la configuración con un token de Dueño y confirmar que el valor no cambió.
- [x] 2.5 En `backend/tests/test_settings.py`, escribir `test_put_settings_con_coach_actualiza`
  (200 + el campo modificado se relee cambiado). El `PUT` exige el body completo de
  `schemas.Settings`: armarlo partiendo del `GET` previo y cambiando un solo campo.
- [x] 2.6 En `backend/tests/test_payments.py`, agregar `test_list_payments_sin_token_responde_401`,
  `test_list_payments_con_miembro_responde_403`, `test_get_payment_sin_token_responde_401` y
  `test_get_payment_con_miembro_responde_403`, reusando el helper `_create_member` que ya está en
  ese archivo. Los paths llevan barra final (`/payments/`).
- [x] 2.7 En `backend/tests/test_payments.py`, agregar las dos regresiones de la spec:
  `test_coach_lista_y_lee_un_pago` (Coach crea un pago, lo lista y lo lee: 200 en las tres) y
  `test_coach_no_puede_anular_un_pago` (403 en `DELETE /payments/{id}`, invariante I3).
- [x] 2.8 En `backend/tests/test_attendance.py`, agregar
  `test_list_attendance_sin_token_responde_401`, `test_list_attendance_con_miembro_responde_403` y
  `test_coach_lista_el_historial_de_asistencias` (200 tras un check-in). Ampliar el docstring del
  módulo, que hoy solo habla del check-in por `q`.
- [x] 2.9 Correr `make test-backend` y `make lint-backend`: todo verde.

## 3. Frontend: ruta pública como fuente única

- [x] 3.1 En `frontend/src/lib/navigation.ts`, exportar `PUBLIC_ROUTE_PREFIXES = ["/login",
  "/invitacion"]` y `isPublicPath(pathname: string): boolean` (match por `startsWith`, dec. D5),
  con un comentario que explique que es la única definición de "vista pública" del repo y que la
  consumen `App.jsx` y `lib/http.ts`.
- [x] 3.2 En `frontend/src/App.jsx`, reemplazar el cálculo inline de `isAuthRoute` por
  `isPublicPath(location.pathname)`. Sin cambios de comportamiento: es el mismo `startsWith` sobre
  los mismos dos prefijos.
- [x] 3.3 En `frontend/src/lib/__tests__/navigation.test.ts`, agregar los casos
  `isPublicPath reconoce /login y /invitacion/:channel/:token como publicas` y
  `isPublicPath no marca publica una ruta protegida` (probar `/dashboard`, `/payments`, `/`).

## 4. Frontend: 401 en vista pública

- [x] 4.1 En `frontend/src/lib/http.ts`, extraer el cuerpo del interceptor de respuesta a una
  función nombrada y exportada (por ejemplo `handleResponseError`) para que sea testeable sin red,
  y seguir registrándola con `api.interceptors.response.use((r) => r, handleResponseError)`.
- [x] 4.2 En esa función, envolver el bloque de 401 con la guarda
  `if (isPublicPath(window.location.pathname)) return Promise.reject(error);` **antes** del toast:
  en vista pública no se toastea, no se llama a `logout()` y no se redirige (dec. D6). La rama de
  vista protegida queda idéntica a hoy (toast + `logout()` + `window.location.href = "/login"`), y
  las dos ramas terminan en `Promise.reject(error)`.
- [x] 4.3 Documentar en un comentario corto arriba de la guarda por qué en vista pública tampoco se
  desloguea (carrera con el `setSession` del flujo de login, dec. D6), para que no se "arregle" más
  adelante agregando el `logout()`.
- [x] 4.4 Crear `frontend/src/lib/__tests__/http.test.ts` con los casos
  `un 401 en una vista publica no toastea sesion expirada ni cierra la sesion` y
  `un 401 en una vista protegida toastea sesion expirada y cierra la sesion`. Mockear `./toast`
  con `vi.mock` y llamar a `handleResponseError({ response: { status: 401 } })` directamente;
  posicionar la ruta con `window.history.pushState({}, "", "/login")` / `"/payments"`. Afirmar sobre
  `toastError` y sobre `useSessionStore.getState().token`, no sobre `window.location` (jsdom no
  implementa navegación).

## 5. Frontend: no pedir /settings sin sesión

- [x] 5.1 En `frontend/src/services/settings.queries.ts`, hacer que `useSettingsQuery` lea
  `const token = useSessionStore((s) => s.token)` y declare `enabled: !!token`, con el mismo
  comentario de intención que `useMeQuery` en `services/me.queries.ts` (dec. D4). `useSyncSettings`
  no se mueve de `App.jsx` ni cambia de forma: sigue siendo el único escritor del store (invariante
  I7).
- [x] 5.2 Crear `frontend/src/services/__tests__/settings.queries.test.tsx` con un componente sonda
  mínimo que monte `useSyncSettings()`, renderizado con `renderWithProviders` y con
  `vi.mock("@/lib/http")` sobre `createApiMock()` (`frontend/src/test/apiMock.ts`).
- [x] 5.3 En ese archivo, escribir `no pide GET /settings cuando no hay sesion` (sin
  `access_token` en `localStorage`: `api.get` nunca recibe `/settings`) y
  `pide GET /settings cuando hay token en la sesion` (sembrando `localStorage` en el `beforeEach`
  del propio test, que `renderWithProviders` rehidrata antes de renderizar).
- [x] 5.4 Correr `make test-frontend` y `make lint-frontend`: todo verde.

## 6. Cierre

- [x] 6.1 Correr `make check-plan CHANGE=secure-staff-endpoints`: sin `FALLA` (todos los casos de la
  tabla de Tests del design tienen que existir con el nombre exacto).
- [x] 6.2 Correr `make lint` y `make test` completos y confirmar que las dos apps quedan verdes.
- [x] 6.3 Verificación manual de las dos filas `manual` del `## Plan de verificación` de
  `design.md` (recorrido en `/login`, `/invitacion`, Dueño y Miembro con `make seed-dev`; y los tres
  `curl` que deben dar 401). Dejar registro en `verification.md` durante `/opsx:verify`.
- [x] 6.4 Revisar que el diff **no** incluya `backend/app/auth.py`, `backend/app/security.py`,
  `backend/app/deps.py`, `backend/app/routers/auth.py` ni ninguna migración (invariante I8).
