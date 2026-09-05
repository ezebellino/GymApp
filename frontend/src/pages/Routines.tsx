import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Dumbbell,
  History,
  PencilLine,
  Plus,
  Save,
  Scale,
  Settings2,
  Target,
  Trash2,
  UserPen,
  UserRound,
} from "lucide-react";
import api from "@/lib/http";
import { useSessionStore } from "@/stores/session";
import EditClientDialog from "@/components/EditClientDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toastError, toastSuccess } from "@/lib/toast";
import { useConfirm } from "@/hooks/useConfirm";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  Client,
  Role,
  RoutineCatalogGroup,
  RoutineDay,
  RoutineDayProgress,
  RoutineExerciseManage,
  WorkoutLog,
} from "@/types";

type ExerciseDraft = {
  sets_count: string;
  reps: string;
  weight_kg: string;
  note: string;
};

const CLIENT_LIMIT = 200;

const outlineButtonClass =
  "border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70";

function emptyDraft(): ExerciseDraft {
  return {
    sets_count: "",
    reps: "",
    weight_kg: "",
    note: "",
  };
}

function draftFromLog(log: WorkoutLog): ExerciseDraft {
  return {
    sets_count: log.sets_count?.toString() ?? "",
    reps: log.reps?.toString() ?? "",
    weight_kg: log.weight_kg?.toString() ?? "",
    note: log.note ?? "",
  };
}

type ExerciseManagerDraft = {
  name: string;
  muscle_group: string;
  description: string;
  is_active: boolean;
};

