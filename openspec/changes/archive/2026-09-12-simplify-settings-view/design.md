# Diseño técnico — simplify-settings-view

## Context

`AppSettings` es una tabla de una sola fila (single-tenant, supuesto C1 de
`docs/producto/06-configuracion.md`) con 18 campos. De los 18, **5 no tienen ningún lector** en
todo el repo y este change los borra: `default_fee`, `late_fee_grace_days`,
`payment_reminder_message`, `payment_reminder_last_sent_at`, `theme_preference`.

Estado verificado hoy (grep dirigido sobre `backend/app`, `backend/tests`, `frontend/src`):

| Campo | Quién lo lee hoy |
|---|---|
| `default_fee` | solo `Settings.tsx` (su propio formulario, el preview y el armado del mensaje de recordatorio). El precio real de una cuota lo cobran los planes desde `rebuild-payments-with-plan-pricing` — `UserCard.tsx:93` lo dice en un comentario. |
| `late_fee_grace_days` | solo `Settings.tsx` (formulario + preview + placeholder `{grace_days}`). La mora se calcula por período calendario, sin gracia (S2 de `03-membresias-y-pagos.md`). |
| `payment_reminder_message` / `_last_sent_at` | solo `Settings.tsx` y el relleno de `_apply_brand_refresh` en `routers/settings.py`. No hay envío de recordatorios (D3). |
| `theme_preference` (el de `app_settings`) | **nadie**. Ya está marcado legacy: `settings.queries.ts` lo descarta del payload del servidor y `Settings.tsx:163` lo excluye del `PUT`. El tema real vive en `users.theme_preference` + `stores/theme.ts`. |

El único consumidor vivo de `app_settings` fuera de Ajustes es el resto de la app leyendo
`gym_name`, `currency`, `allow_cash`/`allow_transfer`, `payment_alias`, `payment_notes`,
`onboarding_message` y la ficha de contacto (`Payments.tsx`, `UserDetail.tsx`,
`MembershipPlans.tsx`, `PaymentDialog.tsx`, `UserCard.tsx`, `CreateMembershipPlanDialog.tsx`,
`NewPlanPriceDialog.tsx`, y `routers/routines.py:575` que toma `gym_name` para el PDF de
progreso). Ninguno toca los 5 campos que se van.

En el frontend, `Settings.tsx` son 592 líneas con una grid de dos columnas
(`xl:grid-cols-[1.15fr_0.85fr]`): 3 cards de formulario a la izquierda, y a la derecha "Vista
previa del negocio" + "Resumen rápido" + el botón de guardar. Un change anterior retiró 3
`InfoCard` redundantes pero salvó estas dos cards pegándoles un botón de acción; este change
revierte esa decisión (ver `specs/settings-view/spec.md`, sección `## REMOVED Requirements`).

Restricción de proceso: hay una migración **sin aplicar** de otro change en curso
(`add-exercise-catalog`, `c387dcc091c2`, sobre `d5f74a834ac0`), que hoy es el head de Alembic.

## Goals / Non-Goals

**Goals:**

- Borrar de verdad los 5 campos en las 4 capas: columna de DB, schema Pydantic, tipo de TS y UI.
- Dejar `Settings.tsx` con 4 secciones en `Card` (Negocio / Contacto / Cobro / Operación)
  repartidas en una grilla de dos columnas desde `xl`, sin texto de ayuda por campo y con una
  barra de acción al pie (ver D6/D7/D8, revisadas tras el feedback del usuario).
- No tocar ni un byte del comportamiento de los 13 campos que se quedan.
- Cerrar la brecha C-2 en la documentación de producto (`06-configuracion.md`,
  `09-backlog-mvp.md`).

**Non-Goals:**

- Upload de logo del gimnasio (espera a que aterrice `add-exercise-catalog` y su puerto
  `ObjectStorage`) y logo en el PDF de progreso.
- Validar "al menos un medio de pago habilitado" (C-4) y link a Planes desde Ajustes (C-5):
  siguen abiertos en Fase 5 del backlog, no entran acá.
- Alinear el permiso de escritura de `/settings` entre backend (Dueño **o Coach**) y frontend
  (solo Dueño). Es una inconsistencia preexistente — ver Open Questions.
- Migrar el estado local de `Settings.tsx` a react-query o al store: sigue con su `useState` +
  `api.get` en el `useEffect` de montaje.

## Decisions

### D1. Borrado real de las 5 columnas, no deprecación gradual

