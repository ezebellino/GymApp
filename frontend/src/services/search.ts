// src/services/search.ts
import api from "@/lib/http";
import type { User, Payment, Attendance } from "@/types";

export async function searchUsers(q: string): Promise<User[]> {
  const { data } = await api.get<User[]>("/users", { params: { q: q, limit: 20, offset: 0 } });
  return data;
}

export async function fetchUserStats(userId: string): Promise<{
  lastPayment?: Payment | null;
  attendanceCount?: number;
}> {
  // Último pago (ordenado desc por created_at/periodo en backend)
  const { data: payments } = await api.get<Payment[]>("/payments", {
    params: { user_id: userId, limit: 1, offset: 0 },
  });

  // Conteo básico de asistencias
  const { data: attendance } = await api.get<Attendance[]>("/attendance", {
    params: { user_id: userId, limit: 200, offset: 0 },
  });

  return {
    lastPayment: payments?.[0] ?? null,
    attendanceCount: attendance?.length ?? 0,
  };
}
