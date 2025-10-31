// src/pages/Dashboard.jsx
import { CreditCard, Users, CalendarCheck2, Search, CheckCircle2 } from "lucide-react";

export default function Dashboard() {
  const kpis = [
    { label: "Active Clients", value: 142, icon: Users },
    { label: "Revenue (Oct)", value: "$356.400", icon: CreditCard },
    { label: "Check-ins (Today)", value: 38, icon: CalendarCheck2 },
  ];

  const payments = [
    { id: "#A12", client: "Juan Pérez", method: "cash", channel: "—", amount: 8000, date: "2025-10-27" },
    { id: "#A13", client: "María García", method: "transfer", channel: "mercadopago", amount: 9000, date: "2025-10-27" },
    { id: "#A14", client: "Lucas Soto", method: "transfer", channel: "card", amount: 8000, date: "2025-10-26" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      {/* Greeting + search */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold">Welcome back 👋</h1>
          <p className="text-slate-400 text-sm">Owner · October 2025</p>
        </div>
        <div className="md:ml-auto">
          <div className="relative">
            <input
              placeholder="Search clients, payments, attendance…"
              className="w-full md:w-96 rounded-2xl bg-white/5 border border-white/10 px-10 py-2 text-sm placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-cyan-400/40"
            />
            <Search className="absolute left-3 top-2.5" size={16} />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-3xl p-4 border border-white/10 bg-linear-gradient-to-tr from-white/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl p-2 bg-linear-gradient-to-tr from-fuchsia-500/30 via-cyan-400/20 to-emerald-400/20">
                <k.icon size={18} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">{k.label}</p>
                <p className="text-lg font-semibold">{k.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: Quick Check-in + Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Check-in */}
        <section id="attendance" className="lg:col-span-1 rounded-3xl border border-white/10 p-5 bg-white/5">
          <h2 className="text-sm font-semibold mb-3">Quick Check-in</h2>
          <form className="space-y-3">
            <div>
              <label className="text-xs text-slate-400">Client ID or search</label>
              <input
                className="mt-1 w-full rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400/40 outline-none"
                placeholder="UUID or name/email/phone"
              />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="rounded-2xl px-3 py-2 text-sm font-medium border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center gap-2">
                <CheckCircle2 size={16} /> Check-in
              </button>
              <span className="text-xs text-slate-400">Creates attendance for today</span>
            </div>
          </form>
        </section>

        {/* Recent Payments */}
        <section id="payments" className="lg:col-span-2 rounded-3xl border border-white/10 overflow-hidden">
          <header className="px-5 py-4 bg-linear-gradient-to-r from-fuchsia-500/10 via-cyan-400/10 to-emerald-400/10 border-b border-white/10">
            <h2 className="text-sm font-semibold">Recent Payments</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="px-5 py-3 border-b border-white/10">ID</th>
                  <th className="px-5 py-3 border-b border-white/10">Client</th>
                  <th className="px-5 py-3 border-b border-white/10">Method</th>
                  <th className="px-5 py-3 border-b border-white/10">Channel</th>
                  <th className="px-5 py-3 border-b border-white/10">Amount</th>
                  <th className="px-5 py-3 border-b border-white/10">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, idx) => (
                  <tr key={p.id} className={idx % 2 ? "bg-white/2" : ""}>
                    <td className="px-5 py-3 font-mono">{p.id}</td>
                    <td className="px-5 py-3">{p.client}</td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs border " +
                          (p.method === "cash" ? "border-emerald-400/40 bg-emerald-400/10" : "border-cyan-400/40 bg-cyan-400/10")
                        }
                      >
                        {p.method}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-300">{p.channel}</td>
                    <td className="px-5 py-3 font-semibold">
                      ${" "}
                      {p.amount.toLocaleString("es-AR", {
                        minimumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-5 py-3 text-slate-300">{p.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <p className="mt-8 text-center text-xs text-slate-500">UI demo • Hook these widgets to your FastAPI endpoints</p>
    </div>
  );
}
