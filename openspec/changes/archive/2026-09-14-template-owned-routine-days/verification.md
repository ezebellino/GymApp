# Verificación: template-owned-routine-days

**Fecha**: 2026-09-14 (re-verificado tras corregir los hallazgos 1, 2, 4 y 7)
**Veredicto**: PASA
**Diff verificado**: working tree vs `main` (36 archivos, +3113 / −2130) más los untracked propios del change
**Riesgo declarado**: alto
**Paso 0**: lint OK · test OK · plan OK

> ⚠️ El árbol contiene **dos changes mezclados**: `drop-static-exercise-catalog` (baseline ya
> verificado, sin archivar) y este. El review se acotó a este change; el baseline se trató como
> punto de partida.

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=template-owned-routine-days` | OK (`riesgo=alto`, exit 0) |
| Lint | `make lint` | OK — 0 errores (43 warnings preexistentes, ninguno nuevo) |
| Tests | `make test` | OK — **261** backend + 189 frontend (+1 test de regresión del hallazgo 1) |

## Escenarios de la spec

QA enumeró y verificó los **32 escenarios** de las 4 capabilities. **32/32 PASA**, sin fallas.

| Capability | Escenarios | Resultado |
|---|---|---|
| `routine-templates` | 20 | 20 PASA |
| `progression-strategies` | 2 | 2 PASA |
| `routine-assignment` | 4 | 4 PASA |
| `member-routine-view` | 6 | 6 PASA |

Mezcla de evidencia: UI en vivo sobre el stack Docker, requests directos a la API contra Postgres
real, y los tests nombrados en el `## Plan de verificación`. El detalle escenario por escenario y
los recorridos manuales están en [`manual-verification.md`](manual-verification.md).

Cobertura extra verificada por el riesgo alto:

- **Autorización**: un Miembro recibe **403** en los 4 endpoints de plantillas
  (`GET /routines/templates`, `GET /routines/templates/{id}`, `POST /routines/templates`,
  `PUT /routines/templates/{id}/days`).
- **Borde de 6 días** directo a la API → 422, sin persistir nada.
- **Migración** verificada a mano contra Postgres (el gate no corre `alembic upgrade head`):
  `routine_template_days` 8→4, un Día 1 por plantilla, tablas del catálogo global y columnas de
  base efectivamente borradas.

## QA manual

Ejecutada (riesgo alto: no se omite). Reporte completo en `manual-verification.md`. Resumen:
recorrido de Dueño completo, recorrido de Coach sobre plantilla asignada con el histórico
verificado por API, ejercicio inactivo y catálogo sin base — todos PASA.

Durante QA se encontraron y resolvieron dos cosas:

1. **La barra de guardado tapaba el botón "Quitar día"** (defecto real, el click no llegaba).
   Arreglado: `sticky bottom-4` se comporta como `fixed` en cuanto el documento supera el
   viewport, así que reservar padding no sirve — se pasó al patrón de scroll propio de
   `ListPageLayout`.
2. **"Volver a Rutinas" no avisaba de cambios sin guardar** — reportado como FALLA y después
   **descartado**: era un artefacto de HMR de Vite. Reverificado sobre contenedor reiniciado y
   recarga dura, 4/4 correcto.

## Hallazgos

### Mayores — **los dos CORREGIDOS y re-verificados**

