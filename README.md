# GymApp 🏋️‍♂️

Una aplicación completa de gestión para gimnasios que permite administrar clientes, pagos, asistencia y reportes de manera eficiente.

## 📋 Características Principales

- **Gestión de Clientes**: Registro y administración completa de miembros del gimnasio
- **Sistema de Pagos**: Seguimiento de pagos, métodos de pago y estados de cuenta
- **Control de Asistencia**: Registro de check-ins y check-outs con calendario interactivo
- **Reportes y Analytics**: Generación de reportes detallados y métricas del negocio
- **Dashboard Interactivo**: Vista general del estado del gimnasio con métricas clave
- **Autenticación Segura**: Sistema de login con JWT y roles de usuario
- **Interfaz Moderna**: UI/UX intuitiva construida con React y Tailwind CSS

## 🏗️ Arquitectura

Este proyecto sigue una arquitectura cliente-servidor:

### Backend (Python/FastAPI)
- **Framework**: FastAPI con Python 3.8+
- **Base de Datos**: PostgreSQL con SQLAlchemy ORM
- **Autenticación**: JWT tokens con bcrypt para hashing de contraseñas
- **Migraciones**: Alembic para control de versiones de base de datos
- **Documentación**: Swagger UI integrada (/docs)

### Frontend (React/TypeScript)
- **Framework**: React 19 con TypeScript
- **Build Tool**: Vite para desarrollo rápido
- **UI Components**: Radix UI con Tailwind CSS
- **Routing**: React Router para navegación SPA
- **HTTP Client**: Axios para comunicación con API
- **Icons**: Lucide React

## 🚀 Inicio Rápido

### Prerrequisitos

- Python 3.8+
- Node.js 18+
- PostgreSQL
- Git

### Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/mbiondo/GymApp.git
   cd GymApp
   ```

2. **Configurar el Backend**
   ```bash
   cd backend
   python -m venv venv
   # En Windows:
   venv\Scripts\activate
   # En Linux/Mac:
   # source venv/bin/activate

   pip install -r requirements.txt
   ```

3. **Configurar la Base de Datos**
   ```bash
   # Crear base de datos PostgreSQL
   createdb gymapp_db

   # Configurar variables de entorno (copiar .env.example a .env)
   cp .env.example .env

   # Ejecutar migraciones
   alembic upgrade head

   # Ejecutar scripts de seed (opcional)
   python -m scripts.create_owner
   python -m scripts.seed_clients
   python -m scripts.seed_payments
   python -m scripts.seed_attendance
   ```

4. **Configurar el Frontend**
   ```bash
   cd ../frontend
   npm install
   ```

### Ejecutar la Aplicación

1. **Backend** (desde `backend/`):
   ```bash
   uvicorn app.main:app --reload
   ```
   Acceder a: http://localhost:8000/docs

2. **Frontend** (desde `frontend/`):
   ```bash
   npm run dev
   ```
   Acceder a: http://localhost:5173

## 📁 Estructura del Proyecto

```
GymApp/
├── backend/                 # API REST con FastAPI
│   ├── app/
│   │   ├── routers/         # Endpoints de la API
│   │   ├── models.py        # Modelos de base de datos
│   │   ├── schemas.py       # Esquemas Pydantic
│   │   ├── database.py      # Configuración BD
│   │   └── main.py          # Punto de entrada
│   ├── migrations/          # Migraciones de BD
│   ├── scripts/             # Scripts de utilidad
│   └── requirements.txt     # Dependencias Python
├── frontend/                # Aplicación React
│   ├── src/
│   │   ├── components/      # Componentes reutilizables
│   │   ├── pages/           # Páginas de la aplicación
│   │   ├── services/        # Servicios API
│   │   └── hooks/           # Hooks personalizados
│   ├── public/              # Assets estáticos
│   └── package.json         # Dependencias Node.js
└── README.md               # Este archivo
```

## 🔧 Configuración

### Variables de Entorno (Backend)

Crear un archivo `.env` en `backend/` basado en `.env.example`:

```env
DATABASE_URL=postgresql://user:password@localhost/gymapp_db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=True
```

### Variables de Entorno (Frontend)

Crear un archivo `.env` en `frontend/`:

```env
VITE_API_URL=http://localhost:8000
```

## 🧪 Testing

### Backend
```bash
cd backend
pytest  # Si tienes tests configurados
```

### Frontend
```bash
cd frontend
npm run lint
```

## 📊 API Endpoints

La API proporciona los siguientes endpoints principales:

- `POST /auth/login` - Autenticación de usuarios
- `GET /clients` - Listar clientes
- `POST /clients` - Crear cliente
- `GET /payments` - Listar pagos
- `POST /payments` - Registrar pago
- `GET /attendance` - Obtener asistencia
- `POST /attendance/checkin` - Registrar entrada
- `GET /reports` - Generar reportes

Documentación completa disponible en `/docs` cuando el servidor está ejecutándose.

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 👥 Autor

**ezebellino** - [GitHub](https://github.com/ezebellino)

## 🙏 Agradecimientos

- FastAPI por el excelente framework web
- React por la librería de UI
- Tailwind CSS por el sistema de diseño
- Radix UI por los componentes accesibles