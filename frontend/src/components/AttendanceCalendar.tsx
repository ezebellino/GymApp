// src/components/AttendanceCalendar.tsx
import { useEffect, useMemo, useState } from "react";
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
          params: { client_id: clientId, limit: 1000, offset: 0 },
        });
        if (!mounted) return;
        const ds = data
          .map((r) => new Date(r.checkin_at))
          .filter((d) => d >= range.start && d <= range.end);
        setDates(ds);
      } catch (e) {
        console.error(e);
        if (mounted) setErr("No se pudo cargar asistencias.");
      } finally {
        mounted && setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [clientId, range.start, range.end]);

  return (
    <Card className="border-white/10 bg-zinc-950/60 p-3">
      <div className="text-sm mb-2 text-zinc-300">Asistencias (últimos {monthsBack} meses)</div>

      <Calendar
        mode="multiple"
        selected={dates}
        disabled
        className="rounded-md border border-white/10 bg-zinc-900/70 text-zinc-100"
      />

      {loading && (
        <div className="mt-2 text-xs text-zinc-400 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
          Cargando…
        </div>
      )}
      {!loading && err && <div className="mt-2 text-xs text-red-400">{err}</div>}
      {!loading && !err && dates.length === 0 && (
        <div className="mt-2 text-xs text-zinc-400">Sin asistencias en el período.</div>
      )}
    </Card>
  );
}
