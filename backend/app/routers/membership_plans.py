"""Planes de membresía (`membership-plans`).

Nueva entidad `MembershipPlan` + historial append-only de precios
(`MembershipPlanPrice`, ver design D1, invariante I1): cambiar el precio de un plan
solo agrega una fila nueva, nunca edita ni borra una anterior. CRUD para staff
(Dueño/Coach): crear, editar nombre/descripción, agregar precio, activar/desactivar.
Sin `DELETE` (ver design D2): desactivar cubre la necesidad real y el `ON DELETE
RESTRICT` de las FK defiende la base.
"""

import unicodedata
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import Annotated, List, Optional
from pydantic import Field

from .. import models, schemas
from ..auth import get_current_user, require_role
from ..deps import get_db
from ..models import UserRole

router = APIRouter(
    prefix="/membership-plans",
    tags=["membership-plans"],
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))],
)


# --- Helpers de nombre único (mismo patrón que routine_templates.py, design D1) ---


def _normalize_name(name: str) -> str:
    """NFC + strip + casefold, hecho en Python (no `lower()` de SQL: ver design D1
    de `membership-plans` y `add-routine-templates`)."""
    return unicodedata.normalize("NFC", name).strip().casefold()


def _check_name_collision(db: Session, name_normalized: str, *, exclude_id: str | None = None) -> None:
    query = db.query(models.MembershipPlan).filter(
        models.MembershipPlan.name_normalized == name_normalized
    )
    if exclude_id:
        query = query.filter(models.MembershipPlan.id != exclude_id)
    if query.first() is not None:
        raise HTTPException(status_code=409, detail="Ya existe un plan con ese nombre")


def _is_name_uniqueness_violation(error: IntegrityError) -> bool:
    """Distingue el `IntegrityError` del índice único de `name_normalized` (la
    única constraint que hoy puede dispararse en estos commits) de cualquier
    otro. Inspecciona `e.orig.diag.constraint_name` cuando está disponible
    (psycopg2/Postgres, donde el índice sin nombre explícito se llama
    `membership_plans_name_normalized_key`) y cae a buscar el nombre de
    columna en el mensaje de error para el resto de backends (SQLite en
    tests, que reporta "UNIQUE constraint failed: membership_plans.
    name_normalized" sin `diag`). Hallazgo 2 de la segunda pasada de
    verification.md: antes se traducía CUALQUIER `IntegrityError` a este 409,
    incluido uno legítimo que no tiene nada que ver con el nombre."""
    orig = getattr(error, "orig", None)
    diag = getattr(orig, "diag", None)
    constraint_name = getattr(diag, "constraint_name", None)
    if constraint_name:
        return "name_normalized" in constraint_name
    return "name_normalized" in str(orig or error)


def _commit_or_conflict_on_name(db: Session) -> None:
    """`_check_name_collision` es un chequeo previo (TOCTOU), no una garantía:
    dos requests concurrentes pueden pasarlo las dos y pisarse en el `commit`.
    El índice único (`uq...name_normalized`) es la defensa real; acá se
    traduce su `IntegrityError` al mismo 409 que ya usa el chequeo previo, en
    vez de dejarlo escalar a un 500 sin `detail` (hallazgo 3 de
    verification.md: task 2.5 pedía esto además del chequeo normalizado).
    Cualquier otro `IntegrityError` escala tal cual (hallazgo 2 de la segunda
    pasada): esta función solo se llama cuando el commit puede violar esa
    constraint puntual, nunca "por las dudas"."""
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        if not _is_name_uniqueness_violation(error):
            raise
        raise HTTPException(status_code=409, detail="Ya existe un plan con ese nombre")


def _get_plan_or_404(db: Session, plan_id: str) -> models.MembershipPlan:
    plan = db.get(models.MembershipPlan, plan_id)
    if not plan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan no encontrado")
    return plan


# --- Precio vigente sin N+1 (design D1) --------------------------------------


def current_price_for(
    db: Session, plan_ids: list[str], on: date | None = None
) -> dict[str, models.MembershipPlanPrice]:
    """Precio vigente de cada plan a la fecha `on` (hoy por default): la fila con el
    mayor `effective_from <= on`. Una sola query agregada para todos los `plan_ids`
    (subconsulta con `func.max(effective_from)`, sin `DISTINCT ON` para que corra
    igual en SQLite y Postgres). Si un plan no tiene ningún precio con
    `effective_from <= on` (todos son futuros), no aparece en el resultado.
    """
    if not plan_ids:
        return {}
    on = on or date.today()

    latest_subq = (
        select(
            models.MembershipPlanPrice.plan_id,
            func.max(models.MembershipPlanPrice.effective_from).label("max_effective_from"),
        )
        .where(
            models.MembershipPlanPrice.plan_id.in_(plan_ids),
            models.MembershipPlanPrice.effective_from <= on,
        )
        .group_by(models.MembershipPlanPrice.plan_id)
        .subquery()
    )

    rows = (
        db.query(models.MembershipPlanPrice)
        .join(
            latest_subq,
            (models.MembershipPlanPrice.plan_id == latest_subq.c.plan_id)
            & (models.MembershipPlanPrice.effective_from == latest_subq.c.max_effective_from),
        )
        .all()
    )
    return {row.plan_id: row for row in rows}


