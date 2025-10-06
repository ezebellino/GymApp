from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import clients, payments

app = FastAPI(title="Gym Libre Funcional", version="0.1.0")

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