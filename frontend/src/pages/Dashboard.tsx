import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  CreditCard,
  Plus,
  Search,
  ShieldCheck,
  UserPlus2,
  Users,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/http";
import SpotlightSearch from "@/components/SpotlightSearch";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { alertError, alertSuccessAutoClose } from "@/lib/alerts";
import type { Role } from "@/types";
import { searchClients } from "@/services/search";
import type { Client } from "@/types";

type PaymentsKpiResp = { amount_sum?: number };

type ClientMini = {
  id: string;
  full_name: string;
  is_active?: boolean;
};

type PaymentRow = {
  id: string;
  client_id: string;
  client?: ClientMini;
  method?: "cash" | "transfer" | string | null;
  method_channel?: string | null;
  amount: number;
  period_month?: number;
  period_year?: number;
  created_at: string;
};

type NewClientPayload = {
  full_name: string;
  email: string | null;
  phone: string | null;
};

type BusinessAlert = {
  tone: "warning" | "neutral" | "positive";
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
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

const CLIENTS_SAMPLE_LIMIT = 200;

const pad = (value: number) => String(value).padStart(2, "0");

const d2 = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const monthBounds = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: d2(start),
    end: d2(end),
  };
};

const currentPeriod = () => {
  const today = new Date();
  return {
    month: today.getMonth() + 1,
    year: today.getFullYear(),
  };
};

const isSameMonth = (value: string, month: number, year: number) => {
  const date = new Date(value);
  return date.getMonth() + 1 === month && date.getFullYear() === year;
};

const todayAndTomorrow = () => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  return {
    start: d2(today),
    end: d2(tomorrow),
  };
};

const shortId = (value: string) => `${value.slice(0, 8)}...`;

const methodLabel = (method?: string | null) => {
  if (method === "cash") return "Efectivo";
  if (method === "transfer") return "Transferencia";
  return method || "-";
};

function roleLabel(role: Role) {
  return role === "owner" ? "Dueño" : "Coach";
}

const alertToneClasses: Record<BusinessAlert["tone"], string> = {
  warning:
    "border-amber-300/25 bg-[linear-gradient(135deg,rgba(250,204,21,0.18),rgba(255,247,237,0.04),rgba(249,115,22,0.18))]",
  neutral:
    "border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(250,204,21,0.03),rgba(249,115,22,0.08))]",
  positive:
    "border-orange-300/20 bg-[linear-gradient(135deg,rgba(249,115,22,0.14),rgba(255,247,237,0.04),rgba(250,204,21,0.16))]",
};

const alertIcons = {
  warning: AlertTriangle,
  neutral: ShieldCheck,
  positive: CheckCircle2,
} as const;

