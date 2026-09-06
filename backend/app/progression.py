"""Motor de cálculo de series de progresión (`progression-strategies`).

Función pura y determinística (invariante I3): sin imports de SQLAlchemy ni de
FastAPI, sin acceso a base de datos, red ni reloj. Mismo `(estrategia, sets, reps,
kg)` produce siempre el mismo resultado.

Aritmética con `Decimal` y redondeo half-up explícito, no `round()` de Python:
`round()` usa banker's rounding (`round(8.5) == 8`, no 9) y los floats de por medio
introducen ruido (`14 * 1.06 == 14.839999999999998`). Ver design.md decisión D4 y
`test_el_redondeo_de_medio_paso_va_para_arriba` en `tests/test_progression.py`.
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from .models import ProgressionStrategy

# --- Constantes del sistema ("Parámetros de las estrategias como constantes del
# sistema"): iguales para todo el gimnasio y para todos los ejercicios. Ningún
# endpoint las escribe — la spec prohíbe exponer una UI para editarlas. -----------
ROUND_STEP_KG = Decimal("2.5")
PYRAMID_RATE = Decimal("0.06")
INVERTED_RATE = Decimal("0.06")
INVERTED_REPS_STEP = 2
MIN_REPS_PYRAMID = 3
MIN_REPS_REST_PAUSE = 1
MIN_WEIGHT_KG = Decimal("2.5")
DROP_SET_WEIGHT_FACTOR = Decimal("0.8")
DROP_SET_REPS_FACTOR = Decimal("1.5")
REST_PAUSE_SECONDS = 20

_PAUSE_NOTE = f"{REST_PAUSE_SECONDS} s"
_FAILURE_NOTE = "al fallo"


@dataclass(frozen=True)
class PlannedSet:
    index: int  # 1-based
    weight_kg: float
    reps: int
    note: str | None = None


def round_to_weight_step(value: Decimal, step: Decimal = ROUND_STEP_KG) -> Decimal:
    """Redondea `value` al múltiplo de `step` más cercano, half-up explícito.

    `round()` de Python redondea la mitad al par más cercano ("banker's rounding"):
    `round(Decimal("8.5")) == 8`. Acá la mitad siempre sube (`ROUND_HALF_UP`), como
    exige la spec para el paso de redondeo de peso y para `1,5 × R` de Drop set.
    """
    quotient = (value / step).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return quotient * step


def _round_half_up_int(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def plan_sets(
    strategy: ProgressionStrategy,
    *,
    sets: int,
    reps: int,
    weight_kg: float,
) -> list[PlannedSet]:
    """Calcula el plan de series para una base (S series × R reps · P kg) y una
    estrategia. `sets <= 0` (base inválida, imposible en la práctica: 422 en el
    endpoint de base) devuelve lista vacía en vez de romper — único borde que las
    specs no nombran (design D4).
    """
    if sets <= 0:
        return []

    base_weight = Decimal(str(weight_kg))

    if strategy == ProgressionStrategy.constant:
        return [
            PlannedSet(index=i + 1, weight_kg=float(base_weight), reps=reps)
            for i in range(sets)
        ]

    if strategy == ProgressionStrategy.pyramid:
        planned = []
        for i in range(sets):
            weight = round_to_weight_step(base_weight * (Decimal("1") + PYRAMID_RATE * i))
            set_reps = max(reps - 2 * i, MIN_REPS_PYRAMID)
            planned.append(PlannedSet(index=i + 1, weight_kg=float(weight), reps=set_reps))
        return planned

    if strategy == ProgressionStrategy.inverted:
        planned = []
        for i in range(sets):
            weight = round_to_weight_step(base_weight * (Decimal("1") - INVERTED_RATE * i))
            weight = max(weight, MIN_WEIGHT_KG)
            set_reps = reps + INVERTED_REPS_STEP * i
            planned.append(PlannedSet(index=i + 1, weight_kg=float(weight), reps=set_reps))
        return planned

    if strategy == ProgressionStrategy.drop_set:
        planned = [
            PlannedSet(index=i + 1, weight_kg=float(base_weight), reps=reps)
            for i in range(sets - 1)
        ]
        last_weight = round_to_weight_step(base_weight * DROP_SET_WEIGHT_FACTOR)
        last_reps = _round_half_up_int(Decimal(reps) * DROP_SET_REPS_FACTOR)
        planned.append(
            PlannedSet(index=sets, weight_kg=float(last_weight), reps=last_reps, note=_FAILURE_NOTE)
        )
        return planned

    if strategy == ProgressionStrategy.rest_pause:
        planned = []
        for i in range(sets):
            set_reps = max(reps - i, MIN_REPS_REST_PAUSE)
            note = _PAUSE_NOTE if i >= 1 else None
            planned.append(PlannedSet(index=i + 1, weight_kg=float(base_weight), reps=set_reps, note=note))
        return planned

    raise ValueError(f"Estrategia de progresión desconocida: {strategy!r}")
