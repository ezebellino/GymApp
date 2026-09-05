import { useEffect, useState } from "react";
import { Eye, MessageCircle, PencilLine, Search, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useUsersQuery } from "@/services/users.queries";
import { queryKeys } from "@/services/queryKeys";
import type { MembershipIndicator, Role, User } from "@/types";
import Pagination from "@/components/Pagination";
import EditUserDialog from "@/components/EditUserDialog";
import CreateUserDialog from "@/components/CreateUserDialog";
import DataError from "@/components/DataError";
import { useDebounce } from "../hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Dueño",
  coach: "Coach",
  member: "Miembro",
};

// Un color por rol, distinto de los que ya significan algo en el indicador de
// membresía (verde/naranja/rojo de abajo): "quién es" (rol) y "cómo está"
// (pago) nunca deben competir por el mismo lenguaje visual.
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

const LEGEND_INDICATORS: Exclude<MembershipIndicator, "none">[] = [
  "up_to_date",
  "overdue",
  "suspended",
];

const LEGEND_ROLES: Role[] = ["owner", "coach", "member"];

function MembershipDot({ indicator }: { indicator: MembershipIndicator }) {
  if (indicator === "none") return null;
  return (
    <span
      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", INDICATOR_DOT_CLASS[indicator])}
      title={INDICATOR_LABEL[indicator]}
      aria-label={INDICATOR_LABEL[indicator]}
      role="img"
    />
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-t border-border">
      <td className="p-4">
        <div className="h-4 w-40 rounded bg-surface-2/40" />
      </td>
      <td className="p-4">
        <div className="h-4 w-24 rounded bg-surface-2/40" />
      </td>
      <td className="p-4">
        <div className="h-4 w-28 rounded bg-surface-2/40" />
      </td>
      <td className="p-4">
        <div className="h-4 w-28 rounded bg-surface-2/40" />
      </td>
      <td className="p-4">
        <div className="h-9 w-40 rounded bg-surface-2/40" />
      </td>
    </tr>
  );
}

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-3 rounded-full border border-border bg-surface-2/30 px-4 py-2 text-label-caps uppercase text-muted-foreground">
        Sin resultados
      </div>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        {query ? (
          <>
            No encontramos usuarios que coincidan con{" "}
            <span className="font-medium text-foreground">"{query}"</span>.
          </>
        ) : (
          <>
            Aun no hay usuarios cargados. Cuando agregues los primeros, los veras
            reflejados aqui.
          </>
        )}
      </p>
    </div>
  );
}

