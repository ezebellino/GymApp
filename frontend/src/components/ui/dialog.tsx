import * as React from "react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useModalDialog } from "@/lib/use-modal-dialog"

// Reemplaza @radix-ui/react-dialog sobre <dialog> nativo (ver
// use-modal-dialog.ts para el detalle de foco/Escape/scroll-lock). Todos los
// call sites de este repo usan el patron controlado `open`/`onOpenChange`
// sin trigger descontrolado, así que no se reimplementan DialogTrigger,
// DialogPortal ni DialogOverlay — si alguna vista futura los necesita, se
// agregan ahí.
type DialogContextValue = {
  open: boolean
  onOpenChange?: (open: boolean) => void
  titleId: string
  descriptionId: string
}
const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialogContext(component: string) {
  const ctx = React.useContext(DialogContext)
  if (!ctx) {
    throw new Error(`<${component}> debe usarse dentro de <Dialog>`)
  }
  return ctx
}

function Dialog({
  open = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const titleId = React.useId()
  const descriptionId = React.useId()
  const value = React.useMemo(
    () => ({ open, onOpenChange, titleId, descriptionId }),
    [open, onOpenChange, titleId, descriptionId]
  )

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<"dialog"> & {
  showCloseButton?: boolean
}) {
  const { open, onOpenChange, titleId, descriptionId } =
    useDialogContext("DialogContent")
  const { ref, closing, dialogProps } = useModalDialog(open, onOpenChange)

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    // El <dialog> nativo no cierra solo al clickear afuera del contenido;
    // clickear el ::backdrop dispara el evento con target = el propio
    // <dialog> (nada del contenido lo intercepta antes), así que ese es el
    // chequeo para replicar el "click afuera cierra" de Radix.
    if (event.target === ref.current) onOpenChange?.(false)
  }

  return (
    <dialog
      ref={ref}
      data-slot="dialog-content"
      data-state={open && !closing ? "open" : "closed"}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={handleBackdropClick}
      className={cn(
        // `display` va condicionado por clase, nunca fijo en "grid": el
        // <dialog> nativo solo se auto-oculta (`dialog:not([open])
        // { display: none }`) via la hoja de estilos del user-agent, y esa
        // regla pierde contra CUALQUIER clase de autor que fije `display`
        // (el origen "author" gana sobre "UA" sin importar especificidad).
        // Si "grid" quedara siempre puesta, un <dialog> montado con
        // `open=false` (el patrón normal: montado una vez, alternado por
        // prop) se ve y es focuseable aunque nunca se llamó a showModal().
        open || closing ? "grid" : "hidden",
        // Idem con el centrado: la hoja de estilos del user-agent centra un
        // <dialog> mostrado con showModal() via `dialog:modal { position:
        // fixed; inset: 0; margin: auto }`, pero el preflight de Tailwind
        // resetea `margin` a 0 en todos los elementos — un author-origin que
        // también gana sobre esa regla de UA — y sin `margin: auto` el
        // `inset: 0` deja el dialogo pegado a la esquina superior izquierda
        // en vez de centrado. Fijar la posición acá, explícita, en vez de
        // depender del comportamiento nativo por default.
        "fixed inset-0 m-auto",
        "max-h-[85vh] w-full max-w-[calc(100%-2rem)] gap-4 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg sm:max-w-lg",
        open && !closing && "animate-in fade-in-0 zoom-in-95 duration-200",
        closing && "animate-out fade-out-0 zoom-out-95 duration-200",
        className
      )}
      {...dialogProps}
      {...props}
    >
      {children}
      {showCloseButton && (
        <button
          type="button"
          data-slot="dialog-close"
          onClick={() => onOpenChange?.(false)}
          className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </button>
      )}
    </dialog>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const { titleId } = useDialogContext("DialogTitle")
  return (
    <h2
      id={titleId}
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { descriptionId } = useDialogContext("DialogDescription")
  return (
    <p
      id={descriptionId}
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle }
