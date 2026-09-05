import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarCheck2,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  Menu,
  Moon,
  Settings,
  Sun,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Role } from "@/types";
import { useSessionStore } from "@/stores/session";
import { useThemeStore } from "@/stores/theme";
import { THEME_MODES } from "@/lib/theme";
import { useUpdateMyThemeMutation } from "@/services/me.queries";
import { alertError } from "@/lib/alerts";

const outlineButtonClass =
  "border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70";
const mobileNavButtonClass =
  "w-full justify-start border-border bg-surface-2/40 text-foreground hover:bg-surface-2/70";

export default function Topbar() {
  const token = useSessionStore((s) => s.token);
  const storeRole = useSessionStore((s) => s.role);
  const role: Role = storeRole ?? "coach";
  const isAuthed = !!token;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const updateMyThemeMutation = useUpdateMyThemeMutation();

  const isDark = themeMode === "dark";
  // Estado, no acción: un lector de pantalla anuncia "Modo Oscuro, presionado" /
  // "Modo Claro, no presionado" -- coherente con `aria-pressed`, a diferencia de
  // un label de acción ("Cambiar a modo claro") que junto con `aria-pressed`
  // sonaba contradictorio (hallazgo de verification.md, adopt-kinetic-obsidian-theme).
  const currentThemeLabel =
    THEME_MODES.find((m) => m.id === themeMode)?.label ?? themeMode;
  const themeToggleAriaLabel = `Modo ${currentThemeLabel}`;

  // Se aplica al instante (setMode ya aplica + cachea via `stores/theme.ts`) y
  // se manda el PATCH en paralelo. Si el PATCH falla, el modo queda aplicado
  // igual (dec. 7 y 11 del design): revertirle el tema en la cara al usuario
  // es peor que una preferencia que no viajo, asi que no hay rollback visual.
  const handleToggleTheme = () => {
    const nextMode = isDark ? "light" : "dark";
    setThemeMode(nextMode);
    updateMyThemeMutation.mutate(nextMode, {
      onError: () => {
        alertError(
          "No se pudo guardar el tema",
          "El modo se aplico en este dispositivo, pero no se pudo sincronizar con tu cuenta."
        );
      },
    });
  };

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
    const onKey = (e: KeyboardEvent) => {
      if (role === "user") return;
      const mod = navigator.platform.includes("Mac") ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openGlobalSearch();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [location.pathname, role]);

  const go = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface-1/70 backdrop-blur-xl lg:pl-sidebar">
      <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 lg:hidden">
          <img
            src="/mini-espacio-logo.svg"
            alt="Mini Espacio"
            className="h-9 w-auto object-contain"
          />
        </div>

        {role !== "user" && (
          <div className="hidden flex-1 justify-center lg:flex">
            <Button
              variant="outline"
              className={`w-72 ${outlineButtonClass}`}
              onClick={openGlobalSearch}
            >
              Buscar cliente (Ctrl/Cmd + K)
            </Button>
          </div>
        )}

        <div className="hidden items-center gap-3 lg:flex">
          {isAuthed && (
            <Button
              variant="outline"
              size="icon"
              className={outlineButtonClass}
              onClick={handleToggleTheme}
              aria-label={themeToggleAriaLabel}
              aria-pressed={isDark}
            >
              {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          )}

          {!isAuthed && (
            <Button variant="outline" onClick={() => navigate("/login")}>
              Iniciar sesión
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          {isAuthed ? (
            <Button
              variant="outline"
              size="icon"
              className={outlineButtonClass}
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate("/login")}>
              Login
            </Button>
          )}
        </div>
      </div>

      {mobileMenuOpen && isAuthed && (
        <div className="space-y-3 border-t border-border bg-surface-1/95 px-4 pb-3 pt-2 lg:hidden">
          <Button
            variant="outline"
            size="icon"
            className={outlineButtonClass}
            onClick={handleToggleTheme}
            aria-label={themeToggleAriaLabel}
            aria-pressed={isDark}
          >
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>

          <div className="space-y-2">
            {role === "user" ? (
              <Button
                variant="outline"
                className={mobileNavButtonClass}
                onClick={() => go("/my-routine")}
              >
                <Dumbbell className="mr-2 h-4 w-4" />
                Mi rutina
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  className={mobileNavButtonClass}
                  onClick={() => go("/dashboard")}
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
                <Button
                  variant="outline"
                  className={mobileNavButtonClass}
                  onClick={() => go("/clients")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Clientes
                </Button>
                <Button
                  variant="outline"
                  className={mobileNavButtonClass}
                  onClick={() => go("/payments")}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pagos
                </Button>
                <Button
                  variant="outline"
                  className={mobileNavButtonClass}
                  onClick={() => go("/attendance")}
                >
                  <CalendarCheck2 className="mr-2 h-4 w-4" />
                  Asistencias
                </Button>
                <Button
                  variant="outline"
                  className={mobileNavButtonClass}
                  onClick={() => go("/routines")}
                >
                  <Dumbbell className="mr-2 h-4 w-4" />
                  Rutinas
                </Button>
                <Button
                  variant="outline"
                  className={mobileNavButtonClass}
                  onClick={() => go("/settings")}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Ajustes
                </Button>
                {role === "owner" && (
                  <Button
                    variant="outline"
                    className={mobileNavButtonClass}
                    onClick={() => go("/reports")}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Reportes
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
