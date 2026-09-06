# Rutinas: plantillas, estrategias de progresión y registro de series

**Descripción funcional para propuesta OpenSpec** · Mini Espacio
Fuente: prototipo "Gimnasio web app responsiva" (Claude Design),
https://claude.ai/code/artifact/30d8329f-b863-464c-a968-c8144ce9a0a2
Relevado el 2026-09-05 recorriendo todas las vistas del prototipo (Admin y Cliente, desktop y móvil).

---

## 1. Resumen ejecutivo

El prototipo redefine el módulo de rutinas alrededor de tres conceptos:

1. **Plantilla de rutina**: un programa con nombre, una cantidad de días de entrenamiento y una
   estrategia de progresión por defecto (ej. "Fuerza 4 días · Pirámide").
2. **Estrategia de progresión por ejercicio**: regla que, a partir de una base (series × reps ·
   kg), genera automáticamente la carga y las repeticiones objetivo de cada serie. Hay cinco:
   Constante, Pirámide, Invertida, Drop set y Rest-pause.
3. **Registro serie por serie del cliente**: el cliente elige entre las plantillas que le asignaron,
   ve el plan de cada serie, ajusta kg y reps con ±, y marca cada serie como hecha. La sesión
   muestra el avance ("1/14 series completadas").

El administrador (Dueño/Coach) arma plantillas, activa ejercicios por día, elige la estrategia de
cada ejercicio y asigna plantillas a clientes. El cliente ejecuta y registra. Los datos registrados
alimentan una vista de progreso (volumen, sesiones, récords, racha) y el panel de seguimiento
del gimnasio.

---

## 2. Roles y alcance por rol

| Rol | Qué hace en el módulo |
|---|---|
| Administrador (Dueño / Coach) | Crea y edita plantillas. Por cada día activa/desactiva ejercicios y elige la estrategia de progresión de cada uno. Ve qué clientes tienen cada plantilla y asigna plantillas a clientes. Ve, en la ficha de cada cliente, sus plantillas (activa/alternativa) y su progreso. |
| Cliente (Miembro) | Elige entre las plantillas que le asignaron. Ve la sesión del día con el plan por serie. Ajusta kg y repeticiones y marca cada serie como hecha. Consulta su progreso (volumen, récords, racha). |

Texto literal del prototipo:
- Admin: *"Armás las plantillas de rutina, las asignás a cada cliente y seguís cobros y asistencias."*
- Cliente: *"Elegís entre las plantillas que te asignaron y cargás peso y repeticiones serie por serie."*

El prototipo incluye un conmutador Admin / Cliente en el header y un botón "Ver como cliente" /
"Volver a admin" en el sidebar, que en Mini Espacio se corresponde con el `dev-role-switcher`
existente y no forma parte del alcance funcional.

---

## 3. Modelo conceptual

```
Plantilla (Template)
 ├── nombre, etiqueta corta (FUERZA / HIPERTROFIA / RECOMP / INICIO)
 ├── estrategia por defecto (Constante | Pirámide | Invertida | Drop set | Rest-pause)
 ├── días incluidos (subconjunto ordenado del catálogo de días: Día 1..4)
 │    └── por cada (día, ejercicio):
 │          ├── activo (sí/no)                      ← toggle
 │          └── estrategia de progresión            ← chips
 └── asignaciones a clientes
      ├── estado: Activa | Alternativa
      ├── fecha desde
      └── ajustes: "Sin ajustes" | "Ajustada por <coach> el <fecha> · <estrategia>"

Día de entrenamiento (catálogo compartido entre plantillas)
 ├── número (Día 1..4), nombre (Pecho y Bíceps, Espalda y Tríceps, Hombros, Piernas)
 └── ejercicios (ordenados)

Ejercicio (catálogo)
 ├── nombre, grupo muscular
 ├── base: series × reps · kg   (ej. 4×8 · 45 kg)
 └── cantidad de clientes que lo tienen activo (indicador)

Serie planificada (derivada, no persistida)
 └── nº, kg objetivo, reps objetivo, anotación ("20 s", "al fallo")

Registro de serie (Cliente)
 ├── kg realizados, reps realizadas, hecha (sí/no)
 └── sesión del día → progreso "n/total series completadas"
```

