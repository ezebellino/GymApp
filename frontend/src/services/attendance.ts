import api from "@/lib/http";
import type { Attendance } from "@/types";
import { readTotalCount, type PaginatedResult } from "./pagination";

export type AttendanceParams = {
  q?: string;
  limit?: number;
  offset?: number;
};

export async function fetchAttendance(
  params: AttendanceParams = {},
): Promise<PaginatedResult<Attendance>> {
  const { q, limit = 20, offset = 0 } = params;
  const { data, headers } = await api.get<Attendance[]>("/attendance", {
    params: { q: q || undefined, limit, offset },
  });

  return { items: data, total: readTotalCount(headers, data.length) };
}

export type PeriodRange = { start: string; end: string };

// Conteo puro (sin traer items): usa `limit: 1` y lee el total de la cabecera,
// igual que el `refreshCheckinsToday` que reemplaza en Dashboard.tsx.
export async function fetchAttendanceCount(period: PeriodRange): Promise<number> {
  const { headers } = await api.get("/attendance", {
    params: { ...period, limit: 1, offset: 0 },
  });
  return readTotalCount(headers, 0);
}

export type CheckinInput = { client_id?: string; q?: string };

export async function checkin(input: CheckinInput): Promise<void> {
  await api.post("/attendance/checkin", input);
}
