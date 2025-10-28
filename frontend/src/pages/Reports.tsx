import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/http";

type BucketRow = { bucket: string; count: number };

export default function ReportsPage() {
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [bucket, setBucket] = useState<"day" | "week" | "month">("day");
  const [rows, setRows] = useState<BucketRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchReport() {
    if (!start || !end) return;
    setLoading(true);
    try {
      const { data } = await api.get<BucketRow[]>("/reports/attendance", {
        params: { start, end, bucket },
      });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Reportes de Asistencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-2">
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="Inicio"
            />
            <Input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder="Fin"
            />
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={bucket}
              onChange={(e) => setBucket(e.target.value as any)}
            >
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
            <Button onClick={fetchReport} disabled={loading || !start || !end}>
              Generar
            </Button>
          </div>

          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Bucket</th>
                  <th className="text-left p-2">Asistencias</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.bucket} className="border-t">
                    <td className="p-2">{r.bucket}</td>
                    <td className="p-2">{r.count}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="p-4 text-center text-muted-foreground" colSpan={2}>
                      Sin datos. Seleccioná un rango y generá el reporte.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
