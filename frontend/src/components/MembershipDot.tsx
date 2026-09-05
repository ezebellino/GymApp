import { cn } from "@/lib/utils";
import type { MembershipIndicator } from "@/types";

// Extraído de `Users.tsx` (dec. 9 de redesign-list-page-layout): Pagos y
// Asistencias lo van a necesitar cuando se reimplementen con el patrón "list
// page", y hoy está duplicado conceptualmente en `UserDetail.tsx`. Mapea
// directo `User.membership_indicator` del servidor — sin lógica propia, la
// precedencia (baja > mora) ya la resuelve el backend.
/* eslint-disable react-refresh/only-export-components -- constantes compartidas a propósito */
export const INDICATOR_LABEL: Record<MembershipIndicator, string> = {
  up_to_date: "Al día con la cuota",
  overdue: "En mora",
  suspended: "Membresía dada de baja",
  none: "Sin membresía",
};

// Clases enteramente semánticas (dec. 12 de redesign-list-page-layout): antes eran mitad crudas
// (`bg-emerald-500`/`bg-amber-500`) mitad token (`bg-destructive`), lo que `frontend/AGENTS.md`
// prohíbe explícitamente para lo que es token-driven. `--status-ok`/`--status-warn` resuelven a
// un tono más oscuro en light (paso 700) para cumplir el mínimo de contraste 3:1 de WCAG 1.4.11
// sin cambiar el markup, el `role="img"` ni el `aria-label` de más abajo.
export const INDICATOR_DOT_CLASS: Record<
  Exclude<MembershipIndicator, "none">,
  string
> = {
  up_to_date: "bg-status-ok",
  overdue: "bg-status-warn",
  suspended: "bg-status-danger",
};

export default function MembershipDot({
  indicator,
}: {
  indicator: MembershipIndicator;
}) {
  if (indicator === "none") return null;
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
        INDICATOR_DOT_CLASS[indicator]
      )}
      title={INDICATOR_LABEL[indicator]}
      aria-label={INDICATOR_LABEL[indicator]}
      role="img"
    />
  );
}
