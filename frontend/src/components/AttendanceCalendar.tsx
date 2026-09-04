import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Flame, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import api from "@/lib/http";

type Props = { clientId: string; monthsBack?: number };
type AttendanceRow = { id: string; checkin_at: string };

export default function AttendanceCalendar({ clientId, monthsBack = 3 }: Props) {
  const [dates, setDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const range = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - monthsBack);
    return { start, end };
  }, [monthsBack]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data } = await api.get<AttendanceRow[]>("/attendance", {
          params: { client_id: clientId, limit: 200, offset: 0 },
        });
        if (!mounted) return;

        const nextDates = data
          .map((row) => new Date(row.checkin_at))
          .filter((date) => date >= range.start && date <= range.end);

        setDates(nextDates);
      } catch (error) {
        console.error(error);
        if (mounted) setErr("No se pudieron cargar las asistencias.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [clientId, range.end, range.start]);

  const attendanceCount = dates.length;

  return (
    <Card className="overflow-hidden rounded-xl border border-border bg-surface-1 p-0">
      <div className="border-b border-border bg-surface-2/40 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary">
              <CalendarDays className="h-3.5 w-3.5" />
              Asistencia reciente
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              Últimos {monthsBack} meses
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Los días marcados muestran cuándo el cliente registró check-in.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface-2/20 px-3 py-2 text-right">
            <p className="text-label-caps uppercase text-muted-foreground">
              Total
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">{attendanceCount}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/20 px-3 py-1">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            Día con asistencia
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/20 px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Vista de seguimiento
          </span>
        </div>

        <Calendar
          mode="multiple"
          selected={dates}
          disabled
          className="mx-auto w-full max-w-xs rounded-xl border border-border bg-surface-1 p-3 text-foreground"
          classNames={{
            month_caption: "flex items-center justify-center px-10 text-sm font-semibold text-foreground",
            weekday: "flex-1 rounded-md text-[0.78rem] font-medium uppercase tracking-[0.18em] text-muted-foreground",
            day: "relative w-full h-full p-0 text-center aspect-square select-none",
            today:
              "rounded-lg border border-primary/30 bg-primary/10 text-primary",
            disabled: "opacity-100",
          }}
          modifiers={{ attended: dates }}
          modifiersClassNames={{
            attended:
              "rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary focus:bg-primary",
          }}
        />

        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/20 px-3 py-2 text-xs text-muted-foreground">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            Cargando asistencias...
          </div>
        ) : null}

        {!loading && err ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {err}
          </div>
        ) : null}

        {!loading && !err && attendanceCount === 0 ? (
          <div className="rounded-xl border border-border bg-surface-2/20 px-3 py-2 text-xs text-muted-foreground">
            Sin asistencias en el período.
          </div>
        ) : null}

        {!loading && !err && attendanceCount > 0 ? (
          <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2 font-medium text-foreground">
              <Flame className="h-3.5 w-3.5 text-primary" />
              Historial con actividad
            </span>
            <span className="ml-2">
              El cliente registró {attendanceCount} asistencia{attendanceCount === 1 ? "" : "s"} en este rango.
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
