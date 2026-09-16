import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import UserRoutine from "../UserRoutine";
import { fireEvent, renderWithProviders, screen, waitFor } from "../../test/renderWithProviders";
import type {
  MemberRoutineTemplate,
  RoutineAssignment,
  RoutineTemplateExercise,
  WorkoutSetLog,
} from "@/types";

// `member-routine-copies` (design D9): reemplaza la suite de solo lectura de
// `template-owned-routine-days`. El Miembro ahora marca cada serie
// planificada, elige entre TODAS sus copias (no solo la Activa) y el estado
// vacío se reserva para cero copias asignadas — antes bastaba con no tener
// ninguna Activa.

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function makeAssignment(overrides: Partial<RoutineAssignment> = {}): RoutineAssignment {
  return {
    id: "assign-1",
    user_id: "me",
    template_id: "tpl-1",
    template_name: "Fuerza 4 días",
    template_tag: "FUERZA",
    status: "active",
    starts_on: "2026-01-01",
    created_at: "2026-01-01T00:00:00",
    ...overrides,
  };
}

function makeExercise(overrides: Partial<RoutineTemplateExercise> = {}): RoutineTemplateExercise {
  return {
    exercise_id: "ex-1",
    name: "Press banca",
    muscle_group: "Pecho",
    base: { sets: 4, reps: 8, weight_kg: 45 },
    strategy: "constant",
    planned_sets: [{ index: 1, weight_kg: 45, reps: 8, note: null }],
    ...overrides,
  };
}

function makeDetail(overrides: Partial<MemberRoutineTemplate> = {}): MemberRoutineTemplate {
  return {
    ...makeAssignment({}),
    days: [
      {
        day_id: "day-1",
        name: "Día 1",
        muscle_groups: ["Pecho"],
        position: 1,
        exercises: [makeExercise({})],
      },
    ],
    ...overrides,
  };
}

function makeLog(overrides: Partial<WorkoutSetLog> = {}): WorkoutSetLog {
  return {
    id: "log-1",
    user_id: "me",
    assignment_day_id: "day-1",
    day_name: "Día 1",
    exercise_id: "ex-1",
    exercise_name: "Press banca",
    muscle_group: "Pecho",
    set_index: 1,
    reps: 8,
    weight_kg: 45,
    performed_on: "2026-01-05",
    performed_at: "2026-01-05T10:00:00",
    ...overrides,
  };
}

function jsonResponse(data: unknown) {
  return Promise.resolve({
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  } as any);
}

