import { useEffect, useMemo, useState } from "react";
import { Dumbbell, History, Save, Scale, UserRound } from "lucide-react";
import api from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { alertError, alertSuccessAutoClose } from "@/lib/alerts";
import type { Client, RoutineDay, RoutineDayProgress, WorkoutLog } from "@/types";

type ExerciseDraft = {
  sets_count: string;
  reps: string;
  weight_kg: string;
  note: string;
};

function emptyDraft(): ExerciseDraft {
  return { sets_count: "", reps: "", weight_kg: "", note: "" };
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sin registros";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UserRoutine() {
  const [client, setClient] = useState<Client | null>(null);
  const [days, setDays] = useState<RoutineDay[]>([]);
  const [dayProgress, setDayProgress] = useState<RoutineDayProgress[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [selectedDayId, setSelectedDayId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, ExerciseDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null);

  const selectedDay = useMemo(
    () => days.find((day) => day.id === selectedDayId) ?? null,
    [days, selectedDayId]
  );

  const selectedDayProgress = useMemo(
    () => dayProgress.find((item) => item.day_id === selectedDayId) ?? null,
    [dayProgress, selectedDayId]
  );

  const activeExercises = useMemo(
    () =>
      selectedDay?.exercises
        .filter((exercise) => exercise.is_active)
        .sort((left, right) => left.sort_order - right.sort_order) ?? [],
    [selectedDay]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [clientResp, daysResp, overviewResp] = await Promise.all([
          api.get<Client>("/routines/my/client"),
          api.get<RoutineDay[]>("/routines/my/days"),
          api.get<RoutineDayProgress[]>("/routines/my/overview"),
        ]);

        setClient(clientResp.data);
        const fetchedDays = daysResp.data ?? [];
        setDays(fetchedDays);
        setDayProgress(overviewResp.data ?? []);

        if (fetchedDays.length > 0) {
          setSelectedDayId(fetchedDays[0].id);
        }
      } catch (error) {
        console.error("Error cargando rutina del cliente", error);
        await alertError(
          "No se pudo cargar tu rutina",
          "Tu cuenta todavía puede no estar vinculada a un cliente."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedDayId) return;
    void refreshDayLogs(selectedDayId);
  }, [selectedDayId]);

  useEffect(() => {
    if (!selectedDay) return;
    const nextDrafts: Record<string, ExerciseDraft> = {};
    selectedDay.exercises.forEach((exercise) => {
      nextDrafts[exercise.exercise_id] = drafts[exercise.exercise_id] ?? emptyDraft();
    });
    setDrafts(nextDrafts);
  }, [selectedDay]);

  async function refreshDayLogs(dayId: string) {
    try {
      const [logsResp, overviewResp] = await Promise.all([
        api.get<WorkoutLog[]>("/routines/my/logs", {
          params: { day_id: dayId, limit: 30 },
        }),
        api.get<RoutineDayProgress[]>("/routines/my/overview"),
      ]);
      setLogs(logsResp.data ?? []);
      setDayProgress(overviewResp.data ?? []);
    } catch (error) {
      console.error("Error cargando historial", error);
    }
  }

  function updateDraft(exerciseId: string, field: keyof ExerciseDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [exerciseId]: {
        ...(current[exerciseId] ?? emptyDraft()),
        [field]: value,
      },
    }));
  }

  async function saveExerciseLog(exerciseId: string) {
    if (!selectedDayId) return;
    const draft = drafts[exerciseId] ?? emptyDraft();
    setSavingExerciseId(exerciseId);

    try {
      await api.post("/routines/my/logs", {
        day_id: selectedDayId,
        exercise_id: exerciseId,
        sets_count: draft.sets_count ? Number(draft.sets_count) : null,
        reps: draft.reps ? Number(draft.reps) : null,
        weight_kg: draft.weight_kg ? Number(draft.weight_kg) : 0,
        note: draft.note.trim() || null,
      });

      setDrafts((current) => ({
        ...current,
        [exerciseId]: emptyDraft(),
      }));
      await refreshDayLogs(selectedDayId);
      await alertSuccessAutoClose("Registro guardado", "Tu progreso quedó cargado.");
    } catch (error) {
      console.error("Error guardando progreso", error);
      await alertError(
        "No se pudo guardar",
        "Revisá los datos del ejercicio e intentá nuevamente."
      );
    } finally {
      setSavingExerciseId(null);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="rounded-xl border border-border bg-surface-1 px-5 py-4 text-sm text-muted-foreground">
          Cargando tu rutina...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="hero-aura rounded-xl border border-border p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary">
              Vista de usuario
            </p>
            <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-foreground">
              Hola {client?.full_name ?? ""}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Elegí el día, cargá tus ejercicios y mantené tu progreso actualizado.
            </p>
          </div>

          <div className="min-w-[240px]">
            <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-muted-foreground">Día</label>
            <select
              className="w-full rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedDayId}
              onChange={(event) => setSelectedDayId(event.target.value)}
            >
              {days.map((day) => (
                <option key={day.id} value={day.id}>
                  {day.name} · {day.muscle_groups.join(" / ")}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <Card className="border-border bg-surface-1/60 backdrop-blur-xl">
        <CardHeader className="border-b border-border pb-5">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Dumbbell className="h-5 w-5" />
            Rutina del día
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {selectedDayProgress
              ? `${selectedDayProgress.log_count} registros en ${selectedDayProgress.day_name}. Último: ${formatDateTime(selectedDayProgress.last_performed_at)}`
              : "Sin actividad cargada todavía para este día."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {activeExercises.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-2/20 p-6 text-sm text-muted-foreground">
              No hay ejercicios activos para este día.
            </div>
          ) : (
            activeExercises.map((exercise) => {
              const draft = drafts[exercise.exercise_id] ?? emptyDraft();
              return (
                <div key={exercise.exercise_id} className="rounded-xl border border-border bg-surface-2/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-foreground">{exercise.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {exercise.muscle_group}
                      </p>
                    </div>
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <Input
                      type="number"
                      placeholder="Series"
                      value={draft.sets_count}
                      onChange={(event) => updateDraft(exercise.exercise_id, "sets_count", event.target.value)}
                      className="border-border bg-surface-1/70"
                    />
                    <Input
                      type="number"
                      placeholder="Reps"
                      value={draft.reps}
                      onChange={(event) => updateDraft(exercise.exercise_id, "reps", event.target.value)}
                      className="border-border bg-surface-1/70"
                    />
                    <div className="relative">
                      <Scale className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="Kg"
                        value={draft.weight_kg}
                        onChange={(event) => updateDraft(exercise.exercise_id, "weight_kg", event.target.value)}
                        className="border-border bg-surface-1/70 pl-10"
                      />
                    </div>
                    <Input
                      placeholder="Nota"
                      value={draft.note}
                      onChange={(event) => updateDraft(exercise.exercise_id, "note", event.target.value)}
                      className="border-border bg-surface-1/70"
                    />
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => saveExerciseLog(exercise.exercise_id)}
                      disabled={savingExerciseId === exercise.exercise_id}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {savingExerciseId === exercise.exercise_id ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-surface-1/60 backdrop-blur-xl">
        <CardHeader className="border-b border-border pb-5">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <History className="h-5 w-5" />
            Historial reciente del día
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-2/40 text-left text-label-caps uppercase text-muted-foreground">
                  <tr>
                    <th className="border-b border-border px-4 py-3">Fecha</th>
                    <th className="border-b border-border px-4 py-3">Ejercicio</th>
                    <th className="border-b border-border px-4 py-3">Series</th>
                    <th className="border-b border-border px-4 py-3">Reps</th>
                    <th className="border-b border-border px-4 py-3">Kg</th>
                    <th className="border-b border-border px-4 py-3">Nota</th>
                  </tr>
                </thead>
                <tbody className="bg-canvas/30">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        Todavía no registraste ejercicios en este día.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, index) => (
                      <tr key={log.id} className={`border-t border-border ${index % 2 ? "bg-surface-2/30" : ""}`}>
                        <td className="px-4 py-3 text-muted-foreground">{formatDateTime(log.performed_at)}</td>
                        <td className="px-4 py-3 text-foreground">{log.exercise_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{log.sets_count ?? "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{log.reps ?? "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{log.weight_kg}</td>
                        <td className="px-4 py-3 text-muted-foreground">{log.note || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
