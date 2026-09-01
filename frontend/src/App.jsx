import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import { syncThemeFromSettings } from "./lib/theme";
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
  const role = localStorage.getItem("user_role");

  useEffect(() => {
    syncThemeFromSettings();

    const handleThemeUpdate = () => {
      syncThemeFromSettings();
    };

    window.addEventListener("app-settings:updated", handleThemeUpdate);

    return () => {
      window.removeEventListener("app-settings:updated", handleThemeUpdate);
    };
  }, []);

  return (
    <div className="app-shell-bg min-h-screen text-zinc-100">
      {!isAuthRoute && (
        <>
          <Sidebar />
          <Topbar />

          <main className="app-main-shell-bg min-h-screen px-4 pb-6 pt-14 lg:pl-64">
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
