import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignTemplate,
  createRoutineTemplate,
  deleteRoutineTemplate,
  fetchMyTemplate,
  fetchMyTemplates,
  fetchRoutineTemplate,
  fetchRoutineTemplates,
  fetchUserAssignments,
  removeAssignment,
  saveRoutineTemplateDays,
  updateAssignmentStatus,
  updateRoutineTemplate,
  type AssignTemplateInput,
  type CreateRoutineTemplateInput,
  type SaveRoutineTemplateDaysInput,
  type UpdateRoutineTemplateInput,
} from "./routineTemplates";
import { queryKeys } from "./queryKeys";

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
      // D12 de `add-routine-templates`): sin esto, la ficha de un usuario
      // podría seguir mostrando una asignación a una plantilla que ya no
      // existe.
      queryClient.invalidateQueries({ queryKey: queryKeys.routineTemplates.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.routineAssignments.all });
    },
  });
}

// Guardado explícito del borrador de días/ejercicios (design D5/D11 de
// `template-owned-routine-days`): un único `PUT` de reemplazo completo. La
// respuesta reemplaza la cache del detalle con `setQueryData` (sin refetch)
// y se invalida `routineAssignments.all`, porque el plan del Miembro puede
// depender de esta plantilla (D10, "los cambios se ven en vivo").
export function useSaveRoutineTemplateDaysMutation(templateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveRoutineTemplateDaysInput) =>
      saveRoutineTemplateDays(templateId, input),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.routineTemplates.detail(templateId), detail);
      queryClient.invalidateQueries({ queryKey: queryKeys.routineTemplates.list() });
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

