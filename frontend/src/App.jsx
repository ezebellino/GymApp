import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Clients from "./pages/Clients";
import Payments from "./pages/Payments";
import Attendance from "./pages/Attendance";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import Topbar from "./components/Topbar";
import Footer from "./components/Footer";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import NewCoachPage from "./pages/NewCoach";
import "./index.css";

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
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
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
            <Footer />
          </main>
        </>
      )}

      {isAuthRoute && (
        <main className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.08),transparent_22%),linear-gradient(180deg,#0b0b0b_0%,#12100d_54%,#1b140e_100%)]">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      )}
    </div>
  );
}