export default function Users() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 400);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  function invalidateUsers() {
    // Editar/crear un usuario invalida tambien payments/attendance: sus filas
    // embeben `user`, asi que un cambio de nombre las deja mintiendo si no se
    // invalidan (dec. 6).
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
  }

  function openPaymentReminder(user: User) {
    if (!user.phone) return;
    const digits = user.phone.replace(/\D/g, "");
    const normalizedPhone = digits.startsWith("54") ? digits : `54${digits}`;
    if (!normalizedPhone) return;

    const message = encodeURIComponent(
      `Hola ${user.full_name}, te escribimos desde Mini Espacio para recordarte el pago pendiente del mes. Si ya abonaste, podes ignorar este mensaje. Gracias.`
    );
    window.open(`https://wa.me/${normalizedPhone}?text=${message}`, "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, limit]);

  const { data, isPending, isFetching, isPlaceholderData, isError, refetch } = useUsersQuery({
    q: debouncedQ || undefined,
    limit,
    offset,
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  // Derivado de `rows`, no un snapshot propio (hallazgo 5 de verification.md):
  // cada `invalidateQueries` que dispara una mutación del diálogo (baja,
  // reactivar, invitar) refetchea esta misma query y `selectedUser` queda al
  // día solo, sin que el diálogo tenga que devolver el usuario actualizado.
  const selectedUser = selectedUserId
    ? rows.find((user) => user.id === selectedUserId) ?? null
    : null;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="hero-aura rounded-xl border border-border p-6">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            Gestión de personas
          </div>
          <h1 className="warm-accent-text font-display mt-4 text-3xl font-extrabold md:text-headline-hero">
            Encontrá y gestioná a todo el equipo y los miembros del gimnasio.
          </h1>
          <p className="mt-3 max-w-2xl text-body-md text-muted-foreground md:text-body-lg">
            Dueños, Coaches y Miembros en un solo listado: perfil, rol y estado de
            membresía a un click de distancia.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" onClick={() => setCreateUserOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Crear usuario
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-1/60 p-6 backdrop-blur-xl">
          <p className="text-label-caps uppercase text-muted-foreground">Leyenda</p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Roles</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {LEGEND_ROLES.map((role) => (
                  <Badge key={role} variant="outline" className={ROLE_BADGE_CLASS[role]}>
                    {ROLE_LABEL[role]}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estado de membresía</p>
              <div className="mt-2 space-y-1.5">
                {LEGEND_INDICATORS.map((indicator) => (
                  <div key={indicator} className="flex items-center gap-2 text-sm text-foreground">
                    <span
                      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", INDICATOR_DOT_CLASS[indicator])}
                    />
                    {INDICATOR_LABEL[indicator]}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Card className="rounded-xl border-border bg-surface-1 p-4 backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Directorio de usuarios
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Navega y filtra tu lista completa con una lectura mas comoda.
              </p>
            </div>
            <div className="w-full sm:max-w-md">
              <label className="mb-2 block text-label-caps uppercase text-muted-foreground">
                Buscar
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nombre, email o teléfono"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="border-border bg-surface-2/40 pl-10 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>

          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onChange={({ limit, offset }) => {
              setLimit(limit);
              setOffset(offset);
            }}
          />
        </div>

        <div
          className={cn(
            "mt-5 overflow-x-auto rounded-xl border border-border",
            isFetching && isPlaceholderData && "opacity-60 transition-opacity"
          )}
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-canvas/70 backdrop-blur-xl">
              <tr className="text-left">
                <th className="p-4 text-label-caps uppercase text-muted-foreground">Nombre completo</th>
                <th className="p-4 text-label-caps uppercase text-muted-foreground">Rol</th>
                <th className="p-4 text-label-caps uppercase text-muted-foreground">Fecha de alta</th>
                <th className="p-4 text-label-caps uppercase text-muted-foreground">Comienzo en el gimnasio</th>
                <th className="p-4 text-label-caps uppercase text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isPending && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!isPending && isError && (
                <tr>
                  <td colSpan={5} className="p-0">
                    <DataError
                      title="No se pudieron cargar los usuarios"
                      description="Intenta nuevamente en unos segundos."
                      onRetry={() => refetch()}
                    />
                  </td>
                </tr>
              )}

              {!isPending && !isError && rows.length === 0 && (
                <tr>
                    <td colSpan={5} className="p-0">
                      <EmptyState query={debouncedQ} />
                    </td>
                  </tr>
              )}

              {!isPending && !isError &&
                rows.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-surface-2/30">
                    <td className="p-4">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <MembershipDot indicator={user.membership_indicator} />
                        {user.full_name}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{user.id}</div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className={ROLE_BADGE_CLASS[user.role]}>
                        {ROLE_LABEL[user.role]}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("es-AR")}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {user.membership_status !== "none" && user.membership_start_date
                        ? new Date(user.membership_start_date).toLocaleDateString("es-AR")
                        : "-"}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/users/${user.id}`)}
                          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2/30 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-surface-2/60"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setEditUserOpen(true);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2/30 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-surface-2/60"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => openPaymentReminder(user)}
                          disabled={!user.phone}
                          className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary-strong transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex justify-end">
          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onChange={({ limit, offset }) => {
              setLimit(limit);
              setOffset(offset);
            }}
          />
        </div>
      </Card>

      {selectedUser ? (
        <EditUserDialog
          open={editUserOpen}
          onOpenChange={setEditUserOpen}
          user={selectedUser}
          onSuccess={invalidateUsers}
        />
      ) : null}

      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        onSuccess={invalidateUsers}
      />
    </div>
  );
}
