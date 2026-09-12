## Why

Hoy el catálogo de ejercicios (`Exercise`) solo se completa por seed (`routine_catalog.py`) o por
un endpoint suelto: no hay pantalla de alta, el grupo muscular es texto libre sin validar, y no
existe el concepto de tipo de entrenamiento. R-2 del backlog MVP (Fase 2 · Rutinas) pide cerrar
eso: pantalla de alta, video/GIF, grupo de lista fija, tipos, desactivación. Es la base sobre la
que se construyen R-3 a R-6 (días propios, series explícitas, carga actual, sesión del miembro):
sin un catálogo administrable, el editor de plantillas no tiene de dónde elegir ejercicios.

**Este change además revierte el supuesto R1** de `docs/producto/04-rutinas.md` (*"el video o
GIF es una URL externa, no hay subida de archivos en este MVP"*) y adelanta el ítem de
Post-MVP *"Subida de video/imagen para ejercicios"* (`docs/producto/09-backlog-mvp.md`): el
Dueño pidió poder subir un archivo propio (video o GIF/imagen) además de, o en vez de, pegar una
URL externa. Ya no aplica "solo URL, no hay subida de archivos en este MVP".

## What Changes

- Nueva pantalla **Rutinas → Ejercicios**: listado con búsqueda por nombre, filtro por grupo
  muscular, por tipo de entrenamiento y por activos/inactivos; alta y edición en diálogo. Mismo
  patrón que Planes (`membership-plans`): listado + diálogos, entrada de navegación desde
  Rutinas.
- **Dos campos de media independientes y opcionales** por ejercicio:
  - **archivo propio**: video o GIF/imagen que el staff sube y queda en un object storage
    S3-compatible; el sistema guarda la referencia y sirve una URL para reproducirlo/mostrarlo.
  - **URL externa**: un link (YouTube, GIF alojado) que se pega a mano.
  Un ejercicio puede tener uno, el otro, los dos o ninguno. Si tiene los dos, **el archivo
  propio es el que se muestra** (tiene prioridad sobre la URL externa) — evita depender de un
  link externo que puede caerse cuando el gimnasio ya tiene su propio material. El upload acepta
  video (mp4) o imagen animada/estática (gif, jpg, png) hasta un tamaño máximo razonable para
  demostraciones cortas de ejercicio (definir el límite exacto en `design.md`).
- **Grupo muscular** pasa de texto libre a **lista fija del sistema**, uno solo por ejercicio,
  opcional (R2/R3 de `04-rutinas.md`): Pecho, Espalda, Hombros, Bíceps, Tríceps, Antebrazo, Core,
  Glúteos, Cuádriceps, Isquios, Gemelos, Cuerpo completo.
- **Tipo de entrenamiento**: cero o más por ejercicio, de una lista fija del sistema: Fuerza,
  Hipertrofia, Resistencia, Cardio, Movilidad, Funcional, Rehabilitación.
- **Desactivación en vez de borrado, salvo si nunca se usó**: un ejercicio usado en alguna
  plantilla de rutina o sesión/registro del miembro no se puede borrar, solo desactivar.
  Desactivado, deja de ofrecerse para agregar a plantillas nuevas, pero las plantillas y
  sesiones que ya lo usan lo conservan. Un ejercicio que **nunca** se usó (sin importar el
  vínculo automático del catálogo fijo de días, que no cuenta como uso) sí se puede **borrar
  definitivamente** — pensado para limpiar un típeo recién dado de alta; si tenía un archivo
  propio subido, ese archivo también se elimina del storage.
- **Nombre obligatorio y único**, sin distinguir mayúsculas ni espacios en los bordes.
- Se reusan los campos que ya tiene `Exercise` (`name`, `description`, `muscle_group`,
  `is_active`); no se crea una entidad nueva.
- Infraestructura de object storage S3-compatible para los archivos subidos: **MinIO** agregado
  al `docker-compose.yml` de desarrollo local, y un **Storage Bucket nativo de Railway**
  (S3-compatible, privado, gestionado) en producción. El diseño del cliente, el esquema de
  claves/paths y los endpoints de upload quedan para `design.md` — acá solo se declara la
  necesidad.
- Actualiza `docs/producto/04-rutinas.md`: reescribe el supuesto R1 (deja de decir "no hay
  subida de archivos en este MVP"; documenta los dos campos de media y la prioridad del archivo
  propio), tacha R-2 en la tabla de brecha MVP (§6) y corrige la fila "Permisos" de §5 (deja de
  decir "Catálogo de ejercicios: solo Dueño").
- Actualiza `docs/producto/09-backlog-mvp.md`: saca "Subida de video/imagen para ejercicios" de
  la tabla Post-MVP y marca R-2 con este change en la tabla de Fase 2.
- Actualiza `docs/producto/01-roles-y-permisos.md` §2.3: la fila "Crear / editar / desactivar
  ejercicio del catálogo" pasa de Coach ❌ a ✅ (hereda, D10) — permisos confirmados por el
  usuario: Dueño **y** Coach pueden crear, editar y desactivar ejercicios del catálogo, igual que
  el resto de operaciones de Rutinas. La nota "Sin pantalla de alta; sin video ni tipos" se
  retira porque este change la resuelve.

## Fuera de alcance

- **Deprecar la base del ejercicio** (`base_sets`/`base_reps`/`base_weight_kg`): el motor de
  estrategias todavía la usa para derivar series hasta que existan series explícitas en la
  plantilla (R-4). Este change agrega media y tipos sin tocar esos tres campos ni el motor.
- R-3: días propios de la plantilla con grupos musculares planificados (retirar el catálogo fijo
  de días). Depende de este change pero es un change separado.
- R-4: editor de series explícitas por ejercicio del día; estrategias como generador opcional.
- R-5: carga actual por miembro y serie en la asignación.
- R-6: sesión del miembro (elegir día, ver video, ajustar kg/reps, marcar series, finalizar).
- Catálogos administrables de grupo muscular y tipo de entrenamiento (siguen siendo listas fijas
  del sistema, R2 de `04-rutinas.md`; no hay pantalla para que el Dueño las edite).
- Migrar o reetiquetar el `EXERCISE_LIBRARY` de seed existente en `routine_catalog.py` más allá
  de lo necesario para que sus grupos musculares mapeen a la lista fija nueva.

## Capabilities

### New Capabilities
- `exercise-catalog`: CRUD del catálogo de ejercicios para staff (Dueño y Coach) — alta, edición,
  desactivación, listado con filtros (texto, grupo muscular, tipo, activos/inactivos), nombre
  único case/trim-insensitive, no se borra si está en uso, media con archivo propio subido y/o
  URL externa (prioridad al archivo propio si están los dos), grupo muscular de lista fija
  (0..1), tipos de entrenamiento de lista fija (0..n).

### Modified Capabilities
- `staff-endpoint-authorization`: agrega los requirements de autorización de los endpoints
  nuevos del catálogo de ejercicios (listado, detalle, crear, editar, desactivar, subir archivo
  de media), exigiendo sesión y rol Dueño o Coach — mismo criterio que el resto de endpoints de
  staff (D10: en este MVP el Coach hereda los permisos del Dueño).

## Impact

- Backend: nuevo router `exercises.py` con endpoints CRUD y de upload de media; extiende el
  modelo `Exercise` con los campos nuevos (media subida, URL externa, tipos de entrenamiento) y
  agrega las listas fijas de grupo muscular y tipo como enums o tablas de referencia (definido en
  `design.md`); migración Alembic; cliente de object storage S3-compatible; validación de
  nombre único y de no-borrado si está en uso.
- Frontend: pantalla nueva de Ejercicios (listado + diálogo alta/edición) siguiendo el patrón de
  Planes; entrada de navegación desde Rutinas; selector de grupo muscular y de tipos desde listas
  fijas; input de subida de archivo + input de URL externa con la regla de prioridad.
- Infraestructura: MinIO en `docker-compose.yml` (desarrollo); Storage Bucket de Railway
  (producción); variables de entorno nuevas para credenciales/endpoint del storage (documentar en
  `.env.example` / `.env.docker.example`).
- Documentación de producto: `docs/producto/04-rutinas.md` (R1 reescrito, R-2 tachado en §6,
  permisos de §5 corregidos), `docs/producto/09-backlog-mvp.md` (ítem sacado de Post-MVP, R-2
  marcado con este change) y `docs/producto/01-roles-y-permisos.md` (§2.3, Coach ✅ hereda D10).
