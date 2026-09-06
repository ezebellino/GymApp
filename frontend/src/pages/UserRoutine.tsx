import { useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DataError from "@/components/DataError";
import PlannedSetsList from "@/components/PlannedSetsList";
import { useMyTemplateQuery, useMyTemplatesQuery } from "@/services/routineTemplates.queries";
import type { RoutineAssignmentStatus } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<RoutineAssignmentStatus, string> = {
  active: "Activa",
  alternative: "Alternativa",
};

// Vista del cliente: solo lectura, sin ninguna acción de marcar serie
// (spec `member-routine-view`, fuera de alcance en `proposal.md`). El plan
// de series lo calcula el backend por completo — invariante I6, no hay
// ninguna fórmula de progresión acá.
export default function UserRoutine() {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | undefined>(undefined);
  const [selectedDayId, setSelectedDayId] = useState<string | undefined>(undefined);

  const {
    data: assignments,
    isPending: assignmentsPending,
    isError: assignmentsError,
    refetch: refetchAssignments,
  } = useMyTemplatesQuery();

  useEffect(() => {
    if (!selectedAssignmentId && assignments && assignments.length > 0) {
      setSelectedAssignmentId(assignments[0].id);
    }
  }, [assignments, selectedAssignmentId]);

  const {
    data: template,
    isPending: templatePending,
    isError: templateError,
    refetch: refetchTemplate,
  } = useMyTemplateQuery(selectedAssignmentId);

  useEffect(() => {
    setSelectedDayId(undefined);
  }, [selectedAssignmentId]);

  useEffect(() => {
    if (!selectedDayId && template && template.days.length > 0) {
      setSelectedDayId(template.days[0].day_id);
    }
  }, [template, selectedDayId]);

  if (assignmentsPending) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="rounded-xl border border-border bg-surface-1/70 px-5 py-4 text-sm text-muted-foreground">
          Cargando tu rutina...
        </div>
      </div>
    );
  }

  if (assignmentsError) {
    return (
      <DataError
        title="No se pudo cargar tu rutina"
        description="Intentá nuevamente en unos instantes."
        onRetry={() => refetchAssignments()}
      />
    );
  }

  const rows = assignments ?? [];

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <section className="hero-aura rounded-xl border border-border p-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            Mi rutina
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Todavía no tenés una plantilla asignada
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cuando tu coach te asigne una, la vas a ver reflejada acá.
          </p>
        </section>
      </div>
    );
  }

  const selectedDay = template?.days.find((day) => day.day_id === selectedDayId) ?? null;

  return (
    <div className="space-y-6">
      <section className="hero-aura rounded-xl border border-border p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
              Mi rutina
            </p>
            <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-foreground">
              Tu plan de entrenamiento
            </h1>
          </div>
        </div>

        {rows.length > 1 ? (
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Elegí una plantilla">
            {rows.map((assignment) => (
              <button
                key={assignment.id}
                type="button"
                aria-pressed={assignment.id === selectedAssignmentId}
                onClick={() => setSelectedAssignmentId(assignment.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  assignment.id === selectedAssignmentId
                    ? "border-primary/40 bg-primary/15 text-primary-strong"
                    : "border-border bg-surface-2/30 text-muted-foreground hover:bg-surface-2/60"
                )}
              >
                {assignment.template_name}
                <Badge variant="outline">{STATUS_LABEL[assignment.status]}</Badge>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <Badge variant="outline">{STATUS_LABEL[rows[0].status]}</Badge>
          </div>
        )}
      </section>

      {templatePending ? (
        <div className="grid min-h-[30vh] place-items-center">
          <div className="rounded-xl border border-border bg-surface-1/70 px-5 py-4 text-sm text-muted-foreground">
            Cargando la plantilla...
          </div>
        </div>
      ) : null}

      {!templatePending && (templateError || !template) ? (
        <DataError
          title="No se pudo cargar el plan"
          description="Intentá nuevamente en unos instantes."
          onRetry={() => refetchTemplate()}
        />
      ) : null}

      {!templatePending && template ? (
        <>
          {template.days.length > 1 ? (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Días de la plantilla">
              {template.days.map((day) => (
                <button
                  key={day.day_id}
                  type="button"
                  role="tab"
                  aria-selected={day.day_id === selectedDayId}
                  onClick={() => setSelectedDayId(day.day_id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    day.day_id === selectedDayId
                      ? "border-primary/40 bg-primary/15 text-primary-strong"
                      : "border-border bg-surface-2/30 text-muted-foreground hover:bg-surface-2/60"
                  )}
                >
                  {day.name}
                </button>
              ))}
            </div>
          ) : null}

          <Card className="border-border bg-surface-1/60 backdrop-blur-xl">
            <CardHeader className="border-b border-border pb-5">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Dumbbell className="h-5 w-5" />
                {selectedDay?.name ?? "Sin días"}
              </CardTitle>
              {selectedDay && selectedDay.muscle_groups.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {selectedDay.muscle_groups.join(" / ")}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {!selectedDay || selectedDay.exercises.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-2/20 p-6 text-sm text-muted-foreground">
                  No hay ejercicios activos para este día.
                </div>
              ) : (
                selectedDay.exercises.map((exercise) => (
                  <div
                    key={exercise.exercise_id}
                    className="rounded-xl border border-border bg-surface-2/30 p-4"
                  >
                    <p className="text-base font-semibold text-foreground">{exercise.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {exercise.muscle_group}
                    </p>
                    <div className="mt-3">
                      <PlannedSetsList plannedSets={exercise.planned_sets} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
