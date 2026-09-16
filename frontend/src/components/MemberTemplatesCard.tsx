import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutTemplate, PencilLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import DataError from "@/components/DataError";
import AssignTemplateDialog from "@/components/AssignTemplateDialog";
import RemoveAssignmentDialog from "@/components/RemoveAssignmentDialog";
import RowActionButton from "@/components/RowActionButton";
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

// Copias de rutina asignadas al Miembro, desde su ficha (`member-routine-
// copies`, design D10). Toda la lógica de la card vive acá: query de
// asignaciones, badges de estado, y los dos diálogos (asignar / quitar) — el
// icono Editar navega al editor de la copia (`MemberRoutineEditor.tsx`), sin
// diálogo propio. `UserDetail.tsx` solo la monta condicionada a
// `isMemberRole`.
export default function MemberTemplatesCard({ user, canManage }: Props) {
  const navigate = useNavigate();
  const [assignOpen, setAssignOpen] = useState(false);
  const [removingAssignment, setRemovingAssignment] = useState<RoutineAssignment | null>(null);

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

          {!isPending && !isError && assignments.length > 0 ? (
            <ul className="list-none space-y-3">
              {assignments.map((assignment) => (
                <li
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
                        <RowActionButton
                          icon={PencilLine}
                          label="Editar"
                          onClick={() => navigate(`/users/${user.id}/routine/${assignment.id}`)}
                        />
                        <RowActionButton
                          icon={Trash2}
                          label="Quitar"
                          tone="destructive"
                          onClick={() => setRemovingAssignment(assignment)}
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
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
        </>
      ) : null}
    </>
  );
}
