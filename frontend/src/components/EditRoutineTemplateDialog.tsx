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
import { useUpdateRoutineTemplateMutation } from "@/services/routineTemplates.queries";
import { toastSuccess } from "@/lib/toast";
import type { RoutineTemplateDetail } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: RoutineTemplateDetail;
};

// Edición de nombre y etiqueta (`template-owned-routine-days`, design D6):
// toda la edición de días pasa por el borrador del detalle de plantilla
// (`RoutineTemplateDetail.tsx`), no por este diálogo.
export default function EditRoutineTemplateDialog({ open, onOpenChange, template }: Props) {
  const [name, setName] = useState(template.name);
  const [tag, setTag] = useState(template.tag);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useUpdateRoutineTemplateMutation();

  useEffect(() => {
    if (open) {
      setName(template.name);
      setTag(template.tag);
      setError(null);
    }
  }, [open, template]);

  const canSubmit = name.trim().length > 0;

  async function save() {
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: template.id,
        input: { name: name.trim(), tag: tag.trim() },
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
            Cambiá el nombre o la etiqueta. Los días se editan desde el detalle.
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
