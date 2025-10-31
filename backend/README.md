# GymApp Backend 🏋️‍♂️

API REST robusta y escalable para la gestión de gimnasios, construida con FastAPI y PostgreSQL.

## ✨ Características

- **API RESTful**: Endpoints bien diseñados siguiendo estándares REST
- **Autenticación JWT**: Sistema seguro de autenticación con tokens
- **Base de Datos Relacional**: PostgreSQL con SQLAlchemy ORM
- **Migraciones**: Control de versiones de base de datos con Alembic
- **Validación**: Esquemas Pydantic para validación de datos
- **Documentación**: Swagger UI integrada automáticamente
- **Logging**: Sistema de logging configurable
- **CORS**: Configuración CORS para comunicación con frontend
- **Manejo de Errores**: Gestión robusta de excepciones y errores

## 🚀 Tecnologías

- **FastAPI** - Framework web moderno y rápido
- **SQLAlchemy** - ORM para Python
- **PostgreSQL** - Base de datos relacional
- **Alembic** - Migraciones de base de datos
- **Pydantic** - Validación de datos
- **JWT** - Autenticación con JSON Web Tokens
- **Bcrypt** - Hashing de contraseñas
- **Uvicorn** - Servidor ASGI
- **Python 3.8+** - Versión de Python requerida

## 📦 Instalación

```bash
# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt
```

## 🗄️ Base de Datos

### Configuración

1. **Crear base de datos PostgreSQL**:
   ```sql
   CREATE DATABASE gymapp_db;
   ```

2. **Variables de entorno** (`.env`):
   ```env
   DATABASE_URL=postgresql://user:password@localhost/gymapp_db
   SECRET_KEY=your-secret-key-here
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   DEBUG=True
   ```

### Migraciones

```bash
# Crear nueva migración
alembic revision --autogenerate -m "Descripción de cambios"

# Ejecutar migraciones
alembic upgrade head

# Ver estado de migraciones
alembic current
```

## 🏗️ Estructura del Proyecto

```
backend/
├── app/
│   ├── routers/            # Endpoints de la API
│   │   ├── auth.py         # Autenticación
│   │   ├── clients.py      # Gestión de clientes
│   │   ├── payments.py     # Sistema de pagos
│   │   ├── attendance.py   # Control de asistencia
│   │   └── reports.py      # Generación de reportes
│   ├── models.py           # Modelos de base de datos
│   ├── schemas.py          # Esquemas Pydantic
│   ├── database.py         # Configuración de BD
│   ├── config.py           # Configuración general
│   ├── security.py         # Utilidades de seguridad
│   ├── deps.py             # Dependencias FastAPI
│   ├── utils.py            # Utilidades generales
│   ├── middleware.py       # Middleware personalizado
│   ├── logging_conf.py     # Configuración de logging
│   └── main.py             # Aplicación FastAPI
├── migrations/             # Migraciones Alembic
│   ├── env.py
│   ├── script.py.mako
│   └── versions/           # Archivos de migración
├── scripts/                # Scripts de utilidad
│   ├── create_owner.py     # Crear usuario administrador
│   ├── seed_clients.py     # Datos de prueba - clientes
│   ├── seed_payments.py    # Datos de prueba - pagos
│   └── seed_attendance.py  # Datos de prueba - asistencia
├── alembic.ini             # Configuración Alembic
├── requirements.txt        # Dependencias Python
└── README.md              # Este archivo
```

## 🚀 Ejecución

### Desarrollo
```bash
# Ejecutar servidor con recarga automática
uvicorn app.main:app --reload

# Acceder a la documentación
# http://localhost:8000/docs
# http://localhost:8000/redoc
```

### Producción
```bash
# Con Gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## 📊 Modelos de Datos

### Usuario (User)
- Autenticación y autorización
- Roles: admin, staff
- Campos: username, email, password_hash, role

### Cliente (Client)
- Información personal de miembros
- Campos: nombre, apellido, email, teléfono, fecha_nacimiento, etc.

### Pago (Payment)
- Registro de pagos realizados
- Campos: cliente_id, monto, fecha, método, canal, estado

### Asistencia (Attendance)
- Control de entradas/salidas
- Campos: cliente_id, fecha, hora_entrada, hora_salida

## 🔐 Endpoints API

### Autenticación
- `POST /auth/login` - Login de usuario
- `POST /auth/register` - Registro (solo admin)

### Clientes
- `GET /clients` - Listar clientes (con paginación)
- `POST /clients` - Crear cliente
- `GET /clients/{id}` - Obtener cliente específico
- `PUT /clients/{id}` - Actualizar cliente
- `DELETE /clients/{id}` - Eliminar cliente

### Pagos
- `GET /payments` - Listar pagos
- `POST /payments` - Registrar pago
- `GET /payments/{id}` - Obtener pago específico
- `PUT /payments/{id}` - Actualizar pago
- `DELETE /payments/{id}` - Eliminar pago

### Asistencia
- `GET /attendance` - Obtener registros de asistencia
- `POST /attendance/checkin` - Registrar entrada
- `PUT /attendance/{id}/checkout` - Registrar salida
- `GET /attendance/calendar` - Datos para calendario

### Reportes
- `GET /reports/clients` - Reporte de clientes
- `GET /reports/payments` - Reporte de pagos
- `GET /reports/attendance` - Reporte de asistencia
- `GET /reports/dashboard` - Métricas para dashboard

## 🧪 Testing

```bash
# Ejecutar tests (si están configurados)
pytest

# Con cobertura
pytest --cov=app --cov-report=html
```

## 📋 Scripts de Utilidad

### Crear Usuario Administrador
```bash
python -m scripts.create_owner
```

### Poblar Datos de Prueba
```bash
python -m scripts.seed_clients
python -m scripts.seed_payments
python -m scripts.seed_attendance
```

## 🔧 Configuración Avanzada

### Logging
Configurado en `logging_conf.py`:
- Niveles: DEBUG, INFO, WARNING, ERROR
- Formato: timestamp, level, module, message
- Salida: consola y archivo (opcional)

### Middleware
- **CORS**: Configurado para desarrollo
- **Logging de Requests**: Registra todas las peticiones
- **Manejo de Errores**: Excepciones de integridad de BD

### Seguridad
- **JWT Tokens**: Expiración configurable
- **Bcrypt**: Hashing de contraseñas
- **Validación**: Pydantic para entrada/salida
- **Rate Limiting**: Implementable con middleware adicional

## 🚀 Despliegue

### Docker
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Variables de Producción
```env
DATABASE_URL=postgresql://user:password@host:port/database
SECRET_KEY=your-production-secret-key
DEBUG=False
ACCESS_TOKEN_EXPIRE_MINUTES=15
```

## 🤝 Desarrollo

### Convenciones
- **Commits**: Mensajes descriptivos en inglés
- **Rutas**: snake_case para endpoints
- **Modelos**: PascalCase para clases
- **Variables**: snake_case
- **Imports**: Agrupados por tipo (stdlib, third-party, local)

### Buenas Prácticas
- Usar dependencias FastAPI (`Depends`) para inyección
- Validar datos con Pydantic schemas
- Manejar errores con excepciones HTTP
- Documentar endpoints con docstrings
- Usar migraciones para cambios en BD

## 📄 Licencia

Este proyecto es parte de GymApp - ver README principal para más detalles.