---
name: run-app
description: Launch and drive Mini Espacio (GymApp) in development mode using the Docker stack (db + backend + frontend) defined in docker-compose.yml and the root Makefile. Use whenever asked to run, start, or screenshot the app, or to confirm a change works end-to-end (not just lint/build/tests).
metadata:
  author: facundoosti
  version: "1.0"
---

# Correr Mini Espacio (GymApp) en modo desarrollo

Este proyecto se levanta con **Docker Compose**, orquestado por el `Makefile` de la raíz — no
con `npm run dev` / `uvicorn` sueltos salvo que se pida explícitamente el modo nativo. Verificado
desde cero (build + up) en este entorno.

## 1. Ver si el stack ya está arriba

```bash
docker compose ps
```

Si ves `gymapp-db-1`, `gymapp-backend-1` y `gymapp-frontend-1` en estado `Up`/`healthy`, el stack
ya está corriendo — no vuelvas a levantarlo, saltá al paso 3.

## 2. Levantar el stack (si no está corriendo)

```bash
make docker-up
```

Esto:
- copia `backend/.env.docker.example` → `backend/.env.docker` y
  `frontend/.env.docker.example` → `frontend/.env.docker` si no existen,
- construye las imágenes si hace falta,
- levanta `db` (Postgres, healthcheck `pg_isready`), `backend` (espera a que `db` esté healthy,
  corre `alembic upgrade` y luego uvicorn, healthcheck en `/health`), y `frontend` (Vite dev
  server con hot reload sobre el volumen montado).

`make docker-up` corre en foreground y sigue los logs (equivalente a `docker compose up --build`).
Para dejarlo corriendo en background en una sesión de agente:

```bash
docker compose up --build -d
```

Esperar a que `backend` y `db` queden `healthy`:

```bash
docker compose ps
```

## 3. Puertos y URLs

| Servicio | URL / puerto host | Notas |
|---|---|---|
| Frontend (Vite) | http://localhost:5173 | hot reload activo, montado por volumen |
| Backend (FastAPI) | http://localhost:8010 | mapeado desde el puerto 8000 del contenedor |
| Backend health | http://localhost:8010/health | usado por el healthcheck del propio compose |
| Postgres | localhost:5544 | user/pass/db: `gymapp`/`gymapp`/`gymapp_development` |

El frontend en Docker apunta al backend vía `frontend/.env.docker` (`VITE_API_URL`), no hace
falta tocar nada para que se comuniquen entre sí.

## 4. Drivearlo (no solo levantarlo)

Es una SPA de React — usar el MCP `chrome-devtools` para navegar y verificar visualmente:

```
mcp__chrome-devtools__new_page  → http://localhost:5173/login (o la ruta que corresponda)
mcp__chrome-devtools__take_snapshot  → ver el árbol de accesibilidad, conseguir uids
mcp__chrome-devtools__fill / click   → interactuar con inputs/botones
mcp__chrome-devtools__take_screenshot → mirar el resultado, SIEMPRE revisar la imagen
```

Por defecto `chrome-devtools-mcp` (definido en `.mcp.json`, compartido) lanza su propio Chrome.
Si preferís que use otro navegador ya instalado (p. ej. Brave) en tu máquina, no edites
`.mcp.json` (es compartido) — agregá un override de scope **local** (queda en tu
`~/.claude.json`, no se commitea):

```bash
claude mcp add chrome-devtools --scope local -- npx -y chrome-devtools-mcp@latest \
  --executablePath "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
```

(`claude mcp remove chrome-devtools --scope local` para sacarlo).

Casos típicos:
- Login fallido (credenciales inválidas): completar usuario/contraseña incorrectos en
  `/login` y click en "Entrar" → debe verse un toast de error (Sileo, ver
  `openspec/changes/add-toast-notifications/` si existe) sin bloquear el formulario.
- Rutas protegidas: sin `access_token` en `localStorage`, cualquier ruta autenticada redirige a
  `/login` (ver `ProtectedRoute`).

