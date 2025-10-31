// src/services/search.ts
import api from "@/lib/http";
import type { Client, Payment, Attendance } from "@/types";

export async function searchClients(q: string): Promise<Client[]> {
  const { data } = await api.get<Client[]>("/clients", { params: { q, limit: 20, offset: 0 } });
  return data;
}

export async function fetchClientStats(clientId: string): Promise<{
  lastPayment?: Payment | null;
  attendanceCount?: number;
}> {
  // Último pago (ordenado desc por created_at/periodo en backend)
  const { data: payments } = await api.get<Payment[]>("/payments", {
    params: { client_id: clientId, limit: 1, offset: 0 },
  });

  // Conteo básico de asistencias (si implementaste /attendance?client_id=)
  const { data: attendance } = await api.get<Attendance[]>("/attendance", {
    params: { client_id: clientId, limit: 1_000, offset: 0 },
  });

  return {
    lastPayment: payments?.[0] ?? null,
    attendanceCount: attendance?.length ?? 0,
  };
}
