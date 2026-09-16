import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, LineChart as LineChartIcon, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useUserQuery } from "@/services/users.queries";
import {
  useLoggedExercisesQuery,
  useUserWorkoutLogsQuery,
} from "@/services/routineAssignments.queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataError from "@/components/DataError";
import { formatDate } from "@/lib/utils";
import type { WorkoutSetLog } from "@/types";

// Vista de Progreso de un Miembro para Dueño o Coach (`member-routine-copies`,
// design D10): histórico filtrable por ejercicio y período, más un gráfico de
// evolución del peso máximo por sesión (`recharts`, ya dependencia — sin
// agregar ninguna nueva). Sin ninguna acción para marcar series (invariante
// I11): el marcado sigue siendo exclusivo del Miembro, desde "Mi rutina".

const CHART_COLORS = ["#f97316", "#38bdf8", "#a78bfa", "#34d399", "#f472b6", "#facc15"];

type ChartPoint = { performed_on: string; [exerciseId: string]: number | string };

function buildChartData(logs: WorkoutSetLog[]) {
  const exerciseNames = new Map<string, string>();
  const maxByDate = new Map<string, Map<string, number>>();

  for (const log of logs) {
    exerciseNames.set(log.exercise_id, log.exercise_name);
    if (!maxByDate.has(log.performed_on)) {
      maxByDate.set(log.performed_on, new Map());
    }
    const byExercise = maxByDate.get(log.performed_on) as Map<string, number>;
    const current = byExercise.get(log.exercise_id) ?? 0;
    if (log.weight_kg > current) {
      byExercise.set(log.exercise_id, log.weight_kg);
    }
  }

  const dates = Array.from(maxByDate.keys()).sort();
  const data: ChartPoint[] = dates.map((date) => {
    const point: ChartPoint = { performed_on: date };
    const byExercise = maxByDate.get(date) as Map<string, number>;
    for (const [exerciseId, weight] of byExercise.entries()) {
      point[exerciseId] = weight;
    }
    return point;
  });

  const exercises = Array.from(exerciseNames.entries()).map(([id, name]) => ({ id, name }));
  return { data, exercises };
}

export default function MemberProgress() {
  const { id: userId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // `null` = todavía no elegido explícitamente: el filtro efectivo cae al
  // ejercicio más reciente de `loggedExercises` (design D10). `""` es un
  // valor explícito distinto ("Todos los ejercicios" elegido a mano) — así
  // el default nunca se confunde con la elección del Coach.
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: user } = useUserQuery(userId);
  const {
    data: loggedExercises,
    isPending: loggedExercisesPending,
    isError: loggedExercisesError,
  } = useLoggedExercisesQuery(userId);

  // El filtro arranca en el ejercicio más reciente (design D10): antes se
  // derivaba de `logs[0]` (el histórico, con ventana); mayor 1 del
  // `verification.md` lo mueve a `loggedExercises[0]`, que no tiene ventana
  // y ya viene ordenado por el servidor. Calculado en el render (no en un
  // efecto que dispare un segundo fetch): así el primer `GET` de logs ya
  // sale con el filtro puesto, sin un parpadeo intermedio mostrando todo.
  const effectiveExerciseId =
    exerciseId !== null ? exerciseId : (loggedExercises?.[0]?.exercise_id ?? "");

  // Mayor 1 del `verification.md`: los tres filtros viajan como **params**
  // al servidor (D6 los agregó a este endpoint) en vez de pedir `limit: 200`
  // y filtrar en memoria — con eso, un registro fuera de las últimas 200
  // filas queda inalcanzable aunque el filtro lo pida explícitamente.
  // `enabled` espera a `loggedExercises` cuando todavía no se eligió nada
  // explícito, para no disparar un primer fetch sin filtro que después haya
  // que reemplazar.
  const {
    data: logsData,
    isPending: logsPending,
    isError: logsError,
    refetch,
  } = useUserWorkoutLogsQuery(
    userId,
    {
      exercise_id: effectiveExerciseId || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      limit: 200,
    },
    { enabled: exerciseId !== null || loggedExercises !== undefined },
  );

  const logs = useMemo(() => logsData ?? [], [logsData]);
  const isPending = loggedExercisesPending || logsPending;
  const isError = loggedExercisesError || logsError;
  // "Este Miembro no tiene progreso" es sobre el histórico completo, no
  // sobre el filtro vigente — sale de `logged-exercises` (sin ventana), no
  // de `logs` (que ahora puede venir vacío solo porque el filtro no
  // encontró nada, no porque no haya progreso registrado).
  const hasAnyProgress = (loggedExercises ?? []).length > 0;

  const { data: chartData, exercises: chartExercises } = useMemo(
    () => buildChartData(logs),
    [logs],
  );

  return (
    <div className="space-y-6">
      <section className="hero-aura rounded-xl border border-border p-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate(`/users/${userId}`)}
          className="border-border bg-surface-2/40 text-foreground hover:border-primary/30 hover:bg-surface-2/70"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la ficha
        </Button>

        <div className="mt-5 flex items-center gap-4">
          <div className="rounded-full bg-primary/15 p-4 text-primary-strong">
            <LineChartIcon className="h-7 w-7" />
          </div>
          <div>
            <h1 className="warm-accent-text font-display text-2xl font-extrabold md:text-3xl">
              Progreso de {user?.full_name ?? "este Miembro"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Histórico de series marcadas y evolución de peso por ejercicio.
            </p>
          </div>
        </div>
      </section>

      {isPending ? (
        <div className="grid min-h-[30vh] place-items-center">
          <div className="rounded-xl border border-border bg-surface-1/70 px-5 py-4 text-sm text-muted-foreground">
            Cargando progreso...
          </div>
        </div>
      ) : null}

      {!isPending && isError ? (
        <DataError title="No se pudo cargar el progreso" onRetry={() => refetch()} />
      ) : null}

      {!isPending && !isError && !hasAnyProgress ? (
        <Card className="border-border bg-surface-1/60 backdrop-blur-xl">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Este Miembro todavía no tiene progreso registrado.
          </CardContent>
        </Card>
      ) : null}

      {!isPending && !isError && hasAnyProgress ? (
        <>
          <Card className="border-border bg-surface-1 backdrop-blur-md">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-foreground">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 pt-6">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="progress-exercise-filter">
                  Ejercicio
                </label>
                <select
                  id="progress-exercise-filter"
                  value={effectiveExerciseId}
                  onChange={(e) => setExerciseId(e.target.value)}
                  className="rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Todos los ejercicios</option>
                  {(loggedExercises ?? []).map((exercise) => (
                    <option key={exercise.exercise_id} value={exercise.exercise_id}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="progress-from">
                  Desde
                </label>
                <input
                  id="progress-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="progress-to">
                  Hasta
                </label>
                <input
                  id="progress-to"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-surface-1 backdrop-blur-md">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <TrendingUp className="h-5 w-5" />
                Evolución del peso
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin registros para el filtro elegido.
                </p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="performed_on"
                        tickFormatter={(value) => formatDate(value)}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} unit=" kg" />
                      <Tooltip labelFormatter={(value) => formatDate(String(value))} />
                      <Legend />
                      {chartExercises.map((exercise, index) => (
                        <Line
                          key={exercise.id}
                          type="monotone"
                          dataKey={exercise.id}
                          name={exercise.name}
                          stroke={CHART_COLORS[index % CHART_COLORS.length]}
                          connectNulls
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-surface-1 backdrop-blur-md">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-foreground">Histórico</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin registros para el filtro elegido.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {logs.map((log) => (
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
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
