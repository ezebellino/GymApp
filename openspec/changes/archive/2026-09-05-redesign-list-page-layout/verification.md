# Verificación: redesign-list-page-layout

**Fecha**: 2026-09-05
**Veredicto**: PASA
**Diff verificado**: working tree sin commitear contra `87bda69` (rama `feat/kinetic-obsidian-theme`): 12 archivos modificados + 9 nuevos en `frontend/src/`, `frontend/AGENTS.md` y `docs/design/design.md`.

Suite automatizada: `make test` en verde (backend 60 passed; frontend 68 passed en 16 archivos);
`npm run lint` y `npm run build` en `frontend/` sin errores; `openspec validate --strict` válido.

## Historial del gate

1. **Primera pasada (FALLA)**: QA dio PASA a 30 escenarios con la app real, pero el Code Reviewer
   reprodujo en el DOM renderizado que el `th` de Usuarios perdía `text-label-caps` (tailwind-merge
   lo clasificaba como color y `text-muted-foreground` lo eliminaba): 14px sin tracking contra los
   11px / 0.08em de Asistencias. Falló el escenario "Encabezado de columnas con la tipografía de
   Asistencias". Se registraron 12 hallazgos (1 bloqueante, 3 mayores, 7 menores, 1 nota).
2. **Corrección**: Arquitecto escribió las decisiones 20 a 23 y el bloque 12 de `tasks.md`; Dev
   implementó 12.1 a 12.13; Product Owner registró el cambio del menú mobile en `proposal.md`
   con un requirement nuevo en `app-shell`, y acotó el scenario del encabezado de una fila a
   viewports de 640px o más (puntos 8 y 9 de `po-answers.md`).
3. **Re-verificación (PASA)**: Code Reviewer confirmó los 11 hallazgos cerrados con render real y
   CSS emitido, midió el blast radius del cambio de `cn` (15 combinaciones, sin cambio visual en
   otros call sites) y dio PASA CON RESERVAS por dos puntos de documentación y spec, ambos
   resueltos después. QA re-midió el escenario que había fallado, el requirement nuevo del menú
   mobile (Dueño y Coach) y la regresión del menú en <1024px, y dio PASA.

## Escenarios de la spec

| Escenario | Cómo se verificó | Resultado |
|---|---|---|
| app-shell / Bordes alineados con el contenido en desktop | UI 1280/1440/1920: `header > .app-container` y `main > .app-container` con el mismo `left`/`right`; borde derecho del toggle igual al de la card | PASA |
| app-shell / Sin línea divisoria continua entre el Sidebar y el Topbar | UI, ningún elemento de `aside` con `borderBottomWidth` a la altura del Topbar | PASA |
| app-shell / Placa de marca del Sidebar con margen superior | UI, `top = 16px` de la placa, mismo gutter que el nav | PASA |
| app-shell / Mismas secciones y mismo orden que el Sidebar (menú mobile) | UI 390 y 800px, Dueño y Coach (coach creado vía API): lista y orden idénticos al Sidebar, Reportes solo Dueño. Código: ambos consumen `navItemsForRole` | PASA |
| user-management / Ver el listado completo | UI, 14 usuarios con dot, contacto, rol, alta, inicio y acciones | PASA |
| user-management / Fecha de comienzo para quien no es miembro | UI, coaches y dueño muestran "-" | PASA |
| user-management / Contacto muestra el email cuando está cargado | UI, 10+ filas | PASA |
| user-management / Contacto muestra el teléfono cuando no hay email | UI, "SinEmail Test" → teléfono | PASA |
| user-management / Sin UUID visible en la fila | UI, regex UUID sobre `table.innerText` sin coincidencias | PASA |
| user-management / Encabezado de una fila (≥640px) | UI 1440: `h1("Usuarios") + trigger + pill("14 usuarios")` en una fila, botón a la derecha | PASA |
| user-management / Encabezado en dos filas debajo de 640px | Código: `ListPageLayout` header `flex-col sm:flex-row`; captura QA `users-mobile-390.png` con la acción en segunda fila. No medido numéricamente | PASA |
| user-management / Sin descripción debajo del título | UI, sin `<p>` bajo el `h1` | PASA |
| user-management / Sin hero de bienvenida | UI, `.hero-aura` ausente en Usuarios | PASA |
| user-management / Acción primaria solo con ícono en mobile | UI 390px, label `display:none`, `aria-label` fijo | PASA |
| user-management / La leyenda no es una card visible por defecto | UI, `role="dialog"` ausente hasta interacción | PASA |
| user-management / El ícono de información tiene nombre accesible | UI, `aria-label="Ver leyenda de roles y estados de membresía"` | PASA |
| user-management / Abrir el popover con click | UI, `role="dialog"` presente, `aria-expanded="true"` | PASA |
| user-management / Abrir el popover con teclado | UI, Enter y Espacio por separado. Test unitario afirma `tagName === "BUTTON"` | PASA |
| user-management / Cerrar el popover con Escape devuelve el foco | UI, `document.activeElement` es el trigger | PASA |
| user-management / La leyenda usa el mismo popover en mobile | UI 390px, mismo `role="dialog"` | PASA |
| user-management / Filtro sin label en mayúsculas | UI, sin "BUSCAR" en `body.innerText` | PASA |
| user-management / Todo el listado entra sin scroll de página en 1440x900 | UI, página `900 === 900`; tabla `593 === 593`; fila 10 `bottom 743 < footer 824` | PASA |
| user-management / Más filas que el alto disponible solo scrollean la tabla | UI 1440x700 con 14 filas: tabla `725 > 393`, página sin scroll, `th.top` fijo | PASA |
| user-management / Una sola paginación visible | UI, un único bloque "Mostrando" | PASA |
| user-management / Pie de tabla con rango a la izquierda y controles a la derecha | UI, misma fila | PASA |
| user-management / Encabezado de columnas con la tipografía de Asistencias | Re-verificado tras el fix de `cn`: `th` de Usuarios y Asistencias en dark y light con `font-size 11px`, `letter-spacing 0.88px`, `font-weight 700`, `uppercase`, mismo color; `padding-left` de `th` y `td` 16px | PASA |
| user-management / Toda la vista contenida en una card | UI, un solo `[data-slot="card"]` con header, filtro, tabla y pie | PASA |
| user-management / Acciones como botones de ícono con nombre accesible | UI, 3 botones por fila con `aria-label` con el nombre | PASA |
| user-management / WhatsApp deshabilitado sin teléfono | UI, "SinTelefono Test" → `disabled` con `title` | PASA |
| user-management / WhatsApp habilitado con teléfono | UI, tres usuarios con teléfono | PASA |
| user-management / Contraste AA en modo dark | oklch→sRGB sobre fondo real: dots 7.19 / 8.26 / 4.71; badges 10.8 / 11.66 / 11.59 | PASA |
| user-management / Contraste AA en modo light | Ídem: dots 5.37 / 5.05 / 4.83; badges 7.09 / 5.29 / 6.41 | PASA |

