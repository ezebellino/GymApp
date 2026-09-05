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

export type PageRange = {
  page: number;
  pages: number;
  from: number;
  to: number;
};

/**
 * Aritmética de paginación pura, extraída de `Pagination.tsx` (dec. 8 de
 * redesign-list-page-layout) para que sea testeable sin montar el
 * componente: `total=0`, la última página parcial y un `offset` fuera de
 * rango son los tres casos donde un off-by-one se cuela fácil.
 *
 * `page`/`pages` son 1-indexados (para mostrar "pág X / Y"); `from`/`to` son
 * el rango 1-indexado de items mostrados ("Mostrando X-Y de Z").
 */
export function getPageRange({
  total,
  limit,
  offset,
}: {
  total: number;
  limit: number;
  offset: number;
}): PageRange {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(total, offset + limit);

  return { page, pages, from, to };
}
