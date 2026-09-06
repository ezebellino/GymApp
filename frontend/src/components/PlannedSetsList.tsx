import type { PlannedSet } from "@/types";

type Props = {
  plannedSets: PlannedSet[];
};

// Renderiza el plan de series calculado por el backend ("peso kg x reps",
// con su anotación) en modo solo lectura. Componente compartido por el
// detalle de plantilla (`RoutineTemplateDetail.tsx`) y "Mi rutina"
// (`UserRoutine.tsx`): el plan se ve igual del lado del coach y del cliente
// (design.md D11 de add-routine-templates). No calcula nada: invariante I6
// ("no hay ninguna fórmula de progresión en frontend/src/**").
export default function PlannedSetsList({ plannedSets }: Props) {
  if (plannedSets.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin series configuradas.</p>;
  }

  return (
    <ol className="flex flex-wrap gap-2">
      {plannedSets.map((set) => (
        <li
          key={set.index}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2/40 px-2.5 py-1 text-sm text-foreground"
        >
          <span className="text-xs text-muted-foreground">#{set.index}</span>
          <span className="font-medium">
            {set.weight_kg} kg × {set.reps}
          </span>
          {set.note ? <span className="text-xs text-muted-foreground">({set.note})</span> : null}
        </li>
      ))}
    </ol>
  );
}
