# GymApp - Sistema de Gestión para Gimnasios

Aplicación FullStack desarrollada con FastAPI + Supabase + React/Vite, diseñada para la administración integral de gimnasios: clientes, pagos, asistencias, reportes y paneles con roles diferenciados.


## 🚀 DEMO ONLINE

- **Frontend (Vercel):**
  - https://libre-funcional.vercel.app/

  - Backend (Render):
  - https://gymapp-backend-xe0n.onrender.com

  - Healthcheck:
  - /health → OK

## Características Principales

- 👥 **Gestión de Clientes**
  - Registro y administración de información de clientes
  - Fichas detalladas de usuarios
  - Búsqueda rápida con Spotlight Search

- 📅 **Control de Asistencia**
  - Registro de entradas y salidas
  - Calendario de asistencia
  - Histórico de visitas

- 💰 **Sistema de Pagos**
  - Registro de pagos
  - Diferentes métodos de pago
  - Historial de transacciones
  - Seguimiento de pagos pendientes

- 📊 **Reportes**
  - Estadísticas de asistencia
  - Informes de pagos
  - Análisis de tendencias

## Tecnologías Utilizadas

### Frontend
- React + Vite
- TypeScript
- Tailwind + shadcn/ui
- React Router
- Estado global + helpers personalizados
- Alertas modernas (SweetAlert)
- Animaciones suaves y UI dark-mode profesional

### Backend
- SQLAlchemy 2.0
- JWT Auth (Owner / Coach)
- Middlewares de logging
- Paginación, filtros y reportes
- Arquitectura modular por routers
- Healthcheck (/health) para infraestructura cloud

### Base de Datos
- PostgreSQL en Supabase
- Migración inicial vía dump SQL
- Índices, relaciones y constraints
- Roles persistidos en tabla users

### Deploy
- Frontend: Vercel
- Backend: Render (free tier con auto-suspend)
- DB: Supabase
- Healthcheck + ping externo para minimizar cold-start


## Estructura del Proyecto

backend/
│── app/
│   ├── routers/
│   ├── models.py
│   ├── schemas.py
│   ├── auth.py
│   ├── middleware.py
│   ├── config.py
│   ├── main.py
│── requirements.txt
frontend/
│── src/
│   ├── pages/
│   ├── components/
│   ├── lib/
│── vite.config.ts

### Cómo correr el proyecto localmente
## Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
## Frontend
```bash
cd frontend
npm install
npm run dev
```
- 🔐 **Autenticación (Owner + Coach)**
  - Owner gestiona todo el sistema
  - Coach accede a clientes, pagos y asistencias
  - Token JWT almacenado en localStorage
  - Refresh por re-login

- 🏥 **Healthcheck**
  - Usado para Render y pingers externos:
```bash
  GET /health
  {
    "message": "La aplicación de Sergio está funcionando correctamente."
  }
```

## 🌐 **Infra / Deploy Notes**
Render free suspende el contenedor si no recibe tráfico en ~15 minutos.
Se agregó un healthcheck y un ping externo para minimizar el “cold start”.

## 👨‍💻 **Autor**
Ezequiel “Zeqe” Bellino
GitHub: https://github.com/ezebellino
LinkedIn: https://www.linkedin.com/in/ezebellino

## Licencia
Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.