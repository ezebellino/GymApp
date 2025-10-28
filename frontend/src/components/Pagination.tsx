type Props = {
  total: number;
  limit: number;
  offset: number;
  onChange: (next: { limit: number; offset: number }) => void;
};

export default function Pagination({ total, limit, offset, onChange }: Props) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));

  const prev = () =>
    onChange({ limit, offset: Math.max(0, offset - limit) });

  const next = () =>
    onChange({
      limit,
      offset: Math.min((pages - 1) * limit, offset + limit),
    });

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div>
        Mostrando{" "}
        <b>
          {Math.min(total, offset + 1)}–{Math.min(total, offset + limit)}
        </b>{" "}
        de <b>{total}</b>
      </div>
      <div className="flex items-center gap-2">
        <select
          className="border rounded-md px-2 py-1"
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
          className="border rounded-md px-2 py-1 disabled:opacity-50"
          onClick={prev}
          disabled={page <= 1}
        >
          ← Anterior
        </button>
        <div>
          pág <b>{page}</b> / {pages}
        </div>
        <button
          className="border rounded-md px-2 py-1 disabled:opacity-50"
          onClick={next}
          disabled={page >= pages}
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
