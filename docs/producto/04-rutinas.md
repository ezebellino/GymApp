# Rutinas y ejercicios

Módulo 3 del MVP. Define el catálogo de ejercicios, el editor de plantillas de rutina (días,
grupos musculares, ejercicios y series explícitas), la asignación a miembros y el seguimiento
de la progresión de peso. Reemplaza el modelo que hoy está en el código, donde los días son un
catálogo fijo y las series se derivan de una estrategia; ver §5 y §6.

Última revisión: 2026-09-06. Estado: borrador 1, con supuestos a confirmar.

---

## 0. Supuestos a confirmar

| # | Supuesto | Alternativa descartada |
|---|---|---|
| R1 | El **video o GIF** de un ejercicio es una **URL externa** (YouTube, GIF alojado) que se pega en el formulario. No hay subida de archivos en este MVP. | Upload a un storage propio. |
| R2 | **Grupos musculares** y **tipos de entrenamiento** son listas fijas del sistema en el MVP (§2). El Dueño no las edita. | Catálogos administrables. |
| R3 | Un ejercicio tiene **un** grupo muscular principal (opcional) y **cero o más** tipos de entrenamiento. | Varios grupos por ejercicio. |
| R4 | La **plantilla es la fuente de la estructura** (días, ejercicios, series con reps y kg de referencia). La asignación a un miembro **no la copia**: la referencia en vivo y guarda solo la **carga actual del miembro** por ejercicio y serie. Si la plantilla cambia, los miembros ven el cambio; conservan sus kilos en los ejercicios que siguen existiendo. | Copiar la plantilla al asignarla (snapshot). |
| R5 | La **progresión de peso la hace el miembro** desde el portal: en cada sesión ajusta los kilos y las reps de cada serie y las marca como hechas. Los kilos con los que terminó quedan como **carga actual** para la próxima sesión. El Dueño también puede ajustarla desde la ficha. | Solo el coach progresa la carga. |
| R6 | La **sesión de hoy** la elige el miembro entre los días de su plantilla activa. El sistema sugiere el siguiente al último completado. | Día fijo por día de la semana. |
| R7 | Las **estrategias de progresión** existentes (Constante, Pirámide, etc.) quedan como **generador opcional de series** en el editor: precargan la lista de series a partir de una base y el editor las deja editables. No son parte del modelo de datos de la plantilla. | Retirarlas del todo, o mantenerlas como fuente de verdad de las series. |
| R8 | El **reporte PDF de progreso** existente sale del MVP; vuelve, si hace falta, sobre el modelo nuevo. | Mantenerlo y adaptarlo ahora. |
| R9 | Los **días de una plantilla no llevan nombre libre**: se identifican por orden (Día 1, 2, ...) y por los grupos musculares planificados, que hacen de título ("Día 1 · Pecho y Bíceps"). | Nombre libre por día. |

## 1. Objetivo y usuarios

- **Dueño** (y Coach, D10): mantiene el catálogo de ejercicios con su demostración en video,
  arma plantillas de rutina día por día con series concretas, las asigna a los miembros y
  sigue cómo progresan.
- **Miembro**: elige su plantilla, entrena la sesión del día viendo el video de cada ejercicio,
  ajusta kilos y repeticiones, marca series y ve cómo evoluciona su carga.

Resuelve el dolor 2 de la visión: la rutina deja de vivir en un papel y el progreso se ve.

## 2. Conceptos

