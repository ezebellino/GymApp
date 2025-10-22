from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..deps import get_db
from ..auth import get_current_user, require_role
from ..models import UserRole
from ..security import optional_bearer

router = APIRouter(prefix="/attendance", tags=["attendance"], dependencies=[Depends(optional_bearer)])

@router.post("/", dependencies=[Depends(require_role(UserRole.owner, UserRole.coach))])
def checkin(client_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not db.query(models.Client).get(client_id):
        raise HTTPException(404, "Client not found")
    a = models.Attendance(client_id=client_id, coach_id=user.id)
    db.add(a); db.commit(); db.refresh(a)
    return {"ok": True, "id": a.id}