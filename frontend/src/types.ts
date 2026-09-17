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

export type RoutineDayProgress = {
  day_id: string;
  day_name: string;
  muscle_groups: string[];
  active_exercise_count: number;
  log_count: number;
  last_performed_at?: string | null;
};

// `member-routine-copies` (design D3, D6): reemplaza a `WorkoutLog` — grano
// una fila = una serie marcada, no un ejercicio con `sets_count`.
export type WorkoutSetLog = {
  id: string;
  user_id: string;
  // `null` cuando se quitó el día de la copia o se borró la copia entera
  // (`SET NULL`, design D3/D7); `day_name` es el snapshot que sigue
  // identificando el registro.
  assignment_day_id: string | null;
  day_name: string;
  exercise_id: string;
  exercise_name: string;
  muscle_group: string | null;
  set_index: number;
  reps: number;
  weight_kg: number;
  note?: string | null;
  performed_on: string; // ISO date
  performed_at: string; // ISO datetime
};

// Ejercicios **con registros** de un Miembro (`GET
// /routines/users/{id}/logged-exercises`, design D6/D10): alimenta el filtro
// de la vista de Progreso, alimentado por el histórico, no por la copia
// vigente — un ejercicio ya quitado sigue siendo filtrable.
export type LoggedExercise = {
  exercise_id: string;
  name: string;
  muscle_group: string | null;
};

export type ProgressImprovement = {
  exercise_name: string;
  start_weight: number;
  end_weight: number;
  delta_weight: number;
};

// `template-owned-routine-days` (design D10): el overview y el progreso del
// Miembro siguen siempre la asignación **Activa** — `null` cuando no tiene
// una (aunque tenga Alternativas). La UI muestra "Sin plantilla activa" en
// vez del nombre de una Alternativa.
export type ActiveAssignmentRef = {
  assignment_id: string;
  template_name: string;
};

// `member-routine-copies` (design D14, corrección del gate): `unique_days`
// saturaba en 5 (tope estructural de días por copia) y no crecía con la
// constancia — `session_count` (`performed_on` distintos) lo reemplaza, y el
// puntaje pasa a calcularlo el servidor (`score`): el cliente deja de
// reimplementar la fórmula (`UserCard.tsx`).
export type UserProgressSummary = {
  user_id: string;
  user_name: string;
  gym_name: string;
  log_count: number;
  attendance_count: number;
  session_count: number;
  unique_exercises: number;
  total_volume: number;
  score: number;
  last_training?: string | null;
  best_exercise_name?: string | null;
  best_weight_kg?: number | null;
  top_improvement?: ProgressImprovement | null;
  motivation: string;
  active_assignment: ActiveAssignmentRef | null;
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

// La marca de **hoy** de una serie planificada (`member-routine-copies`,
// design D6): embebida en `PlannedSet.logged`, solo presente en el plan del
// propio Miembro (`GET /routines/my/templates/{assignment_id}`).
export type LoggedSet = {
  weight_kg: number;
  reps: number;
  performed_at: string; // ISO datetime
};

export type PlannedSet = {
  index: number;
  weight_kg: number;
  reps: number;
  note?: string | null; // "20 s" | "al fallo" | null
  logged?: LoggedSet | null;
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

// `template-owned-routine-days` (design D1/D5): el día y el ejercicio son
// propios de la plantilla, sin `is_active` — estar en la lista **es** estar
// en la plantilla. `muscle_groups` es editable (multi-select del enum
// `MuscleGroup`) y `base`/`strategy` son propias de esa combinación
// (plantilla, día, ejercicio).
export type RoutineTemplateExercise = {
  exercise_id: string;
  name: string;
  muscle_group: string | null;
  base: ExerciseBase;
  strategy: ProgressionStrategy;
  // `routine-exercise-intensity`: intensidad y descanso prescritos, los dos
  // opcionales (`null` = sin prescribir). El backend guarda y devuelve
  // SIEMPRE el RIR — el RPE es la misma escala invertida (`rirToRpe` en
  // `lib/intensity.ts`) y lo deriva el cliente para mostrar.
  rir: number | null;
  rest_seconds: number | null;
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
// `member-routine-copies` (design D2b): `template_id` queda `null` si se
// borró la plantilla origen (una copia Alternativa la sobrevive);
// `template_name`/`template_tag` son siempre el snapshot tomado al copiar,
// nunca el nombre vivo de la plantilla.
export type RoutineAssignment = {
  id: string;
  user_id: string;
  template_id: string | null;
  template_name: string;
  template_tag: string;
  status: RoutineAssignmentStatus;
  starts_on?: string | null;
  created_at: string;
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