1. **[mayor · CORREGIDO]** `backend/app/routers/routine_templates.py:245-266` — **un `day_id` repetido en el
   payload colapsa días en silencio y rompe I1.** `payload_day_ids` es un `set` y
   `RoutineTemplateDayInput` no valida unicidad de `day_id` dentro de `days` (a diferencia de
   `exercise_id` dentro de un día, que sí la valida con `_unique_exercise_ids`).

   Reproducido: `PUT /routines/templates/{id}/days` con `days: [{day_id: X}, {day_id: X}]`
   responde **200 OK** y deja la plantilla con **un solo día en `position=2`**. Eso viola I1
   ("posiciones contiguas 1..N"), el detalle pasa a responder `name: "Día 2"` para el único día, y
   el `day_name` que se snapshotee después en `WorkoutLog` queda desalineado con el
   `dayTitle(index)` del frontend, que muestra "Día 1". Debería ser 422, igual que un ejercicio
   repetido. No es alcanzable desde la UI actual, pero sí desde la API.

   **Corregido**: `validate_unique_day_ids` en `backend/app/schemas.py:646` rechaza con 422 un
   `day_id` no nulo repetido (los `null`, días nuevos, siguen sin restricción). Regresión cubierta
   por `test_repetir_un_day_id_dentro_del_mismo_guardado_es_422_y_no_persiste_nada`, que además
   verifica que la plantilla conserva su único día con el `id` y `position=1` originales.
   Re-ejecutado de forma independiente: pasa.

2. **[mayor · CORREGIDO]** `frontend/src/pages/__tests__/UserRoutine.test.tsx:184-194` — **un test verde que no
   puede fallar.** `no muestra un ejercicio que ya no está en el día de la plantilla` monta
   `makeDetail({})`, un fixture que **nunca contuvo** "Aperturas con mancuernas", y asserta que ese
   texto no está. Pasa aunque `UserRoutine` renderizara indiscriminadamente todo lo que recibe: no
   existe input que lo ponga rojo. Es una de las dos filas del `## Plan de verificación` para **I7**
   del lado frontend, así que esa mitad del invariante queda **sin cobertura real**.
   (`muestra solo los días de la plantilla asignada`, línea 161, es débil por el mismo motivo.)

   **Corregido**: el fixture ahora tiene un Día 2 que **sí** contiene "Aperturas con mancuernas",
   de modo que el test se pone rojo si el componente renderiza los ejercicios de todos los días. El
   segundo test compara la lista **completa** de tabs contra `["Día 1", "Día 2"]` en vez de solo
   negar "Día 3". **Comprobación romper/revertir ejecutada**: con
   `template.days.flatMap(d => d.exercises)` el primero falla; con un tab "Día 3" fijo en el JSX
   falla el segundo; revertidos ambos, vuelven a verde. `UserRoutine.tsx` quedó sin cambios — solo
   cambió el archivo de test.

### Menores

3. **[menor]** `backend/app/routers/routine_templates.py:260-266` — reordenar días por API responde
   **409**, aunque D5 afirma que "el contrato lo soporta gratis". Con A(pos 1) y B(pos 2), mandar
   `days: [B, A]` choca con `uq_routine_template_days_template_position` porque el `UPDATE` de
   `B.position = 1` se autoflushea mientras A todavía la ocupa. No es alcanzable desde la UI, pero
   la afirmación del design es falsa y quien implemente reordenar va a necesitar dos pasadas.

4. **[menor · CORREGIDO]** `backend/migrations/versions/3887b713f57d_template_owned_routine_days.py:112` — la
   migración crea `strategy` como `VARCHAR` mientras el modelo lo declara
   `Enum(ProgressionStrategy)`. Funciona en runtime, pero el próximo `--autogenerate` va a emitir un
   `ALTER COLUMN` espurio y el tipo `progressionstrategy` queda huérfano en la base.

   **Corregido**: pasa a `postgresql.ENUM(..., name="progressionstrategy", create_type=False)`,
   coherente con el modelo y con la migración vieja. Verificado sobre una base **recreada desde
   cero**: `strategy` queda con tipo `progressionstrategy`, y un `--autogenerate` de prueba no
   propone ningún `ALTER COLUMN` sobre esa columna.

5. **[menor]** `backend/app/routers/exercises.py:298-303` y `324-328`, `backend/app/models.py:449` —
   comentarios que describen código que **este mismo change borró** (`day_links`,
   `_offered_as_new_option`, `RoutineTemplateExercise`).

6. **[menor]** `backend/app/routers/routines.py:26-32` — `_normalize_exercise_name` quedó sin
   callers (y su `import unicodedata`); su docstring cita endpoints retirados.

