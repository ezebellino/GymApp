import { useEffect, useMemo, useState } from "react";
import { Copy, Mail, MessageCircle, Phone, Ruler, ShieldCheck, UserRound, Weight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Role, User } from "@/types";
import { useSessionStore } from "@/stores/session";
import {
  useActivateMembershipMutation,
  useCancelMembershipMutation,
  useInviteUserMutation,
  useUpdateUserMutation,
} from "@/services/users.queries";
import { toastError, toastSuccess } from "@/lib/toast";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: User;
  onSuccess?: () => void;
};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "member", label: "Miembro" },
  { value: "coach", label: "Coach" },
  { value: "owner", label: "Dueño" },
];

const MEMBERSHIP_STATUS_LABEL: Record<User["membership_status"], string> = {
  none: "Sin membresía",
  active: "Activa",
  cancelled: "Dada de baja",
};

const INVITATION_STATUS_LABEL: Record<User["invitation_status"], string> = {
  none: "Sin invitar",
  pending: "Invitación pendiente",
  expired: "Invitación vencida",
  access_active: "Acceso activo",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR");
}

function calcAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export default function EditUserDialog({ open, onOpenChange, user, onSuccess }: Props) {
  const viewerRole = useSessionStore((s) => s.role);
  const isOwner = viewerRole === "owner";

  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name ?? "");
  const [birthDate, setBirthDate] = useState(user.birth_date ?? "");
  const [weightKg, setWeightKg] = useState(user.weight_kg != null ? String(user.weight_kg) : "");
  const [heightCm, setHeightCm] = useState(user.height_cm != null ? String(user.height_cm) : "");
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState<Role>(user.role);
  const [cancelDate, setCancelDate] = useState("");
  const [inviteResult, setInviteResult] = useState<{
    email_link: string;
    phone_link: string;
  } | null>(null);

  const updateMutation = useUpdateUserMutation();
  const cancelMutation = useCancelMembershipMutation();
  const activateMutation = useActivateMembershipMutation();
  const inviteMutation = useInviteUserMutation();

  // Deps `[open, user.id]`, NO `[open, user]`: `user` es un prop derivado de la
  // query (`Users.tsx`), así que cambia de identidad en cada refetch aunque
  // sea el mismo usuario (structural sharing de TanStack Query). Si este
  // efecto dependiera de `user` entero, cada mutación propia del diálogo
  // (invitar, dar de baja, activar) invalida la query, refetchea, y este
  // efecto se re-disparía mientras el diálogo sigue abierto — pisando
  // ediciones sin guardar y borrando `inviteResult` justo después de
  // generarlo (hallazgo N1 de la verificación de `unify-clients-into-users`).
  // Las partes de solo lectura (membresía, invitación) siguen leyendo `user`
  // directo del prop, así que ya se actualizan sin pasar por este estado.
  useEffect(() => {
    if (open) {
      setFirstName(user.first_name);
      setLastName(user.last_name ?? "");
      setBirthDate(user.birth_date ?? "");
      setWeightKg(user.weight_kg != null ? String(user.weight_kg) : "");
      setHeightCm(user.height_cm != null ? String(user.height_cm) : "");
      setEmail(user.email ?? "");
      setPhone(user.phone ?? "");
      setRole(user.role);
      setCancelDate("");
      setInviteResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user.id]);

  const derivedAge = useMemo(() => calcAge(birthDate), [birthDate]);
  const isMemberRole = user.role === "member";

  async function save() {
    try {
      await updateMutation.mutateAsync({
        id: user.id,
        input: {
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          birth_date: birthDate || null,
          weight_kg: weightKg.trim() ? Number(weightKg) : null,
          height_cm: heightCm.trim() ? Number(heightCm) : null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          ...(isOwner ? { role } : {}),
        },
      });

      onOpenChange(false);
      onSuccess?.();
      toastSuccess("Actualizado", "Los datos del usuario fueron guardados.");
    } catch (error: any) {
      toastError(
        "No se pudo guardar",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    }
  }

  async function handleCancelMembership() {
    // La consecuencia real difiere segun el rol (dec. 10.4b): un Miembro pierde
    // el acceso a la app, un Dueño/Coach marcado como miembro lo conserva.
    const confirmMessage = isMemberRole
      ? `Vas a dar de baja la membresía de ${user.full_name}. Además de salir del seguimiento de pagos, asistencia y rutinas, esto le quita el acceso a la aplicación (no puede volver a iniciar sesión). ¿Confirmás?`
      : `Vas a dar de baja la condición de miembro de ${user.full_name}. Deja de contar para pagos, asistencia y rutinas, pero conserva su acceso administrativo (sigue pudiendo iniciar sesión). ¿Confirmás?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await cancelMutation.mutateAsync({
        id: user.id,
        cancelledAt: cancelDate ? new Date(cancelDate).toISOString() : null,
      });
      onSuccess?.();
      toastSuccess(
        "Membresía dada de baja",
        "El cambio ya se ve reflejado en el listado."
      );
    } catch (error: any) {
      toastError(
        "No se pudo dar de baja",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    }
  }

  async function handleActivateMembership() {
    try {
      await activateMutation.mutateAsync(user.id);
      onSuccess?.();
      toastSuccess(
        "Membresía activada",
        "El usuario vuelve a contar como miembro activo."
      );
    } catch (error: any) {
      toastError(
        "No se pudo activar la membresía",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    }
  }

  async function handleInvite() {
    try {
      const result = await inviteMutation.mutateAsync(user.id);
      setInviteResult(result);
      onSuccess?.();
      toastSuccess(
        "Invitación generada",
        "Se envió el link por email y ya podés compartirlo por WhatsApp."
      );
    } catch (error: any) {
      toastError(
        "No se pudo invitar",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toastSuccess("Copiado", "El link se copió al portapapeles.");
    } catch {
      toastError("No se pudo copiar", "Copiá el link manualmente.");
    }
  }

  function openWhatsApp(link: string) {
    if (!phone.trim()) return;
    const digits = phone.replace(/\D/g, "");
    const normalizedPhone = digits.startsWith("54") ? digits : `54${digits}`;
    const message = encodeURIComponent(
      `Hola ${firstName}, te invitamos a crear tu acceso al portal de Mini Espacio: ${link}`
    );
    window.open(
      `https://wa.me/${normalizedPhone}?text=${message}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-surface-1 text-foreground">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            <ShieldCheck className="h-3.5 w-3.5" />
            Ficha operativa
          </div>
          <DialogTitle className="pt-3 text-2xl font-semibold text-foreground">
            Editar usuario
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Actualiza el perfil, la membresía y el acceso al portal de este usuario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-xl border border-border bg-surface-2/30 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/15 p-3 text-primary-strong">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{user.full_name}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Ajustá sus datos de contacto, su rol y su estado de membresía.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Nombre</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Apellido</label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Apellido"
              />
            </div>
          </div>

          {isOwner ? (
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@mail.com"
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Teléfono
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11 5555 5555"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">
                Fecha de nacimiento{derivedAge != null ? ` (${derivedAge} años)` : ""}
              </label>
              <Input
                type="date"
                value={birthDate ?? ""}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Weight className="h-4 w-4 text-muted-foreground" />
                Peso (kg)
              </label>
              <Input
                type="number"
                min={0}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                Altura (cm)
              </label>
              <Input
                type="number"
                min={0}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-surface-2/20 p-4">
            <p className="text-sm font-medium text-foreground">Membresía</p>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <div>
                Estado:{" "}
                <span className="font-medium text-foreground">
                  {MEMBERSHIP_STATUS_LABEL[user.membership_status]}
                </span>
              </div>
              <div>
                Comienzo:{" "}
                <span className="font-medium text-foreground">
                  {formatDate(user.membership_start_date)}
                </span>
              </div>
              {user.membership_status === "cancelled" ? (
                <div>
                  Baja:{" "}
                  <span className="font-medium text-foreground">
                    {formatDate(user.membership_cancelled_at)}
                  </span>
                </div>
              ) : null}
            </div>

            {user.membership_status === "active" ? (
              <div className="space-y-2 border-t border-border pt-3">
                <label className="text-xs text-muted-foreground">
                  Fecha de baja (opcional — si no elegís una, se usa el momento actual)
                </label>
                <Input
                  type="datetime-local"
                  value={cancelDate}
                  onChange={(e) => setCancelDate(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  onClick={handleCancelMembership}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? "Dando de baja..." : "Dar de baja la membresía"}
                </Button>
              </div>
            ) : (
              <div className="border-t border-border pt-3">
                <Button
                  type="button"
                  onClick={handleActivateMembership}
                  disabled={activateMutation.isPending}
                >
                  {activateMutation.isPending
                    ? "Activando..."
                    : user.membership_status === "none"
                      ? "Activar membresía"
                      : "Reactivar membresía"}
                </Button>
              </div>
            )}
          </div>

          {isMemberRole ? (
            <div className="space-y-3 rounded-xl border border-border bg-surface-2/20 p-4">
              <p className="text-sm font-medium text-foreground">Invitación al portal</p>
              <p className="text-sm text-muted-foreground">
                Estado:{" "}
                <span className="font-medium text-foreground">
                  {INVITATION_STATUS_LABEL[user.invitation_status]}
                </span>
              </p>

              {user.invitation_status !== "access_active" ? (
                <Button
                  type="button"
                  onClick={handleInvite}
                  disabled={inviteMutation.isPending}
                >
                  {inviteMutation.isPending
                    ? "Generando..."
                    : user.invitation_status === "none"
                      ? "Invitar"
                      : "Reenviar invitación"}
                </Button>
              ) : null}

              {inviteResult ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex gap-2">
                    <Input readOnly value={inviteResult.email_link} className="font-mono text-xs" />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => copyLink(inviteResult.email_link)}
                      aria-label="Copiar link de invitación"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-emerald-500/20 bg-emerald-500/8 text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-100"
                    onClick={() => openWhatsApp(inviteResult.phone_link)}
                    disabled={!phone.trim()}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Enviar por WhatsApp
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={updateMutation.isPending || !firstName.trim()}>
            {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
