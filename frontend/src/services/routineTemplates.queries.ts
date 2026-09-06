import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignTemplate,
  createRoutineTemplate,
  deleteRoutineTemplate,
  fetchMyTemplate,
  fetchMyTemplates,
  fetchRoutineTemplate,
  fetchRoutineTemplates,
  fetchTrainingDays,
  fetchUserAssignments,
  removeAssignment,
  removeAssignmentBase,
  updateAssignmentBase,
  updateAssignmentStatus,
  updateExerciseBase,
  updateRoutineTemplate,
  updateTemplateExercise,
  type AssignTemplateInput,
  type CreateRoutineTemplateInput,
  type UpdateAssignmentBaseInput,
  type UpdateExerciseBaseInput,
  type UpdateRoutineTemplateInput,
  type UpdateTemplateExerciseInput,
} from "./routineTemplates";
import { queryKeys } from "./queryKeys";
import type { RoutineTemplateDetail } from "@/types";

// --- Lecturas -------------------------------------------------------------

export function useRoutineTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.routineTemplates.list(),
    queryFn: fetchRoutineTemplates,
  });
}

export function useRoutineTemplateQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.routineTemplates.detail(id ?? ""),
    queryFn: () => fetchRoutineTemplate(id as string),
    enabled: Boolean(id),
  });
}

// Días del catálogo (Día 1..4), usado por el selector de días de
// Crear/Editar plantilla. No es una key de dominio propia (no invalida ni
// se reusa en otra vista): se mantiene simple en vez de sumar un tercer
// dominio a `queryKeys.ts` para una lectura de catálogo casi estático.
export function useTrainingDaysQuery() {
  return useQuery({
    queryKey: ["routineTemplates", "trainingDays"] as const,
    queryFn: fetchTrainingDays,
    staleTime: 5 * 60_000,
  });
}

export function useUserAssignmentsQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.routineAssignments.byUser(userId ?? ""),
    queryFn: () => fetchUserAssignments(userId as string),
    enabled: Boolean(userId),
  });
}

export function useMyTemplatesQuery() {
  return useQuery({
    queryKey: queryKeys.routineAssignments.my(),
    queryFn: fetchMyTemplates,
  });
}

export function useMyTemplateQuery(assignmentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.routineAssignments.myDetail(assignmentId ?? ""),
    queryFn: () => fetchMyTemplate(assignmentId as string),
    enabled: Boolean(assignmentId),
  });
}

// --- Mutaciones: plantillas ------------------------------------------------

export function useCreateRoutineTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRoutineTemplateInput) => createRoutineTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routineTemplates.all });
    },
  });
}

export function useUpdateRoutineTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRoutineTemplateInput }) =>
      updateRoutineTemplate(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routineTemplates.all });
    },
  });
}

export function useDeleteRoutineTemplateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteRoutineTemplate(id),
    onSuccess: () => {
      // Borrar una plantilla también deja de contar sus asignaciones (design
      // D12): sin esto, la ficha de un usuario podría seguir mostrando una
      // asignación a una plantilla que ya no existe.
      queryClient.invalidateQueries({ queryKey: queryKeys.routineTemplates.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.routineAssignments.all });
    },
  });
}

// Autosave del toggle activo/estrategia de un ejercicio de la plantilla
// (design D5/D9): la respuesta trae la configuración con su `planned_sets`
// ya recalculado y se escribe directo en la caché del detalle con
// `setQueryData`, sin refetch — el coach nunca ve un botón "Guardar".
export function useUpdateTemplateExerciseMutation(templateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dayId,
      exerciseId,
      input,
    }: {
      dayId: string;
      exerciseId: string;
      input: UpdateTemplateExerciseInput;
    }) => updateTemplateExercise(templateId, dayId, exerciseId, input),
    onSuccess: (updatedExercise, { dayId, exerciseId }) => {
      queryClient.setQueryData<RoutineTemplateDetail | undefined>(
        queryKeys.routineTemplates.detail(templateId),
        (current) => {
          if (!current) return current;
          return {
            ...current,
            days: current.days.map((day) =>
              day.day_id !== dayId
                ? day
                : {
                    ...day,
                    exercises: day.exercises.map((exercise) =>
                      exercise.exercise_id !== exerciseId ? exercise : updatedExercise,
                    ),
                  },
            ),
          };
        },
      );
      // El plan del miembro puede depender de esta plantilla (design D12).
      queryClient.invalidateQueries({ queryKey: queryKeys.routineAssignments.all });
    },
  });
}

// --- Mutaciones: base del ejercicio del catálogo ---------------------------

export function useUpdateExerciseBaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      exerciseId,
      input,
    }: {
      exerciseId: string;
      input: UpdateExerciseBaseInput;
    }) => updateExerciseBase(exerciseId, input),
    onSuccess: () => {
      // Cambia el plan calculado de toda plantilla que incluya este
      // ejercicio (design D12).
      queryClient.invalidateQueries({ queryKey: queryKeys.routineTemplates.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.routineAssignments.all });
    },
  });
}

// --- Mutaciones: asignaciones ---------------------------------------------

export function useAssignTemplateMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AssignTemplateInput) => assignTemplate(userId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routineAssignments.all });
    },
  });
}

export function useUpdateAssignmentStatusMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assignmentId,
      status,
    }: {
      assignmentId: string;
      status: Parameters<typeof updateAssignmentStatus>[2];
    }) => updateAssignmentStatus(userId, assignmentId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routineAssignments.all });
    },
  });
}

export function useRemoveAssignmentMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assignmentId: string) => removeAssignment(userId, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routineAssignments.all });
    },
  });
}

export function useUpdateAssignmentBaseMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assignmentId,
      exerciseId,
      input,
    }: {
      assignmentId: string;
      exerciseId: string;
      input: UpdateAssignmentBaseInput;
    }) => updateAssignmentBase(userId, assignmentId, exerciseId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routineAssignments.all });
    },
  });
}

export function useRemoveAssignmentBaseMutation(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assignmentId, exerciseId }: { assignmentId: string; exerciseId: string }) =>
      removeAssignmentBase(userId, assignmentId, exerciseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routineAssignments.all });
    },
  });
}
