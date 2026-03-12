# GymApp - Sistema de Gestion para Gimnasios

Aplicacion full stack desarrollada con FastAPI, Supabase y React/Vite, pensada para la administracion integral de gimnasios: clientes, pagos, asistencias, reportes y paneles con roles diferenciados.

## Demo online

- Frontend (Vercel): https://libre-funcional.vercel.app/
- Backend (Render): https://gymapp-backend-xe0n.onrender.com
- Healthcheck: `GET /health`

## Caracteristicas principales

- Gestion de clientes
- Control de asistencia
- Sistema de pagos
- Reportes operativos
- Autenticacion con roles `Dueño` y `Coach`

### Gestion de clientes

- Registro y administracion de informacion de clientes
- Fichas detalladas de usuarios
- Busqueda rapida con Spotlight Search

### Control de asistencia

- Registro de entradas y salidas
- Calendario de asistencia
- Historico de visitas

### Sistema de pagos

- Registro de pagos
- Diferentes metodos de pago
- Historial de transacciones
- Seguimiento de pagos pendientes

### Reportes

- Estadisticas de asistencia
- Informes de pagos
- Analisis de tendencias

## Tecnologias utilizadas

### Frontend

- React + Vite
- TypeScript
- Tailwind + shadcn/ui
- React Router
- Helpers y estado global personalizados
- Alertas con SweetAlert

### Backend

- FastAPI
- SQLAlchemy 2.0
- JWT Auth (`Dueño` / `Coach`)
- Middlewares de logging
- Paginacion, filtros y reportes
- Arquitectura modular por routers

### Base de datos

- PostgreSQL en Supabase
- Migracion inicial via dump SQL
- Indices, relaciones y constraints
- Roles persistidos en la tabla `users`

### Deploy

- Frontend: Vercel
- Backend: Render
- Base de datos: Supabase
- Healthcheck y ping externo para reducir cold starts

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
|   |-- schemas.py
|-- migrations/
|-- requirements.txt
frontend/
|-- public/
|-- src/
|   |-- components/
|   |-- lib/
|   |-- pages/
|-- package.json
|-- vite.config.js
```

## Como correr el proyecto localmente

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Autenticacion

- `Dueño` gestiona todo el sistema
- `Coach` accede a clientes, pagos y asistencias
- El token JWT se almacena en `localStorage`
- La sesion se renueva mediante nuevo login

## Healthcheck

Usado por Render y servicios externos para verificar disponibilidad:

```json
{
  "message": "La aplicacion de Sergio esta funcionando correctamente."
}
```

## Infra y deploy

Render en free tier puede suspender el contenedor si no recibe trafico durante algunos minutos. Por eso el proyecto incluye un healthcheck y un ping externo para reducir el tiempo de reactivacion.

## Autor

Ezequiel "Zeqe" Bellino

- GitHub: https://github.com/ezebellino
- LinkedIn: https://www.linkedin.com/in/ezebellino

## Licencia

Este proyecto esta bajo la licencia MIT.
