# Tasks — simplify-settings-view

Orden obligatorio: backend completo y verde (grupos 1–3) antes de tocar el frontend (grupos 4–6),
como pide el `## Migration Plan` del design. Cada task nombra el archivo y qué hacer ahí; las
decisiones D1..D10 del `design.md` son la referencia cuando una task las cita.

## 1. Backend — modelo y migración

- [x] 1.1 `backend/app/models.py`: en la clase `AppSettings` (~líneas 575–587) borrar las 5
      columnas `theme_preference`, `default_fee`, `payment_reminder_message`,
      `payment_reminder_last_sent_at` y `late_fee_grace_days`. **No tocar** la
      `theme_preference` de la línea 129, que es la del modelo `User` y sigue viva.
- [x] 1.2 Correr `alembic heads` dentro de `backend/` y anotar el head que devuelva. D3 dice que
      hoy es `c387dcc091c2` (de `add-exercise-catalog`, sin aplicar), pero el valor que vale es
      el que imprima el comando: si ese change se archivó, se reordenó o se abandonó, el
      `down_revision` apunta al head real, no al literal del design. Tiene que haber **un solo**
      head; si hay dos, parar y avisar antes de seguir.
- [x] 1.3 Generar la migración con `alembic revision -m "drop deprecated app_settings columns"`
      (sin `--autogenerate`: el diff es trivial y el autogenerate arrastra ruido de SQLite) y
      escribir `down_revision` con el head del paso 1.2.
- [x] 1.4 En esa migración escribir `upgrade()` como 5 `op.drop_column("app_settings", ...)` —
      una por campo borrado en 1.1 — sin ningún backfill ni `UPDATE` previo (D2).
- [x] 1.5 En la misma migración escribir `downgrade()` recreando las 5 columnas con
      `op.add_column`, **todas nullable y sin `server_default`**, incluidas `default_fee`
      (Integer) y `late_fee_grace_days` (Integer) que hoy son `NOT NULL`. El downgrade **no**
      restaura datos ni reintroduce el texto del recordatorio (D2).
- [x] 1.6 Aplicar en local con `make migrate` y verificar `alembic heads` = un solo head, y que
      `alembic downgrade -1 && alembic upgrade head` dentro de `backend/` corre sin error (I6).

## 2. Backend — schemas y router

- [x] 2.1 `backend/app/schemas.py`, `SettingsBase` (~líneas 424–436): borrar los campos
      `theme_preference`, `default_fee`, `payment_reminder_message`,
      `payment_reminder_last_sent_at` y `late_fee_grace_days`.
- [x] 2.2 `backend/app/schemas.py`, `SettingsUpdate` (~líneas 482–494): borrar los mismos 5
      campos.
- [x] 2.3 `backend/app/schemas.py`: sacar `"payment_reminder_message"` de la lista del
      `@field_validator(..., mode="before")` de strip (~línea 451) y borrar entero el
      `@field_serializer("default_fee")` (~línea 470).
- [x] 2.4 `backend/app/schemas.py`: borrar el alias `ThemePreference` (~línea 24), cuyos únicos
      usos eran los campos de 2.1/2.2. **No tocar `ThemeMode`** (líneas 130 y 151), que sigue
      vivo en los schemas de `/auth/me` (D4).
- [x] 2.5 `backend/app/schemas.py`: borrar `from decimal import Decimal` (~línea 2) si
      `default_fee` era su único uso en el archivo — verificar con un grep de `Decimal` antes de
      sacarlo. No agregar `extra="forbid"` a ningún schema de settings (D10).
- [x] 2.6 `backend/app/routers/settings.py`: borrar del objeto `DEFAULTS` (~líneas 18–30) las 5
      claves de los campos eliminados, incluido el literal largo de `payment_reminder_message`.
- [x] 2.7 `backend/app/routers/settings.py`, `_apply_brand_refresh`: borrar la rama
      `if not settings.theme_preference` (~líneas 44–45) y la rama
      `if not settings.payment_reminder_message` (~líneas 50–51). **Conservar** la rama de
      `onboarding_message` y las demás reescrituras de marca vieja (D5).
- [x] 2.8 `make lint-backend` y `make test-backend` en verde antes de pasar al grupo 3.

## 3. Backend — tests

