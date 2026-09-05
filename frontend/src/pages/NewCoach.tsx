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
import { toastError, toastSuccess } from "@/lib/toast";

const outlineButtonClass =
  "border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70";

function PasswordRule({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 text-xs transition ${
        ok
          ? "border-primary/30 bg-primary/10 text-primary-strong"
          : "border-border bg-surface-2/20 text-muted-foreground"
      }`}
    >
      <div className="flex items-center gap-2">
        <BadgeCheck className={`h-4 w-4 ${ok ? "text-primary-strong" : "text-muted-foreground"}`} />
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

      toastSuccess(
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
      toastError("No se pudo crear el coach", String(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="hero-aura rounded-xl border border-border p-6">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            Equipo y accesos
          </div>
          <h1 className="warm-accent-text font-display mt-4 text-3xl font-extrabold md:text-headline-hero">
            Suma un nuevo coach con un alta mas clara, segura y lista para operar.
          </h1>
          <p className="mt-3 max-w-2xl text-body-md text-muted-foreground md:text-body-lg">
            Define sus datos base, prepara un acceso inicial y deja listo el perfil
            para que pueda trabajar con clientes, asistencias y seguimiento diario.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className={outlineButtonClass}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al dashboard
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-1/60 p-6 backdrop-blur-xl">
          <p className="text-label-caps uppercase text-muted-foreground">
            Recomendacion
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Alta sugerida</p>
              <p className="text-lg font-semibold text-foreground">
                Email real, acceso temporal y contexto claro
              </p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-foreground">
              Lo ideal es compartir una clave inicial segura y pedirle al coach que
              la cambie en su primer ingreso.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-xl border-border bg-surface-1 backdrop-blur-md">
          <CardHeader className="border-b border-border pb-5">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <UsersRound className="h-5 w-5" />
              Registrar nuevo coach
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/15 p-3 text-primary-strong">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Acceso inicial del equipo
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Este alta crea la cuenta del coach y la deja lista para ingresar
                      al panel con permisos operativos.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Nombre completo</label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="border-border bg-surface-2/40 pl-10 text-foreground"
                    placeholder="Nombre y apellido"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-border bg-surface-2/40 pl-10 text-foreground"
                    placeholder="coach@miniespacio.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Contrasena inicial</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="border-border bg-surface-2/40 pl-10 text-foreground"
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
                  className={outlineButtonClass}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  {loading ? "Creando..." : "Crear coach"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-xl border-border bg-surface-1/60 backdrop-blur-xl">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-foreground">Que se habilita con este alta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="rounded-xl border border-border bg-surface-2/20 p-4">
                <p className="text-sm font-medium text-foreground">Acceso al panel</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  El coach podra ingresar con sus credenciales para operar en la
                  aplicacion desde el primer momento.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-2/20 p-4">
                <p className="text-sm font-medium text-foreground">Trabajo diario</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Quedara listo para registrar asistencias, consultar clientes y
                  trabajar dentro del flujo habitual del gimnasio.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface-2/20 p-4">
                <p className="text-sm font-medium text-foreground">Orden interno</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Mantener emails reales y accesos temporales seguros hace mas simple
                  el soporte y la administracion del equipo.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border bg-surface-1/60 backdrop-blur-xl">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-foreground">Checklist rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
              <p>
                Nombre cargado:{" "}
                <span className="font-medium text-foreground">
                  {fullName.trim() ? "Listo" : "Pendiente"}
                </span>
              </p>
              <p>
                Email operativo:{" "}
                <span className="font-medium text-foreground">
                  {email.trim() ? "Listo" : "Pendiente"}
                </span>
              </p>
              <p>
                Seguridad inicial:{" "}
                <span className="font-medium text-foreground">
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
