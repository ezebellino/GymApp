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
};

// Usuario embebido en la respuesta de /payments y /attendance: proyección
// liviana (sin membresía ni invitación), alcanza para mostrar nombre y
// contacto sin pedirlo aparte.
export type EmbeddedUser = Pick<User, "id" | "first_name" | "last_name" | "full_name" | "email" | "phone" | "role">;

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
  // Legacy/deprecado: el tema pasó a ser una preferencia del usuario
  // (`/auth/me`, `stores/theme.ts`), no del negocio. Este campo de
  // `app_settings` queda sin uso (ver adopt-kinetic-obsidian-theme, dec. 6.5);
  // se mantiene con tipo laxo solo para no romper el `GET /settings` viejo.
  theme_preference?: string | null;
  currency: string;
  default_fee: number;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp_phone: string | null;
  business_hours: string | null;
  payment_alias: string | null;
  payment_notes: string | null;
  payment_reminder_message: string | null;
  payment_reminder_last_sent_at: string | null;
  late_fee_grace_days: number;
  allow_cash: boolean;
  allow_transfer: boolean;
  onboarding_message: string | null;
};

export type RoutineExerciseOption = {
  exercise_id: string;
  name: string;
  muscle_group: string;
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
  muscle_group: string;
  exercises: Array<{
    id: string;
    name: string;
    muscle_group: string;
    description?: string | null;
  }>;
};

export type RoutineExerciseManage = {
  id: string;
  name: string;
  muscle_group: string;
  description?: string | null;
  is_active: boolean;
  day_ids: string[];
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
  muscle_group: string;
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