describe("vista Mi rutina", () => {
  it("permite elegir entre las copias asignadas", async () => {
    const assignments = [
      makeAssignment({ id: "assign-1", template_name: "Fuerza 4 días" }),
      makeAssignment({ id: "assign-2", template_name: "Hipertrofia", status: "alternative" }),
    ];
    const detailByAssignment: Record<string, MemberRoutineTemplate> = {
      "assign-1": makeDetail({ id: "assign-1", template_name: "Fuerza 4 días" }),
      "assign-2": makeDetail({
        id: "assign-2",
        template_name: "Hipertrofia",
        days: [
          {
            day_id: "day-2",
            name: "Día 2",
            muscle_groups: ["Espalda"],
            position: 1,
            exercises: [makeExercise({ exercise_id: "ex-2", name: "Remo con barra" })],
          },
        ],
      }),
    };

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/my/templates") return jsonResponse(assignments);
      if (url === "/routines/my/templates/assign-1") return jsonResponse(detailByAssignment["assign-1"]);
      if (url === "/routines/my/templates/assign-2") return jsonResponse(detailByAssignment["assign-2"]);
      return jsonResponse([]);
    });

    renderWithProviders(<UserRoutine />, { route: "/my-routine" });

    expect(await screen.findByText("Press banca")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Hipertrofia/ }));

    expect(await screen.findByText("Remo con barra")).toBeInTheDocument();
    expect(screen.queryByText("Press banca")).toBeNull();
  });

  it("muestra el estado vacío solo cuando no hay ninguna copia asignada", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/my/templates") return jsonResponse([]);
      return jsonResponse([]);
    });

    renderWithProviders(<UserRoutine />, { route: "/my-routine" });

    expect(
      await screen.findByRole("heading", { name: "Todavía no tenés una rutina asignada" })
    ).toBeInTheDocument();
  });

  it("deja elegir y marcar sobre una copia Alternativa aunque no haya ninguna Activa", async () => {
    // Fixture a propósito sin ninguna Activa (dos Alternativas): si el
    // componente alguna vez exigiera una Activa para mostrar algo entrenable,
    // este caso se pone rojo en vez de colar el estado vacío por accidente.
    const assignments = [
      makeAssignment({ id: "assign-1", template_name: "Fuerza 4 días", status: "alternative" }),
      makeAssignment({ id: "assign-2", template_name: "Hipertrofia", status: "alternative" }),
    ];
    const detailByAssignment: Record<string, MemberRoutineTemplate> = {
      "assign-1": makeDetail({ id: "assign-1", template_name: "Fuerza 4 días", status: "alternative" }),
      "assign-2": makeDetail({
        id: "assign-2",
        template_name: "Hipertrofia",
        status: "alternative",
        days: [
          {
            day_id: "day-2",
            name: "Día 2",
            muscle_groups: ["Espalda"],
            position: 1,
            exercises: [makeExercise({ exercise_id: "ex-2", name: "Remo con barra" })],
          },
        ],
      }),
    };

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/my/templates") return jsonResponse(assignments);
      if (url === "/routines/my/templates/assign-1") return jsonResponse(detailByAssignment["assign-1"]);
      if (url === "/routines/my/templates/assign-2") return jsonResponse(detailByAssignment["assign-2"]);
      return jsonResponse([]);
    });
    vi.mocked(api.put).mockImplementation(() => jsonResponse({ id: "log-1", exercise_id: "ex-1" }));

    renderWithProviders(<UserRoutine />, { route: "/my-routine" });

    // Se muestra la primera copia (no hay Activa que priorizar) y las dos
    // aparecen ofrecidas como elegibles, ninguna marcada "Activa".
    expect(await screen.findByText("Press banca")).toBeInTheDocument();
    expect(screen.queryByText("Activa")).toBeNull();
    expect(screen.getAllByText("Alternativa")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Marcar" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        "/routines/my/days/day-1/exercises/ex-1/sets/1",
        { weight_kg: 45, reps: 8 }
      );
    });

    // Cambiar a la otra copia Alternativa también deja elegir y marcar.
    fireEvent.click(screen.getByRole("button", { name: /Hipertrofia/ }));
    expect(await screen.findByText("Remo con barra")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar" })).toBeEnabled();
  });

  it("precarga el peso planificado al marcar una serie", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/my/templates") return jsonResponse([makeAssignment({})]);
      if (url === "/routines/my/templates/assign-1") return jsonResponse(makeDetail({}));
      return jsonResponse([]);
    });

    renderWithProviders(<UserRoutine />, { route: "/my-routine" });

    expect(await screen.findByText("Press banca")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Marcar" }));

    expect(screen.getByLabelText("Kg")).toHaveValue(45);
    expect(screen.getByLabelText("Reps")).toHaveValue(8);
  });

  it("muestra la serie ya marcada con lo ejecutado y permite corregirla", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/my/templates") return jsonResponse([makeAssignment({})]);
      if (url === "/routines/my/templates/assign-1") {
        return jsonResponse(
          makeDetail({
            days: [
              {
                day_id: "day-1",
                name: "Día 1",
                muscle_groups: ["Pecho"],
                position: 1,
                exercises: [
                  makeExercise({
                    planned_sets: [
                      {
                        index: 1,
                        weight_kg: 45,
                        reps: 8,
                        note: null,
                        logged: { weight_kg: 50, reps: 6, performed_at: "2026-01-05T10:00:00" },
                      },
                    ],
                  }),
                ],
              },
            ],
          })
        );
      }
      return jsonResponse([]);
    });

    renderWithProviders(<UserRoutine />, { route: "/my-routine" });

    // Lo mostrado es lo EJECUTADO (50 kg × 6), no lo planificado (45 kg × 8):
    // si el componente alguna vez volviera a priorizar el plan, este caso se
    // pone rojo.
    expect(await screen.findByText(/50 kg × 6/)).toBeInTheDocument();
    expect(screen.queryByText(/45 kg × 8/)).toBeNull();

    const correctButton = screen.getByRole("button", { name: "Corregir" });
    expect(screen.queryByRole("button", { name: "Marcar" })).toBeNull();

    fireEvent.click(correctButton);

    expect(screen.getByLabelText("Kg")).toHaveValue(50);
    expect(screen.getByLabelText("Reps")).toHaveValue(6);
  });

  it("ofrece exactamente cuatro acciones de marcar para un plan de cuatro series", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/my/templates") return jsonResponse([makeAssignment({})]);
      if (url === "/routines/my/templates/assign-1") {
        return jsonResponse(
          makeDetail({
            days: [
              {
                day_id: "day-1",
                name: "Día 1",
                muscle_groups: ["Pecho"],
                position: 1,
                exercises: [
                  makeExercise({
                    planned_sets: [
                      { index: 1, weight_kg: 45, reps: 8, note: null },
                      { index: 2, weight_kg: 45, reps: 8, note: null },
                      { index: 3, weight_kg: 40, reps: 10, note: null },
                      { index: 4, weight_kg: 40, reps: 10, note: null },
                    ],
                  }),
                ],
              },
            ],
          })
        );
      }
      return jsonResponse([]);
    });

    renderWithProviders(<UserRoutine />, { route: "/my-routine" });

    expect(await screen.findByText("Press banca")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Marcar" })).toHaveLength(4);
  });

  it("indica que el día todavía no tiene ejercicios cargados", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/my/templates") return jsonResponse([makeAssignment({})]);
      if (url === "/routines/my/templates/assign-1") {
        return jsonResponse(
          makeDetail({
            days: [
              {
                day_id: "day-1",
                name: "Día 1",
                muscle_groups: ["Pecho"],
                position: 1,
                exercises: [],
              },
            ],
          })
        );
      }
      return jsonResponse([]);
    });

    renderWithProviders(<UserRoutine />, { route: "/my-routine" });

    expect(await screen.findByText("Este día todavía no tiene ejercicios cargados.")).toBeInTheDocument();
  });

  it("muestra solo los días de la copia asignada", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/my/templates") return jsonResponse([makeAssignment({})]);
      if (url === "/routines/my/templates/assign-1") {
        return jsonResponse(
          makeDetail({
            days: [
              { day_id: "day-1", name: "Día 1", muscle_groups: ["Pecho"], position: 1, exercises: [] },
              { day_id: "day-2", name: "Día 2", muscle_groups: ["Espalda"], position: 2, exercises: [] },
            ],
          })
        );
      }
      return jsonResponse([]);
    });

    renderWithProviders(<UserRoutine />, { route: "/my-routine" });

    await screen.findByRole("tab", { name: "Día 1" });
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Día 1", "Día 2"]);
  });

  it("no muestra un ejercicio que ya no está en el día de la copia", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/my/templates") return jsonResponse([makeAssignment({})]);
      if (url === "/routines/my/templates/assign-1") {
        return jsonResponse(
          makeDetail({
            days: [
              {
                day_id: "day-1",
                name: "Día 1",
                muscle_groups: ["Pecho"],
                position: 1,
                exercises: [
                  makeExercise({ exercise_id: "ex-1", name: "Press banca" }),
                  makeExercise({
                    exercise_id: "ex-3",
                    name: "Sentadilla",
                    muscle_group: "Piernas",
                    base: { sets: 4, reps: 8, weight_kg: 60 },
                    planned_sets: [{ index: 1, weight_kg: 60, reps: 8, note: null }],
                  }),
                ],
              },
              {
                // Simula un ejercicio que estuvo en la copia y se quitó de
                // este día: sigue existiendo en OTRO día de la misma copia,
                // así que si el componente alguna vez renderizara todos los
                // ejercicios de `template.days` en vez de solo los de
                // `selectedDay`, este test lo detecta.
                day_id: "day-2",
                name: "Día 2",
                muscle_groups: ["Espalda"],
                position: 2,
                exercises: [
                  makeExercise({
                    exercise_id: "ex-2",
                    name: "Aperturas con mancuernas",
                    muscle_group: "Pecho",
                    base: { sets: 3, reps: 12, weight_kg: 10 },
                    planned_sets: [{ index: 1, weight_kg: 10, reps: 12, note: null }],
                  }),
                ],
              },
            ],
          })
        );
      }
      return jsonResponse([]);
    });

    renderWithProviders(<UserRoutine />, { route: "/my-routine" });

    expect(await screen.findByText("Press banca")).toBeInTheDocument();
    expect(screen.getByText("Sentadilla")).toBeInTheDocument();
    expect(screen.queryByText("Aperturas con mancuernas")).toBeNull();
  });

  // Mayor 2 del `verification.md` (D15): el panel "Historial" se alimentaba
  // de `useMyWorkoutLogsQuery()` sin params (`limit=40` por default del
  // backend) y derivaba las opciones del filtro de esas mismas filas — un
  // ejercicio quitado de la copia hace más de 40 marcas desaparecía del
  // `<select>`. Ahora las opciones salen de `/routines/my/logged-exercises`
  // (sin ventana) y el filtro elegido viaja como `exercise_id` al servidor.

  function mockHistoryData(config: {
    windowLogs: WorkoutSetLog[];
    loggedExercises: { exercise_id: string; name: string; muscle_group: string | null }[];
    filteredLogsByExerciseId: Record<string, WorkoutSetLog[]>;
  }) {
    vi.mocked(api.get).mockImplementation((url: string, requestConfig?: any) => {
      if (url === "/routines/my/templates") return jsonResponse([makeAssignment({})]);
      if (url === "/routines/my/templates/assign-1") return jsonResponse(makeDetail({}));
      if (url === "/routines/my/logged-exercises") return jsonResponse(config.loggedExercises);
      if (url === "/routines/my/logs") {
        const exerciseId = requestConfig?.params?.exercise_id;
        if (exerciseId && config.filteredLogsByExerciseId[exerciseId]) {
          return jsonResponse(config.filteredLogsByExerciseId[exerciseId]);
        }
        return jsonResponse(config.windowLogs);
      }
      return jsonResponse([]);
    });
  }

  it("ofrece en el Historial un ejercicio sin marcas en las últimas cuarenta", async () => {
    // Fixture MÁS GRANDE QUE LA VENTANA: 41 filas, todas de otro ejercicio —
    // "Peso muerto" no aparece en ninguna de ellas, solo en
    // `/routines/my/logged-exercises`.
    const windowLogs = Array.from({ length: 41 }, (_, i) =>
      makeLog({
        id: `log-recent-${i}`,
        exercise_id: "ex-1",
        exercise_name: "Press banca",
        performed_on: `2026-02-${String((i % 28) + 1).padStart(2, "0")}`,
      })
    );
    mockHistoryData({
      windowLogs,
      loggedExercises: [
        { exercise_id: "ex-1", name: "Press banca", muscle_group: "Pecho" },
        { exercise_id: "ex-old", name: "Peso muerto", muscle_group: "Piernas" },
      ],
      filteredLogsByExerciseId: {
        "ex-old": [
          makeLog({
            id: "log-old",
            exercise_id: "ex-old",
            exercise_name: "Peso muerto",
            weight_kg: 120,
            performed_on: "2024-01-01",
          }),
        ],
      },
    });

    renderWithProviders(<UserRoutine />, { route: "/my-routine" });

    await screen.findByText("Press banca");
    fireEvent.click(screen.getByRole("button", { name: "Historial" }));

    const select = (await screen.findByLabelText("Ejercicio")) as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((option) => option.textContent);
    expect(optionLabels).toContain("Peso muerto");
  });

  it("pide al servidor las marcas del ejercicio elegido en el Historial", async () => {
    const windowLogs = Array.from({ length: 41 }, (_, i) =>
      makeLog({
        id: `log-recent-${i}`,
        exercise_id: "ex-1",
        exercise_name: "Press banca",
        performed_on: `2026-02-${String((i % 28) + 1).padStart(2, "0")}`,
      })
    );
    mockHistoryData({
      windowLogs,
      loggedExercises: [
        { exercise_id: "ex-1", name: "Press banca", muscle_group: "Pecho" },
        { exercise_id: "ex-old", name: "Peso muerto", muscle_group: "Piernas" },
      ],
      filteredLogsByExerciseId: {
        "ex-old": [
          makeLog({
            id: "log-old",
            exercise_id: "ex-old",
            exercise_name: "Peso muerto",
            weight_kg: 120,
            performed_on: "2024-01-01",
          }),
        ],
      },
    });

    renderWithProviders(<UserRoutine />, { route: "/my-routine" });

    await screen.findByText("Press banca");
    fireEvent.click(screen.getByRole("button", { name: "Historial" }));

    const select = (await screen.findByLabelText("Ejercicio")) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "ex-old" } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/routines/my/logs", {
        params: { exercise_id: "ex-old" },
      });
    });
    expect(await screen.findByText(/Peso muerto · #1 · 120 kg × 8/)).toBeInTheDocument();
  });
});