Los 3 casos van en `backend/tests/test_settings.py`, que hoy es puro test de autorización: ampliar
el docstring del módulo para que deje de prometer solo eso. Usar el fixture
`auth_header(OWNER_EMAIL)` y el path `/settings` **sin barra final** (con barra el `TestClient`
sigue un 307 y el assert falla por el motivo equivocado).

- [x] 3.1 `backend/tests/test_settings.py`: agregar
      `test_get_settings_no_expone_los_campos_deprecados` — `GET /settings` como Dueño responde
      200 y ninguna de las 5 claves borradas aparece en el JSON.
- [x] 3.2 `backend/tests/test_settings.py`: agregar
      `test_put_settings_persiste_los_campos_vigentes` — `GET` → modificar los 13 campos vigentes
      (`gym_name`, `currency`, `allow_cash`, `allow_transfer`, `admin_name`, `address`,
      `contact_email`, `contact_phone`, `whatsapp_phone`, `business_hours`, `payment_alias`,
      `payment_notes`, `onboarding_message`) → `PUT` → `GET` y comparar valor por valor (I1).
- [x] 3.3 `backend/tests/test_settings.py`: agregar
      `test_put_settings_ignora_los_campos_deprecados_del_body` — `PUT` con un body válido más
      `default_fee`, `late_fee_grace_days`, `payment_reminder_message`,
      `payment_reminder_last_sent_at` y `theme_preference`; esperar **200** (no 422, por D10) y
      esas claves ausentes de la respuesta.
- [x] 3.4 Verificar que `backend/tests/test_theme.py` sigue en verde **sin cambios** (I8): prueba
      `users.theme_preference` vía `/auth/me/theme`, que este change no toca.

## 4. Frontend — tipos y estado compartido

- [x] 4.1 `frontend/src/types.ts`: borrar de `AppSettings` los 5 campos (~líneas 110, 112,
      120–122), incluido el comentario que marcaba `theme_preference` como legacy.
- [x] 4.2 `frontend/src/stores/settings.ts`: borrar de `DEFAULT_SETTINGS` las 5 claves
      correspondientes (~líneas 23–37). Esta constante pasa a ser la única del repo (D9), así que
      actualizar el comentario que hoy admite la copia duplicada de `Settings.tsx`.
- [x] 4.3 `frontend/src/services/settings.queries.ts`: reemplazar el destructuring
      `const { theme_preference: _serverTheme, ...serverSynced } = data` (~línea 35) por
      `setSettings(data)` — sin el campo en el tipo no compila — y reducir el comentario largo de
      las líneas ~25 en adelante a una sola línea.
- [x] 4.4 `frontend/src/stores/theme.ts`, `readLegacySettingsTheme()` (~líneas 19–28): **se
      conserva tal cual** porque lee `theme_preference` de la clave `app_settings` del
      **localStorage**, no de la API. Cambiar solo el cast: de `as Partial<AppSettings>` a un tipo
      local `{ theme_preference?: string | null }`, y sacar el `import type { AppSettings }` de la
      línea 4 si queda sin uso en el archivo.
- [x] 4.5 `frontend/src/test/apiMock.ts`: borrar `default_fee: 30000` (~línea 26) del payload de
      `/settings`. El mock sigue siendo parcial (solo `gym_name` y `admin_name`) a propósito:
      `Settings.tsx` mergea con `DEFAULT_SETTINGS`.

## 5. Frontend — reescritura de `Settings.tsx`

Todo en `frontend/src/pages/Settings.tsx`. `ToggleCard`, `normalizeSettings`, `save`,
`updateField` y el `useEffect` de montaje se mueven **sin cambios de lógica**: lo único realmente
nuevo es el JSX del `return`. El hero superior (eyebrow + título + bajada) se mantiene sin cambios.

- [x] 5.1 Borrar la constante local `DEFAULT_SETTINGS` (~líneas 28–42) e importar
      `DEFAULT_SETTINGS` desde `@/stores/settings`, que ya se importa en el archivo (D9).
- [x] 5.2 Podar `normalizeSettings()`: sacar la rama `payment_reminder_message` (~líneas 63–65).
      El resto de la función (reescritura de la marca vieja) se queda.
- [x] 5.3 Borrar `buildReminderPreviewMessage` (~líneas 76–85), `openReminderPreview`,
      `focusWhatsappField` y `paymentMethodsSummary`; con ellos se van el import de `useMemo` y la
      constante `outlineButtonClass` (D4). Verificar que no quede ningún uso.
