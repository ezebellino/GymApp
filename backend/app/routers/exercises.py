"""Catálogo de ejercicios (`exercise-catalog`).

Router dueño del catálogo (`/exercises`): CRUD con nombre único, listas fijas de
grupo muscular y tipos de entrenamiento (design D1/D2), media independiente
(archivo propio + URL externa, design D3/D4/D5/D6) y autorización a nivel router
para Dueño y Coach (design D7, delta `staff-endpoint-authorization`).

Reusa el patrón de `membership_plans.py`: `_normalize_name` (NFC + strip +
casefold en Python, no `lower()` de SQL), `_check_name_collision` +
traducción de `IntegrityError` a 409 para la carrera concurrente, `X-Total-Count`
sin `Link`.
"""

import logging
import unicodedata
from datetime import datetime
from typing import Annotated, Optional
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from pydantic import Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_role
from ..config import settings
from ..deps import get_db, get_storage
from ..models import UserRole
from ..storage import ObjectStorage

router = APIRouter(
    prefix="/exercises",
    tags=["exercises"],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)

log = logging.getLogger("request")


# --- Helpers de nombre único (portado de membership_plans.py, design D7) ----


def _normalize_name(name: str) -> str:
    """NFC + strip + casefold, hecho en Python (no `lower()` de SQL: el `lower()`
    de SQLite es ASCII-only y se comportaría distinto de Postgres con las tildes
    de este catálogo)."""
    return unicodedata.normalize("NFC", name).strip().casefold()


def _check_name_collision(db: Session, name_normalized: str, *, exclude_id: str | None = None) -> None:
    query = db.query(models.Exercise).filter(models.Exercise.name_normalized == name_normalized)
    if exclude_id:
        query = query.filter(models.Exercise.id != exclude_id)
    if query.first() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un ejercicio con ese nombre")


def _commit_or_conflict_on_name(db: Session) -> None:
    """`_check_name_collision` es un chequeo previo (TOCTOU): dos requests
    concurrentes pueden pasarlo las dos y pisarse en el `commit`. El índice único
    de `name_normalized` es la defensa real; acá se traduce su `IntegrityError` al
    mismo 409, y cualquier otro `IntegrityError` escala tal cual (mismo criterio
    que `membership_plans.py`)."""
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        if "name_normalized" not in str(getattr(error, "orig", error)):
            raise
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un ejercicio con ese nombre") from error


def _get_exercise_or_404(db: Session, exercise_id: str) -> models.Exercise:
    exercise = db.get(models.Exercise, exercise_id)
    if not exercise:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ejercicio no encontrado")
    return exercise


def _exercise_in_use(db: Session, exercise_id: str) -> bool:
    """Requirement "Borrar un ejercicio que nunca se usó": solo cuenta como uso
    estar agregado a un día de plantilla, tener un registro de entrenamiento, o
    tener un ajuste de base por cliente."""
    return (
        db.query(models.RoutineTemplateDayExercise.id)
        .filter(models.RoutineTemplateDayExercise.exercise_id == exercise_id)
        .first()
        is not None
        or db.query(models.WorkoutLog.id).filter(models.WorkoutLog.exercise_id == exercise_id).first()
        is not None
        or db.query(models.RoutineAssignmentBase.id)
        .filter(models.RoutineAssignmentBase.exercise_id == exercise_id)
        .first()
        is not None
    )


def _set_training_types(db: Session, exercise_id: str, training_types: list[models.TrainingType]) -> None:
    """Reemplaza el set completo (`DELETE` + `INSERT`, design D2/D7): un
    `PATCH` con `training_types` deja exactamente ese set, no lo mergea."""
    db.query(models.ExerciseTrainingType).filter(
        models.ExerciseTrainingType.exercise_id == exercise_id
    ).delete()
    for sort_order, training_type in enumerate(training_types):
        db.add(
            models.ExerciseTrainingType(
                exercise_id=exercise_id,
                training_type=training_type.value,
                sort_order=sort_order,
            )
        )


