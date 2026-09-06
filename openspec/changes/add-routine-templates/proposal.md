## Why

Hoy "Rutinas" es un catálogo compartido de días y ejercicios (`TrainingDay`, `Exercise`,
`TrainingDayExercise`) sin ningún concepto de programa: no hay forma de agrupar un subconjunto de
días bajo un nombre ("Fuerza 4 días"), de definir cómo progresa la carga de un ejercicio semana a
semana, ni de asignarle formalmente un programa a un cliente. El Coach arma la sesión de cada
cliente a mano y el cliente ve un log plano, sin un plan de series calculado. Un relevamiento de
un prototipo de diseño (`docs/propuestas/rutinas-descripcion-funcional.md`) muestra el modelo que
sí resuelve esto: plantillas de rutina con una estrategia de progresión por ejercicio que calcula
automáticamente el peso y las repeticiones de cada serie a partir de una base, y una asignación
explícita de plantillas a clientes que el cliente ve reflejada en "Mi rutina".

Este change introduce el núcleo de ese modelo — plantillas, estrategias de progresión y
asignación — dejando el registro serie por serie del cliente y las vistas de progreso para una
iteración posterior.

## What Changes

- Nueva entidad **plantilla de rutina**: un Dueño o Coach la crea con nombre (único, sin distinguir
  mayúsculas/minúsculas ni espacios en los bordes), etiqueta corta y un subconjunto ordenado de los
  días existentes del catálogo (Día 1..4). La edita después: puede renombrarla, cambiarle la
  etiqueta y agregar o quitar días de su selección. Puede eliminarla solo si no tiene ninguna
  asignación (Activa ni Alternativa) vigente.
- El catálogo de ejercicios existente suma un dato nuevo: la **base** (series × reps · kg), que se
  puede indicar al crear un ejercicio (por endpoint, sin pantalla de alta en el frontend — no
  existe hoy, se quitó a pedido de producto) o editarla desde la pantalla existente de edición de
  ejercicios, acción exclusiva del Dueño (`require_role(owner)`), sin cambio de ese permiso. Si no
  se indica al crear, el ejercicio nace con una base por defecto de 3×10 · 0 kg.
- Por cada combinación (plantilla, día, ejercicio), un Dueño o Coach activa o desactiva el
  ejercicio para esa plantilla y le elige una **estrategia de progresión** entre cinco opciones
  (Constante, Pirámide, Invertida, Drop set, Rest-pause). El mismo ejercicio puede tener una
  estrategia distinta en cada plantilla. Un ejercicio desactivado para una plantilla conserva su
  estrategia configurada, solo deja de contarse en el plan del cliente.
- Nuevo **motor de cálculo de series**: a partir de la base del ejercicio (series × reps · kg,
  ya existente en el catálogo) y la estrategia elegida, el sistema calcula el peso y las
  repeticiones objetivo de cada serie, con las anotaciones que correspondan ("20 s" de pausa,
  "al fallo"). Los parámetros numéricos de cada estrategia (porcentajes, paso de redondeo, piso
  de repeticiones, incremento de repeticiones, duración de la pausa) son constantes del sistema
  en este change, no editables desde la UI.
- Nueva **asignación de plantillas a clientes**: un Dueño o Coach asigna una plantilla a un
  Miembro con estado **Activa** o **Alternativa** — un cliente puede tener varias plantillas
  asignadas a la vez, pero como máximo una Activa. La asignación puede además sobreescribir, para
  ese cliente en particular, la base (series × reps · kg) de uno o más ejercicios de la plantilla;
  cuando lo hace, queda registrado quién ajustó la base y cuándo, y ese ajuste se puede quitar
  después (el ejercicio vuelve a la base del catálogo). Un Dueño o Coach también puede quitar una
  asignación completa (con confirmación); quitar la Activa deja al Miembro sin plantilla Activa,
  sin promover automáticamente ninguna Alternativa. Un Miembro sin membresía activa (dada de baja
  o que nunca tuvo alta) no puede recibir nuevas asignaciones, pero las asignaciones que ya tenía
  se conservan y las sigue viendo en "Mi rutina" — la regla de membresía activa solo condiciona
  altas nuevas, no las existentes.
