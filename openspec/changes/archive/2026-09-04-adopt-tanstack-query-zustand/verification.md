# Verificación: adopt-tanstack-query-zustand

**Fecha**: 2026-09-03 (primera ronda) / 2026-09-04 (re-verificación tras fixes)
**Veredicto**: PASA CON RESERVAS
**Diff verificado**: working tree en `main` sin commitear (`git diff HEAD -- frontend/`), 70/70 tasks de `tasks.md` marcadas `[x]` + una ronda de fixes post-FALLA. `git diff --stat HEAD -- backend/` vacío en ambas rondas — confirmado que el change no tocó el backend.

## Ronda 1 (FALLA) → Ronda 2 (re-verificación)

La primera pasada de Code Reviewer + QA dio **FALLA**: 1 bloqueante, 2 mayores y 2 fallas de escenario de spec confirmadas en UI real. Se devolvió a `role-dev` con la lista priorizada; el Dev corrigió los cuatro y además 4 hallazgos menores. Se volvió a correr Code Reviewer + QA, esta vez enfocados en confirmar cada fix contra el código y la app real.

## Hallazgos de la ronda 1 — estado final

1. **[bloqueante]** `Topbar.tsx:59` (`setIsAuthed` inexistente rompía `handleLogout`) — **RESUELTO**. Confirmado por código (línea muerta eliminada, `isAuthed` derivado de `!!token`) y en UI real: logout de Dueño y de Coach corren sin excepción, SweetAlert de confirmación visible, redirect limpio a `/login`, sin errores en consola.
2. **[mayor]** `http.ts:21-22` (interceptor pisaba `Authorization` explícito de `/auth/me`) — **RESUELTO**. El interceptor ahora solo setea el header si el caller no lo trajo explícito. Verificado con test dirigido al adapter de axios y en UI real: Dueño sin logout → login como Coach en la misma pestaña → sesión resultante 100% del Coach (token, nombre, rol, menú), sin mezcla. Nit no bloqueante: la condición es case-sensitive (`Authorization` vs `authorization`); no hay ningún caller hoy que use minúscula.
3. **[mayor]** `Settings.tsx:148,150` (escritor directo de `localStorage["app_settings"]`) — **RESUELTO**. `grep -rn "localStorage" frontend/src` ya no devuelve accesos reales en `Settings.tsx` (solo un comentario). El criterio de cierre de la task 9.6 queda cumplido para este archivo; sigue habiendo lectores legacy fuera de alcance ya documentados (`UserCard.tsx`, `NewPaymentDialog.tsx`) — no son parte de este hallazgo.
4. **[falla de spec]** `settings.ts:99` (tema no sobrevivía a reload sin "Guardar cambios") — **RESUELTO**. Causa real tenía dos partes: el swatch no escribía al store, y `useSyncSettings` pisaba `theme_preference` en cada carga/refoco. Ambas corregidas. Verificado en UI real: cambio de tema sin guardar → reload en `/settings` y en `/dashboard` → el tema elegido persiste. Verificado además que el resto de la configuración (`gym_name`, etc.) sigue respetando "el servidor manda sobre lo persistido" — se probó forzando una divergencia real vía API y confirmando que el campo no-tema se actualiza al reload mientras el tema local se mantiene.

## Hallazgos menores — estado

- `session.ts:132` (`jwtDecode` sin `try/catch`) — **RESUELTO**.
- `test/setup.ts:37-43` (orden de reset, fuga de `logoutTimer`) — **RESUELTO**, confirmado que el adaptador de persist escribe sincrónicamente antes del `localStorage.clear()`.
- `session.ts:85` (variable `sessionStorage` sombreaba el global) — **RESUELTO** (`sessionPersistStorage`).
- `Payments.tsx:100-115` (filtro derivado en efecto post-render) — **RESUELTO** con lazy initializers; se confirmó que la navegación intra-vista (cambiar `client_id` en la URL sin remount) sigue funcionando porque el `useEffect` sobre `location.search` se conservó.

## Reservas (no bloquean este veredicto, quedan documentadas)

