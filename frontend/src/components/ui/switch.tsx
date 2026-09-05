import * as React from "react"

import { cn } from "@/lib/utils"

// Reemplaza @radix-ui/react-switch: un <button role="switch"> nativo ya
// resuelve teclado (Espacio/Enter activan un botón) y foco; solo hace falta
// sincronizar aria-checked/data-state a mano. Mismas clases que la versión
// con Radix, controlada u no-controlada segun si se pasa `checked`.
type SwitchProps = Omit<
  React.ComponentProps<"button">,
  "onChange" | "children" | "type"
> & {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

function Switch({
  className,
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  onClick,
  ...props
}: SwitchProps) {
  const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked)
  const isControlled = checked !== undefined
  const isChecked = isControlled ? checked : uncontrolledChecked

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || disabled) return

    const next = !isChecked
    if (!isControlled) setUncontrolledChecked(next)
    onCheckedChange?.(next)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      data-slot="switch"
      data-state={isChecked ? "checked" : "unchecked"}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span
        data-slot="switch-thumb"
        data-state={isChecked ? "checked" : "unchecked"}
        className="bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
      />
    </button>
  )
}

export { Switch }
