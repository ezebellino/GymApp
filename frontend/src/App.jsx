import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sileo";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import { useSessionStore } from "./stores/session";
import { useSyncSettings } from "./services/settings.queries";
import { useLegacyRefetchBridge } from "./hooks/useLegacyRefetchBridge";
import "sileo/styles.css";
import "./index.css";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const Payments = lazy(() => import("./pages/Payments"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Routines = lazy(() => import("./pages/Routines"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Login = lazy(() => import("./pages/Login"));
const RegisterClient = lazy(() => import("./pages/RegisterClient"));
const NewCoachPage = lazy(() => import("./pages/NewCoach"));
const UserRoutine = lazy(() => import("./pages/UserRoutine"));

function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="rounded-2xl border border-amber-200/10 bg-zinc-900/70 px-5 py-4 text-sm text-zinc-300">
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

  // Único sincronizador servidor -> store de ajustes (dec. 12); el tema en sí
  // se aplica de forma sincrónica al crear `stores/settings.ts`, antes del
  // primer render, así que acá no hace falta nada más para el tema.
  useSyncSettings();
  // TODO(change siguiente): borrar junto con `NewPaymentDialog`/`UserCard`
  // cuando pasen a `useCreatePaymentMutation` (dec. 13).
  useLegacyRefetchBridge();

  return (
    <div className="app-shell-bg min-h-screen text-zinc-100">
      <Toaster position="top-right" theme="dark" />

      {!isAuthRoute && (
        <>
          <Sidebar />
          <Topbar />

          {/* pt-14/lg:pl-64 son offsets estructurales, no gutter de lectura: lg:pl-64
              compensa que Sidebar es `fixed` (no ocupa lugar en el flujo); pt-14
              compensa la altura de Topbar, que es `sticky` (sí ocupa lugar en el
              flujo). El gutter y el ancho máximo viven en el único contenedor de
              abajo (dec. D1), para que una vista nueva los herede sin tener que
              acordarse de nada. */}
          <main className="app-main-shell-bg min-h-screen pt-14 lg:pl-64">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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
        <main className="min-h-screen flex items-center justify-center bg-zinc-950">
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
