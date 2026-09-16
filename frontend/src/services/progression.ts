import api from "../lib/http";
import type { PlannedSet, ProgressionStrategy } from "@/types";

// Previsualización del plan de series (`member-routine-copies`, design D13,
// corrección del gate): `GET /routines/progression/preview` es un endpoint
// sin estado — no recibe `template_id`/`assignment_id`/`day_id`/`exercise_id`,
// solo la tupla que determina el plan. Sirve por igual a la plantilla y a la
// copia de un Miembro (un solo editor, D8). No hay ninguna fórmula de
// progresión en `frontend/src/**` (invariante I6): esto es un cliente HTTP,
// el cálculo lo hace `plan_sets(...)` en el backend.
export type PlannedSetsPreviewInput = {
  strategy: ProgressionStrategy;
  sets: number;
  reps: number;
  weight_kg: number;
};

export async function fetchPlannedSetsPreview(
  input: PlannedSetsPreviewInput,
): Promise<PlannedSet[]> {
  const { data } = await api.get<{ planned_sets: PlannedSet[] }>(
    "/routines/progression/preview",
    { params: input },
  );
  return data.planned_sets;
}
