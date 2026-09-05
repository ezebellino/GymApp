import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sileo";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { useSessionStore } from "./stores/session";
import { useThemeStore } from "./stores/theme";
import { useSyncSettings } from "./services/settings.queries";
import { useSyncUserTheme } from "./services/me.queries";
import { useLegacyRefetchBridge } from "./hooks/useLegacyRefetchBridge";
import { routeImporters } from "./lib/routePreload";
import "sileo/styles.css";
import "./index.css";

// Los 8 lazy() de abajo con ruta propia en el Sidebar usan `routeImporters`
// (misma factory), así el sidebar puede precargar el chunk en hover/focus sin
// duplicar el specifier del import dinámico en dos archivos. Login/Invitacion/
// NewCoach/UserDetail no tienen entrada ahí (no se navegan desde el sidebar).
const Dashboard = lazy(routeImporters["/dashboard"]);
const Users = lazy(routeImporters["/users"]);
const Payments = lazy(routeImporters["/payments"]);
const Attendance = lazy(routeImporters["/attendance"]);
const Routines = lazy(routeImporters["/routines"]);
const Reports = lazy(routeImporters["/reports"]);
const Settings = lazy(routeImporters["/settings"]);
const UserRoutine = lazy(routeImporters["/my-routine"]);
const Login = lazy(() => import("./pages/Login"));
const InvitationAccept = lazy(() => import("./pages/InvitationAccept"));
const NewCoachPage = lazy(() => import("./pages/NewCoach"));
const UserDetail = lazy(() => import("./pages/UserDetail"));

// Widget de cambio de rol, solo en desarrollo (`add-dev-role-switcher`, dec. 1).
// El ternario va a nivel de módulo a propósito: en `npm run build` Vite
// reemplaza `import.meta.env.DEV` por `false` antes de que Rollup optimice, el
// `import()` queda inalcanzable y nada de la carpeta `dev/` (ni las
// credenciales que contiene) entra al bundle. NO cambiar por un `lazy()`
// incondicional con guarda en el render: ese chunk sobrevive al build.
const DevRoleSwitcher = import.meta.env.DEV
  ? lazy(() => import("./components/dev/DevRoleSwitcher"))
  : null;

function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="rounded-xl border border-border bg-surface-1/70 px-5 py-4 text-sm text-muted-foreground">
        Cargando vista...
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isAuthRoute =
    location.pathname.startsWith("/login") || location.pathname.startsWith("/invitacion");
  const role = useSessionStore((s) => s.role);
  const themeMode = useThemeStore((s) => s.mode);

  // Único sincronizador servidor -> store de ajustes (dec. 12).
  useSyncSettings();
  // Único sincronizador servidor -> store de tema (dec. 5.2): el modo en sí
  // ya se aplica de forma sincrónica al importar `stores/theme.ts`, antes del
  // primer render (caché local); esto lo actualiza apenas responde
  // `/auth/me`, que es la fuente autoritativa.
  useSyncUserTheme();
  // TODO(change siguiente): borrar junto con `NewPaymentDialog`/`UserCard`
  // cuando pasen a `useCreatePaymentMutation` (dec. 13).
  useLegacyRefetchBridge();

  return (
    <div className="app-shell-bg min-h-screen text-foreground">
      <Toaster position="top-right" theme={themeMode} />

      {/* Fuera del split `isAuthRoute`: el widget también se ve en /login. */}
      {DevRoleSwitcher && (
        <Suspense fallback={null}>
          <DevRoleSwitcher />
        </Suspense>
      )}

      {!isAuthRoute && (
        <>
          <Sidebar />
          <Topbar />

          {/* lg:pl-sidebar compensa que Sidebar es `fixed` (no ocupa lugar en el
              flujo). Topbar es `sticky`, no `fixed`: sí ocupa su alto (`h-topbar`)
              en el flujo normal del documento, así que `main` no necesita (ni debe
              llevar) un padding-top que lo compense — sumarlo dejaría una banda
              muerta del alto del Topbar arriba del contenido. `min-h-[...]`
              descuenta ese mismo alto para que el piso del documento sea
              exactamente el viewport (100dvh) y no viewport + Topbar. El gutter y
              el ancho máximo viven en el único contenedor de abajo (dec. D1), para
              que una vista nueva los herede sin tener que acordarse de nada. */}
          <main className="app-main-shell-bg min-h-[calc(100dvh-var(--spacing-topbar))] lg:pl-sidebar">
            <div className="app-container py-page-y">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Navigate to={role === "member" ? "/my-routine" : "/dashboard"} replace />} />
                  <Route
                    path="/my-routine"
                    element={
                      <ProtectedRoute roles={["member"]}>
                        <UserRoutine />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute roles={["owner", "coach"]}>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/users"
                    element={
                      <ProtectedRoute roles={["owner", "coach"]}>
                        <Users />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/clients" element={<Navigate to="/users" replace />} />
                  <Route
                    path="/users/:id"
                    element={
                      <ProtectedRoute roles={["owner", "coach"]}>
                        <UserDetail />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/payments"
                    element={
                      <ProtectedRoute roles={["owner", "coach"]}>
                        <Payments />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/attendance"
                    element={
                      <ProtectedRoute roles={["owner", "coach"]}>
                        <Attendance />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/routines"
                    element={
                      <ProtectedRoute roles={["owner", "coach"]}>
                        <Routines />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <ProtectedRoute roles={["owner", "coach"]}>
                        <Reports />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute roles={["owner", "coach"]}>
                        <Settings />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/coaches/new"
                    element={
                      <ProtectedRoute roles={["owner"]}>
                        <NewCoachPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to={role === "member" ? "/my-routine" : "/dashboard"} replace />} />
                </Routes>
              </Suspense>
            </div>
          </main>
        </>
      )}

      {isAuthRoute && (
        <main className="min-h-screen flex items-center justify-center bg-canvas">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/invitacion/:channel/:token" element={<InvitationAccept />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </main>
      )}
    </div>
  );
}
