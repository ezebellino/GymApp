import { FormEvent, useMemo, useState } from "react";
import { Mail, ShieldCheck, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/http";
import { useNavigate } from "react-router-dom";
import { alertError, alertSuccessAutoClose } from "@/lib/alerts";

export default function NewCoachPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const passwordChecks = useMemo(
    () => ({
      minLength: password.length >= 6,
      hasLetter: /[A-Za-z]/.test(password),
      hasNumber: /\d/.test(password),
    }),
    [password]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      };

      await api.post("/coaches", payload);

      await alertSuccessAutoClose(
        "Coach creado",
        "El nuevo coach fue registrado correctamente."
      );

      setFullName("");
      setEmail("");
      setPassword("");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const message =
        err?.response?.data?.detail || err?.message || "No se pudo crear el coach.";
      await alertError("No se pudo crear el coach", String(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-[28px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.1),rgba(255,247,237,0.03)_45%,rgba(249,115,22,0.11))] p-6 shadow-[0_20px_80px_-40px_rgba(249,115,22,0.42)]">
          <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-100">
            Equipo
          </div>
          <h1 className="warm-accent-text mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Incorpora un nuevo coach con un flujo mas claro y seguro.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
            Registra los datos iniciales, define una contrasena segura y deja el
            acceso listo para que el coach empiece a operar.
          </p>
        </div>

        <div className="rounded-[28px] border border-amber-200/10 bg-white/[0.035] p-6 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
            Recomendacion
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-zinc-400">Buenas practicas</p>
              <p className="text-lg font-semibold text-zinc-100">
                Email real y contrasena temporal segura
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.12),rgba(255,247,237,0.05),rgba(249,115,22,0.12))] p-4 text-sm text-amber-50">
              Luego puedes pedirle al coach que cambie su contrasena y valide sus
              datos de contacto.
            </div>
          </div>
        </div>
      </section>

      <Card className="mx-auto w-full max-w-2xl rounded-[28px] border-amber-200/10 bg-zinc-950/70 backdrop-blur-md">
        <CardHeader className="border-b border-amber-200/10 pb-5">
          <CardTitle className="text-center text-zinc-100">
            Registrar nuevo coach
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Nombre completo</label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="border-white/10 bg-zinc-900/70 pl-10 text-zinc-100"
                  placeholder="Nombre y apellido"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-white/10 bg-zinc-900/70 pl-10 text-zinc-100"
                  placeholder="coach@librefuncional.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Contrasena inicial</label>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-white/10 bg-zinc-900/70 pl-10 text-zinc-100"
                  placeholder="Minimo 6 caracteres"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className={`rounded-xl border px-3 py-2 text-xs ${passwordChecks.minLength ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : "border-white/10 text-zinc-500"}`}>
                  6+ caracteres
                </div>
                <div className={`rounded-xl border px-3 py-2 text-xs ${passwordChecks.hasLetter ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : "border-white/10 text-zinc-500"}`}>
                  Al menos una letra
                </div>
                <div className={`rounded-xl border px-3 py-2 text-xs ${passwordChecks.hasNumber ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : "border-white/10 text-zinc-500"}`}>
                  Al menos un numero
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/dashboard")}
                className="border-amber-200/10 text-zinc-100 hover:bg-white/[0.08]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  loading ||
                  !fullName.trim() ||
                  !email.trim() ||
                  !passwordChecks.minLength ||
                  !passwordChecks.hasLetter ||
                  !passwordChecks.hasNumber
                }
                className="border border-amber-300/25 bg-[linear-gradient(90deg,#facc15_0%,#fff7ed_48%,#f97316_100%)] font-medium text-black hover:opacity-90"
              >
                {loading ? "Creando..." : "Crear coach"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
