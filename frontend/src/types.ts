export type Role = "owner" | "coach" | "member";

export type MembershipStatus = "none" | "active" | "cancelled";
export type MembershipIndicator = "none" | "up_to_date" | "overdue" | "suspended";
export type InvitationStatus = "none" | "pending" | "expired" | "access_active";

export type User = {
  id: string;
  first_name: string;
  last_name?: string | null;
  full_name: string;
  age?: number | null;
  birth_date?: string | null; // ISO date
  weight_kg?: number | null;
  height_cm?: number | null;
  email?: string | null;
  email_verified: boolean;
  phone?: string | null;
  phone_verified: boolean;
  role: Role;
  is_active: boolean;
  membership_status: MembershipStatus;
  membership_start_date?: string | null; // ISO
  membership_cancelled_at?: string | null; // ISO
  membership_indicator: MembershipIndicator;
  invitation_status: InvitationStatus;
  created_at: string; // ISO
  // `membership-plans`: opcionales a propósito (design D5 de ese change) aunque
  // el backend siempre los manda — los `makeUser` de varios tests construyen
  // un `User` literal y no deben romper.
  membership_plan?: MembershipPlanSummary | null;
  plan_since?: string | null; // ISO date
};

// --- add-membership-plans: espejo de los schemas nuevos de backend/app/schemas.py (design D2/D4) ---

export type MembershipPlanPrice = {
  id: string;
  amount: number;
  effective_from: string; // ISO date
  created_at: string; // ISO
  created_by_user_id?: string | null;
};

export type MembershipPlan = {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  current_price?: MembershipPlanPrice | null;
  members_count: number;
  created_at: string; // ISO
  updated_at: string; // ISO
};

export type MembershipPlanDetail = MembershipPlan & {
  price_history: MembershipPlanPrice[];
};

// Proyección liviana embebida en `User.membership_plan` (D2).
export type MembershipPlanSummary = {
  id: string;
  name: string;
  current_amount?: number | null;
};

// Usuario embebido en la respuesta de /payments y /attendance: proyección
// liviana (sin membresía ni invitación), alcanza para mostrar nombre y
// contacto sin pedirlo aparte.
export type EmbeddedUser = Pick<User, "id" | "first_name" | "last_name" | "full_name" | "email" | "phone" | "role">;

// `rebuild-payments-with-plan-pricing` (D1/D3.2): foto del plan con el que se
// registró un pago, leída de la propia fila del pago — nunca el plan actual
// del miembro. `null` solo para pagos anteriores a la migración (D2/D4).
export type PaymentPlanRef = {
  id: string | null;
  name: string;
  reference_amount: number | null;
};

export type Payment = {
  id: string;
  user_id: string;
  user?: EmbeddedUser | null;
  amount: number;
  method: "cash" | "transfer" | null;
  method_channel?: string | null;
  note?: string | null;
  period_month: number;
  period_year: number;
  created_at: string; // ISO
  plan: PaymentPlanRef | null;
};

export type Attendance = {
  id: string;
  user_id: string;
  coach_id?: string | null;
  user?: EmbeddedUser | null;
  checkin_at: string; // ISO
};

export type AppSettings = {
  gym_name: string;
  admin_name: string | null;
  currency: string;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp_phone: string | null;
  business_hours: string | null;
  payment_alias: string | null;
  payment_notes: string | null;
  allow_cash: boolean;
  allow_transfer: boolean;
  onboarding_message: string | null;
};

export type RoutineExerciseOption = {
  exercise_id: string;
  name: string;
  // Opcional (H1): un ejercicio puede no tener grupo muscular asignado
  // (`exercise-catalog`, grupo 0..1).
  muscle_group: string | null;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
};

export type RoutineDay = {
  id: string;
  name: string;
  muscle_groups: string[];
  day_order: number;
  exercises: RoutineExerciseOption[];
};

export type RoutineCatalogGroup = {
  // Optional (H1, corrección de verificación, parte 2): idem RoutineExerciseOption.
  muscle_group: string | null;
  exercises: Array<{
    id: string;
    name: string;
    muscle_group: string | null;
    description?: string | null;
  }>;
};

export type RoutineExerciseManage = {
  id: string;
  name: string;
  muscle_group: string | null;
  description?: string | null;
  is_active: boolean;
  day_ids: string[];
  // Base del ejercicio (series x reps · kg), punto de partida del motor de
  // progresión (add-routine-templates, design D3). Siempre presente: el
  // backend la devuelve con default 3/10/0 si no se indicó al crear.
  base_sets: number;
  base_reps: number;
  base_weight_kg: number;
};

