import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RowActionButtonProps = {
  icon: LucideIcon;
  label: string;
  tone?: "neutral" | "destructive";
  disabledReason?: string;
  onClick: () => void;
};

// Único punto de decisión de forma/tinte/nombre accesible para una acción de
// fila (design.md D1 de unify-row-action-icons). API cerrada a propósito: no
// expone `className`, `variant` ni `children` — si una acción necesita
// escaparse de este patrón, no es una acción de fila.
export default function RowActionButton({
  icon: Icon,
  label,
  tone = "neutral",
  disabledReason,
  onClick,
}: RowActionButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={cn(
        "rounded-full",
        tone === "destructive" &&
          "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/10 dark:border-destructive/30 dark:hover:bg-destructive/20"
      )}
      aria-label={label}
      title={disabledReason ?? label}
      disabled={Boolean(disabledReason)}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}
