import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarCheck2,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import type { FC } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

type NavItem = {
  to: string;
  label: string;
  icon: FC<{ size?: number }>;
};

const items: NavItem[] = [
  { to: "/my-routine", label: "Mi rutina", icon: Dumbbell },
  { to: "/routines", label: "Rutinas", icon: Dumbbell },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/attendance", label: "Asistencias", icon: CalendarCheck2 },
  { to: "/dashboard", label: "Seguimiento", icon: LayoutDashboard },
  { to: "/payments", label: "Pagos", icon: CreditCard },
  { to: "/reports", label: "Reportes", icon: BarChart3 },
  { to: "/settings", label: "Ajustes", icon: Settings },
];

function roleLabel(role: string) {
  if (role === "owner") return "Dueño";
  if (role === "coach") return "Coach";
  return "Usuario";
}

export default function Sidebar() {
  const navigate = useNavigate();
  const role = (localStorage.getItem("user_role") as string) || "coach";
  const allowed = items.filter((item) => {
    if (role === "user") return item.to === "/my-routine";
    if (item.to === "/my-routine") return false;
    if (item.to === "/reports" && role !== "owner") return false;
    return true;
  });

  return (
    <aside className="warm-scrollbar fixed left-0 top-14 z-40 hidden h-[calc(100vh-3.5rem)] w-64 flex-col overflow-y-auto border-r border-amber-200/10 bg-[#0d0b0a]/84 backdrop-blur-xl lg:flex">
      <TooltipProvider delayDuration={80}>
        <nav className="space-y-4 p-4">
          <section className="rounded-2xl border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.12),rgba(255,247,237,0.03),rgba(249,115,22,0.12))] p-4 shadow-[0_20px_60px_-40px_rgba(249,115,22,0.55)]">
            <div className="flex items-center gap-3">
              <img
                src="/mini-espacio-logo.svg"
                alt="Mini Espacio"
                className="h-12 w-12 rounded-full object-cover ring-1 ring-white/10"
              />
              <div>
                <p className="text-sm font-semibold text-zinc-50">Mini Espacio</p>
                <p className="text-xs uppercase tracking-[0.22em] text-amber-100/80">
                  Entrenamiento personalizado
                </p>
              </div>
            </div>
          </section>

          {allowed.map(({ to, label, icon: Icon }) => (
            <Tooltip key={to}>
              <TooltipTrigger asChild>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    [
                      "group flex select-none items-center gap-10 rounded-xl border px-3 py-2 transition-all duration-200",
                      "border-white/5 bg-white/[0.03]",
                      "hover:border-amber-300/20 hover:bg-[linear-gradient(90deg,rgba(250,204,21,0.12),rgba(255,247,237,0.04),rgba(249,115,22,0.12))]",
                      "hover:shadow-[0_0_24px_-10px_rgba(249,115,22,0.5)]",
                      isActive
                        ? "border-amber-300/25 bg-[linear-gradient(90deg,rgba(250,204,21,0.16),rgba(255,247,237,0.07),rgba(249,115,22,0.16))] shadow-[0_0_28px_-12px_rgba(249,115,22,0.55)]"
                        : "",
                    ].join(" ")
                  }
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/5 group-hover:ring-amber-300/25">
                    <Icon size={18} />
                  </span>
                  <span className="text-sm font-medium text-zinc-100">{label}</span>
                </NavLink>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="border border-amber-200/10 bg-[#161210] text-zinc-100"
              >
                {label}
              </TooltipContent>
            </Tooltip>
          ))}
        </nav>

        <div className="space-y-4 px-4 pb-6">
          <section className="rounded-2xl border border-amber-200/10 bg-white/[0.035] p-4">
            <div className="mb-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                Atajos
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                Acciones de operación diaria
              </p>
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={() => navigate(role === "user" ? "/my-routine" : "/routines")}
                className="w-full justify-start border-amber-200/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]"
              >
                <Dumbbell className="h-4 w-4" />
                {role === "user" ? "Mi rutina" : "Ir a rutinas"}
              </Button>
              {role !== "user" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/clients")}
                    className="w-full justify-start border-amber-200/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]"
                  >
                    <Plus className="h-4 w-4" />
                    Gestionar clientes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/attendance")}
                    className="w-full justify-start border-amber-200/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]"
                  >
                    <Search className="h-4 w-4" />
                    Buscar y seguir
                  </Button>
                </>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(180deg,rgba(250,204,21,0.1),rgba(255,247,237,0.03),rgba(249,115,22,0.12))] p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-600">
              Contexto
            </p>
            <p className="mt-2 text-base font-semibold text-zinc-100">
              Vista {roleLabel(role)}
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              {role === "user"
                ? "Registrá tu avance, revisá tu rutina por día y seguí tu historial personal."
                : "Usá rutinas como punto de partida y movete rápido entre clientes, asistencias y seguimiento."}
            </p>
          </section>
        </div>
      </TooltipProvider>
    </aside>
  );
}
