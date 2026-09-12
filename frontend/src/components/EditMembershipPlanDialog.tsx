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
import { useUpdateMembershipPlanMutation } from "@/services/membershipPlans.queries";
import { toastSuccess } from "@/lib/toast";
import type { MembershipPlan } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: MembershipPlan;
};

// Edición de nombre/descripción (design D2): nunca precio ni `is_active`, eso
// va por `NewPlanPriceDialog` y los endpoints de activar/desactivar. Mismo
// manejo del 409 de nombre duplicado que el alta.
export default function EditMembershipPlanDialog({ open, onOpenChange, plan }: Props) {
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useUpdateMembershipPlanMutation();

  useEffect(() => {
    if (open) {
      setName(plan.name);
      setDescription(plan.description ?? "");
      setError(null);
    }
  }, [open, plan]);

  const canSubmit = name.trim().length > 0;

  async function save() {
    setError(null);
    try {
      await updateMutation.mutateAsync({
        id: plan.id,
        input: { name: name.trim(), description: description.trim() || null },
      });

      onOpenChange(false);
      toastSuccess("Plan actualizado", "Los cambios ya se ven reflejados.");
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
            Editar plan
          </div>
          <DialogTitle className="pt-3 text-2xl font-semibold text-foreground">
            Editar plan
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Cambiá el nombre o la descripción. El precio se actualiza aparte, agregando un
            valor nuevo al historial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Nombre</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Descripción (opcional)</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
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