def _serialize_exercise(exercise: models.Exercise, *, storage: ObjectStorage) -> schemas.ExerciseOut:
    """`media_kind` deriva la prioridad archivo propio > URL externa > ninguno
    (design D3/D6): la UI no reimplementa esta regla, solo la lee."""
    media_kind: Optional[str] = None
    media_file_url: Optional[str] = None
    if exercise.media_object_key:
        media_kind = "file"
        media_file_url = storage.presigned_get_url(exercise.media_object_key)
    elif exercise.external_media_url:
        media_kind = "external"

    training_types = [
        models.TrainingType(link.training_type)
        for link in sorted(exercise.training_types, key=lambda link: link.sort_order)
    ]

    return schemas.ExerciseOut(
        id=exercise.id,
        name=exercise.name,
        description=exercise.description,
        muscle_group=models.MuscleGroup(exercise.muscle_group) if exercise.muscle_group else None,
        training_types=training_types,
        is_active=exercise.is_active,
        external_media_url=exercise.external_media_url,
        media_kind=media_kind,
        media_file_url=media_file_url,
        media_content_type=exercise.media_content_type,
        media_filename=exercise.media_filename,
        media_size_bytes=exercise.media_size_bytes,
    )


# --- Endpoints ----------------------------------------------------------------


@router.get("/meta", response_model=schemas.ExerciseMetaOut)
def get_exercise_meta():
    """Única fuente de verdad de las listas fijas (design D7): derivada directo
    de los enums de Python, para que el frontend no las duplique y quede
    expuesto a drift silencioso."""
    return schemas.ExerciseMetaOut(
        muscle_groups=list(models.MuscleGroup),
        training_types=list(models.TrainingType),
    )


@router.get("/", response_model=list[schemas.ExerciseOut])
def list_exercises(
    response: Response,
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
    q: Optional[str] = Query(None, description="Busca por nombre"),
    muscle_group: Optional[models.MuscleGroup] = Query(None),
    training_type: Optional[models.TrainingType] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: Annotated[int, Field(ge=1, le=200)] = 50,
    offset: Annotated[int, Field(ge=0)] = 0,
):
    query = db.query(models.Exercise)
    if q:
        query = query.filter(models.Exercise.name.ilike(f"%{q}%"))
    if muscle_group is not None:
        query = query.filter(models.Exercise.muscle_group == muscle_group.value)
    if training_type is not None:
        # `training_type` resuelto con un `EXISTS` sobre la tabla de asociación
        # (task 4.6), no un JOIN: evita duplicar filas de `Exercise` cuando el
        # ejercicio tiene varios tipos.
        query = query.filter(
            db.query(models.ExerciseTrainingType)
            .filter(
                models.ExerciseTrainingType.exercise_id == models.Exercise.id,
                models.ExerciseTrainingType.training_type == training_type.value,
            )
            .exists()
        )
    if is_active is not None:
        query = query.filter(models.Exercise.is_active == is_active)

    total = query.with_entities(func.count(models.Exercise.id)).scalar()
    response.headers["X-Total-Count"] = str(total)

    exercises = query.order_by(models.Exercise.name.asc()).offset(offset).limit(limit).all()
    return [_serialize_exercise(exercise, storage=storage) for exercise in exercises]


@router.get("/{exercise_id}", response_model=schemas.ExerciseOut)
def get_exercise(
    exercise_id: str,
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
):
    exercise = _get_exercise_or_404(db, exercise_id)
    return _serialize_exercise(exercise, storage=storage)


@router.post("/", response_model=schemas.ExerciseOut, status_code=status.HTTP_201_CREATED)
def create_exercise(
    payload: schemas.ExerciseCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
):
    name_normalized = _normalize_name(payload.name)
    _check_name_collision(db, name_normalized)

    # Prefijo `custom-` (mismo criterio que el endpoint retirado): así el
    # `DELETE FROM exercises WHERE id NOT LIKE 'custom-%'` del reseed (design D9)
    # no se lleva puestos los ejercicios que carga el staff.
    exercise = models.Exercise(
        id=f"custom-{uuid4()}",
        name=payload.name,
        name_normalized=name_normalized,
        description=payload.description,
        muscle_group=payload.muscle_group.value if payload.muscle_group else None,
        external_media_url=payload.external_media_url,
        is_active=True,
    )
    db.add(exercise)
    db.flush()
    _set_training_types(db, exercise.id, payload.training_types)
    _commit_or_conflict_on_name(db)
    db.refresh(exercise)

    location = request.url_for("get_exercise", exercise_id=exercise.id)
    response.headers["Location"] = str(location)
    return _serialize_exercise(exercise, storage=storage)


