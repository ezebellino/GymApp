import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  CreditCard,
  Dumbbell,
  MessageCircle,
  Plus,
  Search,
  UserPlus2,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";
import SpotlightSearch from "@/components/SpotlightSearch";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toastError, toastSuccess } from "@/lib/toast";
import type { User } from "@/types";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDebounce } from "@/hooks/useDebounce";
import { useUsersSearchQuery } from "@/services/search.queries";
import { useCheckinMutation } from "@/services/attendance.queries";
import { useCreatePaymentMutation } from "@/services/payments.queries";
import { useCreateUserMutation } from "@/services/users.queries";
import DataError from "@/components/DataError";

type NewClientPayload = {
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type Kpi = {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
};

const nfARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const outlineButtonClass =
  "border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70";

const shortId = (value: string) => `${value.slice(0, 8)}...`;

const methodLabel = (method?: string | null) => {
  if (method === "cash") return "Efectivo";
  if (method === "transfer") return "Transferencia";
  return method || "-";
};

function sanitizeUserName(value: string) {
  return value.replace(/^(dueño|dueno|coach)\s+/i, "").trim();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const userName = useSessionStore((s) => s.userName) ?? "Usuario";
  const role = useSessionStore((s) => s.role) ?? "owner";
  const {
    clientsTotal,
    activeClients,
    clientsWithoutPayment,
    revenueMonth,
    checkinsToday,
    payments,
    pendingClients,
    kpisStatus,
    lastPaymentsStatus,
    pendingClientsStatus,
  } = useDashboardData();
  const [searchOpen, setSearchOpen] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [q, setQ] = useState("");
  const [clientId, setClientId] = useState("");
  const checkinMutation = useCheckinMutation();
  const debouncedQ = useDebounce(q, 300);
  const clientsSearch = useUsersSearchQuery(debouncedQ, {
    enabled: debouncedQ.trim().length > 0,
  });
  const clientResults = clientsSearch.data ?? [];
  const searchingClients = clientsSearch.isFetching;
  const [paymentQuery, setPaymentQuery] = useState("");
  const [paymentClientId, setPaymentClientId] = useState("");
  const debouncedPaymentQuery = useDebounce(paymentQuery, 300);
  const paymentsSearch = useUsersSearchQuery(debouncedPaymentQuery, {
    enabled: debouncedPaymentQuery.trim().length > 0,
  });
  const paymentResults = paymentsSearch.data ?? [];
  const searchingPayments = paymentsSearch.isFetching;
  const createPaymentMutation = useCreatePaymentMutation();
  const [quickPaymentMethod, setQuickPaymentMethod] = useState<"cash" | "transfer">("cash");
  const defaultFee = useSettingsStore((s) => s.settings.default_fee);
  const gymName = useSettingsStore((s) => s.settings.gym_name);
  const adminName = useSettingsStore((s) => s.settings.admin_name) ?? "";
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const createClientMutation = useCreateUserMutation();

  function openPaymentReminder(client: User) {
    if (!client.phone) return;
    const digits = client.phone.replace(/\D/g, "");
    const normalizedPhone = digits.startsWith("54") ? digits : `54${digits}`;
    const message = encodeURIComponent(
      `Hola ${client.full_name}, te escribimos desde Mini Espacio para recordarte el pago pendiente del mes. Si ya abonaste, podes ignorar este mensaje. Gracias.`
    );
    window.open(
      `https://wa.me/${normalizedPhone}?text=${message}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  useEffect(() => {
    const openSpotlight = () => setSearchOpen(true);
    window.addEventListener("app:open-spotlight", openSpotlight);
    return () => window.removeEventListener("app:open-spotlight", openSpotlight);
  }, []);


  async function doQuickCheckin(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!q && !clientId) return;

    try {
      const body: { q?: string; user_id?: string } = {};
      if (clientId) body.user_id = clientId;
      else if (q) body.q = q;

      await checkinMutation.mutateAsync(body);
      setQ("");
      setClientId("");

      toastSuccess(
        "Check-in registrado",
        "La asistencia se guardo correctamente."
      );
    } catch (error: any) {
      console.error(error);
      toastError(
        "No se pudo registrar el check-in",
        error?.response?.data?.detail ?? "Revisa los datos e intenta nuevamente."
      );
    }
  }

  async function doQuickPayment(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!paymentQuery && !paymentClientId) return;

    const selectedClient =
      paymentResults.find((client) => client.id === paymentClientId) ??
      clientResults.find((client) => client.id === paymentClientId);
    const clientName = selectedClient?.full_name || paymentQuery.trim() || "el cliente";

    try {
      const now = new Date();
      await createPaymentMutation.mutateAsync({
        user_id: paymentClientId,
        amount: defaultFee,
        method: quickPaymentMethod,
        method_channel: null,
        note: "Cobro rapido de cuota mensual",
        period_month: now.getMonth() + 1,
        period_year: now.getFullYear(),
      });

      setPaymentQuery("");
      setPaymentClientId("");

      toastSuccess(
        "Pago rapido registrado",
        `Se registró la cuota vigente de ${clientName} por ${quickPaymentMethod === "cash" ? "efectivo" : "transferencia"}.`
      );
    } catch (error: any) {
      console.error(error);
      toastError(
        "No se pudo registrar el pago",
        error?.response?.data?.detail ?? "Revisa si el periodo ya fue cobrado."
      );
    }
  }

  async function createClient(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!newName.trim()) return;

    try {
      // Alta rapida: solo pide "Nombre completo", asi que se parte con la
      // misma heuristica que usa el backend en el split de perfil (primer
      // token -> first_name, resto -> last_name).
      const [firstName, ...rest] = newName.trim().split(/\s+/);
      const payload: NewClientPayload & { role: "member" } = {
        first_name: firstName,
        last_name: rest.length ? rest.join(" ") : null,
        role: "member",
        email: newEmail.trim() ? newEmail.trim() : null,
        phone: newPhone.trim() ? newPhone.trim() : null,
      };
      await createClientMutation.mutateAsync(payload);

      setNewClientOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPhone("");

      toastSuccess(
        "Cliente creado",
        "El nuevo cliente ya aparece disponible para operar."
      );
    } catch (error: any) {
      console.error(error);
      toastError(
        "No se pudo crear el cliente",
        error?.response?.data?.detail ?? "Intenta nuevamente en unos instantes."
      );
    }
  }

  const kpis: Kpi[] = useMemo(
    () => [
      {
        label: "Clientes activos",
        value: activeClients.toLocaleString("es-AR"),
        hint: `${clientsTotal.toLocaleString("es-AR")} registrados en total`,
        icon: Users,
      },
      {
        label: "Rutina base",
        value: "4 dias",
        hint: "Bloques principales de entrenamiento",
        icon: Dumbbell,
      },
      {
        label: "Check-ins de hoy",
        value: checkinsToday.toLocaleString("es-AR"),
        hint: "Asistencias registradas en la jornada",
        icon: CalendarCheck2,
      },
    ],
    [activeClients, checkinsToday, clientsTotal, revenueMonth]
  );

  const displayName = useMemo(() => {
    const cleanedUserName = sanitizeUserName(userName || "Usuario");
    const ownerName =
      adminName ||
      (cleanedUserName.toLowerCase() === gymName.trim().toLowerCase()
        ? ""
        : cleanedUserName);
    const preferred = role === "owner" ? ownerName : cleanedUserName;
    const cleaned = sanitizeUserName(preferred || "Usuario");
    return cleaned || "Usuario";
  }, [adminName, gymName, role, userName]);

  const quickActions = [
    {
      title: "Buscar cliente",
      description: "Accedé rápido a pagos o historial desde el buscador global.",
      icon: Search,
      onClick: () => setSearchOpen(true),
    },
    {
      title: "Abrir rutinas",
      description: "Entra directo al armado de dias, ejercicios y avances.",
      icon: Dumbbell,
      onClick: () => navigate("/routines"),
    },
    {
      title: "Nuevo cliente",
      description: "Registra una alta nueva sin salir del dashboard.",
      icon: UserPlus2,
      onClick: () => setNewClientOpen(true),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="hero-aura rounded-xl border border-border p-6">
        <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
          Centro operativo
        </div>
        <h1 className="warm-accent-text font-display mt-4 text-3xl font-extrabold md:text-headline-hero">
          Bienvenido {displayName}
        </h1>
        <p className="mt-3 max-w-2xl text-body-md text-muted-foreground md:text-body-lg">
          Mini Espacio concentra el seguimiento diario del gimnasio y te
          invita a pasar rapido a rutinas para cargar avances y dejar todo
          el dia bien registrado.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => navigate("/routines")}>
            <Dumbbell className="mr-2 h-4 w-4" />
            Ir a rutinas
          </Button>
          <Button
            variant="outline"
            onClick={() => setSearchOpen(true)}
            className={outlineButtonClass}
          >
            <Search className="mr-2 h-4 w-4" />
            Abrir buscador
          </Button>
          <Button
            variant="outline"
            onClick={() => setNewClientOpen(true)}
            className={outlineButtonClass}
          >
            <Plus className="mr-2 h-4 w-4" />
            Crear cliente
          </Button>
        </div>
      </section>

      <section className="@container grid grid-cols-1 gap-4 @lg:grid-cols-2 @3xl:grid-cols-3">
        {kpisStatus.isPending ? (
          <div className="rounded-xl border border-border bg-surface-2/20 p-6 text-center text-sm text-muted-foreground @lg:col-span-2 @3xl:col-span-3">
            Cargando indicadores...
          </div>
        ) : kpisStatus.isError ? (
          <div className="@lg:col-span-2 @3xl:col-span-3">
            <DataError
              title="No se pudieron cargar los indicadores"
              description="Intenta nuevamente en unos segundos."
              onRetry={kpisStatus.refetch}
            />
          </div>
        ) : (
          kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-border bg-surface-1 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-label-caps uppercase text-muted-foreground">
                    {kpi.label}
                  </p>
                  <p className="font-display mt-2 text-metric-kpi font-extrabold tabular-nums text-foreground">
                    {kpi.value}
                  </p>
                  <p className="mt-1 text-body-sm text-muted-foreground">{kpi.hint}</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-strong">
                  <kpi.icon size={18} />
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="@container grid gap-4 @4xl:grid-cols-3">
        {quickActions.map((action) => (
          <button
            key={action.title}
            type="button"
            onClick={action.onClick}
            className="group rounded-xl border border-border bg-surface-1/60 p-5 text-left transition hover:border-primary/30 hover:bg-surface-1"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-4 inline-flex rounded-full bg-primary/15 p-3 text-primary-strong">
                  <action.icon className="h-5 w-5" />
                </div>
                <h2 className="font-display text-headline-md text-foreground">
                  {action.title}
                </h2>
                <p className="mt-2 text-body-sm text-muted-foreground">
                  {action.description}
                </p>
              </div>
              <ArrowRight className="mt-1 h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
            </div>
          </button>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <section className="rounded-xl border border-border bg-surface-1/60 p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">
              Check-in rápido
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Buscá por nombre, email o teléfono. Si ya tenés el UUID, pegalo
              directamente.
            </p>
          </div>

          <form className="space-y-3" onSubmit={doQuickCheckin}>
            <div>
              <label className="text-xs text-muted-foreground">Búsqueda general</label>
              <Input
                className="mt-1"
                placeholder="Ej: Maria, 11 5555 5555 o contacto@mail.com"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setClientId("");
                }}
              />

              {searchingClients && q.trim() ? (
                <p className="mt-2 text-xs text-muted-foreground">Buscando clientes...</p>
              ) : null}

              {!searchingClients && clientResults.length > 0 && q.trim() ? (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border bg-canvas/90">
                  {clientResults.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setClientId(client.id);
                        setQ(client.full_name ?? "");
                      }}
                      className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2/60"
                    >
                      <div className="truncate">
                        <div className="font-medium">{client.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {client.phone ?? "Sin teléfono"} - {client.email ?? "Sin email"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {!searchingClients && clientResults.length === 0 && q.trim() ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No se encontraron clientes para "{q.trim()}".
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-xs text-muted-foreground">UUID exacto</label>
              <Input
                className="mt-1 font-mono"
                placeholder="265bc49d-3845-4063-97fd-06d1c96a21d9"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-xs text-muted-foreground">
                La asistencia se registra para hoy.
              </span>
              <Button
                type="submit"
                disabled={checkinMutation.isPending || (!q && !clientId)}
              >
                <CheckCircle2 size={16} className="mr-2" />
                {checkinMutation.isPending ? "Registrando..." : "Registrar"}
              </Button>
            </div>
          </form>
          </section>

          <section className="rounded-xl border border-border bg-surface-1/60 p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">
                Pago rápido
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Registrá la cuota mensual desde el dashboard usando el valor actual de Ajustes.
              </p>
            </div>

            <form className="space-y-3" onSubmit={doQuickPayment}>
              <div>
                <label className="text-xs text-muted-foreground">Cliente</label>
                <Input
                  className="mt-1"
                  placeholder="Buscá por nombre o teléfono"
                  value={paymentQuery}
                  onChange={(e) => {
                    setPaymentQuery(e.target.value);
                    setPaymentClientId("");
                  }}
                />

                {searchingPayments && paymentQuery.trim() ? (
                  <p className="mt-2 text-xs text-muted-foreground">Buscando clientes...</p>
                ) : null}

                {!searchingPayments && paymentResults.length > 0 && paymentQuery.trim() ? (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border bg-canvas/90">
                    {paymentResults.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setPaymentClientId(client.id);
                          setPaymentQuery(client.full_name ?? "");
                        }}
                        className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2/60"
                      >
                        <div className="truncate">
                          <div className="font-medium">{client.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {client.phone ?? "Sin teléfono"} - {client.email ?? "Sin email"}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}

                {!searchingPayments && paymentResults.length === 0 && paymentQuery.trim() ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No se encontraron clientes para "{paymentQuery.trim()}".
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3">
                <p className="text-label-caps uppercase text-muted-foreground">
                  Cuota vigente
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {nfARS.format(defaultFee)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Se registra para el mes actual con el método que selecciones.
                </p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Método rápido</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setQuickPaymentMethod("cash")}
                    className={
                      quickPaymentMethod === "cash"
                        ? "border-primary/30 bg-primary/10 text-primary-strong"
                        : outlineButtonClass
                    }
                  >
                    Efectivo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setQuickPaymentMethod("transfer")}
                    className={
                      quickPaymentMethod === "transfer"
                        ? "border-primary/30 bg-primary/10 text-primary-strong"
                        : outlineButtonClass
                    }
                  >
                    Transferencia
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-xs text-muted-foreground">
                  Ideal para cobrar sin entrar a la ficha.
                </span>
                <Button
                  type="submit"
                  disabled={createPaymentMutation.isPending || !paymentClientId}
                >
                  <CreditCard size={16} className="mr-2" />
                  {createPaymentMutation.isPending ? "Registrando..." : "Cobrar cuota"}
                </Button>
              </div>
            </form>
          </section>
        </div>

        <section className="overflow-hidden rounded-xl border border-border lg:col-span-2">
          <header className="border-b border-border bg-surface-2/40 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Pagos recientes
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Últimos movimientos registrados en el sistema.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate("/payments")}
                className={outlineButtonClass}
              >
                Ver todos
              </Button>
            </div>
          </header>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-label-caps uppercase text-muted-foreground">
                <tr>
                  <th className="border-b border-border px-5 py-3">ID</th>
                  <th className="border-b border-border px-5 py-3">Cliente</th>
                  <th className="border-b border-border px-5 py-3">Método</th>
                  <th className="border-b border-border px-5 py-3">Canal</th>
                  <th className="border-b border-border px-5 py-3">Monto</th>
                  <th className="border-b border-border px-5 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {lastPaymentsStatus.isPending ? (
                  <tr>
                    <td className="px-5 py-5 text-center text-muted-foreground" colSpan={6}>
                      Cargando movimientos...
                    </td>
                  </tr>
                ) : null}

                {!lastPaymentsStatus.isPending && lastPaymentsStatus.isError ? (
                  <tr>
                    <td className="p-0" colSpan={6}>
                      <DataError
                        title="No se pudieron cargar los pagos"
                        description="Intenta nuevamente en unos segundos."
                        onRetry={lastPaymentsStatus.refetch}
                      />
                    </td>
                  </tr>
                ) : null}

                {!lastPaymentsStatus.isPending &&
                !lastPaymentsStatus.isError &&
                payments.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-muted-foreground" colSpan={6}>
                      Todavía no hay movimientos recientes.
                    </td>
                  </tr>
                ) : null}

                {!lastPaymentsStatus.isPending && !lastPaymentsStatus.isError
                  ? payments.map((payment, index) => (
                      <tr
                        key={payment.id}
                        className={index % 2 ? "bg-surface-2/30" : ""}
                      >
                        <td className="px-5 py-3 font-mono text-muted-foreground">
                          {shortId(payment.id)}
                        </td>
                        <td className="px-5 py-3 text-foreground">
                          {payment.user?.full_name ?? payment.user_id}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {methodLabel(payment.method)}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {payment.method_channel || "-"}
                        </td>
                        <td className="px-5 py-3 font-semibold text-foreground">
                          {nfARS.format(payment.amount || 0)}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {new Date(payment.created_at).toLocaleString("es-AR")}
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-surface-1/60 p-5">
        <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Seguimiento de cobros
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Clientes activos sin pago registrado este mes y acceso rapido a WhatsApp.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/payments")}
            className={outlineButtonClass}
          >
            Ver pagos
          </Button>
        </div>

        <div className="@container mt-4 grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
          {pendingClientsStatus.isPending ? (
            <div className="rounded-xl border border-border bg-surface-2/20 px-4 py-5 text-sm text-muted-foreground @lg:col-span-2 @4xl:col-span-3">
              Cargando seguimiento de cobros...
            </div>
          ) : pendingClientsStatus.isError ? (
            <div className="@lg:col-span-2 @4xl:col-span-3">
              <DataError
                title="No se pudo cargar el seguimiento de cobros"
                description="Intenta nuevamente en unos segundos."
                onRetry={pendingClientsStatus.refetch}
              />
            </div>
          ) : pendingClients.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface-2/20 px-4 py-5 text-sm text-muted-foreground @lg:col-span-2 @4xl:col-span-3">
              No hay clientes pendientes en la muestra actual.
            </div>
          ) : (
            pendingClients.map((client) => (
              <div
                key={client.id}
                className="rounded-xl border border-border bg-surface-2/20 p-4"
              >
                <p className="font-semibold text-foreground">{client.full_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {client.phone || "Sin telefono cargado"}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/users")}
                    className={outlineButtonClass}
                  >
                    Ver ficha
                  </Button>
                  <Button
                    type="button"
                    onClick={() => openPaymentReminder(client)}
                    disabled={!client.phone}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <SpotlightSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        viewerRole={role}
      />

      <Drawer open={newClientOpen} onOpenChange={setNewClientOpen}>
        <DrawerContent className="mx-auto max-w-2xl">
          <DrawerHeader>
            <DrawerTitle>Nuevo cliente</DrawerTitle>
          </DrawerHeader>
          <div className="p-5">
            <Card className="border-border bg-canvas/60 p-5">
              <form className="space-y-4" onSubmit={createClient}>
                <div>
                  <label className="text-sm text-muted-foreground">Nombre completo</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="mt-1"
                    placeholder="Juan Perez"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Email</label>
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="mt-1"
                      placeholder="juan@mail.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Teléfono</label>
                    <Input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="mt-1"
                      placeholder="11 5555 5555"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={outlineButtonClass}
                    onClick={() => setNewClientOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createClientMutation.isPending || !newName.trim()}
                  >
                    {createClientMutation.isPending ? "Creando..." : "Crear cliente"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
