import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  CheckCircle2,
  Dumbbell,
  Flame,
  Save,
  Scale,
  Target,
  TrendingUp,
} from "lucide-react";
import api from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { alertError, alertSuccessAutoClose } from "@/lib/alerts";
import type {
  Client,
  RoutineCatalogGroup,
  RoutineDay,
  RoutineDayProgress,
  WorkoutLog,
} from "@/types";

type ExerciseDraft = {
  sets_count: string;
  reps: string;
  weight_kg: string;
  note: string;
};

const CLIENT_LIMIT = 200;

function emptyDraft(): ExerciseDraft {
  return {
    sets_count: "",
    reps: "",
    weight_kg: "",
    note: "",
  };
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

export default function RoutinesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [days, setDays] = useState<RoutineDay[]>([]);
  const [catalog, setCatalog] = useState<RoutineCatalogGroup[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedDayId, setSelectedDayId] = useState("");
  const [dayProgress, setDayProgress] = useState<RoutineDayProgress[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, ExerciseDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingSelection, setSavingSelection] = useState(false);
  const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null);

  const selectedDay = useMemo(
    () => days.find((day) => day.id === selectedDayId) ?? null,
    [days, selectedDayId]
  );

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  const activeExercises = useMemo(
    () => selectedDay?.exercises.filter((exercise) => exercise.is_active) ?? [],
    [selectedDay]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [clientsResp, daysResp, catalogResp] = await Promise.all([
          api.get<Client[]>("/clients", { params: { limit: CLIENT_LIMIT, offset: 0 } }),
          api.get<RoutineDay[]>("/routines/days"),
          api.get<RoutineCatalogGroup[]>("/routines/catalog"),
        ]);

        const nextClients = clientsResp.data ?? [];
        const nextDays = daysResp.data ?? [];

        setClients(nextClients);
        setDays(nextDays);
        setCatalog(catalogResp.data ?? []);
        if (nextClients[0]) setSelectedClientId(nextClients[0].id);
        if (nextDays[0]) setSelectedDayId(nextDays[0].id);
      } catch (error) {
        console.error("Error cargando rutinas", error);
        await alertError(
          "No se pudo cargar el módulo de rutinas",
          "Revisá la conexión e intentá nuevamente."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedDay) return;

    const nextSelection: Record<string, boolean> = {};
    const nextDrafts: Record<string, ExerciseDraft> = {};
    selectedDay.exercises.forEach((exercise) => {
      nextSelection[exercise.exercise_id] = exercise.is_active;
      nextDrafts[exercise.exercise_id] = drafts[exercise.exercise_id] ?? emptyDraft();
    });
    setSelectedExercises(nextSelection);
    setDrafts(nextDrafts);
  }, [selectedDay]);

  useEffect(() => {
    if (!selectedClientId || !selectedDayId) return;

    (async () => {
      try {
        const [progressResp, logsResp] = await Promise.all([
          api.get<RoutineDayProgress[]>(`/routines/clients/${selectedClientId}/overview`),
          api.get<WorkoutLog[]>(`/routines/clients/${selectedClientId}/logs`, {
            params: { day_id: selectedDayId, limit: 20 },
          }),
        ]);
        setDayProgress(progressResp.data ?? []);
        setLogs(logsResp.data ?? []);
      } catch (error) {
        console.error("Error cargando seguimiento de rutinas", error);
      }
    })();
  }, [selectedClientId, selectedDayId]);

  async function refreshSelectedClientData() {
    if (!selectedClientId || !selectedDayId) return;

    const [progressResp, logsResp] = await Promise.all([
      api.get<RoutineDayProgress[]>(`/routines/clients/${selectedClientId}/overview`),
      api.get<WorkoutLog[]>(`/routines/clients/${selectedClientId}/logs`, {
        params: { day_id: selectedDayId, limit: 20 },
      }),
    ]);
    setDayProgress(progressResp.data ?? []);
    setLogs(logsResp.data ?? []);
  }

  async function saveDaySelection() {
    if (!selectedDayId) return;

    setSavingSelection(true);
    try {
      const selectedIds = (selectedDay?.exercises ?? [])
        .map((exercise) => exercise.exercise_id)
        .filter((exerciseId) => selectedExercises[exerciseId]);

      const { data } = await api.put<RoutineDay>(`/routines/days/${selectedDayId}/selection`, {
        exercise_ids: selectedIds,
      });

      setDays((current) => current.map((day) => (day.id === data.id ? data : day)));
      await refreshSelectedClientData();
      await alertSuccessAutoClose(
        "Plantilla actualizada",
        "Los ejercicios activos de este día ya quedaron guardados."
      );
    } catch (error) {
      console.error("Error guardando selección del día", error);
      await alertError(
        "No se pudo guardar la rutina del día",
        "Intentá nuevamente en unos segundos."
      );
    } finally {
      setSavingSelection(false);
    }
  }

  async function saveExerciseLog(exerciseId: string) {
    if (!selectedClientId || !selectedDayId) return;

    const draft = drafts[exerciseId] ?? emptyDraft();
    setSavingExerciseId(exerciseId);
    try {
      await api.post(`/routines/clients/${selectedClientId}/logs`, {
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
      await refreshSelectedClientData();
      await alertSuccessAutoClose("Registro guardado", "El avance quedó cargado para este ejercicio.");
    } catch (error) {
      console.error("Error guardando avance", error);
      await alertError(
        "No se pudo guardar el avance",
        "Revisá repeticiones, kilos y volvé a intentar."
      );
    } finally {
      setSavingExerciseId(null);
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

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="rounded-2xl border border-amber-200/10 bg-zinc-900/70 px-5 py-4 text-sm text-zinc-300">
          Cargando rutinas...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="rounded-[28px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.1),rgba(255,247,237,0.03)_45%,rgba(249,115,22,0.11))] p-6 shadow-[0_20px_80px_-40px_rgba(249,115,22,0.42)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-amber-100">
                Plan de entrenamiento
              </div>
              <h1 className="warm-accent-text mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                Organiza rutinas por grupos musculares y seguí el progreso de cada cliente.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
                Mini Espacio trabaja con una base común de entrenamiento y desde aquí
                el equipo define qué ejercicios quedan activos para cada día.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4 md:min-w-[280px]">
              <div className="flex items-center gap-3">
                <img
                  src="/mini-espacio-logo.svg"
                  alt="Mini Espacio"
                  className="h-14 w-14 rounded-full object-cover ring-1 ring-white/10"
                />
                <div>
                  <p className="text-sm font-semibold text-zinc-100">Mini Espacio</p>
                  <p className="text-xs uppercase tracking-[0.22em] text-amber-100/80">
                    Rutina base del gimnasio
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                El coach o dueño decide la plantilla del día y cada cliente registra
                repeticiones, series y kilos sobre esa misma estructura.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-amber-200/10 bg-white/[0.035] p-6 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Contexto del módulo</p>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm text-zinc-400">Cliente seleccionado</p>
              <p className="text-lg font-semibold text-zinc-100">
                {selectedClient?.full_name ?? "Sin cliente"}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-400">Día activo</p>
              <p className="text-lg font-semibold text-zinc-100">
                {selectedDay ? `${selectedDay.name} · ${selectedDay.muscle_groups.join(" + ")}` : "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.12),rgba(255,247,237,0.05),rgba(249,115,22,0.12))] p-4 text-sm text-amber-50">
              La plantilla es común para todo el gimnasio y owner/coach pueden decidir
              qué ejercicios quedan activos cada día.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[28px] border-amber-200/10 bg-zinc-900/60 backdrop-blur-xl">
          <CardHeader className="border-b border-amber-200/10 pb-5">
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Target className="h-5 w-5" />
              Contexto de trabajo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Cliente</label>
              <select
                className="w-full rounded-xl border border-amber-200/10 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-amber-400/25"
                value={selectedClientId}
                onChange={(event) => setSelectedClientId(event.target.value)}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3">
              {days.map((day) => {
                const progress = dayProgress.find((item) => item.day_id === day.id);
                const isActive = selectedDayId === day.id;
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setSelectedDayId(day.id)}
                    className={`rounded-[24px] border p-4 text-left transition ${
                      isActive
                        ? "border-amber-300/25 bg-[linear-gradient(135deg,rgba(250,204,21,0.14),rgba(255,247,237,0.04),rgba(249,115,22,0.14))]"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{day.name}</p>
                        <p className="mt-1 text-sm text-zinc-400">{day.muscle_groups.join(" + ")}</p>
                      </div>
                      <div className="rounded-2xl bg-black/15 p-3 text-amber-100">
                        <Dumbbell className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-zinc-300">
                        Ejercicios activos: <span className="font-semibold text-zinc-100">{progress?.active_exercise_count ?? day.exercises.filter((item) => item.is_active).length}</span>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-zinc-300">
                        Último registro: <span className="font-semibold text-zinc-100">{progress?.last_performed_at ? formatDateTime(progress.last_performed_at) : "Sin cargar"}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-amber-200/10 bg-zinc-900/60 backdrop-blur-xl">
          <CardHeader className="border-b border-amber-200/10 pb-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-zinc-100">
                  <CalendarRange className="h-5 w-5" />
                  Plantilla del día
                </CardTitle>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Activá o desactivá ejercicios para {selectedDay?.name ?? "el día"} y dejá la rutina lista para todos los clientes.
                </p>
              </div>
              <Button
                type="button"
                onClick={saveDaySelection}
                disabled={savingSelection || !selectedDay}
                className="border border-amber-300/25 bg-[linear-gradient(90deg,#facc15_0%,#fff7ed_48%,#f97316_100%)] font-medium text-black hover:opacity-95"
              >
                <Save className="mr-2 h-4 w-4" />
                {savingSelection ? "Guardando..." : "Guardar selección"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {selectedDay ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {catalog
                    .filter((group) => selectedDay.muscle_groups.includes(group.muscle_group))
                    .map((group) => (
                      <div
                        key={group.muscle_group}
                        className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-100">{group.muscle_group}</p>
                            <p className="text-xs text-zinc-400">
                              {group.exercises.length} ejercicios disponibles en el catálogo
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white/[0.05] p-3 text-amber-100">
                            <Flame className="h-4 w-4" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          {selectedDay.exercises
                            .filter((exercise) => exercise.muscle_group === group.muscle_group)
                            .map((exercise) => (
                              <label
                                key={exercise.exercise_id}
                                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-zinc-300"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 accent-amber-400"
                                  checked={!!selectedExercises[exercise.exercise_id]}
                                  onChange={(event) =>
                                    setSelectedExercises((current) => ({
                                      ...current,
                                      [exercise.exercise_id]: event.target.checked,
                                    }))
                                  }
                                />
                                <div>
                                  <p className="font-medium text-zinc-100">{exercise.name}</p>
                                  <p className="mt-1 text-xs text-zinc-500">
                                    {selectedExercises[exercise.exercise_id] ? "Activo para el día" : "Fuera de la plantilla activa"}
                                  </p>
                                </div>
                              </label>
                            ))}
                        </div>
                      </div>
                    ))}
                </div>

                <div className="rounded-[24px] border border-amber-200/10 bg-[linear-gradient(135deg,rgba(250,204,21,0.08),rgba(255,247,237,0.02)_50%,rgba(249,115,22,0.08))] p-4">
                  <div className="mb-4 flex items-center gap-2 text-zinc-100">
                    <TrendingUp className="h-5 w-5 text-amber-200" />
                    Cargar avance de {selectedClient?.full_name ?? "cliente"}
                  </div>

                  {activeExercises.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-4 text-sm text-zinc-400">
                      No hay ejercicios activos para este día. Seleccioná algunos y guardá la plantilla.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeExercises.map((exercise) => {
                        const draft = drafts[exercise.exercise_id] ?? emptyDraft();
                        return (
                          <div
                            key={exercise.exercise_id}
                            className="rounded-[24px] border border-white/10 bg-black/10 p-4"
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-zinc-100">{exercise.name}</p>
                                <p className="mt-1 text-xs text-zinc-500">{exercise.muscle_group}</p>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-3 lg:w-[420px]">
                                <Input
                                  type="number"
                                  value={draft.sets_count}
                                  onChange={(event) => updateDraft(exercise.exercise_id, "sets_count", event.target.value)}
                                  placeholder="Series"
                                  className="border-white/10 bg-zinc-900/70"
                                />
                                <Input
                                  type="number"
                                  value={draft.reps}
                                  onChange={(event) => updateDraft(exercise.exercise_id, "reps", event.target.value)}
                                  placeholder="Repeticiones"
                                  className="border-white/10 bg-zinc-900/70"
                                />
                                <div className="relative">
                                  <Scale className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={draft.weight_kg}
                                    onChange={(event) => updateDraft(exercise.exercise_id, "weight_kg", event.target.value)}
                                    placeholder="Kg"
                                    className="border-white/10 bg-zinc-900/70 pl-10"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                              <Input
                                value={draft.note}
                                onChange={(event) => updateDraft(exercise.exercise_id, "note", event.target.value)}
                                placeholder="Nota opcional: tempo, sensación, técnica..."
                                className="border-white/10 bg-zinc-900/70"
                              />
                              <Button
                                type="button"
                                onClick={() => saveExerciseLog(exercise.exercise_id)}
                                disabled={savingExerciseId === exercise.exercise_id}
                                className="border border-amber-300/20 bg-[linear-gradient(90deg,rgba(250,204,21,0.14),rgba(255,247,237,0.06),rgba(249,115,22,0.16))] text-amber-50 hover:opacity-95"
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {savingExerciseId === exercise.exercise_id ? "Guardando..." : "Guardar avance"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[28px] border-amber-200/10 bg-zinc-900/60 backdrop-blur-xl">
        <CardHeader className="border-b border-amber-200/10 pb-5">
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <TrendingUp className="h-5 w-5" />
            Historial del día seleccionado
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[linear-gradient(90deg,rgba(250,204,21,0.08),rgba(255,247,237,0.04),rgba(249,115,22,0.1))] text-left text-zinc-300">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Ejercicio</th>
                    <th className="px-4 py-3">Series</th>
                    <th className="px-4 py-3">Reps</th>
                    <th className="px-4 py-3">Kg</th>
                    <th className="px-4 py-3">Nota</th>
                  </tr>
                </thead>
                <tbody className="bg-zinc-950/30">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-zinc-400">
                        Todavía no hay avances cargados para este cliente en {selectedDay?.name ?? "este día"}.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, index) => (
                      <tr
                        key={log.id}
                        className={`border-t border-white/5 ${index % 2 ? "bg-white/[0.03]" : ""}`}
                      >
                        <td className="px-4 py-3 text-zinc-300">{formatDateTime(log.performed_at)}</td>
                        <td className="px-4 py-3 text-zinc-100">{log.exercise_name}</td>
                        <td className="px-4 py-3 text-zinc-300">{log.sets_count ?? "-"}</td>
                        <td className="px-4 py-3 text-zinc-300">{log.reps ?? "-"}</td>
                        <td className="px-4 py-3 text-zinc-300">{log.weight_kg}</td>
                        <td className="px-4 py-3 text-zinc-400">{log.note || "-"}</td>
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
