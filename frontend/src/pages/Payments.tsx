import { useEffect, useMemo, useState } from "react";
import { CalendarRange, CreditCard, Search, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/http";
import { useLocation } from "react-router-dom";

type PaymentClient = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
};

type Payment = {
  id: string;
  client_id: string;
  client?: PaymentClient | null;
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

const isUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    str
  );

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="rounded-[24px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.08),rgba(255,255,255,0.02)_50%,rgba(249,115,22,0.09))] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{value}</p>
          <p className="mt-1 text-sm text-zinc-400">{hint}</p>
        </div>
        <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(250,204,21,0.2),rgba(255,247,237,0.08),rgba(249,115,22,0.22))] p-3">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const location = useLocation();
  const [q, setQ] = useState<string>("");
  const [items, setItems] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  async function loadWith(paramsIn: {
    q?: string;
    client_id?: string;
    limit?: number;
    offset?: number;
  }) {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit, offset, ...paramsIn };
      const { data, headers } = await api.get<Payment[]>("/payments", { params });
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
    const sp = new URLSearchParams(location.search);
    const clientIdQS = sp.get("client_id") || sp.get("clientId") || "";
    const qQS = sp.get("q") || "";
    const clientNameQS = sp.get("client_name");

    if (clientNameQS) setQ(clientNameQS);
    else if (clientIdQS) setQ(clientIdQS);
    else if (qQS) setQ(qQS);
    else setQ("");

    if (clientIdQS) {
      loadWith({ client_id: clientIdQS, limit, offset: 0 });
      setOffset(0);
    } else if (qQS) {
      loadWith({ q: qQS, limit, offset: 0 });
      setOffset(0);
    } else {
      loadWith({ limit, offset: 0 });
      setOffset(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const onSearch = () => {
    const trimmed = q.trim();
    setOffset(0);
    if (!trimmed) return loadWith({ limit, offset: 0 });
    if (isUUID(trimmed)) return loadWith({ client_id: trimmed, limit, offset: 0 });
    return loadWith({ q: trimmed, limit, offset: 0 });
  };

  useEffect(() => {
    if (offset === 0) return;
    const trimmed = q.trim();
    if (!trimmed) loadWith({ limit, offset });
    else if (isUUID(trimmed)) loadWith({ client_id: trimmed, limit, offset });
    else loadWith({ q: trimmed, limit, offset });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const rows = useMemo(() => items, [items]);
  const totalAmount = rows.reduce((sum, payment) => sum + payment.amount, 0);
  const cashCount = rows.filter((payment) => payment.method === "cash").length;
  const transferCount = rows.filter(
    (payment) => payment.method === "transfer"
  ).length;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="rounded-[28px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.1),rgba(255,247,237,0.03)_45%,rgba(249,115,22,0.11))] p-6 shadow-[0_20px_80px_-40px_rgba(249,115,22,0.42)]">
          <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-100">
            Pagos
          </div>
          <h1 className="warm-accent-text mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Analiza movimientos y encuentra cobros con mas rapidez.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
            Filtra por cliente, email, telefono o UUID y mantente enfocado en los
            movimientos relevantes del periodo.
          </p>
        </div>

        <div className="rounded-[28px] border border-amber-200/10 bg-white/[0.035] p-6 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
            Filtro activo
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-zinc-400">Busqueda actual</p>
              <p className="text-lg font-semibold text-zinc-100">
                {q.trim() ? `"${q.trim()}"` : "Sin filtro"}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.12),rgba(255,247,237,0.05),rgba(249,115,22,0.12))] p-4 text-sm text-amber-50">
              Esta pagina muestra {rows.length} movimiento{rows.length === 1 ? "" : "s"} cargado{rows.length === 1 ? "" : "s"}.
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Movimientos visibles"
          value={rows.length.toLocaleString("es-AR")}
          hint="Registros renderizados en esta pagina"
          icon={Wallet}
        />
        <StatCard
          label="Monto visible"
          value={nfARS.format(totalAmount)}
          hint="Suma de los importes actualmente listados"
          icon={CreditCard}
        />
        <StatCard
          label="Metodos"
          value={`${cashCount} ef. / ${transferCount} transf.`}
          hint="Distribucion rapida en la vista actual"
          icon={CalendarRange}
        />
      </section>

      <Card className="rounded-[28px] border-amber-200/10 bg-zinc-950/60 backdrop-blur-md">
        <CardHeader className="border-b border-amber-200/10 pb-5">
          <CardTitle className="text-zinc-100">Listado de pagos</CardTitle>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full gap-2 sm:max-w-xl">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  placeholder="Nombre, email, telefono o UUID"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onSearch()}
                  className="border-amber-200/10 bg-zinc-900/70 pl-10 focus-visible:ring-amber-400/35"
                />
              </div>
              <Button
                onClick={onSearch}
                disabled={loading}
                className="border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.14),rgba(255,247,237,0.06),rgba(249,115,22,0.16))] text-amber-50 hover:opacity-95"
                variant="outline"
              >
                {loading ? "Buscando..." : "Buscar"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="border-amber-200/10 hover:bg-white/[0.08]"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={offset + limit >= total || loading}
                onClick={() => setOffset(offset + limit)}
                className="border-amber-200/10 hover:bg-white/[0.08]"
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          <div className="overflow-hidden rounded-2xl border border-amber-200/10">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/70">
                <tr className="text-zinc-300">
                  <th className="p-4 text-left">Fecha</th>
                  <th className="p-4 text-left">Cliente</th>
                  <th className="p-4 text-left">Periodo</th>
                  <th className="p-4 text-left">Monto</th>
                  <th className="p-4 text-left">Metodo</th>
                </tr>
              </thead>
              <tbody className="bg-zinc-950/40">
                {loading && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center">
                      <div className="inline-flex items-center gap-2 text-zinc-400">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
                        Cargando movimientos...
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-zinc-400">
                      No hay pagos para los filtros actuales.
                    </td>
                  </tr>
                )}

                {!loading &&
                  rows.map((payment) => (
                    <tr key={payment.id} className="border-t border-white/5">
                      <td className="p-4 text-zinc-200">
                        {new Date(payment.created_at).toLocaleString("es-AR")}
                      </td>

                      <td className="p-4 text-zinc-200">
                        <div className="font-medium text-zinc-100">
                          {payment.client?.full_name ?? "-"}
                        </div>
                        {(payment.client?.email || payment.client?.phone) && (
                          <div className="mt-1 text-xs text-zinc-400">
                            {payment.client?.email ?? "-"} · {payment.client?.phone ?? "-"}
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-zinc-300">
                        {String(payment.period_month).padStart(2, "0")}/{payment.period_year}
                      </td>

                      <td className="p-4 font-semibold text-zinc-100">
                        {nfARS.format(payment.amount)}
                      </td>

                      <td className="p-4">
                        {payment.method ? (
                          payment.method === "cash" ? (
                            <Badge className="border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.14),rgba(255,247,237,0.05),rgba(249,115,22,0.14))] text-amber-50">
                              efectivo
                            </Badge>
                          ) : payment.method === "transfer" ? (
                            <Badge className="border border-orange-300/20 bg-orange-500/12 text-orange-100">
                              transferencia
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-white/20 text-zinc-300"
                            >
                              {payment.method}
                            </Badge>
                          )
                        ) : (
                          <span className="text-zinc-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-zinc-400">
            <div>
              Total encontrados:{" "}
              <span className="font-medium text-zinc-100">{total}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="border-amber-200/10 hover:bg-white/[0.08]"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={offset + limit >= total || loading}
                onClick={() => setOffset(offset + limit)}
                className="border-amber-200/10 hover:bg-white/[0.08]"
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