1. **[menor, nuevo]** `Payments.tsx:207` — `setSettings(data)` tras el `PATCH /settings` del recordatorio de pago escribe la respuesta completa del servidor al store, **incluido `theme_preference`**, sin el mismo descarte que se aplicó en `useSyncSettings`. Escenario: elegir un tema sin guardar → ir a `/payments` → "Enviar recordatorios" → el tema local se pisa con el del servidor. Es la misma clase de bug que el hallazgo 4, con la mitad del arreglo sin aplicar en este segundo punto de escritura.
2. **[menor]** `http.ts:21` — el chequeo de header explícito es case-sensitive; no hay caller real afectado hoy.
3. **[menor]** Redacción de la task 9.6 en `tasks.md`: el grep de cierre no nombra las excepciones legítimas (`UserCard.tsx`, `NewPaymentDialog.tsx`, `Dashboard.test.tsx`) que siguen apareciendo — no es un residuo de esta migración, pero la letra de la task no matchea la realidad.
4. Hallazgos ya conocidos y explícitamente no tocados en esta ronda (fuera de foco, requieren decisión de producto o un change posterior):
   - Indicador de carga no equivalente entre las 4 vistas (`Clients.tsx` usa skeleton, el resto spinner+texto) — sigue siendo una falla de la letra del requirement "Estado de carga consistente".
   - `useUpdateClientMutation` sin consumidor (duplica la regla de invalidación con el `onSuccess` manual de `Clients.tsx`).
   - `PUT`/`PATCH` de settings no invalidan `queryKeys.settings.all` — un guardado fallido "solo local" puede perderse en silencio ante la próxima revalidación.
   - `useDashboardData.ts`: `revenueMonth`/`clientsWithoutPayment` calculados (con su query extra) pero no renderizados — preexistente a la migración.
   - Hallazgos colaterales fuera de alcance del change: diálogo de error atascado en `EditClientDialog` (bug de Radix `aria-hidden`/focus-trap); posible carrera de varios `Swal.fire()` por 401 casi simultáneos en `/dashboard` (4 queries concurrentes) que puede no dar tiempo a ver el aviso de "sesión expirada" antes del redirect.

## Escenarios de la spec — resultado final

Todos los escenarios de los 4 specs (`login-view`, `session-state`, `server-data-cache`, `app-settings-state`) **PASAN**, incluidos los que habían fallado en la ronda 1 (logout, cambio de sesión sin logout previo, persistencia del tema). El detalle completo de la primera pasada (47 escenarios) está en el historial de este archivo; la re-verificación confirmó puntualmente los 4 escenarios que habían fallado más 2 de regresión (registrar un pago, recargar con sesión vigente), todos en verde contra la app real (Docker).

Gates en ambas rondas: `npm run lint`, `npm run build`, `make test-frontend` (4 archivos / 8 tests) en verde, sin editar los tests existentes. `make test` completo (backend 16 + frontend 8) en verde.

## Sin verificar

- "Volver a abrir la app" (session-state): inferido por el mecanismo de persistencia, no se probó cerrando y reabriendo la pestaña/navegador literalmente.
- Ausencia de "flash" sub-frame del tema antes del primer paint de React: verificado por lectura de código (`applyTheme` corre sincrónicamente al importar el store, antes de `ReactDOM.render`), no por captura visual de un frame intermedio — el tooling de QA no tuvo forma de instrumentar eso de forma confiable.
- Cierre del menú móvil al hacer logout: verificado por lectura de código (la llamada es incondicional y anterior al `await` del `Swal`), no por captura en viewport móvil — el set de herramientas de QA no tenía control de resize/emulate de viewport en esta sesión.

## Conclusión

**PASA CON RESERVAS.** No quedan bloqueantes ni mayores. Las reservas son todas de severidad menor y no representan riesgo para los flujos principales del change; la más relevante (`Payments.tsx:207`) es de bajo alcance (requiere un tema sin guardar + una acción específica de Pagos) y de la misma naturaleza que un bug ya corregido, por lo que es barato de replicar el fix si se decide hacerlo ahora en vez de después.

Queda a criterio del usuario: (a) pedir un fix puntual de la reserva 1 antes de archivar, o (b) aceptar el PASA CON RESERVAS y seguir con `/opsx:sync` y `/opsx:archive`, dejando las reservas registradas para un change posterior o una iteración rápida.
