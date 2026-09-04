## 1. Base: esquema de color del documento (habilita los otros frentes)

- [x] 1.1 Agregar `color-scheme: dark;` al bloque `:root` de `@layer base` en
  `frontend/src/index.css` (junto a `--background`/`--foreground`, líneas ~5-19), con un comentario
  corto de una línea explicando que la app es dark-only en sus tres temas (dec. D5/M1).
- [ ] 1.2 Verificar a ojo en Brave que con eso el popup de los `<select>` nativos y el ícono de los
  `input[type="date"]` de `frontend/src/pages/Reports.tsx:311,317` se ven oscuros y legibles (es el
  efecto colateral global de 1.1; si alguno queda peor que antes, reportarlo antes de seguir).
  **No verificable sin navegador — pendiente de QA en /opsx:verify.**

## 2. Login: contraste de los inputs

- [x] 2.1 En `frontend/src/components/ui/input.tsx:11`, agregar `text-zinc-100` a la clase base del
  `<input>` para no depender de la herencia de `body` (dec. D5/M2). **No** usar `text-foreground`:
  sin bloque `@theme` esa utilidad no existe en este proyecto.
- [x] 2.2 En el mismo archivo, reemplazar el no-op `placeholder:text-muted-foreground` por
  `placeholder:text-zinc-400` (dec. D5/M3).
- [x] 2.3 Agregar en `frontend/src/components/ui/input.tsx` un comentario de 2-3 líneas explicando
  por qué el color y el placeholder son explícitos y por qué los tokens de shadcn no se usan acá
  (dec. D6: protege el fix de un futuro `shadcn add input --overwrite`).
- [x] 2.4 En `frontend/src/index.css`, duplicar la regla de autofill de las líneas 93-103 en un
  **bloque separado** con `input:autofill, input:autofill:hover, input:autofill:focus,
  input:autofill:active` y el mismo cuerpo, dejando el bloque `-webkit-` existente sin tocar
  (dec. D5/M4: agrupar ambos prefijos en una sola lista de selectores hace que un motor que no
  soporte uno descarte la regla entera).
- [ ] 2.5 Reproducir en Brave los cuatro estados de la spec en `/login` (vacío, tipeado, con foco
  sin tipear, autocompletado por el gestor de contraseñas seleccionando una sugerencia) y confirmar
  que el texto se lee en todos. Si el estado de sugerencia del gestor sigue mostrando texto oscuro,
  continuar con 2.6; si se lee bien, marcar 2.6 como no necesaria.
  **No verificable sin navegador — pendiente de QA en /opsx:verify.**
- [ ] 2.6 (Condicional, solo si 2.5 falla) Aplicar M5: forzar
  `-webkit-text-fill-color: var(--foreground)` para los inputs también en estado normal y con foco,
  scoped al formulario de login, y volver a correr 2.5. Si tampoco alcanza, **parar y reportar** en
  vez de probar un tercer mecanismo (dec. D5).
  **Condicional a 2.5 — no evaluable sin navegador, pendiente de QA en /opsx:verify.**

## 3. Sidebar: eliminar la sección "Atajos"

- [x] 3.1 Borrar el `<section>` completo de "Atajos" en `frontend/src/components/Sidebar.tsx:110-150`
  (título, descripción y los tres `<Button>`), manteniendo el `<div className="space-y-4 px-4 pb-6">`
  de la línea 109 envolviendo solo el bloque "Contexto" (`:152-164`).
- [x] 3.2 Borrar de `Sidebar.tsx` los imports que quedaron sin uso: `useNavigate` (línea 1), `Button`
  (línea 20) y los iconos `Plus` y `Search` (líneas 8-9), más la constante `const navigate =
  useNavigate()` (línea 47). `Dumbbell` sigue en uso en `items`, no tocarlo.
- [x] 3.3 Crear `frontend/src/components/__tests__/Sidebar.test.tsx` con los dos escenarios de la
  spec: con `user_role = "owner"` y con `user_role = "coach"`, el sidebar no muestra "Atajos",
  "Gestionar clientes" ni "Ir a rutinas", y sí muestra "Contexto". Usar `renderWithProviders`
  (`src/test/renderWithProviders.tsx`, el `NavLink` necesita router) y sembrar `localStorage` en el
  `beforeEach` del propio archivo, nunca dentro del `it` (regla de `frontend/AGENTS.md`).

## 4. Sidebar: scroll discreto