export default function Dashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>("Usuario");
  const [role, setRole] = useState<Role>("owner");
  const [clientsTotal, setClientsTotal] = useState(0);
  const [activeClients, setActiveClients] = useState(0);
  const [clientsWithoutPayment, setClientsWithoutPayment] = useState(0);
  const [revenueMonth, setRevenueMonth] = useState(0);
  const [checkinsToday, setCheckinsToday] = useState(0);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [q, setQ] = useState("");
  const [clientId, setClientId] = useState("");
  const [submittingCheckin, setSubmittingCheckin] = useState(false);
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  useEffect(() => {
    setUserName(localStorage.getItem("user_name") || "Usuario");
    setRole((localStorage.getItem("user_role") as Role) || "owner");
  }, []);

  async function refreshCheckinsToday() {
    const { start, end } = todayAndTomorrow();
    const resp = await api.get("/attendance", {
      params: { start, end, limit: 1, offset: 0 },
    });
    const totalHeader = (resp.headers["x-total-count"] ??
      resp.headers["X-Total-Count"]) as string | undefined;
    setCheckinsToday(totalHeader ? Number(totalHeader) : 0);
  }

  async function loadDashboard() {
    const { month, year } = currentPeriod();
    const { start, end } = monthBounds();

    const [clientsResp, paymentsResp, revenueResp, attendanceResp] =
      await Promise.allSettled([
        api.get<ClientMini[]>("/clients", {
          params: { limit: CLIENTS_SAMPLE_LIMIT, offset: 0 },
        }),
        api.get<PaymentRow[]>("/payments", {
          params: { limit: 200, offset: 0 },
        }),
        api.get<PaymentsKpiResp>("/payments/reports/kpis", {
          params: { start, end },
        }),
        api.get("/attendance", {
          params: { start: todayAndTomorrow().start, end: todayAndTomorrow().end, limit: 1, offset: 0 },
        }),
      ]);

    if (clientsResp.status !== "fulfilled") {
      throw clientsResp.reason;
    }

    const totalHeader = (clientsResp.value.headers["x-total-count"] ??
      clientsResp.value.headers["X-Total-Count"]) as string | undefined;
    const clients = clientsResp.value.data || [];

    setClientsTotal(totalHeader ? Number(totalHeader) : clients.length);
    setActiveClients(clients.filter((client) => client.is_active !== false).length);

    if (attendanceResp.status === "fulfilled") {
      const attendanceHeader = (attendanceResp.value.headers["x-total-count"] ??
        attendanceResp.value.headers["X-Total-Count"]) as string | undefined;
      setCheckinsToday(attendanceHeader ? Number(attendanceHeader) : 0);
    } else {
      await refreshCheckinsToday();
    }

    setLoadingPayments(true);
    try {
      if (paymentsResp.status !== "fulfilled") {
        throw paymentsResp.reason;
      }

      const allPayments = paymentsResp.value.data || [];
      setPayments(allPayments.slice(0, 5));

      const revenueFromPayments = allPayments
        .filter((payment) => isSameMonth(payment.created_at, month, year))
        .reduce((sum, payment) => sum + (payment.amount || 0), 0);

      if (revenueResp.status === "fulfilled") {
        setRevenueMonth(revenueResp.value.data?.amount_sum ?? revenueFromPayments);
      } else {
        console.warn("No se pudieron cargar KPIs de pagos; usando fallback local.", revenueResp.reason);
        setRevenueMonth(revenueFromPayments);
      }

      const paidClientIds = new Set(
        allPayments
          .filter(
            (payment) =>
              payment.period_month === month && payment.period_year === year
          )
          .map((payment) => payment.client_id)
      );
      const pendingThisMonth = clients.filter(
        (client) => client.is_active !== false && !paidClientIds.has(client.id)
      ).length;
      setClientsWithoutPayment(pendingThisMonth);
    } finally {
      setLoadingPayments(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        await loadDashboard();
      } catch (error) {
        if (mounted) {
          console.error("Error cargando datos del dashboard", error);
        }
      }
    }

    load();

    const onPaymentsCreated = async () => {
      if (!mounted) return;
      try {
        await loadDashboard();
      } catch (error) {
        console.error("Error refrescando dashboard", error);
      }
    };

    window.addEventListener("payments:created", onPaymentsCreated as EventListener);

    return () => {
      mounted = false;
      window.removeEventListener(
        "payments:created",
        onPaymentsCreated as EventListener
      );
    };
  }, []);

  useEffect(() => {
    const openSpotlight = () => setSearchOpen(true);
    window.addEventListener("app:open-spotlight", openSpotlight);
    return () => window.removeEventListener("app:open-spotlight", openSpotlight);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setClientResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setSearchingClients(true);
        const data = await searchClients(term);
        setClientResults(data);
      } catch (error) {
        console.error("Error buscando clientes para quick check-in", error);
      } finally {
        setSearchingClients(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [q]);

  async function doQuickCheckin(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!q && !clientId) return;

    setSubmittingCheckin(true);
    try {
      const body: { q?: string; client_id?: string } = {};
      if (clientId) body.client_id = clientId;
      else if (q) body.q = q;

      await api.post("/attendance/checkin", body);
      await refreshCheckinsToday();
      setQ("");
      setClientId("");
      setClientResults([]);

      await alertSuccessAutoClose(
        "Check-in registrado",
        "La asistencia se guardo correctamente."
      );
    } catch (error: any) {
      console.error(error);
      await alertError(
        "No se pudo registrar el check-in",
        error?.response?.data?.detail ?? "Revisa los datos e intenta nuevamente."
      );
    } finally {
      setSubmittingCheckin(false);
    }
  }

  async function createClient(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!newName.trim()) return;

    setCreatingClient(true);
    try {
      const payload: NewClientPayload = {
        full_name: newName.trim(),
        email: newEmail.trim() ? newEmail.trim() : null,
        phone: newPhone.trim() ? newPhone.trim() : null,
      };
      await api.post("/clients", payload);
      await loadDashboard();

      setNewClientOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPhone("");

      await alertSuccessAutoClose(
        "Cliente creado",
        "El nuevo cliente ya aparece disponible para operar."
      );
    } catch (error: any) {
      console.error(error);
      await alertError(
        "No se pudo crear el cliente",
        error?.response?.data?.detail ?? "Intenta nuevamente en unos instantes."
      );
    } finally {
      setCreatingClient(false);
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
        label: "Ingresos del mes",
        value: nfARS.format(revenueMonth),
        hint: "Facturación acumulada del período actual",
        icon: CreditCard,
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

  const quickActions = [
    {
      title: "Buscar cliente",
      description: "Accedé rápido a pagos o historial desde el buscador global.",
      icon: Search,
      onClick: () => setSearchOpen(true),
    },
    {
      title: "Nuevo cliente",
      description: "Registra una alta nueva sin salir del dashboard.",
      icon: UserPlus2,
      onClick: () => setNewClientOpen(true),
    },
    {
      title: "Ver pagos",
      description: "Revisá movimientos, filtros y períodos de cobro.",
      icon: Wallet,
      onClick: () => navigate("/payments"),
    },
  ];

  const businessAlerts: BusinessAlert[] = useMemo(() => {
    const alerts: BusinessAlert[] = [];

    if (clientsWithoutPayment > 0) {
      alerts.push({
        tone: "warning",
        title: `${clientsWithoutPayment} cliente${clientsWithoutPayment === 1 ? "" : "s"} sin pago este mes`,
        description:
          "Conviene revisar cobros pendientes para sostener la facturacion y evitar atrasos.",
        cta: "Ir a pagos",
        onClick: () => navigate("/payments"),
      });
    }

    if (checkinsToday === 0) {
      alerts.push({
        tone: "neutral",
        title: "Todavía no hay check-ins hoy",
        description:
          "Puede ser un buen momento para validar ingresos o revisar la operación de la jornada.",
        cta: "Ver asistencias",
        onClick: () => navigate("/attendance"),
      });
    }

    if (revenueMonth > 0 && clientsWithoutPayment === 0) {
      alerts.push({
        tone: "positive",
        title: "Cobranza del mes bien encaminada",
        description:
          "No se detectan clientes activos pendientes en la muestra actual y la facturacion ya esta en movimiento.",
        cta: "Revisar dashboard",
        onClick: () => navigate("/dashboard"),
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        tone: "neutral",
        title: "Todo bajo control",
        description:
          "No aparecen alertas prioritarias. Podés enfocarte en altas, seguimiento y operación diaria.",
        cta: "Ir a clientes",
        onClick: () => navigate("/clients"),
      });
    }

    return alerts.slice(0, 3);
  }, [checkinsToday, clientsWithoutPayment, navigate, revenueMonth]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="rounded-[32px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.12),rgba(255,247,237,0.03)_45%,rgba(249,115,22,0.14))] p-6 shadow-[0_25px_90px_-55px_rgba(249,115,22,0.58)]">
          <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-100">
            Centro operativo
          </div>
          <h1 className="warm-accent-text mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Bienvenido, {userName}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
            Controla clientes, cobros y asistencias desde un solo lugar.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              onClick={() => setSearchOpen(true)}
              className="border border-amber-300/25 bg-[linear-gradient(90deg,#facc15_0%,#fff7ed_48%,#f97316_100%)] font-medium text-black hover:opacity-95"
            >
              <Search className="mr-2 h-4 w-4" />
              Abrir buscador
            </Button>
            <Button
              variant="outline"
              onClick={() => setNewClientOpen(true)}
              className="border-amber-200/10 bg-white/[0.04] hover:bg-white/[0.08]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear cliente
            </Button>
          </div>
        </div>

        <div className="rounded-[28px] border border-amber-200/10 bg-white/[0.035] p-6 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
            Estado de sesión
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-zinc-400">Rol actual</p>
              <p className="text-lg font-semibold text-zinc-100">
                {roleLabel(role)}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-400">Periodo visible</p>
              <p className="text-lg font-semibold text-zinc-100">
                {new Date().toLocaleDateString("es-AR", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.12),rgba(255,247,237,0.05),rgba(249,115,22,0.12))] p-4 text-sm text-amber-50">
              Hoy llevas <span className="font-semibold">{checkinsToday}</span>{" "}
              check-ins registrados y{" "}
              <span className="font-semibold">{clientsWithoutPayment}</span>{" "}
              cliente{clientsWithoutPayment === 1 ? "" : "s"} pendiente
              {clientsWithoutPayment === 1 ? "" : "s"} de cobro.
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-[24px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.07),rgba(255,255,255,0.02)_48%,rgba(249,115,22,0.08))] p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                  {kpi.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">
                  {kpi.value}
                </p>
                <p className="mt-1 text-sm text-zinc-400">{kpi.hint}</p>
              </div>
              <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(250,204,21,0.2),rgba(255,247,237,0.08),rgba(249,115,22,0.22))] p-3">
                <kpi.icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">
              Alertas de negocio
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Prioridades para atender la operación diaria del gimnasio.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {businessAlerts.map((alert) => {
            const Icon = alertIcons[alert.tone];
            return (
              <button
                key={alert.title}
                type="button"
                onClick={alert.onClick}
                className={`${alertToneClasses[alert.tone]} rounded-[24px] border p-5 text-left transition hover:translate-y-[-1px]`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-4 inline-flex rounded-2xl bg-black/15 p-3 text-amber-50">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-100">
                      {alert.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">
                      {alert.description}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-amber-100">
                      {alert.cta}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {quickActions.map((action) => (
          <button
            key={action.title}
            type="button"
            onClick={action.onClick}
            className="group rounded-[24px] border border-amber-200/10 bg-zinc-900/50 p-5 text-left transition hover:border-amber-300/20 hover:bg-[#17120f]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-4 inline-flex rounded-2xl bg-[linear-gradient(135deg,rgba(250,204,21,0.18),rgba(255,247,237,0.05),rgba(249,115,22,0.18))] p-3 text-amber-50">
                  <action.icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold text-zinc-100">
                  {action.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {action.description}
                </p>
              </div>
              <ArrowRight className="mt-1 h-5 w-5 text-zinc-500 transition group-hover:translate-x-1 group-hover:text-zinc-100" />
            </div>
          </button>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-[28px] border border-amber-200/10 bg-white/[0.035] p-5 lg:col-span-1">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-zinc-100">
              Check-in rápido
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Buscá por nombre, email o teléfono. Si ya tenés el UUID, pegalo
              directamente.
            </p>
          </div>

          <form className="space-y-3" onSubmit={doQuickCheckin}>
            <div>
              <label className="text-xs text-zinc-400">Busqueda general</label>
              <Input
                className="mt-1 border-white/10 bg-zinc-900/70"
                placeholder="Ej: Maria, 11 5555 5555 o contacto@mail.com"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setClientId("");
                }}
              />

              {searchingClients && q.trim() ? (
                <p className="mt-2 text-xs text-zinc-400">Buscando clientes...</p>
              ) : null}

              {!searchingClients && clientResults.length > 0 && q.trim() ? (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950/90">
                  {clientResults.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setClientId(client.id);
                        setQ(client.full_name ?? "");
                        setClientResults([]);
                      }}
                      className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-white/5"
                    >
                      <div className="truncate">
                        <div className="font-medium">{client.full_name}</div>
                        <div className="text-xs text-zinc-400">
                          {client.phone ?? "Sin teléfono"} - {client.email ?? "Sin email"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {!searchingClients && clientResults.length === 0 && q.trim() ? (
                <p className="mt-2 text-xs text-zinc-500">
                  No se encontraron clientes para "{q.trim()}".
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-xs text-zinc-400">UUID exacto</label>
              <Input
                className="mt-1 border-white/10 bg-zinc-900/70 font-mono"
                placeholder="265bc49d-3845-4063-97fd-06d1c96a21d9"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-xs text-zinc-500">
                La asistencia se registra para hoy.
              </span>
              <Button
                type="submit"
                disabled={submittingCheckin || (!q && !clientId)}
                className="border border-amber-300/25 bg-[linear-gradient(90deg,rgba(250,204,21,0.14),rgba(255,247,237,0.06),rgba(249,115,22,0.16))] text-sm font-medium text-amber-50 hover:opacity-95"
              >
                <CheckCircle2 size={16} className="mr-2" />
                {submittingCheckin ? "Registrando..." : "Registrar"}
              </Button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-amber-200/10 lg:col-span-2">
          <header className="border-b border-amber-200/10 bg-[linear-gradient(90deg,rgba(250,204,21,0.12),rgba(255,247,237,0.04),rgba(249,115,22,0.14))] px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">
                  Pagos recientes
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Últimos movimientos registrados en el sistema.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate("/payments")}
                className="border-amber-200/10 bg-white/[0.04] hover:bg-white/[0.08]"
              >
                Ver todos
              </Button>
            </div>
          </header>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-zinc-400">
                <tr>
                  <th className="border-b border-white/10 px-5 py-3">ID</th>
                  <th className="border-b border-white/10 px-5 py-3">Cliente</th>
                  <th className="border-b border-white/10 px-5 py-3">Metodo</th>
                  <th className="border-b border-white/10 px-5 py-3">Canal</th>
                  <th className="border-b border-white/10 px-5 py-3">Monto</th>
                  <th className="border-b border-white/10 px-5 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {loadingPayments ? (
                  <tr>
                    <td className="px-5 py-5 text-center text-zinc-400" colSpan={6}>
                      Cargando movimientos...
                    </td>
                  </tr>
                ) : null}

                {!loadingPayments && payments.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-zinc-400" colSpan={6}>
                      Todavía no hay movimientos recientes.
                    </td>
                  </tr>
                ) : null}

                {!loadingPayments
                  ? payments.map((payment, index) => (
                      <tr
                        key={payment.id}
                        className={index % 2 ? "bg-white/5" : ""}
                      >
                        <td className="px-5 py-3 font-mono text-zinc-300">
                          {shortId(payment.id)}
                        </td>
                        <td className="px-5 py-3 text-zinc-100">
                          {payment.client?.full_name ?? payment.client_id}
                        </td>
                        <td className="px-5 py-3 text-zinc-300">
                          {methodLabel(payment.method)}
                        </td>
                        <td className="px-5 py-3 text-zinc-300">
                          {payment.method_channel || "-"}
                        </td>
                        <td className="px-5 py-3 font-semibold text-zinc-100">
                          {nfARS.format(payment.amount || 0)}
                        </td>
                        <td className="px-5 py-3 text-zinc-400">
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
            <Card className="border-amber-200/10 bg-zinc-950/60 p-5">
              <form className="space-y-4" onSubmit={createClient}>
                <div>
                  <label className="text-sm text-zinc-400">Nombre completo</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="mt-1 border-white/10 bg-zinc-900/70 text-gray-200"
                    placeholder="Juan Perez"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-zinc-400">Email</label>
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="mt-1 border-white/10 bg-zinc-900/70 text-gray-200"
                      placeholder="juan@mail.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400">Telefono</label>
                    <Input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="mt-1 border-white/10 bg-zinc-900/70 text-gray-200"
                      placeholder="11 5555 5555"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-200/10 text-gray-200 hover:bg-white/[0.08]"
                    onClick={() => setNewClientOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={creatingClient || !newName.trim()}
                    className="border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.14),rgba(255,247,237,0.06),rgba(249,115,22,0.16))] text-amber-50 hover:opacity-95"
                    variant="outline"
                  >
                    {creatingClient ? "Creando..." : "Crear cliente"}
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
