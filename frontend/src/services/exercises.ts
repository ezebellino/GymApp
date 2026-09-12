import api from "../lib/http";
import type { Exercise, ExerciseMeta } from "@/types";
import { readTotalCount, type PaginatedResult } from "./pagination";

// Fetchers del catálogo de ejercicios (`add-exercise-catalog`, design D12).
// Mismo patrón que `services/membershipPlans.ts`: funciones puras,
// `readTotalCount` para el listado paginado, nunca el `AxiosResponse` crudo.

export type ExercisesParams = {
  q?: string;
  muscle_group?: string;
  training_type?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
};

export async function fetchExercises(
  params: ExercisesParams = {},
): Promise<PaginatedResult<Exercise>> {
  const { q, muscle_group, training_type, is_active, limit = 50, offset = 0 } = params;
  const { data, headers } = await api.get<Exercise[]>("/exercises/", {
    params: { q, muscle_group, training_type, is_active, limit, offset },
  });

  return { items: data, total: readTotalCount(headers, data.length) };
}

export async function fetchExercise(id: string): Promise<Exercise> {
  const { data } = await api.get<Exercise>(`/exercises/${id}`);
  return data;
}

export async function fetchExerciseMeta(): Promise<ExerciseMeta> {
  const { data } = await api.get<ExerciseMeta>("/exercises/meta");
  return data;
}

export type CreateExerciseInput = {
  name: string;
  description?: string | null;
  muscle_group?: string | null;
  training_types?: string[];
  external_media_url?: string | null;
};

export async function createExercise(input: CreateExerciseInput): Promise<Exercise> {
  const { data } = await api.post<Exercise>("/exercises/", input);
  return data;
}

export type UpdateExerciseInput = {
  name?: string;
  description?: string | null;
  muscle_group?: string | null;
  training_types?: string[];
  external_media_url?: string | null;
};

export async function updateExercise(id: string, input: UpdateExerciseInput): Promise<Exercise> {
  const { data } = await api.patch<Exercise>(`/exercises/${id}`, input);
  return data;
}

export async function activateExercise(id: string): Promise<Exercise> {
  const { data } = await api.post<Exercise>(`/exercises/${id}/activate`, {});
  return data;
}

export async function deactivateExercise(id: string): Promise<Exercise> {
  const { data } = await api.post<Exercise>(`/exercises/${id}/deactivate`, {});
  return data;
}

export async function deleteExercise(id: string): Promise<void> {
  await api.delete(`/exercises/${id}`);
}

// Alta con archivo: dos requests (design D12). `uploadExerciseMedia` es la
// segunda, aparte de `createExercise`/`updateExercise` — el endpoint de media
// necesita el id del ejercicio.
export async function uploadExerciseMedia(id: string, file: File): Promise<Exercise> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<Exercise>(`/exercises/${id}/media`, formData);
  return data;
}

export async function deleteExerciseMedia(id: string): Promise<Exercise> {
  const { data } = await api.delete<Exercise>(`/exercises/${id}/media`);
  return data;
}