## 5. Logs y troubleshooting

```bash
make docker-logs      # sigue logs de todos los servicios
docker compose logs backend --tail=100
docker compose logs frontend --tail=100
```

- Si el backend no levanta: revisar `backend/.env.docker` (se genera solo la primera vez desde
  `.env.docker.example`; si faltan variables reales de Supabase/DB, `make docker-up` puede quedar
  esperando el healthcheck).
- **Si agregaste una dependencia nueva al frontend** (`npm install <pkg>` corrido en el host):
  el volumen `./frontend:/app` monta el código, pero `node_modules` vive en un volumen nombrado
  aparte (`frontend_node_modules`) que **no se refresca solo** con `docker compose up --build`
  — un volumen nombrado persiste entre rebuilds de imagen, así que el contenedor sigue viendo el
  `node_modules` viejo y Vite tira `Failed to resolve import "<pkg>"` (500 en la página). Instalá
  la dependencia directo en el contenedor corriendo:
  ```bash
  docker compose exec frontend npm install <pkg>
  ```
  (alternativa más lenta/agresiva: `docker compose down` seguido de
  `docker volume rm gymapp_frontend_node_modules` y volver a levantar con `--build`).
- **Si tocaste `backend/Dockerfile` o los `.env.docker`**: el `CMD` del backend corre
  `uvicorn ... --port "$PORT"` (pensado para Railway, que inyecta `$PORT`). Localmente hace falta
  `PORT=8000` en `backend/.env.docker` — si falta, el contenedor sale con
  `Error: Invalid value for '--port': '' is not a valid integer.` en `docker compose logs backend`.

## 6. Bajar el stack

```bash
make docker-down     # baja contenedores, conserva datos/volúmenes
make docker-clean     # baja contenedores y borra volúmenes (incluye la DB) — usar con cuidado
```

## Alternativa: modo nativo (sin Docker)

Si en algún entorno Docker no está disponible, existe el modo nativo documentado en el
`Makefile`/`AGENTS.md` raíz: `make setup` + `make dev` (uvicorn en :8001 + vite en su puerto
default). Requiere un `backend/.env` real (no el `.env.docker`) apuntando a una base accesible.
Preferir siempre el modo Docker de este skill salvo que el usuario pida explícitamente el nativo.

## Usuarios de desarrollo y cambio de rol con un click

Con el stack arriba, corré una vez (idempotente: se puede repetir sin duplicar nada):

```bash
make seed-dev
```

Detecta solo si el backend corre en Docker (seedea dentro del contenedor) o en modo nativo, y
deja estos tres usuarios, uno por rol, todos con password `devdev123`:

| Rol | Email (= usuario del login) | Password |
|---|---|---|
| Dueño | `dev.owner@miniespacio.local` | `devdev123` |
| Coach | `dev.coach@miniespacio.local` | `devdev123` |
| Miembro (membresía activa) | `dev.member@miniespacio.local` | `devdev123` |

En modo desarrollo (`make docker-up`, `make dev`, `make frontend`) el frontend muestra un **widget
flotante abajo a la derecha** (`data-testid="dev-role-switcher"`, también en `/login`) con el rol
de la sesión actual y tres botones: Dueño / Coach / Miembro. Un click hace login real con esas
credenciales, cierra la sesión anterior y aterriza en la home del rol (`/dashboard` para Dueño y
Coach, `/my-routine` para Miembro). Es la forma prescripta de recorrer los tres roles al verificar
un change: no hace falta cerrar sesión ni tipear credenciales. El widget se puede colapsar (botón
redondo, recuerda el estado entre recargas) y **no existe en el build de producción**.

Si al elegir un usuario el widget muestra "Usuario de desarrollo no encontrado. Corré
`make seed-dev`…", es que el seed no corrió sobre esa base: corrélo y volvé a intentar. El seed se
niega a correr si `ENVIRONMENT` no es de desarrollo o si `DATABASE_URL` no apunta a una base local.
