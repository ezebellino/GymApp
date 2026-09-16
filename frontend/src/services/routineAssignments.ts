import api from "../lib/http";
import type { LoggedExercise, MemberRoutineTemplate, WorkoutSetLog } from "@/types";
import type { SaveRoutineTemplateDaysInput } from "./routineTemplates";

// Fetchers de la copia de rutina de un Miembro (`member-routine-copies`):
// detalle y guardado de días de la copia (Dueño/Coach), marcado por serie
// (Miembro) e histórico filtrable (staff y propio) — el ajuste de base por
// cliente (D4) no tiene equivalente acá: se retiró entero, no se reemplaza.

// --- Detalle y edición de la copia (Dueño/Coach, design D6/D8) ------------

export async function fetchAssignmentDetail(
  userId: string,
  assignmentId: string,
): Promise<MemberRoutineTemplate> {
  const { data } = await api.get<MemberRoutineTemplate>(
    `/routines/users/${userId}/templates/${assignmentId}`,
  );
  return data;
}

// `PUT /routines/users/{user_id}/templates/{assignment_id}/days`: mismo
// contrato de reemplazo completo con identidad explícita que el `PUT` de
// plantillas (design D8) — afecta únicamente a esta copia (I3).
export async function saveAssignmentDays(
  userId: string,
  assignmentId: string,
  input: SaveRoutineTemplateDaysInput,
): Promise<MemberRoutineTemplate> {
  const { data } = await api.put<MemberRoutineTemplate>(
    `/routines/users/${userId}/templates/${assignmentId}/days`,
    input,
  );
  return data;
}

// --- Marcado de una serie (Miembro, design D6/D9) -------------------------

export type MarkSetInput = {
  weight_kg: number;
  reps: number;
  note?: string | null;
};

// `PUT /routines/my/days/{day_id}/exercises/{exercise_id}/sets/{set_index}`:
// upsert idempotente por `(user, day, exercise, set_index, hoy)` — el mismo
// verbo marca y corrige, sin que un doble tap duplique la serie.
export async function markSet(
  dayId: string,
  exerciseId: string,
  setIndex: number,
  input: MarkSetInput,
): Promise<WorkoutSetLog> {
  const { data } = await api.put<WorkoutSetLog>(
    `/routines/my/days/${dayId}/exercises/${exerciseId}/sets/${setIndex}`,
    input,
  );
  return data;
}

// --- Histórico filtrable (staff y propio, design D6/D9/D10) --------------

export type WorkoutLogsParams = {
  day_id?: string;
  exercise_id?: string;
  from?: string; // ISO date
  to?: string; // ISO date
  limit?: number;
};

export async function fetchUserWorkoutLogs(
  userId: string,
  params: WorkoutLogsParams = {},
): Promise<WorkoutSetLog[]> {
  const { data } = await api.get<WorkoutSetLog[]>(`/routines/users/${userId}/logs`, { params });
  return data;
}

// Mismo endpoint que el de staff, resuelto sobre el propio usuario — fuente
// del panel "Historial" de "Mi rutina".
export async function fetchMyWorkoutLogs(
  params: WorkoutLogsParams = {},
): Promise<WorkoutSetLog[]> {
  const { data } = await api.get<WorkoutSetLog[]>("/routines/my/logs", { params });
  return data;
}

// Ejercicios con registros de un Miembro (design D6/D10): alimenta el filtro
// de la vista de Progreso, alimentado por el histórico, no por la copia
// vigente.
export async function fetchLoggedExercises(userId: string): Promise<LoggedExercise[]> {
  const { data } = await api.get<LoggedExercise[]>(`/routines/users/${userId}/logged-exercises`);
  return data;
}

// Espejo del anterior, resuelto sobre el propio usuario (design D15,
// corrección del gate): alimenta el filtro del panel "Historial" de "Mi
// rutina" con el histórico completo, sin la ventana de `/my/logs` — así un
// ejercicio quitado de la copia hace semanas sigue siendo filtrable.
export async function fetchMyLoggedExercises(): Promise<LoggedExercise[]> {
  const { data } = await api.get<LoggedExercise[]>("/routines/my/logged-exercises");
  return data;
}
