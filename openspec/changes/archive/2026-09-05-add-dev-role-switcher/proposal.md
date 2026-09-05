## Why

Probar un change en Mini Espacio a menudo requiere ver la misma pantalla como Dueño, Coach y
Miembro, y hoy eso implica cerrar sesión y volver a loguearse a mano con credenciales que hay que
recordar o buscar (o inventarlas, porque no existe un Coach ni un Miembro de desarrollo con
password conocida). Esa fricción hace que `role-qa` y quien desarrolla salteen la prueba
multi-rol y confíen en un solo punto de vista. Un widget de desarrollo que loguea con un click
como cualquiera de tres usuarios fijos —y un seed que garantiza que esos tres usuarios existen—
resuelve esa fricción sin tocar la superficie de autenticación de producción.

## What Changes

- Nuevo widget flotante, presente **solo en builds de desarrollo** (ausente del bundle de
  producción, sin rastro de código ni de credenciales), visible en todas las rutas del frontend
  incluida `/login`.
- El widget muestra el rol de la sesión activa (o "sin sesión") y ofrece elegir entre tres
  usuarios de desarrollo fijos, uno por rol: Dueño, Coach y Miembro con membresía activa.
- Cambiar de usuario hace login real contra `POST /auth/token` con las credenciales fijas de ese
  usuario, reutilizando el mismo camino que `Login.tsx` (`/auth/me` → `setSession` → sincronizar
  tema → aterrizar en la home del rol: `/dashboard` para Dueño/Coach, `/my-routine` para
  Miembro). Antes de loguear al nuevo usuario, cierra la sesión anterior (`logout()`) para no
  arrastrar caché ni estado de sesión previos. No se agrega ningún endpoint de impersonación.
- El widget puede colapsarse/minimizarse y ese estado se recuerda entre recargas de página.
- Si el usuario de desarrollo elegido no existe en la base (el seed no corrió), el widget muestra
  un error claro que indica qué comando correr, en vez de fallar en silencio o quedarse
  cargando indefinidamente.
- Nuevo script de seed idempotente en `backend/scripts/` que crea (o deja sin duplicar, si ya
  existen) exactamente esos tres usuarios de desarrollo con credenciales fijas y documentadas, y
  que se niega a correr fuera de un entorno de desarrollo.
- Integración al flujo de agentes: `role-qa` usa el widget/seed para probar los tres roles,
  `run-app` documenta el comando de seed y las credenciales, `role-dev` agrega verificación
  multi-rol antes de dar una tarea por terminada, y `Makefile`/`AGENTS.md` (raíz, backend,
  frontend) documentan el nuevo target de seed.
- Test de render en Vitest: el widget aparece en un build de desarrollo y no aparece (no se
  renderiza nada) en un build de producción.

## Capabilities

### New Capabilities
- `dev-role-switcher`: widget flotante de desarrollo para cambiar de sesión entre los tres
  usuarios fijos (Dueño, Coach, Miembro) y el seed que garantiza su existencia.

### Modified Capabilities
- `automated-test-suite`: agrega el test de render que cubre presencia/ausencia del widget según
  el modo de build, junto a los ya existentes.

## Impact

- Frontend: nuevo componente flotante (fuera del árbol de producción, cargado condicionalmente
  por modo de build — decisión del Arquitecto), que consume `session.ts` (`setSession`,
  `logout()`) y replica el flujo de `Login.tsx` contra `POST /auth/token` y `GET /auth/me`.
  Persistencia del estado colapsado/expandido en almacenamiento local del navegador.
- Backend: nuevo script de seed en `backend/scripts/` (idempotente, con guardas de entorno);
  ningún endpoint nuevo ni cambio de contrato de auth existente.
- Documentación y flujo de agentes: `.agents/skills/role-qa/SKILL.md`,
  `.agents/skills/run-app/SKILL.md`, `.agents/skills/role-dev/SKILL.md`, `AGENTS.md`,
  `backend/AGENTS.md`, `frontend/AGENTS.md`, `Makefile` (target de seed listado en `make help`).
  Después de tocar `.agents/`, corresponde `make agents-sync`.
- Tests: nuevo test de render en Vitest para el widget; posible verificación de idempotencia del
  seed, a criterio del Arquitecto.
- Supuestos:
  - Las credenciales de los tres usuarios de desarrollo quedan hardcodeadas y documentadas (no
    son secretas): esto es aceptable porque el widget y el seed no existen fuera de desarrollo.
  - "Miembro con membresía activa" implica que ese usuario de desarrollo pasa los guards de rol
    del portal (`/my-routine`) sin bloqueos por baja de membresía.
  - Este change no depende de `add-verification-gates-to-opsx-flow` (change en curso que toca
    las mismas skills de rol) ni lo duplica; si ambos tocan el mismo archivo de skill, la
    integración final la resuelve quien aplique el que se mergee después.
  - Fuera de alcance: cualquier atajo de "impersonar" un usuario arbitrario (no fijo) o un cuarto
    rol; el widget cubre exactamente los tres roles de producto existentes.