Observación importante del prototipo: **el catálogo de días y ejercicios es único** y las
plantillas son "vistas" sobre él. Fuerza 4 días incluye Días 1-2-3-4; Hipertrofia 3 días y
Recomposición incluyen Días 1-2-4; Full body inicial incluye Días 1 y 4. Los mismos ejercicios
aparecen en todas, con la misma base, pero la estrategia varía por plantilla. Esto encaja con el
modelo actual de Mini Espacio (`TrainingDay`, `Exercise`, `TrainingDayExercise`), donde la
plantilla sería la capa nueva por encima.

---

## 4. Estrategias de progresión

Las cinco estrategias, con la descripción literal del prototipo y la regla de cálculo deducida de
los valores mostrados. Todas parten de la **base** del ejercicio (S series × R reps · P kg).

| Estrategia | Descripción (texto del prototipo) | Regla observada |
|---|---|---|
| **Constante** | Mismo peso y repeticiones en todas las series. Base para aprender el movimiento. | Serie i: P kg × R reps. |
| **Pirámide** | Sube el peso y bajan las repeticiones serie a serie. Fuerza máxima en la última. | Serie i (i=0..S-1): peso = P · (1 + 0,06·i) redondeado al múltiplo de 2,5 kg más cercano; reps = max(R − 2·i, 3). |
| **Invertida** | Arranca pesado y baja carga sumando repeticiones. Más volumen con menos fatiga inicial. | Serie i: peso = P · (1 − 0,06·i) redondeado a 2,5 kg; reps = R + 2·i. |
| **Drop set** | Series planas y en la última se baja 20% de carga hasta el fallo. | Series 1..S-1: P × R. Última: peso = 0,8·P redondeado a 2,5 kg; reps = 1,5·R con etiqueta "al fallo". |
| **Rest-pause** | Misma carga con pausas cortas: las repeticiones caen solas por fatiga. | Serie i: P kg × (R − i) reps; desde la serie 2 se muestra la pausa "20 s". |

Ejemplos verificados en el prototipo (base 4×8 · 45 kg, Press banca plano):

| Estrategia | S1 | S2 | S3 | S4 |
|---|---|---|---|---|
| Constante | 45 × 8 | 45 × 8 | 45 × 8 | 45 × 8 |
| Pirámide | 45 × 8 | 47,5 × 6 | 50 × 4 | 52,5 × 3 |
| Invertida | 45 × 8 | 42,5 × 10 | 40 × 12 | 37,5 × 14 |
| Drop set | 45 × 8 | 45 × 8 | 45 × 8 | 35 × 12 al fallo |
| Rest-pause | 45 × 8 | 45 × 7 · 20 s | 45 × 6 · 20 s | 45 × 5 · 20 s |

Otros casos que confirman el redondeo y el piso de repeticiones:
- Sentadilla libre 5×5 · 70 kg (Pirámide): 70×5, 75×3, 77,5×3, 82,5×3, 87,5×3.
- Dominadas asistidas 4×6 · 20 kg (Pirámide): 20×6, 20×4, 22,5×3, 22,5×3.
- Aperturas 3×12 · 14 kg (Pirámide): 15×12, 15×10, 15×8. (Invertida): 15×12, 12,5×14, 12,5×16.

Los porcentajes (6 %, 20 %), el paso de redondeo (2,5 kg), el piso de reps (3), el incremento de
reps (2) y la pausa (20 s) deberían ser **parámetros de la estrategia**, no constantes. El
prototipo no los expone en la UI.

Cada estrategia tiene un icono propio en los chips (líneas paralelas, flecha ascendente, flecha
descendente, flecha hacia abajo con base, cronómetro).

---

## 5. Pantallas del Administrador

### 5.1 Rutinas (`Rutinas · Plantillas y estrategias de progresión`)

Layout desktop: columna principal (plantillas, días, ejercicios) + columna lateral (clientes de
la plantilla, estrategias disponibles).

