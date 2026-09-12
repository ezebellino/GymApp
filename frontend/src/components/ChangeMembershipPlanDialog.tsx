import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { Button } from "@/components/ui/button";
import { useMembershipPlansQuery } from "@/services/membershipPlans.queries";
import { useChangeUserPlanMutation } from "@/services/users.queries";
import { toastSuccess } from "@/lib/toast";
import type { User } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
};

// Cambio/asignación de plan desde la ficha (design D2/D4): mismo diálogo y
// mismo endpoint (`POST /users/{id}/plan`) sirve para "Cambiar plan" (el
// miembro ya tiene uno) y "Asignar plan" (caso preexistente sin plan, D3) —
// solo cambia el copy según si `user.membership_plan` está presente.
export default function ChangeMembershipPlanDialog({ open, onOpenChange, user }: Props) {
  const isAssign = !user.membership_plan;
  const title = isAssign ? "Asignar plan" : "Cambiar plan";
  const navigate = useNavigate();

  const [planId, setPlanId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: plansData, isPending: plansPending } = useMembershipPlansQuery({
    is_active: true,
    limit: 200,
  });
  const activePlans = plansData?.items ?? [];
  // Mismo aviso que `CreateUserDialog` (hallazgo 8 de verification.md): sin
  // planes activos, el selector queda vacío y el botón deshabilitado sin
  // explicar por qué ni ofrecer salida.
  const hasNoActivePlans = !plansPending && activePlans.length === 0;
  const changePlanMutation = useChangeUserPlanMutation();

  useEffect(() => {
    if (open) {
      setPlanId("");
      setError(null);
    }
  }, [open]);

  async function handleConfirm() {
    if (!planId) return;
    setError(null);
    try {
      await changePlanMutation.mutateAsync({ id: user.id, membershipPlanId: planId });
      onOpenChange(false);
      toastSuccess(
        isAssign ? "Plan asignado" : "Plan actualizado",
        "Aplica a los próximos pagos de este miembro."
      );
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={`Elegí el plan activo que va a regir para ${user.full_name} a partir de ahora. El cambio aplica a los próximos pagos, no a los ya registrados.`}
      confirmLabel={title}
      pendingLabel="Guardando..."
      isPending={changePlanMutation.isPending}
      confirmDisabled={!planId}
      error={error}
      onConfirm={handleConfirm}
    >
      {hasNoActivePlans ? (
        <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-700 dark:text-amber-200">
            No hay planes activos. Necesitás al menos uno para poder{" "}
            {isAssign ? "asignar un plan" : "cambiar el plan"}.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              navigate("/plans");
            }}
          >
            Ir a Planes
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Plan</label>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Elegí un plan</option>
            {activePlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </ConfirmActionDialog>
  );
}