export type RoutineDayProgress = {
  day_id: string;
  day_name: string;
  muscle_groups: string[];
  active_exercise_count: number;
  log_count: number;
  last_performed_at?: string | null;
};

export type WorkoutLog = {
  id: string;
  user_id: string;
  day_id: string;
  day_name: string;
  exercise_id: string;
  exercise_name: string;
  muscle_group: string | null;
  sets_count?: number | null;
  reps?: number | null;
  weight_kg: number;
  note?: string | null;
  performed_at: string;
};

export type ProgressImprovement = {
  exercise_name: string;
  start_weight: number;
  end_weight: number;
  delta_weight: number;
};

export type UserProgressSummary = {
  user_id: string;
  user_name: string;
  gym_name: string;
  log_count: number;
  attendance_count: number;
  unique_days: number;
  unique_exercises: number;
  total_volume: number;
  last_training?: string | null;
  best_exercise_name?: string | null;
  best_weight_kg?: number | null;
  top_improvement?: ProgressImprovement | null;
  motivation: string;
};

// --- add-routine-templates: bloque nuevo (design D12, append) ---------------
// Espejo de los schemas nuevos de backend/app/schemas.py (bloque final,
// design D10). El backend de este change corre en paralelo: estos tipos
// siguen el contrato de design.md al pie de la letra, no una implementación
// ya existente.

export type ProgressionStrategy =
  | "constant"
  | "pyramid"
  | "inverted"
  | "drop_set"
  | "rest_pause";

export type RoutineAssignmentStatus = "active" | "alternative";

export type PlannedSet = {
  index: number;
  weight_kg: number;
  reps: number;
  note?: string | null; // "20 s" | "al fallo" | null
};

export type ExerciseBase = {
  sets: number;
  reps: number;
  weight_kg: number;
};

export type RoutineTemplateSummary = {
  id: string;
  name: string;
  tag: string;
  day_count: number;
  assignment_count: number;
  created_at: string;
};

export type RoutineTemplateExercise = {
  exercise_id: string;
  name: string;
  muscle_group: string | null;
  base: ExerciseBase;
  is_active: boolean;
  strategy: ProgressionStrategy;
  planned_sets: PlannedSet[];
};

export type RoutineTemplateDay = {
  day_id: string;
  name: string;
  muscle_groups: string[];
  position: number;
  exercises: RoutineTemplateExercise[];
};

export type RoutineTemplateDetail = {
  id: string;
  name: string;
  tag: string;
  created_at: string;
  updated_at: string;
  days: RoutineTemplateDay[];
};

// Asignación de una plantilla a un Miembro (design D6/D7). La misma forma
// sirve para el listado del admin (`GET /routines/users/{id}/templates`) y
// para el propio listado del miembro (`GET /routines/my/templates`, "sin
// datos de otros" — el backend no expone ahí nada que un Miembro no deba ver
// de sí mismo).
export type RoutineAssignment = {
  id: string;
  user_id: string;
  template_id: string;
  template_name: string;
  template_tag: string;
  status: RoutineAssignmentStatus;
  starts_on?: string | null;
  created_at: string;
  adjustments_count: number;
  last_adjustment: { by_name: string; at: string } | null;
};

// Detalle de la asignación desde el punto de vista del miembro
// (`GET /routines/my/templates/{assignment_id}`): la asignación más los días
// de la plantilla con el plan ya calculado (solo ejercicios activos).
export type MemberRoutineTemplate = RoutineAssignment & {
  days: RoutineTemplateDay[];
};

// --- add-exercise-catalog: espejo de los schemas nuevos de backend/app/schemas.py ---
// (`ExerciseOut`/`ExerciseMetaOut`, design D7/D12). Los valores de
// `MuscleGroup`/`TrainingType` son strings de lista fija (el backend los
// valida; acá no se redeclara el enum, solo el tipo de dato).

export type MuscleGroup = string;
export type TrainingType = string;
export type MediaKind = "file" | "external";

export type Exercise = {
  id: string;
  name: string;
  description?: string | null;
  muscle_group?: MuscleGroup | null;
  training_types: TrainingType[];
  is_active: boolean;
  external_media_url?: string | null;
  // Media derivada (design D3/D6): el backend decide la prioridad, la UI
  // solo lee `media_kind` — no reimplementar la regla acá.
  media_kind?: MediaKind | null;
  media_file_url?: string | null;
  media_content_type?: string | null;
  media_filename?: string | null;
  media_size_bytes?: number | null;
};

export type ExerciseMeta = {
  muscle_groups: MuscleGroup[];
  training_types: TrainingType[];
};
