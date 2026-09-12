## 1. Base compartida: componente y utilidad de test

- [x] 1.1 Crear `frontend/src/components/RowActionButton.tsx` con la API cerrada de D1
      (`icon: LucideIcon`, `label: string`, `tone?: "neutral" | "destructive"`,
      `disabledReason?: string`, `onClick: () => void`), sin exponer `className`, `variant` ni
      `children`.
- [x] 1.2 Fijar dentro de `RowActionButton` el tratamiento visual: `type="button"`,
      `variant="outline"`, `size="icon-sm"`, `rounded-full` por `className` (D9, sin tocar
      `frontend/src/components/ui/button.tsx`), icono con `className="h-3.5 w-3.5"` y, cuando
      `tone === "destructive"`, el tinte
      `border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20`.
- [x] 1.3 Implementar en `RowActionButton` la regla de nombres de D3/D4: `aria-label={label}`
      siempre y `title={disabledReason ?? label}`, con `disabled` activo cuando viene
      `disabledReason`.
- [x] 1.4 Agregar `getRowByText(text: string | RegExp, selector = "tr"): HTMLElement` a
      `frontend/src/test/renderWithProviders.tsx` (D5): resuelve
      `screen.getByText(text).closest(selector)` y lanza un error explícito si no encuentra el
      contenedor.
- [x] 1.5 Crear `frontend/src/components/__tests__/RowActionButton.test.tsx` con el caso
      `expone el verbo como unico nombre accesible y como title`.
- [x] 1.6 Agregar en `RowActionButton.test.tsx` el caso
      `aplica el tinte destructivo solo cuando tone es destructive`.
- [x] 1.7 Agregar en `RowActionButton.test.tsx` el caso
      `deshabilita el boton y usa el motivo como title cuando viene disabledReason`.
- [x] 1.8 Agregar en `RowActionButton.test.tsx` el caso
      `es un icon-button rounded-full sin texto visible`.

## 2. Users

- [x] 2.1 En `frontend/src/pages/Users.tsx`, reemplazar los icon-buttons `Eye` y `PencilLine` de
      la fila por `RowActionButton` (tono neutro) y normalizar sus labels a `"Ver"` y `"Editar"`,
      sin el nombre del usuario.
- [x] 2.2 En `frontend/src/pages/__tests__/Users.test.tsx`, actualizar el caso
      `el boton Ver de una fila navega a la ficha del usuario` al patrón canónico de D5
      (`getRowByText(...)` + `within(row).getByRole("button", { name: "Ver" })`), reemplazando la
      query por `/^ver perfil de ana gomez$/i`.

## 3. MembershipPlans

- [x] 3.1 En `frontend/src/pages/MembershipPlans.tsx`, migrar los icon-buttons `PencilLine` y
      `CircleDollarSign` a `RowActionButton` (tono neutro) con labels `"Editar"` y
      `"Agregar precio"` (D8); el `<h2>` del diálogo de precio conserva su copy actual.
- [x] 3.2 Convertir las acciones de texto Desactivar y Reactivar a `RowActionButton` con el toggle
      por `is_active`: `Ban` + `"Desactivar"` (tono destructivo) cuando el plan está activo,
      `RotateCcw` + `"Reactivar"` (tono neutro) cuando está inactivo.
- [x] 3.3 Pasar el caso `isLastActive` por `disabledReason="No se puede desactivar el último plan
      activo"` (D4), de modo que el botón quede `disabled` y el `title` exponga el motivo en vez
      del verbo.
- [x] 3.4 En `frontend/src/pages/__tests__/MembershipPlans.test.tsx`, actualizar el caso
      `abre el dialogo de nuevo precio y lo envia` para ubicar el botón con `getRowByText(...)` +
      `within(row).getByRole("button", { name: "Agregar precio" })`.
- [x] 3.5 Actualizar el caso `deshabilita desactivar cuando es el unico plan activo` al patrón de
      D5 y asertar que el botón scopeado a la fila está `disabled` y que su `title` es el motivo.
