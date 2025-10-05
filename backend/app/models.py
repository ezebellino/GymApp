import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Float, Boolean
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Client(Base):
    __tablename__ = 'clients'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String, nullable=False)
    email = Column(String, unique=False, nullable=True)
    phone = Column(String, nullable=True)
    join_date = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    
class Payments(Base):
    __tablename__ = 'payments'
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = Column(String, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    method = Column(String, nullable=False)
    note = Column(String, nullable=True)
    period_month = Column(Integer, nullable=False)
    period_year = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)