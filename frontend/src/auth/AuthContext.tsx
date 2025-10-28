import { createContext, useContext, useMemo, useState, ReactNode, useEffect } from "react";
import api from "../api/http";
import { jwtDecode } from "jwt-decode";


type Decoded = { sub: string; name?: string; email?: string; role?: string; exp?: number };

type AuthState = {
  token: string | null;
  user: Decoded | null;
};

type AuthContextType = {
  token: string | null;
  user: Decoded | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem("access_token");
    let user: Decoded | null = null;
    if (token) {
      try { user = jwtDecode<Decoded>(token); } catch {}
    }
    return { token, user };
  });

  // Auto-logout si el token expira
  useEffect(() => {
    if (!state.user?.exp) return;
    const ms = state.user.exp * 1000 - Date.now();
    if (ms <= 0) { logout(); return; }
    const id = setTimeout(logout, ms);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.user?.exp]);

  const login = async (email: string, password: string) => {
    // /auth/token espera form-urlencoded
    const params = new URLSearchParams();
    params.append("username", email);
    params.append("password", password);

    const { data } = await api.post("/auth/token", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const token = data.access_token as string;
    localStorage.setItem("access_token", token);
    const user = jwtDecode<Decoded>(token);
    setState({ token, user });
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    setState({ token: null, user: null });
  };

  const value = useMemo<AuthContextType>(() => ({
    token: state.token,
    user: state.user,
    login,
    logout,
    isAuthenticated: !!state.token,
  }), [state, login]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
