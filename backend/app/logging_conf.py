# app/logging_conf.py
import os
import logging
from pathlib import Path
from logging.config import dictConfig

def setup_logging(debug: bool = False) -> None:
    base_dir = Path(__file__).resolve().parents[1]  # carpeta backend/
    logs_dir = base_dir / "logs"
    logs_dir.mkdir(exist_ok=True)

    level = "DEBUG" if debug else "INFO"

    dictConfig({
        "version": 1,
        "disable_existing_loggers": False,   # ⬅️ importante
        "formatters": {
            "standard": {
                "format": "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": level,
                "formatter": "standard",
                "stream": "ext://sys.stdout",
            },
            "app_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": level,
                "formatter": "standard",
                "filename": str(logs_dir / "app.log"),
                "maxBytes": 5_000_000,
                "backupCount": 3,
                "encoding": "utf-8",
            },
            "access_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "INFO",
                "formatter": "standard",
                "filename": str(logs_dir / "access.log"),
                "maxBytes": 5_000_000,
                "backupCount": 3,
                "encoding": "utf-8",
            },
            "error_file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": "WARNING",
                "formatter": "standard",
                "filename": str(logs_dir / "error.log"),
                "maxBytes": 5_000_000,
                "backupCount": 3,
                "encoding": "utf-8",
            },
        },
        "loggers": {
            # nuestro logger de requests
            "request": {
                "handlers": ["access_file", "console"],
                "level": "DEBUG" if debug else "INFO",
                "propagate": False,   # ⬅️ NO subir al root (evita duplicados)
            },
            # bajamos ruido de librerías verbosas
            "passlib": {"level": "INFO"},
            "uvicorn.error": {"level": "INFO"},
            "uvicorn.access": {"level": "INFO"},
        },
        "root": {
            "handlers": ["console", "app_file", "error_file"],
            "level": level,
        },
    })
