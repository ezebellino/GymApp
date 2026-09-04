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

const outlineButtonClass =
  "border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70";

function parseBucket(bucket: string) {
  const direct = new Date(bucket);
  if (!Number.isNaN(direct.getTime())) return direct;

  const fallback = new Date(bucket.includes("T") ? bucket : `${bucket}T00:00:00`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function toLabel(bucket: string, mode: "day" | "week" | "month") {
  const date = parseBucket(bucket);
  if (!date) return bucket;

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
    <div className="rounded-xl border border-border bg-surface-1 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-label-caps uppercase text-muted-foreground">
            {title}
          </p>
          <p className="font-display mt-2 text-metric-kpi font-extrabold tabular-nums text-foreground">
            {value}
          </p>
          <p className="mt-1 text-body-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-strong">
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
      console.error("Error cargando detalle del día", error);
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
        <div className="hero-aura rounded-xl border border-border p-6">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            Analitica del negocio
          </div>
          <h1 className="warm-accent-text font-display mt-4 text-3xl font-extrabold md:text-headline-hero">
            Leé la operación del gimnasio en un solo tablero de reportes.
          </h1>
          <p className="mt-3 max-w-2xl text-body-md text-muted-foreground md:text-body-lg">
            Cruza asistencia, ingresos y altas nuevas para entender mejor el
            ritmo comercial y la actividad diaria.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-1/60 p-6">
          <p className="text-label-caps uppercase text-muted-foreground">
            Lectura rapida
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Mejor tramo de asistencia</p>
              <p className="text-lg font-semibold text-foreground">
                {strongestAttendanceBucket}
              </p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-foreground">
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

      <Card className="rounded-xl border-border bg-surface-1">
        <CardHeader className="border-b border-border pb-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle className="text-foreground">Generador de reportes</CardTitle>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Selecciona un rango y analiza asistencia, altas nuevas e ingresos.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="border-border bg-surface-2/40"
              />
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="border-border bg-surface-2/40"
              />
              <select
                className="rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
              >
                {loading ? "Generando..." : "Generar"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface-2/20 p-5">
              <div className="mb-3 flex items-center gap-2 text-foreground">
                <BarChart3 className="h-4 w-4" />
                Asistencia
              </div>
              <div className="h-60">
                {attendanceChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendanceChartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />
                      <XAxis dataKey="label" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                      <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--surface-1)",
                          border: "1px solid var(--border-hairline)",
                          borderRadius: "0.75rem",
                          color: "var(--foreground)",
                        }}
                      />
                      <Bar dataKey="count" fill="var(--primary)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center text-sm text-muted-foreground">
                    No hay datos de asistencia.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-2/20 p-5">
              <div className="mb-3 flex items-center gap-2 text-foreground">
                <TrendingUp className="h-4 w-4" />
                Ingresos
              </div>
              <div className="h-60">
                {revenueChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueChartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="reportRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary-strong)" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="var(--primary-strong)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />
                      <XAxis dataKey="label" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                      <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => nfARS.format(value)}
                        contentStyle={{
                          backgroundColor: "var(--surface-1)",
                          border: "1px solid var(--border-hairline)",
                          borderRadius: "0.75rem",
                          color: "var(--foreground)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="var(--primary-strong)"
                        strokeWidth={2}
                        fill="url(#reportRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center text-sm text-muted-foreground">
                    No hay datos de ingresos.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface-2/20 p-5">
              <div className="mb-3 flex items-center gap-2 text-foreground">
                <Users className="h-4 w-4" />
                Altas nuevas
              </div>
              <div className="h-60">
                {clientsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clientsChartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />
                      <XAxis dataKey="label" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                      <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--surface-1)",
                          border: "1px solid var(--border-hairline)",
                          borderRadius: "0.75rem",
                          color: "var(--foreground)",
                        }}
                      />
                      <Bar dataKey="count" fill="var(--primary)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center text-sm text-muted-foreground">
                    No hay datos de altas nuevas.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-label-caps uppercase text-muted-foreground">
                  <tr>
                    <th className="border-b border-border px-4 py-3">Periodo</th>
                    <th className="border-b border-border px-4 py-3">Asistencias</th>
                    <th className="border-b border-border px-4 py-3">Clientes nuevos</th>
                    <th className="border-b border-border px-4 py-3">Ingresos</th>
                  </tr>
                </thead>
                <tbody className="bg-canvas/30">
                  {!loading && attendanceRows.length === 0 && revenueRows.length === 0 && newClientsRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                        Selecciona un rango y genera el reporte para ver datos.
                      </td>
                    </tr>
                  ) : null}

                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
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
                            className={`border-t border-border ${index % 2 ? "bg-surface-2/30" : ""} ${bucket === "day" ? "cursor-pointer hover:bg-surface-2/40" : ""}`}
                            onClick={() => bucket === "day" && openDetail(row.bucket)}
                          >
                            <td className="px-4 py-3 text-foreground">
                              {toLabel(row.bucket, bucket)}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{row.count}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {matchingClients?.count ?? 0}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
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
                className={outlineButtonClass}
              >
                Abrir graficos ampliados
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl border-border bg-surface-1/95 text-foreground">
          <DialogHeader>
            <DialogTitle>Detalle del día</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {detailDay
                ? `Clientes que hicieron check-in el ${detailDay.slice(0, 10)}.`
                : "Seleccioná un día desde la tabla."}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-8 text-center text-muted-foreground">Cargando detalle...</div>
          ) : detailRows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No hubo asistencias registradas ese día.
            </div>
          ) : (
            <div className="warm-scrollbar max-h-[420px] overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="text-left text-label-caps uppercase text-muted-foreground">
                  <tr>
                    <th className="border-b border-border px-4 py-3">Hora</th>
                    <th className="border-b border-border px-4 py-3">Cliente</th>
                    <th className="border-b border-border px-4 py-3">Contacto</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`border-t border-border ${index % 2 ? "bg-surface-2/30" : ""}`}
                    >
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(row.checkin_at).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {row.client.full_name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
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
        <DialogContent className="max-w-5xl border-border bg-surface-1/95 text-foreground">
          <DialogHeader>
            <DialogTitle>Graficos ampliados</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Comparativa visual de asistencia, ingresos y altas nuevas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-canvas/60 p-4">
              <h3 className="mb-3 text-sm font-medium text-foreground">
                Tendencia de asistencia
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceChartData}>
                    <defs>
                      <linearGradient id="attendanceExpanded" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--surface-1)",
                        border: "1px solid var(--border-hairline)",
                        borderRadius: "0.75rem",
                        color: "var(--foreground)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--primary)"
                      fill="url(#attendanceExpanded)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-canvas/60 p-4">
              <h3 className="mb-3 text-sm font-medium text-foreground">
                Ingresos por período
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-hairline)" />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
                    <Tooltip
                      formatter={(value: number) => nfARS.format(value)}
                      contentStyle={{
                        backgroundColor: "var(--surface-1)",
                        border: "1px solid var(--border-hairline)",
                        borderRadius: "0.75rem",
                        color: "var(--foreground)",
                      }}
                    />
                    <Bar dataKey="total" fill="var(--primary-strong)" radius={[8, 8, 0, 0]} />
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
