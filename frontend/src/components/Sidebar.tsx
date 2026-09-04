import { NavLink } from "react-router-dom";
import {
  BarChart3,
  CalendarCheck2,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import type { FC } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSessionStore } from "@/stores/session";

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
  const role = useSessionStore((s) => s.role) ?? "coach";
  const userName = useSessionStore((s) => s.userName);
  const email = useSessionStore((s) => s.email);
  const allowed = items.filter((item) => {
    if (role === "user") return item.to === "/my-routine";
    if (item.to === "/my-routine") return false;
    if (item.to === "/reports" && role !== "owner") return false;
    return true;
  });

  return (
    <aside className="subtle-scrollbar fixed left-0 top-0 z-40 hidden h-screen w-sidebar flex-col overflow-y-auto border-r border-border bg-surface-1/70 backdrop-blur-xl lg:flex">
      <TooltipProvider delayDuration={80}>
        <nav className="space-y-4 p-4">
          <section className="warm-accent-bg warm-glow rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <img
                src="/mini-espacio-logo.svg"
                alt="Mini Espacio"
                className="h-12 w-12 rounded-full object-cover ring-1 ring-border"
              />
              <div>
                <p className="text-sm font-semibold text-foreground">Mini Espacio</p>
                <p className="text-xs uppercase tracking-[0.22em] text-primary/70">
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
                      "group flex select-none items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-200",
                      "border-border bg-surface-2/40",
                      "hover:border-primary/30 hover:bg-surface-2/70",
                      isActive ? "warm-glow border-primary/40 bg-surface-2 text-primary" : "",
                    ].join(" ")
                  }
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 ring-1 ring-inset ring-border group-hover:ring-primary/30">
                    <Icon size={18} />
                  </span>
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right" className="border border-border bg-surface-1 text-foreground">
                {label}
              </TooltipContent>
            </Tooltip>
          ))}
        </nav>

        <div className="space-y-3 px-4 pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1.5 text-label-caps uppercase text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            Vista {roleLabel(role)}
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-1/70 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary">
              <UserRound size={18} />
            </div>
            <div className="min-w-0">
              <p
                className="truncate text-sm font-medium text-foreground"
                title={userName ?? undefined}
              >
                {userName ?? "Usuario"}
              </p>
              {email ? (
                <p className="truncate text-xs text-muted-foreground" title={email}>
                  {email}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </TooltipProvider>
    </aside>
  );
}
