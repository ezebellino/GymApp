"""add exercise catalog

Migración SOLO de esquema (`exercise-catalog`, design D9): agrega a `exercises` las
columnas de media (archivo propio + URL externa, design D6) y `name_normalized`
(nombre único case/trim-insensitive, design D7), crea `exercise_training_types`
(design D2) y pasa `exercises.muscle_group` a nullable, con el remapeo de valores
legacy que exige la lista fija nueva.

**No es un backfill de rescate.** Bajo la regla de BETA de `AGENTS.md`, esta
migración remapea los dos únicos valores legacy que tienen un reemplazo exacto
(`Biceps` → `Bíceps`, `Triceps` → `Tríceps`) y manda a `NULL` todo lo que no
pertenezca a la lista fija nueva de `MuscleGroup` (incluye `Piernas`: la lista fija
la partió en `Cuádriceps`/`Isquios`/`Gemelos`, y el valor correcto depende del
ejercicio — no hay ninguna heurística que lo adivine). El paso de despliegue que
corresponde a este cambio (D9, D10) es reseedear el catálogo:

    DELETE FROM exercises WHERE id NOT LIKE 'custom-%';

y volver a entrar a Rutinas, que reconstruye el catálogo entero con los grupos
musculares correctos vía `_ensure_seed_data` (`routine_catalog.py` ya trae los
valores nuevos en este mismo change). El backfill de `name_normalized` sí es
necesario (no es un rescate): sin él la columna quedaría nula y el chequeo de
nombre único no vería los ejercicios preexistentes.

**Deduplicación de `name_normalized` antes del `UNIQUE` (corrección H5 de
verificación).** `exercises.name` nunca tuvo unicidad y el endpoint retirado
`POST /routines/exercises` no la validaba, así que puede haber dos filas
`custom-*` cuyo NFC+strip+casefold coincida (por ejemplo `"Gemelos "` cargado a
mano junto al ejercicio de seed, o `"Sentadilla"` / `"sentadilla"`). Si
`create_unique_constraint` corriera contra esas filas tal cual, la migración
abortaría y, como en Railway se corre a mano (D10 paso 4), dejaría la base en la
revisión anterior con el código nuevo ya deployado. Bajo la regla de BETA de
`AGENTS.md`, la estrategia elegida es **renombrar, no descartar**: durante el
mismo backfill, la primera fila de cada grupo de duplicados conserva su nombre
tal cual; cada fila siguiente del mismo grupo se renombra agregándole el sufijo
`" (dup N)"` a `name` (y recalculando `name_normalized` sobre ese nombre nuevo).
Renombrar en vez de borrar evita perder cualquier fila que ya esté referenciada
por una plantilla, un registro de entrenamiento o un ajuste de base — borrarlas
sería más agresivo de lo que exige "no abortar el `upgrade()`", y bajo la
cascada de esas FKs se llevaría puestas filas de otras tablas sin necesidad. El
orden de "primera" es el que devuelve la consulta (no importa cuál gane,
mientras el resultado sea determinístico dentro de la corrida): a nadie le
interesa cuál de los dos duplicados quedó con el nombre original, solo que la
migración no explote y que las dos filas sigan existiendo y distinguibles.

`downgrade()` **no restaura nada**: rellena `muscle_group IS NULL` con
`'Cuerpo completo'` solo porque el `alter_column` a `nullable=False` lo exige
mecánicamente, y dropea todo lo demás. En beta, la forma correcta de volver atrás
es `downgrade` + reseed, no un camino de vuelta más fino.

Revision ID: c387dcc091c2
Revises: d5f74a834ac0
Create Date: 2026-09-12 11:31:46.922157

"""
import unicodedata
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c387dcc091c2'
down_revision: Union[str, Sequence[str], None] = 'e79526156f68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Lista fija de `MuscleGroup` (design D1), como snapshot de valores literales: una
# migración no importa `app.models` porque el enum vivo puede cambiar mañana.
_FIXED_MUSCLE_GROUPS = (
    "Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Antebrazo", "Core",
    "Glúteos", "Cuádriceps", "Isquios", "Gemelos", "Cuerpo completo",
)


def _normalize_name(name: str) -> str:
    """NFC + strip + casefold, mismo criterio que `_normalize_name` de
    `membership_plans.py` (design D7): no `lower()` de SQL, se comporta distinto
    en SQLite y Postgres justo con las tildes que este catálogo tiene por todos
    lados."""
    return unicodedata.normalize("NFC", name).strip().casefold()