@router.patch("/{exercise_id}", response_model=schemas.ExerciseOut)
def update_exercise(
    exercise_id: str,
    payload: schemas.ExerciseUpdate,
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
):
    exercise = _get_exercise_or_404(db, exercise_id)
    updates = payload.model_dump(exclude_unset=True)

    if "name" in updates:
        name_normalized = _normalize_name(payload.name)
        _check_name_collision(db, name_normalized, exclude_id=exercise.id)
        exercise.name = payload.name
        exercise.name_normalized = name_normalized

    if "description" in updates:
        exercise.description = payload.description

    if "muscle_group" in updates:
        exercise.muscle_group = payload.muscle_group.value if payload.muscle_group else None

    if "external_media_url" in updates:
        exercise.external_media_url = payload.external_media_url

    if "training_types" in updates:
        _set_training_types(db, exercise.id, payload.training_types or [])

    _commit_or_conflict_on_name(db)
    db.refresh(exercise)
    return _serialize_exercise(exercise, storage=storage)


@router.post("/{exercise_id}/activate", response_model=schemas.ExerciseOut)
def activate_exercise(
    exercise_id: str,
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
):
    exercise = _get_exercise_or_404(db, exercise_id)
    if exercise.is_active:
        raise HTTPException(status.HTTP_409_CONFLICT, "El ejercicio ya está activo")
    exercise.is_active = True
    # `activate` no toca `day_links` (`drop-static-exercise-catalog`, design
    # D10.7): el vínculo día↔ejercicio es puramente derivado del `muscle_group`
    # y ya no tiene estado propio del que "reactivar" nada. El efecto que se
    # buscaba —que un ejercicio reactivado vuelva a ofrecerse como opción para
    # su día— lo da `Exercise.is_active` en `_offered_as_new_option` y en el
    # predicado equivalente de `routine_assignments.py`, que es donde
    # corresponde. La invariante I10 de `add-exercise-catalog` (que este
    # comentario protegía) se retira junto con el concepto que protegía —
    # `PUT /routines/days/{day_id}/selection`, sin requirement y sin
    # consumidor, se retiró en el mismo change (D10).
    db.commit()
    db.refresh(exercise)
    return _serialize_exercise(exercise, storage=storage)


@router.post("/{exercise_id}/deactivate", response_model=schemas.ExerciseOut)
def deactivate_exercise(
    exercise_id: str,
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
):
    exercise = _get_exercise_or_404(db, exercise_id)
    if not exercise.is_active:
        raise HTTPException(status.HTTP_409_CONFLICT, "El ejercicio ya está inactivo")
    # No se toca el storage ni las plantillas/sesiones que ya lo referencian
    # (design D6, invariante I5): solo se lo saca del listado activo y de las
    # opciones para agregar a una plantilla nueva. Ya no apaga los `day_links`
    # (`drop-static-exercise-catalog`, design D10.7): no hay nada que apagar —
    # el vínculo es puramente derivado y "un ejercicio desactivado no se
    # ofrece" lo da `Exercise.is_active` en `_offered_as_new_option` y en el
    # predicado equivalente del plan del Miembro.
    exercise.is_active = False
    db.commit()
    db.refresh(exercise)
    return _serialize_exercise(exercise, storage=storage)


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exercise(
    exercise_id: str,
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
):
    exercise = _get_exercise_or_404(db, exercise_id)
    if _exercise_in_use(db, exercise_id):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "El ejercicio está en uso (plantillas o registros de entrenamiento). "
            "Desactivalo en su lugar.",
        )

    media_key = exercise.media_object_key
    db.delete(exercise)
    db.commit()

    # Borrado del objeto **después** del commit (design D6, invariante I3):
    # best-effort, nunca convierte una falla de storage en un 500 de un borrado
    # que ya se aplicó.
    if media_key:
        storage.delete_object(media_key)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Media (design D4/D5/D6) --------------------------------------------------

_ALLOWED_MEDIA_CONTENT_TYPES = {"video/mp4", "image/gif", "image/jpeg", "image/png"}
_EXTENSION_BY_CONTENT_TYPE = {
    "video/mp4": "mp4",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
}

