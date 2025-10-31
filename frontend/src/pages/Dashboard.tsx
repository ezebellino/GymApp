// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { CreditCard, Users, CalendarCheck2, Search, CheckCircle2, Plus } from "lucide-react";
import api from "@/lib/http";
import SpotlightSearch from "@/components/SpotlightSearch";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { Role } from "@/types";

// ===== Tipos =====
type AttendanceBucketRow = { bucket: string; count?: number };

type PaymentsKpiResp = {
  amount_sum?: number;
};

type ClientMini = {
  id: string;
  full_name: string;
};

type PaymentRow = {
  id: string;
  client_id: string;
  client?: ClientMini;
  method?: "cash" | "transfer" | string | null;
  method_channel?: string | null;
  amount: number;
  created_at: string; // ISO
};

type NewClientPayload = {
  full_name: string;
  email: string | null;
  phone: string | null;
};

// ===== Helpers =====
const nfARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

const todayISO = (): string => new Date().toISOString().slice(0, 10);

const pad = (n: number): string => String(n).padStart(2, "0");

const monthBounds = (d = new Date()) => {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    start: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    end: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
};

export default function Dashboard() {
  const [userName, setUserName] = useState<string>("Usuario");
  const [role, setRole] = useState<Role>("owner");

  // KPIs
  const [clientsTotal, setClientsTotal] = useState<number>(0);
  const [revenueMonth, setRevenueMonth] = useState<number>(0);
  const [checkinsToday, setCheckinsToday] = useState<number>(0);

  // Pagos recientes
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loadingPayments, setLoadingPayments] = useState<boolean>(false);

  // Spotlight & New Client drawer
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [newClientOpen, setNewClientOpen] = useState<boolean>(false);

  // Quick check-in form
  const [q, setQ] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [submittingCheckin, setSubmittingCheckin] = useState<boolean>(false);

  // New Client form
  const [newName, setNewName] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");
  const [newPhone, setNewPhone] = useState<string>("");
  const [creatingClient, setCreatingClient] = useState<boolean>(false);

  useEffect(() => {
    setUserName(localStorage.getItem("user_name") || "Usuario");
    const r = (localStorage.getItem("user_role") as Role) || "owner";
    setRole(r);
  }, []);

  // Load KPIs + recent payments
  useEffect(() => {
    (async () => {
      try {
        // 1) Total de clientes via header
        const clientsResp = await api.get<unknown>("/clients", { params: { limit: 1, offset: 0 } });
        const totalHeader =
          (clientsResp.headers["x-total-count"] as string | undefined) ??
          (clientsResp.headers["X-Total-Count"] as string | undefined);
        setClientsTotal(totalHeader ? Number(totalHeader) : 0);

        // 2) Ingresos del mes
        const { start, end } = monthBounds();
        const kpis = await api.get<PaymentsKpiResp>("/payments/reports/kpis", { params: { start, end } });
        setRevenueMonth(kpis.data?.amount_sum ?? 0);

        // 3) Check-ins de hoy
        const today = todayISO();
        const ats = await api.get<AttendanceBucketRow[]>("/reports/attendance", {
          params: { start: today, end: today, bucket: "day" },
        });
        const sumToday = (ats.data ?? []).reduce<number>(
          (acc: number, r: AttendanceBucketRow) => acc + (r.count ?? 0),
          0
        );
        setCheckinsToday(sumToday);

        // 4) Pagos recientes
        setLoadingPayments(true);
        const p = await api.get<PaymentRow[]>("/payments", { params: { limit: 10, offset: 0 } });
        setPayments(p.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingPayments(false);
      }
    })();
  }, []);

  // Quick check-in submit
  async function doQuickCheckin(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!q && !clientId) return;

    setSubmittingCheckin(true);
    try {
      const body: { q?: string; client_id?: string } = {};
      if (q) body.q = q;
      if (!q && clientId) body.client_id = clientId;

      await api.post("/attendance/checkin", body);

      // refresco KPI de hoy
      const today = todayISO();
      const ats = await api.get<AttendanceBucketRow[]>("/reports/attendance", {
        params: { start: today, end: today, bucket: "day" },
      });
      const sumToday = (ats.data ?? []).reduce<number>(
        (acc: number, r: AttendanceBucketRow) => acc + (r.count ?? 0),
        0
      );
      setCheckinsToday(sumToday);

      setQ("");
      setClientId("");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingCheckin(false);
    }
  }

  // Create client
  async function createClient(e?: React.FormEvent<HTMLFormElement>) {
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

      // refrescar total de clientes
      const clientsResp = await api.get<unknown>("/clients", { params: { limit: 1, offset: 0 } });
      const totalHeader =
        (clientsResp.headers["x-total-count"] as string | undefined) ??
        (clientsResp.headers["X-Total-Count"] as string | undefined);
      setClientsTotal(totalHeader ? Number(totalHeader) : 0);

      setNewClientOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingClient(false);
    }
  }

  const kpis = useMemo(
    () => [
      { label: "Clientes", value: clientsTotal.toLocaleString("es-AR"), icon: Users },
      { label: "Ingresos (mes)", value: nfARS.format(revenueMonth), icon: CreditCard },
      { label: "Check-ins (hoy)", value: checkinsToday.toLocaleString("es-AR"), icon: CalendarCheck2 },
    ],
    [clientsTotal, revenueMonth, checkinsToday]
  );

  return (
    <div className="mx-auto max-w-7xl">
      {/* HERO */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-wide">
          <span className="bg-linear-to-r from-fuchsia-500 to-cyan-400 bg-clip-text text-transparent">
            Bienvenido{role === "owner" ? ", Owner" : role === "coach" ? ", Coach" : ""} {userName}
          </span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Panel general ·{" "}
          {new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
        </p>

        <div className="mt-5 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            className="border-white/10 hover:bg-white/10"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4 mr-2" />
            Buscar (Ctrl/⌘+K)
          </Button>
          <Button
            className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30"
            variant="outline"
            onClick={() => setNewClientOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo cliente
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-3xl p-4 border border-white/10 bg-linear-to-tr from-white/5 to-transparent"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl p-2 bg-linear-to-tr from-fuchsia-500/30 via-cyan-400/20 to-emerald-400/20">
                <k.icon size={18} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-400">{k.label}</p>
                <p className="text-lg font-semibold text-zinc-100">{k.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: Quick Check-in + Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Check-in */}
        <section
          id="attendance"
          className="lg:col-span-1 rounded-3xl border border-white/10 p-5 bg-white/5"
        >
          <h2 className="text-sm font-semibold mb-3 text-zinc-200">Check-in rápido</h2>
          <form className="space-y-3" onSubmit={doQuickCheckin}>
            <div>
              <label className="text-xs text-zinc-400">
                Buscar por nombre/email/teléfono <span className="text-zinc-500">(usa “q”)</span>
              </label>
              <Input
                className="mt-1 bg-zinc-900/70 border-white/10"
                placeholder="Ej: Maria, 11 5555 5555 o contacto@..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400">O bien por UUID exacto</label>
              <Input
                className="mt-1 bg-zinc-900/70 border-white/10 font-mono"
                placeholder="265bc49d-3845-4063-97fd-06d1c96a21d9"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={submittingCheckin || (!q && !clientId)}
                className="rounded-2xl px-3 py-2 text-sm font-medium border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20"
              >
                <CheckCircle2 size={16} className="mr-2" /> Check-in
              </Button>
              <span className="text-xs text-zinc-400">Crea asistencia para hoy</span>
            </div>
          </form>
        </section>

        {/* Recent Payments */}
        <section
          id="payments"
          className="lg:col-span-2 rounded-3xl border border-white/10 overflow-hidden"
        >
          <header className="px-5 py-4 bg-linear-to-r from-fuchsia-500/10 via-cyan-400/10 to-emerald-400/10 border-b border-white/10">
            <h2 className="text-sm font-semibold text-zinc-200">Pagos recientes</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-zinc-400">
                <tr>
                  <th className="px-5 py-3 border-b border-white/10">ID</th>
                  <th className="px-5 py-3 border-b border-white/10">Cliente</th>
                  <th className="px-5 py-3 border-b border-white/10">Método</th>
                  <th className="px-5 py-3 border-b border-white/10">Canal</th>
                  <th className="px-5 py-3 border-b border-white/10">Monto</th>
                  <th className="px-5 py-3 border-b border-white/10">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {loadingPayments && (
                  <tr>
                    <td className="px-5 py-4 text-center text-zinc-400" colSpan={6}>
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loadingPayments && payments.length === 0 && (
                  <tr>
                    <td className="px-5 py-4 text-center text-zinc-400" colSpan={6}>
                      Sin movimientos recientes.
                    </td>
                  </tr>
                )}
                {!loadingPayments &&
                  payments.map((p, idx) => (
                    <tr key={p.id} className={idx % 2 ? "bg-white/5" : ""}>
                      <td className="px-5 py-3 font-mono text-zinc-200">{p.id}</td>
                      <td className="px-5 py-3 text-zinc-200">{p.client?.full_name ?? p.client_id}</td>
                      <td className="px-5 py-3">
                        <span
                          className={
                            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs border " +
                            (p.method === "cash"
                              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                              : "border-cyan-400/40 bg-cyan-400/10 text-cyan-300")
                          }
                        >
                          {p.method ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-zinc-300">{p.method_channel ?? "—"}</td>
                      <td className="px-5 py-3 font-semibold text-zinc-100">
                        {nfARS.format(p.amount || 0)}
                      </td>
                      <td className="px-5 py-3 text-zinc-300">
                        {new Date(p.created_at).toLocaleString("es-AR")}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* SpotlightSearch (mismo que Topbar) */}
      <SpotlightSearch open={searchOpen} onOpenChange={setSearchOpen} viewerRole={role} />

      {/* New Client Drawer */}
      <Drawer open={newClientOpen} onOpenChange={setNewClientOpen}>
        <DrawerContent className="max-w-2xl mx-auto">
          <DrawerHeader>
            <DrawerTitle>Nuevo cliente</DrawerTitle>
          </DrawerHeader>
          <div className="p-5">
            <Card className="border-white/10 bg-zinc-950/60 p-5">
              <form className="space-y-4" onSubmit={createClient}>
                <div>
                  <label className="text-sm text-zinc-400">Nombre completo</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="mt-1 bg-zinc-900/70 border-white/10"
                    placeholder="Juan Pérez"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-zinc-400">Email</label>
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="mt-1 bg-zinc-900/70 border-white/10"
                      placeholder="juan@mail.com (opcional)"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400">Teléfono</label>
                    <Input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="mt-1 bg-zinc-900/70 border-white/10"
                      placeholder="11 5555 5555 (opcional)"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/10 hover:bg-white/10"
                    onClick={() => setNewClientOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={creatingClient || !newName.trim()}
                    className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30"
                    variant="outline"
                  >
                    {creatingClient ? "Creando…" : "Crear cliente"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </DrawerContent>
      </Drawer>

      <p className="mt-8 text-center text-xs text-zinc-500">
        Dashboard conectado a FastAPI · Datos en vivo
      </p>
    </div>
  );
}
