## Context

El catálogo de ejercicios existe en la base desde `add-routines-module`, pero no tiene dueño: se
puebla solo por seed y se edita por endpoints sueltos colgados del router de Rutinas.

Estado del código que este change toca:

- `backend/app/models.py`: `Exercise` (id `String` PK — ids **semánticos** de seed tipo
  `back-lat-pulldown`, no uuid —, `name`, `muscle_group String NOT NULL index`, `description`,
  `is_active`, y la base de progresión `base_sets`/`base_reps`/`base_weight_kg` de
  `add-routine-templates` D3). Cuatro tablas la referencian por FK: `TrainingDayExercise`,
  `WorkoutLog`, `RoutineTemplateExercise`, `RoutineAssignmentBase` — todas con
  `ON DELETE CASCADE`.
- `backend/app/routine_catalog.py`: `TRAINING_DAYS` (4 días fijos, cada uno con
  `muscle_groups: list[str]`) + `EXERCISE_LIBRARY` (~50 ejercicios). Los grupos que usa hoy son
  **seis strings sin tildes**: `Pecho`, `Espalda`, `Hombros`, `Biceps`, `Triceps`, `Piernas`.
- `backend/app/routers/routines.py`: `_ensure_seed_data` (corre en cada `GET /routines/catalog`,
  `/days`, `/exercises` y reescribe días y links), `_day_ids_for_muscle_group` y
  `_sync_exercise_day_links` **comparan `Exercise.muscle_group` por igualdad de string contra
  `TRAINING_DAYS[*].muscle_groups`**. Ahí está el acoplamiento peligroso de este change: tocar el
  string del grupo sin tocar el catálogo de días borra los `TrainingDayExercise` de las filas que
  dejan de matchear. Además expone `POST /routines/exercises` (owner-only, sin consumidor en el
  frontend) y `PUT /routines/exercises/{id}` (owner-only, **sí** consumido por
  `EditExerciseBaseDialog` / `AdjustExerciseBaseDialog` vía
  `frontend/src/services/routineTemplates.ts`).
- `backend/app/routers/membership_plans.py`: el patrón CRUD más reciente y el que se copia —
  autorización a nivel router, `_normalize_name` (NFC + strip + casefold en Python),
  `_check_name_collision` + traducción de `IntegrityError` a 409, `X-Total-Count`, sin `Link`.
- `backend/app/config.py`: `Settings` de pydantic-settings, `extra="ignore"`, `env_file`
  `backend/.env`.
- `backend/tests/conftest.py`: SQLite de archivo, `get_db` override, entorno seteado antes de
  importar `app.*`. Toda la suite corre sin red y sin Docker.
- Frontend: `MembershipPlans.tsx` + `membershipPlans.ts` / `.queries.ts` + `queryKeys` es el
  patrón de pantalla CRUD. `Routines.tsx` es un `ListPageLayout` con header propio.
- `docker-compose.yml`: `db` + `backend` + `frontend`, sin ningún servicio de storage.
- `backend/requirements.txt`: tiene `python-multipart`; **no** tiene `boto3`.

Restricciones que condicionan todo lo de abajo:

1. `make test` no puede depender de Docker ni de red (AGENTS.md §Tests). El storage tiene que ser
   sustituible en la suite.
2. En Railway **no hay migraciones automáticas en el deploy**: se corren a mano por CLI.
3. Los datos de la base actual son de prueba, pero el `muscle_group` que hay que remapear **sí**
   participa de la lógica viva de `_ensure_seed_data`: un remapeo descuidado borra links reales.
4. La base del ejercicio (`base_*`) y el motor de progresión **no se tocan** (fuera de alcance del
   proposal, sigue en uso hasta R-4).

> Las delta specs las está escribiendo el Product Owner en paralelo. Donde este design necesitó un
> detalle de comportamiento que el proposal no fija, va anotado como **supuesto** (S1..S7) en
> Open Questions, no como requirement.

## Goals / Non-Goals

**Goals:**

- Un único router dueño del catálogo (`/exercises`) con CRUD + filtros, autorizado para Dueño y
  Coach.
- Grupo muscular y tipos de entrenamiento como listas fijas del sistema, con una sola fuente de
  verdad compartida entre backend y frontend.
- Dos campos de media independientes (archivo propio + URL externa) con una regla de prioridad
  resuelta en el backend, no reimplementada en la UI.
- Un puerto de object storage con dos adaptadores (S3-compatible real / in-memory) para que dev,
  prod y tests solo difieran en configuración.
- Una migración que remapea los `muscle_group` legacy **sin perder filas ni links**.

**Non-Goals:**

- Deprecar `base_sets`/`base_reps`/`base_weight_kg` ni tocar `progression.py`.
- Exponer la media en los endpoints del **portal del miembro** (`/routines/my/*`): eso es R-6.
  Este design sí elige la estrategia de acceso pensando en que ese consumidor llega después (ver
  D3), pero no agrega el campo a esas respuestas ahora.
- Retirar el catálogo fijo de días (`TRAINING_DAYS`) ni `_ensure_seed_data`: es R-3.
- Un job de recolección de objetos huérfanos (ver D6).
- Catálogos administrables de grupo muscular / tipo de entrenamiento (R2 de `04-rutinas.md`).
- Transcodificar, comprimir o generar thumbnails del archivo subido.

## Decisions

### D1. Grupo muscular: enum de Python validado en Pydantic, columna `String` nullable

`MuscleGroup(str, enum.Enum)` en `backend/app/models.py`, con los 12 valores del proposal
(`Pecho`, `Espalda`, `Hombros`, `Bíceps`, `Tríceps`, `Antebrazo`, `Core`, `Glúteos`,
`Cuádriceps`, `Isquios`, `Gemelos`, `Cuerpo completo`). El **valor** del enum es la etiqueta en
español con tildes; el nombre del miembro es el identificador en inglés (`MuscleGroup.chest =
"Pecho"`), siguiendo la convención del repo (código en inglés, contenido de usuario en español).

La columna `exercises.muscle_group` **sigue siendo `String`** y pasa a **`nullable=True`** (0..1,
opcional por R3). La validación contra la lista fija vive en el schema Pydantic
(`muscle_group: Optional[MuscleGroup]`), que ya da `422` gratis con el detalle de los valores
válidos.

*Alternativas consideradas:*

- **`Column(Enum(MuscleGroup))`** (lo que hace `User.role`). Rechazada por dos razones concretas:
  (a) en Postgres crea un tipo `ENUM` y agregar un grupo más adelante obliga a un `ALTER TYPE ...
  ADD VALUE` — que hasta PG12 no corre dentro de una transacción y ensucia toda migración futura;
  (b) sobre todo: la migración que convierte la columna **fallaría** si quedara un solo valor
  legacy fuera del mapeo, convirtiendo un problema de datos en un deploy roto. Con `String` el
  peor caso es una fila con un grupo que no matchea ningún filtro, y se corrige con un `UPDATE`.
- **Tabla de catálogo `muscle_groups`** con FK. Rechazada: la lista es fija por definición (R2), y
  una tabla implica seed, un join en cada listado y una pantalla de administración que el proposal
  saca explícitamente de alcance. Si R2 se revierte algún día, pasar de string validado a tabla es
  aditivo.
- **`CHECK (muscle_group IN (...))`**. Descartada como cinturón adicional: tiene el mismo costo de
  `ALTER` que el enum de PG para ganar una defensa que la capa de aplicación ya da, y las filas
  legacy la harían fallar al crearla.

### D2. Tipos de entrenamiento: tabla de asociación `exercise_training_types`

`TrainingType(str, enum.Enum)` con los 7 valores del proposal (`Fuerza`, `Hipertrofia`,
`Resistencia`, `Cardio`, `Movilidad`, `Funcional`, `Rehabilitación`), mismo criterio de
nombre/valor que D1.