def _sniff_media_content_type(head: bytes) -> Optional[str]:
    """Firma de los primeros bytes contra el formato real (design D4), cruzada
    después con el `content_type` declarado por el cliente."""
    if len(head) >= 8 and head[4:8] == b"ftyp":
        return "video/mp4"
    if head.startswith(b"GIF8"):
        return "image/gif"
    if head.startswith(b"\xff\xd8"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG"):
        return "image/png"
    return None


@router.post("/{exercise_id}/media", response_model=schemas.ExerciseOut)
async def upload_exercise_media(
    exercise_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
    current_user: models.User = Depends(get_current_user),
):
    """Task 12.10 (H7, design D4.1): reescrita. La versión anterior chequeaba
    `Content-Length` antes de leer el cuerpo, como si fuera un atajo barato —
    pero con `file: UploadFile = File(...)`, Starlette ya parseó el multipart
    completo (a un `SpooledTemporaryFile` en disco, umbral 1 MB) durante la
    resolución de dependencias, **antes** de que corra la primera línea de acá:
    ese chequeo no ahorraba nada. Peor, el `Content-Length` del request incluye
    los boundaries del multipart, así que un archivo de exactamente
    `STORAGE_MAX_UPLOAD_BYTES` se rechazaba por unos cientos de bytes de más.
    También se retira el bucle que acumulaba `chunks: list[bytes]` +
    `b"".join(chunks)`: materializaba el archivo entero en RAM (pico de ~50 MB
    por subida concurrente de 25 MB) cuando Starlette ya lo tenía en disco.

    Queda: `file.size` (exacto, sin overhead de boundaries) contra el límite ⇒
    413; se leen 16 bytes para el sniff de magic bytes; `seek(0)` para no
    perder esos bytes; y se pasa `file.file` (el `SpooledTemporaryFile`) directo
    a `upload_fileobj`, que lo streamea sin cargarlo entero en memoria. Limitación
    conocida y aceptada (D4.1): una subida de 2 GB igual se recibe entera antes
    de este 413 — eso lo resuelve Starlette, no este endpoint, y no es un bug de
    esta implementación."""
    exercise = _get_exercise_or_404(db, exercise_id)

    # 1. `file.size` > límite ⇒ 413, antes de tocar el storage (design D4.1).
    if file.size is not None and file.size > settings.STORAGE_MAX_UPLOAD_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            "El archivo supera el tamaño máximo permitido",
        )

    # 2. Sniff de magic bytes cruzado con el content-type declarado (design D4,
    # paso 3) ⇒ 415 si no coinciden. La media anterior queda intacta: no se
    # escribió nada todavía. `seek(0)` deja el archivo listo para streamear
    # completo en el paso 3.
    head = await file.read(16)
    await file.seek(0)
    declared_content_type = file.content_type
    detected_content_type = _sniff_media_content_type(head)
    if (
        declared_content_type not in _ALLOWED_MEDIA_CONTENT_TYPES
        or detected_content_type is None
        or detected_content_type != declared_content_type
    ):
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Formato de archivo no soportado",
        )

    extension = _EXTENSION_BY_CONTENT_TYPE[declared_content_type]
    key = f"exercises/{exercise_id}/{uuid4()}.{extension}"

    # 3. Recién acá `put_object` (design D4, paso 4), streameando `file.file`
    # (el `SpooledTemporaryFile` de Starlette) en vez de un `BytesIO` armado a
    # mano: nunca hay una copia completa del archivo en un `bytes` de Python.
    # El adaptador S3 traduce una falla de red/credenciales a 502 (design
    # D6/D8), que deja la media anterior sin tocar porque el `UPDATE` todavía
    # no corrió.
    storage.put_object(key, file.file, declared_content_type)

    old_key = exercise.media_object_key
    exercise.media_object_key = key
    exercise.media_content_type = declared_content_type
    exercise.media_size_bytes = file.size
    exercise.media_filename = file.filename
    exercise.media_uploaded_at = datetime.utcnow()
    exercise.media_uploaded_by_user_id = current_user.id
    db.commit()
    db.refresh(exercise)

    # El borrado de la key vieja va **después** del commit (design D6,
    # invariante I3), best-effort.
    if old_key:
        storage.delete_object(old_key)

    return _serialize_exercise(exercise, storage=storage)


@router.delete("/{exercise_id}/media", response_model=schemas.ExerciseOut)
def delete_exercise_media(
    exercise_id: str,
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_storage),
):
    exercise = _get_exercise_or_404(db, exercise_id)
    if not exercise.media_object_key:
        raise HTTPException(status.HTTP_409_CONFLICT, "El ejercicio no tiene un archivo propio")

    old_key = exercise.media_object_key
    exercise.media_object_key = None
    exercise.media_content_type = None
    exercise.media_size_bytes = None
    exercise.media_filename = None
    exercise.media_uploaded_at = None
    exercise.media_uploaded_by_user_id = None
    db.commit()
    db.refresh(exercise)

    storage.delete_object(old_key)
    return _serialize_exercise(exercise, storage=storage)
