import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { ArrowLeft, UserPlus } from "lucide-react";
import api from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { alertError, alertSuccess } from "@/lib/alerts";

type TokenResp = { access_token: string; token_type: string };
type TokenPayload = { name?: string; email?: string; role?: string };

export default function RegisterClient() {
  const navigate = useNavigate();
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

      localStorage.setItem("access_token", data.access_token);
      try {
        const { data: me } = await api.get<{
          full_name: string;
          email: string;
          role: string;
        }>("/auth/me");
        localStorage.setItem("user_name", me.full_name ?? me.email ?? "Usuario");
        localStorage.setItem("user_role", me.role ?? "user");
      } catch {
        const payload = jwtDecode<TokenPayload>(data.access_token);
        localStorage.setItem("user_name", payload.name ?? payload.email ?? "Usuario");
        localStorage.setItem("user_role", payload.role === "user" ? "user" : "user");
      }

      await alertSuccess("Cuenta creada", "Ya podés cargar tu progreso en Mi rutina.");
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
    <div className="relative min-h-screen overflow-hidden bg-[#0b0b0b] px-6 py-12">
      <div className="mx-auto w-full max-w-lg">
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al login
        </button>

        <form
          onSubmit={onSubmit}
          className="rounded-4xl border border-amber-200/10 bg-zinc-900/75 p-8 shadow-[0_30px_90px_-45px_rgba(249,115,22,0.45)] backdrop-blur-xl sm:p-10"
        >
          <p className="text-sm uppercase tracking-[0.24em] text-zinc-500">Registro de cliente</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">Crear acceso personal</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Vas a ingresar directo a tu vista de usuario para cargar ejercicios y ver tu rutina.
          </p>

          <div className="mt-8 space-y-4">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Nombre y apellido"
              className="h-12 border-amber-200/10 bg-zinc-900/70"
            />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
              className="h-12 border-amber-200/10 bg-zinc-900/70"
            />
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono (opcional)"
              className="h-12 border-amber-200/10 bg-zinc-900/70"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Contraseña (mínimo 6)"
              className="h-12 border-amber-200/10 bg-zinc-900/70"
            />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Repetir contraseña"
              className="h-12 border-amber-200/10 bg-zinc-900/70"
            />
          </div>

          <Button
            className="mt-8 h-12 w-full gap-2 border border-amber-300/25 bg-[linear-gradient(90deg,#facc15_0%,#fff7ed_48%,#f97316_100%)] font-medium text-black hover:opacity-95"
            disabled={loading}
            type="submit"
          >
            <UserPlus className="h-4 w-4" />
            {loading ? "Creando cuenta..." : "Crear cuenta y entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
