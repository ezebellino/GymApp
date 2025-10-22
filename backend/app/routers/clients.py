from fastapi import APIRouter, HTTPException, Depends, Query, status, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import or_, func

from .. import models, schemas
from ..deps import get_db
from ..auth import get_current_user, require_role
from ..models import UserRole

router = APIRouter(
    prefix="/clients",
    tags=["clients"],
)

@router.get("/{client_id}", response_model=schemas.ClientOut, name="clients:get_one")
def get_client(client_id: str, db: Session = Depends(get_db)):
    obj = db.get(models.Client, client_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")
    return obj

@router.post(
    "/",
    response_model=schemas.ClientOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))]
)
def create_client(
    payload: schemas.ClientCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    obj = models.Client(**payload.model_dump(), created_by_user_id=current_user.id)
    db.add(obj)
    db.commit()          # si salta IntegrityError, la captura el handler global y get_db hace rollback
    db.refresh(obj)

    location = request.url_for("clients:get_one", client_id=obj.id)
    response.headers["Location"] = str(location)
    return schemas.ClientOut.model_validate(obj)

@router.get("/", response_model=List[schemas.ClientOut])
def list_clients(
    response: Response,
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="Busca por nombre, email o teléfono"),
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort: str = Query("full_name.asc", regex=r"^(full_name|join_date)\.(asc|desc)$"),
):
    # 1) armo filtros
    filters = []
    if q:
        like = f"%{q}%"
        filters.append(
            or_(
                models.Client.full_name.ilike(like),
                models.Client.email.ilike(like),
                models.Client.phone.ilike(like),
            )
        )

    # 2) base query con filtros
    base_q = db.query(models.Client).filter(*filters)

    # 3) total (para paginación)
    total = base_q.count()  # SELECT count(*) FROM (...) con los mismos filtros
    response.headers["X-Total-Count"] = str(total)

    # 4) orden
    field, direction = sort.split(".")
    col = getattr(models.Client, field)
    ordered_q = base_q.order_by(col.asc() if direction == "asc" else col.desc())

    # 5) paginación
    items = ordered_q.offset(offset).limit(limit).all()
    return items

@router.patch(
    "/{client_id}",
    response_model=schemas.ClientOut,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))]
)
def update_client(client_id: str, payload: schemas.ClientUpdate, db: Session = Depends(get_db)):
    obj = db.get(models.Client, client_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)

    db.commit()   # IntegrityError -> handler global (409), rollback automático por get_db
    db.refresh(obj)
    return obj

@router.delete(
    "/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(UserRole.owner))]
)
def delete_client(client_id: str, db: Session = Depends(get_db)):
    obj = db.get(models.Client, client_id)
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")
    db.delete(obj)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/{client_id}/status", response_model=schemas.ClientStatus)
def client_status(client_id: str, db: Session = Depends(get_db)):
    client = db.get(models.Client, client_id)
    if not client:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")

    last_pay = (
        db.query(models.Payment)
          .filter(models.Payment.client_id == client_id)
          .order_by(models.Payment.period_year.desc(), models.Payment.period_month.desc())
          .first()
    )

    # tu lógica actual:
    from ..utils import current_period
    cur_m, cur_y = current_period()
    is_up_to_date = False
    last_m = last_y = None
    if last_pay:
        last_m, last_y = last_pay.period_month, last_pay.period_year
        is_up_to_date = (last_y > cur_y) or (last_y == cur_y and last_m >= cur_m)

    return schemas.ClientStatus(
        client_id=client.id,
        full_name=client.full_name,
        is_up_to_date=is_up_to_date,
        last_payment_month=last_m,
        last_payment_year=last_y,
    )