```
exercise_training_types
  exercise_id    FK exercises.id ON DELETE CASCADE, not null
  training_type  String, not null
  sort_order     Integer, not null, default 0     # orden elegido en el formulario
  PRIMARY KEY (exercise_id, training_type)
  INDEX (training_type)
```

PK compuesta en vez de `id` surrogate: la fila **es** el par, no tiene identidad propia, y la PK
compuesta da la unicidad sin un índice extra. El `CASCADE` es correcto acá (a diferencia del resto
del modelo, donde borrar un ejercicio está prohibido): estas filas son atributos del ejercicio.

*Alternativas consideradas:*

- **Columna `ARRAY(String)` de Postgres**: la más natural para 0..n, pero SQLite —el motor de la
  suite— no la soporta, así que el modelo dejaría de ser testeable sin Docker (restricción 1).
- **Columna JSON**: corre en los dos motores, pero filtrar "ejercicios con tipo Fuerza" obliga a
  sintaxis específica por motor (`jsonb @>` vs `json_each`), que es exactamente el tipo de
  divergencia dev/test que este repo ya sufrió con `lower()` (ver D1 de `add-membership-plans`).
- **String separado por comas**, como `TrainingDay.muscle_groups` hoy: filtrar sería `LIKE
  '%Fuerza%'`, con falsos positivos y sin unicidad. Es justo el patrón que este change viene a
  dejar atrás.

Costo aceptado: escribir los tipos de un ejercicio es un `DELETE` + `INSERT` del set completo
dentro de la misma transacción del `PATCH` (no un diff fila por fila). Con ≤7 filas por ejercicio
no vale la pena optimizarlo.

### D3. Acceso al archivo: bucket privado + URL prefirmada de lectura, con expiración cuantizada

**La decisión más cara de revertir del change.** El bucket es privado en los dos entornos (el
Storage Bucket de Railway lo es por defecto y no se puede abrir).

**Elegida: el backend firma una URL `GET` temporal y la devuelve en el cuerpo del ejercicio
(`media_file_url`).** El browser (o el `<video>`) va **directo** al bucket con esa URL.

Por qué, contra las dos alternativas:

- **Proxy por el backend** (`GET /exercises/{id}/media` que streamea desde S3). Rechazada por tres
  costos que se acumulan: (a) duplica el egress (bucket → contenedor → browser) y en Railway el
  egress se factura; (b) un video de decenas de MB ocupa un worker de uvicorn durante todo el
  streaming, y el backend corre con un pool chico — tres miembros mirando un video a la vez
  degradan la API entera; (c) para que el `<video>` permita hacer *seek* hay que implementar
  `Range` a mano y reenviarlo a S3, que es reescribir mal lo que el bucket ya hace bien.
- **Bucket público de solo lectura**. Rechazada: no es una opción en el Storage Bucket de Railway,
  y aun donde lo fuera implicaría que todo el material del gimnasio queda indexable por cualquiera
  que adivine o filtre una key.

Detalles que hacen que la opción elegida sea barata:

- **Presignar no hace red.** `boto3.client("s3").generate_presigned_url` es puro HMAC local: no
  contacta al bucket, no agrega latencia por ejercicio y **no falla si el storage está caído**
  (solo fallará la descarga). Por eso es aceptable firmar 50 URLs al serializar una página del
  listado sin ninguna caché.
- **Expiración cuantizada para no romper la caché del browser.** Una URL prefirmada cambia en cada
  request (la firma depende del timestamp), así que el browser la trata como un recurso nuevo y
  vuelve a descargar el video en cada render del listado. Se firma con la expiración **redondeada
  hacia arriba a una ventana fija** (`STORAGE_URL_WINDOW_SECONDS`, default 900 s): durante 15
  minutos la misma key produce una URL byte a byte idéntica y el `<video>`/`<img>` pega en la
  caché HTTP. TTL efectivo = `STORAGE_URL_TTL_SECONDS` (3600) + hasta una ventana.
- La URL viaja en el JSON del ejercicio, no en un endpoint aparte: un endpoint dedicado sería un
  round-trip por fila del listado.

*Trade-off aceptado:* una URL filtrada sigue sirviendo el archivo hasta ~1 h 15 min aunque el
ejercicio se desactive o se le quite la media. Es material de demostración de ejercicios, no dato
personal; el costo de acortar el TTL es romper la reproducción de un video largo a mitad de
camino. Queda anotado que si alguna vez se sube material con datos de un miembro, el TTL hay que
bajarlo y la cuantización hay que revisarla.

**Para R-6 (portal del miembro)**: el helper que firma no depende del rol ni de la sesión, así que
exponer `media_file_url` en `/routines/my/*` va a ser agregar el campo al serializer, sin tocar
esta decisión.

#### D3.1. El endpoint con el que se **firma** no es siempre el mismo con el que se **habla**

Agujero encontrado al verificar la task 8.5, sobre el diseño ya implementado. En el stack de
Docker, `STORAGE_ENDPOINT_URL=http://minio:9000` es el hostname de la red de Compose: el único que
el contenedor `backend` puede usar para hablar con MinIO, y el único que el browser —que corre en
el host— **no** puede resolver. Como ese mismo valor es el que se embebe en la URL prefirmada, la
subida funciona y el `<video>` no carga nada. Con `make dev` nativo no pasa porque las dos puntas
son `localhost:9000`, y en Railway tampoco porque el bucket gestionado tiene un endpoint único y
público. Es un agujero exclusivo de Compose.

**Decisión: `S3ObjectStorage` separa los dos usos del endpoint.** Se agrega
`STORAGE_PUBLIC_ENDPOINT_URL` (default `""`); cuando está vacía **cae a `STORAGE_ENDPOINT_URL`**.
El adaptador construye dos clientes de boto3: uno de **operaciones** (`put_object` /
`delete_object`) contra el endpoint interno, y uno de **firma** (`generate_presigned_url`) contra
el público. Si los dos valores coinciden —`make dev` y Railway— se reusa el mismo cliente y no hay
nada nuevo que configurar.

Lo que hace que esto sea barato y no una capa de indirección más: **el cliente de firma nunca hace
I/O**. Presignar es puro HMAC local (ya es la premisa de D3), así que no importa que su endpoint
sea inalcanzable desde el backend — que es exactamente el caso de Compose, donde `localhost:9000`
desde el contenedor apunta al propio contenedor. Un cliente boto3 que solo firma no abre sockets y
no puede fallar por red.

**La cuantización de D3 no se toca.** El host pasa a ser una entrada más de la firma, pero es
constante para un entorno dado; la determinación dentro de la ventana depende del `ExpiresIn`
cuantizado y de la key, que no cambian. La URL sigue siendo byte a byte idéntica durante los 15
minutos y la caché del browser sigue pegando.

*Alternativas consideradas:*

- **Reescribir el host de la URL después de firmar** (el one-liner tentador). **No funciona**:
  SigV4 incluye `host` en `SignedHeaders`, así que cambiar el host invalida la firma y MinIO
  responde `403`. Vale dejarlo escrito porque es el primer intento que se le ocurre a cualquiera.
- **`127.0.0.1 minio` en el `/etc/hosts` del host** (el workaround que encontró el Dev). Rechazada
  por el mismo criterio que ya fijó la task 8.2 sobre crear el bucket a mano: es un paso manual,
  con `sudo`, fuera del control del repo, que le muerde a cada persona que clone y corra
  `make docker-up`. `make docker-up` tiene que funcionar solo.
- **Que el browser no hable con MinIO y el backend proxee el archivo**: es volver a la opción que
  D3 ya rechazó (egress duplicado, un worker de uvicorn ocupado por todo el streaming, `Range` a
  mano para el seek). Arreglar un problema de hostnames de desarrollo no justifica pagar eso en
  producción.
- **`network_mode: "service:minio"` en el servicio `backend`** para que compartan `localhost`.
  Funciona, pero obliga a declarar los puertos del backend en el servicio de MinIO, enreda los
  healthchecks y acopla el networking de dos servicios que no tienen nada que ver. Más frágil que
  una variable de entorno.
