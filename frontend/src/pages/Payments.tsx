import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/http";

type Payment = {
  id: string;
  client_id: string;
  amount: number;
  method: string | null;
  note?: string | null;
  period_month: number;
  period_year: number;
  created_at: string;
};

export default function PaymentsPage() {
  const [items, setItems] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [qClient, setQClient] = useState("");
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const { data, headers } = await api.get<Payment[]>("/payments", {
        params: {
          client_id: qClient || undefined,
          limit,
          offset,
        },
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

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Filtrar por client_id (UUID)"
              value={qClient}
              onChange={(e) => setQClient(e.target.value)}
            />
            <Button onClick={() => { setOffset(0); load(); }} disabled={loading}>
              Buscar
            </Button>
          </div>

          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">Periodo</th>
                  <th className="text-left p-2">Monto</th>
                  <th className="text-left p-2">Método</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="p-2">{p.client_id}</td>
                    <td className="p-2">
                      {String(p.period_month).padStart(2, "0")}/{p.period_year}
                    </td>
                    <td className="p-2">${p.amount.toFixed(2)}</td>
                    <td className="p-2">{p.method ?? "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading && (
                  <tr>
                    <td className="p-4 text-center text-muted-foreground" colSpan={5}>
                      Sin resultados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Total: {total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={offset + limit >= total || loading}
                onClick={() => setOffset(offset + limit)}
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
