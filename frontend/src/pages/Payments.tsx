import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ban, CreditCard, Search } from "lucide-react";
import { usePaymentsQuery, usePaymentsSummaryQuery, useDeletePaymentMutation } from "@/services/payments.queries";
import type { PaymentMethod } from "@/services/payments";
import { useDebounce } from "@/hooks/useDebounce";
import { useSettingsStore } from "@/stores/settings";
import { useSessionStore } from "@/stores/session";
import type { Payment } from "@/types";
import ListPageLayout from "@/components/ListPageLayout";
import Pagination from "@/components/Pagination";
import DataError from "@/components/DataError";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import PaymentDialog from "@/components/PaymentDialog";
import RowActionButton from "@/components/RowActionButton";
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

type MethodFilter = "all" | PaymentMethod;

const MONTH_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
};

const STICKY_HEAD_CLASS =
  "sticky top-0 z-10 bg-table-head px-4 font-bold text-label-caps uppercase text-muted-foreground shadow-[inset_0_-1px_0_var(--border-hairline)]";

function currentPeriod() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

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
        <div className="h-4 w-16 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-24 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-20 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-20 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-24 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-24 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-8 w-20 rounded bg-surface-2/40" />
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
            No encontramos pagos que coincidan con{" "}
            <span className="font-medium text-foreground">"{query}"</span>.
          </>
        ) : (
          <>Todavía no se registró ningún pago para este período y filtros.</>
        )}
      </p>
    </div>
  );
}

type DialogAction = null | { type: "delete"; payment: Payment };

