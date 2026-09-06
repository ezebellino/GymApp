import { useEffect, useState } from "react";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { Input } from "@/components/ui/input";
import { useUpdateExerciseBaseMutation } from "@/services/routineTemplates.queries";
import { toastSuccess } from "@/lib/toast";
import type { RoutineTemplateExercise } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: RoutineTemplateExercise;
};

// Edita la base del catálogo (series x reps · kg) de un ejercicio, desde el
// detalle de plantilla. Reusa el `PUT /routines/exercises/{id}` existente,
// exclusivo del Dueño — el caller (`RoutineTemplateDetail.tsx`) es
// responsable de no montar este diálogo para un Coach (design.md D3/D11 de
// add-routine-templates, espejo de `require_role(owner)` del endpoint).
export default function EditExerciseBaseDialog({ open, onOpenChange, exercise }: Props) {
  const [sets, setSets] = useState(String(exercise.base.sets));
  const [reps, setReps] = useState(String(exercise.base.reps));
  const [weightKg, setWeightKg] = useState(String(exercise.base.weight_kg));
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useUpdateExerciseBaseMutation();

  useEffect(() => {
    if (open) {
      setSets(String(exercise.base.sets));
      setReps(String(exercise.base.reps));
      setWeightKg(String(exercise.base.weight_kg));
      setError(null);
    }
  }, [open, exercise]);

  async function handleConfirm() {
    setError(null);
    try {
      await updateMutation.mutateAsync({
        exerciseId: exercise.exercise_id,
        input: {
          base_sets: Number(sets),
          base_reps: Number(reps),
          base_weight_kg: Number(weightKg),
        },
      });
      onOpenChange(false);
      toastSuccess("Base actualizada", `${exercise.name} tiene una nueva base.`);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editar base del ejercicio"
      description={`Cambiá la base (series x reps · kg) de ${exercise.name} en el catálogo. Afecta el plan calculado de toda plantilla que lo incluya.`}
      confirmLabel="Guardar"
      pendingLabel="Guardando..."
      isPending={updateMutation.isPending}
      error={error}
      onConfirm={handleConfirm}
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Series</label>
          <Input type="number" min={1} value={sets} onChange={(e) => setSets(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Repeticiones</label>
          <Input type="number" min={1} value={reps} onChange={(e) => setReps(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Kg</label>
          <Input
            type="number"
            min={0}
            step="0.5"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </div>
      </div>
    </ConfirmActionDialog>
  );
}
