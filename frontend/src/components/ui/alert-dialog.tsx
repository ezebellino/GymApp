import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useModalDialog } from "@/lib/use-modal-dialog"

// Reemplaza @radix-ui/react-alert-dialog sobre <dialog> nativo (ver
// use-modal-dialog.ts). A diferencia de Dialog, a propósito NO cierra al
// clickear afuera del contenido — el patrón alertdialog exige una respuesta
// explícita (Accion/Cancelar), Escape sigue funcionando como "cancelar".
// AlertDialogAction/Cancel ya no necesitan @radix-ui/react-slot: sin el
// primitivo de Radix debajo, son directamente un <Button>, no una fusión de
// props sobre otro elemento.
type AlertDialogContextValue = {
  open: boolean
  onOpenChange?: (open: boolean) => void
  titleId: string
  descriptionId: string
}
const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(
  null
)

function useAlertDialogContext(component: string) {
  const ctx = React.useContext(AlertDialogContext)
  if (!ctx) {
    throw new Error(`<${component}> debe usarse dentro de <AlertDialog>`)
  }
  return ctx
}

function AlertDialog({
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

  return (
    <AlertDialogContext.Provider value={value}>
      {children}
    </AlertDialogContext.Provider>
  )
}

function AlertDialogContent({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<"dialog"> & {
  size?: "default" | "sm"
}) {
  const { open, onOpenChange, titleId, descriptionId } =
    useAlertDialogContext("AlertDialogContent")
  const { ref, closing, dialogProps } = useModalDialog(open, onOpenChange)

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      data-slot="alert-dialog-content"
      data-size={size}
      data-state={open && !closing ? "open" : "closed"}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={cn(
        "group/alert-dialog-content grid max-h-[85vh] w-full max-w-[calc(100%-2rem)] gap-4 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-lg",
        open && !closing && "animate-in fade-in-0 zoom-in-95 duration-200",
        closing && "animate-out fade-out-0 zoom-out-95 duration-200",
        className
      )}
      {...dialogProps}
      {...props}
    >
      {children}
    </dialog>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const { titleId } = useAlertDialogContext("AlertDialogTitle")
  return (
    <h2
      id={titleId}
      data-slot="alert-dialog-title"
      className={cn(
        "text-lg font-semibold sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const { descriptionId } = useAlertDialogContext("AlertDialogDescription")
  return (
    <p
      id={descriptionId}
      data-slot="alert-dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-16 items-center justify-center rounded-md bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-8",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="alert-dialog-action"
      variant={variant}
      size={size}
      className={className}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="alert-dialog-cancel"
      variant={variant}
      size={size}
      className={className}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
}
