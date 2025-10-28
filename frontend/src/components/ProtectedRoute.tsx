import { Navigate } from "react-router-dom";
import { JSX } from "react/jsx-runtime";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem("access_token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
