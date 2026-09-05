import { Navigate } from "react-router-dom";
import type { JSX } from "react";
import { useSessionStore } from "@/stores/session";
import type { Role } from "@/types";

type Props = {
  children: JSX.Element;
  roles?: Role[];
};

export default function ProtectedRoute({ children, roles }: Props) {
  const token = useSessionStore((s) => s.token);
  const role = useSessionStore((s) => s.role);
  const exp = useSessionStore((s) => s.exp);

  if (!token) return <Navigate to="/login" replace />;

  // El auto-logout del store ya se encarga de limpiar una sesión vencida (ver
  // stores/session.ts), pero este chequeo cubre la ventana entre que el token
  // vence y el timer dispara. No se llama a `logout()` acá: hacerlo durante el
  // render dispararía un `setState` en render.
  if (typeof exp === "number" && Date.now() >= exp * 1000) {
    return <Navigate to="/login" replace />;
  }

  const effectiveRole = role ?? "coach";
  if (roles?.length && !roles.includes(effectiveRole)) {
    return <Navigate to={effectiveRole === "member" ? "/my-routine" : "/dashboard"} replace />;
  }

  return children;
}