**Fila de plantillas** (cards seleccionables, la activa resaltada en violeta):

| Etiqueta | Nombre | Subtítulo |
|---|---|---|
| FUERZA | Fuerza 4 días | 4 días · Pirámide · 12 clientes |
| HIPERTROFIA | Hipertrofia 3 días | 3 días · Constante · 23 clientes |
| RECOMP | Recomposición | 3 días · Invertida · 8 clientes |
| INICIO | Full body inicial | 2 días · Constante · 14 clientes |
| + Nueva plantilla | card punteada | (sin flujo en el prototipo) |

**Fila de días** de la plantilla seleccionada (pestañas "DÍA n · nombre"). Al cambiar de
plantilla se muestran solo los días que incluye.

**Panel del día**: título del día, línea *"<plantilla> · activá ejercicios y elegí la estrategia
de progresión de cada uno"* y botón "+ Ejercicio" (sin flujo en el prototipo). Por cada ejercicio:

- Nombre y línea "Grupo muscular · base S×R · P kg".
- Badge "N clientes" (cuántos clientes tienen ese ejercicio activo).
- Toggle activo/inactivo. Al desactivar, la fila queda atenuada pero conserva su configuración
  (estrategia y series siguen visibles en gris).
- Chips de estrategia (Constante · Pirámide · Invertida · Drop set · Rest-pause), selección única.
- Chips de series calculadas "S1 45 kg × 8", "S2 …". Se recalculan al instante al cambiar la
  estrategia.
- Texto descriptivo de la estrategia elegida.

La estrategia se elige **por ejercicio y por plantilla**: el mismo ejercicio puede ser Pirámide en
Fuerza y Constante en Hipertrofia. El cambio hecho por el admin se refleja de inmediato en la
vista "Mi rutina" del cliente (en el prototipo, Press banca pasó a Rest-pause en ambas vistas).

**Panel "Clientes en <plantilla>"**: lista de clientes con avatar de iniciales, nombre y estado:

| Estado | Línea secundaria | Acción |
|---|---|---|
| Asignada (badge) | "Sin ajustes · desde dd/mm/aa" | — |
| Sugerir (botón) | "Otra plantilla · <nombre de su plantilla actual>" | Sugerir esta plantilla |

Botón "Asignar a un cliente" al pie (sin flujo en el prototipo).

**Panel "Estrategias disponibles"**: las cinco estrategias con icono, nombre y descripción
(ver sección 4).

### 5.2 Ejercicios por día (catálogo relevado)

| Día | Ejercicio | Grupo | Base | Clientes |
|---|---|---|---|---|
| Día 1 · Pecho y Bíceps | Press banca plano | Pecho | 4×8 · 45 kg | 18 |
| | Aperturas con mancuernas | Pecho | 3×12 · 14 kg | 14 |
| | Curl bíceps barra Z | Bíceps | 4×10 · 22 kg | 16 |
| | Curl martillo | Bíceps | 3×12 · 12 kg | 11 |
| Día 2 · Espalda y Tríceps | Dominadas asistidas | Espalda | 4×6 · 20 kg | 12 |
| | Remo con barra | Espalda | 4×10 · 38 kg | 17 |
| | Jalón al pecho | Espalda | 3×12 · 40 kg | 15 |
| | Extensión de tríceps en polea | Tríceps | 3×12 · 25 kg | 13 |
| Día 3 · Hombros | Press militar | Hombros | 4×8 · 28 kg | 16 |
| | Elevaciones laterales | Hombros | 4×15 · 8 kg | 18 |
| | Pájaros | Hombros | 3×15 · 6 kg | 9 |
| Día 4 · Piernas | Sentadilla libre | Cuádriceps | 5×5 · 70 kg | 19 |
| | Prensa 45° | Cuádriceps | 4×12 · 120 kg | 17 |
| | Peso muerto rumano | Isquios | 4×10 · 55 kg | 14 |
| | Gemelos de pie | Gemelos | 4×20 · 40 kg | 10 |

### 5.3 Clientes (`Clientes · Ficha, cuota y plantillas asignadas`)

