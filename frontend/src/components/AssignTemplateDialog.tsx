import { useEffect, useState } from "react";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { Badge } from "@/components/ui/badge";
import {
  useAssignTemplateMutation,
  useRoutineTemplatesQuery,
} from "@/services/routineTemplates.queries";
import { toastSuccess } from "@/lib/toast";
import type { RoutineAssignmentStatus, User } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
};

const STATUS_OPTIONS: { value: RoutineAssignmentStatus; label: string }[] = [
  { value: "active", label: "Activa" },
  { value: "alternative", label: "Alternativa" },
];

// Asigna una plantilla a un Miembro (design.md D6/D11 de
// add-routine-templates): elegir plantilla + estado. Asignar como Activa
// deja la anterior Activa (si había) como Alternativa — se lo avisa acá
// mismo, no hace falta un segundo modal.
export default function AssignTemplateDialog({ open, onOpenChange, user }: Props) {
  const [templateId, setTemplateId] = useState("");
  const [status, setStatus] = useState<RoutineAssignmentStatus>("active");
  const [error, setError] = useState<string | null>(null);

  const { data: templates } = useRoutineTemplatesQuery();
  const assignMutation = useAssignTemplateMutation(user.id);

  useEffect(() => {
    if (open) {
      setTemplateId("");
      setStatus("active");
      setError(null);
    }
  }, [open]);

  // `Array.isArray`, no solo `?? []`: un test que no conoce todavía este
  // endpoint (p. ej. `UserDetail.test.tsx` de la sesión paralela) puede caer
  // en un fallback que devuelve `{}` en vez de una lista.
  const options = Array.isArray(templates) ? templates : [];

  async function handleConfirm() {
    setError(null);
    if (!templateId) {
      setError("Elegí una plantilla para asignar.");
      return;
    }
    try {
      await assignMutation.mutateAsync({ template_id: templateId, status });
      onOpenChange(false);
      toastSuccess("Plantilla asignada", `${user.full_name} ya la tiene asignada.`);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Asignar plantilla"
      description={`Elegí qué plantilla asignarle a ${user.full_name} y con qué estado.`}
      confirmLabel="Asignar"
      pendingLabel="Asignando..."
      isPending={assignMutation.isPending}
      error={error}
      onConfirm={handleConfirm}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Plantilla</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Elegí una plantilla</option>
            {options.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · {template.tag}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Estado</label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={status === option.value}
                onClick={() => setStatus(option.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  status === option.value
                    ? "border-primary/40 bg-primary/15 text-primary-strong"
                    : "border-border bg-surface-2/30 text-muted-foreground hover:bg-surface-2/60"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {status === "active" ? (
            <p className="text-xs text-muted-foreground">
              Si {user.full_name} ya tenía una plantilla Activa, va a quedar como Alternativa.
            </p>
          ) : null}
        </div>

        {templateId ? (
          <Badge variant="outline">
            {options.find((t) => t.id === templateId)?.name}
          </Badge>
        ) : null}
      </div>
    </ConfirmActionDialog>
  );
}
