# GymApp - Sistema de Gestión para Gimnasios

GymApp es una aplicación web moderna diseñada para simplificar la gestión diaria de gimnasios. Proporciona herramientas intuitivas para el control de clientes, asistencias, pagos y reportes.

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
- React + TypeScript
- Vite
- Componentes UI modernos y personalizados
- Sistema de autenticación integrado
- Diseño responsive

### Backend
- Python
- FastAPI
- SQLAlchemy
- Alembic (migraciones)
- Sistema de autenticación seguro

## Requisitos Previos

### Frontend
```bash
# Node.js 16 o superior
# npm o yarn
```

### Backend
```bash
# Python 3.8 o superior
# pip
# Base de datos PostgreSQL
```

## Instalación

### Backend
1. Crear un entorno virtual:
```bash
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

2. Instalar dependencias:
```bash
cd backend
pip install -r requirements.txt
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

4. Ejecutar migraciones:
```bash
alembic upgrade head
```

5. Iniciar el servidor:
```bash
uvicorn app.main:app --reload
```

### Frontend
1. Instalar dependencias:
```bash
cd frontend
npm install
# o
yarn install
```

2. Iniciar el servidor de desarrollo:
```bash
npm run dev
# o
yarn dev
```

## Estructura del Proyecto

### Frontend
```
frontend/
├── src/
│   ├── api/        # Integraciones con la API
│   ├── auth/       # Autenticación
│   ├── components/ # Componentes reutilizables
│   ├── hooks/      # Custom hooks
│   ├── lib/        # Utilidades
│   ├── pages/      # Páginas principales
│   └── services/   # Servicios
```

### Backend
```
backend/
├── app/
│   ├── routers/    # Rutas de la API
│   ├── models/     # Modelos de datos
│   └── schemas/    # Esquemas Pydantic
├── migrations/     # Migraciones Alembic
└── scripts/       # Scripts de utilidad
```

## Características de Seguridad
- Autenticación JWT
- Contraseñas hasheadas
- Protección CORS
- Validación de datos
- Auditoría de operaciones críticas

## Contribución
Las contribuciones son bienvenidas. Por favor:
1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia
Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.