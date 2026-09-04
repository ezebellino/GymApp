import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Color de texto y placeholder explícitos (text-zinc-100 / placeholder:text-zinc-400) en
        // vez de tokens de shadcn: sin bloque `@theme` en index.css, `text-foreground` y
        // `placeholder:text-muted-foreground` no generan CSS acá (son no-ops). No los revivas sin
        // agregar ese bloque primero — y si corrés `shadcn add input --overwrite`, restaurá estas
        // dos clases a mano.
        "file:text-foreground text-zinc-100 placeholder:text-zinc-400 selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
