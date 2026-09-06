import { useEffect, useMemo, useState } from "react";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { Input } from "@/components/ui/input";
import {
  useRemoveAssignmentBaseMutation,
  useRoutineTemplateQuery,
  useUpdateAssignmentBaseMutation,
} from "@/services/routineTemplates.queries";
import { toastSuccess } from "@/lib/toast";
import type { RoutineAssignment, RoutineTemplateExercise, User } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  assignment: RoutineAssignment;
};

// Ajuste de base por cliente (design.md D7/D11 de add-routine-templates):
// elegir un ejercicio de la plantilla asignada y sobreescribir su base para
// este Miembro en particular. La precedencia (override si existe, si no la
// base del catálogo) la resuelve el backend al calcular el plan; acá solo
// se prellenan los campos con la base del catálogo como punto de partida —
// el endpoint de asignación no expone el detalle por-ejercicio de qué ya
// está ajustado, así que no hay forma de precargar un override existente
// sin un endpoint nuevo (fuera de alcance de este change).
//
// "Quitar ajuste" (`DELETE .../bases/{exercise_id}`) vive en el mismo
// diálogo, como acción secundaria dentro del slot de campos: el design no
// nombra un diálogo separado para la baja y ningún test de la spec la
// ejercita por UI (el escenario está cubierto del lado del backend).
export default function AdjustExerciseBaseDialog({ open, onOpenChange, user, assignment }: Props) {
  const [exerciseId, setExerciseId] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: template } = useRoutineTemplateQuery(assignment.template_id);
  const adjustMutation = useUpdateAssignmentBaseMutation(user.id);
  const removeMutation = useRemoveAssignmentBaseMutation(user.id);

  const exercises = useMemo<RoutineTemplateExercise[]>(() => {
    if (!template || !Array.isArray(template.days)) return [];
    const seen = new Set<string>();
    const flat: RoutineTemplateExercise[] = [];
    for (const day of template.days) {
      for (const exercise of day.exercises) {
        if (seen.has(exercise.exercise_id)) continue;
        seen.add(exercise.exercise_id);
        flat.push(exercise);
      }
    }
    return flat;
  }, [template]);

  useEffect(() => {
    if (open) {
      setExerciseId("");
      setSets("");
      setReps("");
      setWeightKg("");
      setError(null);
    }
  }, [open]);

  function selectExercise(id: string) {
    setExerciseId(id);
    const exercise = exercises.find((e) => e.exercise_id === id);
    if (exercise) {
      setSets(String(exercise.base.sets));
      setReps(String(exercise.base.reps));
      setWeightKg(String(exercise.base.weight_kg));
    }
  }

  async function handleConfirm() {
    setError(null);
    if (!exerciseId) {
      setError("Elegí un ejercicio para ajustar.");
      return;
    }
    try {
      await adjustMutation.mutateAsync({
        assignmentId: assignment.id,
        exerciseId,
        input: { sets: Number(sets), reps: Number(reps), weight_kg: Number(weightKg) },
      });
      onOpenChange(false);
      toastSuccess("Base ajustada", "El plan de este cliente ya refleja el ajuste.");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  async function handleRemove() {
    if (!exerciseId) {
      setError("Elegí un ejercicio para quitarle el ajuste.");
      return;
    }
    setError(null);
    try {
      await removeMutation.mutateAsync({ assignmentId: assignment.id, exerciseId });
      onOpenChange(false);
      toastSuccess("Ajuste quitado", "Ese ejercicio vuelve a la base del catálogo.");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  const isPending = adjustMutation.isPending || removeMutation.isPending;

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ajustar base para este cliente"
      description={`Sobreescribí la base (series x reps · kg) de un ejercicio de "${assignment.template_name}" solo para ${user.full_name}.`}
      confirmLabel="Ajustar base"
      pendingLabel="Guardando..."
      isPending={isPending}
      error={error}
      onConfirm={handleConfirm}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Ejercicio</label>
          <select
            value={exerciseId}
            onChange={(e) => selectExercise(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Elegí un ejercicio</option>
            {exercises.map((exercise) => (
              <option key={exercise.exercise_id} value={exercise.exercise_id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </div>

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

        <button
          type="button"
          disabled={isPending || !exerciseId}
          onClick={handleRemove}
          className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Quitar el ajuste de este ejercicio (vuelve a la base del catálogo)
        </button>
      </div>
    </ConfirmActionDialog>
  );
}
