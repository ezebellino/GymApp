import { Fragment, useEffect, useState } from "react";
import { Eye, Info, PencilLine, Search, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useUsersQuery } from "@/services/users.queries";
import { queryKeys } from "@/services/queryKeys";
import type { Role, User } from "@/types";
import ListPageLayout from "@/components/ListPageLayout";
import Pagination from "@/components/Pagination";
import MembershipDot, { INDICATOR_DOT_CLASS, INDICATOR_LABEL } from "@/components/MembershipDot";
import EditUserDialog from "@/components/EditUserDialog";
import CreateUserDialog from "@/components/CreateUserDialog";
import DataError from "@/components/DataError";
import { useDebounce } from "../hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Dueño",
  coach: "Coach",
  member: "Miembro",
};

// Un color por rol, distinto de los que ya significan algo en el indicador de
// membresía (verde/naranja/rojo de `MembershipDot`): "quién es" (rol) y
// "cómo está" (pago) nunca deben competir por el mismo lenguaje visual.
const ROLE_BADGE_CLASS: Record<Role, string> = {
  owner: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-200",
  coach: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  member: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200",
};

const LEGEND_INDICATORS: Array<keyof typeof INDICATOR_DOT_CLASS> = [
  "up_to_date",
  "overdue",
  "suspended",
];

const LEGEND_ROLES: Role[] = ["owner", "coach", "member"];

// Único consumidor hoy: se queda local a `Users.tsx` en vez de extraerse a
// `components/` hasta que aparezca un segundo (dec. 9 del design). Vive en
// el header de la página, fuera del área scrollable de la tabla: `Popover`
// no tiene portal, así que dentro del cuerpo con scroll de la tabla quedaría
// clippeado (ver el comentario de `ui/popover.tsx`).
function LegendPopover() {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Ver leyenda de roles y estados de membresía"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <Info className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-labelledby="legend-popover-title"
        className="w-[min(18rem,calc(100vw-2rem))]"
      >
        <p
          id="legend-popover-title"
          className="text-label-caps uppercase text-muted-foreground"
        >
          Leyenda
        </p>
        <div className="mt-3 space-y-4">
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
                    className={cn(
                      "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                      INDICATOR_DOT_CLASS[indicator]
                    )}
                  />
                  {INDICATOR_LABEL[indicator]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function contactFor(user: User): string {
  return user.email || user.phone || "-";
}

// Header de columnas fijo durante el scroll interno de la tabla (dec. 7 del
// design): `sticky` va en cada `th`, no en el `thead` — con
// `border-collapse: collapse` (el default) varios motores ignoran el sticky
// aplicado a `thead`/`tr`. El fondo tiene que ser opaco: `bg-table-head`
// (dec. 19.3) es el mismo tono que la banda `bg-surface-2/40` de Asistencias,
// pero resuelto a un color opaco vía `color-mix` en `index.css` — con scroll
// debajo, un fondo translúcido dejaría leerse las filas a través del
// encabezado (dec. 7). `font-bold` explícito (dec. 19.2): `TableHead` compone
// `font-medium` en su clase base (`ui/table.tsx`), que pisa el `font-weight:
// bold` que un `<th>` pelado hereda del user-agent — que es como luce el
// encabezado de Asistencias. El borde inferior se dibuja con un `inset
// shadow` porque, otra vez por `border-collapse`, el borde real de una celda
// sticky no se pinta al scrollear.
// `px-4` explícito (hallazgo 2 de verification.md, dec. 21): `TableHead`
// (`ui/table.tsx`) trae `px-2` en su base, mientras las celdas de esta vista
// usan `px-4 py-2` (dec. 10.2, para bajar el alto de fila a 49px); sin este
// override los títulos de columna quedan 8px corridos a la izquierda de su
// contenido. Va acá, no en el default de `TableHead`: es esta vista la que
// se apartó del par `px-2`/`p-2` stock de shadcn en sus celdas, así que la
// corrección vive donde se tomó esa decisión.
const STICKY_HEAD_CLASS =
  "sticky top-0 z-10 bg-table-head px-4 font-bold text-label-caps uppercase text-muted-foreground shadow-[inset_0_-1px_0_var(--border-hairline)]";

function SkeletonRow() {
  return (
    <TableRow className="animate-pulse">
      <TableCell className="px-4 py-2">
        <div className="h-4 w-40 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-32 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-24 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-28 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-28 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-8 w-32 rounded bg-surface-2/40" />
      </TableCell>
    </TableRow>
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
    <Fragment>
      <ListPageLayout
        title="Usuarios"
        titleAdornment={<LegendPopover />}
        count={`${total} ${total === 1 ? "usuario" : "usuarios"}`}
        primaryAction={
          <Button type="button" aria-label="Crear usuario" onClick={() => setCreateUserOpen(true)}>
            <UserPlus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Crear usuario</span>
          </Button>
        }
        toolbar={
          <div className="w-full sm:max-w-md">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nombre, email o teléfono"
                aria-label="Buscar usuarios"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="border-border bg-surface-2/40 pl-10 focus-visible:ring-ring"
              />
            </div>
          </div>
        }
        footer={
          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onChange={({ limit, offset }) => {
              setLimit(limit);
              setOffset(offset);
            }}
          />
        }
      >
        <div
          className={cn(
            "h-full",
            isFetching && isPlaceholderData && "opacity-60 transition-opacity"
          )}
        >
          <Table containerClassName="h-full overflow-auto">
            <TableHeader>
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className={STICKY_HEAD_CLASS}>Nombre</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Contacto</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Rol</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Alta</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Inicio en el gimnasio</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!isPending && isError && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="p-0">
                    <DataError
                      title="No se pudieron cargar los usuarios"
                      description="Intenta nuevamente en unos segundos."
                      onRetry={() => refetch()}
                    />
                  </TableCell>
                </TableRow>
              )}

              {!isPending && !isError && rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState query={debouncedQ} />
                  </TableCell>
                </TableRow>
              )}

              {!isPending && !isError &&
                rows.map((user) => {
                  const contact = contactFor(user);
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="px-4 py-2 whitespace-normal">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <MembershipDot indicator={user.membership_indicator} />
                          {user.full_name}
                        </div>
                      </TableCell>
                      <TableCell
                        className="max-w-[16rem] truncate px-4 py-2 text-muted-foreground"
                        title={contact}
                      >
                        {contact}
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <Badge variant="outline" className={ROLE_BADGE_CLASS[user.role]}>
                          {ROLE_LABEL[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-2 text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString("es-AR")}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-muted-foreground">
                        {user.membership_status !== "none" && user.membership_start_date
                          ? new Date(user.membership_start_date).toLocaleDateString("es-AR")
                          : "-"}
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={`Ver perfil de ${user.full_name}`}
                            title={`Ver perfil de ${user.full_name}`}
                            onClick={() => navigate(`/users/${user.id}`)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={`Editar ${user.full_name}`}
                            title={`Editar ${user.full_name}`}
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setEditUserOpen(true);
                            }}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </ListPageLayout>

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
    </Fragment>
  );
}
