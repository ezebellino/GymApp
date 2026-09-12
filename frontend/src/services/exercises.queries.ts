import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateExercise,
  createExercise,
  deactivateExercise,
  deleteExercise,
  deleteExerciseMedia,
  fetchExercise,
  fetchExerciseMeta,
  fetchExercises,
  updateExercise,
  uploadExerciseMedia,
  type CreateExerciseInput,
  type ExercisesParams,
  type UpdateExerciseInput,
} from "./exercises";
import { queryKeys } from "./queryKeys";

export function useExercisesQuery(params: ExercisesParams) {
  return useQuery({
    queryKey: queryKeys.exercises.list(params),
    queryFn: () => fetchExercises(params),
    // Mismo criterio que `useMembershipPlansQuery`: evita el parpadeo al
    // paginar/filtrar.
    placeholderData: keepPreviousData,
  });
}

export function useExerciseQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.exercises.detail(id ?? ""),
    queryFn: () => fetchExercise(id as string),
    enabled: Boolean(id),
  });
}

// Las dos listas fijas (grupo muscular y tipo de entrenamiento) no cambian en
// la vida de la sesión: `staleTime: Infinity` amortiza el round-trip extra al
// abrir la pantalla (design D12, riesgo aceptado).
export function useExerciseMetaQuery() {
  return useQuery({
    queryKey: queryKeys.exercises.meta(),
    queryFn: () => fetchExerciseMeta(),
    staleTime: Infinity,
  });
}

// Toda mutación de ejercicio invalida `queryKeys.exercises.all`: el listado y
// el detalle dependen de la misma respuesta.

export function useCreateExerciseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExerciseInput) => createExercise(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all });
    },
  });
}

export function useUpdateExerciseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateExerciseInput }) =>
      updateExercise(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all });
    },
  });
}

export function useActivateExerciseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => activateExercise(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all });
    },
  });
}

export function useDeactivateExerciseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deactivateExercise(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all });
    },
  });
}

export function useDeleteExerciseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteExercise(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all });
    },
  });
}

export function useUploadExerciseMediaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadExerciseMedia(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all });
    },
  });
}

export function useDeleteExerciseMediaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteExerciseMedia(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.exercises.all });
    },
  });
}
