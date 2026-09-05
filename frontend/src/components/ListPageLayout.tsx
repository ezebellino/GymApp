import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

// Plantilla de layout puro (sin estado, sin datos) para vistas de listado con
// tabla (dec. 6 de redesign-list-page-layout): encabezado compacto de una
// sola fila, barra de filtros, cuerpo con scroll interno propio y un único
// pie de paginación. `Users.tsx` es el primer consumidor; Pagos y
// Asistencias adoptan el mismo patrón cuando se reimplementen.
//
// El componente NO define ancho, `max-w` ni `px`: los hereda del contenedor
// del shell (`app-container` en `App.jsx`) — no dupliques ese padding acá.
//
// Regla dura para `primaryAction` en viewports < 768px (requirement "Acción
// primaria solo con ícono en mobile"): el caller arma el botón con un
// `aria-label` FIJO (no solo en mobile) más un `<span className="hidden
// md:inline">` para el texto — `md:` (768px), no `sm:` (640px), porque la
// spec dice "menores a 768px" y en Tailwind `sm` = 640px dejaría el texto
// visible entre 640 y 768px. El `aria-label` tiene que ir siempre y no solo
// bajo `md:`: `hidden` es `display:none`, y un nodo con `display:none` queda
// fuera del cálculo del nombre accesible — sin el `aria-label` fijo el botón
// se queda sin nombre en el viewport donde se esconde el texto. Ejemplo:
//
//   <Button aria-label="Crear usuario" onClick={...}>
//     <UserPlus className="h-4 w-4 md:mr-2" />
//     <span className="hidden md:inline">Crear usuario</span>
//   </Button>
type ListPageLayoutProps = {
  title: ReactNode;
  titleAdornment?: ReactNode;
  count?: ReactNode;
  primaryAction?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

export default function ListPageLayout({
  title,
  titleAdornment,
  count,
  primaryAction,
  toolbar,
  footer,
  children,
}: ListPageLayoutProps) {
  return (
    // La `Card` es la raíz (reemplaza al `<section>` de antes): la vista
    // entera —encabezado, filtros, tabla y paginación— se lee como un único
    // panel Level 1, no como cuatro bloques sueltos con un recuadro en el
    // medio (dec. 18, corrige la dec. 15). `gap-4 p-4 sm:p-5` no coexiste con
    // el `py-6 gap-6` que trae `card.tsx` por default: `cn` de este repo es
    // `twMerge(clsx(...))` (`lib/utils.ts`), así que tailwind-merge elimina
    // el `py-6 gap-6` al ver `p-*`/`gap-4` explícitos — no hace falta (ni hay
    // que agregar) un `py-0 gap-0` aparte. `lg:h-[var(--list-page-height)]`
    // vive en esta misma raíz, no en un wrapper extra: con
    // `box-sizing: border-box` (preflight) el alto ya incluye el padding, así
    // que el footprint total de la vista no cambia.
    <Card className="flex flex-col gap-4 p-4 sm:p-5 lg:h-[var(--list-page-height)]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="font-display text-headline-md font-bold text-foreground">
            {title}
          </h1>
          {titleAdornment}
          {count && (
            <span className="inline-flex items-center rounded-full border border-border bg-surface-2/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {count}
            </span>
          )}
        </div>

        {primaryAction && <div className="shrink-0">{primaryAction}</div>}
      </header>

      {toolbar && <div>{toolbar}</div>}

      {/* Marco interno de la tabla: vuelve a ser un `div` sin fondo propio
          (la Card ya aporta la superficie) con `rounded-lg` (8px), un radio
          menor que el `rounded-xl` (16px) de la Card — el par
          panel/elemento-interno de la escala de radios del design doc, para
          evitar esquinas concéntricas mal calzadas (dec. 18). `min-h-0` no
          es opcional: el default `min-height: auto` de un ítem flex le
          impide encogerse por debajo de su contenido, y sin esto
          `flex-1 overflow-hidden` no scrollea — la tabla desborda el marco
          en vez de scrollear adentro (dec. 6.2). */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-border">
        {children}
      </div>

      {footer && <div className="shrink-0">{footer}</div>}
    </Card>
  );
}
