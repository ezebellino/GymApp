import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, UserRound } from "lucide-react";
import { useSessionStore } from "@/stores/session";
import { preloadRoute } from "@/lib/routePreload";
import { navItemsForRole } from "@/lib/navigation";

function roleLabel(role: string) {
  if (role === "owner") return "Dueño";
  if (role === "coach") return "Coach";
  return "Usuario";
}

export default function Sidebar() {
  const role = useSessionStore((s) => s.role) ?? "coach";
  const userName = useSessionStore((s) => s.userName);
  const email = useSessionStore((s) => s.email);
  const logout = useSessionStore((s) => s.logout);
  const navigate = useNavigate();
  const allowed = navItemsForRole(role);

  // Único punto de logout del shell (dec.: se sacó del Topbar, que solo lo
  // tenía duplicado). Limpia sesión y redirige directo, sin alerta
  // intermedia: no hay nada que confirmar ni de qué avisar.
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="subtle-scrollbar fixed left-0 top-0 z-40 hidden h-screen w-sidebar flex-col justify-between overflow-y-auto border-r border-border bg-surface-1/70 backdrop-blur-xl lg:flex">
      <div>
        {/* Padding propio, sin alto fijo ni borde inferior (dec. 16 y 17 de
            redesign-list-page-layout): el dueño pidió sacar la línea
            divisoria horizontal que antes calzaba con el borde inferior del
            Topbar (dec. 2, ya revertida) y que la placa recupere margen
            superior en vez de quedar pegada al borde del viewport.
            `--spacing-topbar` sigue existiendo, pero ya no gobierna esta
            banda — solo el alto del Topbar (`Topbar.tsx`) y, a través de
            `--list-page-height`, el alto de una `ListPageLayout`. */}
        <div className="px-4 pt-4 pb-2">
          <section className="warm-accent-bg warm-glow flex w-full items-center gap-3 rounded-xl border border-border p-3.5">
            <img
              src="/mini-espacio-logo.svg"
              alt="Gym App"
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-foreground">
                Gym App
              </p>
              <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-primary-strong/70">
                Entrenamiento personalizado
              </p>
            </div>
          </section>
        </div>

        <nav className="space-y-1.5 p-4" aria-label="Navegación principal">
          {allowed.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onMouseEnter={() => preloadRoute(to)}
              onFocus={() => preloadRoute(to)}
              className={({ isActive }) =>
                [
                  "group flex select-none items-center gap-3 rounded-xl border border-transparent px-3.5 py-2.5 transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:border-border hover:bg-surface-2/60 hover:text-foreground",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    className={isActive ? "" : "text-muted-foreground/80 group-hover:text-primary"}
                  />
                  <span className={isActive ? "text-sm font-semibold" : "text-sm font-medium"}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="space-y-3 px-4 pb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1.5 text-label-caps uppercase text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          Vista {roleLabel(role)}
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-1/70 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-primary-strong">
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
          <button
            type="button"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            onClick={handleLogout}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-destructive"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
