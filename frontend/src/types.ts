export type Client = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  is_active: boolean;
  join_date: string; // ISO
};
