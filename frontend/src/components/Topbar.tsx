// src/components/Topbar.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { LogOut, UserPlus } from "lucide-react";
import SpotlightSearch from "./SpotlightSearch";
import type { Role } from "@/types";

export default function Topbar() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("coach");
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const storedRole = (localStorage.getItem("user_role") as Role) || "coach";
    setRole(storedRole);
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

  const handleNewCoach = async () => {
    // Por ahora stub. Más adelante podés navegar a /coaches/new
    // navigate("/coaches/new");
    await Swal.fire({
      title: "Nuevo coach",
      text: "Acá vas a poder crear y gestionar coaches. Próximamente ✨",
      icon: "info",
      confirmButtonText: "Cerrar",
    });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur">
      <div className="mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo izquierda */}
        <div className="flex items-center gap-3">
          <img
            src="/src/assets/LogoLibreFuncional.png"
            alt="Libre Funcional"
            className="h-8 w-auto object-contain"
          />
        </div>

        {/* Centro: Spotlight trigger */}
        <div className="flex-1 flex justify-center">
          <Button
            variant="outline"
            className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 w-72 text-sm"
            onClick={() => setOpen(true)}
          >
            Buscar cliente (Ctrl/⌘+K)
          </Button>
        </div>

        {/* Derecha */}
        <div className="flex items-center gap-3">
          {/* Solo owner: botón Nuevo coach */}
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

          {/* Login / Logout */}
          {isAuthed ? (
            <Button
              onClick={handleLogout}
              className="
                group relative overflow-hidden
                bg-linear-to-r from-fuchsia-500 to-cyan-400
                text-black font-medium shadow-md hover:opacity-95
              "
            >
              <span className="relative z-10 flex items-center gap-2">
                <LogOut size={16} />
                Logout
              </span>
              <span
                className="
                  pointer-events-none absolute inset-0
                  -translate-x-full skew-x-12
                  bg-white/40
                  transition-transform duration-700 ease-out
                  group-hover:translate-x-full
                "
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
      </div>

      <SpotlightSearch open={open} onOpenChange={setOpen} viewerRole={role} />
    </header>
  );
}
