import { useEffect, useState } from "react";
import { LayoutTemplate } from "lucide-react";
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
  useCreateRoutineTemplateMutation,
  useTrainingDaysQuery,
} from "@/services/routineTemplates.queries";
import { toastSuccess } from "@/lib/toast";
import type { RoutineTemplateDetail } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (template: RoutineTemplateDetail) => void;
};

// Alta de plantilla: nombre, etiqueta y el subconjunto ordenado de días
// existentes del catálogo (design.md D1/D11 de add-routine-templates). Los
// `day_ids` se mandan siempre en el orden natural del catálogo (Día 1..4,
// `day_order`), no en el orden de click: es predecible y es lo que espera
// el escenario manual del Plan de verificación ("Día 1 y Día 4").
export default function CreateRoutineTemplateDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [selectedDayIds, setSelectedDayIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: days } = useTrainingDaysQuery();
  const createMutation = useCreateRoutineTemplateMutation();

  useEffect(() => {
    if (open) {
      setName("");
      setTag("");
      setSelectedDayIds([]);
      setError(null);
    }
  }, [open]);

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
      // Orden natural del catálogo (`day_order`), no el orden de click.
      const dayIds = orderedDays
        .filter((day) => selectedDayIds.includes(day.id))
        .map((day) => day.id);

      const template = await createMutation.mutateAsync({
        name: name.trim(),
        tag: tag.trim(),
        day_ids: dayIds,
      });

      onOpenChange(false);
      onCreated?.(template);
      toastSuccess("Plantilla creada", `${template.name} ya está disponible.`);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface-1 text-foreground">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            <LayoutTemplate className="h-3.5 w-3.5" />
            Nueva plantilla
          </div>
          <DialogTitle className="pt-3 text-2xl font-semibold text-foreground">
            Crear plantilla
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Elegí un nombre, una etiqueta corta y los días que va a incluir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Nombre</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fuerza 4 días"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Etiqueta</label>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="FUERZA"
              maxLength={24}
            />
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
          <Button onClick={save} disabled={createMutation.isPending || !canSubmit}>
            {createMutation.isPending ? "Creando..." : "Crear plantilla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