Tabla con filtros Todos / Al día / Vencidos y botón "+ Nuevo". Columnas: Nombre, **Plantilla**,
Alta, Cuota, Estado. La columna Plantilla muestra la plantilla activa del cliente.

Ficha del cliente seleccionado (columna derecha):
- Cabecera: nombre, "<plantilla> · alta dd/mm/aa · <estado de cuota>".
- KPIs: Asistencias, Racha, Volumen (ej. 16 · 4 · 12,4 t).
- Botones "Registrar check-in" y "Ver plantilla". "Ver plantilla" navega a Rutinas con la
  plantilla del cliente ya seleccionada.
- **Plantillas asignadas**: lista con estado.
  - "Fuerza 4 días · Ajustada por Eze el 24/08 · Pirámide" → badge **Activa**.
  - "Full body inicial · Asignada como alternativa liviana" → badge **Alternativa**.
  - Botón "+ Asignar plantilla".
- Asistencia del mes (calendario) y Pagos recientes (fuera del alcance de rutinas).

Implicancia: un cliente puede tener **más de una plantilla asignada** (una activa y
alternativas), y la asignación registra quién la ajustó, cuándo y con qué estrategia.

### 5.4 Seguimiento (`Estado del gimnasio hoy`)

Además de KPIs de ingresos, clientes activos, check-ins y cuotas, incluye la tabla **Actividad de
hoy** con columnas Cliente · Hora · **Plantilla · Día** · Coach · Estado, donde Estado es
"Completó", "En sala" o "Sin registro". Ejemplo: "Marina Gómez · 07:12 · Fuerza 4 días · Piernas
· Eze · Completó". Requiere que el registro de series del cliente marque la sesión como
completada y que la asistencia se cruce con la plantilla/día del cliente.

---

## 6. Pantallas del Cliente

### 6.1 Mi rutina (`Elegí tu plantilla y cargá cada serie`)

