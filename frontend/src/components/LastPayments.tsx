// src/components/LastPayments.tsx
import { useEffect, useState } from "react";
import api from "@/lib/http";

type Payment = {
  id: string;
  amount: number;
  method: "cash" | "transfer" | string | null;
  method_channel?: string | null;
  period_month: number;
  period_year: number;
  created_at: string;
};

export default function LastPayments({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get<Payment[]>("/payments", {
          params: { client_id: clientId, limit: 3, offset: 0 },
        });
        if (mounted) setRows(data);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [clientId]);

  if (loading) return <div className="text-xs text-zinc-400">Cargando…</div>;
  if (!rows.length) return <div className="text-sm text-zinc-400">Sin pagos recientes.</div>;

  return (
    <ul className="space-y-2 text-sm">
      {rows.map((p) => (
        <li key={p.id} className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="text-zinc-200">
            {String(p.period_month).padStart(2, "0")}/{p.period_year}
            <span className="text-zinc-400"> · {p.method ?? "—"}{p.method === "transfer" && p.method_channel ? ` (${p.method_channel})` : ""}</span>
          </div>
          <div className="text-zinc-100">${p.amount.toFixed(0)}</div>
        </li>
      ))}
    </ul>
  );
}
