import { useState } from "react";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { useDeleteRoutineTemplateMutation } from "@/services/routineTemplates.queries";
import { toastSuccess } from "@/lib/toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Solo `id` + `nombre`: alcanza tanto para el detalle como para una fila del
  // listado, que no tiene el detalle completo cargado.
  template: { id: string; name: string };
  // Qué hacer después de borrar. El detalle navega al listado (la página que
  // se está mirando dejó de existir); el listado no navega a ninguna parte.
  onDeleted?: () => void;
};

// Borrado de plantilla (design.md D9/D11 de add-routine-templates): el
// backend rechaza con 409 y el conteo de miembros asignados si tiene
// asignaciones vigentes (invariante I14) — ese `detail` se muestra tal cual
// en el diálogo, sin redactarlo de nuevo acá.
export default function DeleteRoutineTemplateDialog({
  open,
  onOpenChange,
  template,
  onDeleted,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const deleteMutation = useDeleteRoutineTemplateMutation();

  async function handleConfirm() {
    setError(null);
    try {
      await deleteMutation.mutateAsync(template.id);
      onOpenChange(false);
      toastSuccess("Plantilla eliminada", `${template.name} ya no está disponible.`);
      onDeleted?.();
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
