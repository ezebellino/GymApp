import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import RoutineTemplateDetail from "../RoutineTemplateDetail";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../../test/renderWithProviders";
import type { RoutineTemplateDetail as RoutineTemplateDetailType } from "@/types";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function makeTemplate(
  overrides: Partial<RoutineTemplateDetailType> = {}
): RoutineTemplateDetailType {
  return {
    id: "tpl-1",
    name: "Fuerza 4 días",
    tag: "FUERZA",
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    days: [
      {
        day_id: "day-1",
        name: "Día 1",
        muscle_groups: ["Pecho", "Tríceps"],
        position: 1,
        exercises: [
          {
            exercise_id: "ex-1",
            name: "Press banca",
            muscle_group: "Pecho",
            base: { sets: 4, reps: 8, weight_kg: 45 },
            is_active: true,
            strategy: "constant",
            planned_sets: [
              { index: 1, weight_kg: 45, reps: 8, note: null },
              { index: 2, weight_kg: 45, reps: 8, note: null },
            ],
          },
        ],
      },
    ],
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

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/routines/:templateId" element={<RoutineTemplateDetail />} />
    </Routes>,
    { route }
  );
}

describe("detalle de plantilla de rutina", () => {
  it("muestra solo los dias que incluye la plantilla", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/templates/tpl-1") {
        return jsonResponse(makeTemplate({}));
      }
      return jsonResponse([]);
    });

    renderAt("/routines/tpl-1");

    expect(await screen.findByRole("heading", { name: "Fuerza 4 días" })).toBeInTheDocument();
    expect(screen.getByText("Día 1")).toBeInTheDocument();
    expect(screen.queryByText("Día 2")).toBeNull();
    expect(screen.queryByText("Día 3")).toBeNull();
    expect(screen.getByText("Press banca")).toBeInTheDocument();
  });

  it("al elegir otra estrategia guarda y muestra el plan recalculado", async () => {
    let currentTemplate = makeTemplate({});
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/templates/tpl-1") {
        return jsonResponse(currentTemplate);
      }
      return jsonResponse([]);
    });
    vi.mocked(api.put).mockImplementation((url: string) => {
      if (url === "/routines/templates/tpl-1/days/day-1/exercises/ex-1") {
        const updatedExercise = {
          ...currentTemplate.days[0].exercises[0],
          strategy: "rest_pause" as const,
          planned_sets: [
            { index: 1, weight_kg: 45, reps: 8, note: null },
            { index: 2, weight_kg: 45, reps: 7, note: "20 s" },
          ],
        };
        currentTemplate = {
          ...currentTemplate,
          days: [{ ...currentTemplate.days[0], exercises: [updatedExercise] }],
        };
        return jsonResponse(updatedExercise);
      }
      return jsonResponse({});
    });

    renderAt("/routines/tpl-1");

    await screen.findByRole("heading", { name: "Fuerza 4 días" });
    expect(screen.queryByText("20 s")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Rest-pause" }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        "/routines/templates/tpl-1/days/day-1/exercises/ex-1",
        { strategy: "rest_pause" }
      );
    });
    expect(await screen.findByText("(20 s)")).toBeInTheDocument();
  });

  it("pide confirmacion antes de eliminar la plantilla", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/templates/tpl-1") {
        return jsonResponse(makeTemplate({}));
      }
      return jsonResponse([]);
    });

    renderAt("/routines/tpl-1");

    await screen.findByRole("heading", { name: "Fuerza 4 días" });
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    const dialog = await screen.findByRole("dialog", { hidden: true });
    expect(within(dialog).getByText(/vas a eliminar la plantilla/i)).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/routines/templates/tpl-1");
    });
  });
});
