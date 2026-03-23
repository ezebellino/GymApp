import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { ArrowRight, Eye, EyeOff, LogIn } from "lucide-react";
import api from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { alertError, alertSuccess } from "@/lib/alerts";

type TokenResp = { access_token: string; token_type: string };
type TokenPayload = {
  name?: string;
  email?: string;
  sub?: string;
  role?: string;
  exp: number;
};

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
  const [elapsed, setElapsed] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }

    const id = setInterval(() => {
      setElapsed((current) => current + 1);
    }, 1000);

    return () => clearInterval(id);
  }, [loading]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const body = new URLSearchParams();
      body.append("username", username);
      body.append("password", password);

      const { data } = await requestTokenWithRetry(body);
      localStorage.setItem("access_token", data.access_token);

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
      } catch {
        const payload = jwtDecode<TokenPayload>(data.access_token);
        localStorage.setItem("user_name", payload.name ?? payload.email ?? "Usuario");
        localStorage.setItem(
          "user_role",
          payload.role === "owner" || payload.role === "coach"
            ? payload.role
            : "coach"
        );
      }

      await alertSuccess("Bienvenido", "Inicio de sesion correcto.");
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Error al hacer login", err);
      const status = err?.response?.status;

      if (status === 400 || status === 401) {
        await alertError("Credenciales invalidas", "Verifica usuario y contrasena.");
      } else {
        await alertError(
          "Error de conexion",
          "No se pudo contactar al servidor. Intenta de nuevo en unos minutos."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0b0b]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-amber-300/15 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-orange-500/12 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-6 py-12 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-100">
              Mini Espacio
            </div>
            <h1 className="warm-accent-text mt-5 text-5xl font-semibold tracking-tight">
              Mini Espacio ordena la operacion diaria del gimnasio en una sola vista.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-zinc-400">
              Clientes, cobros, asistencia y rutinas conviven en un panel pensado
              para trabajo real, seguimiento cercano y decisiones rapidas.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.08),rgba(255,247,237,0.03),rgba(249,115,22,0.09))] p-5">
                <div className="mb-3 flex items-center gap-3">
                  <img
                    src="/mini-espacio-logo.svg"
                    alt="Mini Espacio"
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10"
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Marca activa</p>
                    <p className="text-xs uppercase tracking-[0.22em] text-amber-100/80">
                      Mini Espacio
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-zinc-400">
                  Una identidad calida, clara y enfocada en acompanar entrenamientos
                  personalizados de forma profesional.
                </p>
              </div>
              <div className="rounded-3xl border border-amber-200/10 bg-white/[0.035] p-5">
                <p className="text-sm font-medium text-zinc-100">Operacion diaria</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Consulta el dashboard, registra check-ins y accede a acciones
                  rapidas sin perder contexto.
                </p>
              </div>
              <div className="rounded-3xl border border-amber-200/10 bg-white/[0.035] p-5">
                <p className="text-sm font-medium text-zinc-100">
                  Seguimiento centralizado
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Revisa pagos, estados y clientes con una interfaz consistente
                  y facil de usar.
                </p>
              </div>
            </div>
          </div>
        </section>

        <form
          onSubmit={onSubmit}
          className="relative w-full rounded-4xl border border-amber-200/10 bg-zinc-900/75 p-8 shadow-[0_30px_90px_-45px_rgba(249,115,22,0.45)] backdrop-blur-xl sm:p-10"
        >
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.24em] text-zinc-500">
              Acceso seguro
            </p>
            <div className="flex items-center gap-3">
              <img
                src="/mini-espacio-logo.svg"
                alt="Mini Espacio"
                className="h-12 w-12 rounded-full object-cover ring-1 ring-white/10"
              />
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-amber-100/80">
                  Mini Espacio
                </p>
                <p className="text-sm text-zinc-400">Entrenamientos personalizados</p>
              </div>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-50">
              Ingresar al panel
            </h2>
            <p className="text-sm leading-6 text-zinc-400">
              Usa tus credenciales para entrar al sistema.
            </p>
          </div>

          <div className="mt-8 space-y-5">
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Usuario</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                type="text"
                required
                placeholder="manga_aguirre"
                className="h-12 border-amber-200/10 bg-zinc-900/70 focus-visible:ring-amber-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Contrasena</label>
              <div className="relative">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPwd ? "text" : "password"}
                  required
                  placeholder="Tu contrasena"
                  className="h-12 border-amber-200/10 bg-zinc-900/70 pr-10 focus-visible:ring-orange-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((current) => !current)}
                  className="absolute inset-y-0 right-2 grid place-items-center text-zinc-400 hover:text-zinc-200"
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
            className="mt-8 h-12 w-full gap-2 border border-amber-300/25 bg-[linear-gradient(90deg,#facc15_0%,#fff7ed_48%,#f97316_100%)] font-medium text-black hover:opacity-95"
            disabled={loading}
            type="submit"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Ingresando..." : "Entrar"}
          </Button>

          {loading ? (
            <p className="mt-4 text-center text-xs text-zinc-400">
              Conectando con el servidor... {elapsed}s
              {elapsed >= 5 ? " Puede tardar unos segundos si es el primer uso." : ""}
            </p>
          ) : (
            <p className="mt-4 text-center text-xs leading-6 text-zinc-500">
              Si el acceso tarda unos segundos, es normal: el backend puede estar
              reactivandose automaticamente.
            </p>
          )}

          <div className="mt-6 rounded-2xl border border-amber-200/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
            <div className="flex items-center justify-between gap-3">
              <span>Demo operativa lista para seguimiento diario</span>
              <ArrowRight className="h-4 w-4 text-amber-200" />
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-500">
            {new Date().getFullYear()} Mini Espacio
          </p>
        </form>
      </div>
    </div>
  );
}
