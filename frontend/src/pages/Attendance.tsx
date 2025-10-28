import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/http";

type AttendanceRow = {
  id: string;
  client_id: string;
  coach_id: string | null;
  checkin_at: string; // ISO
};

export default function AttendancePage() {
  const [items, setItems] = useState<AttendanceRow[]>([]);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // Suponiendo que implementemos GET /attendance?client_id=&limit=&offset=
      const { data } = await api.get<AttendanceRow[]>("/attendance", {
        params: { client_id: clientId || undefined, limit, offset },
      });
      setItems(data);
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
          <CardTitle>Asistencias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Filtrar por client_id (UUID)"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
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
                  <th className="text-left p-2">Coach</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2">{new Date(a.checkin_at).toLocaleString()}</td>
                    <td className="p-2">{a.client_id}</td>
                    <td className="p-2">{a.coach_id ?? "-"}</td>
                  </tr>
                ))}
                {!items.length && !loading && (
                  <tr>
                    <td className="p-4 text-center text-muted-foreground" colSpan={3}>
                      Sin resultados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => setOffset(offset + limit)}
            >
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