```
 Catálogo                                Plantilla de rutina
 ┌──────────────────────────────┐        ┌────────────────────────────────────┐
 │ Ejercicio                    │        │ nombre       "Fuerza 4 días"       │
 │  nombre                      │        │ tipo         Fuerza                │
 │  descripción                 │        │ días (ordenados)                   │
 │  video / GIF (URL)           │        │  └ Día n                           │
 │  grupo muscular   (0..1)     │◀──┐    │     grupos musculares planificados │
 │  tipos de entren. (0..n)     │   │    │     ejercicios (ordenados)         │
 │  activo                      │   └────│      └ ejercicio del catálogo      │
 └──────────────────────────────┘        │         series (ordenadas)         │
                                         │          └ nº · reps · kg ref.     │
 Listas fijas del sistema (R2)           └───────────────┬────────────────────┘
  Grupos musculares: Pecho, Espalda,                     │ asignada a
  Hombros, Bíceps, Tríceps, Antebrazo,                   │ (Activa | Alternativa)
  Core, Glúteos, Cuádriceps, Isquios,                    ▼
  Gemelos, Cuerpo completo              ┌────────────────────────────────────┐
  Tipos de entrenamiento: Fuerza,       │ Asignación al miembro              │
  Hipertrofia, Resistencia, Cardio,     │  plantilla, estado, desde, quién   │
  Movilidad, Funcional, Rehabilitación  │  carga actual por ejercicio/serie  │ ← progresión (R5)
                                        └───────────────┬────────────────────┘
                                                        │ genera
                                                        ▼
                                        ┌────────────────────────────────────┐
                                        │ Sesión                             │
                                        │  fecha, día de la plantilla        │
                                        │  series realizadas                 │
                                        │   └ ejercicio · nº · reps · kg ·   │
                                        │     hecha                          │
                                        │  completada sí/no                  │
                                        └────────────────────────────────────┘
```

| Concepto | Qué es |
|---|---|
| **Ejercicio** | Movimiento del catálogo: nombre, descripción, URL de video o GIF, grupo muscular principal, tipos de entrenamiento. Se desactiva, no se borra, si ya se usó. |
| **Grupo muscular** | Lista fija (R2). Clasifica ejercicios y describe qué se trabaja cada día. |
| **Tipo de entrenamiento** | Lista fija (R2). Clasifica ejercicios y plantillas. |
| **Plantilla de rutina** | Programa con nombre, tipo y días ordenados. Global del gimnasio. |
| **Día de la plantilla** | Grupos musculares planificados más una lista ordenada de ejercicios con sus series. |
| **Serie** | Repeticiones y kilos de referencia. Se agregan y quitan una a una. Los kilos de referencia son el punto de partida para un miembro nuevo en la plantilla. |
| **Asignación** | Vínculo plantilla → miembro con estado Activa o Alternativa, fecha, autor. Guarda la carga actual del miembro. |
| **Carga actual** | Kilos (y reps) con los que el miembro está haciendo hoy cada serie de cada ejercicio. Arranca en la referencia de la plantilla y avanza con las sesiones (R5). |
| **Sesión** | Una vez que el miembro entrena un día de su plantilla: qué series hizo, con cuánto, y si la completó. |

## 3. Reglas de negocio

### 3.1 Catálogo de ejercicios

- Nombre obligatorio y único (sin distinguir mayúsculas). Descripción, video/GIF, grupo
  muscular y tipos son opcionales.
- El video o GIF es una URL (R1). El sistema valida que sea una URL y la muestra embebida o
  como imagen según el tipo.
- Un ejercicio usado en alguna plantilla o sesión **no se borra**: se desactiva. Desactivado,
  no se ofrece en el editor, pero las plantillas y sesiones que lo usan lo conservan.
- Filtros del catálogo: texto, grupo muscular, tipo, activos/inactivos.

### 3.2 Plantillas

- Nombre único, tipo de entrenamiento y al menos un día.
- Cada día declara los grupos musculares que trabaja (uno o más) y una lista ordenada de
  ejercicios tomados del catálogo. El editor sugiere ejercicios del grupo planificado pero no
  restringe: se puede agregar cualquier ejercicio activo.
- Cada ejercicio del día tiene una lista ordenada de series, cada una con repeticiones y kilos
  de referencia. Se agregan y eliminan series; mínimo una por ejercicio.
- Opcional: "Generar series" desde una base y una estrategia (R7). El resultado es editable.
- Se puede reordenar días, ejercicios y series. Se puede duplicar una plantilla.
- Eliminar una plantilla solo si no tiene asignaciones vigentes. Si tiene, se archiva: deja de
  ofrecerse para asignar, los miembros que la tienen la conservan.
- Editar una plantilla asignada impacta a sus miembros (R4). El editor avisa cuántos miembros
  la tienen antes de guardar cambios de estructura.

### 3.3 Asignación

