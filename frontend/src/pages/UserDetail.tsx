import { type ReactNode, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Cake,
  Mail,
  PencilLine,
  Phone,
  Ruler,
  ShieldCheck,
  UserRound,
  Weight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserQuery } from "@/services/users.queries";
import { queryKeys } from "@/services/queryKeys";
import type { MembershipIndicator, Role } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import DataError from "@/components/DataError";
import EditUserDialog from "@/components/EditUserDialog";
import CancelMembershipDialog from "@/components/CancelMembershipDialog";
import ActivateMembershipDialog from "@/components/ActivateMembershipDialog";
import InviteUserDialog from "@/components/InviteUserDialog";
import VerifyContactDialog from "@/components/VerifyContactDialog";
import MemberTemplatesCard from "@/components/MemberTemplatesCard";
import { useSessionStore } from "@/stores/session";
import { canManageUser } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Dueño",
  coach: "Coach",
  member: "Miembro",
};

// Un color por rol, distinto de los que ya significan algo en el indicador de
// membresía (verde/naranja/rojo): así "quién es" (rol) y "cómo está" (pago)
// nunca compiten por el mismo lenguaje visual.
const ROLE_BADGE_CLASS: Record<Role, string> = {
  owner: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-200",
  coach: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  member: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200",
};

const INDICATOR_LABEL: Record<MembershipIndicator, string> = {
  up_to_date: "Al día con la cuota",
  overdue: "En mora",
  suspended: "Membresía dada de baja",
  none: "Sin membresía",
};

const INDICATOR_DOT_CLASS: Record<Exclude<MembershipIndicator, "none">, string> = {
  up_to_date: "bg-emerald-500",
  overdue: "bg-amber-500",
  suspended: "bg-destructive",
};

const MEMBERSHIP_STATUS_LABEL = {
  none: "Sin membresía",
  active: "Activa",
  cancelled: "Dada de baja",
} as const;

const INVITATION_STATUS_LABEL = {
  none: "Sin invitar",
  pending: "Invitación pendiente",
  expired: "Invitación vencida",
  access_active: "Acceso activo",
} as const;

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR");
}

function InfoRow({
  icon: Icon,
  label,
  value,
  trailing,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-full bg-surface-2/50 p-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
        {trailing}
      </div>
    </div>
  );
}

// Estado de verificación de un canal de contacto (design.md D8 de
// `move-user-actions-to-detail`). El verde queda deliberadamente fuera: en
// esta app ya significa "al día con la cuota" (INDICATOR_DOT_CLASS de más
// arriba); "Verificado" es el estado normal (neutro), "Sin verificar" es el
// accionable (ámbar).
function ContactVerificationStatus({
  value,
  verified,
}: {
  value: string | null | undefined;
  verified: boolean;
}) {
  if (!value) return null;

  if (verified) {
    return (
      <div className="mt-1.5">
        <Badge variant="outline" className="border-border text-muted-foreground">
          <BadgeCheck className="h-3 w-3" />
          Verificado
        </Badge>
      </div>
    );
  }

  return (
    <div className="mt-1.5">
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
      >
        Sin verificar
      </Badge>
    </div>
  );
}

