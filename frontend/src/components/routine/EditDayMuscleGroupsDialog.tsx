import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { dayTitle } from "@/lib/routineDraft";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayIndex: number;
  options: string[];
  selected: string[];
  onSave: (muscleGroups: string[]) => void;
};

// Multi-check de grupos musculares de un día del borrador
// (`RoutineDaysEditor`): reemplaza la fila de badges siempre visible por un
// diálogo que se abre desde el lápiz del header del día. No pega ningún
// request — confirma contra el reducer del borrador.
export default function EditDayMuscleGroupsDialog({
  open,
  onOpenChange,
  dayIndex,
  options,
  selected,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<string[]>(selected);

  useEffect(() => {
    if (open) setDraft(selected);
  }, [open, selected]);

  function toggle(group: string) {
    setDraft((current) =>
      current.includes(group) ? current.filter((g) => g !== group) : [...current, group],
    );
  }

  // Conserva el orden del catálogo para que el título del día no dependa del
  // orden en que se tocaron los checks.
  const ordered = options.filter((group) => draft.includes(group));
  const dayLabel = `Día ${dayIndex + 1}`;

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Grupos musculares · ${dayLabel}`}
      description="Elegí los grupos musculares que trabaja este día."
      confirmLabel="Guardar"
      pendingLabel="Guardando..."
      isPending={false}
      onConfirm={() => {
        onSave(ordered);
        onOpenChange(false);
      }}
    >
      {/* Preview en vivo del título del día: cada check se ve en el mismo
          formato que va a quedar en el header de la card (`dayTitle`). */}
      <div className="space-y-1 rounded-lg border border-border bg-surface-2/30 px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Título del día</p>
        <p aria-live="polite" className="text-sm font-medium text-foreground">
          {dayTitle(dayIndex, ordered)}
        </p>
      </div>

      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay grupos musculares configurados.</p>
      ) : (
        <div role="group" aria-label={`Grupos musculares del ${dayLabel}`} className="grid gap-1.5">
          {options.map((group) => {
            const checked = draft.includes(group);
            return (
              <button
                key={group}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(group)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  checked
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-surface-2/30 text-muted-foreground hover:bg-surface-2/60",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {checked ? <Check className="h-3 w-3" /> : null}
                </span>
                {group}
              </button>
            );
          })}
        </div>
      )}
    </ConfirmActionDialog>
  );
}
