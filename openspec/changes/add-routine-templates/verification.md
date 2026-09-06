# Verificación: add-routine-templates

**Fecha**: 2026-09-06
**Veredicto**: PASA CON RESERVAS
**Diff verificado**: working tree sin commitear sobre `8f738d0` (solo los archivos del change; los de
`move-user-actions-to-detail`, de otra sesión, quedaron fuera del alcance)
**Riesgo declarado**: alto
**Paso 0**: lint OK · test OK · plan OK

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=add-routine-templates` | OK (`riesgo=alto`, exit 0) |
| Lint | `make lint` | OK (exit 0; ruff limpio; eslint 0 errores / 40 warnings, baseline previo 33: las 7 nuevas son `catch (error: any)` en diálogos nuevos) |
| Tests | `make test` | OK (exit 0; backend 142 passed, frontend 106 passed en 23 archivos; baseline previo 87 / 93) |

## Escenarios de la spec

Resumen por capability. La tabla completa escenario a escenario está en el reporte de QA (sección
siguiente); acá se listan los que tuvieron alguna particularidad.

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| routine-templates / 15 escenarios (crear, sin días, renombrar, quitar y reagregar día, desactivar conserva estrategia, misma configuración independiente por plantilla, duplicado por mayúsculas, duplicado por espacios, eliminar sin asignaciones, rechazo con conteo, crear ejercicio con y sin base, Dueño edita base, Coach no puede, listado solo días de la plantilla) | UI con run-app (Dueño y Coach) + requests a la API | PASA (15/15) |
| progression-strategies / 14 escenarios (recálculo al instante, Constante, Pirámide ×4, Invertida ×3, Drop set ×2, Rest-pause ×2, sin control de parámetros, sin estrategia de plantilla, default Constante) | UI y API para los casos base 4×8 · 45 kg; tests unitarios `backend/tests/test_progression.py` para los casos de borde (piso 3 reps, piso 2,5 kg, half-up con R impar, piso 1 rep) | PASA (14/14; 6 solo automatizados) |
| routine-assignment / 12 escenarios (primera Activa, Alternativa, nueva Activa degrada la anterior, ajuste con autoría, sin ajustes, quitar ajuste, rechazo a miembro sin membresía, reactivar habilita, la baja conserva asignaciones, quitar Alternativa, quitar Activa no promueve, ficha con estados) | UI con run-app (Coach) + API + consulta a `routine_assignment_bases` | PASA (12/12) |
| routine-assignment / "el Miembro sigue viendo sus plantillas en Mi rutina tras la baja" | Solo a nivel API con override de `get_current_user` (igual que `test_member_routine.py`). End-to-end es inalcanzable: `auth.get_current_user` responde 401 a cualquier request de un Miembro con membresía cancelada (regla preexistente, invariante I5) | PASA a nivel datos · NO VERIFICABLE end-to-end (ver hallazgo 3) |
| member-routine-view / 7 escenarios (elige entre asignadas, sin plantillas, solo días de la elegida, plan por serie sin ejercicios inactivos, solo lectura, base ajustada, cambio del admin se refleja) | UI con run-app (Miembro) | PASA (7/7) |
| Responsivo ~390 px: Rutinas, detalle de plantilla y Mi rutina | Chrome con viewport emulado 390×844 (mobile, touch), como Dueño y Miembro. `document.scrollWidth == 390` en las tres vistas; la tabla de Rutinas scrollea dentro de su contenedor `overflow-auto` (568 px en 322 px); chips de estrategia y series hacen wrap; consola sin errores ni warnings. QA no pudo cubrirlo por falta de herramienta de resize; lo cubrió el orquestador | PASA |

## QA manual

Riesgo alto: QA corrida en la app real (stack Docker `db + backend + frontend`, `make seed-dev`,
tres roles). Reporte del rol QA:

- **Entorno**: el stack ya estaba arriba pero la migración `69362a3ad95d_add_routine_templates` no
  estaba aplicada y el contenedor backend corría código anterior (routers nuevos ausentes en
  `openapi.json`). Se resolvió con `alembic upgrade head` dentro del contenedor y
  `docker compose restart backend`. Confirma la nota de `design.md` y `backend/AGENTS.md`: la
  migración no corre sola y en Railway debe aplicarse a mano **antes** del deploy.
- **~48 escenarios** de las 4 specs recorridos: todos PASA (tabla completa en el reporte del rol;
  resumida arriba). Los 5 casos manuales del `## Plan de verificación` quedaron cubiertos.
- Valores numéricos verificados exactos en UI/API para Press banca 4×8 · 45 kg en las cinco
  estrategias; resto de los casos por tests unitarios.
- Datos de prueba que quedaron en la base Docker de desarrollo: dos plantillas ("Fuerza 4 dias",
  "Full body inicial · Avanzado") y dos ejercicios "QA Test Exercise …" (no hay endpoint para
  borrar ejercicios). Sin impacto en producción.
- QA reportó un hallazgo medio (coincide con el hallazgo 2 de Code Review) y una nota informativa
  sobre el gate de membresía (coincide con el hallazgo 3).

## Hallazgos

Code Reviewer verificó además: 13 casos numéricos del motor recalculados a mano, cadena de
migración con un solo head y `downgrade` completo, backfill de 52 ejercicios contra
`EXERCISE_LIBRARY` sin diferencias, índice único parcial "una sola Activa" creado de verdad,
permisos por router y endpoint, consistencia 1:1 de 9 tipos y 15 rutas entre backend y frontend,
riesgo alto coherente con la tabla de `role-architect`.