Se eliminan las columnas de `app_settings` en la misma migración que las saca del modelo. No hay
fase intermedia de "la columna queda pero nadie la escribe".

- **Por qué**: AGENTS.md, sección de beta — "los períodos de deprecación no aplican; un campo que
  deja de tener sentido se retira en el mismo change que lo reemplaza". Además, la deprecación a
  medias ya se probó acá y salió mal: `theme_preference` lleva dos changes marcado "legacy" y
  arrastra tres shims (`types.ts`, `settings.queries.ts`, el destructuring del `PUT`).
- **Alternativa descartada**: dejar las columnas nullable y solo sacarlas de la API/UI. Evita la
  migración, pero deja 5 columnas muertas en el esquema y no cierra C-2, que pide explícitamente
  "modelo, API y UI".

### D2. Migración Alembic solo de esquema, sin backfill; `downgrade` recrea nullable

`upgrade()` son 5 `op.drop_column("app_settings", ...)`. `downgrade()` recrea las 5 columnas
**todas nullable y sin `server_default`**, sin restaurar ningún dato:

- `default_fee` y `late_fee_grace_days` son hoy `NOT NULL`; al recrearlas en el downgrade se las
  deja nullable, porque no hay valor que poner en la fila existente y no queremos inventar uno.
- `payment_reminder_message`, `payment_reminder_last_sent_at` y `theme_preference` ya eran
  nullable.

- **Por qué**: AGENTS.md — "migración solo de esquema, sin backfill, es la opción por defecto",
  como ya se hizo en `add-membership-plans` (ver el docstring de `6c1a341f03a2`, que menciona
  justamente `app_settings.default_fee`). El downgrade existe para poder rebobinar el esquema, no
  para recuperar datos de prueba.
- **Alternativa descartada**: un downgrade fiel que recree las columnas con `server_default` y
  repita el texto del recordatorio (como hace `c91d2b7a4e10` en su `upgrade`). Es más código,
  reintroduce un literal largo que queremos borrar, y restaura datos que nadie lee.

### D3. La migración encadena al head actual `c387dcc091c2` (add-exercise-catalog)

`down_revision = "c387dcc091c2"`.

- **Por qué**: `c387dcc091c2` es hoy el único head (`d5f74a834ac0` → `c387dcc091c2`), aunque
  todavía no esté aplicado en ninguna base. Encadenar ahí mantiene **un solo head** y hace que
  `make migrate` funcione sin merge.
- **Alternativa descartada**: colgar de `d5f74a834ac0` para no depender de un change ajeno en
  vuelo. Produce dos heads y rompe `alembic upgrade head` con `Multiple head revisions are
  present`, obligando a una migración de merge que nadie pidió.
- **Obligación para `role-dev`**: antes de generar el archivo, correr `alembic heads` dentro de
  `backend/`. Si `add-exercise-catalog` se archivó, se reordenó o se abandonó y el head ya no es
  `c387dcc091c2`, apuntar `down_revision` al head que devuelva el comando — no al valor escrito
  acá. Generar con `alembic revision -m "drop deprecated app_settings columns"` (sin
  `--autogenerate`: el diff es trivial y el autogenerate arrastraría ruido de SQLite).
- **Deploy**: en Railway las migraciones no corren solas; se aplican a mano por CLI (queda como
  fila `manual` del plan de verificación).

### D4. Se retiran también los símbolos que quedan huérfanos, no solo los campos

Al sacar los 5 campos quedan varios restos que `ruff`/`tsc`/`eslint` marcarían, y que hay que
borrar en el mismo diff:

| Dónde | Qué queda huérfano |
|---|---|
| `backend/app/schemas.py` | el alias `ThemePreference` (línea 24) — sus únicos usos son `SettingsBase` y `SettingsUpdate`; **no confundir con `ThemeMode`**, que sí sigue vivo en los schemas de `/auth/me`. El `@field_serializer("default_fee")` completo. El `from decimal import Decimal` (línea 2): `default_fee` es su único uso en el archivo, así que el import se va con él. Y las entradas `"payment_reminder_message"` de la lista del `@field_validator(..., mode="before")` de strip. |
| `backend/app/routers/settings.py` | las 5 claves de `DEFAULTS` y, dentro de `_apply_brand_refresh`, las ramas `if not settings.theme_preference` y `if not settings.payment_reminder_message`. |
| `frontend/src/pages/Settings.tsx` | `buildReminderPreviewMessage`, `openReminderPreview`, `focusWhatsappField`, `paymentMethodsSummary` (y con él el import `useMemo`), `outlineButtonClass` (solo lo usaba el botón de WhatsApp), el import entero de `lucide-react` (`Building2`, `Clock3`, `CreditCard`, `Landmark`, `Mail`, `MapPin`, `MessageSquareText`, `Phone`, `Settings2` — **ninguno sobrevive**, ver D6) y el de `@/components/ui/card`. `Input`, `Button`, `api`, los dos stores, `toast*` y `APP_NAME` siguen en uso. |
| `frontend/src/services/settings.queries.ts` | el `const { theme_preference: _serverTheme, ...serverSynced } = data` pasa a ser `setSettings(data)`: sin el campo en el tipo, el destructuring no compila. El comentario largo que lo explica se reemplaza por una línea. |
| `frontend/src/pages/Settings.tsx` (`save`) | el `const { theme_preference: _themePreference, ...payload } = settings` desaparece: se hace `api.put("/settings", settings)`. |

