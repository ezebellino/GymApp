import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import api from "@/lib/http";
import { useSessionStore } from "@/stores/session";
import { useThemeStore } from "@/stores/theme";
import { normalizeThemeMode } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastError } from "@/lib/toast";

type TokenResp = { access_token: string; token_type: string };

async function requestTokenWithRetry(body: URLSearchParams) {
  try {
    return await api.post<TokenResp>("/auth/token", body, {
      timeout: 8000,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch (err: any) {
    const message = err?.message ?? "";
    if (err.code === "ECONNABORTED" || message.includes("timeout")) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return api.post<TokenResp>("/auth/token", body, {
        timeout: 8000,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    }
    throw err;
  }
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);
  const setThemeMode = useThemeStore((s) => s.setMode);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const body = new URLSearchParams();
      body.append("username", username);
      body.append("password", password);

      const { data } = await requestTokenWithRetry(body);

      try {
        // El store todavía no tiene el token en este punto (setSession se
        // llama una única vez, al final): se pasa explícito acá para que esta
        // llamada puntual quede autenticada sin depender del interceptor.
        const { data: me } = await api.get<{
          id: string;
          full_name: string;
          email: string;
          role: string;
          email_verified: boolean;
          theme_preference?: string | null;
        }>("/auth/me", {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });

        setSession(data.access_token, {
          name: me.full_name ?? me.email ?? "Usuario",
          role: (me.role ?? "coach") as "owner" | "coach" | "member",
          email: me.email,
        });
        setThemeMode(normalizeThemeMode(me.theme_preference));
      } catch {
        // Sin /auth/me, setSession decodifica el JWT y deriva nombre/rol/exp.
        setSession(data.access_token);
      }

      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Error al hacer login", err);
      const status = err?.response?.status;

      if (status === 400 || status === 401) {
        toastError("Credenciales invalidas", "Verifica usuario y contrasena.");
      } else {
        toastError(
          "Error de conexion",
          "No se pudo contactar al servidor. Intenta de nuevo en unos minutos."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full px-6 py-12">
      <form
        onSubmit={onSubmit}
        className="mx-auto w-full max-w-lg rounded-4xl border border-border bg-surface-1/95 p-8 sm:p-10"
      >
        <div className="flex items-center gap-3">
          <img
            src="/mini-espacio-logo.svg"
            alt="Gym App"
            className="h-12 w-12 rounded-full object-cover ring-1 ring-border"
          />
          <p className="text-lg font-semibold tracking-tight text-foreground">
            Gym App
          </p>
        </div>

        <div className="mt-8 space-y-5">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Usuario</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type="text"
              required
              placeholder="manga_aguirre"
              className="h-12 border-border bg-surface-1/70 focus-visible:border-ring/50 focus-visible:ring-ring/30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Contrasena</label>
            <div className="relative">
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPwd ? "text" : "password"}
                required
                placeholder="Tu contrasena"
                className="h-12 border-border bg-surface-1/70 pr-10 focus-visible:border-ring/50 focus-visible:ring-ring/30"
              />
              <button
                type="button"
                onClick={() => setShowPwd((current) => !current)}
                className="absolute inset-y-0 right-2 grid place-items-center text-muted-foreground hover:text-foreground"
                aria-label={showPwd ? "Ocultar contrasena" : "Mostrar contrasena"}
              >
                {showPwd ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <Button
          className="auth-cta-gradient mt-8 h-12 w-full gap-2 border border-border font-medium text-black hover:opacity-95"
          disabled={loading}
          type="submit"
        >
          <LogIn className="h-4 w-4" />
          {loading ? "Ingresando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
