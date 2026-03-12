import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/http";
import { useNavigate } from "react-router-dom";
import { alertError, alertSuccessAutoClose } from "@/lib/alerts";

function PasswordRule({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 text-xs transition ${
        ok
          ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
          : "border-white/10 bg-white/[0.02] text-zinc-500"
      }`}
    >
      <div className="flex items-center gap-2">
        <BadgeCheck className={`h-4 w-4 ${ok ? "text-amber-200" : "text-zinc-600"}`} />
        <span>{label}</span>
      </div>
    </div>
  );
}

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

  const canSubmit =
    !loading &&
    !!fullName.trim() &&
    !!email.trim() &&
    passwordChecks.minLength &&
    passwordChecks.hasLetter &&
    passwordChecks.hasNumber;

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
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="rounded-[30px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.1),rgba(255,247,237,0.03)_45%,rgba(249,115,22,0.12))] p-6 shadow-[0_25px_90px_-52px_rgba(249,115,22,0.5)]">
          <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-100">
            Equipo y accesos
          </div>
          <h1 className="warm-accent-text mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Suma un nuevo coach con un alta mas clara, segura y lista para operar.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
            Define sus datos base, prepara un acceso inicial y deja listo el perfil
            para que pueda trabajar con clientes, asistencias y seguimiento diario.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="border-amber-200/10 bg-white/[0.04] text-zinc-100 hover:bg-white/8"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al dashboard
            </Button>
          </div>
        </div>

        <div className="rounded-[30px] border border-amber-200/10 bg-white/[0.035] p-6 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
            Recomendacion
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-zinc-400">Alta sugerida</p>
              <p className="text-lg font-semibold text-zinc-100">
                Email real, acceso temporal y contexto claro
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.12),rgba(255,247,237,0.05),rgba(249,115,22,0.12))] p-4 text-sm text-amber-50">
              Lo ideal es compartir una clave inicial segura y pedirle al coach que
              la cambie en su primer ingreso.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[30px] border-amber-200/10 bg-zinc-950/70 backdrop-blur-md">
          <CardHeader className="border-b border-amber-200/10 pb-5">
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <UsersRound className="h-5 w-5" />
              Registrar nuevo coach
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="rounded-[24px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.08),rgba(255,247,237,0.03)_48%,rgba(249,115,22,0.1))] p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white/6 p-3 text-amber-100">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-100">
                      Acceso inicial del equipo
                    </p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      Este alta crea la cuenta del coach y la deja lista para ingresar
                      al panel con permisos operativos.
                    </p>
                  </div>
                </div>
              </div>

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
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="border-white/10 bg-zinc-900/70 pl-10 text-zinc-100"
                    placeholder="Minimo 6 caracteres"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <PasswordRule label="6 o mas caracteres" ok={passwordChecks.minLength} />
                <PasswordRule label="Incluye al menos una letra" ok={passwordChecks.hasLetter} />
                <PasswordRule label="Incluye al menos un numero" ok={passwordChecks.hasNumber} />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  className="border-amber-200/10 text-zinc-100 hover:bg-white/8"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="border border-amber-300/25 bg-[linear-gradient(90deg,#facc15_0%,#fff7ed_48%,#f97316_100%)] font-medium text-black hover:opacity-90"
                >
                  {loading ? "Creando..." : "Crear coach"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[30px] border-amber-200/10 bg-white/[0.035] backdrop-blur-xl">
            <CardHeader className="border-b border-amber-200/10 pb-4">
              <CardTitle className="text-zinc-100">Que se habilita con este alta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-zinc-100">Acceso al panel</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  El coach podra ingresar con sus credenciales para operar en la
                  aplicacion desde el primer momento.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-zinc-100">Trabajo diario</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Quedara listo para registrar asistencias, consultar clientes y
                  trabajar dentro del flujo habitual del gimnasio.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-zinc-100">Orden interno</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Mantener emails reales y accesos temporales seguros hace mas simple
                  el soporte y la administracion del equipo.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border-amber-200/10 bg-white/[0.035] backdrop-blur-xl">
            <CardHeader className="border-b border-amber-200/10 pb-4">
              <CardTitle className="text-zinc-100">Checklist rapido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6 text-sm text-zinc-400">
              <p>
                Nombre cargado:{" "}
                <span className="font-medium text-zinc-100">
                  {fullName.trim() ? "Listo" : "Pendiente"}
                </span>
              </p>
              <p>
                Email operativo:{" "}
                <span className="font-medium text-zinc-100">
                  {email.trim() ? "Listo" : "Pendiente"}
                </span>
              </p>
              <p>
                Seguridad inicial:{" "}
                <span className="font-medium text-zinc-100">
                  {passwordChecks.minLength && passwordChecks.hasLetter && passwordChecks.hasNumber
                    ? "Validada"
                    : "Faltan requisitos"}
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
