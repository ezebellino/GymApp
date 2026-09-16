import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchPlannedSetsPreview, type PlannedSetsPreviewInput } from "./progression";
import { queryKeys } from "./queryKeys";

// `member-routine-copies` (design D13): consumida declarativamente por cada
// fila de ejercicio de `RoutineDaysEditor.tsx` con su tupla vigente
// `(strategy, sets, reps, weight_kg)`. `staleTime: Infinity` porque el plan
// de una tupla es una función pura de constantes del sistema — volver a una
// estrategia ya vista no dispara un request nuevo. `placeholderData:
// keepPreviousData` (mismo criterio que `useExercisesQuery`) es lo que deja
// la fila mostrando el plan anterior, atenuado, mientras llega el nuevo en
// vez de un hueco vacío.
export function usePlannedSetsPreviewQuery(input: PlannedSetsPreviewInput) {
  return useQuery({
    queryKey: queryKeys.progression.preview(input),
    queryFn: () => fetchPlannedSetsPreview(input),
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}
