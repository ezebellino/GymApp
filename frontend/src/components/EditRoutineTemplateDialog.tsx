import { useEffect, useState } from "react";
import { PencilLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useTrainingDaysQuery,
  useUpdateRoutineTemplateMutation,
} from "@/services/routineTemplates.queries";
import { toastSuccess } from "@/lib/toast";
import type { RoutineTemplateDetail } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: RoutineTemplateDetail;
};

// Edición de plantilla: nombre, etiqueta y agregar/quitar días (design.md
// D11 de add-routine-templates). Igual manejo del 409 de nombre duplicado
// que `CreateRoutineTemplateDialog`. Quitar/agregar un día NO toca la
// configuración de ejercicios de ningún día (invariante I1) — eso lo
// garantiza el backend, este diálogo solo manda `day_ids`.
export default function EditRoutineTemplateDialog({ open, onOpenChange, template }: Props) {
  const [name, setName] = useState(template.name);
  const [tag, setTag] = useState(template.tag);
  const [selectedDayIds, setSelectedDayIds] = useState<string[]>(
    template.days.map((day) => day.day_id)
  );
  const [error, setError] = useState<string | null>(null);

  const { data: days } = useTrainingDaysQuery();
  const updateMutation = useUpdateRoutineTemplateMutation();

  useEffect(() => {
    if (open) {
      setName(template.name);
      setTag(template.tag);
      setSelectedDayIds(template.days.map((day) => day.day_id));
      setError(null);
    }
  }, [open, template]);

  function toggleDay(dayId: string) {
    setSelectedDayIds((current) =>
      current.includes(dayId)
        ? current.filter((id) => id !== dayId)
        : [...current, dayId]
    );
  }

  const orderedDays = Array.isArray(days) ? days : [];
  const canSubmit = name.trim().length > 0 && selectedDayIds.length > 0;

  async function save() {
    setError(null);
    try {
      const dayIds = orderedDays
        .filter((day) => selectedDayIds.includes(day.id))
        .map((day) => day.id);

      await updateMutation.mutateAsync({
        id: template.id,
        input: { name: name.trim(), tag: tag.trim(), day_ids: dayIds },
      });

      onOpenChange(false);
      toastSuccess("Plantilla actualizada", "Los cambios ya se ven reflejados.");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface-1 text-foreground">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            <PencilLine className="h-3.5 w-3.5" />
            Editar plantilla
          </div>
          <DialogTitle className="pt-3 text-2xl font-semibold text-foreground">
            Editar plantilla
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Cambiá el nombre, la etiqueta o los días que incluye.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Nombre</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Etiqueta</label>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} maxLength={24} />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Días</label>
            <div className="space-y-2">
              {orderedDays.map((day) => (
                <label
                  key={day.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface-2/20 px-3 py-2 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={selectedDayIds.includes(day.id)}
                    onChange={() => toggleDay(day.id)}
                    className="h-4 w-4 rounded border-border"
                  />
                  {day.name}
                  {day.muscle_groups.length > 0 ? (
                    <span className="text-muted-foreground">
                      · {day.muscle_groups.join(" / ")}
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={updateMutation.isPending || !canSubmit}>
            {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
