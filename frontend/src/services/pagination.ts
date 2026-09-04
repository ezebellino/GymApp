export type PaginatedResult<T> = {
  items: T[];
  total: number;
};

/**
 * El backend manda el total de una lista en la cabecera `X-Total-Count`. Antes
 * de este archivo, el mismo fallback case-insensitive estaba copiado a mano en
 * cuatro lugares (`services/clients.ts`, `Attendance.tsx`, `Payments.tsx` y dos
 * veces en `Dashboard.tsx`) — ver design.md dec. 3/4.
 *
 * `fallback` lo decide cada caller: las listas pasan `items.length` (mejor
 * estimacion posible si no vino la cabecera); un conteo puro (sin items, p.
 * ej. `fetchAttendanceCount`) pasa `0`.
 */
export function readTotalCount(headers: Record<string, unknown>, fallback: number): number {
  const raw = (headers?.["x-total-count"] ?? headers?.["X-Total-Count"]) as
    | string
    | undefined;
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}
