# Evidencia de implementación — add-dev-role-switcher

Recogida por `role-dev` al cerrar las tasks (2026-09-05), con el stack Docker (`make docker-up`)
y `chrome-devtools` sobre http://localhost:5173. No reemplaza a `verification.md` (lo escribe
`/opsx:verify`); es el insumo para ese gate.

**Las capturas de pantalla no se conservaron en el repo** (regla del proyecto: no se suben
imágenes salvo pedido explícito). La columna "Captura" de la tabla de abajo describe lo que
mostraba cada una; la evidencia verificable que queda es el árbol de accesibilidad y los valores
de `localStorage` anotados en cada fila.

## Task 5.4 — ausencia en el bundle de producción (invariante I1)

```
$ cd frontend && npm run build
✓ built in 4.38s
$ grep -r -e "dev-role-switcher" -e "dev.owner@miniespacio.local" -e "dev.coach@miniespacio.local" \
       -e "dev.member@miniespacio.local" -e "devdev123" dist/
(sin salida) — exit 1 = cero coincidencias
$ ls dist/assets | grep -i dev
(sin chunk dev)
```

## Task 5.5 — una sola importación entrante a `components/dev/**` (invariante I2)

```
$ grep -rn "components/dev" frontend/src --include="*.ts" --include="*.tsx" --include="*.jsx"
src/App.jsx:40:  ? lazy(() => import("./components/dev/DevRoleSwitcher"))
src/components/dev/devUsers.ts:6:        (comentario, dentro de la carpeta)
src/components/dev/DevRoleSwitcher.tsx:37: (comentario, dentro de la carpeta)
```

## Task 8.1 — gates mecánicos

- `make check-plan CHANGE=add-dev-role-switcher` → `riesgo=bajo`, exit 0.
- `make lint` → ruff OK, eslint 0 errores, tsc OK.
- `make test` → backend 74 passed (incluye `test_dev_seed.py`, 7 casos), frontend 18 archivos /
  76 tests passed (incluye `DevRoleSwitcher.test.tsx`, `App.devSwitcher.test.tsx` y
  `Login.test.tsx` sin modificar).
- `make agents-sync` + `make agents-check` → sin drift.

## Task 8.2 — verificación manual (`run-app`)

`make seed-dev` (rama Docker detectada) corrido dos veces: `3 creados, 0 actualizados` y luego
`0 creados, 3 actualizados`; la base queda con exactamente 3 filas `dev.*@miniespacio.local`
(Miembro con `membership_status=active`).

| # | Escenario | Resultado | Evidencia (captura descartada) |
|---|---|---|---|
| 1 | Widget visible en `/login` con las tres opciones y "sin sesión" | PASA | `/login` con card flotante abajo a la derecha: "Dev · sesión: sin sesión" + botones Dueño / Coach / Miembro |
| 2 | Base sin seedear: click en Dueño → alerta "Usuario de desarrollo no encontrado. Corré `make seed-dev` y volvé a intentar." | PASA | alerta `role="alert"` inline en el widget con el texto exacto |
| 3 | Dueño desde `/login` → aterriza en `/dashboard`, Sidebar "Dev Dueño" | PASA | URL `/dashboard`, Sidebar "VISTA DUEÑO / Dev Dueño / dev.owner@miniespacio.local" |
| 4 | Dueño → Coach: `/dashboard`, Sidebar "VISTA COACH / Dev Coach", sin "Reportes" | PASA | URL `/dashboard`, Sidebar "VISTA COACH / Dev Coach", nav sin "Reportes" |
| 5 | Coach → Miembro: aterriza en `/my-routine`, Sidebar solo "Mi rutina", "Dev Miembro"; sin restos del Coach | PASA | URL `/my-routine`, nav solo "Mi rutina", "VISTA USUARIO / Dev Miembro", heading "Hola Dev Miembro" |
| 6 | Colapsar + recargar: `dev_role_switcher_collapsed=1`, widget monta colapsado (`aria-expanded=false`) | PASA | tras reload: `localStorage.dev_role_switcher_collapsed="1"`, botón `aria-expanded="false"` |
| 7 | Con sesión Miembro vigente, login del Dueño falla (400): alerta con `make seed-dev` y sesión intacta (`user_role=member`, token presente, sigue en `/my-routine`) | PASA | alerta con `make seed-dev`; `user_role="member"`, `user_name="Dev Miembro"`, token presente, URL `/my-routine` |

Durante el click se observó el estado de carga: las tres opciones `disabled`, la elegida con
`aria-busy` y el `aria-live` anunciando "Cambiando a Dueño…".

El escenario 7 se forzó poniendo `password_hash = NULL` al Dueño en la base (el backend responde
400 "invitación pendiente", el mismo código que "usuario inexistente"); `make seed-dev` lo reparó
después (el upsert reescribe el hash).
