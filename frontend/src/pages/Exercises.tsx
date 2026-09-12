import { Fragment, useEffect, useState } from "react";
import { Ban, Dumbbell, PencilLine, RotateCcw, Search, Trash2 } from "lucide-react";
import {
  useActivateExerciseMutation,
  useDeactivateExerciseMutation,
  useDeleteExerciseMutation,
  useExerciseMetaQuery,
  useExercisesQuery,
} from "@/services/exercises.queries";
import { useDebounce } from "@/hooks/useDebounce";
import type { Exercise } from "@/types";
import ListPageLayout from "@/components/ListPageLayout";
import Pagination from "@/components/Pagination";
import DataError from "@/components/DataError";
import RowActionButton from "@/components/RowActionButton";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import CreateExerciseDialog from "@/components/CreateExerciseDialog";
import EditExerciseDialog from "@/components/EditExerciseDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

type StatusFilter = "active" | "inactive" | "all";

// Header sticky, mismo patrón que `MembershipPlans.tsx`/`Users.tsx` (dec. 7
// del design de `redesign-list-page-layout`).
const STICKY_HEAD_CLASS =
  "sticky top-0 z-10 bg-table-head px-4 font-bold text-label-caps uppercase text-muted-foreground shadow-[inset_0_-1px_0_var(--border-hairline)]";

function mediaLabel(exercise: Exercise): string {
  if (exercise.media_kind === "file") return "Archivo propio";
  if (exercise.media_kind === "external") return "URL externa";
  return "Sin media";
}

function SkeletonRow() {
  return (
    <TableRow className="animate-pulse">
      <TableCell className="px-4 py-2">
        <div className="h-4 w-40 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-24 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-32 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-20 rounded bg-surface-2/40" />
      </TableCell>
      <TableCell className="px-4 py-2">
        <div className="h-4 w-16 rounded bg-surface-2/40" />
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
            No encontramos ejercicios que coincidan con{" "}
            <span className="font-medium text-foreground">"{query}"</span>.
          </>
        ) : (
          <>
            Todavía no creaste ningún ejercicio. Creá el primero para poder agregarlo a una
            plantilla de rutina.
          </>
        )}
      </p>
    </div>
  );
}

type DialogAction =
  | null
  | { type: "edit"; exercise: Exercise }
  | { type: "deactivate"; exercise: Exercise }
  | { type: "activate"; exercise: Exercise }
  | { type: "delete"; exercise: Exercise };