- [x] 3.6 Agregar el caso
      `muestra Reactivar en vez de Desactivar en la fila de un plan inactivo`, con un fixture que
      incluya un plan `is_active = false`, verificando por fila que expone `"Reactivar"` y no
      `"Desactivar"`.
- [x] 3.7 Dejar el caso existente de cardinalidad (`habilita desactivar con dos planes activos
      aunque falte X-Total-Count`) como única query global permitida por I6, con el nombre
      accesible actualizado a `"Desactivar"`.

## 4. Exercises

- [x] 4.1 En `frontend/src/pages/Exercises.tsx`, migrar el icon-button `PencilLine` a
      `RowActionButton` (tono neutro) con label `"Editar"`, sin el nombre del ejercicio.
- [x] 4.2 Convertir Desactivar y Reactivar a `RowActionButton` con el toggle por `is_active`:
      `Ban` + `"Desactivar"` (destructivo) / `RotateCcw` + `"Reactivar"` (neutro).
- [x] 4.3 Convertir la acción de texto Borrar a `RowActionButton` con `Trash2` + `"Borrar"` (tono
      destructivo, D7), conservando el copy actual del diálogo de confirmación
      (`"Borrar ejercicio"`, `confirmLabel="Borrar"`).
- [x] 4.4 En `frontend/src/pages/__tests__/Exercises.test.tsx`, actualizar el caso
      `muestra el archivo propio cuando el ejercicio tiene archivo y URL externa` al patrón de D5,
      reemplazando la query por `"Editar Press de banca"`.
- [x] 4.5 Actualizar el caso `ofrece desactivar en vez de borrar cuando el ejercicio está en uso`
      al patrón de D5, con la fila scopeada por `getRowByText(...)` y el botón del diálogo por
      `within(dialog)`.
- [x] 4.6 Agregar el caso `muestra las tres acciones de fila como icon-buttons sin texto`,
      verificando en una fila la presencia de `"Editar"`, `"Desactivar"` y `"Borrar"` como
      botones sin texto visible (I1).

## 5. Payments

- [x] 5.1 En `frontend/src/pages/Payments.tsx`, convertir la acción de texto Anular a
      `RowActionButton` con `Ban` + `"Anular"` y tono destructivo, sin cambiar la condición de
      visibilidad por rol ni la mutación que dispara (I3).
- [x] 5.2 En `frontend/src/pages/__tests__/Payments.test.tsx`, actualizar el caso
      `oculta la accion de anular para un Coach` para asertar la ausencia del botón `"Anular"`
      dentro de la fila (D5), no globalmente por texto.
- [x] 5.3 Actualizar el caso `anula un pago como Dueno tras confirmar` para disparar la acción
      desde `within(row).getByRole("button", { name: "Anular" })` y confirmar desde
      `within(dialog)`, dado que fila y diálogo comparten el verbo.

## 6. MemberTemplatesCard

- [x] 6.1 En `frontend/src/components/MemberTemplatesCard.tsx`, convertir el `.map()` de
      asignaciones en `<ul>` + `<li>` con `list-none` (D6), sin cambio visual.
- [x] 6.2 Convertir "Ajustar base" a `RowActionButton` con `SlidersHorizontal` + label
      `"Ajustar base"` y tono neutro.
- [x] 6.3 Convertir "Quitar" a `RowActionButton` con `Trash2` + label `"Quitar"` y tono
      destructivo, eliminando el string de clases destructivas escrito a mano en este archivo.
- [x] 6.4 En `frontend/src/components/__tests__/MemberTemplatesCard.test.tsx`, actualizar el caso
      `pide confirmacion antes de quitar una asignacion` para usar
      `getRowByText("<nombre de la plantilla>", "li")` + `within(row)`.
- [x] 6.5 Agregar el caso `ofrece ajustar base y quitar como icon-buttons en cada asignacion`,
      verificando por `<li>` que ambos botones existen con su verbo como nombre accesible y sin
      texto visible.

## 7. Verificación

