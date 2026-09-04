import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Clock3,
  Search,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import Pagination from "@/components/Pagination";
import DataError from "@/components/DataError";
import { useAttendanceQuery } from "@/services/attendance.queries";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string;
  hint: string;
  icon: typeof Users;
};

function shortId(id?: string | null) {
  if (!id) return "-";
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
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

export default function AttendancePage() {
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 350);

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, limit]);

  const { data, isPending, isFetching, isPlaceholderData, isError, refetch } = useAttendanceQuery({
    q: debouncedQ || undefined,
    limit,
    offset,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const today = useMemo(() => {
    const now = new Date();
    const start = startOfDay(now);
    const end = endOfDay(now);
    return items.filter((item) => {
      const checkin = new Date(item.checkin_at);
      return checkin >= start && checkin < end;
    }).length;
  }, [items]);

  const uniqueClients = useMemo(() => {
    const ids = new Set(items.map((item) => item.client_id));
    return ids.size;
  }, [items]);

  const latestCheckin = useMemo(() => {
    if (items.length === 0) return "Sin movimientos recientes";
    return new Date(items[0].checkin_at).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [items]);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="rounded-[28px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.1),rgba(255,247,237,0.03)_45%,rgba(249,115,22,0.11))] p-6 shadow-[0_20px_80px_-40px_rgba(249,115,22,0.42)]">
          <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-100">
            Operación diaria
          </div>
          <h1 className="warm-accent-text mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Controla la asistencia del gimnasio con una vista mas clara.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
            Busca check-ins por cliente, revisa el movimiento reciente y detecta
            rapidamente como viene la jornada.
          </p>
        </div>

        <div className="rounded-[28px] border border-amber-200/10 bg-white/[0.035] p-6 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
            Contexto rápido
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-zinc-400">Ultimo check-in visible</p>
              <p className="text-lg font-semibold text-zinc-100">{latestCheckin}</p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.12),rgba(255,247,237,0.05),rgba(249,115,22,0.12))] p-4 text-sm text-amber-50">
              Esta vista te ayuda a validar ingresos, detectar picos de actividad y
              buscar rápido a quien ya asistió.
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Check-ins visibles"
          value={total.toLocaleString("es-AR")}
          hint="Total segun el filtro actual"
          icon={Activity}
        />
        <StatCard
          title="Registrados hoy"
          value={today.toLocaleString("es-AR")}
          hint="Dentro de la pagina actual"
          icon={CalendarDays}
        />
        <StatCard
          title="Clientes unicos"
          value={uniqueClients.toLocaleString("es-AR")}
          hint="Sin repetir clientes visibles"
          icon={Users}
        />
        <StatCard
          title="Estado"
          value={isFetching ? "Actualizando" : "Al día"}
          hint="Consulta de asistencias"
          icon={UserRoundCheck}
        />
      </section>

      <Card className="rounded-[28px] border-amber-200/10 bg-zinc-900/60 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <CardHeader className="border-b border-amber-200/10 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-zinc-100">Listado de check-ins</CardTitle>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Consultá ingresos por nombre, email o teléfono y revisá rápido
                quien entreno hoy.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <div className="relative w-full sm:min-w-[320px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  placeholder="Buscar por nombre, email o teléfono"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="border-amber-200/10 bg-zinc-900/70 pl-9 text-zinc-100"
                />
              </div>
              <Button
                onClick={() => refetch()}
                disabled={isFetching}
                variant="outline"
                className="border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.14),rgba(255,247,237,0.05),rgba(249,115,22,0.14))] text-amber-50 hover:opacity-95"
              >
                {isFetching ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-6">
          <div
            className={cn(
              "overflow-hidden rounded-2xl border border-amber-200/10",
              isFetching && isPlaceholderData && "opacity-60 transition-opacity"
            )}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[linear-gradient(90deg,rgba(250,204,21,0.08),rgba(255,247,237,0.04),rgba(249,115,22,0.1))] text-left text-zinc-300">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Contacto</th>
                    <th className="px-4 py-3">Coach</th>
                  </tr>
                </thead>
                <tbody className="bg-zinc-950/30">
                  {isPending ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-zinc-400">
                        <div className="inline-flex items-center gap-2">
                          <Clock3 className="h-4 w-4" />
                          Cargando asistencias...
                        </div>
                      </td>
                    </tr>
                  ) : null}

                  {!isPending && isError ? (
                    <tr>
                      <td colSpan={4} className="p-0">
                        <DataError
                          title="No se pudieron cargar las asistencias"
                          description="Intenta nuevamente en unos segundos."
                          onRetry={() => refetch()}
                        />
                      </td>
                    </tr>
                  ) : null}

                  {!isPending && !isError && items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-zinc-400">
                        No hay asistencias para el filtro actual.
                      </td>
                    </tr>
                  ) : null}

                  {!isPending && !isError
                    ? items.map((item, index) => (
                        <tr
                          key={item.id}
                          className={`border-t border-white/5 ${index % 2 ? "bg-white/[0.03]" : ""}`}
                        >
                          <td className="px-4 py-3 text-zinc-200">
                            {new Date(item.checkin_at).toLocaleString("es-AR")}
                          </td>
                          <td className="px-4 py-3 text-zinc-100">
                            {item.client?.full_name ?? shortId(item.client_id)}
                          </td>
                          <td className="px-4 py-3 text-zinc-300">
                            {item.client?.phone || item.client?.email || "-"}
                          </td>
                          <td className="px-4 py-3 text-zinc-300">
                            {item.coach_id ? shortId(item.coach_id) : "-"}
                          </td>
                        </tr>
                      ))
                    : null}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onChange={({ limit: nextLimit, offset: nextOffset }) => {
              setLimit(nextLimit);
              setOffset(nextOffset);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
