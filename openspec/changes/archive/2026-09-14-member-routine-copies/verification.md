# Verificación: member-routine-copies

**Fecha**: 2026-09-14 (segunda vuelta, tras corregir la FALLA y los dos mayores de la primera)
**Veredicto**: PASA
**Diff verificado**: working tree vs `main` (`1dc66e1`)
**Riesgo declarado**: alto (confirmado por el Code Reviewer: dispara tres gatillos por separado)
**Paso 0**: lint OK · test OK · plan OK

> **Historial**: la primera vuelta dio **FALLA** — no por el gate mecánico, sino porque un escenario
> de la spec no se cumplía. Se corrigió y se re-verificó. El detalle de lo que falló y cómo se
> resolvió está más abajo, porque es la parte útil de este documento.

## Paso 0 — gate mecánico

| Chequeo | Comando | Resultado |
|---|---|---|
| Plan de verificación | `make check-plan CHANGE=member-routine-copies` | OK (`riesgo=alto`, exit 0) |
| Lint | `make lint` | OK — 0 errores (43 warnings preexistentes, ninguno nuevo) |
| Tests | `make test` | OK — **282 backend + 208 frontend** |

La suite creció de 273 + 198 (primera vuelta) a **282 + 208**: 19 tests nuevos, todos escritos para
cerrar agujeros concretos.

## Escenarios de la spec

**39 escenarios de 6 capabilities. 39 PASA.**

| Capability | Escenarios | Primera vuelta | Ahora |
|---|---|---|---|
| `routine-assignment` | 12 | 12 PASA | 12 PASA |
| `routine-progress-tracking` | 16 | 16 PASA | 16 PASA |
| `member-routine-view` | 3 | 3 PASA | 3 PASA |
| `progression-strategies` | 5 | 4 PASA · **1 FALLA** | **5 PASA** |
| `data-table-row-actions` | 4 | 4 PASA | 4 PASA |
| `routine-templates` | 3 | 3 PASA | 3 PASA |

## Lo que falló y cómo se resolvió

### La FALLA — "Cambiar la estrategia recalcula el plan al instante"

**Síntoma**: al clickear un chip de estrategia, las series seguían mostrando el plan viejo hasta
guardar. La causa era que el reducer actualizaba `strategy` pero dejaba `planned_sets` como vino del
último fetch, y **no existe ninguna fórmula de progresión en el frontend** — a propósito, porque
`frontend/AGENTS.md` lo declara así.

**Decisión del usuario**: endpoint de previsualización (D13). Ni duplicar la fórmula en el cliente,
ni aflojar el requirement.

`GET /routines/progression/preview?strategy=&sets=&reps=&weight_kg=`, **sin estado**: no recibe
plantilla, asignación, día ni ejercicio, así sirve igual al editor de plantilla y al de copia y
funciona sobre un día que todavía no existe en la base. El editor lo consume declarativamente por
fila, con la key de React Query = la tupla y `staleTime: Infinity`, y en `RESET` siembra la caché
con los `planned_sets` del detalle — la carga inicial no pide nada y volver a una estrategia ya
vista cuesta cero requests.

**Ahora PASA**, verificado con evidencia de Network en las dos pantallas: el chip y la edición de
base disparan el request, la tupla cacheada no lo repite, el estado en vuelo atenúa y dice
"Recalculando…", el error ofrece "Reintentar" **sin bloquear guardar**, y lo previsualizado
coincide con lo guardado tras recargar.

### Mayor 1 — la vista de Progreso filtraba en memoria

Pedía `limit: 200` y filtraba por ejercicio y período en el cliente, aunque D6 había agregado esos
parámetros al backend **para esta pantalla**. A escala realista (~150 marcas/mes) el Coach filtraba
un ejercicio del mes pasado y veía "Sin registros", con las filas existiendo.

**Resuelto**: los filtros viajan como parámetros. Además el default del selector y el estado "sin
progreso" ahora salen de `logged-exercises`, así que "sin progreso" ya no se confunde con "el
filtro no encontró nada".

### Mayor 2 — el Historial del Miembro se quedaba en 40 marcas

Y las opciones del filtro salían **de esas mismas 40 filas**, de modo que un ejercicio quitado de la
copia desaparecía del filtro a las ~3 sesiones — justo el requirement por el que existe ese panel.

**Resuelto**: `GET /routines/my/logged-exercises` (D15), espejo del de staff resuelto sobre el token
y calculado sobre el **histórico completo**, que es la única forma de ofrecer un ejercicio que ya no
está en la copia. Respeta I10: no acepta un `user_id` de la URL.

### Menores corregidos

- **Upsert a prueba de concurrencia** (I23): `mark_set` captura `IntegrityError`, hace `rollback` y
  relee. Antes, dos requests solapados daban **500** en vez de aplicar la corrección.
- **`day_name`** (I24): guarda `"Día {position}"`, no el título con grupos musculares. Antes el
  mismo día podía quedar con dos etiquetas distintas en el histórico.
- **Grano del puntaje** (D14, I20/I21): cuenta **sesiones**, no series. Antes un Miembro con una
  sola sesión de 12 series saturaba un componente que pedía 3-4 sesiones. `unique_days` se retiró en
  favor de `session_count`, y `UserCard.tsx` dejó de reimplementar la fórmula en el cliente.
