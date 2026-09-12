# Verificación: add-exercise-catalog

**Fecha**: 2026-09-12
**Veredicto**: PASA CON RESERVAS
**Diff verificado**: working tree contra `ecab5f2`, acotado a los archivos de este change
**Riesgo declarado**: alto
**Paso 0**: lint OK · test OK · plan OK

> **Este archivo reemplaza un veredicto FALLA previo.** La primera ronda encontró 11 hallazgos
> (2 bloqueantes, 3 mayores, 6 menores). Se arreglaron, y el re-review encontró que **tres
> arreglos no habían cerrado el problema**: H1 quedó incompleto, H2 abrió un 500 nuevo y H4
> introdujo corrupción a nivel proceso. Se rehicieron y una tercera pasada los confirmó. El
> historial completo está en la sección "Rondas de verificación".
>
> **Nota de alcance.** Las tasks 9.1–9.5 (Railway) quedaron deliberadamente sin ejecutar: son
> operaciones sobre infraestructura viva (crear el bucket, deployar, correr la migración a mano,
> `DELETE FROM exercises` en producción) que hace el usuario. No hay ninguna task de código
> pendiente.
>
> **El working tree tiene dos changes mezclados**: `add-exercise-catalog` y
> `simplify-settings-view`, de otra sesión en paralelo. La revisión se acotó a los archivos de
> este change. Las dos migraciones encadenan bien (`d5f74a834ac0` → `c387dcc091c2` →
> `e79526156f68`), hay un solo head, no hay rama de Alembic.

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=add-exercise-catalog` | OK (exit 0, `riesgo=alto`, los 36 casos existen) |
| Lint | `make lint` | OK (exit 0; ruff limpio, eslint 0 errores / 43 warnings preexistentes, `tsc` limpio) |
| Tests | `make test` | OK (exit 0; backend 242 passed, frontend 170 passed / 33 archivos) |

`openspec validate add-exercise-catalog --strict` → válido.

## Escenarios de la spec

QA levantó el stack de Docker completo (db + backend + frontend + minio) y verificó **los 40
escenarios de las dos specs: todos PASA, ninguno NO VERIFICABLE**. La tabla completa de esa
corrida está en la sección "Ronda 1" más abajo.

Tras los arreglos, QA re-verificó en la app real los escenarios cuyo comportamiento cambió y las
regresiones que los arreglos tenían que cerrar:

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| Ejercicio sin grupo muscular no rompe Rutinas | UI con Dueño y Coach: `/routines/days`, `/routines/catalog`, `/routines/exercises` → 200; "Crear plantilla" muestra los 4 días con checkboxes y el botón se habilita; "Mi rutina" del Miembro renderiza el ejercicio con la etiqueta "Sin grupo muscular" | PASA |
| Editar el grupo muscular no saca el ejercicio de una plantilla que ya lo usa | Ejercicio agregado explícitamente a una plantilla; `PATCH muscle_group` a "Espalda" y después a `null` — en ambos casos sigue en el detalle de la plantilla y en "Mi rutina" del Miembro | PASA |
| Un ejercicio vinculado solo por el catálogo fijo de días sí se mueve de día | Cambió de día al cambiarle el grupo. **Es el comportamiento correcto**: la spec distingue el vínculo automático de "usado en una plantilla" y ese vínculo no cuenta como uso | PASA |
| Reactivar no pisa la curación por día | Excluido de un día con `PUT /routines/days/day-2/selection`, desactivado y reactivado → sigue excluido (`is_active:false`) en `GET /routines/days` | PASA |
| Reactivar vuelve a ofrecer el ejercicio para una plantilla | Aparece en `/exercises/?is_active=true` tras reactivar | PASA |
| Subir un mp4 real: reproduce y hace seek | mp4 real de 1,1 MB; reproducción 0:00→0:05 con frame visible; seek del scrubber → `206 Partial Content` desde `localhost:9000` | PASA |
| Formato no soportado rechazado | PDF con extensión `.mp4` y magic bytes reales de PDF → 415; media anterior intacta | PASA |
| Tamaño por encima del máximo rechazado | `STORAGE_MAX_UPLOAD_BYTES + 1` byte → 413; media anterior intacta | PASA |
| **Archivo de exactamente el tamaño máximo aceptado** | Exactamente 26.214.400 bytes → **200**, `media_size_bytes: 26214400`. Antes se rechazaba por el overhead de los boundaries | PASA |
| Reemplazar el archivo | mp4 nuevo sobre uno existente → 200, `media_filename` cambia | PASA |
| Prioridad archivo + URL, gana el archivo | Con archivo presente, se agrega `external_media_url` → `media_kind` sigue en `"file"` | PASA |
| Quitar el archivo deja la URL externa | `DELETE .../media` → `media_kind: "external"`, `media_file_url: null` | PASA |
| Autorización (Dueño, Coach, Miembro, sin token) | Dueño y Coach 200/201; Miembro 403; sin token 401 | PASA |

## QA manual

Corrida completa (riesgo alto, no se omite) más una re-verificación acotada tras los arreglos.
Stack de Docker real, los tres roles, archivos de media reales. **Sin regresiones.**

## Hallazgos

Los 11 hallazgos originales están cerrados: **9 arreglados**, **2 resueltos por decisión de
diseño** (H6 y H7, ver `design.md` D7.1 y D4.1). Ninguno quedó abierto.

Los tres arreglos que fallaron en el re-review y se rehicieron:

- **H1** se había corregido en un solo schema y quedaban cinco más (`RoutineCatalogExercise`,
  `RoutineCatalogGroup`, `RoutineExerciseManageOut`, `RoutineTemplateExerciseOut`,
  `WorkoutLogOut`) declarando `muscle_group: str` contra la columna nullable. Cerrado, más un bug
  hermano que apareció al hacerlo: `routine_catalog()` ordenaba con
  `sorted(key=lambda item: item[0])`, que tira `TypeError` comparando `None` con `str`.
- **H2** abrió un 500 nuevo: al conservar el `TrainingDayExercise`, un `PATCH
  {"muscle_group": null}` sobre un ejercicio usado en plantilla rompía el detalle de plantilla y
  "Mi rutina". Se cerró al completar H1.
- **H4** introdujo un problema peor que el que arreglaba: el monkeypatch de
  `botocore.auth.get_current_datetime` capturaba el original **fuera** del lock, así que dos
  hilos concurrentes podían dejar ese símbolo congelado permanentemente en todo el proceso
  (reproducido con 8 hilos; a los 15 minutos toda firma daba `RequestTimeTooSkewed` 403, sin log
  y sin recuperación). Se rehizo sin tocar botocore: memo de la URL por `(key, ventana)` bajo
  lock, firmando con el reloj real y `ExpiresIn = ttl + window` constante.

## Reservas

1. **Dos fuentes de verdad del grupo muscular** (`backend/app/routers/routines.py`, `_ensure_seed_data`).
   Para los 52 ejercicios del seed, `desired_link_keys` se deriva del `muscle_group` estático de
   `EXERCISE_LIBRARY`, no de la fila en la base. Verificado: `chest-cable-fly` con
   `PATCH {"muscle_group": "Espalda"}` sigue apareciendo solo en `day-1` — **cambiarle el grupo a
   un ejercicio del seed nunca lo hace seleccionable en el día nuevo**, en silencio. Es
   preexistente y no rompe nada, pero ahora es un estado estable. Corregirlo implica decidir si
   `_ensure_seed_data` debe leer de la base en vez de la librería estática, lo que toca el diseño
   del reseed (D9): es una decisión de arquitectura, no un fix de una línea. **Pendiente de
   llevar al Arquitecto.**
2. **El memo de URLs prefirmadas es por proceso.** La promesa de D3 ("URL byte a byte idéntica
   durante la ventana") vale dentro de un worker. Hoy se cumple porque `backend/Dockerfile` corre
   un único uvicorn sin `--workers`; con más de un worker o tras un restart, el browser paga una
   descarga extra. Conviene dejarlo dicho en `design.md` / `backend/AGENTS.md` para el día que
   alguien escale el proceso.
3. **Cobertura**: el test de H2 cubre el detalle de plantilla pero no "Mi rutina"
   (`routine_assignments.py`), que es la superficie que el hallazgo nombraba como rota para el
   Miembro. QA lo verificó a mano y funciona; falta el candado automatizado.
4. **Menor**: en `upload_exercise_media`, la guarda es `if file.size is not None and file.size >
   límite`. En Starlette 0.48 `size` nunca es `None`, así que es defensiva; pero si alguna vez lo
   fuera, el límite se saltea en silencio. Tratar `None` como rechazo sería más seguro.

## Rondas de verificación

| Ronda | Qué se hizo | Resultado |
|---|---|---|
| 1 | Paso 0 + Code Reviewer + QA completa (40 escenarios) | **FALLA** — 11 hallazgos: 2 bloqueantes, 3 mayores, 6 menores. Los 40 escenarios PASA |
| 2 | Arreglos del Dev + re-review | **FALLA** — 6 arreglos confirmados; H1 insuficiente, H2 abrió un 500 nuevo, H4 introdujo corrupción de proceso |
| 3 | Decisión del Arquitecto sobre H6/H7 + arreglos rehechos + tercera pasada de review + QA de regresión | **PASA CON RESERVAS** |

Dato que vale registrar para futuros changes: **en las rondas 1 y 2 la suite estaba verde
mientras los bugs existían**. Los tests que debían cubrirlos ejercitaban una rama vecina — el de
la plantilla solo editaba la descripción, y el de la URL prefirmada hacía las dos llamadas dentro
del mismo segundo. Los arreglos incluyeron corregir esos tests, no solo el código.

## Sin verificar

- **Grupo 9 (Railway)**: 9.1–9.5 sin ejecutar por decisión de alcance. Queda sin verificar el
  comportamiento contra el bucket gestionado real, que es justamente donde MinIO y Railway pueden
  diferir (credenciales, path-style, firma prefirmada). Es el riesgo residual conocido del change,
  y la task 9.5 existe para cubrirlo.
- **El escenario de nombres duplicados de la migración** (H5) se validó por análisis y por los
  dos órdenes de aparición en el código de dedup, no ejecutando el `upgrade()` sobre datos reales
  de producción con esas colisiones.
