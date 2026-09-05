import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataError from "@/components/DataError";
import EditUserDialog from "@/components/EditUserDialog";
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

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-full bg-surface-2/50 p-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

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

          <Button type="button" onClick={() => setEditOpen(true)}>
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
            <InfoRow icon={Mail} label="Email" value={user.email ?? "Sin cargar"} />
            <InfoRow icon={Phone} label="Teléfono" value={user.phone ?? "Sin cargar"} />
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
            </Card>
          ) : null}
        </div>
      </section>

      {editOpen ? (
        <EditUserDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          user={user}
          onSuccess={invalidateAfterEdit}
        />
      ) : null}
    </div>
  );
}