- La vista del cliente **"Mi rutina"** pasa a mostrar únicamente las plantillas que le fueron
  asignadas: el cliente elige entre ellas, ve los días que incluye la plantilla elegida y, por
  cada ejercicio activo del día, el plan calculado serie por serie (peso × repeticiones, con sus
  anotaciones). El plan es de solo lectura en esta iteración.

**Fuera de alcance de este change** (trabajo futuro, no lo resuelve esta propuesta):
- Registro serie por serie del cliente (marcar cada serie como hecha, contador "n/total series
  completadas" de la sesión).
- La vista "Mi progreso" del cliente (volumen mensual, récords personales, racha, gráfico de carga
  por semana).
- Insights de progreso en "Mi rutina" (comparaciones tipo "+2,5 kg vs. la semana pasada").
- La columna "Plantilla · Día" y el cruce con asistencia en la vista de Seguimiento del
  administrador.
- El botón "Sugerir" plantilla desde la ficha del cliente.
- Edición desde la UI de los parámetros numéricos de las estrategias.
- Construir una pantalla de alta de ejercicios en el frontend: no existe hoy (se quitó a pedido de
  producto) y este change no la reintroduce. La base (series × reps · kg) se agrega como un campo
  más de la pantalla existente de edición de un ejercicio del catálogo, y el alta con base queda
  disponible por el endpoint existente, ambos exclusivos del Dueño, sin cambiar ese permiso.

## Capabilities

### New Capabilities
- `routine-templates`: alta, edición y composición de plantillas de rutina por Dueño/Coach —
  nombre, etiqueta, y el subconjunto ordenado de días con sus ejercicios activos/inactivos.
- `progression-strategies`: las cinco estrategias de progresión, su elección por (plantilla, día,
  ejercicio) y el cálculo determinístico del plan de series a partir de la base del ejercicio.
- `routine-assignment`: asignación de plantillas a Miembros (estado Activa/Alternativa),
  sobreescritura de la base por cliente con autoría y fecha, y la regla de membresía activa como
  condición para asignar.
- `member-routine-view`: la vista "Mi rutina" del cliente — selección entre las plantillas
  asignadas y visualización del plan de series calculado. No existe hoy una spec para esta
  vista (solo se la menciona por nombre en la navegación de `app-shell`), así que se define aquí
  como capability nueva y no como modificación de una existente.

### Modified Capabilities
(ninguna — no se detectó una spec existente cuyos requirements cambien de comportamiento con este
change; ver nota sobre `member-routine-view` arriba)

## Impact

- Backend: extiende el dominio de rutinas (`backend/app/routers/routines.py`,
  `backend/app/models.py`) con las entidades de plantilla, configuración de progresión por
  ejercicio y asignación a clientes — el modelo de datos concreto y las migraciones quedan a
  cargo del Arquitecto en `design.md`.
- Frontend: reemplaza el contenido de la vista admin "Rutinas" (`frontend/src/pages/Routines.tsx`)
  por la gestión de plantillas, y el contenido de "Mi rutina" (`frontend/src/pages/UserRoutine.tsx`)
  por la selección de plantilla y el plan calculado. Las acciones de asignar plantilla a un
  cliente viven en la ficha del usuario (`frontend/src/pages/UserDetail.tsx`), siguiendo el mismo
  patrón de diálogos que `move-user-actions-to-detail` (ver ese change para no duplicar el punto
  de entrada de acciones sobre un usuario).
- No afecta autenticación ni membresía en sí misma (solo la consume como condición para asignar).
  Sí agrega al catálogo compartido de ejercicios un dato que hoy no existe: la base (series × reps
  · kg) de cada ejercicio, necesaria como punto de partida del cálculo de progresión.
