import * as React from "react"

import { cn } from "@/lib/utils"

// Reemplaza @radix-ui/react-popover, sin portal, siguiendo el mismo patrón
// controlado de `dialog.tsx` (context con `open`/`onOpenChange`, sin trigger
// descontrolado). A diferencia de `Dialog`, esto NO es modal: no atrapa el
// foco ni bloquea el scroll del body, cierra con Escape, con click/tap
// afuera, y al perder el foco fuera del wrapper por Tab.
//
// Limitación declarada, importante para quien use este componente: al no
// tener portal, un `PopoverContent` queda clippeado dentro de cualquier
// ancestro con `overflow: auto/hidden` (por ejemplo, el div de scroll
// horizontal que usa `components/ui/table.tsx`). No montar este Popover
// dentro del cuerpo scrollable de una tabla — solo en superficies sin
// overflow propio (p. ej. el header de una `ListPageLayout`). Si aparece un
// caso real que lo necesite dentro de un contenedor con overflow, ahí sí se
// evalúa portal o `@floating-ui/react`.
type PopoverContextValue = {
  open: boolean
  onOpenChange?: (open: boolean) => void
  contentId: string
  triggerRef: React.RefObject<HTMLButtonElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null)

function usePopoverContext(component: string) {
  const ctx = React.useContext(PopoverContext)
  if (!ctx) {
    throw new Error(`<${component}> debe usarse dentro de <Popover>`)
  }
  return ctx
}

function Popover({
  open,
  onOpenChange,
  className,
  children,
}: {
  open: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  children?: React.ReactNode
}) {
  const contentId = React.useId()
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  const value = React.useMemo(
    () => ({ open, onOpenChange, contentId, triggerRef, contentRef }),
    [open, onOpenChange, contentId]
  )

  // Foco al contenido apenas abre (el trigger ya tenía el foco; el contenido
  // es `tabIndex={-1}`, focuseable solo programáticamente).
  React.useEffect(() => {
    if (open) contentRef.current?.focus()
  }, [open])

  // Escape cierra y devuelve el foco al trigger explícitamente: el popover
  // no es modal, así que el navegador no lo hace solo (a diferencia del
  // <dialog> nativo que usa `Dialog`).
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      onOpenChange?.(false)
      triggerRef.current?.focus()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  // Click/tap afuera cierra. `pointerdown`, no `click`: cierra antes de que
  // el click llegue a activar lo que sea que haya debajo del popover (mismo
  // criterio que Radix).
  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const wrapper = wrapperRef.current
      if (wrapper && !wrapper.contains(event.target as Node)) {
        onOpenChange?.(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open, onOpenChange])

  // Tab afuera del wrapper cierra (sin focus trap: no es modal). A
  // diferencia de Escape/click afuera, acá el foco ya se movió solo hacia
  // donde el usuario tabuló, así que no hay que devolverlo a ningún lado.
  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!open) return
    const next = event.relatedTarget as Node | null
    if (!next || !wrapperRef.current?.contains(next)) {
      onOpenChange?.(false)
    }
  }

  return (
    <PopoverContext.Provider value={value}>
      <div
        ref={wrapperRef}
        data-slot="popover"
        className={cn("relative inline-flex", className)}
        onBlur={handleBlur}
      >
        {children}
      </div>
    </PopoverContext.Provider>
  )
}

function PopoverTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const { open, onOpenChange, contentId, triggerRef } =
    usePopoverContext("PopoverTrigger")

  return (
    <button
      type="button"
      ref={triggerRef}
      data-slot="popover-trigger"
      aria-haspopup="dialog"
      aria-expanded={open}
      // Solo apunta al id real cuando el contenido está montado (hallazgo 8
      // de verification.md): `PopoverContent` retorna `null` mientras está
      // cerrado, así que `aria-controls={contentId}` sin condicionar
      // referenciaría un id inexistente en el DOM.
      aria-controls={open ? contentId : undefined}
      onClick={(event) => {
        onClick?.(event)
        onOpenChange?.(!open)
      }}
      className={className}
      {...props}
    />
  )
}

function PopoverContent({
  className,
  align = "start",
  "aria-labelledby": ariaLabelledBy,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  align?: "start" | "end" | "center"
}) {
  const { open, contentId, contentRef } = usePopoverContext("PopoverContent")

  // Cerrado: no renderiza nada (nada oculto pero focuseable en el DOM). A
  // diferencia del <dialog> nativo de `Dialog`, acá no hay hoja de estilos
  // del user-agent de por medio que obligue a mantenerlo montado.
  if (!open) return null

  return (
    <div
      ref={contentRef}
      id={contentId}
      data-slot="popover-content"
      role="dialog"
      // `aria-labelledby` no se auto-genera: a diferencia de `Dialog`
      // (que tiene `DialogTitle` para calzar el id), acá no hay un
      // subcomponente de título — el caller pasa el id de su propio nodo de
      // título, si tiene uno.
      aria-labelledby={ariaLabelledBy}
      tabIndex={-1}
      className={cn(
        "absolute top-full z-50 mt-2 animate-in fade-in-0 zoom-in-95 duration-150",
        "rounded-xl border border-border bg-surface-1 p-4 shadow-[var(--shadow-level-2)]",
        align === "start" && "left-0",
        align === "end" && "right-0",
        align === "center" && "left-1/2 -translate-x-1/2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
