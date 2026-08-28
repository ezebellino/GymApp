.PHONY: help setup setup-backend setup-frontend dev backend frontend migrate stop clean

VENV := backend/.venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

help: ## Muestra los comandos disponibles
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

setup: setup-backend setup-frontend ## Instala dependencias de backend y frontend

setup-backend: ## Crea el virtualenv e instala dependencias del backend
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r backend/requirements.txt
	@test -f backend/.env || cp backend/.env.example backend/.env

setup-frontend: ## Instala dependencias del frontend
	cd frontend && npm install
	@test -f frontend/.env || cp frontend/.env.example frontend/.env

migrate: ## Corre las migraciones de alembic
	cd backend && ../$(PYTHON) -m alembic upgrade head

backend: ## Levanta solo el backend (uvicorn --reload)
	cd backend && ../$(PYTHON) -m uvicorn app.main:app --reload

frontend: ## Levanta solo el frontend (vite dev)
	cd frontend && npm run dev

dev: ## Levanta backend y frontend juntos (Ctrl+C corta ambos)
	@trap 'kill 0' EXIT INT TERM; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait

stop: ## Mata procesos de uvicorn/vite que hayan quedado colgados
	-pkill -f "uvicorn app.main:app" || true
	-pkill -f "vite" || true

clean: ## Borra el virtualenv y node_modules
	rm -rf $(VENV) frontend/node_modules
