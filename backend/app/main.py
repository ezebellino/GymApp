from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import clients, payments
from .config import settings

app = FastAPI(debug=settings.DEBUG, title="Gym Libre Funcional", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
    
app.include_router(clients.router)
app.include_router(payments.router)

@app.get("/")
async def root():
    return {"ok": True, "msg": "Gym Libre Funcional API is running"}