- [x] 5.4 En `save` (~líneas 162–163): borrar el comentario y el destructuring
      `const { theme_preference: _themePreference, ...payload } = settings` y hacer
      `api.put("/settings", settings)`.
- [x] 5.5 Borrar el import entero de `lucide-react` (`Building2`, `Clock3`, `CreditCard`,
      `Landmark`, `Mail`, `MapPin`, `MessageSquareText`, `Phone`, `Settings2`) y el de
      `@/components/ui/card`: con D6 no sobrevive ningún ícono ni ninguna `Card`. `Input`,
      `Button`, `api`, los dos stores, `toast*` y `APP_NAME` siguen en uso.
- [x] 5.6 Reescribir el `return`: contenedor `max-w-3xl` en una sola columna, sin la grid
      `xl:grid-cols-[1.15fr_0.85fr]`. Borrar por completo la columna derecha: las cards "Vista
      previa del negocio" y "Resumen rápido" (~líneas 460–570), el botón "Ver recordatorio en
      WhatsApp" y el link "Completar WhatsApp".
- [x] 5.7 Estructurar el formulario en cuatro `<section>` semánticas, cada una con su `<h2>` y
      separador superior `border-t border-border pt-8` (la primera sin borde), en este orden:
      **Negocio** (`gym_name`, `currency`), **Contacto** (`admin_name`, `address`,
      `contact_email`, `contact_phone`, `whatsapp_phone`, `business_hours`), **Cobro**
      (`ToggleCard` de `allow_cash` y `allow_transfer`, `payment_alias`, `payment_notes`) y
      **Operación** (`onboarding_message`). No renderizar ningún campo de cuota base, tolerancia
      ni recordatorio: ya no existen en el tipo.
- [x] 5.8 Cada campo pasa al markup de D7: `<label htmlFor="<campo>">` + `<Input id="<campo>"
      aria-describedby="<campo>-help">` + `<p id="<campo>-help">` con el helper. Conservar el
      `id="whatsapp_phone"` existente, ahora como parte del par label/input.
- [x] 5.9 Redactar los 12 helper texts que faltan (uno por campo, corto y descriptivo, derivado de
      quién consume ese dato según el `## Context` del design). El de **Moneda** está fijado por
      la spec y no se cambia: "Se usa en precios de planes, pagos y reportes". Si el PO ya dejó
      copy aprobado para los otros 12 (Q4 del design), usar ese en vez de inventarlo.
- [x] 5.10 Agregar como último hijo del contenedor la barra de acción estática (D8):
      `<div className="flex justify-end border-t border-border pt-6">` con el `Button` de guardar,
      conservando `disabled={saving || !canEdit}` y el texto "Guardando..." / "Guardar cambios".
      **No** hacerla `sticky`.
- [x] 5.11 Verificar que `canEdit` sigue respetándose en todos los inputs, textareas y toggles de
      las 4 secciones (I2): ningún campo queda editable para el Coach.
- [x] 5.12 `make lint-frontend` en verde (`eslint` + `tsc --noEmit`) antes de pasar a los tests.

## 6. Frontend — tests

Todo en `frontend/src/pages/__tests__/Settings.test.tsx`, que hoy tiene 2 casos escritos contra la
vista vieja. **Advertencia**: además de invertir las aserciones de "Vista previa del negocio" y
del botón "Ver recordatorio en WhatsApp", el segundo caso usa `screen.getByText("Resumen rápido")`
(~línea 57) como **control positivo** de que los asserts negativos no pasan por página vacía; hay
que reemplazarlo por un heading nuevo (p. ej. `getByRole("heading", { name: "Negocio" })`) o el
archivo queda en rojo por su propio andamiaje. Los asserts negativos de las 3 `InfoCard` y de
"Contexto operativo" se conservan. Todos los casos son asincrónicos: arrancar con un `findBy*` y
un `expect(screen.queryByText("Cargando configuracion...")).toBeNull()` antes de cualquier assert
negativo.

- [x] 6.1 Reescribir el primer caso como
      `muestra las cuatro secciones del formulario en una sola columna` — afirma los cuatro
      `getByRole("heading", { name: ... })`: Negocio, Contacto, Cobro y Operación.
