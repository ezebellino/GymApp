// src/pages/Login.tsx
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jwtDecode } from "jwt-decode";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { alertError, alertSuccess } from "@/lib/alerts";

type TokenResp = { access_token: string; token_type: string };
type TokenPayload = { name?: string; email?: string; sub?: string; role?: string; exp: number };

/**
 * Hace login contra /auth/token con timeout y un reintento
 * adicional en caso de timeout (típico cold start de Render).
 */
async function requestTokenWithRetry(body: URLSearchParams) {
  try {
    return await api.post<TokenResp>("/auth/token", body, {
      timeout: 8000, // 8 segundos
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch (err: any) {
    // Render despertando → reintento
    const msg = err?.message ?? "";
    if (err.code === "ECONNABORTED" || msg.includes("timeout")) {
      console.warn("Servidor despertando, reintentando login...");
      await new Promise((res) => setTimeout(res, 2000));

      return api.post<TokenResp>("/auth/token", body, {
        timeout: 8000,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    }
    throw err;
  }
}

export default function Login() {
  const [email, setEmail] = useState("owner@librefuncional.com");
  const [password, setPassword] = useState("Cambiar123");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const body = new URLSearchParams();
      body.append("username", email);
      body.append("password", password);

      const { data } = await requestTokenWithRetry(body);

      localStorage.setItem("access_token", data.access_token);

      // Intentar traer el usuario desde /auth/me (fuente de la verdad)
      try {
        const { data: me } = await api.get<{
          id: string;
          full_name: string;
          email: string;
          role: string;
          email_verified: boolean;
        }>("/auth/me");

        localStorage.setItem("user_name", me.full_name ?? me.email ?? "Usuario");
        localStorage.setItem("user_role", me.role ?? "coach");
      } catch (err) {
        // Fallback: decodificar el token local
        const payload = jwtDecode<TokenPayload>(data.access_token);
        localStorage.setItem("user_name", payload.name ?? payload.email ?? "Usuario");
        localStorage.setItem(
          "user_role",
          payload.role === "owner" || payload.role === "coach" ? payload.role : "coach"
        );
      }

      await alertSuccess("¡Bienvenido!", "Inicio de sesión correcto.");
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Error al hacer login", err);

      // Si usás axios en `api`, esto diferencia error de credenciales vs error de red
      const status = err?.response?.status;
      if (status === 400 || status === 401) {
        alertError("Credenciales inválidas", "Verificá email y contraseña.");
      } else {
        alertError(
          "Error de conexión",
          "No se pudo contactar al servidor. Intentá de nuevo en unos minutos."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-zinc-950">
      {/* Glow de fondo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full blur-3xl opacity-20 bg-violet-600"></div>
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full blur-3xl opacity-20 bg-cyan-500"></div>
      </div>

      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-zinc-900/70 p-8 shadow-2xl backdrop-blur-md"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ingresar</h1>
          <p className="text-sm text-zinc-400">Accedé al panel de LibreFuncional</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-zinc-300">Email</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            className="bg-zinc-900/70 border-white/10 focus-visible:ring-cyan-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-zinc-300">Password</label>
          <div className="relative">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPwd ? "text" : "password"}
              required
              className="bg-zinc-900/70 border-white/10 pr-10 focus-visible:ring-violet-500"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              className="absolute inset-y-0 right-2 grid place-items-center text-zinc-400 hover:text-zinc-200"
              aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button
          className="w-full gap-2 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400"
          disabled={loading}
          type="submit"
        >
          <LogIn className="h-4 w-4" />
          {loading ? "Ingresando..." : "Entrar"}
        </Button>

        <p className="text-xs text-center text-zinc-500">
          © {new Date().getFullYear()} LibreFuncional
        </p>
      </form>
    </div>
  );
}
