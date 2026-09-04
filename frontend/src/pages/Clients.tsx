import { useEffect, useState } from "react";
import { MessageCircle, PencilLine, Search, UserCheck, Users, UserX } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useClientsQuery } from "@/services/clients.queries";
import { queryKeys } from "@/services/queryKeys";
import type { Client } from "@/types";
import Pagination from "@/components/Pagination";
import EditClientDialog from "@/components/EditClientDialog";
import DataError from "@/components/DataError";
import { useDebounce } from "../hooks/useDebounce";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-t border-border">
      <td className="p-4">
        <div className="h-4 w-40 rounded bg-surface-2/40" />
      </td>
      <td className="p-4">
        <div className="h-4 w-56 rounded bg-surface-2/40" />
      </td>
      <td className="p-4">
        <div className="h-4 w-28 rounded bg-surface-2/40" />
      </td>
      <td className="p-4">
        <div className="h-6 w-20 rounded bg-surface-2/40" />
      </td>
      <td className="p-4">
        <div className="h-4 w-24 rounded bg-surface-2/40" />
      </td>
      <td className="p-4">
        <div className="h-9 w-40 rounded bg-surface-2/40" />
      </td>
    </tr>
  );
}

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-3 rounded-full border border-border bg-surface-2/30 px-4 py-2 text-label-caps uppercase text-muted-foreground">
        Sin resultados
      </div>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        {query ? (
          <>
            No encontramos clientes que coincidan con{" "}
            <span className="font-medium text-foreground">"{query}"</span>.
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
    <div className="rounded-xl border border-border bg-surface-1 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-label-caps uppercase text-muted-foreground">
            {label}
          </p>
          <p className="font-display mt-2 text-metric-kpi font-extrabold tabular-nums text-foreground">{value}</p>
          <p className="mt-1 text-body-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function Clients() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 400);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const queryClient = useQueryClient();

  function openPaymentReminder(client: Client) {
    if (!client.phone) return;
    const digits = client.phone.replace(/\D/g, "");
    const normalizedPhone = digits.startsWith("54") ? digits : `54${digits}`;
    if (!normalizedPhone) return;

    const message = encodeURIComponent(
      `Hola ${client.full_name}, te escribimos desde Mini Espacio para recordarte el pago pendiente del mes. Si ya abonaste, podes ignorar este mensaje. Gracias.`
    );
    window.open(`https://wa.me/${normalizedPhone}?text=${message}`, "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, limit]);

  const { data, isPending, isFetching, isPlaceholderData, isError, refetch } = useClientsQuery({
    q: debouncedQ || undefined,
    limit,
    offset,
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const activeCount = rows.filter((client) => client.is_active).length;
  const inactiveCount = rows.length - activeCount;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="hero-aura rounded-xl border border-border p-6">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary">
            Clientes
          </div>
          <h1 className="warm-accent-text font-display mt-4 text-3xl font-extrabold md:text-headline-hero">
            Revisa tu base de clientes con mas contexto y menos friccion.
          </h1>
          <p className="mt-3 max-w-2xl text-body-md text-muted-foreground md:text-body-lg">
            Buscá por nombre, email o teléfono y detectá rápido el estado de cada
            cliente desde una vista mas clara.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-1/60 p-6 backdrop-blur-xl">
          <p className="text-label-caps uppercase text-muted-foreground">
            Resumen actual
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Busqueda activa</p>
              <p className="text-lg font-semibold text-foreground">
                {debouncedQ.trim() ? `"${debouncedQ.trim()}"` : "Sin filtro"}
              </p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-foreground">
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

      <Card className="rounded-xl border-border bg-surface-1 p-4 backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Directorio de clientes
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Navega y filtra tu lista completa con una lectura mas comoda.
              </p>
            </div>
            <div className="w-full sm:max-w-md">
              <label className="mb-2 block text-label-caps uppercase text-muted-foreground">
                Buscar
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nombre, email o teléfono"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="border-border bg-surface-2/40 pl-10 focus-visible:ring-ring"
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

        <div
          className={cn(
            "mt-5 overflow-x-auto rounded-xl border border-border",
            isFetching && isPlaceholderData && "opacity-60 transition-opacity"
          )}
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-canvas/70 backdrop-blur-xl">
              <tr className="text-left">
                <th className="p-4 text-label-caps uppercase text-muted-foreground">Cliente</th>
                <th className="p-4 text-label-caps uppercase text-muted-foreground">Contacto</th>
                <th className="p-4 text-label-caps uppercase text-muted-foreground">Telefono</th>
                <th className="p-4 text-label-caps uppercase text-muted-foreground">Estado</th>
                <th className="p-4 text-label-caps uppercase text-muted-foreground">Alta</th>
                <th className="p-4 text-label-caps uppercase text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isPending && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!isPending && isError && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <DataError
                      title="No se pudieron cargar los clientes"
                      description="Intenta nuevamente en unos segundos."
                      onRetry={() => refetch()}
                    />
                  </td>
                </tr>
              )}

              {!isPending && !isError && rows.length === 0 && (
                <tr>
                    <td colSpan={6} className="p-0">
                      <EmptyState query={debouncedQ} />
                    </td>
                  </tr>
              )}

              {!isPending && !isError &&
                rows.map((client) => (
                  <tr key={client.id} className="transition-colors hover:bg-surface-2/30">
                    <td className="p-4">
                      <div className="font-medium text-foreground">
                        {client.full_name}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{client.id}</div>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {client.email ?? "-"}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {client.phone ?? "-"}
                    </td>
                    <td className="p-4">
                      {client.is_active ? (
                        <Badge className="border-primary/30 bg-primary/10 text-primary">
                          Activo
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-border bg-surface-2/30 text-muted-foreground"
                        >
                          Inactivo
                        </Badge>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(client.join_date).toLocaleDateString("es-AR")}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClient(client);
                            setEditClientOpen(true);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2/30 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-surface-2/60"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => openPaymentReminder(client)}
                          disabled={!client.phone}
                          className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </button>
                      </div>
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

      {selectedClient ? (
        <EditClientDialog
          open={editClientOpen}
          onOpenChange={setEditClientOpen}
          client={selectedClient}
          onSuccess={() => {
            // Editar un cliente invalida tambien payments/attendance: sus
            // filas embeben `client`, asi que un cambio de nombre las deja
            // mintiendo si no se invalidan (dec. 6).
            queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          }}
        />
      ) : null}
    </div>
  );
}
