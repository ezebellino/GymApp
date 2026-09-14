import { useEffect, useReducer, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  LayoutTemplate,
  PencilLine,
  Plus,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  useRoutineTemplateQuery,
  useSaveRoutineTemplateDaysMutation,
} from "@/services/routineTemplates.queries";
import {
  DEFAULT_EXERCISE_BASE,
  type RoutineTemplateDayInput,
  type SaveRoutineTemplateDaysInput,
} from "@/services/routineTemplates";
import { useExerciseMetaQuery, useExercisesQuery } from "@/services/exercises.queries";
import { useDebounce } from "@/hooks/useDebounce";
import { useGuardedNavigate } from "@/hooks/useGuardedNavigate";
import { useUnsavedChangesStore } from "@/stores/unsavedChanges";
import type {
  Exercise,
  ExerciseBase,
  ProgressionStrategy,
  RoutineTemplateDetail as RoutineTemplateDetailType,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataError from "@/components/DataError";
import StrategyChips from "@/components/StrategyChips";
import PlannedSetsList from "@/components/PlannedSetsList";
import EditRoutineTemplateDialog from "@/components/EditRoutineTemplateDialog";
import DeleteRoutineTemplateDialog from "@/components/DeleteRoutineTemplateDialog";
import EditExerciseBaseDialog from "@/components/EditExerciseBaseDialog";
import ConfirmActionDialog from "@/components/ConfirmActionDialog";
import { toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Detalle de plantilla: el día y sus ejercicios son propios de la plantilla
// (`template-owned-routine-days`, design D1/D5/D11). Todo lo que se edita
// acá vive en un borrador local (`useReducer`) hasta que se confirma
// "Guardar configuración": un único `PUT` de reemplazo completo.

const MAX_DAYS = 5;

type DetailAction = null | "edit" | "delete";

// --- Borrador (design D11) --------------------------------------------------

type DraftExercise = {
  exercise_id: string;
  name: string;
  muscle_group: string | null;
  base: ExerciseBase;
  strategy: ProgressionStrategy;
  planned_sets: { index: number; weight_kg: number; reps: number; note?: string | null }[];
};

type DraftDay = {
  // `key` identifica la fila en el cliente (React key + direccionamiento de
  // acciones del reducer): el `day_id` real para un día existente, o
  // `new-<n>` para un día que todavía no se guardó.
  key: string;
  day_id: string | null;
  muscle_groups: string[];
  exercises: DraftExercise[];
};

type DraftState = {
  days: DraftDay[];
  nextKey: number;
};

type DraftAction =
  | { type: "RESET"; days: DraftDay[] }
  | { type: "ADD_DAY" }
  | { type: "REMOVE_DAY"; key: string }
  | { type: "SET_DAY_MUSCLE_GROUPS"; key: string; muscleGroups: string[] }
  | { type: "ADD_EXERCISE"; key: string; exercise: Exercise }
  | { type: "REMOVE_EXERCISE"; key: string; exerciseId: string }
  | { type: "MOVE_EXERCISE"; key: string; exerciseId: string; direction: "up" | "down" }
  | { type: "SET_EXERCISE_BASE"; key: string; exerciseId: string; base: ExerciseBase }
  | { type: "SET_EXERCISE_STRATEGY"; key: string; exerciseId: string; strategy: ProgressionStrategy };

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "RESET":
      return { days: action.days, nextKey: 0 };

    case "ADD_DAY": {
      if (state.days.length >= MAX_DAYS) return state;
      const day: DraftDay = {
        key: `new-${state.nextKey}`,
        day_id: null,
        muscle_groups: [],
        exercises: [],
      };
      return { days: [...state.days, day], nextKey: state.nextKey + 1 };
    }

    case "REMOVE_DAY": {
      if (state.days.length <= 1) return state;
      return { ...state, days: state.days.filter((day) => day.key !== action.key) };
    }

    case "SET_DAY_MUSCLE_GROUPS":
      return {
        ...state,
        days: state.days.map((day) =>
          day.key === action.key ? { ...day, muscle_groups: action.muscleGroups } : day,
        ),
      };

    case "ADD_EXERCISE":
      return {
        ...state,
        days: state.days.map((day) => {
          if (day.key !== action.key) return day;
          if (day.exercises.some((exercise) => exercise.exercise_id === action.exercise.id)) {
            return day;
          }
          const newExercise: DraftExercise = {
            exercise_id: action.exercise.id,
            name: action.exercise.name,
            muscle_group: action.exercise.muscle_group ?? null,
            base: DEFAULT_EXERCISE_BASE,
            strategy: "constant",
            planned_sets: [],
          };
          return { ...day, exercises: [...day.exercises, newExercise] };
        }),
      };

    case "REMOVE_EXERCISE":
      return {
        ...state,
        days: state.days.map((day) =>
          day.key === action.key
            ? {
                ...day,
                exercises: day.exercises.filter(
                  (exercise) => exercise.exercise_id !== action.exerciseId,
                ),
              }
            : day,
        ),
      };

    case "MOVE_EXERCISE":
      return {
        ...state,
        days: state.days.map((day) => {
          if (day.key !== action.key) return day;
          const index = day.exercises.findIndex((e) => e.exercise_id === action.exerciseId);
          if (index === -1) return day;
          const targetIndex = action.direction === "up" ? index - 1 : index + 1;
          if (targetIndex < 0 || targetIndex >= day.exercises.length) return day;
          const exercises = day.exercises.slice();
          const [moved] = exercises.splice(index, 1);
          exercises.splice(targetIndex, 0, moved);
          return { ...day, exercises };
        }),
      };

    case "SET_EXERCISE_BASE":
      return {
        ...state,
        days: state.days.map((day) =>
          day.key === action.key
            ? {
                ...day,
                exercises: day.exercises.map((exercise) =>
                  exercise.exercise_id === action.exerciseId
                    ? { ...exercise, base: action.base }
                    : exercise,
                ),
              }
            : day,
        ),
      };

    case "SET_EXERCISE_STRATEGY":
      return {
        ...state,
        days: state.days.map((day) =>
          day.key === action.key
            ? {
                ...day,
                exercises: day.exercises.map((exercise) =>
                  exercise.exercise_id === action.exerciseId
                    ? { ...exercise, strategy: action.strategy }
                    : exercise,
                ),
              }
            : day,
        ),
      };

    default:
      return state;
  }
}