function emptyExerciseManagerDraft(): ExerciseManagerDraft {
  return {
    name: "",
    muscle_group: "",
    description: "",
    is_active: true,
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

function formatShortDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function RoutinesPage() {
  const viewerRole = (useSessionStore((s) => s.role) ?? "coach") as Role;
  const canManageExercises = viewerRole === "owner";
  const { confirm, ConfirmDialog } = useConfirm();
  const [clients, setClients] = useState<Client[]>([]);
  const [days, setDays] = useState<RoutineDay[]>([]);
  const [catalog, setCatalog] = useState<RoutineCatalogGroup[]>([]);
  const [managedExercises, setManagedExercises] = useState<RoutineExerciseManage[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedDayId, setSelectedDayId] = useState("");
  const [dayProgress, setDayProgress] = useState<RoutineDayProgress[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [metricsLogs, setMetricsLogs] = useState<WorkoutLog[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, ExerciseDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingSelection, setSavingSelection] = useState(false);
  const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showExerciseManager, setShowExerciseManager] = useState(false);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editLogOpen, setEditLogOpen] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<WorkoutLog | null>(null);
  const [editLogDraft, setEditLogDraft] = useState<ExerciseDraft>(emptyDraft());
  const [exerciseDraft, setExerciseDraft] = useState<ExerciseManagerDraft>(
    emptyExerciseManagerDraft()
  );
  const [savingExerciseManager, setSavingExerciseManager] = useState(false);
  const [savingLogEdit, setSavingLogEdit] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [metricsExerciseId, setMetricsExerciseId] = useState("");

  const selectedDay = useMemo(
    () => days.find((day) => day.id === selectedDayId) ?? null,
    [days, selectedDayId]
  );

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId]
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

  const editableGroups = useMemo(() => {
    if (!selectedDay) return [];

    return catalog
      .filter((group) => selectedDay.muscle_groups.includes(group.muscle_group))
      .map((group) => ({
        ...group,
        exercises: selectedDay.exercises.filter(
          (exercise) => exercise.muscle_group === group.muscle_group
        ),
      }));
  }, [catalog, selectedDay]);

  const managedExerciseGroups = useMemo(() => {
    const grouped = managedExercises.reduce<Record<string, RoutineExerciseManage[]>>(
      (accumulator, exercise) => {
        if (!accumulator[exercise.muscle_group]) {
          accumulator[exercise.muscle_group] = [];
        }
        accumulator[exercise.muscle_group].push(exercise);
        return accumulator;
      },
      {}
    );

    return Object.entries(grouped)
      .sort(([left], [right]) => left.localeCompare(right, "es"))
      .map(([muscleGroup, exercises]) => ({
        muscleGroup,
        exercises: [...exercises].sort((left, right) =>
          left.name.localeCompare(right.name, "es")
        ),
      }));
  }, [managedExercises]);

  const metricExercises = useMemo(() => {
    const exerciseMap = new Map<
      string,
      { exercise_id: string; exercise_name: string; muscle_group: string }
    >();

    metricsLogs.forEach((log) => {
      if (!exerciseMap.has(log.exercise_id)) {
        exerciseMap.set(log.exercise_id, {
          exercise_id: log.exercise_id,
          exercise_name: log.exercise_name,
          muscle_group: log.muscle_group,
        });
      }
    });

    return Array.from(exerciseMap.values()).sort((left, right) =>
      left.exercise_name.localeCompare(right.exercise_name, "es")
    );
  }, [metricsLogs]);

  const selectedMetricsExercise =
    metricExercises.find((exercise) => exercise.exercise_id === metricsExerciseId) ?? null;

  const exerciseChartData = useMemo(() => {
    const filteredLogs = metricsExerciseId
      ? metricsLogs.filter((log) => log.exercise_id === metricsExerciseId)
      : [];

    return [...filteredLogs]
      .sort(
        (left, right) =>
          new Date(left.performed_at).getTime() - new Date(right.performed_at).getTime()
      )
      .map((log) => ({
        date: formatShortDate(log.performed_at),
        kg: log.weight_kg,
        reps: log.reps ?? 0,
        sets: log.sets_count ?? 0,
        volume: (log.sets_count ?? 0) * (log.reps ?? 0) * log.weight_kg,
      }));
  }, [metricsExerciseId, metricsLogs]);

  const dayChartData = useMemo(
    () =>
      dayProgress.map((item) => ({
        day: item.day_name.replace("Dia ", "D"),
        registros: item.log_count,
        ejercicios: item.active_exercise_count,
      })),
    [dayProgress]
  );

  const metricsSummary = useMemo(() => {
    const filteredLogs = metricsExerciseId
      ? metricsLogs.filter((log) => log.exercise_id === metricsExerciseId)
      : [];

    const bestWeight = filteredLogs.reduce(
      (current, log) => Math.max(current, log.weight_kg),
      0
    );
    const totalVolume = filteredLogs.reduce(
      (current, log) =>
        current + (log.sets_count ?? 0) * (log.reps ?? 0) * log.weight_kg,
      0
    );
    const lastLog = filteredLogs[filteredLogs.length - 1] ?? null;

    return {
      totalLogs: filteredLogs.length,
      bestWeight,
      totalVolume,
      lastPerformedAt: lastLog?.performed_at ?? null,
    };
  }, [metricsExerciseId, metricsLogs]);

  async function loadClients() {
    const clientsResp = await api.get<Client[]>("/clients", {
      params: { limit: CLIENT_LIMIT, offset: 0 },
    });
    const nextClients = clientsResp.data ?? [];
    setClients(nextClients);

    if (!selectedClientId && nextClients[0]) {
      setSelectedClientId(nextClients[0].id);
    }

    if (
      selectedClientId &&
      !nextClients.some((client) => client.id === selectedClientId) &&
      nextClients[0]
    ) {
      setSelectedClientId(nextClients[0].id);
    }

    return nextClients;
  }

  async function loadRoutineConfiguration() {
    const [daysResp, catalogResp, exercisesResp] = await Promise.all([
      api.get<RoutineDay[]>("/routines/days"),
      api.get<RoutineCatalogGroup[]>("/routines/catalog"),
      api.get<RoutineExerciseManage[]>("/routines/exercises"),
    ]);

    const nextDays = daysResp.data ?? [];
    setDays(nextDays);
    setCatalog(catalogResp.data ?? []);
    setManagedExercises(exercisesResp.data ?? []);

    if (!selectedDayId && nextDays[0]) {
      setSelectedDayId(nextDays[0].id);
      return nextDays;
    }

    if (selectedDayId && !nextDays.some((day) => day.id === selectedDayId) && nextDays[0]) {
      setSelectedDayId(nextDays[0].id);
    }

    return nextDays;
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [nextClients, nextDays] = await Promise.all([
          loadClients(),
          loadRoutineConfiguration(),
        ]);

        if (nextClients[0]) setSelectedClientId(nextClients[0].id);
        if (nextDays[0]) setSelectedDayId(nextDays[0].id);
      } catch (error) {
        console.error("Error cargando rutinas", error);
        toastError(
          "No se pudo cargar el modulo de rutinas",
          "Revisa la conexion e intenta nuevamente."
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

    void refreshSelectedClientData();
  }, [selectedClientId, selectedDayId]);

  async function refreshSelectedClientData() {
    if (!selectedClientId || !selectedDayId) return;

    try {
      const [progressResp, logsResp, metricsResp] = await Promise.all([
        api.get<RoutineDayProgress[]>(`/routines/clients/${selectedClientId}/overview`),
        api.get<WorkoutLog[]>(`/routines/clients/${selectedClientId}/logs`, {
          params: { day_id: selectedDayId, limit: 20 },
        }),
        api.get<WorkoutLog[]>(`/routines/clients/${selectedClientId}/logs`, {
          params: { limit: 200 },
        }),
      ]);
      setDayProgress(progressResp.data ?? []);
      setLogs(logsResp.data ?? []);
      setMetricsLogs(metricsResp.data ?? []);
    } catch (error) {
      console.error("Error cargando seguimiento de rutinas", error);
    }
  }

  useEffect(() => {
    if (!metricExercises.length) {
      if (metricsExerciseId) setMetricsExerciseId("");
      return;
    }

    const exists = metricExercises.some(
      (exercise) => exercise.exercise_id === metricsExerciseId
    );
    if (!metricsExerciseId || !exists) {
      setMetricsExerciseId(metricExercises[0].exercise_id);
    }
  }, [metricExercises, metricsExerciseId]);

  async function saveDaySelection() {
    if (!selectedDayId || !selectedDay) return;

    setSavingSelection(true);
    try {
      const selectedIds = selectedDay.exercises
        .map((exercise) => exercise.exercise_id)
        .filter((exerciseId) => selectedExercises[exerciseId]);

      const { data } = await api.put<RoutineDay>(
        `/routines/days/${selectedDayId}/selection`,
        { exercise_ids: selectedIds }
      );

      setDays((current) => current.map((day) => (day.id === data.id ? data : day)));
      await refreshSelectedClientData();
      toastSuccess(
        "Plantilla actualizada",
        "La rutina del dia ya quedo guardada."
      );
      setShowTemplateEditor(false);
    } catch (error) {
      console.error("Error guardando seleccion del dia", error);
      toastError(
        "No se pudo guardar la rutina del dia",
        "Intenta nuevamente en unos segundos."
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
      toastSuccess("Registro guardado", "El avance quedo cargado.");
    } catch (error) {
      console.error("Error guardando avance", error);
      toastError(
        "No se pudo guardar el avance",
        "Revisa repeticiones, kilos y vuelve a intentar."
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

  function openCreateExerciseDialog(muscleGroup?: string) {
    setEditingExerciseId(null);
    setExerciseDraft({
      ...emptyExerciseManagerDraft(),
      muscle_group: muscleGroup ?? selectedDay?.muscle_groups[0] ?? "",
    });
    setExerciseDialogOpen(true);
  }

  function openEditExerciseDialog(exercise: RoutineExerciseManage) {
    setEditingExerciseId(exercise.id);
    setExerciseDraft({
      name: exercise.name,
      muscle_group: exercise.muscle_group,
      description: exercise.description ?? "",
      is_active: exercise.is_active,
    });
    setExerciseDialogOpen(true);
  }

  async function saveManagedExercise() {
    if (!exerciseDraft.name.trim() || !exerciseDraft.muscle_group.trim()) {
      toastError(
        "Faltan datos del ejercicio",
        "Completa al menos nombre y grupo muscular."
      );
      return;
    }

    setSavingExerciseManager(true);
    try {
      if (editingExerciseId) {
        await api.put(`/routines/exercises/${editingExerciseId}`, {
          name: exerciseDraft.name,
          muscle_group: exerciseDraft.muscle_group,
          description: exerciseDraft.description.trim() || null,
          is_active: exerciseDraft.is_active,
        });
      } else {
        await api.post("/routines/exercises", {
          name: exerciseDraft.name,
          muscle_group: exerciseDraft.muscle_group,
          description: exerciseDraft.description.trim() || null,
          is_active: exerciseDraft.is_active,
        });
      }

      await loadRoutineConfiguration();
      setExerciseDialogOpen(false);
      setEditingExerciseId(null);
      setExerciseDraft(emptyExerciseManagerDraft());
      toastSuccess(
        editingExerciseId ? "Ejercicio actualizado" : "Ejercicio agregado",
        "La plantilla ya quedo lista para usarse."
      );
    } catch (error) {
      console.error("Error guardando ejercicio", error);
      toastError(
        "No se pudo guardar el ejercicio",
        "Revisa los datos e intenta nuevamente."
      );
    } finally {
      setSavingExerciseManager(false);
    }
  }

  function openEditLogDialog(log: WorkoutLog) {
    setEditingLog(log);
    setEditLogDraft(draftFromLog(log));
    setEditLogOpen(true);
  }

  async function saveLogEdit() {
    if (!selectedClientId || !editingLog) return;

    setSavingLogEdit(true);
    try {
      await api.patch(`/routines/clients/${selectedClientId}/logs/${editingLog.id}`, {
        sets_count: editLogDraft.sets_count ? Number(editLogDraft.sets_count) : null,
        reps: editLogDraft.reps ? Number(editLogDraft.reps) : null,
        weight_kg: editLogDraft.weight_kg ? Number(editLogDraft.weight_kg) : 0,
        note: editLogDraft.note.trim() || null,
      });

      await refreshSelectedClientData();
      setEditLogOpen(false);
      setEditingLog(null);
      setEditLogDraft(emptyDraft());
      toastSuccess(
        "Registro actualizado",
        "Los datos del avance ya quedaron corregidos."
      );
    } catch (error) {
      console.error("Error actualizando avance", error);
      toastError(
        "No se pudo actualizar el avance",
        "Revisa los datos y vuelve a intentar."
      );
    } finally {
      setSavingLogEdit(false);
    }
  }

  async function deleteLog(log: WorkoutLog) {
    if (!selectedClientId) return;

    const confirmed = await confirm(
      "Eliminar avance",
      `Se eliminara el registro de ${log.exercise_name} del ${formatDateTime(log.performed_at)}.`
    );

    if (!confirmed) return;

    setDeletingLogId(log.id);
    try {
      await api.delete(`/routines/clients/${selectedClientId}/logs/${log.id}`);
      await refreshSelectedClientData();
      setEditLogOpen(false);
      if (editingLog?.id === log.id) {
        setEditingLog(null);
        setEditLogDraft(emptyDraft());
      }
      toastSuccess(
        "Registro eliminado",
        "El avance ya no forma parte del historial."
      );
    } catch (error) {
      console.error("Error eliminando avance", error);
      toastError(
        "No se pudo eliminar el avance",
        "Intenta nuevamente en unos segundos."
      );
    } finally {
      setDeletingLogId(null);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="rounded-xl border border-border bg-surface-1/70 px-5 py-4 text-sm text-muted-foreground">
          Cargando rutinas...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ConfirmDialog}
      <section className="hero-aura rounded-xl border border-border p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-label-caps uppercase text-primary-strong">
              Rutinas simples
            </div>
            <h1 className="warm-accent-text mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
              Elegi un dia, revisa la rutina y carga el avance del cliente.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">
              La experiencia esta pensada para usarla rapido: primero elegis el
              cliente, despues el dia de entrenamiento y por ultimo registras reps,
              series y kilos.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface-2/20 p-4 lg:min-w-[280px]">
            <div className="flex items-center gap-3">
              <img
                src="/mini-espacio-logo.svg"
                alt="Mini Espacio"
                className="h-14 w-14 rounded-full object-cover ring-1 ring-border"
              />
              <div>
                <p className="text-sm font-semibold text-foreground">Mini Espacio</p>
                <p className="text-xs uppercase tracking-[0.22em] text-primary-strong/80">
                  Entrenamiento personalizado
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Una misma estructura base para todos, con seguimiento individual por
              cliente y por ejercicio.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-xl border-border bg-surface-1/60 backdrop-blur-xl">
          <CardHeader className="border-b border-border pb-5">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <UserRound className="h-5 w-5" />
              Cliente y dia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Cliente</label>
              <select
                className="w-full rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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

            <div className="grid gap-3 sm:grid-cols-2">
              {days.map((day) => {
                const progress = dayProgress.find((item) => item.day_id === day.id);
                const isActive = selectedDayId === day.id;

                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setSelectedDayId(day.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      isActive
                        ? "border-primary/30 bg-primary/10"
                        : "border-border bg-surface-2/20 hover:bg-surface-2/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{day.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {day.muscle_groups.join(" + ")}
                        </p>
                      </div>
                      <div className="rounded-xl bg-primary/15 p-3 text-primary-strong">
                        <Dumbbell className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                      <div className="rounded-xl border border-border bg-surface-2/20 px-3 py-2">
                        Ejercicios activos:{" "}
                        <span className="font-semibold text-foreground">
                          {progress?.active_exercise_count ??
                            day.exercises.filter((item) => item.is_active).length}
                        </span>
                      </div>
                      <div className="rounded-xl border border-border bg-surface-2/20 px-3 py-2">
                        Ultimo registro:{" "}
                        <span className="font-semibold text-foreground">
                          {progress?.last_performed_at
                            ? formatDateTime(progress.last_performed_at)
                            : "Sin cargar"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border bg-surface-1/60 backdrop-blur-xl">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Target className="h-5 w-5" />
              Resumen rapido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6 text-sm text-muted-foreground">
            <div>
              <p className="text-muted-foreground">Cliente actual</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-foreground">
                  {selectedClient?.full_name ?? "Sin cliente"}
                </p>
                {selectedClient ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditClientOpen(true)}
                    className={outlineButtonClass}
                  >
                    <UserPen className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                ) : null}
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">Dia elegido</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {selectedDay
                  ? `${selectedDay.name} · ${selectedDay.muscle_groups.join(" + ")}`
                  : "-"}
              </p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-foreground">
              <p>
                Ejercicios activos:{" "}
                <span className="font-semibold">{activeExercises.length}</span>
              </p>
              <p className="mt-2">
                Registros del dia:{" "}
                <span className="font-semibold">
                  {selectedDayProgress?.log_count ?? 0}
                </span>
              </p>
            </div>
            <p>
              Si necesitas cambiar la rutina del dia, usa el bloque{" "}
              <span className="font-medium text-foreground">Editar plantilla</span>{" "}
              que aparece mas abajo.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-xl border-border bg-surface-1/60 backdrop-blur-xl">
        <CardHeader className="border-b border-border pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <ClipboardList className="h-5 w-5" />
                Rutina del dia
              </CardTitle>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Carga el avance ejercicio por ejercicio sin salir de esta pantalla.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTemplateEditor((current) => !current)}
              className={outlineButtonClass}
            >
              {showTemplateEditor ? (
                <ChevronUp className="mr-2 h-4 w-4" />
              ) : (
                <ChevronDown className="mr-2 h-4 w-4" />
              )}
              {showTemplateEditor ? "Ocultar edicion" : "Editar plantilla"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {activeExercises.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface-2/20 px-4 py-5 text-sm text-muted-foreground">
              No hay ejercicios activos para este dia. Abre "Editar plantilla",
              selecciona algunos ejercicios y guarda los cambios.
            </div>
          ) : (
            <div className="space-y-4">
              {activeExercises.map((exercise) => {
                const draft = drafts[exercise.exercise_id] ?? emptyDraft();

                return (
                  <div
                    key={exercise.exercise_id}
                    className="rounded-xl border border-border bg-surface-2/20 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-foreground">
                          {exercise.name}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {exercise.muscle_group}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3 lg:w-[420px]">
                        <Input
                          type="number"
                          value={draft.sets_count}
                          onChange={(event) =>
                            updateDraft(
                              exercise.exercise_id,
                              "sets_count",
                              event.target.value
                            )
                          }
                          placeholder="Series"
                        />
                        <Input
                          type="number"
                          value={draft.reps}
                          onChange={(event) =>
                            updateDraft(exercise.exercise_id, "reps", event.target.value)
                          }
                          placeholder="Reps"
                        />
                        <div className="relative">
                          <Scale className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={draft.weight_kg}
                            onChange={(event) =>
                              updateDraft(
                                exercise.exercise_id,
                                "weight_kg",
                                event.target.value
                              )
                            }
                            placeholder="Kg"
                            className="pl-10"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <Input
                        value={draft.note}
                        onChange={(event) =>
                          updateDraft(exercise.exercise_id, "note", event.target.value)
                        }
                        placeholder="Nota opcional"
                      />
                      <Button
                        type="button"
                        onClick={() => saveExerciseLog(exercise.exercise_id)}
                        disabled={savingExerciseId === exercise.exercise_id}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {savingExerciseId === exercise.exercise_id
                          ? "Guardando..."
                          : "Guardar avance"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showTemplateEditor ? (
            <div className="warm-accent-bg rounded-xl border border-primary/20 p-4">
              <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Editar plantilla del dia
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Activa o desactiva ejercicios para {selectedDay?.name ?? "este dia"}.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={saveDaySelection}
                  disabled={savingSelection || !selectedDay}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {savingSelection ? "Guardando..." : "Guardar plantilla"}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {editableGroups.map((group) => (
                  <div
                    key={group.muscle_group}
                    className="rounded-xl border border-border bg-surface-2/20 p-4"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {group.muscle_group}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {group.exercises.length} ejercicios disponibles
                    </p>

                    <div className="mt-3 space-y-2">
                      {group.exercises.map((exercise) => (
                        <label
                          key={exercise.exercise_id}
                          className="flex items-start gap-3 rounded-xl border border-border bg-surface-2/20 px-3 py-3 text-sm text-muted-foreground"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 accent-primary"
                            checked={!!selectedExercises[exercise.exercise_id]}
                            onChange={(event) =>
                              setSelectedExercises((current) => ({
                                ...current,
                                [exercise.exercise_id]: event.target.checked,
                              }))
                            }
                          />
                          <div>
                            <p className="font-medium text-foreground">{exercise.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {selectedExercises[exercise.exercise_id]
                                ? "Activo para este dia"
                                : "No activo"}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {canManageExercises ? (
            <div className="rounded-xl border border-border bg-surface-2/20 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Gestion de ejercicios
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Agrega ejercicios nuevos o corrige nombres y grupos musculares
                    sin tocar la base manualmente.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowExerciseManager((current) => !current)}
                    className={outlineButtonClass}
                  >
                    <Settings2 className="mr-2 h-4 w-4" />
                    {showExerciseManager ? "Ocultar gestion" : "Gestionar ejercicios"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => openCreateExerciseDialog()}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo ejercicio
                  </Button>
                </div>
              </div>

              {showExerciseManager ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {managedExerciseGroups.map((group) => (
                    <div
                      key={group.muscleGroup}
                      className="rounded-xl border border-border bg-surface-2/20 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {group.muscleGroup}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {group.exercises.length} ejercicios cargados
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openCreateExerciseDialog(group.muscleGroup)}
                          className={outlineButtonClass}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Agregar
                        </Button>
                      </div>

                      <div className="mt-3 space-y-2">
                        {group.exercises.map((exercise) => (
                          <div
                            key={exercise.id}
                            className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-2/20 px-3 py-3"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">
                                {exercise.name}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {exercise.is_active ? "Disponible" : "Oculto"} ·{" "}
                                {exercise.day_ids.length} dias vinculados
                              </p>
                              {exercise.description ? (
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                  {exercise.description}
                                </p>
                              ) : null}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditExerciseDialog(exercise)}
                              className="shrink-0 text-muted-foreground hover:bg-surface-2/70 hover:text-foreground"
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border bg-surface-1/60 backdrop-blur-xl">
        <CardHeader className="border-b border-border pb-5">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <BarChart3 className="h-5 w-5" />
            Progreso del cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-xl border border-border bg-surface-2/20 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Evolucion por ejercicio
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Mira rapido como viene subiendo la carga del cliente ejercicio por ejercicio.
                  </p>
                </div>
                <div className="min-w-[220px]">
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Ejercicio
                  </label>
                  <select
                    className="w-full rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={metricsExerciseId}
                    onChange={(event) => setMetricsExerciseId(event.target.value)}
                  >
                    {metricExercises.map((exercise) => (
                      <option key={exercise.exercise_id} value={exercise.exercise_id}>
                        {exercise.exercise_name} · {exercise.muscle_group}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-5 h-72">
                {exerciseChartData.length === 0 ? (
                  <div className="grid h-full place-items-center rounded-xl border border-dashed border-border bg-surface-2/20 text-sm text-muted-foreground">
                    Todavia no hay suficientes datos para graficar este ejercicio.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={exerciseChartData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border-hairline)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface-1)",
                          border: "1px solid var(--border-hairline)",
                          borderRadius: 16,
                          color: "var(--foreground)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="kg"
                        name="Kg"
                        stroke="var(--primary)"
                        strokeWidth={3}
                        dot={{ r: 3, fill: "var(--foreground)" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface-2/20 p-4">
                <p className="text-sm font-semibold text-foreground">Resumen del ejercicio</p>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-xl border border-border bg-surface-2/20 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Registros
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {metricsSummary.totalLogs}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-2/20 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Mejor carga
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {metricsSummary.bestWeight} kg
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-2/20 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Volumen acumulado
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {metricsSummary.totalVolume.toLocaleString("es-AR")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-2/20 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Ultimo registro
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {formatDateTime(metricsSummary.lastPerformedAt)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedMetricsExercise
                        ? `${selectedMetricsExercise.exercise_name} · ${selectedMetricsExercise.muscle_group}`
                        : "Selecciona un ejercicio para ver detalle"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-2/20 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Registros por dia de entrenamiento
                </p>
                <div className="mt-4 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayChartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border-hairline)" vertical={false} />
                      <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface-1)",
                          border: "1px solid var(--border-hairline)",
                          borderRadius: 16,
                          color: "var(--foreground)",
                        }}
                      />
                      <Bar dataKey="registros" name="Registros" fill="var(--primary-strong)" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border bg-surface-1/60 backdrop-blur-xl">
        <CardHeader className="border-b border-border pb-5">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <History className="h-5 w-5" />
            Historial reciente
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-label-caps uppercase text-muted-foreground">
                  <tr>
                    <th className="border-b border-border px-4 py-3">Fecha</th>
                    <th className="border-b border-border px-4 py-3">Ejercicio</th>
                    <th className="border-b border-border px-4 py-3">Series</th>
                    <th className="border-b border-border px-4 py-3">Reps</th>
                    <th className="border-b border-border px-4 py-3">Kg</th>
                    <th className="border-b border-border px-4 py-3">Nota</th>
                    <th className="border-b border-border px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        Todavia no hay avances cargados para este cliente en{" "}
                        {selectedDay?.name ?? "este dia"}.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, index) => (
                      <tr
                        key={log.id}
                        className={index % 2 ? "bg-surface-2/30" : ""}
                      >
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDateTime(log.performed_at)}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {log.exercise_name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {log.sets_count ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {log.reps ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {log.weight_kg}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{log.note || "-"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => openEditLogDialog(log)}
                              className={outlineButtonClass}
                            >
                              <PencilLine className="mr-2 h-4 w-4" />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => deleteLog(log)}
                              disabled={deletingLogId === log.id}
                              className="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 disabled:opacity-60"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {deletingLogId === log.id ? "Eliminando..." : "Eliminar"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={exerciseDialogOpen} onOpenChange={setExerciseDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingExerciseId ? "Editar ejercicio" : "Nuevo ejercicio"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              El ejercicio se vincula automaticamente a los dias que coincidan con
              su grupo muscular.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Nombre</label>
              <Input
                value={exerciseDraft.name}
                onChange={(event) =>
                  setExerciseDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Ej. Remo sentado en cable"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Grupo muscular</label>
              <select
                value={exerciseDraft.muscle_group}
                onChange={(event) =>
                  setExerciseDraft((current) => ({
                    ...current,
                    muscle_group: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecciona un grupo</option>
                {managedExerciseGroups.map((group) => (
                  <option key={group.muscleGroup} value={group.muscleGroup}>
                    {group.muscleGroup}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Descripcion breve</label>
              <Input
                value={exerciseDraft.description}
                onChange={(event) =>
                  setExerciseDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Opcional: agarre, foco tecnico o variante"
              />
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/20 px-3 py-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={exerciseDraft.is_active}
                onChange={(event) =>
                  setExerciseDraft((current) => ({
                    ...current,
                    is_active: event.target.checked,
                  }))
                }
              />
              Disponible para usarse en las plantillas
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => editingLog && deleteLog(editingLog)}
              disabled={savingLogEdit || !editingLog || deletingLogId === editingLog.id}
              className="mr-auto border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 disabled:opacity-60"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {editingLog && deletingLogId === editingLog.id ? "Eliminando..." : "Eliminar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setExerciseDialogOpen(false)}
              className={outlineButtonClass}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={saveManagedExercise}
              disabled={savingExerciseManager}
            >
              {savingExerciseManager ? "Guardando..." : "Guardar ejercicio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editLogOpen} onOpenChange={setEditLogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar avance</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Corrige series, repeticiones, kilos o nota del ejercicio ya cargado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface-2/20 px-4 py-3">
              <p className="font-medium text-foreground">
                {editingLog?.exercise_name ?? "Ejercicio"}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {editingLog?.muscle_group ?? "Grupo muscular"}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                type="number"
                value={editLogDraft.sets_count}
                onChange={(event) =>
                  setEditLogDraft((current) => ({
                    ...current,
                    sets_count: event.target.value,
                  }))
                }
                placeholder="Series"
              />
              <Input
                type="number"
                value={editLogDraft.reps}
                onChange={(event) =>
                  setEditLogDraft((current) => ({
                    ...current,
                    reps: event.target.value,
                  }))
                }
                placeholder="Reps"
              />
              <div className="relative">
                <Scale className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editLogDraft.weight_kg}
                  onChange={(event) =>
                    setEditLogDraft((current) => ({
                      ...current,
                      weight_kg: event.target.value,
                    }))
                  }
                  placeholder="Kg"
                  className="pl-10"
                />
              </div>
            </div>

            <Input
              value={editLogDraft.note}
              onChange={(event) =>
                setEditLogDraft((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              placeholder="Nota opcional"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditLogOpen(false)}
              className={outlineButtonClass}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={saveLogEdit}
              disabled={savingLogEdit}
            >
              {savingLogEdit ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedClient ? (
        <EditClientDialog
          open={editClientOpen}
          onOpenChange={setEditClientOpen}
          client={selectedClient}
          onSuccess={async () => {
            await loadClients();
            await refreshSelectedClientData();
          }}
        />
      ) : null}
    </div>
  );
}
