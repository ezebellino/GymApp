import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import type { JSX } from "react";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem("access_token");

  if (!token) return <Navigate to="/login" replace />;

  try {
    const { exp } = jwtDecode<{ exp: number }>(token);
    if (Date.now() >= exp * 1000) {
      localStorage.removeItem("access_token");
      return <Navigate to="/login" replace />;
    }
  } catch {
    localStorage.removeItem("access_token");
    return <Navigate to="/login" replace />;
  }

  return children;
}