- **Alternativa descartada**: dejar los huérfanos y silenciar el linter. Rompe la regla dura del
  proyecto de que `make lint` quede verde sin excepciones locales.

### D5. `_apply_brand_refresh` se poda, no se borra

Se van sus dos ramas muertas (tema y recordatorio); sobreviven las 4 que todavía reescriben
valores de la marca vieja "Libre Funcional" (`gym_name`, `admin_name`, `contact_email`,
`payment_alias`, `onboarding_message`).

- **Por qué**: la lógica de onboarding sigue teniendo un caso real (la fila sembrada con el texto
  viejo) y borrarla sería un cambio de comportamiento que este change no propone.
- **Alternativa descartada**: eliminar la función entera aprovechando el viaje. Es un cambio de
  comportamiento no pedido y fuera del alcance del proposal.

### D6. Cada sección es una `Card`, en grilla de dos columnas desde `xl`

> **Revisada tras el feedback del usuario sobre la vista ya implementada** (2026-09-12). La
> versión original de D6 pedía 4 `<section>` semánticas con separador `border-t` en una sola
> columna `max-w-3xl`, sin `Card` ni íconos. El usuario revisó la vista funcionando y pidió
> cards y dos columnas; el Product Owner reescribió el requirement como "Formulario de Ajustes en
> grilla de dos columnas con cards por sección". Esto es lo que queda vigente.

Cada una de las 4 secciones es una `Card` de `@/components/ui/card` con `CardHeader` +
`CardTitle` (Negocio, Contacto, Cobro, Operación) y `CardContent`. Sigue **sin haber íconos** de
cabecera. El layout es:

- un `<div className="grid gap-6 xl:grid-cols-2">` con dos hijos: una columna izquierda que apila
  **Negocio + Cobro**, y la card **Contacto** como columna derecha;
- la card **Operación** queda fuera de esa grilla, a lo ancho completo, debajo de ambas columnas;
- por debajo de `xl` la grilla colapsa a una columna y las 4 cards se apilan en orden Negocio,
  Cobro, Contacto, Operación.

`ToggleCard` — definido en el propio archivo — se conserva tal cual para efectivo/transferencia, y
el hero superior (eyebrow + título + bajada) se mantiene sin cambios. Se retira el
`max-w-3xl` de la versión anterior: con dos columnas el formulario usa el ancho del contenido.

