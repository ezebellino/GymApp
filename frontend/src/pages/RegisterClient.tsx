import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus } from "lucide-react";
import api from "@/lib/http";
import { useSessionStore } from "@/stores/session";
import { useThemeStore } from "@/stores/theme";
import { normalizeThemeMode } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { alertError } from "@/lib/alerts";

type TokenResp = { access_token: string; token_type: string };

export default function RegisterClient() {
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (password !== confirmPassword) {
      await alertError("Las contraseñas no coinciden", "Revisá ambos campos e intentá de nuevo.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post<TokenResp>("/auth/client-register", {
        full_name: fullName,
        email,
        phone: phone.trim() || null,
        password,
      });

      try {
        // El store todavía no tiene el token en este punto (setSession se
        // llama una única vez, al final): se pasa explícito acá para que esta
        // llamada puntual quede autenticada sin depender del interceptor.
        const { data: me } = await api.get<{
          full_name: string;
          email: string;
          role: string;
          theme_preference?: string | null;
        }>("/auth/me", {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        setSession(data.access_token, {
          name: me.full_name ?? me.email ?? "Usuario",
          role: (me.role ?? "user") as "owner" | "coach" | "user",
          email: me.email,
        });
        setThemeMode(normalizeThemeMode(me.theme_preference));
      } catch {
        // El registro de cliente siempre resuelve rol "user": no depende del
        // payload del JWT (a diferencia de Login, acá no hace falta el rol
        // que trae el token). Sin `/auth/me`, el modo queda en lo que ya haya
        // en la caché local (dec. 5.3).
        setSession(data.access_token, { role: "user" });
      }

      navigate("/my-routine", { replace: true });
    } catch (error: any) {
      await alertError(
        "No se pudo crear la cuenta",
        error?.response?.data?.detail ?? "Intentá nuevamente en unos minutos."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full px-6 py-12">
      <div className="mx-auto w-full max-w-lg">
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al login
        </button>

        <form
          onSubmit={onSubmit}
          className="rounded-4xl border border-border bg-surface-1/95 p-8 sm:p-10"
        >
          <div className="flex items-center gap-3">
            <img
              src="/mini-espacio-logo.svg"
              alt="Gym App"
              className="h-12 w-12 rounded-full object-cover ring-1 ring-border"
            />
            <p className="text-lg font-semibold tracking-tight text-foreground">Gym App</p>
          </div>

          <div className="mt-8 space-y-4">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Nombre y apellido"
              className="h-12 border-border bg-surface-1/70 focus-visible:border-ring/50 focus-visible:ring-ring/30"
            />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
              className="h-12 border-border bg-surface-1/70 focus-visible:border-ring/50 focus-visible:ring-ring/30"
            />
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono (opcional)"
              className="h-12 border-border bg-surface-1/70 focus-visible:border-ring/50 focus-visible:ring-ring/30"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Contraseña (mínimo 6)"
              className="h-12 border-border bg-surface-1/70 focus-visible:border-ring/50 focus-visible:ring-ring/30"
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Repetir contraseña"
              className="h-12 border-border bg-surface-1/70 focus-visible:border-ring/50 focus-visible:ring-ring/30"
            />
          </div>

          <Button
            className="auth-cta-gradient mt-8 h-12 w-full gap-2 border border-border font-medium text-black hover:opacity-95"
            disabled={loading}
            type="submit"
          >
            <UserPlus className="h-4 w-4" />
            {loading ? "Creando cuenta..." : "Registrar Cuenta"}
          </Button>
        </form>
      </div>
    </div>
  );
}
