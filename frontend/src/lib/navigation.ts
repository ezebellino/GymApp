import {
  BarChart3,
  CalendarCheck2,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import type { FC } from "react";
import type { Role } from "@/types";

// Fuente única de la navegación del shell (dec. 3 de
// redesign-list-page-layout): antes el mismo par ruta/label vivía copiado en
// tres lugares (`Sidebar.tsx`, el menú mobile de `Topbar.tsx` y
// `SpotlightSearch`). Los dos consumidores del shell (`Sidebar` y el menú
// mobile de `Topbar`) usan `navItemsForRole` para el filtro por rol — antes
// vivía duplicado byte a byte en los dos archivos (hallazgo 11 de
// verification.md, dec. 23): un item owner-only agregado solo en uno de los
// dos se filtraba distinto en cada lugar, sin ningún test que lo detectara.
export type NavItem = {
  to: string;
  label: string;
  icon: FC<{ size?: number }>;
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/my-routine", label: "Mi rutina", icon: Dumbbell },
  { to: "/routines", label: "Rutinas", icon: Dumbbell },
  { to: "/users", label: "Usuarios", icon: Users },
  { to: "/attendance", label: "Asistencias", icon: CalendarCheck2 },
  { to: "/dashboard", label: "Seguimiento", icon: LayoutDashboard },
  { to: "/payments", label: "Pagos", icon: CreditCard },
  { to: "/reports", label: "Reportes", icon: BarChart3 },
  { to: "/settings", label: "Ajustes", icon: Settings },
];

// Filtro por rol: member solo ve "Mi rutina", el resto de roles no la ve, y
// "Reportes" es exclusivo de owner.
export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (role === "member") return item.to === "/my-routine";
    if (item.to === "/my-routine") return false;
    if (item.to === "/reports" && role !== "owner") return false;
    return true;
  });
}
