import { useEffect, useMemo, useState } from "react";
import { fetchClients } from "@/services/clients";
import type { Client } from "@/types";
import Pagination from "@/components/Pagination";
import { useDebounce } from "../hooks/useDebounce";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

function SkeletonRow() {
  return (
    <tr className="border-t border-white/5 animate-pulse">
      <td className="p-3">
        <div className="h-4 w-40 rounded bg-white/10" />
      </td>
      <td className="p-3">
        <div className="h-4 w-56 rounded bg-white/10" />
      </td>
      <td className="p-3">
        <div className="h-4 w-28 rounded bg-white/10" />
      </td>
      <td className="p-3">
        <div className="h-6 w-20 rounded bg-white/10" />
      </td>
      <td className="p-3">
        <div className="h-4 w-24 rounded bg-white/10" />
      </td>
    </tr>
  );
}

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-2 text-xs tracking-wide uppercase text-zinc-300/80">
        Sin resultados
      </div>
      <p className="max-w-md text-sm text-zinc-300/80">
        {query
          ? <>No encontramos clientes que coincidan con <span className="font-medium text-zinc-100">“{query}”</span>.</>
          : <>Aún no hay clientes cargados. Agregá tus primeros clientes para verlos acá.</>}
      </p>
    </div>
  );
}

export default function Clients() {
  const [items, setItems] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 400);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  // resetear offset cuando cambia búsqueda o page size
  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, limit]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { items, total } = await fetchClients({
          q: debouncedQ || undefined,
          limit,
          offset,
        });
        if (mounted) {
          setItems(items);
          setTotal(total);
        }
      } catch (e) {
        console.error(e);
      } finally {
        mounted && setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [debouncedQ, limit, offset]);

  const rows = useMemo(() => items, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-zinc-300/80">
            Gestioná tu base de clientes y su estado.
          </p>
        </div>
      </div>

      <Card className="p-4 sm:p-5 bg-zinc-900/60 border-white/10 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_-10px_rgba(0,0,0,0.6)] rounded-2xl">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Buscar por nombre, email o teléfono…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-md bg-zinc-950/60 border-white/10 focus-visible:ring-zinc-400/40"
          />

          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onChange={({ limit, offset }) => {
              setLimit(limit);
              setOffset(offset);
            }}
          />
        </div>

        {/* Tabla */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-950/70 backdrop-blur-xl">
              <tr className="text-left">
                <th className="p-3 font-medium text-zinc-300/80">Nombre</th>
                <th className="p-3 font-medium text-zinc-300/80">Email</th>
                <th className="p-3 font-medium text-zinc-300/80">Teléfono</th>
                <th className="p-3 font-medium text-zinc-300/80">Estado</th>
                <th className="p-3 font-medium text-zinc-300/80">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState query={debouncedQ} />
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((c) => (
                  <tr
                    key={c.id}
                    className="transition-colors hover:bg-white/5"
                  >
                    <td className="p-3">
                      <div className="font-medium">{c.full_name}</div>
                    </td>
                    <td className="p-3 text-zinc-300/90">
                      {c.email ?? "—"}
                    </td>
                    <td className="p-3 text-zinc-300/90">
                      {c.phone ?? "—"}
                    </td>
                    <td className="p-3">
                      {c.is_active ? (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-400/20">
                          Activo
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-white/15 text-zinc-300"
                        >
                          Inactivo
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-zinc-300/90">
                      {new Date(c.join_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Paginación inferior */}
        <div className="mt-4 flex justify-end">
          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onChange={({ limit, offset }) => {
              setLimit(limit);
              setOffset(offset);
            }}
          />
        </div>
      </Card>
    </div>
  );
}