- Un Dueño asigna una plantilla a un miembro con membresía activa, como Activa o Alternativa.
  Un miembro tiene a lo sumo una Activa y varias Alternativas. Asignar una nueva Activa degrada
  la anterior a Alternativa.
- Al asignar, la carga actual del miembro arranca en los kilos de referencia de la plantilla.
- Quitar una asignación no borra las sesiones ya registradas.
- Dar de baja la membresía no toca las asignaciones existentes; sí impide nuevas.

### 3.4 Sesión y progresión (Miembro)

- El miembro elige plantilla (entre las asignadas) y día (R6). Ve, por ejercicio: video,
  descripción, y cada serie con su carga actual precargada.
- Ajusta kilos y reps con ± o tipeando, y marca la serie como hecha. El progreso de la sesión
  se muestra como "n de N series".
- Al terminar (todas las series marcadas, o "Finalizar" antes), la sesión queda registrada.
  Los kilos de las series hechas pasan a ser la **nueva carga actual** de ese ejercicio (R5).
- Se puede registrar más de una sesión por día calendario, pero el Dashboard cuenta una por
  miembro por día.
- El Dueño puede editar la carga actual de un miembro desde la ficha, y ver sus sesiones.

### 3.5 Seguimiento

Lo mínimo que hace visible la progresión, para el miembro en "Mi progreso" y para el Dueño en
la ficha:

- **Por ejercicio**: kilo máximo por semana (gráfico) y último registro. Récord personal =
  el kilo máximo histórico con la fecha en que se hizo.
- **Adherencia**: sesiones completadas en el mes y racha de semanas con al menos una sesión.
- **Comparación simple**: para cada ejercicio de la sesión, diferencia de kilos contra la
  sesión anterior del mismo ejercicio ("+2,5 kg").

## 4. Flujos principales

1. **Alta de ejercicio.** Rutinas → Ejercicios → Nuevo → nombre, descripción, URL de video,
   grupo, tipos → queda activo en el catálogo.
2. **Crear plantilla.** Rutinas → Plantillas → Nueva → nombre, tipo → agregar Día 1 → elegir
   grupos musculares → agregar ejercicios desde el catálogo (buscador filtrado por grupo) →
   por ejercicio, cargar series (reps · kg) con + / − → repetir por día → guardar.
3. **Editar plantilla.** Mismo editor. Si está asignada, aviso con la cantidad de miembros.
4. **Asignar.** Ficha del miembro → Asignar plantilla → elegir plantilla y estado → el
   miembro la ve en "Mi rutina" con la carga de referencia.
5. **Entrenar (Miembro).** Mi rutina → plantilla → día sugerido → por ejercicio, ver video,
   ajustar kg/reps, marcar series → Finalizar → la carga actual se actualiza.
6. **Seguir (Dueño).** Ficha del miembro → Rutina → plantillas asignadas, carga actual por
   ejercicio, últimas sesiones, gráfico por ejercicio.
7. **Mi progreso (Miembro).** Sesiones del mes, racha, récords, gráfico por ejercicio.

## 5. Estado actual en el código

El change `add-routine-templates` está implementado (96 tareas, sin verificar ni archivar) sobre
un modelo distinto al de este documento. Qué se conserva, qué cambia:

