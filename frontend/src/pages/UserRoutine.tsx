import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Dumbbell, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DataError from "@/components/DataError";
import { useMyTemplateQuery, useMyTemplatesQuery } from "@/services/routineTemplates.queries";
import {
  useMarkSetMutation,
  useMyLoggedExercisesQuery,
  useMyWorkoutLogsQuery,
} from "@/services/routineAssignments.queries";
import type { PlannedSet, RoutineAssignmentStatus, RoutineTemplateExercise } from "@/types";
import { cn, formatDate } from "@/lib/utils";

const STATUS_LABEL: Record<RoutineAssignmentStatus, string> = {
  active: "Activa",
  alternative: "Alternativa",
};

// Ejecución del Miembro (`member-routine-copies`, design D9): reemplaza el
// plan de solo lectura de `template-owned-routine-days`. El Miembro elige
// entre **todas** sus copias asignadas (Activas y Alternativas) — por
// defecto la Activa y, sin ninguna, la más reciente — y marca cada serie
// planificada con el peso y las reps que efectivamente hizo. El plan de
// series lo calcula el backend por completo (invariante I6): acá no hay
// ninguna fórmula de progresión.
//
// Ojo (design D9): `GET /my/overview` y `/my/days` siguen resolviendo por la
// asignación Activa (`member-routine-view`, no tocado por este change) — esta
// pantalla **no** los consume. Se alimenta de `GET /routines/my/templates` +
// `GET /routines/my/templates/{assignment_id}`, que son por asignación.
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
    if (selectedAssignmentId || !assignments || assignments.length === 0) return;
    // Por defecto la Activa si existe; si no, la más reciente — que ya es el
    // primer elemento de la lista (`GET /routines/my/templates` ordena por
    // `created_at desc`, design D6/D9).
    const active = assignments.find((assignment) => assignment.status === "active");
    setSelectedAssignmentId((active ?? assignments[0]).id);
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

  // Único caso del estado vacío (invariante I15): sin ninguna copia
  // asignada, sea Activa o Alternativa.
  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <section className="hero-aura rounded-xl border border-border p-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
            Mi rutina
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Todavía no tenés una rutina asignada
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
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Elegí una copia de rutina">
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
            Cargando la rutina...
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
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Días de la rutina">
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
                {selectedDay?.name ?? "Rutina sin días"}
              </CardTitle>
              {selectedDay && selectedDay.muscle_groups.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {selectedDay.muscle_groups.join(" / ")}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {!selectedDay ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-2/20 p-6 text-sm text-muted-foreground">
                  Esta rutina todavía no tiene días cargados. Consultá con tu coach.
                </div>
              ) : selectedDay.exercises.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-2/20 p-6 text-sm text-muted-foreground">
                  Este día todavía no tiene ejercicios cargados.
                </div>
              ) : (
                selectedDay.exercises.map((exercise) => (
                  <ExerciseExecutionCard
                    key={exercise.exercise_id}
                    dayId={selectedDay.day_id}
                    exercise={exercise}
                    assignmentId={selectedAssignmentId as string}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <HistoryPanel />
    </div>
  );
}

// --- Ejecución por ejercicio (design D9) -----------------------------------

function ExerciseExecutionCard({
  dayId,
  exercise,
  assignmentId,
}: {
  dayId: string;
  exercise: RoutineTemplateExercise;
  assignmentId: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/30 p-4">
      <p className="text-base font-semibold text-foreground">{exercise.name}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {exercise.muscle_group ?? "Sin grupo muscular"}
      </p>
      <ul className="mt-3 space-y-2">
        {exercise.planned_sets.length === 0 ? (
          <li className="text-sm text-muted-foreground">Sin series configuradas.</li>
        ) : (
          exercise.planned_sets.map((set) => (
            <SetExecutionRow
              key={set.index}
              dayId={dayId}
              exerciseId={exercise.exercise_id}
              assignmentId={assignmentId}
              set={set}
            />
          ))
        )}
      </ul>
    </div>
  );
}

// Una fila por serie planificada, **no** por ejercicio (design D9): la lista
// de acciones de marcar es exactamente `planned_sets` — no hay acción para
// agregar una serie extra.
function SetExecutionRow({
  dayId,
  exerciseId,
  assignmentId,
  set,
}: {
  dayId: string;
  exerciseId: string;
  assignmentId: string;
  set: PlannedSet;
}) {
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState(String(set.logged?.weight_kg ?? set.weight_kg));
  const [reps, setReps] = useState(String(set.logged?.reps ?? set.reps));
  const [error, setError] = useState<string | null>(null);
  const markMutation = useMarkSetMutation(assignmentId);

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    // Precarga con lo ya marcado si la serie tiene `logged`; si no, con lo
    // planificado (design D9: corregir es el mismo gesto que marcar).
    setWeight(String(set.logged?.weight_kg ?? set.weight_kg));
    setReps(String(set.logged?.reps ?? set.reps));
    setError(null);
    setOpen(true);
  }

  async function handleSave() {
    setError(null);
    try {
      await markMutation.mutateAsync({
        dayId,
        exerciseId,
        setIndex: set.index,
        input: { weight_kg: Number(weight), reps: Number(reps) },
      });
      setOpen(false);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  return (
    <li className="rounded-lg border border-border bg-surface-1/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {set.logged ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
          ) : null}
          <span className="text-sm font-medium text-foreground">
            #{set.index} · {set.logged ? set.logged.weight_kg : set.weight_kg} kg ×{" "}
            {set.logged ? set.logged.reps : set.reps}
          </span>
          {!set.logged && set.note ? (
            <span className="text-xs text-muted-foreground">({set.note})</span>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={toggleOpen}>
          {set.logged ? "Corregir" : "Marcar"}
        </Button>
      </div>

      {open ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label
              className="text-xs text-muted-foreground"
              htmlFor={`weight-${dayId}-${exerciseId}-${set.index}`}
            >
              Kg
            </label>
            <Input
              id={`weight-${dayId}-${exerciseId}-${set.index}`}
              type="number"
              min={0}
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-24"
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-xs text-muted-foreground"
              htmlFor={`reps-${dayId}-${exerciseId}-${set.index}`}
            >
              Reps
            </label>
            <Input
              id={`reps-${dayId}-${exerciseId}-${set.index}`}
              type="number"
              min={1}
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-20"
            />
          </div>
          <Button type="button" onClick={handleSave} disabled={markMutation.isPending}>
            {markMutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
          {error ? (
            <p role="alert" className="w-full text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

// --- Historial (design D9) --------------------------------------------------

// Panel secundario, colapsado por defecto: sin él, el requirement "esos
// registros SHALL seguir siendo consultables por el Miembro" no tendría
// superficie cuando el ejercicio ya no está en el plan vigente. Mayor 2 del
// `verification.md` (D15): el filtro sale de `GET /routines/my/logged-
// exercises` (histórico completo, sin ventana), no de las filas que trajo
// `/my/logs` — con `limit=40` por default, un ejercicio quitado hace más de
// 40 marcas desaparecía del `<select>`. El ejercicio elegido viaja como
// `exercise_id` al servidor; ya no hay filtro en memoria.
function HistoryPanel() {
  const [open, setOpen] = useState(false);
  const [exerciseId, setExerciseId] = useState("");
  const { data: exerciseOptions } = useMyLoggedExercisesQuery();
  const {
    data: logs,
    isPending,
    isError,
    refetch,
  } = useMyWorkoutLogsQuery({ exercise_id: exerciseId || undefined });

  const filteredLogs = useMemo(() => logs ?? [], [logs]);
  const options = exerciseOptions ?? [];

  return (
    <Card className="border-border bg-surface-1/60 backdrop-blur-xl">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 p-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <History className="h-4 w-4" />
          Historial
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <CardContent className="space-y-3 border-t border-border pt-4">
          {options.length > 0 ? (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="history-exercise-filter">
                Ejercicio
              </label>
              <select
                id="history-exercise-filter"
                value={exerciseId}
                onChange={(e) => setExerciseId(e.target.value)}
                className="w-full max-w-xs rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Todos los ejercicios</option>
                {options.map((option) => (
                  <option key={option.exercise_id} value={option.exercise_id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {isPending ? (
            <p className="text-sm text-muted-foreground">Cargando historial...</p>
          ) : null}

          {!isPending && isError ? (
            <DataError title="No se pudo cargar el historial" onRetry={() => refetch()} />
          ) : null}

          {!isPending && !isError && filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no registraste progreso.</p>
          ) : null}

          {!isPending && !isError && filteredLogs.length > 0 ? (
            <ul className="space-y-1.5">
              {filteredLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/20 px-3 py-2 text-sm"
                >
                  <span className="text-foreground">
                    {log.exercise_name} · #{log.set_index} · {log.weight_kg} kg × {log.reps}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {log.day_name} · {formatDate(log.performed_on)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
