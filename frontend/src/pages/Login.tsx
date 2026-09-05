import { FormEvent, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useSignIn } from "@/hooks/useSignIn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastError } from "@/lib/toast";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  // Único camino de login (red + setSession + tema + navigate), compartido con
  // el widget de desarrollo: ver `hooks/useSignIn.ts`.
  const signIn = useSignIn();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn({ username, password });
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
