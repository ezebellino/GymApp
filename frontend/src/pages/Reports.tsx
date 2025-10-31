import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/http";

type Bucket = "day" | "week" | "month";
type BucketRow = { bucket: string; count: number };

export default function ReportsPage() {
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [bucket, setBucket] = useState<Bucket>("day");
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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reportes</h1>

      <Card className="border-white/10 bg-zinc-950/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-zinc-100">Asistencias por periodo</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Controles */}
          <div className="grid sm:grid-cols-4 gap-3">
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="bg-zinc-900/70 border-white/10"
              placeholder="Inicio"
            />
            <Input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="bg-zinc-900/70 border-white/10"
              placeholder="Fin"
            />
            <select
              className="rounded-md bg-zinc-900/70 border border-white/10 px-3 py-2 text-sm text-zinc-300"
              value={bucket}
              onChange={(e) => setBucket(e.target.value as Bucket)}
            >
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
            <Button
              onClick={fetchReport}
              disabled={loading || !start || !end}
              className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30"
              variant="outline"
            >
              {loading ? "Generando…" : "Generar"}
            </Button>
          </div>

          {/* Tabla */}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/70">
                <tr className="text-zinc-300">
                  <th className="text-left p-3">Bucket</th>
                  <th className="text-left p-3">Asistencias</th>
                </tr>
              </thead>
              <tbody className="bg-zinc-950/40">
                {loading && (
                  <tr>
                    <td colSpan={2} className="p-6 text-center">
                      <div className="inline-flex items-center gap-2 text-zinc-400">
                        <span className="h-4 w-4 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
                        Cargando…
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  rows.map((r) => (
                    <tr key={r.bucket} className="border-t border-white/5">
                      <td className="p-3 text-zinc-200">
                        {new Date(r.bucket).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-zinc-100">{r.count}</td>
                    </tr>
                  ))}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td className="p-6 text-center text-zinc-400" colSpan={2}>
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
