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
    <Card className="overflow-hidden rounded-[24px] border border-amber-200/10 bg-[linear-gradient(180deg,rgba(17,17,17,0.94),rgba(15,12,10,0.98))] p-0 shadow-[0_18px_60px_-40px_rgba(249,115,22,0.45)]">
      <div className="border-b border-amber-200/10 bg-[linear-gradient(90deg,rgba(250,204,21,0.1),rgba(255,247,237,0.04),rgba(249,115,22,0.12))] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-amber-100">
              <CalendarDays className="h-3.5 w-3.5" />
              Asistencia reciente
            </div>
            <p className="mt-3 text-sm font-medium text-zinc-100">
              Últimos {monthsBack} meses
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              Los días marcados muestran cuándo el cliente registró check-in.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Total
            </p>
            <p className="mt-1 text-lg font-semibold text-zinc-50">{attendanceCount}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(180deg,#facc15,#f97316)]" />
            Día con asistencia
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            Vista de seguimiento
          </span>
        </div>

        <Calendar
          mode="multiple"
          selected={dates}
          disabled
          className="mx-auto w-full max-w-xs rounded-[24px] border border-white/10 bg-zinc-900/80 p-3 text-zinc-100"
          classNames={{
            month_caption: "flex items-center justify-center px-10 text-sm font-semibold text-zinc-100",
            weekday: "flex-1 rounded-md text-[0.78rem] font-medium uppercase tracking-[0.18em] text-zinc-500",
            day: "relative w-full h-full p-0 text-center aspect-square select-none",
            today:
              "rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-100",
            disabled: "opacity-100",
          }}
          modifiers={{ attended: dates }}
          modifiersClassNames={{
            attended:
              "rounded-xl bg-[linear-gradient(180deg,#facc15,#f97316)] text-black font-semibold shadow-[0_10px_25px_-14px_rgba(249,115,22,0.9)] hover:bg-[linear-gradient(180deg,#facc15,#f97316)] focus:bg-[linear-gradient(180deg,#facc15,#f97316)]",
          }}
        />

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
            Cargando asistencias...
          </div>
        ) : null}

        {!loading && err ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {err}
          </div>
        ) : null}

        {!loading && !err && attendanceCount === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
            Sin asistencias en el período.
          </div>
        ) : null}

        {!loading && !err && attendanceCount > 0 ? (
          <div className="rounded-2xl border border-amber-300/15 bg-[linear-gradient(90deg,rgba(250,204,21,0.08),rgba(255,247,237,0.03),rgba(249,115,22,0.08))] px-3 py-2 text-xs text-zinc-300">
            <span className="inline-flex items-center gap-2 font-medium text-amber-100">
              <Flame className="h-3.5 w-3.5" />
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