- [x] 7.1 Revisar el diff completo contra los invariantes I1–I7 del Plan de verificación: sin
      texto de etiqueta en acciones de fila, `aria-label` de solo verbo, mutaciones intactas,
      tintes según el mapeo, `isLastActive` deshabilitado con motivo, sin queries globales por
      verbo (salvo la cardinalidad de `MembershipPlans`) y `ui/button.tsx` sin cambios.
- [x] 7.2 Ejecutar el procedimiento manual del Plan de verificación: `make dev`, entrar como
      Dueño (`dev.owner@miniespacio.local` / `devdev123`) y recorrer `/users`, `/plans`,
      `/exercises`, `/payments` y la ficha de un miembro con plantillas, verificando ausencia de
      texto, tooltip en hover, tintes destructivos y el Desactivar deshabilitado con un solo plan
      activo.
- [x] 7.3 Correr `make check-plan CHANGE=unify-row-action-icons`, `make lint` y `make test` y
      dejarlos en verde; `check-plan` hoy reporta FALLA porque los casos de test del plan todavía
      no existen en disco y debe pasar una vez implementados los grupos 1 a 6.

## 8. Correcciones post-verificación

- [x] 8.1 En `frontend/src/components/RowActionButton.tsx`, agregar al string del tono destructivo
      las variantes `dark:bg-destructive/10 dark:border-destructive/30
      dark:hover:bg-destructive/20` (D11), sin tocar
      `frontend/src/components/ui/button.tsx` (I7).
- [x] 8.2 En `RowActionButton`, envolver el `onClick` recibido en un handler propio que llame a
      `event.stopPropagation()` antes de invocarlo (D10), manteniendo la prop pública como
      `onClick: () => void` y la API cerrada de D1.
- [x] 8.3 Agregar en `frontend/src/components/__tests__/RowActionButton.test.tsx` el caso
      `mantiene el tinte destructivo en modo dark`, asertando sobre el `classList` renderizado que
      están `dark:bg-destructive/10` y `dark:border-destructive/30` y que `tailwind-merge` descartó
      `dark:bg-input/30` y `dark:border-input`.
- [x] 8.4 Agregar en `RowActionButton.test.tsx` el caso
      `no propaga el click a la fila que lo contiene`: renderizar el botón dentro de un contenedor
      con `onClick` espiado, clickear el botón y verificar que corre el `onClick` del botón y no el
      del contenedor.
- [x] 8.5 En `frontend/src/pages/Routines.tsx`, reemplazar el `<Button size="sm">` de la celda de
      acciones (hoy con texto "Ver" y `aria-label={`Ver plantilla ${template.name}`}`) por
      `RowActionButton` con `icon={Eye}`, `label="Ver"` y tono neutro, dejando el `onClick` como
      `() => navigate(`/routines/${template.id}`)` sin `stopPropagation` en el call site (lo
      resuelve el componente, D10). La fila sigue clickeable y con `cursor-pointer`.
- [x] 8.6 En `frontend/src/pages/__tests__/Routines.test.tsx`, corregir el caso
      `abre el detalle de la plantilla al hacer click en la fila` para que clickee efectivamente la
      fila (`getRowByText("Fuerza 4 días")`) y no el botón, como hace hoy.
- [x] 8.7 Agregar en `Routines.test.tsx` el caso `abre el detalle desde el boton Ver de la fila`,
      disparando `within(row).getByRole("button", { name: "Ver" })` según el patrón canónico de D5
      y verificando que se llega al detalle.
- [x] 8.8 Agregar en `Routines.test.tsx` el caso
      `muestra la accion Ver de la fila como icon-button sin texto`, verificando por fila que el
      botón tiene nombre accesible exactamente `Ver` y no muestra texto visible (I1, I8).
- [x] 8.9 Revisar los invariantes agregados I8–I11 sobre el diff: acción de fila de `Routines`
      como icon-button con fila clickeable, sin navegación duplicada, tinte destructivo presente en
      `dark:` y `RoutineTemplateDetail.tsx` sin cambios.
- [x] 8.10 Volver a correr `make check-plan CHANGE=unify-row-action-icons`, `make lint` y
      `make test`, y dejar los tres en verde.
