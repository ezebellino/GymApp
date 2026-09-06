import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import UserRoutine from "../UserRoutine";
import { fireEvent, renderWithProviders, screen } from "../../test/renderWithProviders";
import type { MemberRoutineTemplate, RoutineAssignment } from "@/types";

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
    adjustments_count: 0,
    last_adjustment: null,
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
        exercises: [
          {
            exercise_id: "ex-1",
            name: "Press banca",
            muscle_group: "Pecho",
            base: { sets: 4, reps: 8, weight_kg: 45 },
            is_active: true,
            strategy: "constant",
            planned_sets: [{ index: 1, weight_kg: 45, reps: 8, note: null }],
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

describe("vista Mi rutina", () => {
  it("permite elegir entre las plantillas asignadas", async () => {
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
            exercises: [
              {
                exercise_id: "ex-2",
                name: "Remo con barra",
                muscle_group: "Espalda",
                base: { sets: 3, reps: 10, weight_kg: 30 },
                is_active: true,
                strategy: "constant",
                planned_sets: [{ index: 1, weight_kg: 30, reps: 10, note: null }],
              },
            ],
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

  it("avisa cuando el miembro no tiene ninguna plantilla asignada", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/my/templates") return jsonResponse([]);
      return jsonResponse([]);
    });

    renderWithProviders(<UserRoutine />, { route: "/my-routine" });

    expect(
      await screen.findByRole("heading", { name: "Todavía no tenés una plantilla asignada" })
    ).toBeInTheDocument();
  });

  it("muestra el plan de series sin accion para marcar una serie como hecha", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/my/templates") return jsonResponse([makeAssignment({})]);
      if (url === "/routines/my/templates/assign-1") return jsonResponse(makeDetail({}));
      return jsonResponse([]);
    });

    renderWithProviders(<UserRoutine />, { route: "/my-routine" });

    expect(await screen.findByText("Press banca")).toBeInTheDocument();
    expect(screen.getByText("45 kg × 8")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /marcar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /guardar/i })).toBeNull();
  });
});
