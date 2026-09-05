import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sileo";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Footer from "./components/Footer";
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
// duplicar el specifier del import dinámico en dos archivos. Login/Register/
// NewCoach no tienen entrada ahí (no se navegan desde el sidebar).
const Dashboard = lazy(routeImporters["/dashboard"]);
const Clients = lazy(routeImporters["/clients"]);
const Payments = lazy(routeImporters["/payments"]);
const Attendance = lazy(routeImporters["/attendance"]);
const Routines = lazy(routeImporters["/routines"]);
const Reports = lazy(routeImporters["/reports"]);
const Settings = lazy(routeImporters["/settings"]);
const UserRoutine = lazy(routeImporters["/my-routine"]);
const Login = lazy(() => import("./pages/Login"));
const RegisterClient = lazy(() => import("./pages/RegisterClient"));
const NewCoachPage = lazy(() => import("./pages/NewCoach"));

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
    location.pathname.startsWith("/login") || location.pathname.startsWith("/register-client");
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

      {!isAuthRoute && (
        <>
          <Sidebar />
          <Topbar />

          {/* pt-14/lg:pl-sidebar son offsets estructurales, no gutter de lectura: lg:pl-sidebar
              compensa que Sidebar es `fixed` (no ocupa lugar en el flujo); pt-14
              compensa la altura de Topbar, que es `sticky` (sí ocupa lugar en el
              flujo). El gutter y el ancho máximo viven en el único contenedor de
              abajo (dec. D1), para que una vista nueva los herede sin tener que
              acordarse de nada. */}
          <main className="app-main-shell-bg min-h-screen pt-14 lg:pl-sidebar">
            <div className="mx-auto w-full max-w-[var(--container-app)] px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Navigate to={role === "user" ? "/my-routine" : "/dashboard"} replace />} />
                  <Route
                    path="/my-routine"
                    element={
                      <ProtectedRoute roles={["user"]}>
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
                    path="/clients"
                    element={
                      <ProtectedRoute roles={["owner", "coach"]}>
                        <Clients />
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
                  <Route path="*" element={<Navigate to={role === "user" ? "/my-routine" : "/dashboard"} replace />} />
                </Routes>
              </Suspense>
            </div>
            <Footer />
          </main>
        </>
      )}

      {isAuthRoute && (
        <main className="min-h-screen flex items-center justify-center bg-canvas">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register-client" element={<RegisterClient />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </main>
      )}
    </div>
  );
}