def _members_count_for(db: Session, plan_ids: list[str]) -> dict[str, int]:
    if not plan_ids:
        return {}
    rows = (
        db.query(models.User.membership_plan_id, func.count(models.User.id))
        .filter(models.User.membership_plan_id.in_(plan_ids))
        .group_by(models.User.membership_plan_id)
        .all()
    )
    return {plan_id: count for plan_id, count in rows}


def _serialize_price(price: models.MembershipPlanPrice) -> schemas.MembershipPlanPriceOut:
    return schemas.MembershipPlanPriceOut(
        id=price.id,
        amount=price.amount,
        effective_from=price.effective_from,
        created_at=price.created_at,
        created_by_user_id=price.created_by_user_id,
    )


def _serialize_plan(
    plan: models.MembershipPlan,
    *,
    current_price: models.MembershipPlanPrice | None,
    members_count: int,
) -> schemas.MembershipPlanOut:
    return schemas.MembershipPlanOut(
        id=plan.id,
        name=plan.name,
        description=plan.description,
        is_active=plan.is_active,
        current_price=_serialize_price(current_price) if current_price else None,
        members_count=members_count,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
    )


def _serialize_detail(db: Session, plan: models.MembershipPlan) -> schemas.MembershipPlanDetail:
    prices = current_price_for(db, [plan.id])
    members_count = _members_count_for(db, [plan.id]).get(plan.id, 0)
    base = _serialize_plan(plan, current_price=prices.get(plan.id), members_count=members_count)
    history = sorted(plan.prices, key=lambda price: price.effective_from, reverse=True)
    return schemas.MembershipPlanDetail(
        **base.model_dump(),
        price_history=[_serialize_price(price) for price in history],
    )


# --- Endpoints ----------------------------------------------------------------


