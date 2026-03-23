import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import "./index.css";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const Payments = lazy(() => import("./pages/Payments"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Routines = lazy(() => import("./pages/Routines"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Login = lazy(() => import("./pages/Login"));
const NewCoachPage = lazy(() => import("./pages/NewCoach"));

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
  const isAuthRoute = location.pathname.startsWith("/login");

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-zinc-100">
      {!isAuthRoute && (
        <>
          <Sidebar />
          <Topbar />

          <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.08),transparent_20%),linear-gradient(180deg,#0b0b0b_0%,#12100d_54%,#1b140e_100%)] px-4 pb-6 pt-14 lg:pl-64">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clients"
                  element={
                    <ProtectedRoute>
                      <Clients />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/payments"
                  element={
                    <ProtectedRoute>
                      <Payments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/attendance"
                  element={
                    <ProtectedRoute>
                      <Attendance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/routines"
                  element={
                    <ProtectedRoute>
                      <Routines />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute>
                      <Reports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
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
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
            <Footer />
          </main>
        </>
      )}

      {isAuthRoute && (
        <main className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.08),transparent_22%),linear-gradient(180deg,#0b0b0b_0%,#12100d_54%,#1b140e_100%)]">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </main>
      )}
    </div>
  );
}
