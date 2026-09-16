import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import MemberRoutineEditor from "../MemberRoutineEditor";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../../test/renderWithProviders";
import type { MemberRoutineTemplate } from "@/types";

// `member-routine-copies` (design D8/D10): editor de la COPIA de un Miembro,
// cáscara sobre `RoutineDaysEditor` — mismo componente que
// `RoutineTemplateDetail.tsx`, pero el guardado pega contra la asignación,
// no contra la plantilla.

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function makeAssignmentDetail(
  overrides: Partial<MemberRoutineTemplate> = {}
): MemberRoutineTemplate {
  return {
    id: "assign-1",
    user_id: "u-1",
    template_id: "tpl-1",
    template_name: "Fuerza 4 días",
    template_tag: "FUERZA",
    status: "active",
    starts_on: "2026-01-01",
    created_at: "2026-01-01T00:00:00",
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

function jsonResponse(data: unknown, headers: Record<string, string> = {}) {
  return Promise.resolve({
    data,
    status: 200,
    statusText: "OK",
    headers,
    config: {},
  } as any);
}

function mockGet(detail: MemberRoutineTemplate) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/routines/users/u-1/templates/assign-1") return jsonResponse(detail);
    if (url === "/exercises/meta") {
      return jsonResponse({ muscle_groups: [], training_types: [] });
    }
    if (url === "/exercises/") return jsonResponse([], { "x-total-count": "0" });
    // D13 (corrección del gate): seed de `RESET` cubre la tupla inicial de
    // cada ejercicio del detalle; esto solo se pide para una tupla nueva.
    if (url === "/routines/progression/preview") return jsonResponse({ planned_sets: [] });
    return jsonResponse([]);
  });
}

function mockGetWithPreview(
  detail: MemberRoutineTemplate,
  previewFor: Record<string, { index: number; weight_kg: number; reps: number; note: null }[]>
) {
  vi.mocked(api.get).mockImplementation((url: string, config?: any) => {
    if (url === "/routines/users/u-1/templates/assign-1") return jsonResponse(detail);
    if (url === "/exercises/meta") {
      return jsonResponse({ muscle_groups: [], training_types: [] });
    }
    if (url === "/exercises/") return jsonResponse([], { "x-total-count": "0" });
    if (url === "/routines/progression/preview") {
      const params = config?.params ?? {};
      const key = `${params.strategy}-${params.sets}-${params.reps}-${params.weight_kg}`;
      return jsonResponse({ planned_sets: previewFor[key] ?? [] });
    }
    return jsonResponse([]);
  });
}

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/users/:id/routine/:assignmentId" element={<MemberRoutineEditor />} />
      <Route path="/users/:id" element={<div>Ficha de usuario</div>} />
    </Routes>,
    { route }
  );
}

describe("editor de la copia de rutina de un Miembro", () => {
  it("guarda los días de la copia con un solo PUT a la asignación", async () => {
    const detail = makeAssignmentDetail({});
    mockGet(detail);
    vi.mocked(api.put).mockImplementation(() => jsonResponse(detail));

    renderAt("/users/u-1/routine/assign-1");
    await screen.findByText("Press banca");

    fireEvent.click(screen.getByRole("button", { name: "Agregar día" }));
    expect(await screen.findByText("Día 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Guardar configuración/ }));

    await waitFor(() => {
      // La URL apunta a la ASIGNACIÓN, no a `/routines/templates/...`: es lo
      // que distingue este editor del de plantillas.
      expect(api.put).toHaveBeenCalledWith("/routines/users/u-1/templates/assign-1/days", {
        days: [
          {
            day_id: "day-1",
            muscle_groups: ["Pecho"],
            exercises: [
              { exercise_id: "ex-1", strategy: "constant", base: { sets: 4, reps: 8, weight_kg: 45 } },
            ],
          },
          { day_id: null, muscle_groups: [], exercises: [] },
        ],
      });
    });
    expect(api.put).not.toHaveBeenCalledWith(
      expect.stringContaining("/routines/templates/"),
      expect.anything()
    );
  });

  it("no deja agregar un sexto día a la copia", async () => {
    const detail = makeAssignmentDetail({
      days: Array.from({ length: 5 }, (_, i) => ({
        day_id: `day-${i + 1}`,
        name: `Día ${i + 1}`,
        muscle_groups: [],
        position: i + 1,
        exercises: [],
      })),
    });
    mockGet(detail);

    renderAt("/users/u-1/routine/assign-1");
    await screen.findByText("Día 1");

    const addButton = screen.getByRole("button", { name: "Agregar día" });
    expect(addButton).toBeDisabled();

    fireEvent.click(addButton);
    expect(screen.queryByText("Día 6")).toBeNull();
  });

  // D13 (corrección del gate): mismo editor compartido que
  // `RoutineTemplateDetail.tsx` — confirmar una base nueva también cambia la
  // tupla de previsualización, sin guardar.
  it("recalcula el plan de la copia al confirmar una base nueva, sin guardar", async () => {
    const detail = makeAssignmentDetail({});
    // Plan distinguible del inicial (45 kg) para la base nueva (5 × 6 · 50 kg).
    mockGetWithPreview(detail, {
      "constant-5-6-50": [{ index: 1, weight_kg: 777, reps: 6, note: null }],
    });

    renderAt("/users/u-1/routine/assign-1");
    await screen.findByText("Press banca");

    fireEvent.click(screen.getByRole("button", { name: "Editar base" }));

    const dialog = await screen.findByRole("dialog", { hidden: true });
    const [setsInput, repsInput, weightInput] = within(dialog).getAllByRole("spinbutton");
    fireEvent.change(setsInput, { target: { value: "5" } });
    fireEvent.change(repsInput, { target: { value: "6" } });
    fireEvent.change(weightInput, { target: { value: "50" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));

    expect(await screen.findByText(/777 kg × 6/)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  // Menor 8 del `verification.md`: `template_tag` snapshoteado puede llegar
  // como `""` (plantilla origen sin etiqueta) — el `<Badge>` no debe
  // renderizarse vacío.
  it("no muestra una etiqueta vacía cuando la plantilla origen no tenía tag", async () => {
    const detail = makeAssignmentDetail({ template_tag: "" });
    mockGet(detail);

    renderAt("/users/u-1/routine/assign-1");
    await screen.findByText("Press banca");

    expect(screen.queryByText("FUERZA")).toBeNull();
    // Sin la etiqueta, el `Badge` no debería montarse en absoluto (no un
    // `Badge` vacío): `data-slot="badge"` es el selector estable del
    // componente (`components/ui/badge.tsx`).
    expect(document.querySelector('[data-slot="badge"]')).toBeNull();
  });
});
