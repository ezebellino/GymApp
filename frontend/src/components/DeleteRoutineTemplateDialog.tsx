import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { useDeleteRoutineTemplateMutation } from "@/services/routineTemplates.queries";
import { toastSuccess } from "@/lib/toast";
import type { RoutineTemplateDetail } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: RoutineTemplateDetail;
};

// Borrado de plantilla (design.md D9/D11 de add-routine-templates): el
// backend rechaza con 409 y el conteo de miembros asignados si tiene
// asignaciones vigentes (invariante I14) — ese `detail` se muestra tal cual
// en el diálogo, sin redactarlo de nuevo acá.
export default function DeleteRoutineTemplateDialog({ open, onOpenChange, template }: Props) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const deleteMutation = useDeleteRoutineTemplateMutation();

  async function handleConfirm() {
    setError(null);
    try {
      await deleteMutation.mutateAsync(template.id);
      onOpenChange(false);
      toastSuccess("Plantilla eliminada", `${template.name} ya no está disponible.`);
      navigate("/routines");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Eliminar plantilla"
      description={`Vas a eliminar la plantilla "${template.name}". Esta acción no se puede deshacer.`}
      confirmLabel="Eliminar"
      pendingLabel="Eliminando..."
      destructive
      isPending={deleteMutation.isPending}
      error={error}
      onConfirm={handleConfirm}
    />
  );
}
