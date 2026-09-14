import api from "../lib/http";
import type {
  ExerciseBase,
  MemberRoutineTemplate,
  ProgressionStrategy,
  RoutineAssignment,
  RoutineAssignmentStatus,
  RoutineTemplateDetail,
  RoutineTemplateSummary,
} from "@/types";

// Fetchers de plantillas de rutina, motor de progresión y asignaciones
// (`add-routine-templates`, `template-owned-routine-days`). El día y sus
// ejercicios son propios de la plantilla (design D1/D5 de
// `template-owned-routine-days`): sin catálogo global de días ni
// `PUT`/switch por ejercicio — el guardado del borrador es un único
// reemplazo completo (`saveRoutineTemplateDays`).

// --- Plantillas --------------------------------------------------------

export async function fetchRoutineTemplates(): Promise<RoutineTemplateSummary[]> {
  const { data } = await api.get<RoutineTemplateSummary[]>("/routines/templates");
  return data;
}

export async function fetchRoutineTemplate(id: string): Promise<RoutineTemplateDetail> {
  const { data } = await api.get<RoutineTemplateDetail>(`/routines/templates/${id}`);
  return data;
}

// `{name, tag}` únicamente (design D6): el `POST` crea la plantilla y su
// Día 1 en el mismo request, sin pedir días.
export type CreateRoutineTemplateInput = {
  name: string;
  tag: string;
};

export async function createRoutineTemplate(
  input: CreateRoutineTemplateInput,
): Promise<RoutineTemplateDetail> {
  const { data } = await api.post<RoutineTemplateDetail>("/routines/templates", input);
  return data;
}

export type UpdateRoutineTemplateInput = Partial<CreateRoutineTemplateInput>;

export async function updateRoutineTemplate(
  id: string,
  input: UpdateRoutineTemplateInput,
): Promise<RoutineTemplateDetail> {
  const { data } = await api.patch<RoutineTemplateDetail>(`/routines/templates/${id}`, input);
  return data;
}

export async function deleteRoutineTemplate(id: string): Promise<void> {
  await api.delete(`/routines/templates/${id}`);
}

// --- Guardado del borrador de días/ejercicios (design D5) -----------------

// Espejo de conveniencia de `DEFAULT_EXERCISE_BASE_SETS/REPS/WEIGHT_KG` de
// `backend/app/models.py` (design D5): solo para pintar la card de un
// ejercicio recién agregado al borrador antes de guardar. El servidor la
// vuelve a aplicar al persistir, así que un desfasaje se corrige solo al
// guardar — este valor NO se repite en ningún otro archivo del frontend.
export const DEFAULT_EXERCISE_BASE: ExerciseBase = { sets: 3, reps: 10, weight_kg: 0 };

export type RoutineTemplateDayExerciseInput = {
  exercise_id: string;
  strategy?: ProgressionStrategy;
  base?: ExerciseBase;
};

export type RoutineTemplateDayInput = {
  day_id: string | null;
  muscle_groups: string[];
  exercises: RoutineTemplateDayExerciseInput[];
};

export type SaveRoutineTemplateDaysInput = {
  days: RoutineTemplateDayInput[];
};

// `PUT /routines/templates/{id}/days`: reemplazo completo con identidad
// explícita (design D5). El orden de las listas es el dato — la posición
// del día es su índice y el `sort_order` del ejercicio también. Responde el
// `RoutineTemplateDetail` recalculado, así el borrador se reemplaza por la
// verdad del servidor sin un refetch extra.
export async function saveRoutineTemplateDays(
  templateId: string,
  input: SaveRoutineTemplateDaysInput,
): Promise<RoutineTemplateDetail> {
  const { data } = await api.put<RoutineTemplateDetail>(
    `/routines/templates/${templateId}/days`,
    input,
  );
  return data;
}

// --- Asignaciones (Dueño/Coach) -----------------------------------------

export async function fetchUserAssignments(userId: string): Promise<RoutineAssignment[]> {
  const { data } = await api.get<RoutineAssignment[]>(`/routines/users/${userId}/templates`);
  return data;
}

export type AssignTemplateInput = {
  template_id: string;
  status: RoutineAssignmentStatus;
  starts_on?: string | null;
  base_overrides?: Array<{ exercise_id: string; sets: number; reps: number; weight_kg: number }>;
};

export async function assignTemplate(
  userId: string,
  input: AssignTemplateInput,
): Promise<RoutineAssignment> {
  const { data } = await api.post<RoutineAssignment>(
    `/routines/users/${userId}/templates`,
    input,
  );
  return data;
}

export async function updateAssignmentStatus(
  userId: string,
  assignmentId: string,
  status: RoutineAssignmentStatus,
): Promise<RoutineAssignment> {
  const { data } = await api.patch<RoutineAssignment>(
    `/routines/users/${userId}/templates/${assignmentId}`,
    { status },
  );
  return data;
}

export async function removeAssignment(userId: string, assignmentId: string): Promise<void> {
  await api.delete(`/routines/users/${userId}/templates/${assignmentId}`);
}

export type UpdateAssignmentBaseInput = {
  sets: number;
  reps: number;
  weight_kg: number;
};

export async function updateAssignmentBase(
  userId: string,
  assignmentId: string,
  exerciseId: string,
  input: UpdateAssignmentBaseInput,
): Promise<RoutineAssignment> {
  const { data } = await api.put<RoutineAssignment>(
    `/routines/users/${userId}/templates/${assignmentId}/bases/${exerciseId}`,
    input,
  );
  return data;
}

export async function removeAssignmentBase(
  userId: string,
  assignmentId: string,
  exerciseId: string,
): Promise<RoutineAssignment> {
  const { data } = await api.delete<RoutineAssignment>(
    `/routines/users/${userId}/templates/${assignmentId}/bases/${exerciseId}`,
  );
  return data;
}

// --- Vista del miembro ---------------------------------------------------

export async function fetchMyTemplates(): Promise<RoutineAssignment[]> {
  const { data } = await api.get<RoutineAssignment[]>("/routines/my/templates");
  return data;
}

export async function fetchMyTemplate(assignmentId: string): Promise<MemberRoutineTemplate> {
  const { data } = await api.get<MemberRoutineTemplate>(
    `/routines/my/templates/${assignmentId}`,
  );
  return data;
}
