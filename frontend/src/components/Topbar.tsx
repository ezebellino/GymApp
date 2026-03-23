import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  BarChart3,
  CalendarCheck2,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Role } from "@/types";

export default function Topbar() {
  const [role, setRole] = useState<Role>("coach");
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const openGlobalSearch = () => {
    const trigger = () => window.dispatchEvent(new Event("app:open-spotlight"));

    if (location.pathname !== "/dashboard") {
      navigate("/dashboard");
      window.setTimeout(trigger, 120);
      return;
    }

    trigger();
  };

  useEffect(() => {
    const storedRole = (localStorage.getItem("user_role") as Role) || null;
    const token = localStorage.getItem("access_token");

    if (storedRole) {
      setRole(storedRole);
    } else if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const nextRole =
          (payload.role as Role) || (payload?.user?.role as Role) || "coach";
        setRole(nextRole);
        localStorage.setItem("user_role", nextRole);
      } catch {
        setRole("coach");
      }
    } else {
      setRole("coach");
    }

    setIsAuthed(!!localStorage.getItem("access_token"));

    const onKey = (e: KeyboardEvent) => {
      const mod = navigator.platform.includes("Mac") ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openGlobalSearch();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [location.pathname]);

  const handleLogout = async () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    setIsAuthed(false);
    setMobileMenuOpen(false);

    await Swal.fire({
      title: "Sesión cerrada",
      text: "Serás redirigido al login.",
      icon: "success",
      timer: 1400,
      showConfirmButton: false,
      timerProgressBar: true,
    });

    navigate("/login", { replace: true });
  };

  const go = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-amber-200/10 bg-[#0d0c0b]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <img
            src="/mini-espacio-logo.svg"
            alt="Mini Espacio"
            className="h-9 w-auto object-contain"
          />
        </div>

        <div className="hidden flex-1 justify-center md:flex">
          <Button
            variant="outline"
            className="w-72 border-amber-200/10 bg-white/[0.03] text-amber-50 hover:border-amber-300/20 hover:bg-white/[0.06]"
            onClick={openGlobalSearch}
          >
            Buscar cliente (Ctrl/Cmd + K)
          </Button>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthed && role === "owner" && (
            <Button
              variant="outline"
              onClick={() => navigate("/clients")}
              className="border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.14),rgba(255,247,237,0.05),rgba(249,115,22,0.14))] text-amber-50 hover:bg-[linear-gradient(90deg,rgba(250,204,21,0.18),rgba(255,247,237,0.08),rgba(249,115,22,0.18))]"
            >
              <UserPlus className="h-4 w-4" />
              Nuevo cliente
            </Button>
          )}

          {isAuthed ? (
            <Button
              onClick={handleLogout}
              className="group relative overflow-hidden border border-amber-300/20 bg-[linear-gradient(90deg,#facc15_0%,#fff7ed_48%,#f97316_100%)] font-medium text-black shadow-[0_18px_45px_-28px_rgba(249,115,22,0.55)] hover:opacity-95"
            >
              <span className="relative z-10 flex items-center gap-2">
                <LogOut size={16} />
                Logout
              </span>
              <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-white/40 transition-transform duration-700 ease-out group-hover:translate-x-full" />
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => navigate("/login")}
              className="border-amber-200/10 text-amber-50 hover:bg-white/[0.06]"
            >
              Iniciar sesión
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {isAuthed ? (
            <Button
              variant="outline"
              size="icon"
              className="border-amber-200/10 bg-white/[0.04] text-zinc-100"
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="border-amber-200/10 text-xs text-zinc-100"
              onClick={() => navigate("/login")}
            >
              Login
            </Button>
          )}
        </div>
      </div>

      {mobileMenuOpen && isAuthed && (
        <div className="space-y-3 border-t border-amber-200/10 bg-[#120f0d]/95 px-4 pb-3 pt-2 md:hidden">
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start border-amber-200/10 bg-white/[0.04] text-sm text-zinc-100 hover:bg-white/[0.08]"
              onClick={() => go("/dashboard")}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-amber-200/10 bg-white/[0.04] text-sm text-zinc-100 hover:bg-white/[0.08]"
              onClick={() => go("/clients")}
            >
              <Users className="mr-2 h-4 w-4" />
              Clientes
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-amber-200/10 bg-white/[0.04] text-sm text-zinc-100 hover:bg-white/[0.08]"
              onClick={() => go("/payments")}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Pagos
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-amber-200/10 bg-white/[0.04] text-sm text-zinc-100 hover:bg-white/[0.08]"
              onClick={() => go("/attendance")}
            >
              <CalendarCheck2 className="mr-2 h-4 w-4" />
              Asistencias
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-amber-200/10 bg-white/[0.04] text-sm text-zinc-100 hover:bg-white/[0.08]"
              onClick={() => go("/routines")}
            >
              <Dumbbell className="mr-2 h-4 w-4" />
              Rutinas
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-amber-200/10 bg-white/[0.04] text-sm text-zinc-100 hover:bg-white/[0.08]"
              onClick={() => go("/settings")}
            >
              <Settings className="mr-2 h-4 w-4" />
              Ajustes
            </Button>
            {role === "owner" && (
              <Button
                variant="outline"
                className="w-full justify-start border-amber-200/10 bg-white/[0.04] text-sm text-zinc-100 hover:bg-white/[0.08]"
                onClick={() => go("/reports")}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Reportes
              </Button>
            )}
          </div>

          {role === "owner" && (
            <Button
              variant="outline"
              className="w-full justify-start border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.14),rgba(255,247,237,0.05),rgba(249,115,22,0.14))] text-sm text-amber-50 hover:opacity-95"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate("/clients");
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Nuevo cliente
            </Button>
          )}

          <Button
            className="w-full justify-start border border-amber-300/25 bg-[linear-gradient(90deg,#facc15_0%,#fff7ed_48%,#f97316_100%)] text-sm text-black hover:opacity-95"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      )}
    </header>
  );
}
