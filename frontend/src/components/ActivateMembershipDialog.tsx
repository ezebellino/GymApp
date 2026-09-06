import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { useActivateMembershipMutation } from "@/services/users.queries";
import { toastError, toastSuccess } from "@/lib/toast";
import type { User } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
};

export default function ActivateMembershipDialog({ open, onOpenChange, user }: Props) {
  const activateMutation = useActivateMembershipMutation();
  const isReactivation = user.membership_status === "cancelled";
  const label = isReactivation ? "Reactivar membresía" : "Activar membresía";

  async function handleConfirm() {
    try {
      await activateMutation.mutateAsync(user.id);
      onOpenChange(false);
      toastSuccess(
        isReactivation ? "Membresía reactivada" : "Membresía activada",
        "El usuario vuelve a contar como miembro activo."
      );
    } catch (error: any) {
      toastError(
        `No se pudo ${isReactivation ? "reactivar" : "activar"} la membresía`,
        error?.response?.data?.detail ?? "Error desconocido"
      );
    }
  }

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={label}
      description={`Vas a ${isReactivation ? "reactivar" : "activar"} la membresía de ${user.full_name}.`}
      confirmLabel={label}
      pendingLabel={isReactivation ? "Reactivando..." : "Activando..."}
      isPending={activateMutation.isPending}
      onConfirm={handleConfirm}
    />
  );
}
