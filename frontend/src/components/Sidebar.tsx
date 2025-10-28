import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, CreditCard, CalendarDays, BarChart3, Settings } from "lucide-react";

const linkBase =
  "flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted transition-colors";
const active =
  "bg-muted font-semibold";

export default function Sidebar() {
  const items = [
    { to: "/", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { to: "/clients", label: "Clientes", icon: <Users size={18} /> },
    { to: "/payments", label: "Pagos", icon: <CreditCard size={18} /> },
    { to: "/attendance", label: "Asistencias", icon: <CalendarDays size={18} /> },
    { to: "/reports", label: "Reportes", icon: <BarChart3 size={18} /> },
    { to: "/settings", label: "Ajustes", icon: <Settings size={18} /> },
  ];

  return (
    <aside className="w-64 shrink-0 border-r bg-background/50 backdrop-blur">
      <div className="p-4 text-lg font-bold">LibreFuncional</div>
      <nav className="p-2 space-y-1">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === "/"}
            className={({ isActive }) =>
              `${linkBase} ${isActive ? active : ""}`
            }
          >
            {it.icon}
            {it.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
