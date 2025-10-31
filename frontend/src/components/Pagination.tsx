type Props = {
  total: number;
  limit: number;
  offset: number;
  onChange: (next: { limit: number; offset: number }) => void;
};

export default function Pagination({ total, limit, offset, onChange }: Props) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));

  const prev = () => onChange({ limit, offset: Math.max(0, offset - limit) });
  const next = () =>
    onChange({
      limit,
      offset: Math.min((pages - 1) * limit, offset + limit),
    });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-zinc-300">
      {/* Info */}
      <div className="text-zinc-400">
        Mostrando{" "}
        <span className="font-medium text-zinc-100">
          {Math.min(total, offset + 1)}–{Math.min(total, offset + limit)}
        </span>{" "}
        de <span className="font-medium text-zinc-100">{total}</span>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-2">
        <select
          className="rounded-md bg-zinc-900/80 border border-white/10 px-2 py-1.5 text-xs text-zinc-300 backdrop-blur-md focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          value={limit}
          onChange={(e) =>
            onChange({ limit: Number(e.target.value), offset: 0 })
          }
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / pág
            </option>
          ))}
        </select>

        <button
          onClick={prev}
          disabled={page <= 1}
          className="rounded-md border border-white/10 px-2 py-1.5 text-xs transition-all
                     disabled:opacity-40 hover:bg-white/10 hover:text-zinc-100"
        >
          ← Anterior
        </button>

        <div className="text-xs text-zinc-400 select-none">
          pág <b className="text-zinc-100">{page}</b> / {pages}
        </div>

        <button
          onClick={next}
          disabled={page >= pages}
          className="rounded-md border border-white/10 px-2 py-1.5 text-xs transition-all
                     disabled:opacity-40 hover:bg-white/10 hover:text-zinc-100"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
