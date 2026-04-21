import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import type { JSX } from "react";

type Role = "owner" | "coach" | "user";

type Props = {
  children: JSX.Element;
  roles?: Role[];
};

export default function ProtectedRoute({ children, roles }: Props) {
  const token = localStorage.getItem("access_token");
  const currentRole = (localStorage.getItem("user_role") as Role | null) ?? null;

  if (!token) return <Navigate to="/login" replace />;

  try {
    const { exp, role } = jwtDecode<{ exp: number; role?: Role }>(token);
    if (Date.now() >= exp * 1000) {
      localStorage.removeItem("access_token");
      return <Navigate to="/login" replace />;
    }
    const effectiveRole = currentRole ?? role ?? "coach";
    if (roles?.length && !roles.includes(effectiveRole)) {
      return <Navigate to={effectiveRole === "user" ? "/my-routine" : "/dashboard"} replace />;
    }
  } catch {
    localStorage.removeItem("access_token");
    return <Navigate to="/login" replace />;
  }

  return children;
}