function deriveDraftDays(detail: RoutineTemplateDetailType): DraftDay[] {
  return detail.days
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((day) => ({
      key: day.day_id,
      day_id: day.day_id,
      muscle_groups: day.muscle_groups,
      exercises: day.exercises.map((exercise) => ({
        exercise_id: exercise.exercise_id,
        name: exercise.name,
        muscle_group: exercise.muscle_group,
        base: exercise.base,
        strategy: exercise.strategy,
        planned_sets: exercise.planned_sets,
      })),
    }));
}

// Forma canónica para el chequeo de "sucio": solo lo que efectivamente viaja
// en el `PUT` (design D11) — `name`/`muscle_group`/`planned_sets` son
// derivados o informativos, no parte del payload.
function serializeDraft(days: DraftDay[]): string {
  return JSON.stringify(
    days.map((day) => ({
      day_id: day.day_id,
      muscle_groups: day.muscle_groups,
      exercises: day.exercises.map((exercise) => ({
        exercise_id: exercise.exercise_id,
        strategy: exercise.strategy,
        base: exercise.base,
      })),
    })),
  );
}

function toSavePayload(days: DraftDay[]): SaveRoutineTemplateDaysInput {
  const payload: RoutineTemplateDayInput[] = days.map((day) => ({
    day_id: day.day_id,
    muscle_groups: day.muscle_groups,
    exercises: day.exercises.map((exercise) => ({
      exercise_id: exercise.exercise_id,
      strategy: exercise.strategy,
      base: exercise.base,
    })),
  }));
  return { days: payload };
}

function dayTitle(index: number, muscleGroups: string[]): string {
  const base = `Día ${index + 1}`;
  return muscleGroups.length > 0 ? `${base} - ${muscleGroups.join("/")}` : base;
}

// --- Página ------------------------------------------------------------------

