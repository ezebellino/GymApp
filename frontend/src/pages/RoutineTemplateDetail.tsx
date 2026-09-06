import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, LayoutTemplate, PencilLine, Trash2 } from "lucide-react";
import {
  useRoutineTemplateQuery,
  useUpdateTemplateExerciseMutation,
} from "@/services/routineTemplates.queries";
import type { RoutineTemplateExercise } from "@/types";
import { useSessionStore } from "@/stores/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataError from "@/components/DataError";
import StrategyChips from "@/components/StrategyChips";
import PlannedSetsList from "@/components/PlannedSetsList";
import EditRoutineTemplateDialog from "@/components/EditRoutineTemplateDialog";
import DeleteRoutineTemplateDialog from "@/components/DeleteRoutineTemplateDialog";
import EditExerciseBaseDialog from "@/components/EditExerciseBaseDialog";

type DetailAction = null | "edit" | "delete";

export default function RoutineTemplateDetail() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const viewerRole = useSessionStore((s) => s.role);
  const isOwner = viewerRole === "owner";

  const [action, setAction] = useState<DetailAction>(null);
  const [editingBaseExercise, setEditingBaseExercise] =
    useState<RoutineTemplateExercise | null>(null);

  const { data: template, isPending, isError, refetch } = useRoutineTemplateQuery(templateId);
  const updateExerciseMutation = useUpdateTemplateExerciseMutation(templateId ?? "");

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <div className="rounded-xl border border-border bg-surface-1/70 px-5 py-4 text-sm text-muted-foreground">
          Cargando plantilla...
        </div>
      </div>
    );
  }

  if (isError || !template) {
    return (
      <DataError
        title="No se pudo cargar la plantilla"
        description="Puede que ya no exista."
        onRetry={() => refetch()}
      />
    );
  }

  function toggleExerciseActive(dayId: string, exercise: RoutineTemplateExercise) {
    updateExerciseMutation.mutate({
      dayId,
      exerciseId: exercise.exercise_id,
      input: { is_active: !exercise.is_active },
    });
  }

  function changeStrategy(
    dayId: string,
    exercise: RoutineTemplateExercise,
    strategy: RoutineTemplateExercise["strategy"]
  ) {
    updateExerciseMutation.mutate({
      dayId,
      exerciseId: exercise.exercise_id,
      input: { strategy },
    });
  }

  return (
    <div className="space-y-6">
      <section className="hero-aura rounded-xl border border-border p-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate("/routines")}
          className="border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Rutinas
        </Button>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/15 p-4 text-primary-strong">
              <LayoutTemplate className="h-7 w-7" />
            </div>
            <div>
              <h1 className="warm-accent-text font-display text-2xl font-extrabold md:text-3xl">
                {template.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{template.tag}</Badge>
                <span className="text-sm text-muted-foreground">
                  {template.days.length} {template.days.length === 1 ? "día" : "días"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setAction("edit")}>
              <PencilLine className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={() => setAction("delete")}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        {template.days.map((day) => (
          <Card key={day.day_id} className="rounded-xl border-border bg-surface-1 backdrop-blur-md">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-foreground">
                {day.name}
                {day.muscle_groups.length > 0 ? (
                  <span className="text-sm font-normal text-muted-foreground">
                    · {day.muscle_groups.join(" / ")}
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {day.exercises.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este día no tiene ejercicios en el catálogo.
                </p>
              ) : (
                day.exercises.map((exercise) => (
                  <div
                    key={exercise.exercise_id}
                    className="space-y-3 rounded-xl border border-border bg-surface-2/20 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{exercise.name}</p>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {exercise.muscle_group}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Base: {exercise.base.sets} × {exercise.base.reps} · {exercise.base.weight_kg} kg
                          {isOwner ? (
                            <button
                              type="button"
                              className="ml-2 underline decoration-dotted underline-offset-2 hover:text-foreground"
                              onClick={() => setEditingBaseExercise(exercise)}
                            >
                              Editar base
                            </button>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Activo</span>
                        <Switch
                          checked={exercise.is_active}
                          disabled={updateExerciseMutation.isPending}
                          onCheckedChange={() => toggleExerciseActive(day.day_id, exercise)}
                          aria-label={`Activar o desactivar ${exercise.name}`}
                        />
                      </div>
                    </div>

                    <StrategyChips
                      value={exercise.strategy}
                      disabled={updateExerciseMutation.isPending}
                      onChange={(strategy) => changeStrategy(day.day_id, exercise, strategy)}
                    />

                    <PlannedSetsList plannedSets={exercise.planned_sets} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      {action === "edit" ? (
        <EditRoutineTemplateDialog
          open={action === "edit"}
          onOpenChange={(open) => setAction(open ? "edit" : null)}
          template={template}
        />
      ) : null}

      {action === "delete" ? (
        <DeleteRoutineTemplateDialog
          open={action === "delete"}
          onOpenChange={(open) => setAction(open ? "delete" : null)}
          template={template}
        />
      ) : null}

      {editingBaseExercise ? (
        <EditExerciseBaseDialog
          open={Boolean(editingBaseExercise)}
          onOpenChange={(open) => setEditingBaseExercise(open ? editingBaseExercise : null)}
          exercise={editingBaseExercise}
        />
      ) : null}
    </div>
  );
}