- **Por qué**: la vista quedó muy larga y angosta en una sola columna, con mucho scroll para 13
  campos. El reparto Negocio+Cobro / Contacto es el que balancea las alturas (Contacto tiene 6
  campos, Negocio 2 y Cobro 4), que es lo que el requirement pide explícitamente ("ninguna columna
  desproporcionadamente más larga que la otra"). La `Card` vuelve porque, sin el separador y sin
  íconos, agrupar en columnas necesita un límite visual: dos bloques contiguos en columnas
  distintas no se leen como secciones separadas.
- **Alternativa descartada**: mantener `<section>` + separador y solo partir en dos columnas. Los
  `border-t` horizontales se vuelven ambiguos cuando hay dos columnas al lado (parecen separar
  filas de la grilla, no secciones), así que el ahorro de markup no compensa.
- **Alternativa descartada**: `columns-2` de CSS o `grid-flow-row-dense`, dejando que el navegador
  reparta las 4 cards. Es menos markup pero el reparto queda a merced del alto de cada card y no
  garantiza el orden pedido (Operación abajo a lo ancho).
- **Esto no reintroduce** las cards eliminadas: "Vista previa del negocio" y "Resumen rápido"
  siguen sin existir (ver `## REMOVED Requirements` de la spec). La `Card` acá es contenedor de
  campos editables, no una card informativa de solo lectura.

### D7. Cada campo es `label htmlFor` + `input id`, sin texto de ayuda

> **Revisada tras el feedback del usuario sobre la vista ya implementada** (2026-09-12). La
> versión original de D7 agregaba un helper text por campo asociado con `aria-describedby`. El
> usuario pidió sacarlos: el requirement vigente dice "cada campo SHALL mostrar únicamente su
> label, sin texto de ayuda debajo". Con eso caen también las Open Questions sobre el copy (Q4).

Hoy los `<label>` son texto suelto sin `htmlFor` (salvo `whatsapp_phone`, que tiene `id` solo
para que `focusWhatsappField` lo enfocara). El markup por campo es:

```
<label htmlFor="currency">Moneda</label>
<Input id="currency" ... />
```

- **Lo que se conserva de la decisión original**: el par `label htmlFor` + `input id` en **todos**
  los campos. No era solo el ancla del helper: da a11y correcta (click en el label enfoca el
  input) y es lo que habilita `getByLabelText` en los tests de Vitest en vez de matchers de texto
  frágiles. Sin helper, el `aria-describedby` y los `<p id="...-help">` desaparecen.
- **Por qué se van los helpers**: agregaban una línea de texto secundario por campo — 13 párrafos
  en una vista que este change achica — y los labels ya nombran el campo sin ambigüedad. Era
  además copy nuevo que nadie había revisado como producto.
- **Alternativa descartada**: conservar el helper solo en los campos "no obvios" (Moneda, alias de
  pago). Deja un criterio difuso de cuál lo lleva y cuál no, y la spec ahora es categórica.
- El `id="whatsapp_phone"` se conserva (ahora como parte del par label/input), aunque
  `focusWhatsappField` se elimine.

### D8. La barra de acción al pie es estática, no sticky

Un `<div className="flex justify-end border-t border-border pt-6">` con el `Button` de guardar,
como último hijo del contenedor del formulario. Mantiene `disabled={saving || !canEdit}` y el
texto "Guardando..." / "Guardar cambios".

> **Sin cambios de fondo tras el feedback del usuario** (2026-09-12): la barra sigue siendo
> estática y al pie. Lo único que se ajusta es su posición relativa al nuevo layout de D6: queda
> **fuera de la grilla de dos columnas**, después de la card Operación, a lo ancho completo — no
> dentro de una de las columnas. Es el único `border-t` que sobrevive ahora que las secciones son
> cards.

- **Por qué**: el requirement pide "barra de acción al pie del formulario", no una barra fija al
  viewport, y explícitamente "no flotando al final de una columna lateral". Estático es cero JS y
  cero colisión con el layout móvil.
- **Alternativa descartada**: barra sticky (`sticky bottom-0`) con blur de fondo. Se ve mejor en
  formularios largos, pero agrega z-index y padding compensatorio para una vista que después de
  este change es notablemente más corta. Si se quiere, es un change propio.

### D9. `Settings.tsx` deja de tener su propia copia de `DEFAULT_SETTINGS` y usa la del store

Se importa `DEFAULT_SETTINGS` de `@/stores/settings` y se borra la constante local.

- **Por qué**: una vez podados los 5 campos, las dos constantes quedan **idénticas** campo por
  campo (ambas usan `APP_NAME`). El store ya se importa en este archivo, así que no hay
  dependencia nueva ni ciclo. El comentario del store admite que la duplicación es deuda
  ("Settings.tsx conserva su propia copia porque no se migra a este store").
- **Alternativa descartada**: mantener la copia local podada. Es lo que dicen las dec. 12/15 de un
  design anterior, pero esa decisión existía para no arrastrar la migración del estado a este
  archivo — cosa que acá no pasa: solo se comparte una constante. Mantenerla sería preservar un
  drift conocido en el único change que reescribe el archivo entero.
- `normalizeSettings()` se queda (sigue reescribiendo la marca vieja) pero pierde la rama
  `payment_reminder_message`.

### D10. El backend sigue con `extra="ignore"`: un body con campos deprecados da 200, no 422

`BaseSchema` no declara `extra`, así que Pydantic ignora las claves desconocidas. No se agrega
`extra="forbid"` a los schemas de settings.

- **Por qué**: el escenario de la spec dice "no los persiste ni los acepta **como parte del
  schema**"; ignorarlos lo cumple. Poner `forbid` solo en `/settings` haría que ese endpoint se
  comporte distinto al resto de la API y convertiría a cualquier cliente viejo en un 422.
- **Alternativa descartada**: `model_config = ConfigDict(extra="forbid")` en `SettingsBase` y
  `SettingsUpdate`, para que mandar `default_fee` sea un error explícito. Más ruidoso y más
  didáctico, pero incoherente con el resto de los schemas y sin pedido de producto detrás.
- Consecuencia para el test: se afirma `200` + campo **ausente en la respuesta**, no un `422`.

### D11. La documentación de producto se actualiza en tres lugares, no solo en la fila de C-2

- `docs/producto/06-configuracion.md`: **§6** tacha C-2 con el patrón ya usado en C-1
  (`~~...~~ Cerrada por \`simplify-settings-view\` (2026-09-12)`); **§5** deja de decir "A
  deprecar" en las dos filas afectadas — pasan a "Eliminados del modelo, la API y la UI
  (`simplify-settings-view`)" —, y la primera fila pierde la mención a "previsualización y resumen
  de datos faltantes", que ya no existen; **§2** convierte el bloque "Se deprecan" en "Deprecados
  y eliminados (2026-09-12)".
- `docs/producto/09-backlog-mvp.md`: C-2 aparece en el diagrama ASCII de fases (línea ~24, Fase 5)
  y dentro de la fila **M5** de la tabla de Fase 5, que dice "agrupa C-2" — no hay fila propia de
  C-2. Se tacha la parte de C-2 en M5 y se completa su columna `Change` con
  `simplify-settings-view`; M5 queda parcialmente cerrado porque `docs/producto/03` también lista
  C-4/C-5 bajo el mismo ítem.
- **Alternativa descartada**: partir M5 en dos filas para poder tacharla entera. Reescribe el
  backlog de otro módulo por una cuestión cosmética.
- Fuera de alcance deliberado: `00-vision-mvp.md` y `03-membresias-y-pagos.md` también mencionan
  `default_fee`; se dejan como están (son tablas de "deuda detectada", históricas).

## Plan de verificación

**Riesgo**: alto — el diff toca `backend/app/models.py` y `backend/migrations/**`, y borra
columnas con datos existentes: tres gatillos de la tabla de riesgo de `role-architect`, donde
`alto` no se baja por acuerdo entre roles. El `Impact` del proposal dice "medio" con el argumento
de que ninguna columna que se va tiene lector — argumento correcto y verificado, pero el criterio
del proyecto es estructural (qué archivos toca el diff), no de impacto estimado. En la práctica la
diferencia operativa es nula: ni `alto` ni `medio` permiten omitir QA manual, eso solo lo habilita
`bajo`. Ver Open Questions Q1.

### Invariantes

- I1. Los 13 campos que se quedan (`gym_name`, `currency`, `allow_cash`, `allow_transfer`,
  `admin_name`, `address`, `contact_email`, `contact_phone`, `whatsapp_phone`, `business_hours`,
  `payment_alias`, `payment_notes`, `onboarding_message`) siguen persistiendo vía `PUT /settings`
  y volviendo en el `GET`.
- I2. El Coach sigue viendo la vista de Ajustes en solo lectura: `canEdit === role === "owner"`,
  todos los inputs con `disabled` y el botón "Guardar cambios" deshabilitado.
- I3. `gym_name` sigue llegando a sus consumidores: sidebar/footer, `MembershipPlans.tsx` y el PDF
  de progreso (`backend/app/routers/routines.py:575`).
- I4. `currency` sigue llegando a `Payments.tsx`, `UserDetail.tsx`, `MembershipPlans.tsx`,
  `PaymentDialog.tsx`, `CreateMembershipPlanDialog.tsx`, `NewPlanPriceDialog.tsx` y `UserCard.tsx`.
- I5. `allow_cash` / `allow_transfer` siguen decidiendo qué medios ofrece `PaymentDialog.tsx`.
- I6. `alembic heads` devuelve **un solo head** después de agregar la migración, y
  `alembic downgrade -1` seguido de `upgrade head` corre sin error.
- I7. Ningún símbolo del repo referencia los 5 campos borrados después del change (grep vacío en
  `backend/app`, `backend/tests`, `frontend/src`), salvo las migraciones históricas, que no se
  tocan.
- I8. El tema por usuario (`users.theme_preference`, `/auth/me/theme`, `stores/theme.ts`) queda
  intacto: `backend/tests/test_theme.py` y `Login.test.tsx` siguen en verde sin cambios.

### Tests

| Capa | Archivo | Caso |
|---|---|---|
| backend | `backend/tests/test_settings.py` | `test_get_settings_no_expone_los_campos_deprecados` |
| backend | `backend/tests/test_settings.py` | `test_put_settings_persiste_los_campos_vigentes` |
| backend | `backend/tests/test_settings.py` | `test_put_settings_ignora_los_campos_deprecados_del_body` |
| frontend | `frontend/src/pages/__tests__/Settings.test.tsx` | `muestra los títulos de las cuatro secciones del formulario` |
| frontend | `frontend/src/pages/__tests__/Settings.test.tsx` | `cada sección del formulario se presenta como una card` |
| frontend | `frontend/src/pages/__tests__/Settings.test.tsx` | `no muestra texto de ayuda debajo de los campos` |
| frontend | `frontend/src/pages/__tests__/Settings.test.tsx` | `no muestra la vista previa del negocio ni el resumen rapido` |
| frontend | `frontend/src/pages/__tests__/Settings.test.tsx` | `no muestra los campos deprecados de cuota base, tolerancia ni recordatorio` |
| frontend | `frontend/src/pages/__tests__/Settings.test.tsx` | `muestra el boton Guardar cambios en la barra de accion al pie` |
| frontend | `frontend/src/pages/__tests__/Settings.test.tsx` | `con rol coach deja el formulario en solo lectura` |
| manual | — | Aplicar la migración: `make migrate` y verificar con `\d app_settings` (psql) que las 5 columnas ya no están y que las 13 restantes sí. Después `alembic downgrade -1 && alembic upgrade head` dentro de `backend/` para comprobar el ida y vuelta. |
| manual | — | `make dev` + `make seed-dev`; entrar con `dev.owner@miniespacio.local` a `/settings`, editar un campo de cada sección, guardar, recargar y confirmar que persistió; cambiar al rol Coach con el widget de desarrollo y confirmar que todo queda deshabilitado. |
| manual | — | Scenario "Grilla de dos columnas en pantallas grandes" (sin cobertura automatizada): con `make dev`, abrir `/settings` en una ventana de ancho ≥ 1280px (breakpoint `xl`) y confirmar que Negocio y Cobro quedan apiladas en la columna izquierda, Contacto en la derecha, y Operación a lo ancho completo debajo de ambas; verificar además que ninguna columna queda notoriamente más larga que la otra. |
| manual | — | Scenario "Apilado en pantallas chicas" (sin cobertura automatizada): en la misma vista, achicar la ventana por debajo de 1280px (o usar el emulador de dispositivo del navegador en un ancho móvil) y confirmar que las cuatro cards se apilan en una sola columna, en orden Negocio, Cobro, Contacto, Operación, sin scroll horizontal. |
| manual | — | Con los datos anteriores, navegar a `/payments`, `/membership-plans` y a la ficha de un miembro para confirmar que `currency`, `gym_name` y los medios de pago siguen mostrándose bien; descargar el PDF de progreso de un miembro y verificar el nombre del gimnasio en el encabezado. |

**Los dos scenarios responsive de la spec no tienen cobertura automatizada.** "Grilla de dos
columnas en pantallas grandes" y "Apilado en pantallas chicas" dependen de media queries de
Tailwind que jsdom **no evalúa**: no calcula layout ni resuelve `xl:grid-cols-2`, así que un test
de Vitest solo podría afirmar que cierta clase está en el `className`, lo cual verifica el string
que escribió el dev y no lo que ve el usuario. Quedan como las dos filas `manual` de arriba, a
cargo de QA. Por eso también el caso de las cuatro secciones se llama por lo que realmente
comprueba (que los cuatro títulos existen) y no por una cantidad de columnas.

Notas para `role-dev` sobre los tests:

- **Renombre pendiente**: el caso que hoy en el repo se llama
  `muestra las cuatro secciones del formulario en una sola columna` describe un layout que ya no
  existe. `role-dev` lo renombra a `muestra los títulos de las cuatro secciones del formulario`
  en `frontend/src/pages/__tests__/Settings.test.tsx` — **solo el nombre**, el cuerpo (los cuatro
  `findByText`/`getByText`) queda igual. El renombre va junto con este design en el mismo commit:
  `make check-plan` exige que el nombre del plan y el del repo coincidan exactamente, así que
  cambiar uno solo deja el gate en rojo. Aprovechar para actualizar el comentario de las líneas
  ~26–29, que hoy remite al plan de verificación por el layout de una sola columna: pasa a remitir
  por los dos scenarios responsive.

- **`backend/tests/test_settings.py`** ya existe y hoy es puro test de autorización (su docstring
  lo dice). Los 3 casos nuevos van ahí igual, porque son sobre el mismo endpoint; conviene
  ampliar el docstring del módulo para que deje de prometer solo autorización. Los casos usan el
  fixture `auth_header(OWNER_EMAIL)` y el path `/settings` **sin barra final** (con barra, el
  `TestClient` sigue un 307 y el assert falla por el motivo equivocado). `test_put_..._persiste`
  hace `GET` → modifica los 13 campos → `PUT` → `GET` y compara; `test_..._ignora_los_campos_...`
  manda el body válido más `default_fee`/`late_fee_grace_days`/etc. y espera `200` con esas claves
  ausentes de la respuesta (ver D10).
- **`frontend/src/pages/__tests__/Settings.test.tsx`** ya existe con 2 casos que hay que
  **invertir**: el primero (`muestra los formularios de configuracion y la vista previa con su
  accion`) afirma hoy que están "Vista previa del negocio" y el botón "Ver recordatorio en
  WhatsApp"; el segundo usa `getByText("Resumen rápido")` como *control positivo* de que los
  asserts negativos no pasan por página vacía. Ese control positivo hay que cambiarlo por un
  heading nuevo (p. ej. `getByRole("heading", { name: "Negocio" })`), si no el archivo queda en
  rojo por el propio andamiaje del test. Los asserts negativos de las 3 `InfoCard` y de "Contexto
  operativo" se conservan.
- El caso de solo lectura siembra el rol como hacen `Payments.test.tsx` y `UserDetail.test.tsx`:
  `localStorage.setItem("user_role", "coach")` en el `beforeEach` (más `access_token` y
  `user_name`), y `renderWithProviders` rehidrata los stores antes de renderizar. Para el caso del
  botón de guardar hay que sembrar `"owner"`, si no `canEdit` es `false` por el fallback
  `role ?? "coach"` y el botón sale deshabilitado.
- Todos los casos de esta vista son **asincrónicos**: `Settings` devuelve temprano el placeholder
  "Cargando configuracion..." hasta que resuelve el `GET /settings`. Los asserts negativos tienen
  que ir después de un `findBy*` y de `expect(screen.queryByText("Cargando configuracion...")).toBeNull()`.
- `frontend/src/test/apiMock.ts` devuelve hoy `default_fee: 30000` en el payload de `/settings`;
  esa clave se borra. El mock sigue siendo parcial (solo `gym_name` y `admin_name`), y eso está
  bien: `Settings.tsx` mergea con `DEFAULT_SETTINGS` (D9).

## Risks / Trade-offs

- **Dos heads de Alembic si `add-exercise-catalog` se reordena o se abandona** → `role-dev` corre
  `alembic heads` antes de escribir `down_revision` y usa lo que devuelva el comando, no el valor
  literal de D3. I6 lo verifica.
- **La migración no corre sola en Railway** (no hay migraciones en el deploy) → el `GET /settings`
  quedaría roto en prod entre el deploy del código y la migración manual. Mitigación: aplicar la
  migración por CLI inmediatamente después del deploy; está como fila `manual` del plan. Es una
  ventana de minutos sin usuarios finales (beta).
- **Pérdida irreversible de los valores de los 5 campos** → aceptado explícitamente: son datos de
  prueba y ningún lector los consume (AGENTS.md, sección de beta). El `downgrade` recrea el
  esquema, no los datos.
- **`Settings.tsx` se reescribe casi entero (592 → ~300 líneas)**, así que el diff es difícil de
  revisar línea por línea → mitigación: `ToggleCard`, `normalizeSettings`, `save`, `updateField` y
  el `useEffect` de montaje se mueven **sin cambios de lógica** (solo poda de campos); lo único
  realmente nuevo es el JSX del `return`. El code review puede concentrarse ahí.
- ~~**Los helper texts son copy nuevo que nadie revisó como producto**~~ → resuelto: los helper
  texts se eliminaron tras el feedback del usuario (D7 revisada). No hay copy nuevo en la vista
  más allá de los labels, que ya existían.
- **El balance de altura entre columnas no es verificable por test** (jsdom no calcula layout) →
  el reparto Negocio+Cobro / Contacto se eligió por conteo de campos (6 vs 6) y queda cubierto por
  la fila `manual` del scenario de dos columnas. Si a futuro se agregan campos a una sección, el
  balance hay que revisarlo a ojo de nuevo.
- **El navegador de alguien que ya usó la app tiene `app_settings` en `localStorage` con los 5
  campos** → no rompe nada: el `PersistStorage` del store hace `{ ...DEFAULT_SETTINGS, ...parsed }`
  y las claves de más simplemente quedan en el objeto en runtime, invisibles para TS y sin
  lectores. Ojo con no tocar `readLegacySettingsTheme()` de `stores/theme.ts`, que lee
  `theme_preference` de **esa clave de localStorage** (no de la API) como fallback de migración de
  tema: se mantiene tal cual, casteando a `Partial<AppSettings>` ya no alcanza, así que ese parse
  pasa a tipar su propio `{ theme_preference?: string | null }` local.

## Migration Plan

1. Backend primero, en un solo commit lógico: `models.py` → `schemas.py` → `routers/settings.py` →
   migración. `make lint-backend` y `make test-backend` verdes antes de seguir.
2. `make migrate` en local (SQLite de tests no necesita nada: la suite crea el esquema desde los
   modelos).
3. Frontend: `types.ts` → `stores/settings.ts` → `services/settings.queries.ts` →
   `stores/theme.ts` (solo el tipado local del parse legacy) → `test/apiMock.ts` → `Settings.tsx`.
4. Tests de ambas capas, docs de producto, y `make lint && make test` al final.
5. **Rollback**: `alembic downgrade -1` recupera el esquema (no los datos) y `git revert` del
   change deja el código consistente con él. No hay estado intermedio deployable entre el paso 1 y
   el 3 —el frontend viejo manda los 5 campos en el `PUT`, que el backend nuevo ignora (D10), así
   que un deploy parcial degrada sin romper.

## Open Questions

- ~~**Q1 (riesgo)**: el proposal declara riesgo **medio** y este design declara **alto**…~~
  **Cerrada** (2026-09-12): se resolvió alineando el proposal hacia arriba, no bajando el nivel
  acá. El `## Impact` del proposal (`proposal.md:57`) declara hoy riesgo **alto**, el mismo que
  fija la tabla de criterio de `role-architect`: el diff toca `backend/app/models.py` y
  `backend/migrations/**` y borra columnas con datos. Los dos artifacts dicen lo mismo y el nivel
  declarado sigue siendo **alto**.
- **Q2 (producto, hueco en el QUÉ)**: la spec dice que `PUT`/`PATCH` "no acepta" los campos
  deprecados, sin precisar si eso es *ignorar* (200) o *rechazar* (422). Este design elige ignorar
  (D10). Si el PO quería rechazo explícito, hay que decirlo y el cambio es de una línea de
  `ConfigDict` más el test correspondiente.
- **Q3 (producto)**: el backend permite que el **Coach escriba** `/settings`
  (`require_role(owner, coach)`, con `test_put_settings_con_coach_actualiza` afirmándolo), mientras
  que el frontend deja editar solo al Dueño (`canEdit = role === "owner"`). `06-configuracion.md`
  §3 dice "Solo el staff edita (Dueño; Coach hereda, D10)", lo que respalda al backend. Este change
  **no toca ninguno de los dos** y conserva la inconsistencia; hace falta una decisión de producto
  para alinearlos, en un change propio.
- ~~**Q4 (copy)**: los helper texts por campo son redacción del implementador…~~ **Cerrada**
  (2026-09-12): el usuario pidió sacar los textos de ayuda y el PO lo fijó en la spec ("cada campo
  SHALL mostrar únicamente su label, sin texto de ayuda debajo"). No hay copy que aprobar.

## Registro de revisiones

- **2026-09-12** — Ajuste de layout posterior a la implementación, a pedido del usuario después de
  revisar la vista funcionando. El PO reescribió el requirement como "Formulario de Ajustes en
  grilla de dos columnas con cards por sección"; este design actualiza **D6** (cards en vez de
  `<section>` con separador; grilla `xl:grid-cols-2` en vez de `max-w-3xl` en una columna), **D7**
  (sin helper text ni `aria-describedby`; se conserva `label htmlFor` + `id`) y **D8** (la barra al
  pie queda fuera de la grilla). En el Plan de verificación se renombró el caso de frontend que
  hablaba de "una sola columna", se sumaron los dos casos que cubren los scenarios de card y de
  ausencia de helper, y se agregaron dos filas `manual` para los scenarios responsive, que no
  tienen cobertura automatizada posible en jsdom. El backend (D1–D5, D9–D11) no cambia.
