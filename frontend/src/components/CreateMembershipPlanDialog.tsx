import { useEffect, useState } from "react";
import { BadgeDollarSign } from "lucide-react";
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
import { useCreateMembershipPlanMutation } from "@/services/membershipPlans.queries";
import { toastSuccess } from "@/lib/toast";
import { useSettingsStore } from "@/stores/settings";
import type { MembershipPlan } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (plan: MembershipPlan) => void;
};

// Alta de plan: nombre, descripción opcional y precio inicial obligatorio
// (design D2: un plan sin precio no sirve para nada). El 409 de nombre
// duplicado se muestra inline, mismo patrón que
// `CreateRoutineTemplateDialog` (otro alta con nombre único normalizado).
export default function CreateMembershipPlanDialog({ open, onOpenChange, onCreated }: Props) {
  const currency = useSettingsStore((s) => s.settings.currency);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateMembershipPlanMutation();

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setAmount("");
      setError(null);
    }
  }, [open]);

  const canSubmit = name.trim().length > 0 && amount.trim() !== "" && Number(amount) >= 0;

  async function save() {
    setError(null);
    try {
      const plan = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        amount: Number(amount),
      });

      onOpenChange(false);
      onCreated?.(plan);
      toastSuccess("Plan creado", `${plan.name} ya está disponible.`);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-surface-1 text-foreground">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            <BadgeDollarSign className="h-3.5 w-3.5" />
            Nuevo plan
          </div>
          <DialogTitle className="pt-3 text-2xl font-semibold text-foreground">
            Crear plan
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Elegí un nombre único, una descripción opcional y el precio inicial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Nombre</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Estudiante"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Descripción (opcional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Acceso libre de lunes a viernes"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Precio inicial ({currency})</label>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="30000"
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
            {createMutation.isPending ? "Creando..." : "Crear plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