def upgrade() -> None:
    """Upgrade schema."""
    # ------------------------------------------------------------------
    # 1) Columnas nuevas de `exercises`: `name_normalized` + las 7 de media
    #    (design D6). Todas nullable por ahora; `name_normalized` se vuelve
    #    NOT NULL + UNIQUE recién después del backfill (paso 2).
    # ------------------------------------------------------------------
    op.add_column("exercises", sa.Column("name_normalized", sa.String(), nullable=True))
    op.add_column("exercises", sa.Column("external_media_url", sa.String(), nullable=True))
    op.add_column("exercises", sa.Column("media_object_key", sa.String(), nullable=True))
    op.add_column("exercises", sa.Column("media_content_type", sa.String(), nullable=True))
    op.add_column("exercises", sa.Column("media_size_bytes", sa.Integer(), nullable=True))
    op.add_column("exercises", sa.Column("media_filename", sa.String(), nullable=True))
    op.add_column("exercises", sa.Column("media_uploaded_at", sa.DateTime(), nullable=True))
    op.add_column("exercises", sa.Column("media_uploaded_by_user_id", sa.String(), nullable=True))
    op.create_foreign_key(
        "fk_exercises_media_uploaded_by_user_id_users",
        "exercises",
        "users",
        ["media_uploaded_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # ------------------------------------------------------------------
    # 2) Backfill de `name_normalized` (NFC + strip + casefold) y recién después el
    #    índice UNIQUE. No es un backfill de rescate: sin esto la columna queda
    #    nula y el chequeo de nombre único no ve los ejercicios preexistentes.
    #
    #    Corrección H5: `exercises.name` nunca tuvo unicidad, así que puede haber
    #    filas cuyo normalizado coincida (típicamente `custom-*`, cargadas por el
    #    endpoint retirado que no validaba nada). Si se dejaran tal cual, el
    #    `create_unique_constraint` de abajo abortaría la migración. Estrategia
    #    (BETA, ver docstring del módulo): la primera fila de cada grupo de
    #    duplicados conserva su nombre; las siguientes se renombran agregando
    #    " (dup N)" a `name` y se recalcula `name_normalized` sobre ese nombre
    #    nuevo — nunca se borra una fila, para no arrastrar en cascada lo que ya
    #    la referencie.
    # ------------------------------------------------------------------
    bind = op.get_bind()
    exercises_table = sa.table(
        "exercises",
        sa.column("id", sa.String()),
        sa.column("name", sa.String()),
        sa.column("name_normalized", sa.String()),
    )
    rows = bind.execute(sa.select(exercises_table.c.id, exercises_table.c.name)).fetchall()
    seen_normalized: dict[str, str] = {}  # normalized -> primer exercise_id que lo usó
    duplicate_counts: dict[str, int] = {}
    for exercise_id, name in rows:
        normalized = _normalize_name(name)
        final_name = name
        if normalized in seen_normalized:
            # Ya hay una fila con este normalizado: renombrar esta (nunca la
            # primera vista), reintentando el sufijo si por mala suerte
            # también colisiona con otro nombre ya normalizado.
            while normalized in seen_normalized:
                duplicate_counts[normalized] = duplicate_counts.get(normalized, 0) + 1
                final_name = f"{name} (dup {duplicate_counts[normalized]})"
                normalized = _normalize_name(final_name)
        seen_normalized[normalized] = exercise_id
        op.execute(
            exercises_table.update()
            .where(exercises_table.c.id == exercise_id)
            .values(name=final_name, name_normalized=normalized)
        )
    op.alter_column("exercises", "name_normalized", nullable=False)
    op.create_unique_constraint(
        "uq_exercises_name_normalized", "exercises", ["name_normalized"]
    )

    # ------------------------------------------------------------------
    # 3) Tabla de asociación de tipos de entrenamiento (design D2). PK compuesta:
    #    la fila es el par, no tiene identidad propia.
    # ------------------------------------------------------------------
    op.create_table(
        "exercise_training_types",
        sa.Column("exercise_id", sa.String(), nullable=False),
        sa.Column("training_type", sa.String(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["exercise_id"], ["exercises.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("exercise_id", "training_type"),
    )
    op.create_index(
        "ix_exercise_training_types_training_type",
        "exercise_training_types",
        ["training_type"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # 4) `muscle_group` pasa a nullable (0..1, opcional por spec — design D1).
    # ------------------------------------------------------------------
    op.alter_column("exercises", "muscle_group", existing_type=sa.String(), nullable=True)

    # ------------------------------------------------------------------
    # 5) Remapeo de valores legacy con literales, sin heurísticas ni mapeos por id
    #    (design D9): `Biceps` → `Bíceps`, `Triceps` → `Tríceps`, y todo lo que no
    #    quede en la lista fija nueva → NULL (incluye `Piernas`).
    # ------------------------------------------------------------------
    exercises_muscle_table = sa.table(
        "exercises", sa.column("muscle_group", sa.String())
    )
    op.execute(
        exercises_muscle_table.update()
        .where(exercises_muscle_table.c.muscle_group == "Biceps")
        .values(muscle_group="Bíceps")
    )
    op.execute(
        exercises_muscle_table.update()
        .where(exercises_muscle_table.c.muscle_group == "Triceps")
        .values(muscle_group="Tríceps")
    )
    op.execute(
        exercises_muscle_table.update()
        .where(exercises_muscle_table.c.muscle_group.notin_(_FIXED_MUSCLE_GROUPS))
        .values(muscle_group=None)
    )


def downgrade() -> None:
    """Downgrade schema. No restaura nada (design D9): media, tipos y el string
    legacy de `muscle_group` se pierden. La forma correcta de volver atrás en beta
    es este downgrade + reseedear el catálogo, no un camino de vuelta más fino."""
    # Necesidad mecánica: `alter_column` a `nullable=False` falla si queda alguna
    # fila NULL.
    exercises_muscle_table = sa.table(
        "exercises", sa.column("muscle_group", sa.String())
    )
    op.execute(
        exercises_muscle_table.update()
        .where(exercises_muscle_table.c.muscle_group.is_(None))
        .values(muscle_group="Cuerpo completo")
    )
    op.alter_column("exercises", "muscle_group", existing_type=sa.String(), nullable=False)

    op.drop_index(
        "ix_exercise_training_types_training_type", table_name="exercise_training_types"
    )
    op.drop_table("exercise_training_types")

    op.drop_constraint("uq_exercises_name_normalized", "exercises", type_="unique")

    op.drop_constraint(
        "fk_exercises_media_uploaded_by_user_id_users", "exercises", type_="foreignkey"
    )
    op.drop_column("exercises", "media_uploaded_by_user_id")
    op.drop_column("exercises", "media_uploaded_at")
    op.drop_column("exercises", "media_filename")
    op.drop_column("exercises", "media_size_bytes")
    op.drop_column("exercises", "media_content_type")
    op.drop_column("exercises", "media_object_key")
    op.drop_column("exercises", "external_media_url")
    op.drop_column("exercises", "name_normalized")