7. **[menor · CORREGIDO]** `backend/tests/test_routines_invariants.py:26-32` — el candado de **I9** no incluye
   `TRAINING_DAYS` en `retired_symbols`, pese a que su docstring y `backend/AGENTS.md` dicen que sí.
   Un módulo que pegara la lista a mano pasaría el candado. Arreglo de una línea.

   **Corregido**: `TRAINING_DAYS` agregado a `retired_symbols`.

8. **[menor]** `frontend/src/components/Sidebar.tsx:69-79` — el botón de **logout** no pasa por
   `guardedNavigate`. Un Coach con 3 días de borrador que cierra sesión los pierde sin aviso; el
   `beforeunload` no cubre este caso porque no hay recarga de documento.

9. **[menor]** `frontend/src/pages/RoutineTemplateDetail.tsx:288-295` — un refetch en background
   puede pisar el borrador. El `useEffect([template])` despacha `RESET` al cambiar la identidad del
   objeto de React Query, y `refetchOnWindowFocus: true` con `staleTime: 30_000` lo dispara al
   volver a la pestaña. El structural sharing lo salva mientras la plantilla no cambió en el
   servidor; si otro Dueño/Coach la editó, el borrador local se descarta **sin aviso** y `dirty` se
   apaga. Es más agresivo que el "último guardado gana" que declara el design: acá el perdedor ni
   llega a guardar.

### Estilo (sin escenario de falla)

- El serializador de día/ejercicio está triplicado casi idéntico en `routine_templates.py:87-115`,
  `routines.py:61-93` y `routine_assignments.py:371-401`. D7 justificaba dos copias; con tres, el
  riesgo de divergencia (p. ej. el formato del título) crece.
- `DayCard` dispara `useExercisesQuery` aunque el buscador esté vacío, una vez por día montado:
  hasta 5 requests a `/exercises/` al abrir el detalle sin que el usuario haya tipeado nada.

## Sin verificar

- **Producción (Railway)**: no se tocó, deliberadamente. La migración en prod es un paso manual
  posterior — este repo no corre migraciones en el deploy.
- **Escenario 31** (`sin asignación Activa, el overview lo indica`) se verificó **solo por API**: el
  Miembro no tiene pantalla de overview en este build (`/dashboard` redirige a `/my-routine`, y
  *Seguimiento* / *Asistencias* están "TO DO"). Limitación **preexistente**, ajena a este change.
- **El histórico no se pudo ver en la UI** por la misma razón; el invariante I6 se verificó por API
  y por `test_member_routine.py`.
- **Riesgo declarado**: el Code Reviewer lo contrastó contra el diff y coincide con **alto** (toca
  `models.py`, `migrations/**` y borra datos existentes).

## Recomendación

**PASA.** Los dos hallazgos mayores y los dos menores de una línea (4 y 7) están corregidos y
re-verificados de forma independiente: `check-plan` OK (`riesgo=alto`), `make lint` 0 errores,
`make test` **261 + 189** en verde, y los tests de regresión ejecutados por separado.

El change puede seguir a `/opsx:sync` y `/opsx:archive`.

### Anotado para después (no bloquea)

Los menores **3, 5, 6, 8 y 9** quedan sin corregir, deliberadamente:

- **3** (reordenar días da 409) y **5**, **6** (comentarios y código muerto) son deuda acotada; 3
  además contradice una afirmación de D5 que conviene arreglar **cuando** se implemente reordenar.
- **8** (logout sin guard) y **9** (un refetch en background pisa el borrador) son **decisiones de
  producto sobre el borrador**, no defectos de implementación: definen qué pasa cuando el usuario
  se va o cuando dos personas editan la misma plantilla a la vez. El design declara "el último
  guardado gana", y el 9 es más agresivo que eso — el perdedor ni llega a guardar. Vale la pena
  decidirlo explícitamente, no resolverlo de apuro dentro de este change.

Al archivar: `docs/producto/09-backlog-mvp.md` tiene los ítems **R-3** y parte de **R-2** que este
change implementa, pendientes de tachar y de completar la columna Change.
