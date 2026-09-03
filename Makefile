.PHONY: help setup setup-backend setup-frontend dev backend frontend migrate stop clean \
	test test-backend test-frontend \
	docker-up docker-down docker-build docker-logs docker-ps docker-clean \
	agents-sync agents-check

VENV := backend/.venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip
BACKEND_HOST := 127.0.0.1
BACKEND_PORT := 8001

help: ## Muestra los comandos disponibles
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

setup: setup-backend setup-frontend ## Instala dependencias de backend y frontend

setup-backend: ## Crea el virtualenv e instala dependencias del backend
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r backend/requirements-dev.txt
	@test -f backend/.env || cp backend/.env.example backend/.env

setup-frontend: ## Instala dependencias del frontend
	cd frontend && npm install
	@test -f frontend/.env || cp frontend/.env.example frontend/.env

migrate: ## Corre las migraciones de alembic
	cd backend && ../$(PYTHON) -m alembic upgrade head

backend: ## Levanta solo el backend (uvicorn --reload)
	cd backend && ../$(PYTHON) -m uvicorn app.main:app --reload --host $(BACKEND_HOST) --port $(BACKEND_PORT)

frontend: ## Levanta solo el frontend (vite dev)
	cd frontend && npm run dev

dev: ## Levanta backend y frontend juntos (Ctrl+C corta ambos)
	@trap 'kill 0' EXIT INT TERM; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait

test-backend: ## Corre los tests del backend (pytest)
	cd backend && ../$(PYTHON) -m pytest

test-frontend: ## Corre los tests del frontend (vitest)
	cd frontend && npm run test

test: ## Corre backend + frontend y reporta el estado combinado
	@fail=0; \
	$(MAKE) test-backend || fail=1; \
	$(MAKE) test-frontend || fail=1; \
	exit $$fail

stop: ## Mata procesos de uvicorn/vite que hayan quedado colgados
	-pkill -f "uvicorn app.main:app" || true
	-pkill -f "vite" || true

clean: ## Borra el virtualenv y node_modules
	rm -rf $(VENV) frontend/node_modules

docker-up: ## Levanta todo (db + backend + frontend) en Docker
	@test -f backend/.env.docker || cp backend/.env.docker.example backend/.env.docker
	@test -f frontend/.env.docker || cp frontend/.env.docker.example frontend/.env.docker
	docker compose up --build

docker-down: ## Baja los contenedores (mantiene los volúmenes/datos)
	docker compose down

docker-build: ## Reconstruye las imágenes sin levantar los servicios
	docker compose build

docker-logs: ## Sigue los logs de todos los servicios
	docker compose logs -f

docker-ps: ## Muestra el estado de los servicios
	docker compose ps

docker-clean: ## Baja los contenedores y borra volúmenes (incluye la DB)
	docker compose down -v

agents-sync: ## Sincroniza .claude/ y .codex/ desde .agents/ (symlinks + wrappers de roles)
	python3 .agents/bin/sync.py

agents-check: ## Verifica que .claude/ y .codex/ esten en sync con .agents/ (para CI)
	python3 .agents/bin/sync.py --check
