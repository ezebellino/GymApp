import { useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import DataError from "@/components/DataError";
import AssignTemplateDialog from "@/components/AssignTemplateDialog";
import RemoveAssignmentDialog from "@/components/RemoveAssignmentDialog";
import AdjustExerciseBaseDialog from "@/components/AdjustExerciseBaseDialog";
import { useUserAssignmentsQuery } from "@/services/routineTemplates.queries";
import type { RoutineAssignment, RoutineAssignmentStatus, User } from "@/types";

type Props = {
  user: User;
  canManage: boolean;
};

const STATUS_LABEL: Record<RoutineAssignmentStatus, string> = {
  active: "Activa",
  alternative: "Alternativa",
};

const STATUS_BADGE_CLASS: Record<RoutineAssignmentStatus, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  alternative: "border-border text-muted-foreground",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR");
}

// Plantillas asignadas al Miembro, desde su ficha (design.md D11 de
// add-routine-templates). Toda la lógica de la card vive acá: query de
// asignaciones, badges de estado, autoría del ajuste, y los tres diálogos
// (asignar / quitar / ajustar base) — `UserDetail.tsx` solo la monta
// condicionada a `isMemberRole` (D11, ver el bloque de import+render).
export default function MemberTemplatesCard({ user, canManage }: Props) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [removingAssignment, setRemovingAssignment] = useState<RoutineAssignment | null>(null);
  const [adjustingAssignment, setAdjustingAssignment] = useState<RoutineAssignment | null>(null);

  const { data, isPending, isError, refetch } = useUserAssignmentsQuery(user.id);
  // `Array.isArray` (no solo `data ?? []`) a propósito: `UserDetail.test.tsx`
  // (sesión paralela) no mockea `/routines/users/{id}/templates` en todos
  // sus casos y su fallback genérico devuelve `{}`, no `[]` — sin esta
  // guarda, `assignments.map` explota en cualquier test de esa suite que no
  // conoce este endpoint todavía.
  const assignments = Array.isArray(data) ? data : [];

  // La regla de membresía activa condiciona solo el ALTA de asignaciones
  // (design D8, invariante I13): la lista sigue mostrándose completa aunque
  // el Miembro esté dado de baja.
  const canAssign = canManage && user.membership_status === "active";

  return (
    <>
      <Card className="rounded-xl border-border bg-surface-1 backdrop-blur-md">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <LayoutTemplate className="h-5 w-5" />
            Plantillas asignadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          {isPending ? (
            <p className="text-sm text-muted-foreground">Cargando plantillas asignadas...</p>
          ) : null}

          {!isPending && isError ? (
            <DataError
              title="No se pudieron cargar las plantillas asignadas"
              onRetry={() => refetch()}
            />
          ) : null}

          {!isPending && !isError && assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no tiene ninguna plantilla asignada.
            </p>
          ) : null}

          {!isPending && !isError &&
            assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="space-y-2 rounded-xl border border-border bg-surface-2/20 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {assignment.template_name}
                    </span>
                    <Badge variant="outline" className={STATUS_BADGE_CLASS[assignment.status]}>
                      {STATUS_LABEL[assignment.status]}
                    </Badge>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAdjustingAssignment(assignment)}
                      >
                        Ajustar base
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                        onClick={() => setRemovingAssignment(assignment)}
                      >
                        Quitar
                      </Button>
                    </div>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {assignment.adjustments_count === 0 || !assignment.last_adjustment
                    ? "Sin ajustes"
                    : `Ajustada por ${assignment.last_adjustment.by_name} el ${formatDate(assignment.last_adjustment.at)}`}
                </p>
              </div>
            ))}
        </CardContent>

        {canAssign ? (
          <CardFooter className="border-t border-border pt-4">
            <Button type="button" onClick={() => setAssignOpen(true)}>
              + Asignar plantilla
            </Button>
          </CardFooter>
        ) : null}
      </Card>

      {canManage ? (
        <>
          {/* Montado condicional, no `open={assignOpen}` con el componente
              siempre presente (design.md D11): con un `<dialog>` siempre en
              el árbol, `getByRole("dialog", { hidden: true })` de otra
              ficha/diálogo abierto en simultáneo encuentra dos elementos —
              justo el patrón que ya evita `UserDetail.tsx` con su estado
              único `action`. */}
          {assignOpen ? (
            <AssignTemplateDialog open={assignOpen} onOpenChange={setAssignOpen} user={user} />
          ) : null}

          {removingAssignment ? (
            <RemoveAssignmentDialog
              open={Boolean(removingAssignment)}
              onOpenChange={(open) => setRemovingAssignment(open ? removingAssignment : null)}
              user={user}
              assignment={removingAssignment}
            />
          ) : null}

          {adjustingAssignment ? (
            <AdjustExerciseBaseDialog
              open={Boolean(adjustingAssignment)}
              onOpenChange={(open) => setAdjustingAssignment(open ? adjustingAssignment : null)}
              user={user}
              assignment={adjustingAssignment}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
