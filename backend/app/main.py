from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from .config import settings
from .logging_conf import setup_logging
from .middleware import RequestLogMiddleware
from .routers import clients, payments, auth, attendance, reports

setup_logging(debug=getattr(settings, "DEBUG", False))  # ⬅️ antes de crear/usar loggers

app = FastAPI(
    title="Gym – Clientes & Pagos",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    debug=getattr(settings, "DEBUG", False),
)

@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "Conflict: entity violates a unique or integrity constraint."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "Link"],  # ⬅️ para paginación
)

app.add_middleware(RequestLogMiddleware)  # ⬅️ aseguralo

# Routers
from .routers import clients, payments, auth, attendance, reports
app.include_router(auth.router)
app.include_router(clients.router)
app.include_router(payments.router)
app.include_router(attendance.router)
app.include_router(reports.router)


@app.get("/healthz", tags=["health"])
def read_healthz():
    return {"message": "Gym App Backend is running."}