1. **[mayor]** `frontend/src/components/EditExerciseBaseDialog.tsx:50` y
   `frontend/src/components/AdjustExerciseBaseDialog.tsx:92,107` — el `detail` de un 422 de
   FastAPI es una lista de objetos, no un string, y `ConfirmActionDialog` lo renderiza directo
   como hijo de React: pantalla en blanco (no hay ErrorBoundary). Input: como Dueño, "Editar base",
   vaciar el campo Series (queda `0`), Guardar → 422 → blanco. Mismo camino en "Ajustar base" de la
   ficha del Miembro. El repo ya tiene el guard correcto en `InvitationAccept.tsx:100`.
2. **[mayor]** `frontend/src/components/AdjustExerciseBaseDialog.tsx:67-75` — "Ajustar base" no
   precarga el ajuste vigente (el contrato de la asignación no expone overrides por ejercicio,
   solo `adjustments_count` y `last_adjustment`) y prellena con la base del catálogo. Confirmar sin
   tocar campos, o tocar uno solo, pisa el ajuste anterior sin aviso. Reproducido por QA con
   evidencia en `routine_assignment_bases` (4×6 · 50 kg → 5×5 · 70 kg). Pérdida de datos del Coach.
3. **[mayor]** `openspec/changes/add-routine-templates/specs/routine-assignment/spec.md` (escenario
   "el Miembro sigue viendo sus plantillas en Mi rutina" tras la baja) — el producto no lo cumple:
   `backend/app/auth.py:80` bloquea con 401 cualquier request de un Miembro con membresía
   cancelada, token vigente incluido. El invariante del change (el endpoint no filtra por
   membresía) sí se cumple y está testeado con override de `get_current_user`. Si se sincroniza la
   spec tal cual, `openspec/specs/routine-assignment/` afirmará un comportamiento falso: hay que
   acotar el THEN a "las asignaciones se conservan" o abrir un change sobre el gate de login.
4. **[menor]** `backend/app/routers/routine_templates.py:256` — `PATCH` con `{"name": "   "}`
   responde 200 sin cambios (el strip lo convierte en `None`); `POST` con el mismo input da 422.
5. **[menor]** `frontend/src/services/routineTemplates.queries.ts:199` y `routineTemplates.ts:134`
   — `useUpdateAssignmentStatusMutation` y su fetcher no tienen caller (código muerto; el caso
   "promover Alternativa" se cubre reasignando como Activa).
6. **[menor]** `frontend/src/components/PlannedSetsList.tsx:27` y
   `frontend/src/pages/RoutineTemplateDetail.tsx:157` — pesos con punto decimal ("47.5 kg") en una
   UI que en el resto del repo formatea con `es-AR` ("47,5 kg", como la spec).
7. **[menor]** Accesibilidad: labels sin `htmlFor`/`id` en `AdjustExerciseBaseDialog.tsx:127-152`,
   `AssignTemplateDialog.tsx:77,93`, `EditExerciseBaseDialog.tsx:68-76`; `role="tablist"` sin
   `aria-controls`/`tabpanel`/flechas en `UserRoutine.tsx:156-174`; fila clickeable sin acceso por
   teclado en `Routines.tsx:129-133` (el botón "Ver" sí es accesible).
8. **[menor]** `RoutineTemplateDetail.tsx:173,182` — `isPending` del autosave deshabilita el switch
   y los chips de **todos** los ejercicios de todos los días, no solo el tocado.
9. **[menor]** `Routines.tsx:138` y `RoutineTemplateDetail.tsx:100` — badge vacío cuando la
   plantilla no tiene etiqueta.
10. **[menor]** `docs/propuestas/rutinas-descripcion-funcional.md` está referenciado por ruta desde
    `backend/app/routine_catalog.py:57` y `proposal.md` pero es untracked y no figura en el alcance
    del change: si no se commitea, quedan punteros rotos.
11. **[observación]** Los ejercicios del catálogo sin equivalente en el prototipo nacen con base
    3×10 · 0 kg (`_DEFAULT_BASE`), así que el plan del Miembro muestra "0 kg × 10" hasta que el
    Dueño edite la base. Es la decisión G1 aceptada en el proposal, pero conviene tenerlo presente
    para la puesta en producción.

## Sin verificar

- `alembic upgrade head` / `downgrade -1` / `upgrade head` contra Postgres real solo lo ejecutó el
  Dev de backend (Postgres nativo local) y QA aplicó `upgrade head` en el contenedor Docker sin
  error; Code Reviewer no lo repitió.
- Comportamiento real con lector de pantalla y navegación por teclado (solo revisión estática,
  hallazgo 7).
- Los archivos de la sesión paralela (`ConfirmActionDialog.tsx`, `permissions.ts`, diálogos de
  membresía/invitación/contacto, `users*`) se leyeron como dependencias, no se revisaron como diff.
- Escenario 3 end-to-end vía login real (bloqueado por regla preexistente, ver hallazgo 3).

## Reservas para decidir antes de `/opsx:sync` y `/opsx:archive`

1. Corregir el hallazgo 1 (normalizar `detail` antes del JSX): un keystroke lleva a pantalla en
   blanco en el camino manual del propio Plan de verificación.
2. Decidir el hallazgo 2: exponer los overrides por ejercicio en el contrato de la asignación y
   precargarlos, o al menos no enviar campos que el Coach no tocó.
3. Resolver el hallazgo 3 en la spec (acotar el THEN) o abrir un change para el gate de login; no
   sincronizar la afirmación actual tal como está.
