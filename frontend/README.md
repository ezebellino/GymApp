# GymApp Frontend 🏋️‍♂️

Interfaz de usuario moderna y responsiva para la gestión de gimnasios, construida con React, TypeScript y Tailwind CSS.

## ✨ Características

- **Interfaz Moderna**: Diseño oscuro con Tailwind CSS y componentes de Radix UI
- **Navegación SPA**: Routing eficiente con React Router
- **Autenticación**: Sistema de login con JWT y rutas protegidas
- **Gestión de Estado**: Context API para manejo de autenticación
- **Componentes Reutilizables**: Biblioteca de componentes UI consistente
- **Responsive Design**: Optimizado para desktop y móvil
- **TypeScript**: Tipado fuerte para mejor desarrollo y mantenibilidad

## 🚀 Tecnologías

- **React 19** - Framework de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Framework de estilos
- **Radix UI** - Componentes primitivos accesibles
- **React Router** - Routing para SPA
- **Axios** - Cliente HTTP
- **Lucide React** - Iconos
- **Framer Motion** - Animaciones
- **React Day Picker** - Selector de fechas
- **JWT Decode** - Decodificación de tokens JWT

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Construir para producción
npm run build

# Preview de producción
npm run preview

# Ejecutar linter
npm run lint
```

## 🏗️ Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── ui/             # Componentes base (botones, inputs, etc.)
│   │   ├── AttendanceCalendar.tsx
│   │   ├── CheckinDialog.tsx
│   │   ├── LastPayments.tsx
│   │   ├── Layout.tsx
│   │   ├── NewPaymentDialog.tsx
│   │   ├── Pagination.tsx
│   │   ├── Sidebar.tsx
│   │   ├── SpotlightSearch.tsx
│   │   ├── Topbar.tsx
│   │   └── UserCard.tsx
│   ├── pages/              # Páginas principales
│   │   ├── Attendance.tsx
│   │   ├── Clients.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── Payments.tsx
│   │   ├── Reports.tsx
│   │   └── Settings.tsx
│   ├── auth/               # Autenticación
│   │   ├── AuthContext.tsx
│   │   └── ProtectedRoute.tsx
│   ├── hooks/              # Hooks personalizados
│   │   └── useDebounce.ts
│   ├── lib/                # Utilidades
│   │   ├── alerts.ts
│   │   ├── http.ts
│   │   └── utils.ts
│   ├── services/           # Servicios API
│   │   ├── clients.ts
│   │   └── search.ts
│   ├── types.ts            # Definiciones TypeScript
│   ├── App.jsx             # Componente principal
│   ├── main.jsx            # Punto de entrada
│   └── index.css           # Estilos globales
├── public/                 # Assets estáticos
├── components.json         # Configuración de componentes
├── eslint.config.js        # Configuración ESLint
├── package.json            # Dependencias y scripts
├── tsconfig.json           # Configuración TypeScript
├── vite.config.js          # Configuración Vite
└── README.md              # Este archivo
```

## 🔧 Configuración

### Variables de Entorno

Crear un archivo `.env` en la raíz del frontend:

```env
VITE_API_URL=http://localhost:8000
```

### Componentes UI

Los componentes UI están basados en Radix UI y se configuran en `components.json`. Para agregar nuevos componentes:

```bash
npx shadcn@latest add [component-name]
```

## 🎨 Tema y Estilos

- **Tema Oscuro**: Diseño principal con colores zinc (950-100)
- **Gradientes**: Efectos visuales sutiles con gradientes lineales
- **Animaciones**: Transiciones suaves con Framer Motion
- **Responsive**: Breakpoints de Tailwind CSS

## 🔐 Autenticación

El sistema de autenticación utiliza:
- JWT tokens almacenados en localStorage
- Context API para estado global de autenticación
- Rutas protegidas que redirigen a login si no hay token válido
- Interceptor de Axios para incluir token en requests

## 📱 Páginas Principales

- **Login**: Autenticación de usuarios
- **Dashboard**: Vista general con métricas
- **Clients**: Gestión de clientes del gimnasio
- **Payments**: Registro y seguimiento de pagos
- **Attendance**: Control de asistencia con calendario
- **Reports**: Generación de reportes y analytics
- **Settings**: Configuración de la aplicación

## 🛠️ Desarrollo

### Scripts Disponibles

```bash
npm run dev          # Inicia servidor de desarrollo
npm run build        # Construye para producción
npm run preview      # Preview de build de producción
npm run lint         # Ejecuta ESLint
```

### Convenciones de Código

- **TypeScript**: Uso obligatorio de tipos
- **ESLint**: Reglas de linting configuradas
- **Imports**: Imports absolutos desde `src/`
- **Componentes**: PascalCase para nombres
- **Hooks**: camelCase con prefijo `use`
- **Utilidades**: Funciones puras en `lib/`

## 🚀 Despliegue

```bash
# Construir la aplicación
npm run build

# Los archivos se generan en `dist/`
# Servir con cualquier servidor web estático
```

## 🤝 Contribución

1. Seguir las convenciones de código
2. Usar TypeScript para nuevos componentes
3. Mantener consistencia con el diseño existente
4. Probar cambios en diferentes tamaños de pantalla

## 📄 Licencia

Este proyecto es parte de GymApp - ver README principal para más detalles.
