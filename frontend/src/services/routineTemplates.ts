import api from "../lib/http";
import type {
  MemberRoutineTemplate,
  ProgressionStrategy,
  RoutineAssignment,
  RoutineAssignmentStatus,
  RoutineDay,
  RoutineExerciseManage,
  RoutineTemplateDetail,
  RoutineTemplateExercise,
  RoutineTemplateSummary,
} from "@/types";

// Fetchers de plantillas de rutina, motor de progresión y asignaciones
// (add-routine-templates, design D9/D12). Contrato de API tomado al pie de
// la letra de `openspec/changes/add-routine-templates/design.md` — el
// backend de este change corre en paralelo, no existe todavía mientras se
// escribe este archivo.

// --- Plantillas --------------------------------------------------------

export async function fetchRoutineTemplates(): Promise<RoutineTemplateSummary[]> {
  const { data } = await api.get<RoutineTemplateSummary[]>("/routines/templates");
  return data;
}

export async function fetchRoutineTemplate(id: string): Promise<RoutineTemplateDetail> {
  const { data } = await api.get<RoutineTemplateDetail>(`/routines/templates/${id}`);
  return data;
}

export type CreateRoutineTemplateInput = {
  name: string;
  tag: string;
  day_ids: string[];
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

export type UpdateTemplateExerciseInput = {
  is_active?: boolean;
  strategy?: ProgressionStrategy;
};

export async function updateTemplateExercise(
  templateId: string,
  dayId: string,
  exerciseId: string,
  input: UpdateTemplateExerciseInput,
): Promise<RoutineTemplateExercise> {
  const { data } = await api.put<RoutineTemplateExercise>(
    `/routines/templates/${templateId}/days/${dayId}/exercises/${exerciseId}`,
    input,
  );
  return data;
}

// --- Base del ejercicio del catálogo (design D3, flujo existente) ------

export type UpdateExerciseBaseInput = {
  base_sets: number;
  base_reps: number;
  base_weight_kg: number;
};

// Reusa el `PUT /routines/exercises/{id}` ya existente (owner-only): este
// change solo le suma tres campos opcionales al schema (design D3), no
// construye un endpoint nuevo.
export async function updateExerciseBase(
  exerciseId: string,
  input: UpdateExerciseBaseInput,
): Promise<RoutineExerciseManage> {
  const { data } = await api.put<RoutineExerciseManage>(
    `/routines/exercises/${exerciseId}`,
    input,
  );
  return data;
}

// Días del catálogo (Día 1..4), para el selector de días al crear/editar una
// plantilla. Reusa el endpoint existente `GET /routines/days`
// (owner/coach) — no es un fetcher nombrado en design D12, pero no hay
// forma de armar el selector sin conocer los días existentes y no vale la
// pena duplicar ese endpoint solo para este change.
export async function fetchTrainingDays(): Promise<RoutineDay[]> {
  const { data } = await api.get<RoutineDay[]>("/routines/days");
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
