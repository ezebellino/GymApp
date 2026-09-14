## Why

`add-exercise-catalog` le dio a `/exercises` un CRUD completo para que el Dueño edite el grupo
muscular de un ejercicio, pero el sembrado automático que corre en ~20 endpoints de Rutinas sigue
derivando el día donde aparece cada ejercicio del seed desde una constante en código
(`EXERCISE_LIBRARY`), no desde la fila real de la base. Resultado verificado (reserva 1 de
`add-exercise-catalog`): el Dueño le cambia el grupo muscular a un ejercicio desde la pantalla que
existe para eso, el cambio se guarda, y el ejercicio **nunca se mueve al día nuevo** — en
silencio. Hay dos fuentes de verdad para el mismo dato y gana la que el usuario no puede editar.
El mismo mecanismo además puede deshacer curación manual (excluir un ejercicio de un día) en
cualquiera de esos ~20 endpoints.

El catálogo de ejercicios ya tiene una pantalla propia para cargarlo y mantenerlo. No necesita
además un sembrado automático que compita con ella.

## What Changes

- **BREAKING**: se retira el sembrado automático de ejercicios. El catálogo de ejercicios deja de
  poblarse solo; se puebla únicamente por alta manual en `/exercises`.
- El vínculo entre un ejercicio y su día de entrenamiento se deriva siempre del grupo muscular
  que el ejercicio tiene guardado en la base en ese momento, nunca de una lista fija en código.
  Cambiar el grupo muscular de un ejercicio desde `/exercises` mueve sus vínculos de día de forma
  inmediata y consistente, sin depender de qué endpoint se visite después ni de un proceso de
  reconciliación aparte.
- Un ejercicio recién creado (o que cambia de grupo muscular) nace **activo** para el día que le
  corresponde: agregarlo a una plantilla no exige ningún paso extra de activación aparte de
  agregarlo. Así el recorrido de primer uso queda completo de punta a punta — cargar un ejercicio,
  agregarlo a una plantilla, asignarla a un Miembro — y ese Miembro lo ve en "Mi rutina" sin que el
  Dueño tenga que descubrir un paso escondido. Un Dueño o Coach sigue pudiendo desactivar un
  ejercicio para una plantilla puntual cuando no lo quiere ahí; eso queda como una decisión tomada,
  no como el estado de arranque.
- **BREAKING**: los 52 ejercicios que hoy trae el sembrado automático (en cualquier entorno,
  incluida producción) se descartan como parte de este change, junto con sus vínculos a días de
  entrenamiento y con cualquier plantilla o rutina de cliente que los use. El catálogo arranca
  vacío en todos los entornos; el Dueño lo carga desde cero por `/exercises`.
- Esos mismos 52 ejercicios pasan a un script de seed opcional, del mismo estilo que
  `make seed-dev` para usuarios: se corre a mano cuando alguien quiere datos de prueba en su
  entorno de desarrollo, nunca automáticamente y nunca contra producción.
- Un catálogo sin ningún ejercicio deja de ser un estado invisible y pasa a ser un primer uso real
  que la interfaz tiene que guiar, no un listado en blanco sin explicación:
  - `/exercises` sin ejercicios muestra un mensaje que invita al Dueño o Coach a cargar el primer
    ejercicio, en vez de una tabla vacía.
  - El editor de plantillas, al mostrar los ejercicios disponibles para un día sin ninguno
    cargado en ese grupo muscular, muestra un mensaje que explica por qué no hay opciones y guía a
    cargarlos en el catálogo, en vez de una lista vacía sin explicación.
  - "Mi rutina" del Miembro, al mostrar un día de su plantilla asignada sin ningún ejercicio
    activo, muestra una indicación de que ese día todavía no tiene ejercicios cargados, en vez de
    una sección vacía sin contexto.
- Los 4 días de entrenamiento fijos (`TRAINING_DAYS`) **no** se tocan en este change: siguen
  sembrándose automáticamente igual que hoy. Retirarlos es el ítem R-3 del backlog (días propios
  por plantilla), que es un change independiente porque cambia el modelo de datos de las
  plantillas, no solo el del catálogo de ejercicios.

## Capabilities

### Modified Capabilities
- `exercise-catalog`: se retira el sembrado automático de ejercicios y su reconciliación de
  vínculos día–ejercicio contra una lista fija; el vínculo pasa a derivarse siempre del grupo
  muscular guardado en la base al crear o editar un ejercicio. El catálogo puede estar vacío como
  estado normal (no solo transitorio) y `/exercises` lo comunica con un estado vacío accionable.
- `routine-templates`: el editor de plantillas puede encontrarse con un día sin ningún ejercicio
  disponible en el catálogo y necesita comunicarlo, en vez de mostrar una lista vacía sin
  contexto.
- `member-routine-view`: "Mi rutina" puede mostrar un día de la plantilla asignada sin ejercicios
  activos (porque el catálogo no tiene ninguno cargado para ese grupo muscular) y necesita
  comunicarlo, en vez de una sección vacía sin contexto.

## Impact

- **Backend**: `backend/app/routine_catalog.py` (se retira `EXERCISE_LIBRARY`; `TRAINING_DAYS`
  queda igual), `backend/app/routers/routines.py` (`_ensure_seed_data` deja de sembrar ni
  reconciliar ejercicios en los ~20 endpoints donde corre hoy), migración de Alembic que descarta
  los datos sembrados existentes (ejercicios, sus vínculos a días, y lo que dependa de ellos en
  cascada), y un script nuevo en `backend/scripts/` con los 52 ejercicios para uso opcional en
  desarrollo.
- **Frontend**: estado vacío nuevo en `frontend/src/pages/Exercises.tsx`, en el selector de
  ejercicios por día del editor de plantillas de rutina, y en la vista "Mi rutina" del Miembro
  para un día sin ejercicios.
- **Datos**: cualquier gimnasio (incluido producción) pierde los 52 ejercicios sembrados y sus
  vínculos; es una pérdida de datos de prueba aceptada explícitamente bajo la regla de BETA de
  `AGENTS.md` ("migración solo de esquema, sin backfill, es la opción por defecto").
- **Riesgo declarado**: alto. `_ensure_seed_data` es transversal a ~20 endpoints de un router
  central (Rutinas); retirarlo cambia el comportamiento de arranque de todo ese módulo, no solo
  del catálogo de ejercicios.