export default function Exercises() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 400);
  const [muscleGroup, setMuscleGroup] = useState("");
  const [trainingType, setTrainingType] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [action, setAction] = useState<DialogAction>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ, muscleGroup, trainingType, statusFilter, limit]);

  const isActiveParam =
    statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined;

  const { data, isPending, isFetching, isPlaceholderData, isError, refetch } = useExercisesQuery({
    q: debouncedQ || undefined,
    muscle_group: muscleGroup || undefined,
    training_type: trainingType || undefined,
    is_active: isActiveParam,
    limit,
    offset,
  });

  const { data: meta } = useExerciseMetaQuery();

  const deactivateMutation = useDeactivateExerciseMutation();
  const activateMutation = useActivateExerciseMutation();
  const deleteMutation = useDeleteExerciseMutation();

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  async function handleDeactivate(exercise: Exercise) {
    try {
      await deactivateMutation.mutateAsync(exercise.id);
      setAction(null);
      toastSuccess("Ejercicio desactivado", `${exercise.name} ya no se ofrece en el catálogo activo.`);
    } catch (error: any) {
      toastError(
        "No se pudo desactivar el ejercicio",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    }
  }

  async function handleActivate(exercise: Exercise) {
    try {
      await activateMutation.mutateAsync(exercise.id);
      setAction(null);
      toastSuccess("Ejercicio reactivado", `${exercise.name} vuelve a ofrecerse en el catálogo.`);
    } catch (error: any) {
      toastError(
        "No se pudo reactivar el ejercicio",
        error?.response?.data?.detail ?? "Error desconocido"
      );
    }
  }

  async function handleDelete(exercise: Exercise) {
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(exercise.id);
      setAction(null);
      toastSuccess("Ejercicio borrado", `${exercise.name} se sacó del catálogo.`);
    } catch (error: any) {
      // 409: el ejercicio está en uso — se ofrece desactivar en su lugar
      // (requirement "Borrar un ejercicio que nunca se usó").
      setDeleteError(error?.response?.data?.detail ?? "Error desconocido");
    }
  }

  return (
    <Fragment>
      <ListPageLayout
        title="Ejercicios"
        count={`${total} ${total === 1 ? "ejercicio" : "ejercicios"}`}
        primaryAction={
          <Button type="button" aria-label="Crear ejercicio" onClick={() => setCreateOpen(true)}>
            <Dumbbell className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Crear ejercicio</span>
          </Button>
        }
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:max-w-md">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre"
                  aria-label="Buscar ejercicios"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="border-border bg-surface-2/40 pl-10 focus-visible:ring-ring"
                />
              </div>
            </div>
            <select
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value)}
              aria-label="Filtrar por grupo muscular"
              className="rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos los grupos</option>
              {(meta?.muscle_groups ?? []).map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
            <select
              value={trainingType}
              onChange={(e) => setTrainingType(e.target.value)}
              aria-label="Filtrar por tipo de entrenamiento"
              className="rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos los tipos</option>
              {(meta?.training_types ?? []).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filtrar por estado"
              className="rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
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
                <TableHead className={STICKY_HEAD_CLASS}>Grupo muscular</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Tipos de entrenamiento</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Media</TableHead>
                <TableHead className={STICKY_HEAD_CLASS}>Estado</TableHead>
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
                      title="No se pudieron cargar los ejercicios"
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

              {!isPending &&
                !isError &&
                rows.map((exercise) => (
                  <TableRow key={exercise.id}>
                    <TableCell className="px-4 py-2 font-medium text-foreground">
                      {exercise.name}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">
                      {exercise.muscle_group ?? "-"}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">
                      {exercise.training_types.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {exercise.training_types.map((type) => (
                            <Badge key={type} variant="outline">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">
                      {mediaLabel(exercise)}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <Badge
                        variant="outline"
                        className={
                          exercise.is_active
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                            : "border-border text-muted-foreground"
                        }
                      >
                        {exercise.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <RowActionButton
                          icon={PencilLine}
                          label="Editar"
                          onClick={() => setAction({ type: "edit", exercise })}
                        />
                        {exercise.is_active ? (
                          <RowActionButton
                            icon={Ban}
                            label="Desactivar"
                            tone="destructive"
                            onClick={() => setAction({ type: "deactivate", exercise })}
                          />
                        ) : (
                          <RowActionButton
                            icon={RotateCcw}
                            label="Reactivar"
                            onClick={() => setAction({ type: "activate", exercise })}
                          />
                        )}
                        <RowActionButton
                          icon={Trash2}
                          label="Borrar"
                          tone="destructive"
                          onClick={() => {
                            setDeleteError(null);
                            setAction({ type: "delete", exercise });
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </ListPageLayout>

      <CreateExerciseDialog open={createOpen} onOpenChange={setCreateOpen} />

      {action?.type === "edit" ? (
        <EditExerciseDialog
          open={action.type === "edit"}
          onOpenChange={(open) => setAction(open ? action : null)}
          exercise={action.exercise}
        />
      ) : null}

      {action?.type === "deactivate" ? (
        <ConfirmActionDialog
          open={action.type === "deactivate"}
          onOpenChange={(open) => setAction(open ? action : null)}
          title="Desactivar ejercicio"
          description={`Vas a desactivar "${action.exercise.name}". Deja de ofrecerse para agregar a una plantilla nueva, pero las plantillas y sesiones que ya lo usan lo conservan.`}
          confirmLabel="Desactivar"
          pendingLabel="Desactivando..."
          isPending={deactivateMutation.isPending}
          onConfirm={() => handleDeactivate(action.exercise)}
        />
      ) : null}

      {action?.type === "activate" ? (
        <ConfirmActionDialog
          open={action.type === "activate"}
          onOpenChange={(open) => setAction(open ? action : null)}
          title="Reactivar ejercicio"
          description={`Vas a reactivar "${action.exercise.name}", que vuelve a estar disponible para agregar a una plantilla.`}
          confirmLabel="Reactivar"
          pendingLabel="Reactivando..."
          isPending={activateMutation.isPending}
          onConfirm={() => handleActivate(action.exercise)}
        />
      ) : null}

      {action?.type === "delete" ? (
        // H9 (verificación): si el ejercicio ya estaba inactivo, ofrecer
        // "Desactivar en su lugar" es un callejón sin salida — el backend
        // responde 409 "ya está inactivo" y el diálogo no tiene ningún otro
        // paso que ofrecer. En ese caso el 409 de "está en uso" solo se
        // informa, sin una acción alternativa que también va a fallar.
        (() => {
          const canOfferDeactivate = deleteError != null && action.exercise.is_active;
          return (
            <ConfirmActionDialog
              open={action.type === "delete"}
              onOpenChange={(open) => {
                setAction(open ? action : null);
                if (!open) setDeleteError(null);
              }}
              title="Borrar ejercicio"
              description={
                deleteError
                  ? deleteError
                  : `Vas a borrar "${action.exercise.name}" definitivamente. Esta acción no se puede deshacer.`
              }
              confirmLabel={deleteError ? (canOfferDeactivate ? "Desactivar en su lugar" : "Entendido") : "Borrar"}
              pendingLabel={canOfferDeactivate ? "Desactivando..." : "Borrando..."}
              destructive={!deleteError}
              isPending={deleteMutation.isPending || deactivateMutation.isPending}
              onConfirm={() => {
                if (!deleteError) {
                  handleDelete(action.exercise);
                  return;
                }
                if (canOfferDeactivate) {
                  handleDeactivate(action.exercise);
                  return;
                }
                setAction(null);
              }}
            />
          );
        })()
      ) : null}
    </Fragment>
  );
}
