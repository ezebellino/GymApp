import { useEffect, useState } from "react";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { Input } from "@/components/ui/input";
import type { ExerciseBase } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Solo lo que hace falta para editar la base: el caller puede pasar un
  // `RoutineTemplateExercise` o cualquier ejercicio del borrador con esta
  // forma mínima.
  exercise: { name: string; base: ExerciseBase };
  onSave: (base: ExerciseBase) => void;
};

// Editor de la base (series x reps · kg) de un ejercicio **del borrador**
// (`template-owned-routine-days`, design D5/D11): no pega ningún request,
// solo despacha `SET_EXERCISE_BASE` al reducer del detalle de plantilla. La
// base es propia de la combinación (plantilla, día, ejercicio) — se
// persiste recién al confirmar el guardado del borrador entero.
export default function EditExerciseBaseDialog({ open, onOpenChange, exercise, onSave }: Props) {
  const [sets, setSets] = useState(String(exercise.base.sets));
  const [reps, setReps] = useState(String(exercise.base.reps));
  const [weightKg, setWeightKg] = useState(String(exercise.base.weight_kg));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSets(String(exercise.base.sets));
      setReps(String(exercise.base.reps));
      setWeightKg(String(exercise.base.weight_kg));
      setError(null);
    }
  }, [open, exercise]);

  function handleConfirm() {
    setError(null);
    const parsedSets = Number(sets);
    const parsedReps = Number(reps);
    const parsedWeightKg = Number(weightKg);

    if (!Number.isFinite(parsedSets) || parsedSets < 1) {
      setError("Las series tienen que ser al menos 1.");
      return;
    }
    if (!Number.isFinite(parsedReps) || parsedReps < 1) {
      setError("Las repeticiones tienen que ser al menos 1.");
      return;
    }
    if (!Number.isFinite(parsedWeightKg) || parsedWeightKg < 0) {
      setError("El peso no puede ser negativo.");
      return;
    }

    onSave({ sets: parsedSets, reps: parsedReps, weight_kg: parsedWeightKg });
    onOpenChange(false);
  }

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editar base del ejercicio"
      description={`Cambiá la base (series x reps · kg) de ${exercise.name} en este día. Se persiste al guardar la plantilla.`}
      confirmLabel="Aplicar"
      pendingLabel="Aplicar"
      isPending={false}
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