| Qué | Cómo está hoy | Qué pasa con este doc |
|---|---|---|
| Ejercicio | Nombre, grupo muscular (texto), descripción, activo, **base** (series × reps · kg). Alta solo por endpoint; edición con pantalla, solo Dueño. | Se conserva y **se completa**: video/GIF, tipos de entrenamiento, grupo desde lista fija, pantalla de alta. La base se deprecha (las series viven en la plantilla). |
| Días | **Catálogo fijo** de 4 días (`TrainingDay`) con grupos musculares fijos, compartido por todas las plantillas. Vínculo día–ejercicio global (`TrainingDayExercise`). | **Se reemplaza**: los días son de cada plantilla y declaran sus propios grupos. |
| Plantilla | Nombre, etiqueta, subconjunto ordenado de los días del catálogo. Por (plantilla, día, ejercicio): activo sí/no y estrategia. | Se conserva la entidad; cambia su contenido: tipo en vez de etiqueta, días propios, ejercicios agregados a mano, series explícitas. |
| Series | **Derivadas** por el motor de estrategias desde la base del ejercicio; no se persisten. | Pasan a ser **datos de la plantilla**. El motor queda como generador opcional (R7). |
| Asignación | Plantilla → miembro, Activa/Alternativa, fecha, autor. Override de **base** por ejercicio con autoría. | Se conserva. El override de base pasa a ser la **carga actual por serie** (R5). |
| Mi rutina | Plantillas asignadas y plan de series calculado, **solo lectura**. | Se conserva la selección; suma video, edición de kg/reps y marcado de series. |
| Registro | `WorkoutLog` por ejercicio con `sets_count`, reps, kg, nota; propio del miembro y por admin. Selección de días por usuario (legacy). | **Se reemplaza** por sesión con series realizadas. La selección de días por usuario se retira. |
| Progreso | Resumen numérico y **PDF** de progreso por miembro. | El resumen se rehace sobre sesiones (§3.5). El PDF sale del MVP (R8). |
| Permisos | Catálogo de ejercicios: solo Dueño. Plantillas y asignación: Dueño y Coach. Sesión: miembro sobre sí mismo. | Sin cambios (D10). |

**Impacto sobre el change vigente.** `add-routine-templates` es la base sobre la que se
construye esto, no trabajo perdido: plantillas, asignaciones, Activa/Alternativa y la vista de
selección quedan. Conviene verificarlo y archivarlo como está, y hacer los cambios de este doc
como changes nuevos encima. Rehacerlo antes de archivar mezcla dos modelos en un mismo diff.

## 6. Brecha MVP

En orden de implementación sugerido.

| # | Brecha | Depende de | Prioridad |
|---|---|---|---|
| R-1 | Verificar y archivar `add-routine-templates` tal como está. | — | Alta, es el piso. |
| R-2 | Catálogo de ejercicios completo: CRUD con pantalla de alta, video/GIF por URL, grupo muscular de lista fija, tipos de entrenamiento, desactivación. Deprecar la base. | R-1 | Alta |
| R-3 | Días propios de la plantilla con grupos musculares planificados; retirar el catálogo fijo de días. Migración: cada plantilla existente copia sus días del catálogo. | R-1 | Alta |
| R-4 | Editor de series explícitas por ejercicio del día (agregar, quitar, reordenar, reps · kg). Estrategias como generador opcional. Tipo de plantilla. | R-3 | Alta |
| R-5 | Carga actual por miembro y serie en la asignación, inicializada desde la plantilla. Edición por el Dueño desde la ficha. | R-4 | Alta |
| R-6 | Sesión del miembro: elegir día, ver video, ajustar kg/reps, marcar series, finalizar; actualiza la carga actual. Reemplaza `WorkoutLog` y la selección de días por usuario. | R-5 | Alta |
| R-7 | Seguimiento: gráfico de kilo máximo por semana por ejercicio, récords, sesiones del mes, racha, "+2,5 kg vs. anterior". "Mi progreso" en el portal y en la ficha del miembro. | R-6 | Media |
| R-8 | Dashboard: sesiones de hoy por miembro con plantilla y día, "Completó / En sala / Sin registro" (se detalla en `07-dashboard.md`). | R-6 | Media |
| R-9 | Retirar el PDF de progreso y el resumen viejo (R8). | R-7 | Baja |

## 7. Fuera de alcance

- Subida de archivos de video o imagen (R1). Solo URLs.
- Catálogos administrables de grupos musculares y tipos (R2).
- Parámetros de las estrategias editables desde la UI.
- Ejercicios por tiempo o distancia (cardio con minutos, metros). Las series son reps · kg;
  un ejercicio de cardio se registra con reps = 1 y kg = 0 hasta que haga falta más.
- Superseries, circuitos, descansos cronometrados.
- Rutinas personalizadas por miembro que no partan de una plantilla.
- Sugerencia automática de progresión ("subí 2,5 kg la semana que viene").
- "Sugerir plantilla" al miembro con notificación.
- Biblioteca de ejercicios precargada de terceros.
