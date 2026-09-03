# frontend/AGENTS.md

Instrucciones específicas del frontend. Ver también el [AGENTS.md de la raíz](../AGENTS.md) para
convenciones generales, CodeGraph y OpenSpec (aplican también acá).

## Stack

React 19 + Vite 7 + TypeScript (adopción parcial: `.jsx`/`.tsx` conviven) + Tailwind CSS v4 +
shadcn/ui (componentes en `src/components/ui`, config en `components.json`) + React Router 7 +
axios + SweetAlert2/sonner para notificaciones.

## Estructura

```text
src/
  App.jsx           # rutas de la app
  main.jsx          # entrypoint
  auth/             # contexto/lógica de autenticación (JWT en cliente)
  components/       # componentes compartidos, incluyendo ui/ (shadcn)
  hooks/            # custom hooks
  lib/              # utilidades (cn, formateo, etc.)
  pages/            # una carpeta/archivo por vista, mapea a rutas de App.jsx
  services/         # llamadas a la API (axios), un archivo por dominio
  types.ts          # tipos compartidos
```

## Comandos

```bash
make setup-frontend   # npm install + copia .env.example -> .env
make frontend         # vite dev
npm run build          # build de producción (dentro de frontend/)
npm run lint            # eslint (dentro de frontend/)
```

`VITE_API_URL` en `.env` apunta al backend (ver `.env.example`).

## Convenciones

- **UI**: usar componentes de `src/components/ui` (shadcn) antes de crear uno nuevo desde cero.
  Ver la skill `shadcn` en `.agents/skills/` para patrones de composición/estilos/formularios.
- **Datos**: las llamadas a la API van en `src/services/`, no directo en componentes de página —
  mantiene los componentes livianos y los servicios testeables/reusables.
- **Estilos**: Tailwind v4 (config vía `@tailwindcss/vite`, sin `tailwind.config.js` clásico si
  no existe — confirmar antes de asumir). Evitar CSS inline salvo casos puntuales.
- **Tipado**: el proyecto está en transición a TypeScript. Los archivos nuevos de lógica no
  trivial preferí `.tsx`/`.ts`; páginas simples pueden seguir en `.jsx` si el resto del módulo lo
  está.
- **Roles**: la UI difiere por rol (Dueño, Coach, portal cliente) — revisar `src/auth/` y las
  rutas protegidas en `App.jsx` antes de agregar una vista nueva.
- **Tests**: Vitest + Testing Library sobre jsdom. Se corre con `make test-frontend` desde la
  raíz o `npm run test` acá (`npm run test:watch` para iterar). Los tests viven junto al código
  que prueban, en `src/**/__tests__/*.test.tsx`; los helpers en `src/test/`.
  - Config en `frontend/vitest.config.js`, que **combina `vite.config.js` con `mergeConfig`**: si
    existe un `vitest.config.*`, Vitest ignora el `vite.config.*` por completo, y sin el merge se
    pierden el alias `@ -> ./src` y el plugin de React. No metas la clave `test` en
    `vite.config.js`: esa es la config de build de producción.
  - `globals: false`: los tests importan explícitamente de `vitest`
    (`import { describe, it, expect, vi } from "vitest"`).
  - `src/test/setup.ts` registra los matchers de jest-dom, polyfillea `matchMedia` y
    `ResizeObserver` (jsdom no los trae y los necesitan vaul y cmdk/Radix), y en `afterEach` hace
    `cleanup()` + `localStorage.clear()`.
  - **Aislamiento de red**: los tests mockean el módulo entero con `vi.mock("@/lib/http")` usando
    el helper `src/test/apiMock.ts`, que resuelve por ruta. No uses `vi.spyOn(api, "get")`:
    cualquier llamada no prevista se iría a XHR real de jsdom y dispararía los interceptores de
    `lib/http` (el 401 redirige a `/login`) y SweetAlert2. Las suites corren sin backend.
  - `src/test/renderWithProviders.tsx` envuelve en `MemoryRouter` y reexporta las utilidades de
    RTL. Hoy no hace falta más provider que ese.
  - Cobertura actual: un test de render por cada vista con spec (`Login`, `RegisterClient`,
    `Dashboard`, `Settings`). No hay tests de interacción ni E2E.