- [x] 6.2 Reescribir el segundo caso como
      `no muestra la vista previa del negocio ni el resumen rapido` — asserts negativos de "Vista
      previa del negocio", "Resumen rápido", el botón "Ver recordatorio en WhatsApp" y el link
      "Completar WhatsApp", más los asserts negativos ya existentes de las 3 `InfoCard` y de
      "Contexto operativo", con el control positivo reemplazado según la advertencia de arriba.
- [x] 6.3 Agregar `no muestra los campos deprecados de cuota base, tolerancia ni recordatorio` —
      asserts negativos por label/texto de "Cuota mensual base", "Días de tolerancia" y "Mensaje
      de recordatorio de pago".
- [x] 6.4 Agregar `muestra el boton Guardar cambios en la barra de accion al pie` — sembrar
      `localStorage.setItem("user_role", "owner")` (más `access_token` y `user_name`) antes de
      renderizar, si no `canEdit` es `false` por el fallback `role ?? "coach"` y el botón sale
      deshabilitado; afirmar que el botón existe y está habilitado.
- [x] 6.5 Agregar `con rol coach deja el formulario en solo lectura` — sembrar
      `localStorage.setItem("user_role", "coach")` como hacen `Payments.test.tsx` y
      `UserDetail.test.tsx`; afirmar que los inputs están `disabled` y el botón "Guardar cambios"
      también (I2).
- [x] 6.6 Correr `make test-frontend` y confirmar que `Login.test.tsx` y `Topbar.test.tsx` siguen
      en verde sin cambios (I8: el tema por usuario no se toca).
- [x] 6.7 Grep de cierre sobre `backend/app`, `backend/tests` y `frontend/src` por los 5 nombres
      borrados: solo pueden quedar los `theme_preference` de `User`/`/auth/me` (`models.py:129`,
      `routers/auth.py`, `routers/users.py`, `services/me.ts`, `stores/theme.ts`,
      `hooks/useSignIn.ts`, `InvitationAccept.tsx` y sus tests) y el tipo local de la task 4.4.
      Las migraciones históricas no se tocan (I7).

## 7. Documentación de producto

- [x] 7.1 `docs/producto/06-configuracion.md` §6 (línea ~83): tachar la fila C-2 con el patrón ya
      usado en C-1: `~~...~~ Cerrada por \`simplify-settings-view\` (2026-09-12)`.
- [x] 7.2 `docs/producto/06-configuracion.md` §5 (líneas ~73–74): las dos filas dejan de decir
      "A deprecar" y pasan a "Eliminados del modelo, la API y la UI (`simplify-settings-view`)";
      además, la fila de cuota base pierde la mención a la previsualización y al resumen de datos
      faltantes, que ya no existen.
- [x] 7.3 `docs/producto/06-configuracion.md` §2 (línea ~37): convertir el bloque "Se deprecan
      (D2, D3, tema por usuario)" en "Deprecados y eliminados (2026-09-12)", reflejando que la
      deprecación ya se ejecutó.
- [x] 7.4 `docs/producto/09-backlog-mvp.md`: en el diagrama ASCII de fases (líneas ~22–24, Fase 5)
      tachar C-2, y en la fila **M5** de la tabla de Fase 5 (línea ~89) tachar la parte de C-2 y
      completar su columna `Change` con `simplify-settings-view`. M5 queda parcialmente cerrada
      porque también agrupa C-4/C-5, que no entran en este change (D11).

## 8. Cierre

- [x] 8.1 `make lint` en verde (backend + frontend).
- [x] 8.2 `make test` en verde (pytest + Vitest).
- [x] 8.3 `make check-plan CHANGE=simplify-settings-view` sin ninguna línea `FALLA:`. Hoy reporta
      8 "no se encontró el caso": son exactamente los 3 tests del grupo 3 y los 5 del grupo 6.
- [x] 8.4 Dejar anotado para el deploy que en Railway las migraciones **no** corren solas: la
      migración del grupo 1 se aplica a mano por CLI inmediatamente después del deploy, o el
      `GET /settings` queda roto en la ventana intermedia. Ya queda registrado en `design.md`
      (bullet "Deploy" de D3 y la mitigación de riesgo listada más abajo); no hace falta
      duplicarlo en otro archivo.
