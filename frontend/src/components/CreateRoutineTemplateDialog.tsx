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
import { useCreateRoutineTemplateMutation } from "@/services/routineTemplates.queries";
import { toastSuccess } from "@/lib/toast";
import type { RoutineTemplateDetail } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (template: RoutineTemplateDetail) => void;
};

// Alta de plantilla: solo nombre y etiqueta (`template-owned-routine-days`,
// design D6). Sin selección de días: el backend crea la plantilla y su
// Día 1 en el mismo request — se configura desde el detalle.
export default function CreateRoutineTemplateDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateRoutineTemplateMutation();

  useEffect(() => {
    if (open) {
      setName("");
      setTag("");
      setError(null);
    }
  }, [open]);

  const canSubmit = name.trim().length > 0;

  async function save() {
    setError(null);
    try {
      const template = await createMutation.mutateAsync({
        name: name.trim(),
        tag: tag.trim(),
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
            Elegí un nombre y una etiqueta corta. Los días se configuran después, desde el
            detalle de la plantilla.
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
