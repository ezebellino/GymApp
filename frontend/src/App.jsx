import { Routes, Route, Navigate } from "react-router-dom";
import Clients from "./pages/Clients";
import Payments from "./pages/Payments";
import Attendance from "./pages/Attendance";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";

export default function App() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/clients" />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