- **Dejar MinIO afuera del stack de Docker y usar `InMemoryObjectStorage` en dev**: un camino de
  código exclusivo de desarrollo, que además haría que nadie ejercite el adaptador real antes de
  producción. Es justo la paridad dev/prod que D8 buscaba.

### D4. Subida: multipart al backend, no presigned upload

**Elegida: `POST /exercises/{id}/media` con `UploadFile` (multipart/form-data); el backend valida
y sube al bucket.** `python-multipart` ya está en `requirements.txt`.

*Alternativa considerada: URL prefirmada de subida y el browser sube directo al bucket.* Es la
opción correcta para archivos grandes (el archivo no pasa por el contenedor), pero acá no paga:

- Con el límite de **25 MB** de D5, el costo de atravesar el backend es acotado y no sostenido:
  Starlette bufferea `UploadFile` en un `SpooledTemporaryFile` (spool de 1 MB, después a disco),
  así que no hay 25 MB en RAM, y se sube al bucket con `upload_fileobj` en chunks.
- El presigned upload **no puede validar de verdad**: las condiciones de un presigned POST cubren
  content-type declarado y rango de tamaño, pero no los magic bytes; el cliente declara lo que
  quiere. Con multipart el backend valida tipo real, tamaño real y escribe la key en la **misma
  transacción** en la que el ejercicio pasa a referenciarla.
- El presigned upload obliga a un segundo endpoint de "confirmar subida", y con él a un estado
  intermedio en el que el objeto existe pero nadie lo referencia: huérfanos **por diseño**, no por
  accidente.
- Además requiere configurar CORS en el bucket, que en un bucket gestionado por Railway es una
  perilla menos controlable que nuestro propio código.

Validación en el endpoint, en este orden:

1. `file.size` (el tamaño **real** de la parte ya parseada por Starlette) > límite ⇒ `413`, sin
   escribir nada en el bucket.
2. Sniff de los primeros 16 bytes contra la firma del formato (`ftyp` para mp4, `GIF8`,
   `\xff\xd8` para jpeg, `\x89PNG`) y cruce con el `content_type` declarado ⇒ `415` si no
   coinciden. Después, `seek(0)`.
3. `put_object` recibiendo **el file object directamente** (`upload_fileobj` streamea desde el
   `SpooledTemporaryFile`), después `UPDATE` de las columnas y `commit`.

En ningún paso se materializa el archivo entero en memoria: se leen 16 bytes para el sniff y el
resto lo streamea boto3 desde el archivo temporal.

#### D4.1. Limitación conocida: el límite se aplica **después** de recibir el cuerpo

> Corrige lo que esta decisión afirmaba antes. La versión anterior decía "`Content-Length` > límite
> ⇒ `413` **sin leer el cuerpo** (atajo barato)". **Eso es falso con `UploadFile`** y el código
> nunca lo hizo: con `file: UploadFile = File(...)`, Starlette parsea el multipart completo durante
> la resolución de dependencias, antes de que corra la primera línea del endpoint. El chequeo de
> `Content-Length` que había ahí no ahorraba nada y encima contaba los boundaries del multipart,
> así que rechazaba por unos cientos de bytes un archivo de exactamente el límite. Se retira: lo
> reemplaza el chequeo de `file.size`, que es exacto.

Lo que esto significa en concreto: **una subida de 2 GB se recibe entera antes de devolver `413`**.
Dos matices que acotan el daño y que la versión anterior no dejaba ver:

- **El cuerpo va a disco, no a RAM.** Starlette bufferea `UploadFile` en un
  `SpooledTemporaryFile` con umbral de 1 MB. El modo de falla de una subida hostil es disco
  temporal y ancho de banda, no OOM.
- **El techo real no es nuestro.** Contra una subida hostil, el límite que sirve es el del proxy
  de entrada (Railway), no un `if` en el endpoint.

**Se acepta y se documenta, no se arregla acá.** Rechazar de verdad antes de recibir el cuerpo
obliga a leer `Request.stream()` crudo y parsear el multipart a mano o con una librería de
streaming (`streaming-form-data`): una dependencia nueva o un parser propio, para cerrar un vector
de DoS que en un gimnasio chico **sin usuarios finales** (regla de BETA de `AGENTS.md`) no existe.
El día que importe, el orden correcto es (1) límite en el proxy, (2) recién después tocar el
endpoint.

Lo que **sí** se arregla ahora es lo que era una promesa incumplida y no una limitación de
arquitectura: el conteo por chunks que acumulaba `chunks: list[bytes]` y hacía `b"".join(chunks)`
—un pico de ~50 MB de RAM por subida de 25 MB, justo lo contrario de lo que D4 afirma— desaparece
con los pasos 1 a 3 de arriba.

### D5. Límite de tamaño y formatos

**Formatos aceptados: `video/mp4`, `image/gif`, `image/jpeg`, `image/png`.** Exactamente los que
enumera el proposal; no se agrega `webm` ni `mov` para no ampliar alcance (y porque mp4 es el
único con reproducción universal garantizada en los browsers que soporta el frontend).

**Límite: 25 MB** (`STORAGE_MAX_UPLOAD_BYTES = 26_214_400`, configurable por entorno).

El número sale de tres cuentas:

- **Lo que hace falta**: una demostración de ejercicio útil dura 10–20 s. A 720p / h264 / ~3 Mbps
  eso son ~4–8 MB. 25 MB deja margen cómodo para 40 s, para un GIF pesado o para un archivo mal
  exportado por el celular del Dueño, sin habilitar que alguien suba una clase entera.
- **Lo que cuesta**: el egress de Railway se factura. Un video de 25 MB visto 3 veces al mes por
  60 miembros son ~4,5 GB/mes **de un solo ejercicio**; con un catálogo de 50, el techo teórico es
  del orden de los cientos de GB. El límite es la única perilla que acota eso hoy (no hay
  transcodificación, D:Non-Goals).
- **Lo que tolera el backend**: 25 MB de subida es ~5–15 s de request en una conexión de gimnasio
  típica, dentro de cualquier timeout razonable, y con el spool a disco no compromete memoria.

La válvula de escape para material más pesado ya existe y es gratis: **la URL externa**
(YouTube/Vimeo), que no consume ni storage ni egress nuestro. Eso es lo que justifica ser
restrictivo acá.

`STORAGE_MAX_UPLOAD_BYTES` es variable de entorno y no constante para poder bajarlo en producción
sin un deploy si el egress se dispara.

### D6. Ciclo de vida del objeto: se guarda la **key**, y el borrado siempre va después del commit

**Se persiste la key del objeto, no la URL completa.** Columnas nuevas en `exercises`:

```
external_media_url        String, nullable      # la URL externa pegada a mano
media_object_key          String, nullable      # p. ej. exercises/<id>/<uuid4>.mp4
media_content_type        String, nullable
media_size_bytes          Integer, nullable
media_filename            String, nullable      # nombre original, para mostrarlo en la UI
media_uploaded_at         DateTime, nullable
media_uploaded_by_user_id FK users.id ON DELETE SET NULL, nullable
```

Por qué la key y no la URL:

- Con bucket privado **no existe una URL estable**: la URL es prefirmada y efímera por definición
  (D3). Guardarla sería guardar un valor que caduca.
- El endpoint cambia entre entornos (`http://minio:9000` en Docker, el host de Railway en prod).
  Restaurar un dump de producción en local —que es exactamente lo que hace el equipo— dejaría
  todas las URLs apuntando a un host inalcanzable, mientras que las keys siguen siendo válidas
  contra cualquier bucket con el mismo contenido.
- Mover de proveedor de storage pasa a ser copiar el bucket y cambiar dos variables de entorno, en
  vez de un `UPDATE` masivo sobre la tabla.