export default function RoutineTemplateDetail() {
  const { templateId } = useParams<{ templateId: string }>();

  const [action, setAction] = useState<DetailAction>(null);
  const [editingBase, setEditingBase] = useState<{ dayKey: string; exercise: DraftExercise } | null>(
    null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: template, isPending, isError, refetch } = useRoutineTemplateQuery(templateId);
  const saveMutation = useSaveRoutineTemplateDaysMutation(templateId ?? "");
  const { data: meta } = useExerciseMetaQuery();
  const muscleGroupOptions = meta?.muscle_groups ?? [];

  const [draft, dispatch] = useReducer(draftReducer, { days: [], nextKey: 0 });
  const [snapshot, setSnapshot] = useState("[]");

  // Estado inicial derivado del detalle de React Query, cada vez que cambia
  // de identidad (design D11: incluye la respuesta del propio `PUT`, que
  // reemplaza el borrador por la verdad del servidor tras guardar).
  useEffect(() => {
    if (!template) return;
    const days = deriveDraftDays(template);
    dispatch({ type: "RESET", days });
    setSnapshot(serializeDraft(days));
    setSaveError(null);
  }, [template]);

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

  const { guardedNavigate, isConfirmOpen, confirmDiscardAndLeave, cancelLeave } =
    useGuardedNavigate();

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

  function handleDiscard() {
    if (!template) return;
    const days = deriveDraftDays(template);
    dispatch({ type: "RESET", days });
    setSaveError(null);
  }

  async function handleSave() {
    setSaveError(null);
    try {
      await saveMutation.mutateAsync(toSavePayload(draft.days));
      toastSuccess("Plantilla guardada", "Los días y ejercicios ya están actualizados.");
    } catch (err: any) {
      setSaveError(err?.response?.data?.detail ?? "Error desconocido");
    }
  }

  return (
    // La barra de guardado ya no es `sticky bottom-*`: sobre contenido corto
    // (1-2 días sin muchos ejercicios), `position: sticky` la "engancha" al
    // fondo del viewport apenas el documento excede esa altura por poco, y esa
    // posición no deja lugar de sobra para lo que venga justo antes — termina
    // tapando la cabecera y el botón "Quitar día" de la última card, sin
    // ningún indicio de que hace falta scrollear para despegarla (bug
    // reportado por QA sobre `template-owned-routine-days`). La solución no es
    // subir el z-index de las cards (eso solo cambia QUIÉN tapa a quién): acá
    // el alto de la barra se reserva de verdad repartiendo la página en dos
    // franjas con flexbox — arriba, hero + días con su propio scroll interno
    // (mismo patrón que `ListPageLayout`, reusando `--list-page-height`);
    // abajo, la barra como último ítem `shrink-0`, siempre visible y nunca
    // superpuesta. Por debajo de `lg` se vuelve al flujo normal del
    // documento (sin alto fijo), igual que hace `ListPageLayout`.
    <div className="flex flex-col gap-6 lg:h-[var(--list-page-height)]">
      <div className="space-y-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
        <section className="hero-aura rounded-xl border border-border p-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => guardedNavigate("/routines")}
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
                    {draft.days.length} {draft.days.length === 1 ? "día" : "días"}
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
              onAddExercise={(exercise) =>
                dispatch({ type: "ADD_EXERCISE", key: day.key, exercise })
              }
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
            title={draft.days.length >= MAX_DAYS ? "Una plantilla admite hasta 5 días" : undefined}
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar día
          </Button>
        </section>
      </div>

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
            <Button type="button" onClick={handleSave} disabled={!dirty || saveMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? "Guardando..." : "Guardar configuración"}
            </Button>
          </div>
        </section>
      </div>

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

      {isConfirmOpen ? (
        <ConfirmActionDialog
          open={isConfirmOpen}
          onOpenChange={(open) => !open && cancelLeave()}
          title="Tenés cambios sin guardar"
          description="Si salís ahora se pierden los cambios que hiciste en esta plantilla."
          confirmLabel="Descartar y salir"
          cancelLabel="Seguir editando"
          pendingLabel="Descartar y salir"
          isPending={false}
          onConfirm={confirmDiscardAndLeave}
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

              {exercise.planned_sets.length > 0 ? (
                <PlannedSetsList plannedSets={exercise.planned_sets} />
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
