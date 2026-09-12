# Verificación: simplify-settings-view

**Fecha**: 2026-09-12
**Veredicto**: PASA CON RESERVAS
**Diff verificado**: árbol de trabajo sin commitear sobre `ecab5f2`, acotado a los archivos de este
change (ver nota de aislamiento abajo)
**Riesgo declarado**: alto
**Paso 0**: lint OK · test OK · plan OK

## Nota de aislamiento del diff

El árbol mezcla este change con `add-exercise-catalog`, ambos sin commitear, y hay otras sesiones
editando el repo en vivo. `git diff main...HEAD` no sirve como recorte. El alcance verificado son
los archivos propios de este change: `models.py` (solo `AppSettings`), `schemas.py` (solo
`SettingsBase`/`SettingsUpdate` y sus huérfanos), `routers/settings.py`, la migración
`e79526156f68`, `tests/test_settings.py`, `types.ts`, `stores/settings.ts`, `stores/theme.ts`,
`services/settings.queries.ts`, `test/apiMock.ts`, `pages/Settings.tsx`, su test, y los dos docs de
producto.

Durante la corrida, `make lint` falló una vez por `F841` en `backend/app/routers/routines.py:84`
—archivo de `add-exercise-catalog`, editado por otra sesión a las 13:13. Se corrigió solo minutos
después y la re-corrida quedó en verde. No es un hallazgo de este change.

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=simplify-settings-view` | OK (`riesgo=alto`, sin fallas) |
| Lint | `make lint` | OK (exit 0; 43 warnings preexistentes, ninguno en el diff) |
| Tests | `make test` | OK (backend 240 passed · frontend 170 passed, 33 archivos) |

## Escenarios de la spec

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| settings-view / Cada sección es una card | UI con run-app, Dueño en `/settings` | PASA |
| settings-view / Sin texto de ayuda por campo | UI: los 11 campos de texto muestran solo label + input | PASA |
| settings-view / Grilla de dos columnas en pantallas grandes | UI a 1600px: Negocio+Cobro izquierda, Contacto derecha, Operación a lo ancho | PASA |
| settings-view / Apilado en pantallas chicas | UI a 680px: todo en una columna, sidebar colapsado | PASA |
| settings-view / Barra de acción al pie | UI: "Guardar cambios" al final, fuera de la grilla | PASA |
| settings-view / Sin cards informativas redundantes | UI: no existen "Vista previa del negocio" ni "Resumen rápido" | PASA |
| settings-view / Campos deprecados fuera de la vista | UI: sin "Cuota mensual base", "Dias de tolerancia" ni card de recordatorio | PASA |
| settings-view / Edición y guardado sin cambios funcionales | UI: editar Responsable → guardar → recargar → persistió. Revertido al valor original | PASA |
| settings-view / Coach en solo lectura | UI con widget de rol: los 13 campos y el botón quedan `disabled` | PASA |
| app-settings-state / GET sin campos deprecados | `curl` a `:8010/settings` con token real: 13 campos vigentes, ninguno de los 5 | PASA |
| app-settings-state / PUT y PATCH no aceptan los deprecados | `PUT` con los 5 en el body → 200, respuesta sin esas claves, sin alterar datos (D10) | PASA |
| app-settings-state / Estado del frontend sin los deprecados | `types.ts` + store podados; `tsc --noEmit` en verde | PASA |
| app-settings-state / Campos vigentes intactos | Consumidores vivos: `/payments` y ficha de miembro muestran moneda; diálogo de cobro refleja los toggles | PASA |

## QA manual

QA corrida por riesgo **alto** (no se puede omitir). Reporte completo del rol QA con 11 escenarios
verificados en la app real (Docker: frontend `:5173`, backend `:8010`, migración `e79526156f68`
aplicada).

El escenario "Apilado en pantallas chicas" quedó **NO VERIFICABLE** para el rol QA por falta de
control de viewport en su toolset; se cerró después desde la sesión principal con `resize_page` a
680px. Evidencia en el scratchpad: `settings-dueno.png` (1600px) y `settings-680.png` (680px).

Falso positivo descartado durante QA: el widget flotante de cambio de rol se superpone al botón
"Guardar cambios" cuando está expandido y desvió un par de clicks. Es interferencia del entorno de
automatización, no un defecto del change. Verificado aparte que la persistencia funciona, y
confirmado contra la DB que `admin_name` volvió a `Sergio Bidegain`.

## Hallazgos

1. **[mayor]** `openspec/changes/simplify-settings-view/proposal.md:21-25` y `:50` — el proposal
   describe el diseño previo a la revisión del 2026-09-12: dice que la vista pasa a "una sola
   columna (…) con secciones separadas **en vez de cards**" y que "cada campo suma un helper
   corto", citando el string exacto que hoy `Settings.test.tsx:91` afirma que **no** existe.
   `design.md` y las specs sí se actualizaron; el proposal no. Escenario de falla: al archivar, el
   proposal queda como registro de qué se hizo, y quien lo lea concluye lo contrario de lo que el
   código hace. **Conviene arreglarlo antes de `/opsx:archive`.**

2. **[menor]** `openspec/changes/simplify-settings-view/design.md:412` — la pregunta abierta Q1
   ("el proposal declara riesgo medio y este design alto") quedó obsoleta: `proposal.md:57` ya dice
   alto. Debería cerrarse como se cerró Q4.

3. **[menor]** `docs/producto/09-backlog-mvp.md:24` — el tachado `~~C-2 deprecar~~` está dentro de
   un bloque de código, así que se ve literal con las tildes y desalinea las columnas del diagrama
   ASCII. La convención del propio archivo es no marcar el diagrama (P1 y R-1, archivados,
   aparecen sin tachar). El tachado de la fila M5 y el de `06-configuracion.md:83` ya cumplen.

4. **[menor]** `frontend/src/pages/__tests__/Settings.test.tsx:91` — el test de "sin texto de
   ayuda" afirma la ausencia de tres strings concretos, no el invariante. Si mañana alguien agrega
   un helper con copy nuevo bajo un campo, el test sigue verde y el requirement queda sin guardia.
   Cubre la regresión de este change, no la regla.

5. **[menor]** `backend/migrations/versions/e79526156f68_...py:16` — `down_revision` apunta a
   `c387dcc091c2`, migración de `add-exercise-catalog`, todavía sin commitear. Es lo que decide D3
   a conciencia y hoy es correcto (un solo head), pero implica que **este change no es deployable
   ni archivable antes que `add-exercise-catalog`**. Si ese change se rehace con otro `revision
   id`, `alembic upgrade head` muere con `Can't locate revision 'c387dcc091c2'`. Condición de
   archive, no defecto del diff.

Sin bloqueantes. El riesgo declarado **alto** coincide con la tabla de criterio de `role-architect`
(toca `models.py` + `migrations/**` + borra columnas con datos).

## Sin verificar

- La vista `/plans` no tenía planes sembrados, así que el precio con moneda se confirmó
  indirectamente vía `/payments` y la ficha de miembro, que consumen el mismo dato.
- El `downgrade` de la migración se probó en local (ida y vuelta durante la implementación), no
  contra un entorno con datos reales.
- Observación conocida y aceptada por el usuario, fuera del alcance de la spec: los dos toggles de
  Cobro conservan sus descripciones porque vienen del componente `ToggleCard`, anterior a este
  change.
