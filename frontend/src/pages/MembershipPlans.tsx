import { Fragment, useEffect, useState } from "react";
import { BadgeDollarSign, Ban, CircleDollarSign, PencilLine, RotateCcw, Search } from "lucide-react";
import {
  useDeactivateMembershipPlanMutation,
  useActivateMembershipPlanMutation,
  useMembershipPlansQuery,
} from "@/services/membershipPlans.queries";
import { useDebounce } from "@/hooks/useDebounce";
import { useSettingsStore } from "@/stores/settings";
import type { MembershipPlan } from "@/types";
import ListPageLayout from "@/components/ListPageLayout";
import Pagination from "@/components/Pagination";
import DataError from "@/components/DataError";
import RowActionButton from "@/components/RowActionButton";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import CreateMembershipPlanDialog from "@/components/CreateMembershipPlanDialog";
import EditMembershipPlanDialog from "@/components/EditMembershipPlanDialog";
import NewPlanPriceDialog from "@/components/NewPlanPriceDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn, formatDate } from "@/lib/utils";

type StatusFilter = "active" | "inactive" | "all";

// Header sticky, mismo patrón que `Users.tsx`/`Routines.tsx` (dec. 7 del
// design de `redesign-list-page-layout`).
const STICKY_HEAD_CLASS =
  "sticky top-0 z-10 bg-table-head px-4 font-bold text-label-caps uppercase text-muted-foreground shadow-[inset_0_-1px_0_var(--border-hairline)]";

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("es-AR")}`;
}

function SkeletonRow() {
  return (
    <TableRow className="animate-pulse">
      <TableCell className="px-4 py-2">
        <div className="h-4 w-40 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-24 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-24 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-16 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-16 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-8 w-32 rounded bg-surface-2/40" />
      </TableCell>
    </TableRow>
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
            No encontramos planes que coincidan con{" "}
            <span className="font-medium text-foreground">"{query}"</span>.
          </>
        ) : (
          <>
            Todavía no creaste ningún plan de membresía. Creá el primero para poder
            asignarlo a tus miembros.
          </>
        )}
      </p>
    </div>
  );
}

type DialogAction =
  | null
  | { type: "edit"; plan: MembershipPlan }
  | { type: "new-price"; plan: MembershipPlan }
  | { type: "deactivate"; plan: MembershipPlan }
  | { type: "activate"; plan: MembershipPlan };

export default function MembershipPlans() {
  const currency = useSettingsStore((s) => s.settings.currency);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 400);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [action, setAction] = useState<DialogAction>(null);

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, statusFilter, limit]);

  const isActiveParam =
    statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined;

  const { data, isPending, isFetching, isPlaceholderData, isError, refetch } =
    useMembershipPlansQuery({
      q: debouncedQ || undefined,
      is_active: isActiveParam,
      limit,
      offset,
    });

  // Cuántos planes activos hay en total (independiente de filtro/página): la
  // regla "no se puede desactivar el último plan activo" (I3) es global, no
  // de la página actual — se deshabilita la acción antes de que el backend
  // tenga que rechazarla con 409.
  // `limit: 200` (no 1, hallazgo 9 de verification.md): con `limit: 1`, si
  // faltara el header `X-Total-Count`, el fallback de `readTotalCount`
  // (`data.length`) queda pegado en 1 para siempre — deshabilitando
  // "Desactivar" en todas las filas activas, incluso con varios planes
  // activos. 200 alcanza para cualquier gimnasio real y el fallback coincide
  // con el conteo real salvo que existan más de 200 planes activos.
  const { data: activeCountData, isPending: activeCountPending } = useMembershipPlansQuery({
    is_active: true,
    limit: 200,
  });
  // `undefined` mientras está en vuelo (no `0`, hallazgo 9): tratarlo como 0
  // deshabilitaba "Desactivar" en todas las filas activas apenas se abría la
  // página, hasta que esta query resolvía — un parpadeo sin motivo real.
  const activePlansCount = activeCountPending ? undefined : (activeCountData?.total ?? 0);

  const deactivateMutation = useDeactivateMembershipPlanMutation();
  const activateMutation = useActivateMembershipPlanMutation();

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  async function handleDeactivate(plan: MembershipPlan) {
    try {
      await deactivateMutation.mutateAsync(plan.id);
      setAction(null);
      toastSuccess("Plan desactivado", `${plan.name} ya no se ofrece para asignar.`);
    } catch (error: any) {
      toastError(
        "No se pudo desactivar el plan",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    }
  }

  async function handleActivate(plan: MembershipPlan) {
    try {
      await activateMutation.mutateAsync(plan.id);
      setAction(null);
      toastSuccess("Plan activado", `${plan.name} ya se puede asignar de nuevo.`);
    } catch (error: any) {
      toastError(
        "No se pudo activar el plan",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    }
  }

  return (
    <Fragment>
      <ListPageLayout
        title="Planes"
        count={`${total} ${total === 1 ? "plan" : "planes"}`}
        primaryAction={
          <Button type="button" aria-label="Crear plan" onClick={() => setCreateOpen(true)}>
            <BadgeDollarSign className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Crear plan</span>
          </Button>
        }
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:max-w-md">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre"
                  aria-label="Buscar planes"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="border-border bg-surface-2/40 pl-10 focus-visible:ring-ring"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filtrar por estado"
              className="rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        }
        footer={
          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onChange={({ limit, offset }) => {
              setLimit(limit);
              setOffset(offset);
            }}
          />
        }
      >
        <div
          className={cn(
            "h-full",
            isFetching && isPlaceholderData && "opacity-60 transition-opacity"
          )}
        >
          <Table containerClassName="h-full overflow-auto">
            <TableHeader>
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className={STICKY_HEAD_CLASS}>Nombre</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Precio vigente</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Vigente desde</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Miembros</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Estado</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!isPending && isError && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="p-0">
                    <DataError
                      title="No se pudieron cargar los planes"
                      description="Intenta nuevamente en unos segundos."
                      onRetry={() => refetch()}
                    />
                  </TableCell>
                </TableRow>
              )}

              {!isPending && !isError && rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState query={debouncedQ} />
                  </TableCell>
                </TableRow>
              )}

              {!isPending &&
                !isError &&
                rows.map((plan) => {
                  // Deshabilitado antes de que el backend tenga que rechazar
                  // con 409 (I3): es el último plan activo del sistema.
                  // Mientras `activePlansCount` está en vuelo (undefined) no
                  // se deshabilita nada todavía (hallazgo 9).
                  const isLastActive =
                    plan.is_active && activePlansCount !== undefined && activePlansCount <= 1;
                  return (
                    <TableRow key={plan.id}>
                      <TableCell className="px-4 py-2 font-medium text-foreground">
                        {plan.name}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-muted-foreground">
                        {plan.current_price
                          ? formatAmount(plan.current_price.amount, currency)
                          : "Sin precio vigente"}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-muted-foreground">
                        {plan.current_price
                          ? formatDate(plan.current_price.effective_from)
                          : "-"}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-muted-foreground">
                        {plan.members_count}
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={
                            plan.is_active
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                              : "border-border text-muted-foreground"
                          }
                        >
                          {plan.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          <RowActionButton
                            icon={PencilLine}
                            label="Editar"
                            onClick={() => setAction({ type: "edit", plan })}
                          />
                          <RowActionButton
                            icon={CircleDollarSign}
                            label="Agregar precio"
                            onClick={() => setAction({ type: "new-price", plan })}
                          />
                          {plan.is_active ? (
                            <RowActionButton
                              icon={Ban}
                              label="Desactivar"
                              tone="destructive"
                              disabledReason={
                                isLastActive
                                  ? "No se puede desactivar el último plan activo"
                                  : undefined
                              }
                              onClick={() => setAction({ type: "deactivate", plan })}
                            />
                          ) : (
                            <RowActionButton
                              icon={RotateCcw}
                              label="Reactivar"
                              onClick={() => setAction({ type: "activate", plan })}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </ListPageLayout>

      <CreateMembershipPlanDialog open={createOpen} onOpenChange={setCreateOpen} />

      {action?.type === "edit" ? (
        <EditMembershipPlanDialog
          open={action.type === "edit"}
          onOpenChange={(open) => setAction(open ? action : null)}
          plan={action.plan}
        />
      ) : null}

      {action?.type === "new-price" ? (
        <NewPlanPriceDialog
          open={action.type === "new-price"}
          onOpenChange={(open) => setAction(open ? action : null)}
          plan={action.plan}
        />
      ) : null}

      {action?.type === "deactivate" ? (
        <ConfirmActionDialog
          open={action.type === "deactivate"}
          onOpenChange={(open) => setAction(open ? action : null)}
          title="Desactivar plan"
          description={`Vas a desactivar el plan "${action.plan.name}". Deja de ofrecerse para asignar, pero los miembros que ya lo tienen lo conservan.`}
          confirmLabel="Desactivar"
          pendingLabel="Desactivando..."
          isPending={deactivateMutation.isPending}
          onConfirm={() => handleDeactivate(action.plan)}
        />
      ) : null}

      {action?.type === "activate" ? (
        <ConfirmActionDialog
          open={action.type === "activate"}
          onOpenChange={(open) => setAction(open ? action : null)}
          title="Reactivar plan"
          description={`Vas a reactivar el plan "${action.plan.name}", que vuelve a estar disponible para asignar.`}
          confirmLabel="Reactivar"
          pendingLabel="Reactivando..."
          isPending={activateMutation.isPending}
          onConfirm={() => handleActivate(action.plan)}
        />
      ) : null}
    </Fragment>
  );
}
