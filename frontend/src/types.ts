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