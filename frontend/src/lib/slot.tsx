import * as React from "react"

import { cn } from "@/lib/utils"

// Reemplazo minimo de @radix-ui/react-slot: fusiona las props de este
// componente con las de su unico hijo (className/style se combinan, los
// manejadores de evento se componen, el resto de props del hijo gana) en
// vez de envolverlo en un nodo extra. Cubre el mismo caso de uso que
// Button/Badge necesitan (`asChild`) sin traer la dependencia entera.
function mergeRefs<T>(...refs: Array<React.Ref<T> | null | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === "function") ref(node)
      else (ref as React.MutableRefObject<T | null>).current = node
    }
  }
}

function composeEventHandlers<E>(
  slotHandler?: (event: E) => void,
  childHandler?: (event: E) => void
) {
  if (!slotHandler) return childHandler
  if (!childHandler) return slotHandler
  return (event: E) => {
    slotHandler(event)
    childHandler(event)
  }
}

type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode
}

const Slot = React.forwardRef<HTMLElement, SlotProps>(
  ({ children, ...slotProps }, ref) => {
    if (!React.isValidElement(children)) {
      return React.Children.count(children) > 1
        ? React.Children.only(null)
        : null
    }

    const child = children as React.ReactElement<any> & { ref?: React.Ref<any> }
    const childProps = child.props ?? {}
    const merged: Record<string, unknown> = { ...slotProps, ...childProps }

    for (const key in slotProps) {
      const slotValue = (slotProps as Record<string, unknown>)[key]
      const childValue = childProps[key]
      if (key === "style") {
        merged.style = { ...(slotValue as object), ...(childValue as object) }
      } else if (typeof slotValue === "function" && typeof childValue === "function") {
        merged[key] = composeEventHandlers(slotValue as any, childValue as any)
      }
    }
    merged.className = cn(
      (slotProps as { className?: string }).className,
      childProps.className
    )

    return React.cloneElement(child, {
      ...merged,
      ref: ref ? mergeRefs(ref, child.ref) : child.ref,
    })
  }
)
Slot.displayName = "Slot"

export { Slot }
