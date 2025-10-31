import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/http";

type PaymentClient = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
};

type Payment = {
  id: string;
  client_id: string;
  client?: PaymentClient | null; // 👈 disponible gracias al backend
  amount: number;
  method: "cash" | "transfer" | string | null;
  note?: string | null;
  period_month: number;
  period_year: number;
  created_at: string;
};

const nfARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function PaymentsPage() {
  const [items, setItems] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");               // 👈 ahora buscamos por nombre/email/teléfono
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const { data, headers } = await api.get<Payment[]>("/payments", {
        params: { q: q || undefined, limit, offset }, // 👈 usamos q
      });
      setItems(data);
      const totalHeader =
        (headers["x-total-count"] as string) ??
        ((headers["X-Total-Count"] as unknown) as string);
      setTotal(totalHeader ? Number(totalHeader) : data.length);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const rows = useMemo(() => items, [items]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pagos</h1>

      <Card className="border-white/10 bg-zinc-950/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-zinc-100">Listado de pagos</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex gap-2 w-full sm:max-w-xl">
              <Input
                placeholder="Buscar por nombre, email o teléfono…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="bg-zinc-900/70 border-white/10"
              />
              <Button
                onClick={() => {
                  setOffset(0);
                  load();
                }}
                disabled={loading}
                className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30"
                variant="outline"
              >
                {loading ? "Buscando…" : "Buscar"}
              </Button>
            </div>

            {/* Paginador simple */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="border-white/10 hover:bg-white/10"
              >
                ← Anterior
              </Button>
              <Button
                variant="outline"
                disabled={offset + limit >= total || loading}
                onClick={() => setOffset(offset + limit)}
                className="border-white/10 hover:bg-white/10"
              >
                Siguiente →
              </Button>
            </div>
          </div>

          {/* Tabla */}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/70">
                <tr className="text-zinc-300">
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Periodo</th>
                  <th className="text-left p-3">Monto</th>
                  <th className="text-left p-3">Método</th>
                </tr>
              </thead>
              <tbody className="bg-zinc-950/40">
                {loading && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center">
                      <div className="inline-flex items-center gap-2 text-zinc-400">
                        <span className="h-4 w-4 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
                        Cargando…
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-zinc-400">
                      Sin resultados.
                    </td>
                  </tr>
                )}

                {!loading &&
                  rows.map((p) => (
                    <tr key={p.id} className="border-t border-white/5">
                      <td className="p-3 text-zinc-200">
                        {new Date(p.created_at).toLocaleString()}
                      </td>

                      {/* 👇 mostramos nombre completo (y un subtítulo con email/teléfono) */}
                      <td className="p-3 text-zinc-200">
                        {p.client?.full_name ?? "—"}
                        {(p.client?.email || p.client?.phone) && (
                          <div className="text-xs text-zinc-400">
                            {p.client?.email ?? "—"} · {p.client?.phone ?? "—"}
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-zinc-300">
                        {String(p.period_month).padStart(2, "0")}/{p.period_year}
                      </td>

                      <td className="p-3 text-zinc-100">
                        {nfARS.format(p.amount)}
                      </td>

                      <td className="p-3">
                        {p.method ? (
                          p.method === "cash" ? (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                              efectivo
                            </Badge>
                          ) : p.method === "transfer" ? (
                            <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                              transferencia
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-white/20 text-zinc-300">
                              {p.method}
                            </Badge>
                          )
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Footer paginación */}
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <div>
              Total: <span className="text-zinc-100">{total}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="border-white/10 hover:bg-white/10"
              >
                ← Anterior
              </Button>
              <Button
                variant="outline"
                disabled={offset + limit >= total || loading}
                onClick={() => setOffset(offset + limit)}
                className="border-white/10 hover:bg-white/10"
              >
                Siguiente →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
