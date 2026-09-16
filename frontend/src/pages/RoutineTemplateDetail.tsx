import { useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, LayoutTemplate, PencilLine, Trash2 } from "lucide-react";
import {
  useRoutineTemplateQuery,
  useSaveRoutineTemplateDaysMutation,
} from "@/services/routineTemplates.queries";
import { useGuardedNavigate } from "@/hooks/useGuardedNavigate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DataError from "@/components/DataError";
import RoutineDaysEditor from "@/components/routine/RoutineDaysEditor";
import EditRoutineTemplateDialog from "@/components/EditRoutineTemplateDialog";
import DeleteRoutineTemplateDialog from "@/components/DeleteRoutineTemplateDialog";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { toastSuccess } from "@/lib/toast";

// Detalle de plantilla: cáscara sobre `RoutineDaysEditor` (`member-routine-
// copies`, design D8) — su hero, sus acciones de plantilla (editar/eliminar)
// y su `useGuardedNavigate` propio. El día y sus ejercicios son propios de la
// plantilla (`template-owned-routine-days`, design D1/D5/D11); el borrador,
// la barra de guardado y el diálogo de base viven en el editor compartido.

type DetailAction = null | "edit" | "delete";

export default function RoutineTemplateDetail() {
  const { templateId } = useParams<{ templateId: string }>();

  const [action, setAction] = useState<DetailAction>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: template, isPending, isError, refetch } = useRoutineTemplateQuery(templateId);
  const saveMutation = useSaveRoutineTemplateDaysMutation(templateId ?? "");

  const { guardedNavigate, isConfirmOpen, confirmDiscardAndLeave, cancelLeave } =
    useGuardedNavigate();

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <div className="rounded-xl border border-border bg-surface-1/70 px-5 py-4 text-sm text-muted-foreground">
          Cargando plantilla...
        </div>
      </div>
    );
  }

  if (isError || !template) {
    return (
      <DataError
        title="No se pudo cargar la plantilla"
        description="Puede que ya no exista."
        onRetry={() => refetch()}
      />
    );
  }

  async function handleSave(payload: Parameters<typeof saveMutation.mutateAsync>[0]) {
    setSaveError(null);
    try {
      await saveMutation.mutateAsync(payload);
      toastSuccess("Plantilla guardada", "Los días y ejercicios ya están actualizados.");
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
          onClick={() => guardedNavigate("/routines")}
          className="border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Rutinas
        </Button>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/15 p-4 text-primary-strong">
              <LayoutTemplate className="h-7 w-7" />
            </div>
            <div>
              <h1 className="warm-accent-text font-display text-2xl font-extrabold md:text-3xl">
                {template.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{template.tag}</Badge>
                <span className="text-sm text-muted-foreground">
                  {template.days.length} {template.days.length === 1 ? "día" : "días"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setAction("edit")}>
              <PencilLine className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={() => setAction("delete")}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </div>
      </section>

      <RoutineDaysEditor
        detail={template}
        onSave={handleSave}
        isSaving={saveMutation.isPending}
        saveError={saveError}
      />

      {action === "edit" ? (
        <EditRoutineTemplateDialog
          open={action === "edit"}
          onOpenChange={(open) => setAction(open ? "edit" : null)}
          template={template}
        />
      ) : null}

      {action === "delete" ? (
        <DeleteRoutineTemplateDialog
          open={action === "delete"}
          onOpenChange={(open) => setAction(open ? "delete" : null)}
          template={template}
        />
      ) : null}

      {isConfirmOpen ? (
        <ConfirmActionDialog
          open={isConfirmOpen}
          onOpenChange={(open) => !open && cancelLeave()}
          title="Tenés cambios sin guardar"
          description="Si salís ahora se pierden los cambios que hiciste en esta plantilla."
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
