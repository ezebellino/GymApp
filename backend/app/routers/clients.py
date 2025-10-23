from fastapi import APIRouter, HTTPException, Depends, Query, status, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Literal, Annotated
from sqlalchemy import or_, func
from pydantic import Field

from ..security import optional_bearer
from .. import models, schemas
from ..deps import get_db
from ..auth import get_current_user, require_role
from ..models import UserRole

router = APIRouter(
    prefix="/clients",
    tags=["clients"],
    dependencies=[Depends(optional_bearer)] # Permite acceso público para listar clientes (con paginación y búsqueda básica)
)

@router.get("/", response_model=List[schemas.ClientOut])
def list_clients(
    response: Response,
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None, description="Busca por nombre, email o teléfono"),
    limit: Annotated[int, Field(ge=1, le=200)] = 50,
    offset: Annotated[int, Field(ge=0)] = 0,
    order_by: Literal["full_name", "join_date", "email", "is_active"] = "full_name",
    order_dir: Literal["asc", "desc"] = "asc",
):
    # 1) Base query + búsqueda
    query = db.query(models.Client)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                models.Client.full_name.ilike(like),
                models.Client.email.ilike(like),
                models.Client.phone.ilike(like),
            )
        )

    # 2) Conteo total (para X-Total-Count)
    total = query.with_entities(func.count(models.Client.id)).scalar()
    response.headers["X-Total-Count"] = str(total)

    # 3) Mapeo de columnas permitidas para ORDER BY
    ORDER_MAP = {
        "full_name": models.Client.full_name,
        "join_date": models.Client.join_date,
        "email":     models.Client.email,
        "is_active": models.Client.is_active,
    }
    sort_col = ORDER_MAP.get(order_by, models.Client.full_name)
    sort_expr = sort_col.desc() if order_dir == "desc" else sort_col.asc()

    # 4) Paginación
    items = (
        query.order_by(sort_expr)
             .offset(offset)
             .limit(limit)
             .all()
    )

    # 5) Links de paginación (Link header)
    base = "/clients"
    links = []
    if offset + limit < (total or 0):
        links.append(f'<{base}?offset={offset+limit}&limit={limit}&order_by={order_by}&order_dir={order_dir}{"&q="+q if q else ""}>; rel="next"')
    if offset > 0:
        prev_offset = max(0, offset - limit)
        links.append(f'<{base}?offset={prev_offset}&limit={limit}&order_by={order_by}&order_dir={order_dir}{"&q="+q if q else ""}>; rel="prev"')
    if links:
        response.headers["Link"] = ", ".join(links)

    return items


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
