// src/components/LastPayments.tsx
import { useEffect, useState } from "react";
import api from "@/lib/http";
import type { Payment } from "@/types"; // si ya lo tenés tipado en /types

type Props = {
  clientId: string;
  limit?: number; // por si después querés cambiarlo
};

export default function LastPayments({ clientId, limit = 3 }: Props) {
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data } = await api.get<Payment[]>("/payments", {
          params: {
            user_id: clientId, // 👈 filtramos por usuario
            limit,
            offset: 0,
          },
        });
        if (mounted) setRows(data ?? []);
      } catch (e) {
        console.error(e);
        if (mounted) setErr("No se pudieron cargar pagos.");
      } finally {
        mounted && setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [clientId, limit]);

  if (loading) {
    return <div className="text-xs text-muted-foreground">Cargando…</div>;
  }

  if (err) {
    return <div className="text-xs text-destructive">{err}</div>;
  }

  if (!rows.length) {
    return (
      <div className="text-xs text-muted-foreground">
        Sin pagos registrados todavía.
      </div>
    );
  }

  return (
    <ul className="space-y-2 text-sm">
      {rows.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between border-b border-border pb-2 last:border-0"
        >
          <div className="text-foreground">
            {String(p.period_month).padStart(2, "0")}/{p.period_year}
            <span className="text-muted-foreground">
              {" "}
              · {p.method ?? "—"}
              {p.method === "transfer" && p.method_channel
                ? ` (${p.method_channel})`
                : ""}
            </span>
          </div>
          <div className="text-foreground">${p.amount.toFixed(0)}</div>
        </li>
      ))}
    </ul>
  );
}
