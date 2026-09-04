# Verificación: fix-frontend-ui-consistency

**Fecha**: 2026-09-04
**Veredicto**: PASA CON RESERVAS
**Diff verificado**: working tree vs `HEAD` (`git diff HEAD`) — `frontend/AGENTS.md`,
`frontend/src/App.jsx`, `frontend/src/components/Sidebar.tsx`,
`frontend/src/components/ui/input.tsx`, `frontend/src/index.css`,
`frontend/src/pages/{Dashboard,NewCoach,Routines,UserRoutine}.tsx`, nuevo
`frontend/src/components/__tests__/Sidebar.test.tsx`.

## Escenarios de la spec

| Capability / Escenario | Cómo se verificó | Resultado |
|---|---|---|
| app-shell / Sidebar sin "Atajos" — rol Dueño | Playwright real, login owner, inspección de texto del `<aside>` | PASA |
| app-shell / Sidebar sin "Atajos" — rol Coach | Playwright real, login coach, inspección de texto del `<aside>` | PASA |
| app-shell / Scroll discreto — contenido excede viewport | Viewport 1440×550, medición `scrollHeight` vs `clientHeight` + `scrollbar-width`/`scrollbar-color` computados | PASA |
| app-shell / Scroll discreto — contenido entra completo | Viewport 1440×1200, `scrollHeight === clientHeight` | PASA |
| app-shell / Layout — padding equivalente Dashboard vs otra vista | Medición de padding del contenedor en 8 rutas × 2 viewports (1440px, 375px) | PASA |
| app-shell / Layout — sin padding duplicado | Medición del wrapper raíz de cada página (`padding: 0`, `max-width: none`) en las 8 rutas | PASA |
| app-shell / Layout — ancho máximo equivalente en pantalla ancha | Medición a 2200px: `width=1280px` (`max-w-7xl`) idéntico en 3 rutas incluida `/my-routine` | PASA |
| login-view / Contraste — texto tipeado manualmente | Screenshot + `color`/`background-color` computados sobre el input | PASA |
| login-view / Contraste — foco antes de tipear | Screenshot + estilos computados en foco sin tipear | PASA |
| login-view / Contraste — autocompletado navegador/gestor de contraseñas | Sin gestor de contraseñas disponible en el entorno de QA (perfiles limpios); solo evidencia indirecta de código (`index.css:97-123`) | NO VERIFICABLE |

Detalle completo con evidencia (Playwright aislado en scratchpad, credenciales usadas
`manga_aguirre`/`coach_qa`/`cliente.qa.test@example.com`) en la transcripción del agente QA de esta
verificación.

## Hallazgos

Ninguno bloqueante. Del Code Reviewer:

1. **[menor]** `frontend/src/App.jsx:59-63` — el comentario nuevo dice que `pt-14` compensa un
   Topbar "fijo", pero `Topbar.tsx:79` es `sticky top-0`, no `fixed` (ocupa lugar en el flujo).
   Si es así, `pt-14` sería un offset vertical duplicado (contenido arrancando a ~112px del top,
   scroll vertical permanente incluso en vistas vacías) — preexistente al change, pero este
   change es el que lo documenta como "necesario" en un comentario, blindando en el eje vertical
   la misma clase de duplicación que el change vino a eliminar en el horizontal. Sugerido:
   confirmar con devtools el `offsetTop` real y, si se confirma, corregir el comentario o el
   offset (fuera del alcance estricto de este change, pero vale un follow-up). — **Resuelto**: el
   comentario ahora describe cada offset por separado — `lg:pl-64` compensa que `Sidebar` es
   `fixed` (no ocupa lugar en el flujo) y `pt-14` compensa la altura de `Topbar`, que es `sticky`
   (sí ocupa lugar en el flujo) — sin afirmar que Topbar es "fijo". El `pt-14`/layout en sí no se
   tocó, queda fuera de alcance de este change.
2. **[menor]** `frontend/src/components/__tests__/Sidebar.test.tsx:22-45` — los dos `it` (owner y
   coach) tienen aserciones idénticas que no dependen del rol realmente sembrado; no verifican
   "Vista Dueño" / "Vista Coach" en el bloque "Contexto", que es lo que la spec pide distinguir
   por escenario. Si `user_role` cambiara de clave en `stores/session.ts`, ambos tests seguirían
   en verde sin haber ejercitado el rol. — **Resuelto**: se agregó `expect(screen.getByText("Vista
   Dueño"))` al test de owner y `expect(screen.getByText("Vista Coach"))` al de coach.
3. **[menor]** `frontend/AGENTS.md` — el bullet "Cobertura actual" de tests no menciona el nuevo
   `Sidebar.test.tsx` (regla propia del repo: "si agregás tests, documentalo"). — **Resuelto**: se
   agregó `Sidebar` (accesos ocultos y bloque Contexto por rol) al bullet de cobertura actual.
4. **[informativo]** El `max-w-7xl` del contenedor único ahora también acota (por primera vez)
   `Clients`, `Payments`, `Attendance`, `Reports`, `Settings`, que antes eran full-bleed — en
   ≥1600px la tabla de `Reports.tsx` pierde ancho y el contenido deja de alinearse con el Topbar
   full-bleed. Es consecuencia buscada de la spec (dec. D2 de `design.md`), no un bug, pero no
   estaba anotado en `Risks` de `design.md`.
5. **[informativo]** `docs/` aparece sin trackear en el working tree, sin relación con este
   change — cuidado que no se cuele en el commit.

## Sin verificar

- **Autocompletado real del gestor de contraseñas del navegador** (login-view): el entorno de QA
  no tiene un gestor de contraseñas ni perfil de Chrome con credenciales guardadas para disparar
  `:-webkit-autofill`/`:autofill` con datos reales. El fix de código (`index.css:97-123`, dos
  bloques separados con `-webkit-text-fill-color: var(--foreground)`) está presente y es
  consistente con el mecanismo de `design.md` (dec. D5/M4), pero no se ejercitó en vivo. Task 2.6
  (M5 condicional) tampoco se evaluó por la misma razón — queda condicionada a que alguien lo
  reproduzca con un gestor de contraseñas real.