type DetailAction =
  | null
  | "edit"
  | "cancel-membership"
  | "activate-membership"
  | "invite"
  | "verify-contact";

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const viewerRole = useSessionStore((s) => s.role);
  const [action, setAction] = useState<DetailAction>(null);

  const { data: user, isPending, isError, refetch } = useUserQuery(id);

  function invalidateAfterEdit() {
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
  }

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <div className="rounded-xl border border-border bg-surface-1/70 px-5 py-4 text-sm text-muted-foreground">
          Cargando ficha del usuario...
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return (
      <DataError
        title="No se pudo cargar el usuario"
        description="Puede que ya no exista o que no tengas permiso para verlo."
        onRetry={() => refetch()}
      />
    );
  }

  const isMemberRole = user.role === "member";
  const canManage = canManageUser(viewerRole, user.role);
  const canInvite =
    canManage && isMemberRole && user.invitation_status !== "access_active";
  // Espejo exacto de `pending != []` del backend (design D1/D8): la ficha
  // nunca ofrece una acción que el servidor vaya a rechazar con 409.
  const hasPendingContact =
    (!!user.email && !user.email_verified) || (!!user.phone && !user.phone_verified);

  return (
    <div className="space-y-6">
      <section className="hero-aura rounded-xl border border-border p-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate("/users")}
          className="border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Usuarios
        </Button>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/15 p-4 text-primary-strong">
              <UserRound className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="warm-accent-text font-display text-2xl font-extrabold md:text-3xl">
                  {user.full_name}
                </h1>
                {user.membership_indicator !== "none" ? (
                  <span
                    className={cn(
                      "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                      INDICATOR_DOT_CLASS[user.membership_indicator]
                    )}
                    title={INDICATOR_LABEL[user.membership_indicator]}
                    aria-label={INDICATOR_LABEL[user.membership_indicator]}
                    role="img"
                  />
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={ROLE_BADGE_CLASS[user.role]}>
                  {ROLE_LABEL[user.role]}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Alta el {formatDate(user.created_at)}
                </span>
              </div>
            </div>
          </div>

          <Button type="button" onClick={() => setAction("edit")}>
            <PencilLine className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border-border bg-surface-1 backdrop-blur-md">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-5 w-5" />
              Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
            <InfoRow
              icon={Mail}
              label="Email"
              value={user.email ?? "Sin cargar"}
              trailing={
                <ContactVerificationStatus value={user.email} verified={user.email_verified} />
              }
            />
            <InfoRow
              icon={Phone}
              label="Teléfono"
              value={user.phone ?? "Sin cargar"}
              trailing={
                <ContactVerificationStatus value={user.phone} verified={user.phone_verified} />
              }
            />
            <InfoRow
              icon={Cake}
              label="Fecha de nacimiento"
              value={
                user.birth_date
                  ? `${formatDate(user.birth_date)}${user.age != null ? ` (${user.age} años)` : ""}`
                  : "Sin cargar"
              }
            />
            <InfoRow
              icon={Weight}
              label="Peso"
              value={user.weight_kg != null ? `${user.weight_kg} kg` : "Sin cargar"}
            />
            <InfoRow
              icon={Ruler}
              label="Altura"
              value={user.height_cm != null ? `${user.height_cm} cm` : "Sin cargar"}
            />
          </CardContent>
          {canManage && hasPendingContact ? (
            <CardFooter className="border-t border-border pt-4">
              <Button type="button" onClick={() => setAction("verify-contact")}>
                Verificar contacto
              </Button>
            </CardFooter>
          ) : null}
        </Card>

        <div className="space-y-6">
          <Card className="rounded-xl border-border bg-surface-1 backdrop-blur-md">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Calendar className="h-5 w-5" />
                Membresía
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
              <InfoRow
                icon={Calendar}
                label="Estado"
                value={MEMBERSHIP_STATUS_LABEL[user.membership_status]}
              />
              <InfoRow
                icon={Calendar}
                label="Comienzo en el gimnasio"
                value={formatDate(user.membership_start_date)}
              />
              {user.membership_status === "cancelled" ? (
                <InfoRow
                  icon={Calendar}
                  label="Fecha de baja"
                  value={formatDate(user.membership_cancelled_at)}
                />
              ) : null}
            </CardContent>
            {canManage ? (
              <CardFooter className="border-t border-border pt-4">
                {user.membership_status === "active" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                    onClick={() => setAction("cancel-membership")}
                  >
                    Dar de baja la membresía
                  </Button>
                ) : (
                  <Button type="button" onClick={() => setAction("activate-membership")}>
                    {user.membership_status === "none" ? "Activar membresía" : "Reactivar membresía"}
                  </Button>
                )}
              </CardFooter>
            ) : null}
          </Card>

          {isMemberRole ? (
            <Card className="rounded-xl border-border bg-surface-1 backdrop-blur-md">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <ShieldCheck className="h-5 w-5" />
                  Invitación al portal
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <InfoRow
                  icon={ShieldCheck}
                  label="Estado"
                  value={INVITATION_STATUS_LABEL[user.invitation_status]}
                />
              </CardContent>
              {canInvite ? (
                <CardFooter className="border-t border-border pt-4">
                  <Button type="button" onClick={() => setAction("invite")}>
                    {user.invitation_status === "none" ? "Invitar" : "Reenviar invitación"}
                  </Button>
                </CardFooter>
              ) : null}
            </Card>
          ) : null}

          {isMemberRole ? <MemberTemplatesCard user={user} canManage={canManage} /> : null}
        </div>
      </section>

      {action === "edit" ? (
        <EditUserDialog
          open={action === "edit"}
          onOpenChange={(open) => setAction(open ? "edit" : null)}
          user={user}
          onSuccess={invalidateAfterEdit}
        />
      ) : null}

      {action === "cancel-membership" ? (
        <CancelMembershipDialog
          open={action === "cancel-membership"}
          onOpenChange={(open) => setAction(open ? "cancel-membership" : null)}
          user={user}
        />
      ) : null}

      {action === "activate-membership" ? (
        <ActivateMembershipDialog
          open={action === "activate-membership"}
          onOpenChange={(open) => setAction(open ? "activate-membership" : null)}
          user={user}
        />
      ) : null}

      {action === "invite" ? (
        <InviteUserDialog
          open={action === "invite"}
          onOpenChange={(open) => setAction(open ? "invite" : null)}
          user={user}
        />
      ) : null}

      {action === "verify-contact" ? (
        <VerifyContactDialog
          open={action === "verify-contact"}
          onOpenChange={(open) => setAction(open ? "verify-contact" : null)}
          user={user}
        />
      ) : null}
    </div>
  );
}
