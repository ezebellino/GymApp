import * as React from "react"

// Reemplaza el manejo de apertura/cierre que daban @radix-ui/react-dialog y
// @radix-ui/react-alert-dialog, sobre el <dialog> nativo (showModal/close ya
// resuelven foco atrapado, devolucion de foco al cerrar y aria-modal gratis
// en cualquier navegador con soporte de <dialog>). Lo que sí hay que
// sincronizar a mano:
// - showModal()/close() según la prop `open` (controlada por quien usa esto,
//   igual que antes con Radix).
// - Escape dispara el evento nativo `cancel` y cierra el dialogo al toque;
//   se previene ese cierre inmediato para poder animar la salida y se avisa
//   via `onOpenChange` en su lugar, como cualquier otro cierre.
// - Scroll-lock del body mientras esta abierto (Radix lo hacía solo).
// - `closing` expone la clase animate-out mientras se espera el
//   `animationend` antes de llamar a `close()` de verdad — sin esto el
//   dialogo desaparece de un frame al otro, sin animación de salida.
export function useModalDialog(
  open: boolean,
  onOpenChange?: (open: boolean) => void
) {
  const ref = React.useRef<HTMLDialogElement>(null)
  const [closing, setClosing] = React.useState(false)

  React.useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open) {
      setClosing(false)
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      setClosing(true)
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    onOpenChange?.(false)
  }

  const handleClose = () => {
    onOpenChange?.(false)
  }

  const closeNow = React.useCallback(() => {
    if (ref.current?.open) ref.current.close()
    setClosing(false)
  }, [])

  // Red de seguridad: si por lo que sea animationend nunca llega (jsdom en
  // tests, alguna combinacion rara de navegador/CSS), el dialogo no debe
  // quedar trabado "cerrando" para siempre con el foco atrapado y el scroll
  // bloqueado. duration-200 en las clases animate-out + margen.
  React.useEffect(() => {
    if (!closing) return
    const timeout = window.setTimeout(closeNow, 300)
    return () => window.clearTimeout(timeout)
  }, [closing, closeNow])

  const handleAnimationEnd = () => {
    if (closing) closeNow()
  }

  return {
    ref,
    closing,
    dialogProps: {
      onCancel: handleCancel,
      onClose: handleClose,
      onAnimationEnd: handleAnimationEnd,
    },
  }
}
