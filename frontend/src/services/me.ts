import api from "@/lib/http";
import type { Role } from "@/types";
import type { ThemeMode } from "@/lib/theme";

// Shape de `schemas.UserOut` (backend/app/schemas.py): la respuesta de
// `/auth/me` y de `PATCH /auth/me/theme` (que devuelve el mismo recurso, no
// 204, para reconciliar con la query `me`).
export type MeUser = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  client_id: string | null;
  is_active: boolean;
  email_verified: boolean;
  theme_preference: ThemeMode | null;
};

export async function fetchMe(): Promise<MeUser> {
  const { data } = await api.get<MeUser>("/auth/me");
  return data;
}

export async function updateMyTheme(mode: ThemeMode): Promise<MeUser> {
  const { data } = await api.patch<MeUser>("/auth/me/theme", { theme_preference: mode });
  return data;
}