@router.get("/", response_model=List[schemas.MembershipPlanOut])
def list_membership_plans(
    response: Response,
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="Busca por nombre"),
    is_active: Optional[bool] = Query(None),
    limit: Annotated[int, Field(ge=1, le=200)] = 50,
    offset: Annotated[int, Field(ge=0)] = 0,
):
    query = db.query(models.MembershipPlan)
    if q:
        query = query.filter(models.MembershipPlan.name.ilike(f"%{q}%"))
    if is_active is not None:
        query = query.filter(models.MembershipPlan.is_active == is_active)

    total = query.with_entities(func.count(models.MembershipPlan.id)).scalar()
    response.headers["X-Total-Count"] = str(total)

    plans = (
        query.order_by(models.MembershipPlan.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    plan_ids = [plan.id for plan in plans]
    prices = current_price_for(db, plan_ids)
    members_counts = _members_count_for(db, plan_ids)

    return [
        _serialize_plan(
            plan,
            current_price=prices.get(plan.id),
            members_count=members_counts.get(plan.id, 0),
        )
        for plan in plans
    ]


@router.get("/{plan_id}", response_model=schemas.MembershipPlanDetail)
def get_membership_plan(plan_id: str, db: Session = Depends(get_db)):
    plan = _get_plan_or_404(db, plan_id)
    return _serialize_detail(db, plan)


@router.post("/", response_model=schemas.MembershipPlanOut, status_code=status.HTTP_201_CREATED)
def create_membership_plan(
    payload: schemas.MembershipPlanCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    name_normalized = _normalize_name(payload.name)
    _check_name_collision(db, name_normalized)

    plan = models.MembershipPlan(
        name=payload.name,
        name_normalized=name_normalized,
        description=payload.description,
        is_active=True,
        created_by_user_id=current_user.id,
    )
    db.add(plan)
    db.flush()

    price = models.MembershipPlanPrice(
        plan_id=plan.id,
        amount=payload.amount,
        effective_from=date.today(),
        created_by_user_id=current_user.id,
    )
    db.add(price)
    _commit_or_conflict_on_name(db)
    db.refresh(plan)

    location = request.url_for("get_membership_plan", plan_id=plan.id)
    response.headers["Location"] = str(location)
    return _serialize_plan(plan, current_price=price, members_count=0)


@router.patch("/{plan_id}", response_model=schemas.MembershipPlanOut)
def update_membership_plan(
    plan_id: str,
    payload: schemas.MembershipPlanUpdate,
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(db, plan_id)
    updates = payload.model_dump(exclude_unset=True)
    changes_name = updates.get("name") is not None

    if changes_name:
        name_normalized = _normalize_name(updates["name"])
        _check_name_collision(db, name_normalized, exclude_id=plan.id)
        plan.name = updates["name"]
        plan.name_normalized = name_normalized

    if "description" in updates:
        plan.description = updates["description"]

    plan.updated_at = datetime.utcnow()
    # Solo un `PATCH` que toca `name` puede violar esa constraint (hallazgo 2
    # de la segunda pasada de verification.md): uno de solo `description` hace
    # un commit liso, sin la traducción a 409 de `_commit_or_conflict_on_name`.
    if changes_name:
        _commit_or_conflict_on_name(db)
    else:
        db.commit()
    db.refresh(plan)

    prices = current_price_for(db, [plan.id])
    members_count = _members_count_for(db, [plan.id]).get(plan.id, 0)
    return _serialize_plan(plan, current_price=prices.get(plan.id), members_count=members_count)


@router.post("/{plan_id}/prices", response_model=schemas.MembershipPlanPriceOut, status_code=status.HTTP_201_CREATED)
def add_membership_plan_price(
    plan_id: str,
    payload: schemas.MembershipPlanPriceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    plan = _get_plan_or_404(db, plan_id)
    effective_from = payload.effective_from or date.today()

    # Un precio retroactivo cambiaría, a posteriori, qué precio "regía" en un
    # período ya cobrado — justo lo que S5 prohíbe (design D2).
    if effective_from < date.today():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "La fecha de vigencia no puede ser anterior a hoy",
        )

    existing = (
        db.query(models.MembershipPlanPrice)
        .filter(
            models.MembershipPlanPrice.plan_id == plan.id,
            models.MembershipPlanPrice.effective_from == effective_from,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ya existe un precio con esa fecha de vigencia para este plan",
        )

    price = models.MembershipPlanPrice(
        plan_id=plan.id,
        amount=payload.amount,
        effective_from=effective_from,
        created_by_user_id=current_user.id,
    )
    db.add(price)
    db.commit()
    db.refresh(price)
    return _serialize_price(price)


@router.post("/{plan_id}/deactivate", response_model=schemas.MembershipPlanOut)
def deactivate_membership_plan(plan_id: str, db: Session = Depends(get_db)):
    plan = _get_plan_or_404(db, plan_id)
    if not plan.is_active:
        raise HTTPException(status.HTTP_409_CONFLICT, "El plan ya está inactivo")

    # I3 (hallazgo 3 de la segunda pasada de verification.md): el chequeo
    # anterior (un `SELECT count` separado del `UPDATE`) tenía una ventana
    # TOCTOU — dos desactivaciones concurrentes sobre los dos últimos planes
    # activos podían leer `active_count == 2` las dos y dejar el sistema en
    # cero planes activos. `SELECT id ... FOR UPDATE` sobre los planes activos
    # los bloquea antes de contar (sin `func.count` en la misma consulta:
    # Postgres no permite `FOR UPDATE` combinado con una agregación), así que
    # la segunda transacción concurrente espera a que la primera termine
    # (commit/rollback) y vuelve a contar ya con el UPDATE anterior aplicado.
    # SQLite (usado en tests) no tiene locking de filas real y ignora el
    # `FOR UPDATE`: esta regla se verifica por lectura de código, no se
    # reproduce con requests simultáneas de verdad (ver "Sin verificar" en
    # verification.md).
    active_plan_ids = [
        row[0]
        for row in db.query(models.MembershipPlan.id)
        .filter(models.MembershipPlan.is_active.is_(True))
        .with_for_update()
        .all()
    ]
    if len(active_plan_ids) <= 1:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "No se puede desactivar el último plan activo"
        )

    plan.is_active = False
    plan.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)

    prices = current_price_for(db, [plan.id])
    members_count = _members_count_for(db, [plan.id]).get(plan.id, 0)
    return _serialize_plan(plan, current_price=prices.get(plan.id), members_count=members_count)


@router.post("/{plan_id}/activate", response_model=schemas.MembershipPlanOut)
def activate_membership_plan(plan_id: str, db: Session = Depends(get_db)):
    plan = _get_plan_or_404(db, plan_id)
    if plan.is_active:
        raise HTTPException(status.HTTP_409_CONFLICT, "El plan ya está activo")

    plan.is_active = True
    plan.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)

    prices = current_price_for(db, [plan.id])
    members_count = _members_count_for(db, [plan.id]).get(plan.id, 0)
    return _serialize_plan(plan, current_price=prices.get(plan.id), members_count=members_count)
