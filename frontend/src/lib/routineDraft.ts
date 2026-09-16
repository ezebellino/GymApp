import type { Exercise, ExerciseBase, ProgressionStrategy, RoutineTemplateDay } from "@/types";
import {
  DEFAULT_EXERCISE_BASE,
  type RoutineTemplateDayInput,
  type SaveRoutineTemplateDaysInput,
} from "@/services/routineTemplates";

// Borrador compartido por el editor de días (`member-routine-copies`, design
// D8): plantilla (`RoutineTemplateDetail.tsx`) y copia de un Miembro
// (`MemberRoutineEditor.tsx`) usan el mismo `useReducer`, extraído acá sin
// React para que `RoutineDaysEditor.tsx` sea el único componente que lo
// monta. Movido tal cual desde `RoutineTemplateDetail.tsx`
// (`template-owned-routine-days`, design D11) — sin cambio de comportamiento.

export const MAX_DAYS = 5;

export type DraftExercise = {
  exercise_id: string;
  name: string;
  muscle_group: string | null;
  base: ExerciseBase;
  strategy: ProgressionStrategy;
  // `member-routine-copies` (design D13, corrección del gate): esto NO es
  // "lo que se muestra". El plan mostrado sale de `usePlannedSetsPreviewQuery`
  // en `RoutineDaysEditor.tsx`, con la tupla vigente `(strategy, sets, reps,
  // weight_kg)` del ejercicio. Este campo es solo la **semilla de caché** de
  // la tupla inicial (`RESET` la siembra con `queryClient.setQueryData` para
  // que la carga inicial no pida nada) — cambiar `strategy` o `base` acá no
  // lo recalcula, y no hace falta: la fila deja de leerlo apenas cambia la
  // tupla. No entra en `serializeDraft` ni en `toSavePayload`, y ninguna
  // acción del reducer lo toca — el servidor recalcula al guardar (D6), con
  // la misma función que la previsualización.
  planned_sets: { index: number; weight_kg: number; reps: number; note?: string | null }[];
};

export type DraftDay = {
  // `key` identifica la fila en el cliente (React key + direccionamiento de
  // acciones del reducer): el `day_id` real para un día existente, o
  // `new-<n>` para un día que todavía no se guardó.
  key: string;
  day_id: string | null;
  muscle_groups: string[];
  exercises: DraftExercise[];
};

export type DraftState = {
  days: DraftDay[];
  nextKey: number;
};

export type DraftAction =
  | { type: "RESET"; days: DraftDay[] }
  | { type: "ADD_DAY" }
  | { type: "REMOVE_DAY"; key: string }
  | { type: "SET_DAY_MUSCLE_GROUPS"; key: string; muscleGroups: string[] }
  | { type: "ADD_EXERCISE"; key: string; exercise: Exercise }
  | { type: "REMOVE_EXERCISE"; key: string; exerciseId: string }
  | { type: "MOVE_EXERCISE"; key: string; exerciseId: string; direction: "up" | "down" }
  | { type: "SET_EXERCISE_BASE"; key: string; exerciseId: string; base: ExerciseBase }
  | { type: "SET_EXERCISE_STRATEGY"; key: string; exerciseId: string; strategy: ProgressionStrategy };

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
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

// Cualquier detalle con `days` (plantilla o copia de un Miembro) sirve de
// fuente para derivar el borrador — las dos formas comparten exactamente la
// misma estructura de día/ejercicio (design D1/D8).
export type RoutineDaysSource = { days: RoutineTemplateDay[] };

export function deriveDraftDays(detail: RoutineDaysSource): DraftDay[] {
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
export function serializeDraft(days: DraftDay[]): string {
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

export function toSavePayload(days: DraftDay[]): SaveRoutineTemplateDaysInput {
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

export function dayTitle(index: number, muscleGroups: string[]): string {
  const base = `Día ${index + 1}`;
  return muscleGroups.length > 0 ? `${base} - ${muscleGroups.join("/")}` : base;
}
