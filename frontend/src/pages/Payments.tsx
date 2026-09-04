import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  CreditCard,
  Eye,
  MessageCircle,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/http";
import { useLocation } from "react-router-dom";
import { alertInfo, alertSuccessAutoClose, confirmAction } from "@/lib/alerts";
import type { AppSettings, Client, Payment } from "@/types";
import { DEFAULT_SETTINGS, useSettingsStore } from "@/stores/settings";
import { useClientsQuery } from "@/services/clients.queries";
import {
  usePaymentsQuery,
  useDeletePaymentMutation,
} from "@/services/payments.queries";
import { getPendingClients } from "@/services/payments";
import type { PaymentsParams } from "@/services/payments";
import DataError from "@/components/DataError";
import { cn } from "@/lib/utils";

const nfARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const outlineButtonClass =
  "border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70";

const isUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    str
  );

type PaymentsFilter = Pick<PaymentsParams, "q" | "client_id">;

function filterFromSearch(search: string): { filter: PaymentsFilter; displayQuery: string } {
  const sp = new URLSearchParams(search);
  const clientIdQS = sp.get("client_id") || sp.get("clientId") || "";
  const qQS = sp.get("q") || "";
  const clientNameQS = sp.get("client_name");

  const displayQuery = clientNameQS || clientIdQS || qQS || "";
  const filter: PaymentsFilter = clientIdQS
    ? { client_id: clientIdQS }
    : qQS
      ? { q: qQS }
      : {};

  return { filter, displayQuery };
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
  icon: typeof Wallet;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-label-caps uppercase text-muted-foreground">
            {label}
          </p>
          <p className="font-display mt-2 text-metric-kpi font-extrabold tabular-nums text-foreground">
            {value}
          </p>
          <p className="mt-1 text-body-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const location = useLocation();
  // Lazy initializers: derivan el filtro inicial de `location.search` de forma
  // síncrona (deep-links como /payments?client_id=X, p. ej. desde `UserCard`)
  // en vez de arrancar con `{}` y corregir recién en el `useEffect` de abajo,
  // que dejaba a `usePaymentsQuery` montarse un instante con el filtro vacío.
  const [q, setQ] = useState<string>(() => filterFromSearch(location.search).displayQuery);
  const [filter, setFilter] = useState<PaymentsFilter>(
    () => filterFromSearch(location.search).filter
  );
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [showReminderPreview, setShowReminderPreview] = useState(false);

  // El efecto solo calcula params a partir de la URL (client_id / q); el
  // fetch lo dispara `usePaymentsQuery` solo cuando `filter`/`offset` cambian.
  useEffect(() => {
    const { filter: nextFilter, displayQuery } = filterFromSearch(location.search);
    setQ(displayQuery);
    setFilter(nextFilter);
    setOffset(0);
  }, [location.search]);

  const {
    data,
    isPending,
    isFetching,
    isPlaceholderData,
    isError,
    refetch,
  } = usePaymentsQuery({ ...filter, limit, offset });

  // Recordatorios: derivados puros de dos queries compartidas con el
  // Dashboard (dec. 6), en vez de un `useState` propio poblado a mano.
  const reminderPeriod = useMemo(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }, []);
  const clientsForReminders = useClientsQuery({ limit: 200 });
  const paymentsForReminders = usePaymentsQuery({ limit: 200 });
  const pendingClients = useMemo<Client[]>(() => {
    const clients = clientsForReminders.data?.items ?? [];
    const payments = paymentsForReminders.data?.items ?? [];
    return getPendingClients(clients, payments, reminderPeriod).filter(
      (client) => !!client.phone
    );
  }, [clientsForReminders.data, paymentsForReminders.data, reminderPeriod]);

  const deletePaymentMutation = useDeletePaymentMutation();

  const onSearch = () => {
    const trimmed = q.trim();
    setOffset(0);
    if (!trimmed) setFilter({});
    else if (isUUID(trimmed)) setFilter({ client_id: trimmed });
    else setFilter({ q: trimmed });
  };

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalAmount = rows.reduce((sum, payment) => sum + payment.amount, 0);
  const cashCount = rows.filter((payment) => payment.method === "cash").length;
  const transferCount = rows.filter(
    (payment) => payment.method === "transfer"
  ).length;
  const reminderTargetsCount = pendingClients.length;

  function buildReminderMessage(client: Client) {
    const template =
      settings.payment_reminder_message || DEFAULT_SETTINGS.payment_reminder_message || "";
    return template
      .replaceAll("{client_name}", client.full_name)
      .replaceAll("{gym_name}", settings.gym_name)
      .replaceAll("{amount}", nfARS.format(settings.default_fee))
      .replaceAll("{grace_days}", String(settings.late_fee_grace_days))
      .replaceAll("{payment_alias}", settings.payment_alias || "no definido");
  }

  function buildReminderLink(client: Client) {
    const digits = (client.phone || "").replace(/\D/g, "");
    const normalizedPhone = digits.startsWith("54") ? digits : `54${digits}`;
    const message = encodeURIComponent(buildReminderMessage(client));
    return `https://wa.me/${normalizedPhone}?text=${message}`;
  }

  async function handleBulkReminder() {
    if (pendingClients.length === 0) {
      await alertInfo(
        "Sin recordatorios pendientes",
        "No hay clientes con WhatsApp cargado y cuota pendiente para este mes."
      );
      return;
    }

    const result = await confirmAction(
      "Enviar recordatorios de pago",
      `Se abrirán ${pendingClients.length} chat${pendingClients.length === 1 ? "" : "s"} de WhatsApp con el mensaje del mes.`
    );

    if (!result.isConfirmed) return;

    setSendingReminders(true);
    try {
      const sentAt = new Date().toISOString();
      pendingClients.forEach((client, index) => {
        window.setTimeout(() => {
          window.open(buildReminderLink(client), "_blank", "noopener,noreferrer");
        }, index * 220);
      });

      setSettings({ payment_reminder_last_sent_at: sentAt });

      try {
        const { data } = await api.patch<AppSettings>("/settings", {
          payment_reminder_last_sent_at: sentAt,
        });
        setSettings(data);
      } catch {
        // keep local trace if backend update is unavailable
      }

      await alertSuccessAutoClose(
        "Recordatorios preparados",
        `Se abrieron ${pendingClients.length} chat${pendingClients.length === 1 ? "" : "s"} con el mensaje mensual.`,
        1500
      );
    } finally {
      setSendingReminders(false);
    }
  }

  async function handleDeletePayment(payment: Payment) {
    const clientName = payment.client?.full_name ?? "este cliente";
    const period = `${String(payment.period_month).padStart(2, "0")}/${payment.period_year}`;

    const result = await confirmAction(
      "Dar de baja pago",
      `Se eliminara el pago de ${clientName} correspondiente a ${period}. Esta accion no se puede deshacer.`
    );

    if (!result.isConfirmed) return;

    try {
      await deletePaymentMutation.mutateAsync(payment.id);

      await alertSuccessAutoClose(
        "Pago dado de baja",
        "El movimiento se elimino correctamente.",
        1200
      );
    } catch (error) {
      console.error("Error eliminando pago", error);
      await alertInfo(
        "No se pudo eliminar el pago",
        "Revisa permisos o intenta nuevamente en unos segundos."
      );
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="hero-aura rounded-xl border border-border p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary">
            Pagos
          </div>
          <h1 className="warm-accent-text font-display mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Analiza movimientos y encuentra cobros con mas rapidez.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            Filtrá por cliente, email, teléfono o UUID y mantenete enfocado en los
            movimientos relevantes del período.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-1/60 p-6 backdrop-blur-xl">
          <p className="text-label-caps uppercase text-muted-foreground">
            Filtro activo
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Busqueda actual</p>
              <p className="text-lg font-semibold text-foreground">
                {q.trim() ? `"${q.trim()}"` : "Sin filtro"}
              </p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-primary">
              Esta pagina muestra {rows.length} movimiento{rows.length === 1 ? "" : "s"} cargado{rows.length === 1 ? "" : "s"}.
            </div>
            <div className="rounded-xl border border-border bg-surface-2/30 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {reminderTargetsCount} cliente{reminderTargetsCount === 1 ? "" : "s"} pendiente{reminderTargetsCount === 1 ? "" : "s"} con WhatsApp
              </p>
              <p className="mt-1 text-muted-foreground">
                Mensaje mensual con cuota {nfARS.format(settings.default_fee)}, {settings.late_fee_grace_days} días de tolerancia y alias {settings.payment_alias || "no definido"}.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Último envío registrado:{" "}
                <span className="text-foreground">
                  {settings.payment_reminder_last_sent_at
                    ? new Date(settings.payment_reminder_last_sent_at).toLocaleString("es-AR")
                    : "todavía no hay envíos"}
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Movimientos visibles"
          value={rows.length.toLocaleString("es-AR")}
          hint="Registros renderizados en esta pagina"
          icon={Wallet}
        />
        <StatCard
          label="Monto visible"
          value={nfARS.format(totalAmount)}
          hint="Suma de los importes actualmente listados"
          icon={CreditCard}
        />
        <StatCard
          label="Metodos"
          value={`${cashCount} ef. / ${transferCount} transf.`}
          hint="Distribucion rapida en la vista actual"
          icon={CalendarRange}
        />
      </section>

      <Card className="border-border bg-canvas/60 backdrop-blur-md">
        <CardHeader className="border-b border-border pb-5">
          <CardTitle className="text-foreground">Listado de pagos</CardTitle>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full gap-2 sm:max-w-xl">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nombre, email, teléfono o UUID"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onSearch()}
                  className="border-border bg-surface-1/70 pl-10 focus-visible:ring-ring"
                />
              </div>
              <Button onClick={onSearch} disabled={isFetching}>
                {isFetching ? "Buscando..." : "Buscar"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowReminderPreview((current) => !current)}
                disabled={reminderTargetsCount === 0}
                className={outlineButtonClass}
                variant="outline"
              >
                <Eye className="mr-2 h-4 w-4" />
                {showReminderPreview ? "Ocultar lista" : "Ver destinatarios"}
              </Button>
              <Button
                onClick={handleBulkReminder}
                disabled={sendingReminders || reminderTargetsCount === 0}
                className={outlineButtonClass}
                variant="outline"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {sendingReminders ? "Abriendo chats..." : "Recordatorio mensual"}
              </Button>
              <Button
                variant="outline"
                disabled={offset === 0 || isFetching}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className={outlineButtonClass}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={offset + limit >= total || isFetching}
                onClick={() => setOffset(offset + limit)}
                className={outlineButtonClass}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          {showReminderPreview && (
            <div className="rounded-xl border border-border bg-surface-2/20 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Destinatarios del recordatorio mensual
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Se enviará a clientes activos con WhatsApp cargado y cuota pendiente del mes.
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.18em] text-primary/80">
                  {reminderTargetsCount} pendiente{reminderTargetsCount === 1 ? "" : "s"}
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {pendingClients.map((client) => (
                  <div
                    key={client.id}
                    className="rounded-xl border border-border bg-surface-2/20 px-4 py-3"
                  >
                    <p className="font-medium text-foreground">{client.full_name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {client.phone || "Sin WhatsApp"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            className={cn(
              "overflow-hidden rounded-xl border border-border",
              isFetching && isPlaceholderData && "opacity-60 transition-opacity"
            )}
          >
            <table className="w-full text-sm">
              <thead className="bg-surface-2/40">
                <tr className="text-label-caps uppercase text-muted-foreground">
                  <th className="border-b border-border p-4 text-left">Fecha</th>
                  <th className="border-b border-border p-4 text-left">Cliente</th>
                  <th className="border-b border-border p-4 text-left">Periodo</th>
                  <th className="border-b border-border p-4 text-left">Monto</th>
                  <th className="border-b border-border p-4 text-left">Metodo</th>
                  <th className="border-b border-border p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-canvas/40">
                {isPending && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center">
                      <div className="inline-flex items-center gap-2 text-muted-foreground">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                        Cargando movimientos...
                      </div>
                    </td>
                  </tr>
                )}

                {!isPending && isError && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <DataError
                        title="No se pudieron cargar los pagos"
                        description="Intenta nuevamente en unos segundos."
                        onRetry={() => refetch()}
                      />
                    </td>
                  </tr>
                )}

                {!isPending && !isError && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No hay pagos para los filtros actuales.
                    </td>
                  </tr>
                )}

                {!isPending &&
                  !isError &&
                  rows.map((payment) => (
                    <tr key={payment.id} className="border-t border-border">
                      <td className="p-4 text-foreground">
                        {new Date(payment.created_at).toLocaleString("es-AR")}
                      </td>

                      <td className="p-4 text-foreground">
                        <div className="font-medium text-foreground">
                          {payment.client?.full_name ?? "-"}
                        </div>
                        {(payment.client?.email || payment.client?.phone) && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {payment.client?.email ?? "-"} · {payment.client?.phone ?? "-"}
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-muted-foreground">
                        {String(payment.period_month).padStart(2, "0")}/{payment.period_year}
                      </td>

                      <td className="p-4 font-semibold text-foreground">
                        {nfARS.format(payment.amount)}
                      </td>

                      <td className="p-4">
                        {payment.method ? (
                          payment.method === "cash" ? (
                            <Badge className="border-primary/30 bg-primary/10 text-primary">
                              efectivo
                            </Badge>
                          ) : payment.method === "transfer" ? (
                            <Badge className="border-border bg-surface-2/30 text-muted-foreground">
                              transferencia
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-border text-muted-foreground"
                            >
                              {payment.method}
                            </Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePayment(payment)}
                          disabled={
                            deletePaymentMutation.isPending &&
                            deletePaymentMutation.variables === payment.id
                          }
                          className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-60"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {deletePaymentMutation.isPending &&
                          deletePaymentMutation.variables === payment.id
                            ? "Eliminando..."
                            : "Dar de baja"}
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Total encontrados:{" "}
              <span className="font-medium text-foreground">{total}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={offset === 0 || isFetching}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className={outlineButtonClass}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={offset + limit >= total || isFetching}
                onClick={() => setOffset(offset + limit)}
                className={outlineButtonClass}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