Esquema de keys: `exercises/{exercise_id}/{uuid4}.{ext}`. El uuid (y no un nombre fijo tipo
`media.mp4`) es deliberado: **reemplazar la media escribe una key nueva**, así que no hay ventana
en la que la key vieja ya esté pisada y el commit todavía no, y la caché del browser no sirve el
archivo anterior.

**Reglas de vida del objeto:**

| Evento | Qué pasa con el objeto |
|---|---|
| Se sube un archivo | `put_object` con key nueva → `UPDATE` + `commit`. |
| Se **reemplaza** el archivo | `put_object` de la key nueva → `UPDATE` a la key nueva → `commit` → **después** `delete_object` de la key vieja, *best effort*. |
| Se **quita** la media (`DELETE .../media`) | columnas a `NULL` → `commit` → después `delete_object`, best effort. |
| Se **desactiva** el ejercicio | **no se toca nada.** |
| Se **borra** el ejercicio (solo si no está en uso, D7) | `commit` del `DELETE` → después `delete_object`, best effort. |

El orden "commit primero, borrar después" es la única forma de no dejar nunca una fila apuntando a
un objeto inexistente (invariante I3). El modo de falla que queda es el benigno: un objeto
huérfano en el bucket. El best-effort loguea el fallo a `WARNING` con la key, y **nunca** convierte
un borrado de storage fallido en un `500` de una operación que ya se commiteó.

**Desactivar no borra** porque la spec dice que las plantillas y sesiones que ya usan el ejercicio
lo conservan: si el objeto desapareciera, el miembro que está entrenando con esa plantilla se
queda sin la demostración. La desactivación saca el ejercicio del selector, no del pasado.

**Los huérfanos se aceptan y no hay limpieza en este change.** No hay scheduler en el repo, y el
costo real es despreciable (decenas de ejercicios, cada huérfano ≤25 MB). Queda como follow-up un
script `backend/scripts/gc_exercise_media.py` que liste el prefijo `exercises/` y borre las keys
no referenciadas — explícitamente **fuera de alcance** acá para no inventar infraestructura de
mantenimiento antes de tener el problema.

### D7. Contrato de API

Router nuevo `backend/app/routers/exercises.py`, registrado en `backend/app/main.py`. Autorización
**a nivel router** (patrón de `membership_plans.py`, no endpoint por endpoint), lo que da `401` sin
sesión y `403` con rol `member` en todos los endpoints — que es lo que necesita el delta de
`staff-endpoint-authorization`:

```python
router = APIRouter(
    prefix="/exercises",
    tags=["exercises"],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)
```

| Verbo y ruta | Body | Respuesta | Errores |
|---|---|---|---|
| `GET /exercises/meta` | — | `200 ExerciseMetaOut{muscle_groups[], training_types[]}` | — |
| `GET /exercises/` | query: `q`, `muscle_group`, `training_type`, `is_active`, `limit` 1..200 (def. 50), `offset` | `200 List[ExerciseOut]` + `X-Total-Count` | `422` grupo/tipo fuera de la lista |
| `GET /exercises/{id}` | — | `200 ExerciseOut` | `404` |
| `POST /exercises/` | `ExerciseCreate{name, description?, muscle_group?, training_types?, external_media_url?}` | `201 ExerciseOut` + `Location` | `409` nombre duplicado, `422` enum o URL inválida |
| `PATCH /exercises/{id}` | `ExerciseUpdate` (todos opcionales; `training_types` reemplaza el set completo) | `200 ExerciseOut` | `404`, `409` nombre duplicado |
| `POST /exercises/{id}/activate` | — | `200 ExerciseOut` | `404`, `409` ya activo |
| `POST /exercises/{id}/deactivate` | — | `200 ExerciseOut` | `404`, `409` ya inactivo |
| `POST /exercises/{id}/media` | multipart `file` | `200 ExerciseOut` | `404`, `413` tamaño, `415` formato, `502` storage caído |
| `DELETE /exercises/{id}/media` | — | `200 ExerciseOut` | `404`, `409` no tiene archivo |
| `DELETE /exercises/{id}` | — | `204` | `404`, `409` está en uso |

Decisiones del contrato:

- **Nombre único case/trim-insensitive con columna `name_normalized`** (`String`, `UNIQUE`), NFC +
  strip + casefold calculado **en Python**, no con `lower()` de SQL: el `lower()` de SQLite es
  ASCII-only y se comportaría distinto de Postgres justo con las tildes que este catálogo tiene
  por todos lados. Es el mismo patrón ya probado en `RoutineTemplate` y `MembershipPlan`, con la
  misma traducción de `IntegrityError` → `409` para la carrera concurrente.
- **`GET /exercises/meta` en vez de hardcodear las listas en el frontend.** Una constante duplicada
  en TS derivaría en silencio (basta que alguien agregue un grupo en Python) y el síntoma sería un
  `422` incomprensible para el usuario. *Alternativa:* `frontend/src/lib/exerciseCatalog.ts` con
  las listas a mano — más rápido de renderizar y sin request, pero paga el drift. El request extra
  se amortiza con `staleTime: Infinity` en React Query: se pide una vez por sesión.
- **`training_types` se reemplaza entero, no se parchea por ítem.** Un `PATCH` con
  `training_types: ["Fuerza"]` deja exactamente ese tipo. Es lo que hace el formulario (un
  multi-select devuelve el set completo) y evita endpoints `POST/DELETE .../types/{t}`.
- **`activate`/`deactivate` como endpoints dedicados**, no como campo del `PATCH`: replica
  `membership_plans.py` y `users.py`, y deja lugar para las reglas de negocio propias (el `409` de
  "ya inactivo") que no entran en un `PATCH` genérico.
- **`activate` NO toca los `TrainingDayExercise`** (ver D7.1): solo pone `Exercise.is_active` en
  `True`.
- **`DELETE /exercises/{id}` existe pero es angosto.** Devuelve `409` si el ejercicio está
  referenciado por `RoutineTemplateExercise`, `WorkoutLog` o `RoutineAssignmentBase`. Los
  `TrainingDayExercise` **no cuentan como uso**: los genera automáticamente
  `_sync_exercise_day_links` a partir del grupo muscular, así que si contaran, todo ejercicio con
  grupo estaría "en uso" desde el segundo cero y el borrado sería inalcanzable (se borran en
  cascada). *Supuesto S1.*
- **Media en endpoints propios y no en el `PATCH`**: mezclar un `multipart/form-data` con el body
  JSON obligaría a que todo el alta sea multipart, perdiendo la validación declarativa de Pydantic
  sobre un body tipado.
- **`ExerciseOut` expone `media_kind: "file" | "external" | null`**, derivado en el backend según
  la regla de prioridad del proposal (archivo propio gana), más `media_file_url` (prefirmada, D3) y
  `external_media_url`. La UI **no** reimplementa la prioridad: lee `media_kind`. Si la regla
  cambia, cambia en un solo lugar.
- **Sin header `Link`** en el listado: `frontend/src/services/pagination.ts` solo consume
  `X-Total-Count`.

#### D7.1. Reactivar no restaura la selección por día (y no debería)

`deactivate` pone en `False` el `is_active` de **todos** los `TrainingDayExercise` del ejercicio.
Ese comportamiento es **preexistente** (venía de `PUT /routines/exercises/{id}`), pero `activate`
es nuevo en este change, y la primera implementación lo espejaba poniendo todos los links en
`True`. Eso pisa en silencio la curación que el Dueño hizo con
`PUT /routines/days/{day_id}/selection`: un ejercicio que había excluido del Día 1 reaparece ahí
—y en `active_exercise_count`— después de un ciclo desactivar/reactivar.

**Decisión: `activate` solo pone `Exercise.is_active = True` y no toca los links.**

Por qué, contra las dos alternativas:

- **"Reactivar restaura el estado por día tal como quedó al desactivar"**: imposible sin trabajo
  nuevo, porque el estado **ya se destruyó**: `deactivate` lo pisó con `False`. Habría que
  capturarlo antes de pisarlo, o sea una columna o tabla nueva para memorizar la selección previa.
  Es persistencia nueva para un subsistema que **R-3 retira** (el catálogo fijo de días), y la
  spec no la pide.
- **"Todo vuelve a activo"** (lo implementado): no está *restaurando* nada — el estado previo ya
  no existe —, está **inventando** un estado que nadie eligió, y encima es el más invasivo de los
  posibles.

Lo que inclina la balanza es la consistencia con el alta: `_sync_exercise_day_links` crea los
links de un ejercicio nuevo con `is_active=False`, así que **un ejercicio recién creado aparece en
el catálogo y no está seleccionado en ningún día** hasta que alguien lo selecciona. Con esta
decisión, un ejercicio reactivado se comporta igual que uno nuevo. Con la anterior quedaba *más*
seleccionado que uno recién creado, que no tiene ninguna justificación.

**No hace falta un requirement nuevo.** El escenario "Reactivar un ejercicio" de la spec pide que
el ejercicio *"vuelva a ofrecerse como opción para agregar a una plantilla nueva"* — eso es
exactamente `Exercise.is_active = True`, y es lo que gobierna el selector del catálogo. La spec no
dice nada sobre la selección del catálogo fijo de días, que es un subsistema distinto y saliente.

**Endpoints legacy de `routines.py`:**

- `POST /routines/exercises` **se retira**. No tiene consumidor en el frontend (solo lo usan los
  tests) y dejarlo vivo significaría un segundo escritor del catálogo que no valida grupo muscular
  contra la lista fija — un agujero directo en I1. `backend/tests/test_exercise_base.py` migra a
  crear por `POST /exercises/`.
- `PUT /routines/exercises/{id}` **se queda**, pero se le achica el schema a los tres campos de
  base (`base_sets`, `base_reps`, `base_weight_kg`). `EditExerciseBaseDialog` /
  `AdjustExerciseBaseDialog` lo usan y no se tocan en este change; `name`/`muscle_group`/
  `description`/`is_active` pasan a ser exclusivos de `PATCH /exercises/{id}`. Un campo, un dueño.
  Queda owner-only como hoy — el cambio de permisos del proposal es sobre el **catálogo**, no sobre
  la base de progresión (*supuesto S2*).

### D8. Puerto de storage y la dependencia `boto3`

`backend/app/storage.py`:

```python
class ObjectStorage(Protocol):
    def put_object(self, key: str, fileobj: BinaryIO, content_type: str) -> None: ...
    def delete_object(self, key: str) -> None: ...          # idempotente
    def presigned_get_url(self, key: str) -> str: ...        # sin red (D3)
```

Dos implementaciones: `S3ObjectStorage` (boto3, `endpoint_url` configurable ⇒ sirve igual para
MinIO y para Railway; internamente separa el cliente de **operaciones** del de **firma**, ver
D3.1) e `InMemoryObjectStorage` (dict de `key -> (bytes, content_type)`, devuelve
`memory://{bucket}/{key}?exp=...`). Se resuelve con una dependencia de FastAPI `get_storage()`
—cacheada con `lru_cache` sobre la config— para poder overridearla en la suite **igual que
`get_db`**, que es el mecanismo que el repo ya usa y entiende.

`S3ObjectStorage` traduce `botocore.exceptions.ClientError`/`EndpointConnectionError` en la subida
a `502 "No se pudo guardar el archivo, probá de nuevo"`, y en el borrado a un log `WARNING` (D6).

**Dependencia nueva: `boto3`** (arrastra `botocore`, `s3transfer`, `jmespath`). Costo de
mantenerla: ~85 MB instalada y un release semanal que en la práctica no se sigue (se pinea, como el
resto de `requirements.txt`). A cambio es el cliente de referencia de S3 y el que cualquier
proveedor S3-compatible documenta.

*Alternativas consideradas:* (a) firmar SigV4 a mano sobre `httpx`, que ya está — rechazada:
escribir criptografía de firma propia para ahorrar una dependencia madura es exactamente el
trade-off que no hay que tomar; (b) el cliente `minio`, más liviano — rechazada: nos ataría al
proveedor de desarrollo justo cuando producción es otro, y perderíamos la garantía de
compatibilidad que da el cliente de referencia.

### D9. Migración: esquema, y el catálogo se **reseedea** en vez de rescatarse

