import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Circle, KeyRound, UserPlus } from "lucide-react";
import api from "@/lib/http";
import { useSessionStore } from "@/stores/session";
import { useThemeStore } from "@/stores/theme";
import { normalizeThemeMode } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastError } from "@/lib/toast";

type InvitationState = {
  first_name: string;
  email_verified: boolean;
  phone_verified: boolean;
  can_set_password: boolean;
};

type TokenResp = { access_token: string; token_type: string };

type LoadState =
  | { status: "loading" }
  | { status: "ready"; state: InvitationState }
  | { status: "expired" }
  | { status: "not_found" }
  | { status: "completed" }
  | { status: "error" };

export default function InvitationAccept() {
  const { channel, token } = useParams<{ channel: string; token: string }>();
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);
  const setThemeMode = useThemeStore((s) => s.setMode);

  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!channel || !token) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<InvitationState>(`/invitations/${channel}/${token}`);
        if (!cancelled) setLoad({ status: "ready", state: data });
      } catch (error: any) {
        if (cancelled) return;
        const status = error?.response?.status;
        if (status === 410) setLoad({ status: "expired" });
        else if (status === 404) setLoad({ status: "not_found" });
        else if (status === 409) setLoad({ status: "completed" });
        else setLoad({ status: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [channel, token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (load.status !== "ready" || !load.state.can_set_password) return;

    if (password !== confirmPassword) {
      toastError("Las contraseñas no coinciden", "Revisá ambos campos e intentá de nuevo.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post<TokenResp>(
        `/invitations/${channel}/${token}/complete`,
        { password }
      );

      try {
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
          role: (me.role ?? "member") as "owner" | "coach" | "member",
          email: me.email,
        });
        setThemeMode(normalizeThemeMode(me.theme_preference));
      } catch {
        setSession(data.access_token, { role: "member" });
      }

      navigate("/my-routine", { replace: true });
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const missingChannels: string[] | undefined = Array.isArray(detail?.missing_channels)
        ? detail.missing_channels
        : undefined;
      const message =
        typeof detail === "string"
          ? detail
          : missingChannels?.length
            ? `Todavía falta verificar ${
                missingChannels.includes("email") && missingChannels.includes("phone")
                  ? "el email y el WhatsApp"
                  : missingChannels.includes("email")
                    ? "el email"
                    : "el WhatsApp"
              }. Abrí el link de ese canal para continuar.`
            // Sin `detail` (caída de red, 500 sin cuerpo) no es necesariamente
            // una baja de membresía — un mensaje genérico evita afirmar algo
            // que puede ser falso (hallazgo N9 de verification.md).
            : "Ocurrió un error inesperado. Intentá nuevamente en unos minutos.";
      toastError("No se pudo completar el registro", message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full px-6 py-12">
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-4xl border border-border bg-surface-1/95 p-8 sm:p-10">
          <div className="flex items-center gap-3">
            <img
              src="/mini-espacio-logo.svg"
              alt="Gym App"
              className="h-12 w-12 rounded-full object-cover ring-1 ring-border"
            />
            <p className="text-lg font-semibold tracking-tight text-foreground">Gym App</p>
          </div>

          {load.status === "loading" ? (
            <p className="mt-8 text-sm text-muted-foreground">Verificando tu invitación...</p>
          ) : null}

          {load.status === "not_found" ? (
            <p className="mt-8 text-sm text-muted-foreground">
              No encontramos esta invitación. Pedile al gimnasio que te envíe un link nuevo.
            </p>
          ) : null}

          {load.status === "expired" ? (
            <p className="mt-8 text-sm text-muted-foreground">
              Este link de invitación expiró o fue reemplazado por uno nuevo. Pedile al
              gimnasio que te reenvíe la invitación.
            </p>
          ) : null}

          {load.status === "completed" ? (
            <p className="mt-8 text-sm text-muted-foreground">
              Esta invitación ya fue completada. Si es tu cuenta, iniciá sesión normalmente.
            </p>
          ) : null}

          {load.status === "error" ? (
            <p className="mt-8 text-sm text-muted-foreground">
              Ocurrió un error inesperado. Intentá abrir el link nuevamente en unos minutos.
            </p>
          ) : null}

          {load.status === "ready" ? (
            <>
              <p className="mt-8 text-sm text-muted-foreground">
                Hola {load.state.first_name}, confirmá tus dos canales para poder definir tu
                contraseña.
              </p>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/30 px-3 py-2 text-sm">
                  {load.state.email_verified ? (
                    <CheckCircle2 className="h-4 w-4 text-primary-strong" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={load.state.email_verified ? "text-foreground" : "text-muted-foreground"}>
                    Email {load.state.email_verified ? "verificado" : "pendiente de verificar"}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/30 px-3 py-2 text-sm">
                  {load.state.phone_verified ? (
                    <CheckCircle2 className="h-4 w-4 text-primary-strong" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={load.state.phone_verified ? "text-foreground" : "text-muted-foreground"}>
                    WhatsApp {load.state.phone_verified ? "verificado" : "pendiente de verificar"}
                  </span>
                </div>
              </div>

              {!load.state.can_set_password ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Todavía falta verificar{" "}
                  {!load.state.email_verified && !load.state.phone_verified
                    ? "el email y el WhatsApp"
                    : !load.state.email_verified
                      ? "el email"
                      : "el WhatsApp"}
                  . Abrí el link que te llegó por ese canal para continuar.
                </p>
              ) : null}

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={!load.state.can_set_password}
                  placeholder="Contraseña (mínimo 6)"
                  className="h-12 border-border bg-surface-1/70 focus-visible:border-ring/50 focus-visible:ring-ring/30"
                />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={!load.state.can_set_password}
                  placeholder="Repetir contraseña"
                  className="h-12 border-border bg-surface-1/70 focus-visible:border-ring/50 focus-visible:ring-ring/30"
                />

                <Button
                  className="auth-cta-gradient h-12 w-full gap-2 border border-border font-medium text-black hover:opacity-95"
                  disabled={!load.state.can_set_password || submitting}
                  type="submit"
                >
                  {load.state.can_set_password ? (
                    <UserPlus className="h-4 w-4" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                  {submitting ? "Creando acceso..." : "Definir contraseña"}
                </Button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
