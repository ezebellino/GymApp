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
