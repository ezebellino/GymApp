// src/pages/Reports.tsx
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import api from "@/lib/http";

// 👉 Recharts
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";

type BucketRow = { bucket: string; count: number };

type AttendanceDetail = {
  id: string;
  checkin_at: string;
  client: {
    id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
  };
};

export default function ReportsPage() {
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [bucket, setBucket] = useState<"day" | "week" | "month">("day");
  const [rows, setRows] = useState<BucketRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Detalle por día
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRows, setDetailRows] = useState<AttendanceDetail[]>([]);
  const [detailDay, setDetailDay] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal de gráficos
  const [chartOpen, setChartOpen] = useState(false);

  async function fetchReport() {
    if (!start || !end) return;
    setLoading(true);
    try {
      const { data } = await api.get<BucketRow[]>("/reports/attendance", {
        params: { start, end, bucket },
      });
      setRows(data);
      console.log("rows reports", data);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(dayIso: string) {
    if (bucket !== "day") return;
    setDetailDay(dayIso);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const { data } = await api.get<AttendanceDetail[]>(
        "/reports/attendance/detail",
        { params: { day: dayIso } }
      );
      setDetailRows(data);
    } finally {
      setDetailLoading(false);
    }
  }

  // Para Recharts: adaptamos rows a un formato estable
  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        bucket: r.bucket,
        label: bucket === "day" ? r.bucket.slice(5) : r.bucket,
        count: r.count,
      })),
    [rows, bucket]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reportes de asistencia</h1>

      <Card className="border-white/10 bg-zinc-950/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-zinc-100">
            Asistencias por período
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Filtros */}
          <div className="grid sm:grid-cols-4 gap-3">
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="bg-zinc-900/70 border-white/10"
            />
            <Input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="bg-zinc-900/70 border-white/10"
            />
            <select
              className="bg-zinc-900/70 border border-white/10 rounded-md px-3 py-2 text-sm text-zinc-100"
              value={bucket}
              onChange={(e) => setBucket(e.target.value as any)}
            >
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
            <div className="flex gap-2">
              <Button
                onClick={fetchReport}
                disabled={loading || !start || !end}
                className="w-1/2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30"
                variant="outline"
              >
                {loading ? "Generando…" : "Generar"}
              </Button>
              {rows.length > 0 && (
                <Button
                  type="button"
                  onClick={() => setChartOpen(true)}
                  className="hidden sm:inline-flex w-1/2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-xs"
                  variant="outline"
                >
                  Ver gráficos
                </Button>
              )}
            </div>
          </div>

          {/* Tabla buckets */}
          <div className="overflow-auto rounded-md border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/70 text-zinc-300">
                <tr>
                  <th className="text-left p-2">Bucket</th>
                  <th className="text-left p-2">Asistencias</th>
                </tr>
              </thead>
              <tbody className="bg-zinc-950/40">
                {rows.map((r) => (
                  <tr
                    key={r.bucket}
                    className={
                      "border-t border-white/5 " +
                      (bucket === "day"
                        ? "cursor-pointer hover:bg-zinc-800/50"
                        : "")
                    }
                    onClick={() => bucket === "day" && openDetail(r.bucket)}
                  >
                    <td className="p-2 text-zinc-200">{r.bucket}</td>
                    <td className="p-2 text-zinc-100">{r.count}</td>
                  </tr>
                ))}
                {!rows.length && !loading && (
                  <tr>
                    <td
                      className="p-4 text-center text-zinc-400"
                      colSpan={2}
                    >
                      Sin datos. Seleccioná un rango y generá el reporte.
                    </td>
                  </tr>
                )}
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
              </tbody>
            </table>
          </div>

          {/* Botón de gráficos también visible abajo en mobile */}
          {rows.length > 0 && (
            <div className="sm:hidden flex justify-center">
              <Button
                type="button"
                onClick={() => setChartOpen(true)}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-xs"
                variant="outline"
              >
                Ver gráficos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog detalle (quién vino ese día) */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg border-white/10 bg-zinc-900/90 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Asistencias del día</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {detailDay
                ? `Clientes que hicieron check-in el ${detailDay}.`
                : "Seleccioná un día en el reporte."}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-6 text-center text-zinc-400">Cargando…</div>
          ) : detailRows.length === 0 ? (
            <div className="py-6 text-center text-zinc-400">
              No hubo asistencias registradas ese día.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto mt-2">
              <table className="w-full text-sm">
                <thead className="text-zinc-400">
                  <tr>
                    <th className="text-left py-1">Hora</th>
                    <th className="text-left py-1">Cliente</th>
                    <th className="text-left py-1">Contacto</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((a) => (
                    <tr key={a.id} className="border-t border-white/5">
                      <td className="py-1 pr-2 text-zinc-300">
                        {new Date(a.checkin_at).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-1 pr-2 text-zinc-100">
                        {a.client.full_name}
                      </td>
                      <td className="py-1 text-xs text-zinc-400">
                        {a.client.phone ?? "—"} • {a.client.email ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de GRÁFICOS con Recharts */}
      <Dialog open={chartOpen} onOpenChange={setChartOpen}>
        <DialogContent className="max-w-3xl border-white/10 bg-zinc-900/95 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Gráficos de asistencia</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Distribución de asistencias para el rango seleccionado.
            </DialogDescription>
          </DialogHeader>

          {chartData.length === 0 ? (
            <div className="py-6 text-center text-zinc-400">
              No hay datos para graficar.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Gráfico de barras */}
              <div className="h-64 rounded-lg bg-zinc-950/80 border border-white/10 px-2 py-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148,163,184,0.2)"
                    />
                    <XAxis
                      dataKey="label"
                      stroke="#e5e7eb"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      stroke="#e5e7eb"
                      tick={{ fontSize: 10 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#020617",
                        border: "1px solid rgba(148,163,184,0.4)",
                        borderRadius: "0.5rem",
                        color: "#f9fafb",
                        fontSize: "0.75rem",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#22d3ee"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfico de área */}
              <div className="h-64 rounded-lg bg-zinc-950/80 border border-white/10 px-2 py-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="attendanceArea"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148,163,184,0.2)"
                    />
                    <XAxis
                      dataKey="label"
                      stroke="#e5e7eb"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      stroke="#e5e7eb"
                      tick={{ fontSize: 10 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#020617",
                        border: "1px solid rgba(148,163,184,0.4)",
                        borderRadius: "0.5rem",
                        color: "#f9fafb",
                        fontSize: "0.75rem",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      fill="url(#attendanceArea)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