1. **Plantillas que te asignó tu entrenador**: cards seleccionables (ej. "Fuerza 4 días · 4 días ·
   Pirámide", "Hipertrofia 3 días · 3 días · Constante"). Solo aparecen las asignadas.
2. **Sesión de hoy**: card destacada con nombre del día ("Pecho y Bíceps"), línea "<plantilla> ·
   N ejercicios · <estrategia por defecto>", contador "n/total series completadas" y barra de
   progreso. El total es la suma de series de todos los ejercicios activos del día (4+3+4+3 = 14).
3. **Pestañas de día**: "Día 1 · Pecho", "Día 2 · Espalda", "Día 3 · Hombros", "Día 4 · Piernas".
4. **Card por ejercicio**:
   - Nombre, "Grupo · última vez hace N días", badge de estrategia (arriba a la derecha) y su
     descripción.
   - Una fila por serie: "S1 · plan 45×8 · [−] 45 kg [+] · [−] 8 rep [+] · [Marcar]".
     - El plan es de solo lectura y refleja la estrategia; kg y reps son editables con ±.
     - El paso de kg observado es 2,5 (45 → 47,5).
     - "Marcar" pasa a "Hecha" (con check, resaltado violeta) y suma 1 al contador de la sesión.
   - Pie con insight de progreso: "+2,5 kg vs. la semana pasada", "Misma carga, +2 repeticiones",
     "+1 serie respecto de junio", "Volviste después de 11 días".

### 6.2 Mi progreso (`Cómo viene tu carga semana a semana`)

- KPIs: Volumen del mes (12,4 t · +8 % vs. julio), Sesiones (16 de 18 planificadas), Récords
  nuevos (3 · sentadilla, remo, press), Racha actual (4 semanas sin faltar).
- **Carga por semana**: gráfico de barras por semana (S1..S8) del "kg de la serie más pesada",
  con selector de ejercicio (Sentadilla libre · Press banca plano · Remo con barra). Ejemplo
  sentadilla: 52,5 · 55 · 55 · 57,5 · 60 · 62,5 · 65 · 70.
- **Récords personales**: ejercicio, fecha, kg y mejora ("Sentadilla libre · 26 ago · 70 kg ·
  +5 kg").

"Sesiones planificadas" se deriva de la cantidad de días de la plantilla activa por semana.

### 6.3 Mis asistencias

Existe en la navegación del cliente; no fue relevada en detalle porque no toca rutinas.

---

## 7. Comportamiento responsivo

- **Desktop** (≥ ~1024 px): sidebar fijo a la izquierda (OPERACIÓN: Seguimiento, Clientes,
  Rutinas, Pagos, Asistencias; el cliente ve MI ENTRENAMIENTO: Mi rutina, Mi progreso, Mis
  asistencias), header con buscador "Buscar cliente…", conmutador Admin/Cliente y avatar. En
  Rutinas, dos columnas (contenido + paneles laterales).
- **Móvil** (390 px): el sidebar se reemplaza por una **barra inferior** con 5 pestañas: Panel,
  Clientes, Rutinas, Pagos, Check-in. Desaparecen el buscador y el bloque "Vista actual". Las
  plantillas pasan a grilla de 2 columnas; los días y los chips de estrategia hacen wrap; los
  paneles "Clientes en…" y "Estrategias disponibles" se apilan debajo del contenido. La fila de
  cada ejercicio conserva el toggle a la derecha y oculta el badge "N clientes".

---

## 8. Diseño visual

Tema oscuro de un solo modo en el prototipo: fondo azul-negro, superficies ligeramente más
claras con borde sutil, acento violeta para selección (cards, chips y badges "Asignada" /
"Activa" / "Hecha"), texto secundario gris. Etiquetas de sección en mayúsculas con tracking
(FUERZA, SESIÓN DE HOY, ESTRATEGIAS DISPONIBLES). Chips redondeados con icono a la izquierda.
Toggles tipo switch. Avatares circulares con iniciales.

Para Mini Espacio esto se debe traducir al tema **Kinetic Obsidian** definido en
[docs/design/design.md](../design/design.md), incluido el modo claro "Crisp Slate", que el
prototipo no contempla.

---

## 9. Acciones presentes en el prototipo sin flujo definido

Estos controles existen pero no hacen nada al pulsarlos. La propuesta debe definirlos o
excluirlos explícitamente del alcance:

| Control | Ubicación | Qué debería cubrir |
|---|---|---|
| + Nueva plantilla | Rutinas | Nombre, etiqueta, estrategia por defecto, días incluidos. |
| + Ejercicio | Rutinas, panel del día | Alta de ejercicio en el catálogo y/o vinculación al día (nombre, grupo, base S×R·kg). |
| Asignar a un cliente | Rutinas, panel de clientes | Elegir cliente, estado Activa/Alternativa, fecha desde. |
| Sugerir | Rutinas, fila de cliente con otra plantilla | ¿Notificación al cliente? ¿Cambio directo? |
| + Asignar plantilla | Ficha de cliente | Igual que "Asignar a un cliente" pero desde el cliente. |
| Edición de la base (S×R·kg) | — | El prototipo la muestra fija; no hay UI para editarla. |
| Edición de parámetros de estrategia | — | Porcentajes, paso de redondeo, pausa. |
| Ajustes por cliente | Ficha ("Ajustada por Eze…") | Qué se puede ajustar por cliente sobre la plantilla (¿estrategia?, ¿base?). |
| Buscar cliente… | Header | Búsqueda global. |

---

## 10. Brecha con el estado actual de Mini Espacio

Lo que ya existe en el código (`backend/app/routers/routines.py`, `backend/app/models.py`,
`frontend/src/pages/UserRoutine.tsx`):

- Modelos `TrainingDay` (nombre, grupos musculares, orden), `Exercise` (nombre, grupo,
  descripción, activo), `TrainingDayExercise` (vínculo día-ejercicio con `is_active`,
  `sort_order`, `assigned_by_user_id`) y `WorkoutLog` (usuario, día, ejercicio, series, reps,
  kg, nota, fecha).
- Endpoints de catálogo de días/ejercicios, alta y edición de ejercicios, selección de días por
  usuario, registros de entrenamiento (CRUD propio y por admin), resumen y reporte PDF de
  progreso.
- Vista "Mi rutina" para el cliente y vista "Rutinas" para admin.

Lo que el prototipo agrega y hoy no existe:

1. **Plantilla** como entidad: nombre, etiqueta, estrategia por defecto, subconjunto de días.
2. **Asignación de plantillas a clientes** con estado Activa/Alternativa, fecha, autor del ajuste.
3. **Estrategia de progresión por (plantilla, día, ejercicio)** y su motor de cálculo de series.
4. **Base por ejercicio** (series × reps · kg) como dato del catálogo.
5. **Registro serie por serie** (kg, reps, hecha) en lugar de un log por ejercicio; sesión con
   contador de series completadas y estado "Completó / En sala / Sin registro".
6. **Insights de progreso**: comparación con la semana anterior, récords personales, racha,
   volumen mensual, carga por semana por ejercicio, sesiones planificadas vs. realizadas.
7. **Indicadores de adopción**: cantidad de clientes por plantilla y por ejercicio.

El campo `WorkoutLog.sets_count` sugiere migrar a un registro por serie o agregar una tabla hija
de series; es una decisión de diseño para el Arquitecto.

---

## 11. Datos de ejemplo del prototipo (para seeds y tests)

**Clientes** (nombre · plantilla activa · alta · cuota · estado):
Marina Gómez · Fuerza 4 días · 12/03/25 · $32.000 · Al día;
Julián Ríos · Hipertrofia 3 días · 02/11/24 · $41.000 · Al día;
Carla Soto · Full body inicial · 28/06/25 · $26.000 · Vence hoy;
Pablo Duarte · Recomposición · 15/01/25 · $32.000 · Vencido;
Lucía Ferreyra · Fuerza 4 días · 09/08/25 · $41.000 · Al día;
Nicolás Ayala · Hipertrofia 3 días · 21/04/25 · $26.000 · Pausa.

**Coaches**: Eze, Sol.

**Asignaciones por plantilla** (panel "Clientes en…"): Fuerza 4 días → Marina Gómez, Lucía
Ferreyra. Hipertrofia 3 días → Julián Ríos, Nicolás Ayala. Recomposición → Pablo Duarte. Full body
inicial → Carla Soto. Marina Gómez tiene además Full body inicial como alternativa.

**Actividad de hoy** (Seguimiento): Marina Gómez 07:12 Fuerza 4 días · Piernas · Eze · Completó;
Julián Ríos 08:03 Hipertrofia · Pecho y Bíceps · Eze · Completó; Lucía Ferreyra 09:40 Fuerza 4
días · Espalda · Sol · En sala; Carla Soto 10:15 Full body inicial · Piernas · Sol · En sala;
Nicolás Ayala 11:02 Hipertrofia · Pecho y Bíceps · Eze · Sin registro.

---

## 12. Preguntas abiertas para el Product Owner

1. ¿La plantilla es global del gimnasio o puede tener variantes por cliente ("Ajustada por Eze")?
   Si hay ajustes por cliente, ¿qué se ajusta: estrategia, base, ejercicios activos?
2. ¿Los días son un catálogo fijo (Día 1..4) o cada plantilla define los suyos? El prototipo los
   comparte; conviene decidir antes del design.
3. ¿"Sugerir" notifica al cliente o la asignación es siempre decisión del admin?
4. ¿Cuántas plantillas puede tener activas un cliente a la vez? El prototipo muestra una Activa
   y una Alternativa, y el cliente puede alternar entre ambas.
5. ¿La base (S×R·kg) es por ejercicio (global) o por cliente? En el prototipo es global, pero el
   progreso real de cada cliente (récords, "+2,5 kg") sugiere que la carga objetivo debería
   personalizarse con el tiempo.
6. ¿Qué define "sesión de hoy"? ¿El siguiente día no completado, el día de la semana, o lo elige
   el cliente?
7. ¿Se mantiene el reporte PDF de progreso existente y se enriquece con estos datos?
8. Parámetros de las estrategias (6 %, 20 %, 2,5 kg, pausa 20 s, piso 3 reps): ¿fijos, por
   gimnasio o por ejercicio?
