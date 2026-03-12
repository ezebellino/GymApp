import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarRange,
  CircleDollarSign,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import api from "@/lib/http";
import { alertError } from "@/lib/alerts";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type BucketRow = { bucket: string; count: number };
type RevenueRow = { bucket: string; total: number };

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

type StatCardProps = {
  title: string;
  value: string;
  hint: string;
  icon: typeof Users;
};

const bucketLabels = {
  day: "Dia",
  week: "Semana",
  month: "Mes",
} as const;

const nfARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function toLabel(bucket: string, mode: "day" | "week" | "month") {
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) return bucket;

  if (mode === "month") {
    return date.toLocaleDateString("es-AR", {
      month: "short",
      year: "2-digit",
    });
  }

  if (mode === "week") {
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
    });
  }

  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function StatCard({ title, value, hint, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-[24px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.07),rgba(255,255,255,0.02)_48%,rgba(249,115,22,0.08))] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
            {title}
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{value}</p>
          <p className="mt-1 text-sm text-zinc-400">{hint}</p>
        </div>
        <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(250,204,21,0.2),rgba(255,247,237,0.08),rgba(249,115,22,0.22))] p-3 text-amber-50">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [bucket, setBucket] = useState<"day" | "week" | "month">("day");
  const [attendanceRows, setAttendanceRows] = useState<BucketRow[]>([]);
  const [newClientsRows, setNewClientsRows] = useState<BucketRow[]>([]);
  const [revenueRows, setRevenueRows] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRows, setDetailRows] = useState<AttendanceDetail[]>([]);
  const [detailDay, setDetailDay] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);

  async function fetchReport() {
    if (!start || !end) return;
    setLoading(true);
    try {
      const [attendanceResp, clientsResp, revenueResp] = await Promise.all([
        api.get<BucketRow[]>("/reports/attendance", {
          params: { start, end, bucket },
        }),
        api.get<BucketRow[]>("/reports/new_clients", {
          params: { start, end, bucket: bucket === "day" ? "week" : bucket },
        }),
        api.get<RevenueRow[]>("/reports/revenue", {
          params: { start, end, bucket },
        }),
      ]);

      setAttendanceRows(attendanceResp.data);
      setNewClientsRows(clientsResp.data);
      setRevenueRows(revenueResp.data);
    } catch (error) {
      console.error("Error generando reportes", error);
      await alertError(
        "No se pudieron generar los reportes",
        "Revisa el rango seleccionado e intenta nuevamente."
      );
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
      const { data } = await api.get<AttendanceDetail[]>("/reports/attendance/detail", {
        params: { day: dayIso.slice(0, 10) },
      });
      setDetailRows(data);
    } catch (error) {
      console.error("Error cargando detalle del dia", error);
      await alertError(
        "No se pudo cargar el detalle",
        "Intenta nuevamente dentro de unos segundos."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  const totalAttendance = useMemo(
    () => attendanceRows.reduce((acc, row) => acc + row.count, 0),
    [attendanceRows]
  );

  const totalRevenue = useMemo(
    () => revenueRows.reduce((acc, row) => acc + row.total, 0),
    [revenueRows]
  );

  const totalNewClients = useMemo(
    () => newClientsRows.reduce((acc, row) => acc + row.count, 0),
    [newClientsRows]
  );

  const strongestAttendanceBucket = useMemo(() => {
    if (attendanceRows.length === 0) return "Sin datos";
    const winner = attendanceRows.reduce((current, row) =>
      row.count > current.count ? row : current
    );
    return `${toLabel(winner.bucket, bucket)} (${winner.count})`;
  }, [attendanceRows, bucket]);

  const attendanceChartData = useMemo(
    () =>
      attendanceRows.map((row) => ({
        bucket: row.bucket,
        label: toLabel(row.bucket, bucket),
        count: row.count,
      })),
    [attendanceRows, bucket]
  );

  const revenueChartData = useMemo(
    () =>
      revenueRows.map((row) => ({
        bucket: row.bucket,
        label: toLabel(row.bucket, bucket),
        total: row.total,
      })),
    [revenueRows, bucket]
  );

  const clientsChartData = useMemo(
    () =>
      newClientsRows.map((row) => ({
        bucket: row.bucket,
        label: toLabel(row.bucket, bucket === "day" ? "week" : bucket),
        count: row.count,
      })),
    [newClientsRows, bucket]
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="rounded-[28px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.1),rgba(255,247,237,0.03)_45%,rgba(249,115,22,0.11))] p-6 shadow-[0_20px_80px_-40px_rgba(249,115,22,0.42)]">
          <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-100">
            Analitica del negocio
          </div>
          <h1 className="warm-accent-text mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Lee la operacion del gimnasio en un solo tablero de reportes.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
            Cruza asistencia, ingresos y altas nuevas para entender mejor el
            ritmo comercial y la actividad diaria.
          </p>
        </div>

        <div className="rounded-[28px] border border-amber-200/10 bg-white/[0.035] p-6 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
            Lectura rapida
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-zinc-400">Mejor tramo de asistencia</p>
              <p className="text-lg font-semibold text-zinc-100">
                {strongestAttendanceBucket}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.12),rgba(255,247,237,0.05),rgba(249,115,22,0.12))] p-4 text-sm text-amber-50">
              Usa esta vista para detectar picos de actividad, comparar ingresos y
              ver si las altas nuevas acompanian el movimiento del gimnasio.
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Asistencias"
          value={totalAttendance.toLocaleString("es-AR")}
          hint="Total del rango seleccionado"
          icon={Activity}
        />
        <StatCard
          title="Ingresos"
          value={nfARS.format(totalRevenue)}
          hint="Facturacion del rango"
          icon={CircleDollarSign}
        />
        <StatCard
          title="Clientes nuevos"
          value={totalNewClients.toLocaleString("es-AR")}
          hint="Altas registradas"
          icon={Users}
        />
        <StatCard
          title="Agrupacion"
          value={bucketLabels[bucket]}
          hint="Modo actual del analisis"
          icon={CalendarRange}
        />
      </section>

      <Card className="rounded-[28px] border-amber-200/10 bg-zinc-900/60 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <CardHeader className="border-b border-amber-200/10 pb-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle className="text-zinc-100">Generador de reportes</CardTitle>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Selecciona un rango y analiza asistencia, altas nuevas e ingresos.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="border-amber-200/10 bg-zinc-900/70"
              />
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="border-amber-200/10 bg-zinc-900/70"
              />
              <select
                className="rounded-md border border-amber-200/10 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-amber-400/25"
                value={bucket}
                onChange={(e) => setBucket(e.target.value as "day" | "week" | "month")}
              >
                <option value="day">Dia</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
              </select>
              <Button
                onClick={fetchReport}
                disabled={loading || !start || !end}
                className="border border-amber-300/25 bg-[linear-gradient(90deg,#facc15_0%,#fff7ed_48%,#f97316_100%)] font-medium text-black hover:opacity-95"
              >
                {loading ? "Generando..." : "Generar"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-[24px] border border-amber-200/10 bg-white/[0.03] p-5">
              <div className="mb-3 flex items-center gap-2 text-zinc-100">
                <BarChart3 className="h-4 w-4" />
                Asistencia
              </div>
              <div className="h-60">
                {attendanceChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendanceChartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                      <XAxis dataKey="label" stroke="#a1a1aa" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#a1a1aa" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111111",
                          border: "1px solid rgba(251,191,36,0.18)",
                          borderRadius: "0.75rem",
                          color: "#f4f4f5",
                        }}
                      />
                      <Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center text-sm text-zinc-500">
                    No hay datos de asistencia.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-amber-200/10 bg-white/[0.03] p-5">
              <div className="mb-3 flex items-center gap-2 text-zinc-100">
                <TrendingUp className="h-4 w-4" />
                Ingresos
              </div>
              <div className="h-60">
                {revenueChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueChartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fb923c" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                      <XAxis dataKey="label" stroke="#a1a1aa" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#a1a1aa" tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => nfARS.format(value)}
                        contentStyle={{
                          backgroundColor: "#111111",
                          border: "1px solid rgba(251,191,36,0.18)",
                          borderRadius: "0.75rem",
                          color: "#f4f4f5",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#fb923c"
                        strokeWidth={2}
                        fill="url(#reportRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center text-sm text-zinc-500">
                    No hay datos de ingresos.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-amber-200/10 bg-white/[0.03] p-5">
              <div className="mb-3 flex items-center gap-2 text-zinc-100">
                <Users className="h-4 w-4" />
                Altas nuevas
              </div>
              <div className="h-60">
                {clientsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clientsChartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                      <XAxis dataKey="label" stroke="#a1a1aa" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#a1a1aa" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111111",
                          border: "1px solid rgba(251,191,36,0.18)",
                          borderRadius: "0.75rem",
                          color: "#f4f4f5",
                        }}
                      />
                      <Bar dataKey="count" fill="#fde68a" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center text-sm text-zinc-500">
                    No hay datos de altas nuevas.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-amber-200/10">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[linear-gradient(90deg,rgba(250,204,21,0.08),rgba(255,247,237,0.04),rgba(249,115,22,0.1))] text-left text-zinc-300">
                  <tr>
                    <th className="px-4 py-3">Periodo</th>
                    <th className="px-4 py-3">Asistencias</th>
                    <th className="px-4 py-3">Clientes nuevos</th>
                    <th className="px-4 py-3">Ingresos</th>
                  </tr>
                </thead>
                <tbody className="bg-zinc-950/30">
                  {!loading && attendanceRows.length === 0 && revenueRows.length === 0 && newClientsRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-zinc-400">
                        Selecciona un rango y genera el reporte para ver datos.
                      </td>
                    </tr>
                  ) : null}

                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-zinc-400">
                        Generando reportes...
                      </td>
                    </tr>
                  ) : null}

                  {!loading
                    ? attendanceRows.map((row, index) => {
                        const matchingClients = clientsChartData.find(
                          (item) => item.bucket === row.bucket
                        );
                        const matchingRevenue = revenueRows.find(
                          (item) => item.bucket === row.bucket
                        );

                        return (
                          <tr
                            key={row.bucket}
                            className={`border-t border-white/5 ${index % 2 ? "bg-white/[0.03]" : ""} ${bucket === "day" ? "cursor-pointer hover:bg-white/[0.05]" : ""}`}
                            onClick={() => bucket === "day" && openDetail(row.bucket)}
                          >
                            <td className="px-4 py-3 text-zinc-100">
                              {toLabel(row.bucket, bucket)}
                            </td>
                            <td className="px-4 py-3 text-zinc-300">{row.count}</td>
                            <td className="px-4 py-3 text-zinc-300">
                              {matchingClients?.count ?? 0}
                            </td>
                            <td className="px-4 py-3 text-zinc-300">
                              {nfARS.format(matchingRevenue?.total ?? 0)}
                            </td>
                          </tr>
                        );
                      })
                    : null}
                </tbody>
              </table>
            </div>
          </div>

          {attendanceRows.length > 0 ? (
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => setChartOpen(true)}
                variant="outline"
                className="border-amber-200/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]"
              >
                Abrir graficos ampliados
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl border-amber-200/10 bg-zinc-900/95 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Detalle del dia</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {detailDay
                ? `Clientes que hicieron check-in el ${detailDay.slice(0, 10)}.`
                : "Selecciona un dia desde la tabla."}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-8 text-center text-zinc-400">Cargando detalle...</div>
          ) : detailRows.length === 0 ? (
            <div className="py-8 text-center text-zinc-400">
              No hubo asistencias registradas ese dia.
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-left text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Hora</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Contacto</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`border-t border-white/5 ${index % 2 ? "bg-white/[0.03]" : ""}`}
                    >
                      <td className="px-4 py-3 text-zinc-300">
                        {new Date(row.checkin_at).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-zinc-100">
                        {row.client.full_name}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {row.client.phone || row.client.email || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={chartOpen} onOpenChange={setChartOpen}>
        <DialogContent className="max-w-5xl border-amber-200/10 bg-zinc-900/95 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Graficos ampliados</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Comparativa visual de asistencia, ingresos y altas nuevas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
              <h3 className="mb-3 text-sm font-medium text-zinc-100">
                Tendencia de asistencia
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceChartData}>
                    <defs>
                      <linearGradient id="attendanceExpanded" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#facc15" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#facc15" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="label" stroke="#a1a1aa" />
                    <YAxis stroke="#a1a1aa" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111111",
                        border: "1px solid rgba(251,191,36,0.18)",
                        borderRadius: "0.75rem",
                        color: "#f4f4f5",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#facc15"
                      fill="url(#attendanceExpanded)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
              <h3 className="mb-3 text-sm font-medium text-zinc-100">
                Ingresos por periodo
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="label" stroke="#a1a1aa" />
                    <YAxis stroke="#a1a1aa" />
                    <Tooltip
                      formatter={(value: number) => nfARS.format(value)}
                      contentStyle={{
                        backgroundColor: "#111111",
                        border: "1px solid rgba(251,191,36,0.18)",
                        borderRadius: "0.75rem",
                        color: "#f4f4f5",
                      }}
                    />
                    <Bar dataKey="total" fill="#fb923c" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
