import { useEffect, useMemo, useState } from "react";
import { Search, UserCheck, Users, UserX } from "lucide-react";
import { fetchClients } from "@/services/clients";
import type { Client } from "@/types";
import Pagination from "@/components/Pagination";
import { useDebounce } from "../hooks/useDebounce";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-t border-white/5">
      <td className="p-4">
        <div className="h-4 w-40 rounded bg-white/10" />
      </td>
      <td className="p-4">
        <div className="h-4 w-56 rounded bg-white/10" />
      </td>
      <td className="p-4">
        <div className="h-4 w-28 rounded bg-white/10" />
      </td>
      <td className="p-4">
        <div className="h-6 w-20 rounded bg-white/10" />
      </td>
      <td className="p-4">
        <div className="h-4 w-24 rounded bg-white/10" />
      </td>
    </tr>
  );
}

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-3 rounded-2xl border border-amber-200/10 bg-zinc-900/60 px-4 py-2 text-xs uppercase tracking-wide text-zinc-300/80">
        Sin resultados
      </div>
      <p className="max-w-md text-sm leading-6 text-zinc-300/80">
        {query ? (
          <>
            No encontramos clientes que coincidan con{" "}
            <span className="font-medium text-zinc-100">"{query}"</span>.
          </>
        ) : (
          <>
            Aun no hay clientes cargados. Cuando agregues los primeros, los veras
            reflejados aqui.
          </>
        )}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-[24px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.08),rgba(255,255,255,0.02)_50%,rgba(249,115,22,0.09))] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{value}</p>
          <p className="mt-1 text-sm text-zinc-400">{hint}</p>
        </div>
        <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(250,204,21,0.2),rgba(255,247,237,0.08),rgba(249,115,22,0.22))] p-3">
          <Icon size={18} />
        </div>
      </div>
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
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [debouncedQ, limit, offset]);

  const rows = useMemo(() => items, [items]);
  const activeCount = rows.filter((client) => client.is_active).length;
  const inactiveCount = rows.length - activeCount;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="rounded-[28px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.1),rgba(255,247,237,0.03)_45%,rgba(249,115,22,0.11))] p-6 shadow-[0_20px_80px_-40px_rgba(249,115,22,0.42)]">
          <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-100">
            Clientes
          </div>
          <h1 className="warm-accent-text mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Revisa tu base de clientes con mas contexto y menos friccion.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
            Busca por nombre, email o telefono y detecta rapido el estado de cada
            cliente desde una vista mas clara.
          </p>
        </div>

        <div className="rounded-[28px] border border-amber-200/10 bg-white/[0.035] p-6 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
            Resumen actual
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-zinc-400">Busqueda activa</p>
              <p className="text-lg font-semibold text-zinc-100">
                {debouncedQ.trim() ? `"${debouncedQ.trim()}"` : "Sin filtro"}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.12),rgba(255,247,237,0.05),rgba(249,115,22,0.12))] p-4 text-sm text-amber-50">
              Mostrando una vista de {rows.length} cliente{rows.length === 1 ? "" : "s"} en esta pagina.
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total registrado"
          value={total.toLocaleString("es-AR")}
          hint="Clientes encontrados en la consulta actual"
          icon={Users}
        />
        <StatCard
          label="Activos en pagina"
          value={activeCount.toLocaleString("es-AR")}
          hint="Clientes habilitados para operar"
          icon={UserCheck}
        />
        <StatCard
          label="Inactivos en pagina"
          value={inactiveCount.toLocaleString("es-AR")}
          hint="Clientes que podrian requerir seguimiento"
          icon={UserX}
        />
      </section>

      <Card className="rounded-[28px] border-amber-200/10 bg-zinc-900/60 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-4 border-b border-amber-200/10 pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">
                Directorio de clientes
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Navega y filtra tu lista completa con una lectura mas comoda.
              </p>
            </div>
            <div className="w-full sm:max-w-md">
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-zinc-500">
                Buscar
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  placeholder="Nombre, email o telefono"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="border-amber-200/10 bg-zinc-950/60 pl-10 focus-visible:ring-amber-400/35"
                />
              </div>
            </div>
          </div>

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

        <div className="mt-5 overflow-x-auto rounded-2xl border border-amber-200/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-950/70 backdrop-blur-xl">
              <tr className="text-left">
                <th className="p-4 font-medium text-zinc-300/80">Cliente</th>
                <th className="p-4 font-medium text-zinc-300/80">Contacto</th>
                <th className="p-4 font-medium text-zinc-300/80">Telefono</th>
                <th className="p-4 font-medium text-zinc-300/80">Estado</th>
                <th className="p-4 font-medium text-zinc-300/80">Alta</th>
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
                rows.map((client) => (
                  <tr key={client.id} className="transition-colors hover:bg-white/[0.035]">
                    <td className="p-4">
                      <div className="font-medium text-zinc-100">
                        {client.full_name}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">{client.id}</div>
                    </td>
                    <td className="p-4 text-zinc-300/90">
                      {client.email ?? "-"}
                    </td>
                    <td className="p-4 text-zinc-300/90">
                      {client.phone ?? "-"}
                    </td>
                    <td className="p-4">
                      {client.is_active ? (
                        <Badge className="border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.14),rgba(255,247,237,0.05),rgba(249,115,22,0.14))] text-amber-50">
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
                    <td className="p-4 text-zinc-300/90">
                      {new Date(client.join_date).toLocaleDateString("es-AR")}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex justify-end">
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
