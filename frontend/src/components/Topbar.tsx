// src/components/Topbar.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import SpotlightSearch from "./SpotlightSearch";
import type { Role } from "@/types";

export default function Topbar() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("coach");
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const navigate = useNavigate();

  // Hotkey Ctrl/⌘+K
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
    // Limpio credenciales primero
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
      didOpen: () => {
        const b = Swal.getHtmlContainer()?.querySelector("b");
        if (b) b.textContent = "";
      },
    });

    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/70 backdrop-blur">
      <div className="mx-auto flex h-14 items-center justify-between px-4">
        {/* Izquierda: Logo */}
        <div className="flex items-center gap-3">
          <img
            src="/src/assets/LogoLibreFuncional.png"
            alt="Libre Funcional"
            className="h-8 w-auto object-contain"
          />
        </div>

        {/* Centro: Trigger del Spotlight */}
        <div className="flex-1 flex justify-center">
          <Button
            variant="outline"
            className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 w-72 text-sm"
            onClick={() => setOpen(true)}
          >
            Buscar cliente (Ctrl/⌘+K)
          </Button>
        </div>

        {/* Derecha: Login / Logout */}
        <div className="flex items-center gap-3">
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
              {/* Shine */}
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