- **Key de React Query** movida a `queryKeys.ts`; **`frontend/AGENTS.md`** con el vocabulario de
  acciones de fila corregido; **badge vacío** condicionado en el editor de la copia.
- **Sin conexión, la previsualización avisa** (I19): React Query pausa la query offline
  (`fetchStatus: "paused"`, sin fetching y sin error), así que con `keepPreviousData` se mostraba el
  plan de la tupla vieja **en silencio** — el mismo defecto de la FALLA por otra puerta. Ahora el
  estado pausado atenúa y dice "Sin conexión: no pudimos recalcular, este plan puede estar
  desactualizado".

## Los tests nuevos pueden fallar

Es el punto que más se cuidó, porque el agujero de "verde incapaz de fallar" apareció **tres veces**
en esta sesión. El Code Reviewer los auditó uno por uno y los Dev hicieron romper/revertir:

- **Fixtures más grandes que la ventana**: 201 filas para Progreso y 41 para Historial, con el
  registro buscado **fuera** de la ventana. Con un fixture que entre en la ventana, el test pasaría
  con el código roto.
- **`day_name`** usa `muscle_groups: ["Pecho"]`: con `[]` las dos implementaciones producen el mismo
  string. El test viejo `test_quitar_un_dia_…` tenía exactamente ese punto ciego y **se corrigió**.
- **La previsualización** compara el endpoint contra los `planned_sets` del `PUT`, con `pyramid`
  (no `constant`, donde cualquier implementación coincidiría): detecta **divergencia**, no que
  responda 200.
- **El puntaje** tiene el par que distingue el grano: 12 series en un día ⇒ 10/40; 4 sesiones de 1
  serie ⇒ 40/40. Con `len(logs)` los resultados se invierten.
- **La concurrencia** parchea `Query.first` para forzar el `IntegrityError` contra una fila ya
  commiteada: sin el `try/except` la excepción sube y el test revienta.

## Filas manuales del Plan de verificación

| Fila | Resultado |
|---|---|
| Recálculo al instante (el escenario que falló) | **PASA** — evidencia de Network, estados en vuelo y error, y coincidencia previsualizado/guardado |
| Ejecución en el teléfono (marcar, recargar, precargado) | PASA |
| **Ejecución a 390 px** | **PASA** — verificado con emulación de dispositivo (390×844, mobile+touch): `scrollWidth == clientWidth == 390`, sin overflow horizontal; se marcó una serie real y el botón pasó a "Corregir" |
| Gráfico de evolución | PASA |
| Migración | Verificada durante la implementación contra **dos** bases Postgres (nativa y Docker), y el esquema resultante auditado punto por punto contra D11 |

## Hallazgos abiertos (ninguno bloqueante)

1. **[menor]** `frontend/src/pages/MemberProgress.tsx:111` — queda un `limit: 200` que ahora
   **trunca en silencio** en vez de filtrar mal. Un Miembro con un año de "Press banca" (~600 filas)
   hace que el gráfico arranque ~4 meses atrás sin ningún cartel. Se cierra avisando cuando
   `logs.length === limit`, o alimentando el gráfico de un agregado por sesión.
2. **[nit]** `frontend/src/pages/UserRoutine.tsx:403-409` — `HistoryPanel` dispara sus dos requests
   aunque el panel esté colapsado; `enabled: open` lo resuelve.
3. **[nit]** `frontend/src/pages/UserRoutine.tsx:410` — `filteredLogs` conserva el nombre de cuando
   filtraba en memoria; ya no filtra nada.

## Sin verificar

- **Producción (Railway)**: no se tocó, deliberadamente.
- **"Un Miembro no puede ver el progreso de otro"**: dado por cumplido **por construcción** (no
  existe endpoint member-scoped que acepte un `user_id` ajeno; `/users/{id}/logs` devuelve 403 a un
  Miembro, con test), no por prueba con dos Miembros reales — crear un segundo Miembro con
  contraseña exige pasar por el flujo de invitación por email.

## Nota para quien retome el entorno de desarrollo

Dos cosas que costaron tiempo en esta sesión y no son defectos del producto:

- El contenedor de backend corre **sin `--reload`**: si un endpoint "no existe" o aparece un error
  de esquema, `docker compose restart backend` antes de sacar conclusiones.
- El **`DevRoleSwitcher`** (widget flotante, solo en desarrollo) **intercepta los botones de acción
  a 390 px**: un clic en "Marcar" puede terminar cambiando de rol, en silencio. Colapsarlo antes de
  verificar. No existe en producción.

La base de desarrollo quedó con datos de prueba: `dev.member` tiene 4 copias de "Fuerza 4 dias"
(1 Activa + 3 Alternativas) y "Cliente QA Test" tiene 3, una huérfana de una plantilla borrada.
Conviene rearmarla antes del próximo recorrido.

## Veredicto

**PASA.** Los 39 escenarios se cumplen, el gate mecánico está en verde, los tres hallazgos mayores
se cerraron **en el mecanismo y no en la superficie** (auditado por el Code Reviewer), y los tests
que los cubren son capaces de fallar. Puede seguir a `/opsx:sync` y `/opsx:archive`.