> Esta decisión se reescribió bajo la regla de BETA de `AGENTS.md` ("preferí el cambio limpio sobre
> la compatibilidad"): la versión anterior tenía un remapeo por id y una regla de reconciliación en
> `_ensure_seed_data`, ambos inventados para no perder datos de prueba. Los dos se fueron.

Una sola revision, `down_revision = "d5f74a834ac0"` (confirmar con `alembic heads` al implementar,
por si otra sesión mergeó algo antes).

`upgrade()`:

1. `add_column` de las siete columnas de media (D6) y de `name_normalized` en `exercises`.
2. Backfill de `name_normalized` (NFC + strip + casefold) y **recién después** el índice `UNIQUE`.
   Esto **no** es un backfill de rescate: sin él la columna queda nula y el chequeo de colisión de
   nombres no ve los ejercicios preexistentes, o sea el repo quedaría a medias entre dos modelos —
   lo único que la regla de BETA sigue prohibiendo. Son dos líneas.
3. `create_table exercise_training_types` + índice.
4. `alter_column exercises.muscle_group` → `nullable=True`.
5. Un único `UPDATE` de normalización, con valores literales (sin importar nada de `app.*`: las
   constantes evolucionan, las migraciones son fotos): `Biceps` → `Bíceps`, `Triceps` → `Tríceps`,
   y **todo lo que no quede dentro de la lista fija → `NULL`** (incluye `Piernas`). Es una tabla de
   renombres, no una heurística: no hay ninguna regla que adivine nada.

**`Piernas` va a `NULL` y punto.** La lista fija parte "Piernas" en tres (`Cuádriceps`, `Isquios`,
`Gemelos`) y el valor correcto depende del ejercicio. Antes esto me llevaba a inventar maquinaria
para recuperar el valor exacto; con datos de prueba no hay nada que recuperar. `NULL` es un estado
válido de primera clase (grupo 0..1, opcional) y la vía para volver a tener el catálogo bien
etiquetado es **reseedearlo**, no rescatarlo.

**El reseed del catálogo es el paso de despliegue, no un opcional.** `routine_catalog.py` se
actualiza en este change (`EXERCISE_LIBRARY` reparte los `legs-*` entre `Cuádriceps` / `Isquios` /
`Gemelos` y corrige las tildes; `TRAINING_DAYS` pasa a día 1 `["Pecho", "Tríceps"]`, día 2
`["Espalda", "Bíceps"]`, día 4 `["Cuádriceps", "Isquios", "Gemelos"]`). Después de migrar:

```sql
DELETE FROM exercises WHERE id NOT LIKE 'custom-%';
```

y la primera visita a Rutinas reconstruye el catálogo entero desde `EXERCISE_LIBRARY` con los
grupos correctos — que es, literalmente, lo que `_ensure_seed_data` ya hace hoy para los ids que
faltan. El `DELETE` cascadea a `training_day_exercises`, `workout_logs`,
`routine_template_exercises` y `routine_assignment_bases`: se lleva puesta la selección de
ejercicios de las plantillas de prueba y los registros de entrenamiento de prueba. Bajo la regla de
BETA eso es aceptable y explícito, y es muchísimo más barato que las dos capas de rescate que tenía
la versión anterior de esta decisión.

**`_ensure_seed_data` no gana ninguna regla nueva.** Queda exactamente como está. La reconciliación
"si un ejercicio de seed tiene `muscle_group IS NULL`, escribile el de la librería" existía solo
para no perder datos de prueba; con el reseed como paso de despliegue no hace falta, y con ella se
van su trade-off (pisar un grupo vacío puesto a propósito) y el riesgo de que nadie abra Rutinas en
producción y los ejercicios queden en `NULL` para siempre.

**Los `TrainingDayExercise` no son datos a preservar: son derivados.** `_ensure_seed_data` los
regenera enteros desde `TRAINING_DAYS` × `EXERCISE_LIBRARY` en cada request de Rutinas. Por eso
`routine_catalog.py` y la migración tienen que ir en el mismo change —si quedan desalineados, los
vínculos día↔ejercicio quedan vacíos y el Día 4 se ve sin ejercicios—, pero eso es un requisito de
**consistencia**, no una cuerda floja sobre datos irrecuperables: realinear los archivos y volver a
entrar a Rutinas los reconstruye solos.

`downgrade()`: rellena `muscle_group IS NULL` con `'Cuerpo completo'` (necesidad mecánica: si no,
el `alter_column` a `nullable=False` falla), vuelve la columna a no nula, dropea
`exercise_training_types`, el índice único y las ocho columnas. **No intenta restaurar nada** —
media, tipos y strings legacy se pierden. En beta, la forma correcta de volver atrás es
`downgrade` + reseed, y así se documenta en el docstring de la revision.

### D10. Configuración: variables, Docker y Railway

Variables nuevas en `backend/app/config.py`. Todas llevan default **apuntado al MinIO local**, que
es el entorno de desarrollo por defecto del repo — no es una concesión a `.env` viejos, es que el
valor correcto para `make dev` es conocido y no tiene sentido obligar a escribirlo:

| Variable | Default | Para qué |
|---|---|---|
| `STORAGE_BACKEND` | `s3` | `s3` \| `memory`. La suite usa `memory`. |
| `STORAGE_ENDPOINT_URL` | `http://localhost:9000` | Con quién **habla** el backend. Vacío ⇒ AWS S3 real. |
| `STORAGE_PUBLIC_ENDPOINT_URL` | `""` | Contra quién se **firma** la URL que ve el browser (D3.1). Vacío ⇒ cae a `STORAGE_ENDPOINT_URL`. **Solo hace falta en Compose.** |
| `STORAGE_REGION` | `us-east-1` | MinIO la ignora, SigV4 la exige. |
| `STORAGE_ACCESS_KEY_ID` | `""` | |
| `STORAGE_SECRET_ACCESS_KEY` | `""` | |
| `STORAGE_BUCKET` | `gymapp-media` | |
| `STORAGE_MAX_UPLOAD_BYTES` | `26214400` | D5. |
| `STORAGE_URL_TTL_SECONDS` | `3600` | D3. |
| `STORAGE_USE_PATH_STYLE` | `true` | MinIO necesita path-style; los buckets gestionados suelen aceptar los dos. |
| `STORAGE_URL_WINDOW_SECONDS` | `900` | cuantización de la firma, D3. |

Se documentan en `backend/.env.example` y `backend/.env.docker.example`. La diferencia entre los
dos es exactamente el par de endpoints de D3.1:

| | `STORAGE_ENDPOINT_URL` (hablar) | `STORAGE_PUBLIC_ENDPOINT_URL` (firmar) |
|---|---|---|
| `make dev` (nativo) | `http://localhost:9000` | vacío ⇒ cae al de la izquierda |
| `make docker-up` (Compose) | `http://minio:9000` | `http://localhost:9000` |
| Railway | endpoint del bucket gestionado | vacío ⇒ cae al de la izquierda |

Compose es el **único** entorno donde los dos difieren, y es el único donde hace falta setear la
variable nueva.

**`docker-compose.yml`** suma dos servicios:

- `minio`: imagen **pineada** a un `RELEASE.*` concreto (no `latest`: un release de MinIO que
  cambie el comportamiento del bucket no puede entrar por un `docker compose pull`), `server /data
  --console-address ":9001"`, puertos `9000` (API) y `9001` (consola), volumen `gymapp_minio_data`,
  healthcheck contra `/minio/health/live`.
- `minio-init`: one-shot con `minio/mc` que espera al healthcheck, crea el bucket si no existe y
  sale. Crear el bucket a mano desde la consola sería un paso no reproducible que rompe
  `make docker-up` para el próximo que clone el repo.

`backend` gana `depends_on: minio: {condition: service_healthy}` y las variables de storage en
`.env.docker.example`.

**Railway** (pasos manuales, no automatizables desde el repo):

1. Crear el Storage Bucket en el proyecto.
2. Mapear las credenciales que expone el bucket a los nombres `STORAGE_*` del backend usando
   referencias de variable (`${{Bucket.XXX}}`) en el servicio backend. Los nombres exactos que
   publica Railway hoy no están confirmados en este design (*supuesto S3*): se verifican con
   `railway variables` en el momento de configurar. **`STORAGE_PUBLIC_ENDPOINT_URL` no se setea**:
   el bucket gestionado tiene un endpoint único y público, así que el fallback de D3.1 hace lo
   correcto y la configuración de producción no gana ningún paso.
3. Deploy del backend.
4. **Correr la migración a mano por CLI** (`railway run alembic upgrade head`). En este proyecto el
   deploy **no** corre migraciones (nota de repo).
5. **Reseedear el catálogo** (D9): `DELETE FROM exercises WHERE id NOT LIKE 'custom-%'` y entrar una
   vez a Rutinas para que `_ensure_seed_data` lo reconstruya con los grupos de la lista fija.

No hay coreografía de orden que cuidar: son datos de prueba y el paso 5 los regenera. Si algo queda
raro entre el deploy y la migración, el arreglo es correr la migración y reseedear.

### D11. Tests del storage: fake in-memory por inyección, no mock de boto3

La suite corre con `STORAGE_BACKEND=memory` (seteado en `conftest.py` junto al resto del entorno,
antes de importar `app.*`) **y** con un override explícito de `get_storage` que devuelve una
instancia fresca de `InMemoryObjectStorage` por test, expuesta como fixture `storage` para poder
afirmar sobre su contenido (`assert key in storage.objects`). Cinturón y tirantes: el env var evita
que un test que se olvide del override salga a la red, el override da la visibilidad.

*Alternativas consideradas:* (a) `moto` — agrega una dependencia de desarrollo grande para simular
S3 con fidelidad que no necesitamos: lo que queremos verificar es *nuestro* router, no boto3; (b)
`unittest.mock.patch` sobre el cliente de boto3 — acopla los tests a la firma interna de boto3
(`upload_fileobj` vs `put_object`), así que un refactor legítimo del adapter rompe tests que no
deberían enterarse.

Un único test **sí** ejercita el adapter real, sin red:
`test_s3_object_storage_presigna_sin_red` instancia `S3ObjectStorage` con credenciales falsas y
verifica que `presigned_get_url` devuelve una URL con `X-Amz-Signature` y con el bucket/key
correctos. Es lo que demuestra que la propiedad "presignar no hace red" de D3 es cierta y que el
adapter real está bien cableado, sin abrir un socket.

### D12. Frontend

- **Ruta `/exercises`** con `<ProtectedRoute roles={["owner","coach"]}>` en `App.jsx`. Página
  `frontend/src/pages/Exercises.tsx`, cargada con `lazy(() => import("./pages/Exercises"))`
  **directo**, no por `routeImporters`: `routeImporters` es para las rutas del Sidebar.
- **No va al Sidebar.** La entrada es un botón secundario "Ejercicios" en el header de
  `Routines.tsx`, igual que `Payments.tsx` navega a `/plans`. El Sidebar ya tiene 8 ítems y el
  catálogo es una pantalla de soporte de Rutinas, no un módulo de primer nivel. *Supuesto S4.*
- `services/exercises.ts` (fetch + tipos) + `services/exercises.queries.ts` (hooks) +
  `queryKeys.exercises` (`all` / `list(params)` / `detail(id)` / `meta()`). Toda mutación invalida
  `queryKeys.exercises.all`, como en `membershipPlans.queries.ts`.
- **El alta con archivo son dos requests**: `POST /exercises/` y después `POST
  /exercises/{id}/media`, porque el endpoint de media necesita el id (D7). La falla parcial es
  benigna: queda el ejercicio creado sin archivo, el diálogo muestra el error y ofrece reintentar
  la subida sobre el ejercicio ya creado. *Alternativa:* un `POST` multipart que reciba todo junto
  — rechazada en D7.
- **Preview**: si `media_kind === "file"`, `<video controls preload="metadata">` o `<img>` según
  `media_content_type`; si es `"external"`, un link. La UI lee `media_kind`, no reimplementa la
  prioridad.
- Filtros: búsqueda por nombre con `useDebounce` (patrón de `MembershipPlans.tsx`), selector de
  grupo muscular y de tipo alimentados por `GET /exercises/meta`, y filtro activos/inactivos/todos.

## Risks / Trade-offs

- **[`routine_catalog.py` y la migración quedan desalineados y el Día 4 se ve sin ejercicios]** →
  degradado de "riesgo más caro del change" a molestia visible: los `TrainingDayExercise` son
  derivados que `_ensure_seed_data` regenera (D9), así que el arreglo es realinear los archivos y
  volver a entrar a Rutinas. Mitigación: las dos ediciones van en el mismo grupo de tasks y un test
  verifica que el seed produce los vínculos correctos con los grupos nuevos.
- **[El reseed del catálogo borra registros de entrenamiento y configuraciones de plantilla de
  prueba]** → aceptado explícitamente bajo la regla de BETA de `AGENTS.md`: son datos de prueba, y
  el `DELETE` está escrito en el plan de despliegue en vez de escondido en una heurística.
- **[Una URL prefirmada filtrada sirve el archivo hasta ~1h15 después de desactivar el ejercicio]**
  → aceptado en D3: es material de demostración. Si alguna vez se sube material con datos de un
  miembro, hay que bajar TTL y revisar la cuantización.
- **[Objetos huérfanos en el bucket]** → aceptado en D6 (borrado best-effort post-commit). Costo
  acotado por el límite de 25 MB y el volumen del catálogo; el follow-up es un script de GC.
- **[25 MB puede quedar corto para el Dueño]** → la válvula es la URL externa, y
  `STORAGE_MAX_UPLOAD_BYTES` se sube por variable de entorno sin deploy.
- **[`boto3` como dependencia nueva]** → justificada en D8; se pinea como el resto.
- **[Divergencia MinIO ↔ Railway Storage Bucket]** → los dos son S3-compatible pero no idénticos
  (path-style vs virtual-hosted, CORS, políticas). Mitigación: `STORAGE_USE_PATH_STYLE`
  configurable y una verificación manual explícita en producción (subir + reproducir un archivo)
  antes de dar el change por cerrado.
- **[`GET /exercises/meta` es un round-trip extra al abrir la pantalla]** → amortizado con
  `staleTime: Infinity`; el costo de la alternativa (drift silencioso) es peor.

## Migration Plan

1. `make migrate` en desarrollo (`alembic upgrade head`).
2. `make docker-up` con los servicios `minio` + `minio-init` nuevos; verificar el bucket en la
   consola de MinIO (`localhost:9001`).
3. Reseedear el catálogo en desarrollo: `DELETE FROM exercises WHERE id NOT LIKE 'custom-%'` y
   entrar a Rutinas (D9).
4. Producción: crear el Storage Bucket en Railway, mapear las variables `STORAGE_*`, deploy, y
   **`railway run alembic upgrade head` a mano** (D10, paso 4).
5. Reseedear el catálogo en producción, igual que el paso 3 (D10, paso 5).
6. Verificación manual en producción: subir un mp4 chico a un ejercicio y reproducirlo desde otro
   browser.

**Rollback**: revertir el merge del código y correr `alembic downgrade -1`. El `downgrade()` no
restaura nada (D9) y no hace falta que lo haga: el catálogo se reconstruye con el reseed. Bajo la
regla de BETA de `AGENTS.md` no se diseña un camino de vuelta más fino que ese.

## Plan de verificación

**Riesgo**: alto — el diff toca `backend/app/models.py` y `backend/migrations/**`, la migración
**descarta datos existentes** (manda a `NULL` todo `muscle_group` fuera de la lista fija y el plan
de despliegue borra y reseedea el catálogo), y además cambia qué rol puede escribir el catálogo (de
Dueño a Dueño + Coach) y retira un endpoint (`POST /routines/exercises`). Cualquiera de esos
gatillos, por sí solo, ya fija el nivel en alto. La simplificación bajo la regla de BETA de
`AGENTS.md` **no** baja el nivel: al contrario, se apoya en que un change puede ser riesgo alto y
aun así ser la opción correcta — lo que pide es más tests y verificación más cuidada, no un diseño
más tímido.

### Invariantes

- I1. Ninguna escritura de la API deja `exercises.muscle_group` con un valor fuera de
  `MuscleGroup`: el único valor no perteneciente a la lista fija que se acepta es `NULL`.
- I2. Toda fila de `exercise_training_types` tiene un valor de `TrainingType` y el par
  `(exercise_id, training_type)` es único.
- I3. Si `media_object_key` no es nulo, el objeto existe en el bucket: todo borrado de un objeto
  ocurre **después** del commit que dejó de referenciarlo, nunca antes.
- I4. Un ejercicio referenciado por `RoutineTemplateExercise`, `WorkoutLog` o
  `RoutineAssignmentBase` no se puede borrar por la API: solo desactivar.
- I5. Desactivar un ejercicio no borra su objeto de storage ni lo saca de las plantillas y
  sesiones que ya lo usan.
- I6. Después de correr el seed, los `TrainingDayExercise` son consistentes con
  `TRAINING_DAYS` × `EXERCISE_LIBRARY`: cada día tiene vinculados los ejercicios de sus grupos
  musculares. (Invariante de **consistencia**, no de preservación: los vínculos son derivados y se
  regeneran — ver D9.)
- I7. El nombre normalizado (NFC + strip + casefold) de un ejercicio activo o inactivo es único en
  toda la tabla.
- I8. `make test` no abre ningún socket ni depende de Docker: toda la suite corre contra
  `InMemoryObjectStorage`.
- I9. La URL prefirmada que devuelve la API es resoluble **desde el browser**: se firma siempre
  contra el endpoint público (D3.1), aunque el backend hable con el storage por otro hostname.
- I10. Ninguna operación del catálogo de ejercicios activa un `TrainingDayExercise` que el staff
  no haya seleccionado explícitamente (D7.1).

### Tests

| Capa | Archivo | Caso |
|---|---|---|
| backend | `backend/tests/test_exercises.py` | `test_crear_ejercicio_devuelve_201_con_grupo_y_tipos` |
| backend | `backend/tests/test_exercises.py` | `test_crear_ejercicio_sin_grupo_ni_tipos_ni_media_nace_activo` |
| backend | `backend/tests/test_exercises.py` | `test_nombre_duplicado_ignorando_mayusculas_y_espacios_devuelve_409` |
| backend | `backend/tests/test_exercises.py` | `test_nombre_vacio_o_solo_espacios_devuelve_422` |
| backend | `backend/tests/test_exercises.py` | `test_grupo_muscular_fuera_de_la_lista_fija_devuelve_422` |
| backend | `backend/tests/test_exercises.py` | `test_tipo_de_entrenamiento_fuera_de_la_lista_fija_devuelve_422` |
| backend | `backend/tests/test_exercises.py` | `test_patch_reemplaza_el_set_completo_de_tipos_de_entrenamiento` |
| backend | `backend/tests/test_exercises.py` | `test_editar_ejercicio_usado_en_plantilla_no_rompe_la_referencia` |
| backend | `backend/tests/test_exercises.py` | `test_url_externa_invalida_devuelve_422_y_no_modifica_el_ejercicio` |
| backend | `backend/tests/test_exercises.py` | `test_listado_filtra_por_grupo_tipo_y_estado_y_expone_total_count` |
| backend | `backend/tests/test_exercises.py` | `test_desactivar_ejercicio_lo_saca_del_listado_activo_y_conserva_la_plantilla` |
| backend | `backend/tests/test_exercises.py` | `test_reactivar_ejercicio_lo_vuelve_a_ofrecer_en_el_listado_activo` |
| backend | `backend/tests/test_exercises.py` | `test_reactivar_no_reactiva_la_seleccion_por_dia_del_catalogo_fijo` |
| backend | `backend/tests/test_exercises.py` | `test_borrar_ejercicio_nunca_usado_devuelve_204_y_lo_saca_del_catalogo` |
| backend | `backend/tests/test_exercises.py` | `test_borrar_ejercicio_usado_en_plantilla_devuelve_409` |
| backend | `backend/tests/test_exercises.py` | `test_borrar_ejercicio_con_solo_el_vinculo_automatico_de_dia_esta_permitido` |
| backend | `backend/tests/test_exercises.py` | `test_endpoints_de_ejercicios_sin_sesion_devuelve_401_y_con_rol_member_403` |
| backend | `backend/tests/test_exercises.py` | `test_seed_vincula_los_ejercicios_de_pierna_a_los_grupos_musculares_nuevos` |
| backend | `backend/tests/test_exercise_media.py` | `test_subir_archivo_guarda_la_key_y_devuelve_url_prefirmada` |
| backend | `backend/tests/test_exercise_media.py` | `test_subir_archivo_mas_grande_que_el_limite_devuelve_413_y_no_escribe_en_storage` |
| backend | `backend/tests/test_exercise_media.py` | `test_archivo_de_exactamente_el_limite_se_acepta` |
| backend | `backend/tests/test_exercise_media.py` | `test_subir_formato_no_permitido_devuelve_415_y_conserva_la_media_anterior` |
| backend | `backend/tests/test_exercise_media.py` | `test_reemplazar_el_archivo_borra_el_objeto_anterior_despues_del_commit` |
| backend | `backend/tests/test_exercise_media.py` | `test_desactivar_ejercicio_no_borra_el_objeto_del_storage` |
| backend | `backend/tests/test_exercise_media.py` | `test_borrar_ejercicio_con_archivo_propio_elimina_el_objeto_del_storage` |
| backend | `backend/tests/test_exercise_media.py` | `test_archivo_propio_tiene_prioridad_sobre_la_url_externa_en_media_kind` |
| backend | `backend/tests/test_exercise_media.py` | `test_quitar_el_archivo_propio_deja_la_url_externa_como_principal` |
| backend | `backend/tests/test_exercise_media.py` | `test_fallo_del_storage_al_subir_devuelve_502_y_conserva_el_archivo_anterior` |
| backend | `backend/tests/test_storage.py` | `test_s3_object_storage_presigna_sin_red` |
| backend | `backend/tests/test_storage.py` | `test_presigna_contra_el_endpoint_publico_y_opera_contra_el_interno` |
| frontend | `frontend/src/pages/__tests__/Exercises.test.tsx` | `muestra el listado con grupo muscular y tipos de entrenamiento` |
| frontend | `frontend/src/pages/__tests__/Exercises.test.tsx` | `filtra por grupo muscular al elegirlo en el selector` |
| frontend | `frontend/src/pages/__tests__/Exercises.test.tsx` | `crea un ejercicio y sube el archivo de media en la misma confirmación` |
| frontend | `frontend/src/pages/__tests__/Exercises.test.tsx` | `muestra el archivo propio cuando el ejercicio tiene archivo y URL externa` |
| frontend | `frontend/src/pages/__tests__/Exercises.test.tsx` | `ofrece desactivar en vez de borrar cuando el ejercicio está en uso` |
| frontend | `frontend/src/pages/__tests__/Routines.test.tsx` | `ofrece la entrada a Ejercicios desde el header` |
| manual | — | `make docker-up` **sobre una máquina sin tocar `/etc/hosts`**; abrir `http://localhost:9001` y confirmar que existe el bucket `gymapp-media`; en `http://localhost:5173/exercises` crear un ejercicio con grupo `Cuádriceps` y tipo `Fuerza`, subir un mp4 de ~5 MB, recargar la página y verificar que el video reproduce y hace seek, y que la URL del `<video>` apunta a `localhost:9000` (D3.1). |
| manual | — | Sobre una base con el seed viejo: `make migrate`, después `DELETE FROM exercises WHERE id NOT LIKE 'custom-%'`, y abrir `http://localhost:5173/routines` — el Día 4 vuelve a listar sus ejercicios de pierna y en `/exercises` los `legs-*` muestran `Cuádriceps`/`Isquios`/`Gemelos`. |
| manual | — | En Railway: `railway run alembic upgrade head`, reseedear el catálogo (D10 paso 5), y desde otro browser subir un mp4 a un ejercicio y reproducirlo (valida credenciales, path-style y acceso prefirmado del bucket gestionado). |

## Open Questions

Los siete supuestos que tomó este design quedaron **cerrados** antes de escribir `tasks.md`. Se
dejan anotados porque explican por qué el diseño es como es:

- **S1 — confirmado por el usuario y ya volcado a la spec.** `DELETE /exercises/{id}` existe para
  ejercicios que **nunca** se usaron, y el vínculo automático `TrainingDayExercise` (generado por
  el seed a partir del grupo muscular) **no** cuenta como uso; "uso" es plantilla de rutina o
  sesión/registro del miembro. Si el ejercicio borrado tenía archivo propio, el objeto se elimina
  del storage. Ver el requirement "Borrar un ejercicio que nunca se usó" y sus 4 escenarios en
  `specs/exercise-catalog/spec.md`.
- **S2 — aceptado, y revisado bajo la regla de BETA.** `PUT /routines/exercises/{id}` **no** se
  mantiene por compatibilidad: se mantiene porque `EditExerciseBaseDialog` y
  `AdjustExerciseBaseDialog` siguen vivos **después** de este change, y siguen vivos porque la base
  (`base_sets`/`base_reps`/`base_weight_kg`) no se deprecia — el motor de estrategias la deriva
  hasta que llegue el editor de series explícitas en R-4. Es una dependencia funcional real, no un
  reflejo de compatibilidad. Lo que sí es cambio limpio y se hace acá: achicarlo a los tres campos
  de base y retirar `POST /routines/exercises`, para que no queden dos escritores del catálogo.
  Queda owner-only: el cambio de permisos a Dueño + Coach es sobre el catálogo, no sobre la base.
- **S3 — abierto a propósito, pero con dueño.** Los nombres exactos de las variables que Railway
  expone para su Storage Bucket no se pueden confirmar desde el repo. No queda como supuesto
  silencioso: es una **task explícita** (grupo 9) que obliga a verificar con `railway variables` y
  a dejar el mapeo real anotado.
- **S4 — aceptado.** La entrada a Ejercicios va en el header de Rutinas y **no** en el Sidebar.
- **S5 — aceptado.** La URL externa se valida solo como URL `http(s)` bien formada (es lo que pide
  el requirement "Validación de la URL externa"); no se verifica que responda ni que sea de un
  dominio conocido.
- **S6 — aceptado.** Al reemplazar el archivo de un ejercicio no se conserva ninguna versión
  anterior: no hay historial de media.
- **S7 — aceptado.** El listado de ejercicios pagina (`limit`/`offset`, default 50) como el de
  Planes.

Queda **una** inconsistencia menor detectada en la spec, que no cambia el diseño y no se corrige
acá porque `specs/` es del Product Owner: el escenario "Filtrar por grupo muscular" de
`specs/exercise-catalog/spec.md` usa **"Piernas"** como ejemplo, que no pertenece a la lista fija
declarada dos requirements más arriba (se partió en `Cuádriceps` / `Isquios` / `Gemelos`, ver D9).
Los tests usan un valor de la lista fija.
