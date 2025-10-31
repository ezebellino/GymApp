// src/components/Sidebar.tsx
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  CalendarCheck2,
  BarChart3,
  Settings,
} from "lucide-react";
import { FC } from "react";

// shadcn/ui tooltip
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

type NavItem = {
  to: string;
  label: string;
  icon: FC<{ size?: number }>;
};

const items: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/payments", label: "Pagos", icon: CreditCard },
  { to: "/attendance", label: "Asistencias", icon: CalendarCheck2 },
  { to: "/reports", label: "Reportes", icon: BarChart3 },
  { to: "/settings", label: "Ajustes", icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-15 z-40 h-screen w-64 bg-zinc-900/80 border-r border-white/10 backdrop-blur-xl">
      <TooltipProvider delayDuration={80}>
        <nav className="p-4 space-y-4">
          {items.map(({ to, label, icon: Icon }) => (
            <Tooltip key={to}>
              <TooltipTrigger asChild>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    [
                      "group flex items-center gap-10 px-3 py-2 rounded-xl select-none",
                      "border transition-all duration-200",
                      "bg-zinc-900/40 border-white/5",
                      "hover:border-fuchsia-500/40 hover:bg-fuchsia-500/10",
                      "hover:shadow-[0_0_20px_2px_rgba(255,0,255,0.08)]",
                      isActive
                        ? "border-fuchsia-500/40 bg-fuchsia-500/10 shadow-[0_0_24px_4px_rgba(255,0,255,0.12)]"
                        : "",
                    ].join(" ")
                  }
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/60 ring-1 ring-inset ring-white/5 group-hover:ring-fuchsia-500/40">
                    <Icon size={18} />
                  </span>
                  <span className="text-sm font-medium">{label}</span>
                </NavLink>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-zinc-900 text-zinc-100 border border-white/10"
              >
                {label}
              </TooltipContent>
            </Tooltip>
          ))}
        </nav>
      </TooltipProvider>
    </aside>
  );
}