Regresión fuera de spec: Dashboard, Asistencias, Pagos, Ajustes, Rutinas y Usuarios sin errores
de consola; Asistencias conserva su paginación con rango; menú mobile a 390 y 800px empuja el
contenido (`main` primer hijo pasa de `top 65` a `434`, igual a `header.bottom`) sin línea doble;
header de 64px en desktop; badge del total en singular con un resultado ("1 usuario").

## Hallazgos

Todos los de la primera pasada quedaron cerrados y verificados en el DOM o CSS emitido:

1. **[bloqueante, cerrado]** `frontend/src/lib/utils.ts` — `cn` usaba `twMerge` sin conocer los
   tamaños custom del `@theme`; los nueve (`headline-*`, `metric-kpi`, `body-*`, `label-*`) se
   perdían ante cualquier `text-*-foreground` en el mismo `className`. Ahora `extendTailwindMerge`
   los declara en `font-size`, con test de drift contra `index.css` (`lib/__tests__/utils.test.ts`).
2. **[mayor, cerrado]** `Users.tsx` — `th` con `px-4`, alineado con las celdas.
3. **[mayor, cerrado]** `Topbar.tsx` — `lg:h-topbar` en el header y `h-topbar lg:h-full` en el
   interior: en <1024px el menú mobile vuelve a empujar el contenido; en desktop el header sigue en
   64px.
4. **[mayor, cerrado]** `docs/design/design.md` — sección List Page sin las afirmaciones revertidas
   por la dec. 19 y sin la frase incorrecta sobre el pill del header.
5. a 9. **[menores, cerrados]** comentario de `--spacing-topbar`; `frontend/AGENTS.md` actualizado
   (Users, `.app-container`, tests nuevos, `Popover`); test del popover renombrado con aserción
   real; `aria-controls` solo cuando está abierto; singular "1 usuario".
10. **[menor, cerrado por spec]** header en dos filas debajo de 640px: el Product Owner acotó el
    requirement y agregó el scenario correspondiente (punto 9 de `po-answers.md`).
11. **[menor, cerrado]** filtro por rol extraído a `navItemsForRole` en `lib/navigation.ts`,
    consumido por Sidebar y Topbar.
12. **[nota, cerrado por spec]** el menú mobile deriva de `NAV_ITEMS` ("Seguimiento" en lugar de
    "Dashboard", orden del Sidebar): registrado en `proposal.md` y como requirement de `app-shell`.

Observaciones aceptadas sin acción: debajo de `lg` el header mide 65px (64 + borde) contra el
descuento de 64 en `main`; ahí la página scrollea por diseño y el píxel no se percibe. La
aserción de `text-label-caps` en `utils.test.ts` copia los strings de `TableHead` y
`STICKY_HEAD_CLASS` como literales, no los importa.

## Sin verificar

- Menú mobile para rol Miembro. Owner y Coach probados; es la misma función `navItemsForRole`.
- Viewports mayores a 1920px.
- El scenario "Encabezado en dos filas debajo de 640px" se verificó por código y captura, no con
  medición numérica.
- Verificación hecha con Playwright directo porque el MCP `chrome-devtools` estaba tomado por otra
  sesión; misma app real en Docker, backend en el puerto 8010.

## Datos de desarrollo que quedaron

- QA creó el coach `coach.qaverif@example.com` en la base de dev para probar el menú mobile por
  rol (no hay endpoint de borrado de usuarios). Mismo patrón que los usuarios "QA Test" existentes.
