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
import { searchClients } from '@/services/search'
import type { Client } from '@/types'

// ===== Tipos =====n
type PaymentsKpiResp = { amount_sum?: number };

type ClientMini = { id: string; full_name: string };

type PaymentRow = {
  id: string;
  client_id: string;
  client?: ClientMini;
  method?: "cash" | "transfer" | string | null;
  method_channel?: string | null;
  amount: number;
  created_at: string; // ISO
};

type NewClientPayload = { full_name: string; email: string | null; phone: string | null };

// ===== Helpers =====
const nfARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const pad = (n: number) => String(n).padStart(2, "0");

// helpers UTC-friendly
const todayUTC = () => new Date().toISOString().slice(0, 10);

const d2 = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Hoy y mañana en LOCAL
const todayAndTomorrow = () => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  return {
    start: d2(today),
    end: d2(tomorrow),
  };
};

const monthBounds = (d = new Date()) => {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    start: d2(start),
    end: d2(end),
  };
};


export default function Dashboard() {
  const [userName, setUserName] = useState<string>("Usuario");
  const [role, setRole] = useState<Role>("owner");

  // KPIs
  const [clientsTotal, setClientsTotal] = useState<number>(0);
  const [revenueMonth, setRevenueMonth] = useState<number>(0);
  const [checkinsToday, setCheckinsToday] = useState<number>(0);

  // Chart series
  const [series, setSeries] = useState<{ date: string; amount: number }[]>([]);

  // Payments
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // UI state
  const [searchOpen, setSearchOpen] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);

  // Quick check-in
  const [q, setQ] = useState("");
  const [clientId, setClientId] = useState("");
  const [submittingCheckin, setSubmittingCheckin] = useState(false);
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);


  // New client form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  useEffect(() => {
    setUserName(localStorage.getItem("user_name") || "Usuario");
    setRole((localStorage.getItem("user_role") as Role) || "owner");
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        // Clients total via header
        const clientsResp = await api.get("/clients", { params: { limit: 1, offset: 0 } });
        const totalHeader = (clientsResp.headers["x-total-count"] ?? clientsResp.headers["X-Total-Count"]) as string | undefined;
        if (!mounted) return;
        setClientsTotal(totalHeader ? Number(totalHeader) : 0);

        // Revenue this month
        const { start: startMonth, end: endMonth } = monthBounds();
        const kpisResp = await api.get<PaymentsKpiResp>("/payments/reports/kpis", { params: { start: startMonth, end: endMonth } });
        if (!mounted) return;
        setRevenueMonth(kpisResp.data?.amount_sum ?? 0);

        // Check-ins hoy (usando fecha local)
        const { start: startToday, end: endToday } = todayAndTomorrow();
        const resp = await api.get("/attendance", {
          params: { start: startToday, end: endToday, limit: 1, offset: 0 },
        });
        if (!mounted) return;
        const totalHeaderAttendance = (resp.headers["x-total-count"] ??
          resp.headers["X-Total-Count"]) as string | undefined;
        setCheckinsToday(totalHeaderAttendance ? Number(totalHeaderAttendance) : 0);


        // 1) Pagos recientes (tabla)
        setLoadingPayments(true);
        try {
          const p = await api.get<PaymentRow[]>("/payments", {
            params: { limit: 5, offset: 0 },
          });
          if (!mounted) return;

          const paymentsTotalHeader = (p.headers["x-total-count"] ?? p.headers["X-Total-Count"]) as string | undefined;

          if ((p.data?.length ?? 0) === 0 && paymentsTotalHeader && Number(paymentsTotalHeader) > 0) {
            // fallback por si hay más registros
            const p2 = await api.get<PaymentRow[]>("/payments", {
              params: { limit: 100, offset: 0 },
            });
            if (!mounted) return;
            setPayments(p2.data || []);
          } else {
            setPayments(p.data || []);
          }
        } catch (err) {
          console.error("Error cargando pagos recientes", err);
        } finally {
          setLoadingPayments(false);
        }

        // 2) Serie de 30 días (gráfico)
        try {
          const since = new Date();
          since.setDate(since.getDate() - 29);
          const payments30 = await api.get<PaymentRow[]>("/payments", {
            params: { limit: 200, offset: 0 }, // sin start/end: backend no los usa
          });

          if (!mounted) return;
          // dentro del try de "Serie de 30 días"
          const map = new Map<string, number>();
          for (const p of payments30.data ?? []) {
            const key = d2(new Date(p.created_at)); // agrupo por día local
            map.set(key, (map.get(key) ?? 0) + (p.amount || 0));
          }

          const out: { date: string; amount: number }[] = [];
          for (let i = 0; i < 30; i++) {
            const dt = new Date(since);
            dt.setDate(since.getDate() + i);
            const key = d2(dt);
            out.push({ date: key.slice(5), amount: map.get(key) ?? 0 });
          }
          setSeries(out);

        } catch (err) {
          console.error("Error construyendo serie de pagos 30 días", err);
        }
      } catch (err) {
        console.error("Error cargando datos del dashboard", err);
      }
    }

    // Lanzamos la carga inicial
    load();

    // Escuchamos evento cuando se crea un pago nuevo
    const onPaymentsCreated = async () => {
      try {
        setLoadingPayments(true);
        const p = await api.get<PaymentRow[]>("/payments", { params: { limit: 10, offset: 0 } });
        if (!mounted) return;
        setPayments(p.data || []);

        const { start: startMonth, end: endMonth } = monthBounds();
        const kpisResp = await api.get<PaymentsKpiResp>("/payments/reports/kpis", { params: { start: startMonth, end: endMonth } });
        setRevenueMonth(kpisResp.data?.amount_sum ?? 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPayments(false);
      }
    };

    window.addEventListener("payments:created", onPaymentsCreated as EventListener);

    // Cleanup del efecto
    return () => {
      mounted = false;
      window.removeEventListener("payments:created", onPaymentsCreated as EventListener);
    };
  }, []);

  // Búsqueda incremental para quick check-in (igual idea que SpotlightSearch)
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setClientResults([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setSearchingClients(true);
        const data = await searchClients(term);
        setClientResults(data);
      } catch (err) {
        console.error("Error buscando clientes para quick check-in", err);
      } finally {
        setSearchingClients(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [q]);

  // Quick check-in
  async function doQuickCheckin(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!q && !clientId) return;
    setSubmittingCheckin(true);
    try {
      const body: { q?: string; client_id?: string } = {};
      if (clientId) body.client_id = clientId;
      else if (q) body.q = q;

      await api.post("/attendance/checkin", body);

      // 1) Actualización optimista inmediata
      setCheckinsToday((prev) => prev + 1);

      // 2) Refresco con datos reales (por si el backend cuenta distinto)
      try {
        const { start, end } = todayAndTomorrow();
        const resp2 = await api.get("/attendance", {
          params: { start, end, limit: 1, offset: 0 },
        });
        const totalHeader2 = (resp2.headers["x-total-count"] ??
          resp2.headers["X-Total-Count"]) as string | undefined;
        if (totalHeader2 != null) {
          setCheckinsToday(Number(totalHeader2));
        }
      } catch (refreshErr) {
        console.error("Error refrescando check-ins", refreshErr);
        // si falla, nos quedamos con el valor optimista
      }

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
      const payload: NewClientPayload = { full_name: newName.trim(), email: newEmail.trim() ? newEmail.trim() : null, phone: newPhone.trim() ? newPhone.trim() : null };
      await api.post("/clients", payload);

      const clientsResp = await api.get("/clients", { params: { limit: 1, offset: 0 } });
      const totalHeader = (clientsResp.headers["x-total-count"] ?? clientsResp.headers["X-Total-Count"]) as string | undefined;
      setClientsTotal(totalHeader ? Number(totalHeader) : 0);

      // refresh check-ins too (best-effort)
      try {
        const { start, end } = todayAndTomorrow();
        const resp2 = await api.get("/attendance", {
          params: { start, end, limit: 1, offset: 0 },
        });
        const totalHeader2 = (resp2.headers["x-total-count"] ??
          resp2.headers["X-Total-Count"]) as string | undefined;
        setCheckinsToday(totalHeader2 ? Number(totalHeader2) : 0);
      } catch (e) {
        // ignore
      }


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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* HERO */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-wide">
          <span className="bg-linear-to-r from-fuchsia-500 to-cyan-400 bg-clip-text text-transparent">
            Bienvenido {userName}
          </span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">Panel general · {new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</p>

        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="outline" className="w-full sm:w-auto border-white/10 hover:bg-white/10" onClick={() => setSearchOpen(true)}>
            <Search className="h-4 w-4 mr-2" /> Buscar (Ctrl/⌘+K)
          </Button>
          <Button className="w-full sm:w-auto bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30" variant="outline" onClick={() => setNewClientOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo cliente
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-3xl p-4 border border-white/10 bg-linear-to-tr from-white/5 to-transparent">
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
        <section id="attendance" className="rounded-3xl border border-white/10 p-5 bg-white/5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-200">Check-in rápido   </h2>
            <p className="text-xs text-zinc-400">
              Hoy:&nbsp;
              <span className="font-semibold text-emerald-300">
                {checkinsToday}
              </span>
            </p>
          </div>
          <form className="space-y-3" onSubmit={doQuickCheckin}>
            <div>
              <label className="text-xs text-zinc-400">
                Buscar por nombre/email/teléfono
              </label>
              <Input
                className="mt-1 bg-zinc-900/70 border-white/10"
                placeholder="Ej: María, 11 5555 5555 o contacto@..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setClientId(""); // si vuelvo a escribir, limpio el id seleccionado
                }}
              />

              {/* Estado de búsqueda */}
              {searchingClients && q.trim() && (
                <p className="mt-1 text-xs text-zinc-400">Buscando clientes…</p>
              )}

              {/* Lista de sugerencias */}
              {!searchingClients && clientResults.length > 0 && q.trim() && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950/90">
                  {clientResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setClientId(c.id);
                        setQ(c.full_name ?? "");
                        setClientResults([]);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 flex justify-between gap-3"
                    >
                      <div className="truncate">
                        <div className="font-medium">{c.full_name}</div>
                        <div className="text-xs text-zinc-400">
                          {c.phone ?? "Sin teléfono"} · {c.email ?? "Sin email"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Sin resultados */}
              {!searchingClients && clientResults.length === 0 && q.trim() && (
                <p className="mt-1 text-xs text-zinc-500">
                  No se encontraron clientes para “{q.trim()}”.
                </p>
              )}
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
        <section id="payments" className="lg:col-span-2 rounded-3xl border border-white/10 overflow-hidden">
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
                    <td className="px-5 py-4 text-center text-zinc-400" colSpan={6}>Cargando…</td>
                  </tr>
                )}
                {!loadingPayments && payments.length === 0 && (
                  <tr>
                    <td className="px-5 py-4 text-center text-zinc-400" colSpan={6}>Sin movimientos recientes.</td>
                  </tr>
                )}
                {!loadingPayments && payments.map((p, idx) => (
                  <tr key={p.id} className={idx % 2 ? "bg-white/5" : ""}>
                    <td className="px-5 py-3 font-mono text-zinc-200">{p.id}</td>
                    <td className="px-5 py-3 text-zinc-200">{p.client?.full_name ?? p.client_id}</td>
                    <td className="px-5 py-3">
                      <span className={"inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs border " + (p.method === "cash" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-cyan-400/40 bg-cyan-400/10 text-cyan-300")}>{p.method ?? "—"}</span>
                    </td>
                    <td className="px-5 py-3 text-zinc-300">{p.method_channel ?? "—"}</td>
                    <td className="px-5 py-3 font-semibold text-zinc-100">{nfARS.format(p.amount || 0)}</td>
                    <td className="px-5 py-3 text-zinc-300">{new Date(p.created_at).toLocaleString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <SpotlightSearch open={searchOpen} onOpenChange={setSearchOpen} viewerRole={role} />

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
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1 bg-zinc-900/70 border-white/10 text-gray-200" placeholder="Juan Pérez" required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-zinc-400">Email</label>
                    <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="mt-1 bg-zinc-900/70 border-white/10 text-gray-200" placeholder="juan@mail.com (opcional)" />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400">Teléfono</label>
                    <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="mt-1 bg-zinc-900/70 border-white/10 text-gray-200" placeholder="11 5555 5555 (opcional)" />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" className="border-white/10 hover:bg-white/10 text-gray-200" onClick={() => setNewClientOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={creatingClient || !newName.trim()} className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 text-amber-200" variant="outline">{creatingClient ? "Creando…" : "Crear cliente"}</Button>
                </div>
              </form>
            </Card>
          </div>
        </DrawerContent>
      </Drawer>

      <p className="mt-8 text-center text-xs text-zinc-500">Dashboard conectado a FastAPI · Datos en vivo</p>
    </div>
  );
}
