export type Role = "owner" | "coach";

export type Client = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  is_active: boolean;
  join_date: string; // ISO
};

export type Payment = {
  id: string;
  client_id: string;
  amount: number;
  method: "cash" | "transfer" | null;
  method_channel?: string | null;
  period_month: number;
  period_year: number;
  created_at: string; // ISO
};

export type Attendance = {
  id: string;
  client_id: string;
  coach_id?: string | null;
  checkin_at: string; // ISO
};

export type AppSettings = {
  gym_name: string;
  currency: string;
  default_fee: number;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp_phone: string | null;
  business_hours: string | null;
  payment_alias: string | null;
  payment_notes: string | null;
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