export default function Payments() {
  const currency = useSettingsStore((s) => s.settings.currency);
  const viewerRole = useSessionStore((s) => s.role);
  const isOwner = viewerRole === "owner";

  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 400);
  const [period, setPeriod] = useState(currentPeriod());
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [action, setAction] = useState<DialogAction>(null);

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, period.month, period.year, methodFilter, limit]);

  const { data, isPending, isFetching, isPlaceholderData, isError, refetch } = usePaymentsQuery({
    q: debouncedQ || undefined,
    period_month: period.month,
    period_year: period.year,
    method: methodFilter === "all" ? undefined : methodFilter,
    limit,
    offset,
  });

  const { data: summary } = usePaymentsSummaryQuery({
    period_month: period.month,
    period_year: period.year,
  });

  const deleteMutation = useDeletePaymentMutation();

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  async function handleDelete(payment: Payment) {
    try {
      await deleteMutation.mutateAsync(payment.id);
      setAction(null);
      toastSuccess("Pago anulado", "El pago se eliminó del historial.");
    } catch (error: any) {
      toastError(
        "No se pudo anular el pago",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    }
  }

  return (
    <Fragment>
      <ListPageLayout
        title="Pagos"
        count={`${total} ${total === 1 ? "pago" : "pagos"}`}
        primaryAction={
          <div className="flex gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/plans">Planes</Link>
            </Button>
            <Button type="button" aria-label="Registrar pago" onClick={() => setCreateOpen(true)}>
              <CreditCard className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Registrar pago</span>
            </Button>
          </div>
        }
        toolbar={
          <div className="flex flex-col gap-3">
            {/* Indicadores del período (D5.1/D5.3): tira compacta DENTRO del
                toolbar, nunca KPI cards afuera de `ListPageLayout` — ese
                bloque desbordaría `lg:h-[var(--list-page-height)]`. */}
            <div className="flex flex-wrap gap-2 text-sm">
              <div className="rounded-lg border border-border bg-surface-2/30 px-3 py-1.5">
                <span className="text-muted-foreground">
                  Cobrado de {String(period.month).padStart(2, "0")}/{period.year}:{" "}
                </span>
                <span className="font-medium text-foreground">
                  {summary ? formatAmount(summary.amount_sum, currency) : "-"}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-surface-2/30 px-3 py-1.5">
                <span className="text-muted-foreground">Pagos registrados: </span>
                <span className="font-medium text-foreground">
                  {summary ? summary.payments_count : "-"}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-surface-2/30 px-3 py-1.5">
                <span className="text-muted-foreground">Miembros al día: </span>
                <span className="font-medium text-foreground">
                  {summary ? `${summary.members_paid} / ${summary.members_active}` : "-"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="w-full sm:max-w-md">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, email o teléfono"
                    aria-label="Buscar pagos"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="border-border bg-surface-2/40 pl-10 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <select
                value={period.month}
                onChange={(e) => setPeriod((p) => ({ ...p, month: Number(e.target.value) }))}
                aria-label="Mes"
                className="rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {MONTH_LABEL.map((label, index) => (
                  <option key={label} value={index + 1}>
                    {label}
                  </option>
                ))}
              </select>

              <Input
                type="number"
                aria-label="Año"
                value={period.year}
                min={2020}
                max={2100}
                onChange={(e) => setPeriod((p) => ({ ...p, year: Number(e.target.value) }))}
                className="w-24 border-border bg-surface-2/40"
              />

              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as MethodFilter)}
                aria-label="Filtrar por método"
                className="rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Todos</option>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>
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
                <TableHead className={STICKY_HEAD_CLASS}>Miembro</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Período</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Plan</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Precio de referencia</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Monto</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Método</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Registrado el</TableHead>
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
                  <TableCell colSpan={8} className="p-0">
                    <DataError
                      title="No se pudieron cargar los pagos"
                      description="Intenta nuevamente en unos segundos."
                      onRetry={() => refetch()}
                    />
                  </TableCell>
                </TableRow>
              )}

              {!isPending && !isError && rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState query={debouncedQ} />
                  </TableCell>
                </TableRow>
              )}

              {!isPending &&
                !isError &&
                rows.map((payment) => {
                  const edited =
                    payment.plan?.reference_amount != null &&
                    payment.plan.reference_amount !== payment.amount;
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="px-4 py-2 font-medium text-foreground">
                        {payment.user?.full_name ?? "-"}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-muted-foreground">
                        {String(payment.period_month).padStart(2, "0")}/{payment.period_year}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-muted-foreground">
                        {payment.plan?.name ?? "Sin plan"}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-muted-foreground">
                        {payment.plan?.reference_amount != null
                          ? formatAmount(payment.plan.reference_amount, currency)
                          : "-"}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-foreground">
                        <div className="flex items-center gap-2">
                          {formatAmount(payment.amount, currency)}
                          {edited ? (
                            <Badge
                              variant="outline"
                              title={`Precio de referencia: ${formatAmount(
                                payment.plan!.reference_amount as number,
                                currency
                              )}`}
                              className="border-border text-muted-foreground"
                            >
                              editado
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2 text-muted-foreground">
                        {payment.method ? METHOD_LABEL[payment.method] : "-"}
                        {payment.method === "transfer" && payment.method_channel
                          ? ` (${payment.method_channel})`
                          : ""}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-muted-foreground">
                        {formatDate(payment.created_at)}
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        {isOwner ? (
                          <RowActionButton
                            icon={Ban}
                            label="Anular"
                            tone="destructive"
                            onClick={() => setAction({ type: "delete", payment })}
                          />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </ListPageLayout>

      <PaymentDialog open={createOpen} onOpenChange={setCreateOpen} />

      {action?.type === "delete" ? (
        <ConfirmActionDialog
          open={action.type === "delete"}
          onOpenChange={(open) => setAction(open ? action : null)}
          title="Anular pago"
          description={`Vas a anular el pago de ${
            action.payment.user?.full_name ?? "este miembro"
          } del período ${String(action.payment.period_month).padStart(2, "0")}/${
            action.payment.period_year
          }. El estado de cuota se recalcula al instante.`}
          confirmLabel="Anular"
          pendingLabel="Anulando..."
          destructive
          isPending={deleteMutation.isPending}
          onConfirm={() => handleDelete(action.payment)}
        />
      ) : null}
    </Fragment>
  );
}
