import { useEffect, useReducer, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { useExerciseMetaQuery, useExercisesQuery } from "@/services/exercises.queries";
import { usePlannedSetsPreviewQuery } from "@/services/progression.queries";
import { queryKeys } from "@/services/queryKeys";
import { useDebounce } from "@/hooks/useDebounce";
import { useUnsavedChangesStore } from "@/stores/unsavedChanges";
import type { SaveRoutineTemplateDaysInput } from "@/services/routineTemplates";
import {
  MAX_DAYS,
  dayTitle,
  deriveDraftDays,
  draftReducer,
  serializeDraft,
  toSavePayload,
  type DraftDay,
  type DraftExercise,
  type RoutineDaysSource,
} from "@/lib/routineDraft";
import type { Exercise, ProgressionStrategy } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StrategyChips from "@/components/StrategyChips";
import PlannedSetsList from "@/components/PlannedSetsList";
import EditExerciseBaseDialog from "@/components/EditExerciseBaseDialog";
import { cn } from "@/lib/utils";

// Editor de días compartido por la plantilla (`RoutineTemplateDetail.tsx`) y
// la copia de un Miembro (`MemberRoutineEditor.tsx`) — `member-routine-copies`
// design D8: las dos páginas son cáscaras (hero propio, acciones propias,
// query y mutación propias) sobre este componente, que se queda con el
// borrador, la barra de guardado, el diálogo de base, el cálculo de `dirty`,
// el `beforeunload` y el `setDirty` del store global de navegación
// (`stores/unsavedChanges.ts`, leído por `hooks/useGuardedNavigate.ts` en
// cada shell). Extraído tal cual de `RoutineTemplateDetail.tsx`
// (`template-owned-routine-days`, design D11): sin cambio de comportamiento
// para esa página.

type Props = {
  detail: RoutineDaysSource;
  onSave: (payload: SaveRoutineTemplateDaysInput) => Promise<unknown>;
  isSaving: boolean;
  saveError: string | null;
};

export default function RoutineDaysEditor({ detail, onSave, isSaving, saveError }: Props) {
  const [editingBase, setEditingBase] = useState<{ dayKey: string; exercise: DraftExercise } | null>(
    null,
  );
  const { data: meta } = useExerciseMetaQuery();
  const muscleGroupOptions = meta?.muscle_groups ?? [];

  const [draft, dispatch] = useReducer(draftReducer, { days: [], nextKey: 0 });
  const [snapshot, setSnapshot] = useState("[]");
  const queryClient = useQueryClient();

  // Estado inicial derivado del detalle de React Query, cada vez que cambia
  // de identidad (design D11: incluye la respuesta del propio `PUT`, que
  // reemplaza el borrador por la verdad del servidor tras guardar).
  useEffect(() => {
    const days = deriveDraftDays(detail);
    dispatch({ type: "RESET", days });
    setSnapshot(serializeDraft(days));

    // D13 (corrección del gate): siembra la caché de previsualización con
    // los `planned_sets` que ya trajo el detalle, para la tupla inicial de
    // cada ejercicio — la carga inicial hace cero requests de
    // `usePlannedSetsPreviewQuery` y volver a la estrategia original es
    // instantáneo.
    for (const day of days) {
      for (const exercise of day.exercises) {
        queryClient.setQueryData(
          queryKeys.progression.preview({
            strategy: exercise.strategy,
            sets: exercise.base.sets,
            reps: exercise.base.reps,
            weight_kg: exercise.base.weight_kg,
          }),
          exercise.planned_sets,
        );
      }
    }
  }, [detail, queryClient]);

  const dirty = serializeDraft(draft.days) !== snapshot;

  const setGlobalDirty = useUnsavedChangesStore((s) => s.setDirty);
  useEffect(() => {
    setGlobalDirty(dirty);
  }, [dirty, setGlobalDirty]);
  useEffect(() => () => setGlobalDirty(false), [setGlobalDirty]);

  // `beforeunload`: cierre/recarga de pestaña (design D11, residuo conocido
  // de no tener `useBlocker` sin data router).
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  function handleDiscard() {
    const days = deriveDraftDays(detail);
    dispatch({ type: "RESET", days });
  }

  async function handleSave() {
    await onSave(toSavePayload(draft.days));
  }

  return (
    // Mismo layout de dos franjas que `RoutineTemplateDetail.tsx` tenía antes
    // de la extracción (bug de QA sobre `template-owned-routine-days`: la
    // barra de guardado `sticky` tapaba la última card en contenido corto).
    // El alto fijo por `--list-page-height` viene del shell (hoy solo lo usa
    // `RoutineTemplateDetail`, que sigue dentro de un `ListPageLayout`-like
    // wrapper); acá alcanza con reservarle su propio alto vía flexbox.
    <div className="flex flex-col gap-6 lg:h-[var(--list-page-height)]">
      <section className="space-y-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
        {draft.days.map((day, index) => (
          <DayCard
            key={day.key}
            day={day}
            index={index}
            muscleGroupOptions={muscleGroupOptions}
            canRemoveDay={draft.days.length > 1}
            onSetMuscleGroups={(muscleGroups) =>
              dispatch({ type: "SET_DAY_MUSCLE_GROUPS", key: day.key, muscleGroups })
            }
            onRemoveDay={() => dispatch({ type: "REMOVE_DAY", key: day.key })}
            onAddExercise={(exercise) => dispatch({ type: "ADD_EXERCISE", key: day.key, exercise })}
            onRemoveExercise={(exerciseId) =>
              dispatch({ type: "REMOVE_EXERCISE", key: day.key, exerciseId })
            }
            onMoveExercise={(exerciseId, direction) =>
              dispatch({ type: "MOVE_EXERCISE", key: day.key, exerciseId, direction })
            }
            onEditBase={(exercise) => setEditingBase({ dayKey: day.key, exercise })}
            onSetStrategy={(exerciseId, strategy) =>
              dispatch({ type: "SET_EXERCISE_STRATEGY", key: day.key, exerciseId, strategy })
            }
          />
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={() => dispatch({ type: "ADD_DAY" })}
          disabled={draft.days.length >= MAX_DAYS}
          title={draft.days.length >= MAX_DAYS ? "Una rutina admite hasta 5 días" : undefined}
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar día
        </Button>
      </section>

      <div className="shrink-0 space-y-3">
        {saveError ? (
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        ) : null}

        <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface-1/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {dirty ? "Tenés cambios sin guardar." : "No hay cambios sin guardar."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleDiscard} disabled={!dirty}>
              <Undo2 className="mr-2 h-4 w-4" />
              Descartar
            </Button>
            <Button type="button" onClick={handleSave} disabled={!dirty || isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Guardando..." : "Guardar configuración"}
            </Button>
          </div>
        </section>
      </div>

      {editingBase ? (
        <EditExerciseBaseDialog
          open={Boolean(editingBase)}
          onOpenChange={(open) => setEditingBase(open ? editingBase : null)}
          exercise={editingBase.exercise}
          onSave={(base) =>
            dispatch({
              type: "SET_EXERCISE_BASE",
              key: editingBase.dayKey,
              exerciseId: editingBase.exercise.exercise_id,
              base,
            })
          }
        />
      ) : null}
    </div>
  );
}

// --- Card de día ---------------------------------------------------------

type DayCardProps = {
  day: DraftDay;
  index: number;
  muscleGroupOptions: string[];
  canRemoveDay: boolean;
  onSetMuscleGroups: (muscleGroups: string[]) => void;
  onRemoveDay: () => void;
  onAddExercise: (exercise: Exercise) => void;
  onRemoveExercise: (exerciseId: string) => void;
  onMoveExercise: (exerciseId: string, direction: "up" | "down") => void;
  onEditBase: (exercise: DraftExercise) => void;
  onSetStrategy: (exerciseId: string, strategy: ProgressionStrategy) => void;
};

function DayCard({
  day,
  index,
  muscleGroupOptions,
  canRemoveDay,
  onSetMuscleGroups,
  onRemoveDay,
  onAddExercise,
  onRemoveExercise,
  onMoveExercise,
  onEditBase,
  onSetStrategy,
}: DayCardProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const searching = debouncedQuery.trim().length > 0;

  // D8: `is_active=true` en el servidor; "ya agregado" se filtra en el
  // cliente contra el **borrador** de este día, no contra lo persistido.
  const { data, isFetching } = useExercisesQuery({
    q: debouncedQuery.trim() || undefined,
    is_active: true,
    limit: 20,
  });
  const alreadyAdded = new Set(day.exercises.map((exercise) => exercise.exercise_id));
  const results = (data?.items ?? []).filter((exercise) => !alreadyAdded.has(exercise.id));

  function toggleMuscleGroup(group: string) {
    const next = day.muscle_groups.includes(group)
      ? day.muscle_groups.filter((g) => g !== group)
      : [...day.muscle_groups, group];
    onSetMuscleGroups(next);
  }

  return (
    <Card className="rounded-xl border-border bg-surface-1 backdrop-blur-md">
      <CardHeader className="space-y-4 border-b border-border pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-foreground">{dayTitle(index, day.muscle_groups)}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="rounded-full border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50"
            aria-label="Quitar día"
            title={canRemoveDay ? "Quitar día" : "No se puede quitar el único día"}
            disabled={!canRemoveDay}
            onClick={onRemoveDay}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Grupos musculares
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Grupos musculares del Día ${index + 1}`}>
            {muscleGroupOptions.map((group) => {
              const selected = day.muscle_groups.includes(group);
              return (
                <button
                  key={group}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleMuscleGroup(group)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    selected
                      ? "border-primary/40 bg-primary/15 text-primary-strong"
                      : "border-border bg-surface-2/30 text-muted-foreground hover:bg-surface-2/60",
                  )}
                >
                  {group}
                </button>
              );
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-6">
        <div className="relative space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ejercicio para agregar a este día..."
            aria-label={`Buscar ejercicio para el Día ${index + 1}`}
          />
          {searching ? (
            <div className="rounded-lg border border-border bg-surface-2/30">
              {isFetching ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</p>
              ) : (
                <ul className="max-h-56 divide-y divide-border overflow-y-auto">
                  {results.map((exercise) => (
                    <li key={exercise.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-surface-2/60"
                        onClick={() => {
                          onAddExercise(exercise);
                          setQuery("");
                        }}
                      >
                        <span className="text-sm font-medium text-foreground">{exercise.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {exercise.muscle_group ?? "Sin grupo muscular"} ·{" "}
                          {exercise.training_types.length > 0
                            ? exercise.training_types.join(", ")
                            : "Sin tipo de entrenamiento"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        {day.exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay ejercicios cargados para este día. Buscalos arriba para agregarlos.
          </p>
        ) : (
          day.exercises.map((exercise, exerciseIndex) => (
            <div
              key={exercise.exercise_id}
              className="space-y-3 rounded-xl border border-border bg-surface-2/20 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{exercise.name}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {exercise.muscle_group ?? "Sin grupo muscular"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Base: {exercise.base.sets} × {exercise.base.reps} · {exercise.base.weight_kg} kg
                    <button
                      type="button"
                      className="ml-2 underline decoration-dotted underline-offset-2 hover:text-foreground"
                      onClick={() => onEditBase(exercise)}
                    >
                      Editar base
                    </button>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label="Subir ejercicio"
                    title="Subir"
                    disabled={exerciseIndex === 0}
                    onClick={() => onMoveExercise(exercise.exercise_id, "up")}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label="Bajar ejercicio"
                    title="Bajar"
                    disabled={exerciseIndex === day.exercises.length - 1}
                    onClick={() => onMoveExercise(exercise.exercise_id, "down")}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                    aria-label="Quitar ejercicio"
                    title="Quitar"
                    onClick={() => onRemoveExercise(exercise.exercise_id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <StrategyChips
                value={exercise.strategy}
                onChange={(strategy) => onSetStrategy(exercise.exercise_id, strategy)}
              />

              <ExercisePlanPreview exercise={exercise} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// --- Previsualización del plan (design D13) --------------------------------

// Cambiar la estrategia, confirmar una base nueva o agregar un ejercicio
// cambian la tupla `(strategy, sets, reps, weight_kg)` ⇒ cambia la query key
// ⇒ un único fetch, sin una rama de código por acción. Guardar nunca se
// bloquea por esto: ninguna acción de la barra de guardado depende del
// estado de esta query.
function ExercisePlanPreview({ exercise }: { exercise: DraftExercise }) {
  const { data, isFetching, isError, fetchStatus, refetch } = usePlannedSetsPreviewQuery({
    strategy: exercise.strategy,
    sets: exercise.base.sets,
    reps: exercise.base.reps,
    weight_kg: exercise.base.weight_kg,
  });

  if (isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
        <span>No pudimos recalcular la previsualización.</span>
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  // `networkMode: "online"` (default de `queryClient.ts`) pausa el fetch sin
  // conexión: `isFetching` queda en `false` y `data` sigue siendo la tupla
  // vieja. Sin esta rama esa tupla se pinta como si fuera la vigente,
  // violando I19. `isPaused` distingue ese estado del "en vuelo" con su
  // propio texto en vez de reusar "Recalculando…", que sería falso acá.
  const isPaused = fetchStatus === "paused";
  const plannedSets = data ?? [];

  return (
    <div aria-busy={isFetching || isPaused}>
      {isFetching ? (
        <p className="mb-1.5 text-xs text-muted-foreground">Recalculando…</p>
      ) : isPaused ? (
        <p className="mb-1.5 text-xs text-muted-foreground">
          Sin conexión: no pudimos recalcular, este plan puede estar desactualizado.
        </p>
      ) : null}
      <div className={isFetching || isPaused ? "opacity-50" : undefined}>
        <PlannedSetsList plannedSets={plannedSets} />
      </div>
    </div>
  );
}
