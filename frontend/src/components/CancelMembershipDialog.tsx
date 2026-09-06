import { useState } from "react";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { Input } from "@/components/ui/input";
import { useCancelMembershipMutation } from "@/services/users.queries";
import { toastError, toastSuccess } from "@/lib/toast";
import type { User } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
};

export default function CancelMembershipDialog({ open, onOpenChange, user }: Props) {
  const [cancelDate, setCancelDate] = useState("");
  const cancelMutation = useCancelMembershipMutation();

  const isMemberRole = user.role === "member";
  // La consecuencia real difiere segun el rol (design.md D6, heredado de
  // `EditUserDialog.handleCancelMembership`): un Miembro pierde el acceso a la
  // app, un Dueño/Coach marcado como miembro lo conserva.
  const description = isMemberRole
    ? `Vas a dar de baja la membresía de ${user.full_name}. Además de salir del seguimiento de pagos, asistencia y rutinas, esto le quita el acceso a la aplicación (no puede volver a iniciar sesión).`
    : `Vas a dar de baja la condición de miembro de ${user.full_name}. Deja de contar para pagos, asistencia y rutinas, pero conserva su acceso administrativo (sigue pudiendo iniciar sesión).`;

  async function handleConfirm() {
    try {
      await cancelMutation.mutateAsync({
        id: user.id,
        cancelledAt: cancelDate ? new Date(cancelDate).toISOString() : null,
      });
      onOpenChange(false);
      toastSuccess("Membresía dada de baja", "El cambio ya se ve reflejado en la ficha.");
    } catch (error: any) {
      toastError(
        "No se pudo dar de baja",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    }
  }

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Dar de baja la membresía"
      description={description}
      confirmLabel="Dar de baja la membresía"
      pendingLabel="Dando de baja..."
      destructive
      isPending={cancelMutation.isPending}
      onConfirm={handleConfirm}
    >
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">
          Fecha de baja (opcional — si no elegís una, se usa el momento actual)
        </label>
        <Input
          type="datetime-local"
          value={cancelDate}
          onChange={(e) => setCancelDate(e.target.value)}
        />
      </div>
    </ConfirmActionDialog>
  );
}
