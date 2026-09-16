import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAssignmentDetail,
  fetchLoggedExercises,
  fetchMyLoggedExercises,
  fetchMyWorkoutLogs,
  fetchUserWorkoutLogs,
  markSet,
  saveAssignmentDays,
  type MarkSetInput,
  type WorkoutLogsParams,
} from "./routineAssignments";
import type { SaveRoutineTemplateDaysInput } from "./routineTemplates";
import { queryKeys } from "./queryKeys";

// --- Detalle y edición de la copia (Dueño/Coach) --------------------------

export function useAssignmentDetailQuery(userId: string | undefined, assignmentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.routineAssignments.detail(userId ?? "", assignmentId ?? ""),
    queryFn: () => fetchAssignmentDetail(userId as string, assignmentId as string),
    enabled: Boolean(userId && assignmentId),
  });
}

// Guardado explícito de la copia (design D8, mismo patrón que
// `useSaveRoutineTemplateDaysMutation`): reemplaza la cache del detalle con
// `setQueryData` y se invalida `routineAssignments.all` — el listado de la
// ficha (`MemberTemplatesCard`) no cambia de forma pero puede haber quedado
// con datos viejos de otra query relacionada.
export function useSaveAssignmentDaysMutation(userId: string, assignmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveRoutineTemplateDaysInput) =>
      saveAssignmentDays(userId, assignmentId, input),
    onSuccess: (detail) => {
      queryClient.setQueryData(queryKeys.routineAssignments.detail(userId, assignmentId), detail);
      queryClient.invalidateQueries({ queryKey: queryKeys.routineAssignments.all });
    },
  });
}

// --- Marcado de una serie (Miembro) ---------------------------------------

// `assignmentId` solo sirve para invalidar el detalle de "Mi rutina" tras
// marcar — no viaja en la URL del `PUT` (design D6, upsert por día/ejercicio/
// serie/fecha, sin `assignment_id` en el path).
export function useMarkSetMutation(assignmentId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dayId,
      exerciseId,
      setIndex,
      input,
    }: {
      dayId: string;
      exerciseId: string;
      setIndex: number;
      input: MarkSetInput;
    }) => markSet(dayId, exerciseId, setIndex, input),
    onSuccess: () => {
      if (assignmentId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.routineAssignments.myDetail(assignmentId) });
      }
      // Prefijo sin `params` (hallazgo menor 6 del `verification.md`): alcanza
      // cualquier combinación de filtros del panel "Historial" de "Mi
      // rutina", no solo la que esté montada ahora. `queryKeys.ts` es el
      // único archivo donde se escribe un string de key.
      queryClient.invalidateQueries({ queryKey: queryKeys.routineAssignments.myLogsAll() });
    },
  });
}

// --- Histórico filtrable ---------------------------------------------------

// `placeholderData: keepPreviousData` (mismo criterio que `useExercisesQuery`,
// design D6/hallazgos mayores 1 y 2 del `verification.md`): los params ahora
// cambian en respuesta a un filtro (ejercicio/período), y sin esto cada
// cambio de filtro muestra "Cargando..." de nuevo en vez de mantener el
// resultado anterior mientras llega el nuevo.
// `enabled` extra (además de `Boolean(userId)`): `MemberProgress.tsx` lo usa
// para no disparar el fetch inicial sin filtro hasta saber cuál es el
// ejercicio por default (`loggedExercises[0]`) — sin esto, el mount siempre
// pediría todo una vez y recién después refetchearía filtrado, mostrando un
// parpadeo con los dos ejercicios mezclados.
export function useUserWorkoutLogsQuery(
  userId: string | undefined,
  params: WorkoutLogsParams = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.routineAssignments.logs(userId ?? "", params),
    queryFn: () => fetchUserWorkoutLogs(userId as string, params),
    enabled: Boolean(userId) && (options.enabled ?? true),
    placeholderData: keepPreviousData,
  });
}

export function useMyWorkoutLogsQuery(params: WorkoutLogsParams = {}) {
  return useQuery({
    queryKey: queryKeys.routineAssignments.myLogs(params),
    queryFn: () => fetchMyWorkoutLogs(params),
    placeholderData: keepPreviousData,
  });
}

export function useLoggedExercisesQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.routineAssignments.loggedExercises(userId ?? ""),
    queryFn: () => fetchLoggedExercises(userId as string),
    enabled: Boolean(userId),
  });
}

// D15 (corrección del gate): espejo del anterior para el propio Miembro —
// fuente del `<select>` del panel "Historial" de `UserRoutine.tsx`.
export function useMyLoggedExercisesQuery() {
  return useQuery({
    queryKey: queryKeys.routineAssignments.myLoggedExercises(),
    queryFn: fetchMyLoggedExercises,
  });
}
