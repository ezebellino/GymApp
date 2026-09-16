import { useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, LayoutTemplate } from "lucide-react";
import {
  useAssignmentDetailQuery,
  useSaveAssignmentDaysMutation,
} from "@/services/routineAssignments.queries";
import { useUserQuery } from "@/services/users.queries";
import { useGuardedNavigate } from "@/hooks/useGuardedNavigate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DataError from "@/components/DataError";
import RoutineDaysEditor from "@/components/routine/RoutineDaysEditor";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { toastSuccess } from "@/lib/toast";

// Editor de la copia de rutina de un Miembro (`member-routine-copies`, design
// D8/D10): cáscara sobre `RoutineDaysEditor`, igual que
// `RoutineTemplateDetail.tsx` — encabezado propio ("Miembro + plantilla
// origen snapshoteada"), acción propia de volver a la ficha, y su propia
// query/mutación contra la copia (no la plantilla). Único punto de entrada:
// el icono Editar de la fila de esa copia en `MemberTemplatesCard.tsx`.
export default function MemberRoutineEditor() {
  const { id: userId, assignmentId } = useParams<{ id: string; assignmentId: string }>();

  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: user } = useUserQuery(userId);
  const {
    data: assignment,
    isPending,
    isError,
    refetch,
  } = useAssignmentDetailQuery(userId, assignmentId);
  const saveMutation = useSaveAssignmentDaysMutation(userId ?? "", assignmentId ?? "");

  const { guardedNavigate, isConfirmOpen, confirmDiscardAndLeave, cancelLeave } =
    useGuardedNavigate();

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <div className="rounded-xl border border-border bg-surface-1/70 px-5 py-4 text-sm text-muted-foreground">
          Cargando rutina...
        </div>
      </div>
    );
  }

  if (isError || !assignment) {
    return (
      <DataError
        title="No se pudo cargar la rutina"
        description="Puede que ya no exista."
        onRetry={() => refetch()}
      />
    );
  }

  async function handleSave(payload: Parameters<typeof saveMutation.mutateAsync>[0]) {
    setSaveError(null);
    try {
      await saveMutation.mutateAsync(payload);
      toastSuccess("Rutina actualizada", "Los días y ejercicios de esta copia ya están al día.");
    } catch (err: any) {
      setSaveError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  return (
    <div className="space-y-6">
      <section className="hero-aura rounded-xl border border-border p-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => guardedNavigate(`/users/${userId}`)}
          className="border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la ficha
        </Button>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/15 p-4 text-primary-strong">
              <LayoutTemplate className="h-7 w-7" />
            </div>
            <div>
              <h1 className="warm-accent-text font-display text-2xl font-extrabold md:text-3xl">
                {user?.full_name ?? "Miembro"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {assignment.template_tag ? (
                  <Badge variant="outline">{assignment.template_tag}</Badge>
                ) : null}
                <span className="text-sm text-muted-foreground">{assignment.template_name}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <RoutineDaysEditor
        detail={assignment}
        onSave={handleSave}
        isSaving={saveMutation.isPending}
        saveError={saveError}
      />

      {isConfirmOpen ? (
        <ConfirmActionDialog
          open={isConfirmOpen}
          onOpenChange={(open) => !open && cancelLeave()}
          title="Tenés cambios sin guardar"
          description="Si salís ahora se pierden los cambios que hiciste en esta rutina."
          confirmLabel="Descartar y salir"
          cancelLabel="Seguir editando"
          pendingLabel="Descartar y salir"
          isPending={false}
          onConfirm={confirmDiscardAndLeave}
        />
      ) : null}
    </div>
  );
}
