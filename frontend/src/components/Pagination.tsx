import { getPageRange } from "@/services/pagination";

type Props = {
  total: number;
  limit: number;
  offset: number;
  onChange: (next: { limit: number; offset: number }) => void;
};

export default function Pagination({
  total,
  limit,
  offset,
  onChange,
}: Props) {
  const { page, pages, from, to } = getPageRange({ total, limit, offset });

  const prev = () => onChange({ limit, offset: Math.max(0, offset - limit) });
  const next = () =>
    onChange({
      limit,
      offset: Math.min((pages - 1) * limit, offset + limit),
    });

  return (
    <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      {/* Rango a la izquierda, controles a la derecha, en una sola fila a
          partir de `sm` (dec. 19.1 de redesign-list-page-layout): la
          redundancia con el total del header queda aceptada por el PO —
          revierte la dec. 8, que ocultaba este bloque en Usuarios para no
          repetirlo. */}
      <div className="text-muted-foreground">
        Mostrando{" "}
        <span className="font-medium text-foreground">
          {from}-{to}
        </span>{" "}
        de <span className="font-medium text-foreground">{total}</span>
      </div>

      <div className="flex items-center gap-2">
        <select
          className="rounded-md border border-border bg-surface-1/80 px-2 py-1.5 text-xs text-muted-foreground backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-ring"
          value={limit}
          onChange={(e) => onChange({ limit: Number(e.target.value), offset: 0 })}
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / pag
            </option>
          ))}
        </select>

        <button
          onClick={prev}
          disabled={page <= 1}
          className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-all hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
        >
          Anterior
        </button>

        <div className="select-none text-xs text-muted-foreground">
          pag <b className="text-foreground">{page}</b> / {pages}
        </div>

        <button
          onClick={next}
          disabled={page >= pages}
          className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-all hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
