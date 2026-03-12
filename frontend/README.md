# Frontend GymApp

Frontend del sistema de gestión para gimnasios construido con React, Vite, Tailwind y shadcn/ui.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Variables de entorno

El frontend espera una URL de backend accesible desde navegador:

```env
VITE_API_URL=https://gymapp-backend-xe0n.onrender.com
```

## Deploy

- Producción: Vercel
- El archivo `vercel.json` incluye rewrite a `index.html` para evitar `404` en rutas internas

## Pantallas principales

- Dashboard
- Clientes
- Pagos
- Asistencias
- Reportes
- Rutinas
- Ajustes
- Login

## Notas

- El proyecto usa lazy loading por rutas
- Si el backend cambia, conviene redeployar Render antes de validar el frontend en producción
