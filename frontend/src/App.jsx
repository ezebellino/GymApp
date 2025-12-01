// src/App.jsx
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Clients from "./pages/Clients";
import Payments from "./pages/Payments";
import Attendance from "./pages/Attendance";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import Topbar from "./components/Topbar";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import NewCoachPage from "./pages/NewCoach";
import "./index.css";

export default function App() {
  const location = useLocation();
  const isAuthRoute = location.pathname.startsWith("/login");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* LAYOUT PRIVADO */}
      {!isAuthRoute && (
        <>
          {/* Sidebar fija a la izquierda */}
          <Sidebar />
          {/* Topbar fija arriba */}
          <Topbar />

          {/* Contenido: 
        - siempre compensa la Topbar con pt-16
        - solo compensa Sidebar en md+ con md:pl-64
    */}
          <main
            className="
              min-h-screen
              pt-14                 /* espacio para el topbar */
              px-4 pb-6
              lg:pl-64              /* 👈 sólo desde lg compensamos sidebar */
              bg-linear-to-b from-zinc-950 via-zinc-950 to-zinc-900
            "
          >
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
            </Routes>
          </main>
        </>
      )}

      {/* LAYOUT AUTH (sin sidebar/topbar) */}
      {isAuthRoute && (
        <main className="min-h-screen flex items-center justify-center bg-zinc-950">
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* fallback: si entra a cualquier otra, mandalo a /login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      )}
    </div>
  );
}
