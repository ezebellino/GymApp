import { useEffect, useState } from "react";
import { CircleDollarSign } from "lucide-react";
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
  useAddMembershipPlanPriceMutation,
  useMembershipPlanQuery,
} from "@/services/membershipPlans.queries";
import { toastSuccess } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings";
import type { MembershipPlan } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: MembershipPlan;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("es-AR")}`;
}

// Agregar precio (design D2/I1): inserta una fila nueva en el historial, sin
// tocar ninguna anterior. El historial completo se muestra abajo para que
// quede claro que esto agrega, no pisa el precio vigente.
export default function NewPlanPriceDialog({ open, onOpenChange, plan }: Props) {
  const currency = useSettingsStore((s) => s.settings.currency);
  const [amount, setAmount] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const { data: detail } = useMembershipPlanQuery(open ? plan.id : undefined);
  const addPriceMutation = useAddMembershipPlanPriceMutation();

  useEffect(() => {
    if (open) {
      setAmount("");
      setEffectiveFrom(todayIso());
      setError(null);
    }
  }, [open]);

  const canSubmit = amount.trim() !== "" && Number(amount) >= 0 && effectiveFrom.trim() !== "";

  async function save() {
    setError(null);
    try {
      await addPriceMutation.mutateAsync({
        id: plan.id,
        input: { amount: Number(amount), effective_from: effectiveFrom },
      });

      onOpenChange(false);
      toastSuccess("Precio agregado", "El nuevo precio ya quedó registrado en el historial.");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  const history = detail?.price_history ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-surface-1 text-foreground">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            <CircleDollarSign className="h-3.5 w-3.5" />
            Nuevo precio
          </div>
          <DialogTitle className="pt-3 text-2xl font-semibold text-foreground">
            Agregar precio a {plan.name}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Esto agrega un valor nuevo al historial; ningún precio anterior se modifica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Monto ({currency})</label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Vigente desde</label>
              <Input
                type="date"
                min={todayIso()}
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
          </div>

          {history.length > 0 ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Historial de precios</p>
              <ul className="space-y-1 rounded-md border border-border bg-surface-2/20 p-3 text-sm">
                {history.map((price) => (
                  <li key={price.id} className="flex justify-between text-foreground">
                    <span>{formatAmount(price.amount, currency)}</span>
                    <span className="text-muted-foreground">
                      desde {formatDate(price.effective_from)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
          <Button onClick={save} disabled={addPriceMutation.isPending || !canSubmit}>
            {addPriceMutation.isPending ? "Guardando..." : "Agregar precio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
