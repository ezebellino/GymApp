export type Role = "owner" | "coach" | "user";

export type Client = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  is_active: boolean;
  join_date: string; // ISO
};

// Cliente embebido en la respuesta de /payments y /attendance: no es el
// `Client` completo (sin `join_date`), pero alcanza para mostrar nombre y
// contacto sin pedirlo aparte.
export type EmbeddedClient = Pick<Client, "id" | "full_name" | "email" | "phone" | "is_active">;

export type Payment = {
  id: string;
  client_id: string;
  client?: EmbeddedClient | null;
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
  client_id: string;
  coach_id?: string | null;
  client?: EmbeddedClient | null;
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
  client_id: string;
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

export type ClientProgressSummary = {
  client_id: string;
  client_name: string;
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
