import api from "@/lib/http";
import type { AppSettings } from "@/types";

export async function fetchSettings(): Promise<AppSettings> {
  const { data } = await api.get<AppSettings>("/settings");
  return data;
}
