import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/http";
import { useDebounce } from "@/hooks/useDebounce"; // si no lo tenés aquí, importá desde donde lo tengas

type ClientLite = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
};

type AttendanceRow = {
  id: string;
  client_id: string;
  coach_id: string | null;
  checkin_at: string; // ISO
  client?: ClientLite; // viene en AttendanceOut (schemas) -> ClientOut
};

function shortId(id?: string) {
  if (!id) return "—";
  return id.length > 10 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

export default function AttendancePage() {
  const [items, setItems] = useState<AttendanceRow[]>([]);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 350);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // GET /attendance?q=&limit=&offset=
      const { data } = await api.get<AttendanceRow[]>("/attendance", {
        params: { q: debouncedQ || undefined, limit, offset },
      });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  // Reiniciá al cambiar búsqueda
  useEffect(() => {
    setOffset(0);
  }, [debouncedQ]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, debouncedQ]);

  const rows = useMemo(() => items, [items]);

  // Heurística simple de paginado si tu endpoint no devuelve total:
  const hasMore = rows.length >= limit;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Asistencias</h1>

      <Card className="border-white/10 bg-zinc-950/60 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-zinc-100">Listado de check-ins</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex gap-2 w-full sm:max-w-xl">
              <Input
                placeholder="Buscar por nombre, email o teléfono…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="bg-zinc-900/70 border-white/10"
              />
              <Button
                onClick={() => load()}
                disabled={loading}
                className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30"
                variant="outline"
              >
                {loading ? "Buscando…" : "Buscar"}
              </Button>
            </div>

            {/* Paginación */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="border-white/10 hover:bg-white/10"
              >
                ← Anterior
              </Button>
              <Button
                variant="outline"
                disabled={!hasMore || loading}
                onClick={() => setOffset(offset + limit)}
                className="border-white/10 hover:bg-white/10"
              >
                Siguiente →
              </Button>
            </div>
          </div>

          {/* Tabla */}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/70">
                <tr className="text-zinc-300">
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Contacto</th>
                  <th className="text-left p-3">Coach</th>
                </tr>
              </thead>
              <tbody className="bg-zinc-950/40">
                {loading && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center">
                      <div className="inline-flex items-center gap-2 text-zinc-400">
                        <span className="h-4 w-4 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
                        Cargando…
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td className="p-6 text-center text-zinc-400" colSpan={4}>
                      Sin resultados.
                    </td>
                  </tr>
                )}

                {!loading &&
                  rows.map((a) => (
                    <tr key={a.id} className="border-t border-white/5">
                      <td className="p-3 text-zinc-200">
                        {new Date(a.checkin_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-zinc-200">
                        {a.client?.full_name ?? shortId(a.client_id)}
                      </td>
                      <td className="p-3 text-zinc-300">
                        {a.client?.phone || a.client?.email || "—"}
                      </td>
                      <td className="p-3 text-zinc-300">
                        {a.coach_id ? shortId(a.coach_id) : <span className="text-zinc-500">—</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Footer paginación */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="border-white/10 hover:bg-white/10"
            >
              ← Anterior
            </Button>
            <Button
              variant="outline"
              disabled={!hasMore || loading}
              onClick={() => setOffset(offset + limit)}
              className="border-white/10 hover:bg-white/10"
            >
              Siguiente →
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
