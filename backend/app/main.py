from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect
from .database import engine
from .models import Base
from .routers import clients, payments

app = FastAPI(title="Gym Libre Funcional", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if not inspect(engine).has_table("clients"):
    Base.metadata.create_all(bind=engine)
    print("Created database tables")
    
app.include_router(clients.router)
app.include_router(payments.router)

@app.get("/")
async def root():
    return {"ok": True, "msg": "Gym Libre Funcional API is running"}