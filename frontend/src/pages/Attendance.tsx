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

const outlineButtonClass =
  "border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70";

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
    <div className="rounded-xl border border-border bg-surface-1 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-label-caps uppercase text-muted-foreground">
            {title}
          </p>
          <p className="font-display mt-2 text-metric-kpi font-extrabold tabular-nums text-foreground">{value}</p>
          <p className="mt-1 text-body-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="rounded-full bg-primary/15 p-3 text-primary">
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
        <div className="hero-aura rounded-xl border border-border p-6">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary">
            Operación diaria
          </div>
          <h1 className="warm-accent-text font-display mt-4 text-3xl font-extrabold md:text-headline-hero">
            Controla la asistencia del gimnasio con una vista mas clara.
          </h1>
          <p className="mt-3 max-w-2xl text-body-md text-muted-foreground md:text-body-lg">
            Busca check-ins por cliente, revisa el movimiento reciente y detecta
            rapidamente como viene la jornada.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-1/60 p-6 backdrop-blur-xl">
          <p className="text-label-caps uppercase text-muted-foreground">
            Contexto rápido
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Ultimo check-in visible</p>
              <p className="text-lg font-semibold text-foreground">{latestCheckin}</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-foreground">
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

      <Card className="rounded-xl border-border bg-surface-1 backdrop-blur-xl">
        <CardHeader className="border-b border-border pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-foreground">Listado de check-ins</CardTitle>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Consultá ingresos por nombre, email o teléfono y revisá rápido
                quien entreno hoy.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <div className="relative w-full sm:min-w-[320px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, email o teléfono"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="border-border bg-surface-2/40 pl-9 text-foreground"
                />
              </div>
              <Button
                onClick={() => refetch()}
                disabled={isFetching}
                variant="outline"
                className={outlineButtonClass}
              >
                {isFetching ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-6">
          <div
            className={cn(
              "overflow-hidden rounded-xl border border-border",
              isFetching && isPlaceholderData && "opacity-60 transition-opacity"
            )}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-2/40 text-left text-label-caps uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Contacto</th>
                    <th className="px-4 py-3">Coach</th>
                  </tr>
                </thead>
                <tbody className="bg-canvas/30">
                  {isPending ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
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
                      <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                        No hay asistencias para el filtro actual.
                      </td>
                    </tr>
                  ) : null}

                  {!isPending && !isError
                    ? items.map((item, index) => (
                        <tr
                          key={item.id}
                          className={`border-t border-border ${index % 2 ? "bg-surface-2/30" : ""}`}
                        >
                          <td className="px-4 py-3 text-foreground">
                            {new Date(item.checkin_at).toLocaleString("es-AR")}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {item.client?.full_name ?? shortId(item.client_id)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {item.client?.phone || item.client?.email || "-"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
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