- [x] 4.1 Agregar la utilidad `.subtle-scrollbar` en `@layer utilities` de
  `frontend/src/index.css` (junto a `.warm-scrollbar`, ~línea 201): `scrollbar-width: thin` +
  `scrollbar-color` de bajo contraste sobre track transparente, y en WebKit thumb de ~6px sin borde
  ni gradiente (dec. D7).
- [x] 4.2 Agregar un comentario sobre `.warm-scrollbar` aclarando que es la scrollbar de superficies
  de contenido (`SpotlightSearch.tsx`, `Reports.tsx`) y que las superficies de navegación usan
  `.subtle-scrollbar`.
- [x] 4.3 Reemplazar `warm-scrollbar` por `subtle-scrollbar` en el `<aside>` de
  `frontend/src/components/Sidebar.tsx:57`, sin tocar `overflow-y-auto` (es lo que garantiza que sin
  desborde no haya barra). No modificar los usos de `warm-scrollbar` en
  `frontend/src/components/SpotlightSearch.tsx:137,180` ni en `frontend/src/pages/Reports.tsx:546`.
- [x] 4.4 Verificar los dos escenarios de la spec: con el viewport alto (contenido entra completo)
  no aparece ninguna barra; con el viewport bajo (~600px de alto) se puede scrollear y la barra es
  fina y de bajo contraste.
  **Verificado en /opsx:verify** (verification.md): PASA en ambos escenarios (1440×550 y
  1440×1200).

## 5. Layout unificado del shell autenticado

- [x] 5.1 En `frontend/src/App.jsx:59`, dejar el `<main>` solo con los offsets estructurales:
  `className="app-main-shell-bg min-h-screen pt-14 lg:pl-64"` (quitar `px-4 pb-6`), con un
  comentario corto de por qué `pt-14`/`lg:pl-64` se quedan ahí (Topbar y Sidebar fijos) y los
  gutters no.
- [x] 5.2 En el mismo `<main>`, envolver el `<Suspense>` con el contenedor único
  `<div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">`, dejando `<Footer />`
  **fuera** de ese div y como hijo directo del `<main>` (dec. D1/D4).
- [x] 5.3 Quitar `mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8` del wrapper raíz de
  `frontend/src/pages/Dashboard.tsx:280`, dejando solo `space-y-6`.
- [x] 5.4 Quitar `mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8` del wrapper raíz de
  `frontend/src/pages/Routines.tsx:634`, dejando solo `space-y-6`.
- [x] 5.5 Quitar `mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8` del wrapper raíz de
  `frontend/src/pages/UserRoutine.tsx:172`, dejando solo `space-y-6` (la vista pasa a 7xl por
  dec. D2).
- [x] 5.6 Quitar `mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8` del wrapper raíz de
  `frontend/src/pages/NewCoach.tsx:91`, dejando solo `space-y-6`.
- [x] 5.7 Confirmar que `Clients.tsx:130`, `Payments.tsx:251`, `Attendance.tsx:103`,
  `Reports.tsx:238` y `Settings.tsx:243` **no requieren cambios** (su `space-y-8` se mantiene; el
  gutter y el `max-w` ahora los hereda del shell). No tocar los estados de `loading` de ninguna
  página (`Routines.tsx:624`, `UserRoutine.tsx:162`, `Settings.tsx:235`).
- [ ] 5.8 Verificar los tres escenarios de la spec en el navegador: (a) navegar Dashboard →
  Clientes → Pagos → Asistencia → Rutinas → Reportes → Ajustes en mobile (~390px) y comprobar que
  el gutter es idéntico; (b) medir en devtools que el padding horizontal del contenido es 16px
  (mobile) y no 32px, es decir sin suma de contenedores anidados; (c) en ≥1440px comprobar que el
  ancho del contenido es el mismo en todas las vistas.
  **No verificable sin navegador — pendiente de QA en /opsx:verify.**

## 6. Cierre y verificación

- [x] 6.1 Documentar en `frontend/AGENTS.md`: el contenedor de layout del shell vive en `App.jsx`
  (una vista nueva no necesita padding propio) y los tokens de shadcn (`border-input`, `ring-ring`,
  `text-muted-foreground`, `dark:bg-input/30`) hoy no generan CSS porque falta el bloque `@theme`
  en `index.css`.
- [x] 6.2 Correr `npm run lint` y `npm run build` dentro de `frontend/` sin errores (el lint es el
  que atrapa los imports muertos de la task 3.2).
- [x] 6.3 Correr `make test-frontend` desde la raíz y que pase, incluido el test nuevo de 3.3.
