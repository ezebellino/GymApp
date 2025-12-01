// src/components/Topbar.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  UserPlus,
  Menu,
  X,
  LayoutDashboard,
  Users,
  CreditCard,
  CalendarCheck2,
  Settings,
  BarChart3,
} from "lucide-react";
import SpotlightSearch from "./SpotlightSearch";
import type { Role } from "@/types";

export default function Topbar() {
  const [open, setOpen] = useState(false); // Spotlight
  const [role, setRole] = useState<Role>("coach");
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // menú hamburguesa

  const navigate = useNavigate();

  useEffect(() => {
    const storedRole = (localStorage.getItem("user_role") as Role) || null;
    const token = localStorage.getItem("access_token");

    if (storedRole) {
      setRole(storedRole);
    } else if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const r =
          (payload.role as Role) ||
          (payload?.user?.role as Role) ||
          "coach";
        setRole(r);
        localStorage.setItem("user_role", r);
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
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLogin = () => {
    navigate("/login");
  };

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

  // helper para navegar desde el menú mobile
  const go = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur">
      <div className="mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo izquierda */}
        <div className="flex items-center gap-3">
          <img
            src="/LogoLibreFuncional.png"
            alt="Libre Funcional"
            className="h-8 w-auto object-contain"
          />
        </div>

        {/* Centro: Spotlight trigger SOLO desktop */}
        <div className="hidden md:flex flex-1 justify-center">
          <Button
            variant="outline"
            className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 w-72 text-sm"
            onClick={() => setOpen(true)}
          >
            Buscar cliente (Ctrl/⌘+K)
          </Button>
        </div>

        {/* Derecha: botones SOLO desktop */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthed && role === "owner" && (
            <Button
              variant="outline"
              onClick={() => navigate("/coaches/new")}
              className="border-violet-400/60 text-violet-100 bg-violet-500/10 hover:bg-violet-500/20 text-xs sm:text-sm"
            >
              <UserPlus className="h-4 w-4" />
              + Nuevo coach
            </Button>
          )}

          {isAuthed ? (
            <Button
              onClick={handleLogout}
              className="group relative overflow-hidden bg-linear-to-r from-fuchsia-500 to-cyan-400 text-black font-medium shadow-md hover:opacity-95"
            >
              <span className="relative z-10 flex items-center gap-2">
                <LogOut size={16} />
                Logout
              </span>
              <span
                className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-white/40 transition-transform duration-700 ease-out group-hover:translate-x-full"
              />
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleLogin}
              className="border-zinc-700 hover:bg-zinc-800"
            >
              Iniciar sesión
            </Button>
          )}
        </div>

        {/* Mobile: solo botón hamburguesa */}
        <div className="flex items-center gap-2 md:hidden">
          {isAuthed ? (
            <Button
              variant="outline"
              size="icon"
              className="border-zinc-700 bg-zinc-900/80"
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
              className="border-zinc-700 text-xs"
              onClick={handleLogin}
            >
              Login
            </Button>
          )}
        </div>
      </div>

      {/* Menú desplegable mobile = mini sidebar */}
      {mobileMenuOpen && isAuthed && (
        <div className="md:hidden border-t border-zinc-800 bg-zinc-950/95 px-4 pb-3 pt-2 space-y-3">
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm"
              onClick={() => go("/dashboard")}
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm"
              onClick={() => go("/clients")}
            >
              <Users className="h-4 w-4 mr-2" />
              Clientes
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm"
              onClick={() => go("/payments")}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Pagos
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm"
              onClick={() => go("/attendance")}
            >
              <CalendarCheck2 className="h-4 w-4 mr-2" />
              Asistencias
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm"
              onClick={() => go("/settings")}
            >
              <Settings className="h-4 w-4 mr-2" />
              Ajustes
            </Button>

            {/* Reportes solo owner */}
            {role === "owner" && (
              <Button
                variant="outline"
                className="w-full justify-start border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm"
                onClick={() => go("/reports")}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Reportes
              </Button>
            )}
          </div>

          {/* Acciones especiales */}
          {role === "owner" && (
            <Button
              variant="outline"
              className="w-full justify-start border-violet-400/60 bg-violet-500/10 hover:bg-violet-500/20 text-sm text-violet-100"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate("/coaches/new");
              }}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              + Nuevo coach
            </Button>
          )}

          <Button
            className="w-full justify-start bg-linear-to-r from-fuchsia-500 to-cyan-400 text-black text-sm"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      )}

      {/* Spotlight global (se sigue pudiendo abrir con Ctrl/⌘+K) */}
      <SpotlightSearch open={open} onOpenChange={setOpen} viewerRole={role} />
    </header>
  );
}
