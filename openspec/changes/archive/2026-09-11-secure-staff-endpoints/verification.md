# Verificación: secure-staff-endpoints

**Fecha**: 2026-09-11
**Veredicto**: PASA CON RESERVAS · **reservas aceptadas por el usuario**
**Diff verificado**: working tree sin commitear sobre `main` @ `50f278f` (routers `settings`, `payments`, `attendance` + tests; `App.jsx`, `lib/http.ts`, `lib/navigation.ts`, `services/settings.queries.ts` + tests)
**Riesgo declarado**: alto
**Paso 0**: lint OK · test OK · plan OK

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=secure-staff-endpoints` | OK (`riesgo=alto`, sin `FALLA`) |
| Lint | `make lint` | OK (ruff sin offenses; eslint 0 errores / 40 warnings preexistentes; tsc OK) |
| Tests | `make test` | OK (backend 158 passed · frontend 25 archivos, 112 passed) |

## Escenarios de la spec

### `staff-endpoint-authorization`

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| Sin token → `GET /settings` | `curl` sin header + `test_get_settings_sin_token_responde_401` | PASA (401, `{"detail":"Not authenticated"}`) |
| Token inválido → `GET /settings` | `curl` con JWT arbitrario + `test_get_settings_con_token_invalido_responde_401` | PASA (401) |
| Dueño, Coach o Miembro autenticado → `GET /settings` | `curl` con los 3 roles + tests 2.3 | PASA (200, mismo cuerpo para los tres) |
| Sin token → `PUT`/`PATCH /settings` | `curl` + `test_put_settings_sin_token_responde_401_y_no_modifica` | PASA (401, configuración intacta) |
| Miembro intenta editar configuración | `curl` PUT y PATCH + `test_patch_settings_con_miembro_responde_403_y_no_modifica` | PASA (403, `gym_name` sin cambios) |
| Dueño o Coach editan configuración | `curl` PATCH (Coach y Dueño) + UI real (Dueño editó "Horario visible", F5, persistió) + `test_put_settings_con_coach_actualiza` | PASA |
| Sin token → `GET /payments/`, `GET /payments/{id}` | `curl` + tests 2.6 | PASA (401, sin datos) |
| Miembro → pagos | `curl` + tests 2.6 | PASA (403 en listado y detalle) |
| Dueño o Coach → pagos | `curl` (incl. detalle de un pago real) + `test_coach_lista_y_lee_un_pago` | PASA (200) |
| Sin token → `GET /attendance/` | `curl` + `test_list_attendance_sin_token_responde_401` | PASA (401) |
| Miembro → asistencias | `curl` + `test_list_attendance_con_miembro_responde_403` | PASA (403) |
| Dueño o Coach → asistencias | `curl` + UI (Dueño, vista Asistencias) + `test_coach_lista_el_historial_de_asistencias` | PASA (200) |
| Coach sigue registrando pagos y check-ins | `curl` POST `/payments/` y POST `/attendance/checkin` con Coach | PASA (201 ambos) |
| Solo el Dueño anula un pago | `curl` DELETE con Coach + `test_coach_no_puede_anular_un_pago` | PASA (403) |
| Visitante sin sesión en `/login` | UI real: formulario visible, sin toast, sin request a `/settings` en Network | PASA |
| Miembro sin sesión completa su invitación | UI real con token inexistente: "No encontramos esta invitación", sin toast ni redirección, sin request a `/settings` | PASA (ver "Sin verificar": no se probó con un token vigente) |

### `session-state` (delta)

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| 401 de fondo en `/login` no muestra "sesión expirada" | `http.test.ts` + UI real | PASA |
| 401 de fondo en `/invitacion` no interrumpe el flujo | `http.test.ts` + UI real | PASA |
| 401 en vista protegida sigue cerrando la sesión | UI real: JWT con firma inválida en `localStorage` estando en `/dashboard`, recarga → logout + redirección a `/login` una sola vez, sin bucle | PASA |

## QA manual

Corrida por riesgo alto, con la app real (stack Docker, backend reiniciado para tomar el working
tree; usuarios de `make seed-dev`). Además de la tabla de arriba, las dos filas `manual` del Plan
de verificación del design:

- Los tres `curl` sin token (`/settings`, `/payments/`, `/attendance/`) → 401. PASA.
- Recorrido: `/login` e `/invitacion/...` sin sesión (sin toast ni bucle); Dueño ve nombre del
  gimnasio y saludo en el Dashboard (store sincronizado tras el login), guarda Ajustes, lista
  Pagos por API y Asistencias por UI; Miembro entra a Mi rutina y al navegar a mano a `/settings`,
  `/payments` o `/attendance` lo redirige `ProtectedRoute` sin romper la app. PASA.

Notas de QA fuera de escenario: la página `/payments` del frontend está en reconstrucción
(TODO preexistente) y no llama a `GET /payments/`, así que el listado de pagos solo se verificó
por API. Quedó un check-in de prueba en la base de desarrollo (el router no expone DELETE).
Capturas en el scratchpad de la sesión, no en el repo.

## Decisión sobre las reservas

El usuario aceptó los seis hallazgos menores tal como están y autorizó archivar.
Ninguno se arregla en este change. Los seis quedan anotados como deuda para el change de
**U-2 + U-3** (email obligatorio en el alta de Miembro e invitación con un solo link sin envío de
email), que toca el login, el interceptor HTTP y el flujo de invitación de todas formas: ver
`docs/producto/09-backlog-mvp.md`, Fase 0.

## Hallazgos

Ninguno bloqueante. Riesgo declarado (alto) coincide con el criterio de `role-architect`:
el diff altera qué rol exige un endpoint.

1. **[menor]** `frontend/src/services/settings.queries.ts:16` + `frontend/src/lib/http.ts:37-39` —
   con un `access_token` inválido pero no vencido en `localStorage`, abrir `/login` dispara
   `GET /settings` → 401 silenciado (D6) y la query queda en `error`. Tras loguearse, `enabled` ya
   era `true` y la key no cambia, así que react-query no refetchea; como la rama pública no llama a
   `logout()`, tampoco hay `queryClient.clear()`. El store queda con lo persistido (o defaults)
   hasta un focus de ventana o F5. Cierre sugerido: `removeQueries`/`invalidateQueries` sobre
   `queryKeys.settings.all` en `useSignIn` después de `setSession`, sin tocar D6. Sin test.
2. **[menor]** `backend/tests/test_settings.py:29-34` — I2 ("mismo cuerpo para los tres roles")
   solo se compara Dueño vs Coach; el test del Miembro afirma solo el status.
3. **[menor]** `backend/tests/test_settings.py:17,26` — `assert "gym_name" not in response.json()`
   es casi tautológica sobre un cuerpo `{"detail": ...}`; mejor afirmar el cuerpo exacto.
4. **[menor]** `frontend/src/lib/__tests__/http.test.ts:23-25,35-37` — `rejects.toBeDefined()` no
   prueba que se rechaza el mismo error (D6); falta la rama no-401 (un 500 pasa de largo sin toast).
5. **[menor]** `frontend/src/services/__tests__/settings.queries.test.tsx:31-34` —
   `await Promise.resolve()` es una barrera débil para el test negativo; preferir
   `not.toHaveBeenCalled()` o `waitFor` con chequeo positivo alternativo.
6. **[menor]** `frontend/src/lib/__tests__/http.test.ts:31-41` — el test de vista protegida ejecuta
   `window.location.href = "/login"` real (jsdom imprime "Not implemented: navigation"); aislar con
   stub de `window.location`.

Observaciones sin acción en este change: `lib/http.ts` ahora importa `lib/navigation.ts`, que
arrastra `lucide-react` (sin ciclo ni costo de bundle real); `backend/AGENTS.md` dice que
`require_role` vive en `deps.py` cuando está en `auth.py` (drift previo de docs).

## Sin verificar

- Flujo de invitación con un token **vigente** real sin sesión: QA lo probó con un token
  inexistente. El punto de la spec (que un 401 de fondo no interrumpa la vista) queda cubierto por
  `http.test.ts` y por la ausencia del fetch de `/settings` en esa ruta.
- Listado de pagos por UI: la página `/payments` no consume el endpoint hoy (preexistente).
- El hallazgo 1 (store desactualizado tras login con token inválido previo) no tiene test ni
  reproducción manual en esta corrida.
