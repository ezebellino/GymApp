import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// `tailwind-merge` stock no conoce los nueve tamaños custom que
// `index.css` declara en `@theme inline` (`--text-headline-hero`,
// `--text-headline-lg`, etc.): sin esta extensión, cae en el grupo
// `text-color` por default y un `text-*-foreground` posterior en el mismo
// `cn()` lo elimina en silencio — el bug real que tumbó el escenario
// "Encabezado de columnas con la tipografía de Asistencias" (hallazgo 1 de
// verification.md, dec. 20 de redesign-list-page-layout): `STICKY_HEAD_CLASS`
// pasaba `text-label-caps` y `text-muted-foreground` por el mismo `cn()`, y
// tailwind-merge se quedaba con el segundo, dejando el header en 14px sin
// tracking en vez de 11px / 0.08em.
//
// La lista de nombres de abajo es una copia de lo que declara `index.css`;
// un `--text-*` nuevo agregado ahí sin tocar acá reintroduce el mismo bug
// para ese token — cubierto por el test de drift en
// `lib/__tests__/utils.test.ts` (mismo patrón que el drift `NAV_ITEMS` ↔
// `routeImporters`, dec. 3).
const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "headline-hero",
            "headline-lg",
            "headline-md",
            "metric-kpi",
            "body-lg",
            "body-md",
            "body-sm",
            "label-caps",
            "label-code",
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs))
}

// Helper de formato de fecha compartido (hallazgo 2 de verification.md,
// add-membership-plans): los campos `date`-only del backend (`birth_date`,
// `plan_since`, `MembershipPlanPrice.effective_from`) llegan como
// "YYYY-MM-DD" sin hora. `new Date("YYYY-MM-DD")` los interpreta como
// medianoche UTC, y `toLocaleDateString` los renderiza en el huso horario
// local — en cualquiera detrás de UTC (Argentina, UTC-3) el día mostrado
// queda uno para atrás del guardado. Para ese formato armamos la fecha con
// sus componentes locales en vez de dejar que `Date` la interprete como UTC;
// un string con hora (`created_at`, `membership_start_date`, etc.) sigue el
// camino normal, donde sí corresponde mostrar la hora local real.
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

export function formatDate(value?: string | null): string {
  if (!value) return "-"
  if (DATE_ONLY_RE.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    return new Date(year, month - 1, day).toLocaleDateString("es-AR")
  }
  return new Date(value).toLocaleDateString("es-AR")
}
