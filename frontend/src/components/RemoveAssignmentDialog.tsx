import { useState } from "react";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { useRemoveAssignmentMutation } from "@/services/routineTemplates.queries";
import { toastSuccess } from "@/lib/toast";
import type { RoutineAssignment, User } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  assignment: RoutineAssignment;
};

// Quitar una asignación completa (design.md D6/D11 de
// add-routine-templates): irreversible, se pierden sus ajustes de base por
// cascade, y quitar la Activa no promueve ninguna Alternativa (invariante
// I12) — ambas cosas se dicen explícitamente acá.
export default function RemoveAssignmentDialog({
  open,
  onOpenChange,
  user,
  assignment,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const removeMutation = useRemoveAssignmentMutation(user.id);

  async function handleConfirm() {
    setError(null);
    try {
      await removeMutation.mutateAsync(assignment.id);
      onOpenChange(false);
      toastSuccess("Asignación eliminada", `Se quitó "${assignment.template_name}" de ${user.full_name}.`);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Quitar asignación"
      description={`Vas a quitar "${assignment.template_name}" de ${user.full_name}. Se pierden los ajustes de base de esta asignación y, si era la plantilla Activa, no se promueve ninguna Alternativa automáticamente.`}
      confirmLabel="Quitar asignación"
      pendingLabel="Quitando..."
      destructive
      isPending={removeMutation.isPending}
      error={error}
      onConfirm={handleConfirm}
    />
  );
}
