from fastapi import Depends
from sqlalchemy.orm import Session
from .database import get_session

def get_db():
    with get_session() as db:
        yield db