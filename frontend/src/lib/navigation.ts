import {
  BarChart3,
  CalendarCheck2,
  CreditCard,
  Dumbbell,
  Home,
  LineChart,
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
  icon: FC<{ size?: number; className?: string }>;
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/my-routine", label: "Mi rutina", icon: Dumbbell },
  { to: "/dashboard", label: "Inicio", icon: Home },
  { to: "/routines", label: "Rutinas", icon: Dumbbell },
  { to: "/users", label: "Usuarios", icon: Users },
  { to: "/attendance", label: "Asistencias", icon: CalendarCheck2 },
  { to: "/tracking", label: "Seguimiento", icon: LineChart },
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

// Única definición de "vista pública" del repo (`secure-staff-endpoints`, dec. D5):
// antes el mismo par de prefijos vivía copiado inline en `App.jsx` y faltaba en
// `lib/http.ts`, así que agregar una vista pública nueva se arreglaba en un lado y
// se rompía en el otro. La consumen `App.jsx` (split de layout autenticado/público)
// y `lib/http.ts` (para no toastear "sesión expirada" con un 401 de fondo en estas
// rutas).
export const PUBLIC_ROUTE_PREFIXES = ["/login", "/invitacion"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
