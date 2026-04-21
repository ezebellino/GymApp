# Mini Espacio - Sistema de Gestión para Gimnasios

Aplicación full stack desarrollada con FastAPI, Supabase y React/Vite para la operación diaria de un gimnasio. El proyecto hoy cubre clientes, pagos, asistencias, reportes, configuración del negocio y un primer módulo de rutinas por grupos musculares.

## Demo online

- Frontend: https://libre-funcional.vercel.app/
- Backend: https://gymapp-backend-xe0n.onrender.com
- Healthcheck: `GET /health`

## Qué resuelve hoy

- Gestión de clientes con alta, edición, estado y ficha operativa
- Registro y seguimiento de pagos
- Check-ins y calendario de asistencias
- Reportes de ingresos, asistencia y altas
- Configuración operativa del gimnasio
- Roles `Dueño` y `Coach`
- Rutinas por grupos musculares con carga de repeticiones y kilos

## Módulos principales

### Clientes

- Alta y edición de clientes
- Spotlight Search para búsqueda rápida
- Ficha con pagos recientes y calendario de asistencias

### Pagos

- Registro de pagos por período
- Métodos `cash` y `transfer`
- Seguimiento de cobros pendientes

### Asistencias

- Check-in por cliente
- Historial de asistencias
- Calendario visual por cliente

### Reportes

- KPIs de ingresos
- Asistencia por rango
- Altas de clientes
- Detalle diario de check-ins

### Ajustes

- Identidad del gimnasio
- Datos de contacto
- Medios de pago
- Mensaje operativo para recepción

### Rutinas

- Día 1: Pecho y Bíceps
- Día 2: Espalda y Tríceps
- Día 3: Hombros
- Día 4: Piernas
- Plantilla global de ejercicios por día
- Selección de ejercicios activos por parte de owner/coach
- Registro de series, repeticiones, carga en kg y nota por cliente

## Stack técnico

### Frontend

- React + Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Router
- SweetAlert2

### Backend

- FastAPI
- SQLAlchemy
- Alembic
- JWT Auth
- Routers modulares

### Base de datos

- PostgreSQL en Supabase

## Estructura del proyecto

```text
backend/
|-- app/
|   |-- routers/
|   |-- auth.py
|   |-- config.py
|   |-- main.py
|   |-- middleware.py
|   |-- models.py
|   |-- routine_catalog.py
|   |-- schemas.py
|-- migrations/
|-- requirements.txt

frontend/
|-- public/
|-- src/
|   |-- components/
|   |-- lib/
|   |-- pages/
|   |-- types.ts
|-- package.json
|-- vite.config.js
|-- vercel.json
```

## Desarrollo local

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Usuario inicial

Si necesitás crear el usuario owner:

```bash
cd backend
python scripts/create_owner.py
```

Credenciales por defecto:

- Email: `owner@miniespacio.com`
- Password: `Cambiar123`

## Deploy y sincronización

### Frontend

- Desplegado en Vercel
- Si hay cambios de UI, alcanza con redeploy del frontend

### Backend

- Desplegado en Render
- Si cambian modelos, routers o lógica de negocio, hacé redeploy del backend

### Base de datos

- PostgreSQL en Supabase
- Si agregás migraciones nuevas, corré:

```bash
cd backend
python -m alembic upgrade head
```

## Flujo recomendado cuando cambia backend

1. `git pull` o deploy del último commit
2. `python -m alembic upgrade head`
3. Redeploy de Render
4. Redeploy de Vercel si el frontend también cambió

## Estado actual del proyecto

El sistema ya está listo para demo funcional. La siguiente etapa natural del roadmap es profundizar el módulo de rutinas:

- gráficos de progreso por ejercicio
- más contexto dentro de la ficha del cliente
- presets por objetivo o nivel

## Autor

Ezequiel Bellino

- GitHub: https://github.com/ezebellino
- LinkedIn: https://www.linkedin.com/in/ezebellino

## Licencia

MIT

## Deploy completo en Railway

### 1. Crear proyecto y servicios

En Railway crea un proyecto con:

- PostgreSQL (plugin de Railway)
- servicio `backend` apuntando a la carpeta `backend/`
- servicio `frontend` apuntando a la carpeta `frontend/`

> Cada carpeta ya incluye su propio `railway.json`.

### 2. Variables del backend

En el servicio `backend`, configura:

- `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (referencia al plugin)
- `SECRET_KEY` = clave segura
- `ALGORITHM` = `HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES` = `600` (o el valor que prefieras)
- `CORS_ORIGINS` = `http://localhost:5173,https://<frontend>.up.railway.app`

Notas:

- El backend ejecuta migraciones al iniciar (`alembic upgrade head`) y luego levanta FastAPI.
- Tambi�n soporta `DATABASE_URL` con prefijo `postgres://` de Railway.

### 3. Variables del frontend

En el servicio `frontend`, configura:

- `VITE_API_URL` = `https://<backend>.up.railway.app`

### 4. Orden recomendado de despliegue

1. Deploy del `backend`
2. Verificar `GET https://<backend>.up.railway.app/health`
3. Deploy del `frontend`
4. Validar login y llamadas API desde la URL p�blica del frontend

### 5. Dominio custom (opcional)

Si luego agregas dominios propios, actualiza `CORS_ORIGINS` con esos dominios tambi�n.
