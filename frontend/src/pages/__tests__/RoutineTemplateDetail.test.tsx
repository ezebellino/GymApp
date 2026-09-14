import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import RoutineTemplateDetail from "../RoutineTemplateDetail";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../../test/renderWithProviders";
import type { Exercise, RoutineTemplateDetail as RoutineTemplateDetailType } from "@/types";

// `template-owned-routine-days`: el detalle de plantilla pasó de autosave
// (un `PUT` por chip/switch) a un borrador local con guardado explícito
// (design D5/D11). Este archivo reemplaza por completo la suite anterior,
// que testeaba el switch por ejercicio y el autosave del chip de estrategia
// — los dos retirados en este change (ver AGENTS.md del change).

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

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-2",
    name: "Aperturas con mancuernas",
    description: null,
    muscle_group: "Pecho",
    training_types: ["Hipertrofia"],
    is_active: true,
    external_media_url: null,
    media_kind: null,
    media_file_url: null,
    media_content_type: null,
    media_filename: null,
    media_size_bytes: null,
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

function mockGet(template: RoutineTemplateDetailType, exercises: Exercise[] = []) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/routines/templates/tpl-1") return jsonResponse(template);
    if (url === "/exercises/") {
      return jsonResponse(exercises, { "x-total-count": String(exercises.length) });
    }
    if (url === "/exercises/meta") {
      return jsonResponse({ muscle_groups: [], training_types: [] });
    }
    return jsonResponse([]);
  });
}

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/routines/:templateId" element={<RoutineTemplateDetail />} />
      <Route path="/routines" element={<div>Listado de plantillas</div>} />
    </Routes>,
    { route }
  );
}

describe("detalle de plantilla de rutina — borrador y guardado", () => {
  it("muestra el título del día como Día N con sus grupos musculares unidos por barra", async () => {
    mockGet(makeTemplate({}));

    renderAt("/routines/tpl-1");

    expect(await screen.findByText("Día 1 - Pecho/Tríceps")).toBeInTheDocument();
  });

  it("agrega un día al borrador y lo envía en un solo guardado", async () => {
    const template = makeTemplate({});
    mockGet(template);
    vi.mocked(api.put).mockImplementation(() => jsonResponse(template));

    renderAt("/routines/tpl-1");
    await screen.findByText("Día 1 - Pecho/Tríceps");

    fireEvent.click(screen.getByRole("button", { name: "Agregar día" }));
    expect(await screen.findByText("Día 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Guardar configuración/ }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith("/routines/templates/tpl-1/days", {
        days: [
          {
            day_id: "day-1",
            muscle_groups: ["Pecho", "Tríceps"],
            exercises: [
              { exercise_id: "ex-1", strategy: "constant", base: { sets: 4, reps: 8, weight_kg: 45 } },
            ],
          },
          { day_id: null, muscle_groups: [], exercises: [] },
        ],
      });
    });
  });

  it("no deja agregar un sexto día", async () => {
    const template = makeTemplate({
      days: Array.from({ length: 5 }, (_, i) => ({
        day_id: `day-${i + 1}`,
        name: `Día ${i + 1}`,
        muscle_groups: [],
        position: i + 1,
        exercises: [],
      })),
    });
    mockGet(template);

    renderAt("/routines/tpl-1");
    await screen.findByText("Día 1");

    expect(screen.getByRole("button", { name: "Agregar día" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Agregar día" }));
    expect(screen.queryByText("Día 6")).toBeNull();
  });

  it("no deja quitar el último día", async () => {
    const template = makeTemplate({
      days: [{ day_id: "day-1", name: "Día 1", muscle_groups: [], position: 1, exercises: [] }],
    });
    mockGet(template);

    renderAt("/routines/tpl-1");
    await screen.findByText("Día 1");

    const removeButton = screen.getByRole("button", { name: "Quitar día" });
    expect(removeButton).toBeDisabled();

    fireEvent.click(removeButton);
    expect(screen.getByText("Día 1")).toBeInTheDocument();
  });

  it("el buscador no ofrece un ejercicio ya agregado a ese día", async () => {
    const template = makeTemplate({});
    mockGet(template, [
      makeExercise({ id: "ex-1", name: "Press banca" }),
      makeExercise({ id: "ex-2", name: "Aperturas con mancuernas" }),
    ]);

    renderAt("/routines/tpl-1");
    await screen.findByText("Día 1 - Pecho/Tríceps");

    fireEvent.change(screen.getByLabelText("Buscar ejercicio para el Día 1"), {
      target: { value: "e" },
    });

    expect(await screen.findByRole("button", { name: /Aperturas con mancuernas/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Press banca/ })).toBeNull();
  });

  it("el buscador avisa cuando no hay resultados", async () => {
    const template = makeTemplate({});
    mockGet(template, []);

    renderAt("/routines/tpl-1");
    await screen.findByText("Día 1 - Pecho/Tríceps");

    fireEvent.change(screen.getByLabelText("Buscar ejercicio para el Día 1"), {
      target: { value: "inexistente" },
    });

    expect(await screen.findByText("Sin resultados.")).toBeInTheDocument();
  });

  it("quita un ejercicio del día con el botón de papelera", async () => {
    const template = makeTemplate({});
    mockGet(template);

    renderAt("/routines/tpl-1");
    await screen.findByText("Press banca");

    fireEvent.click(screen.getByRole("button", { name: "Quitar ejercicio" }));

    expect(screen.queryByText("Press banca")).toBeNull();
    expect(
      screen.getByText("Todavía no hay ejercicios cargados para este día. Buscalos arriba para agregarlos.")
    ).toBeInTheDocument();
  });

  it("muestra 3x10 y 0 kg en un ejercicio recién agregado al día", async () => {
    const template = makeTemplate({
      days: [{ day_id: "day-1", name: "Día 1", muscle_groups: ["Pecho"], position: 1, exercises: [] }],
    });
    mockGet(template, [makeExercise({ id: "ex-2", name: "Sentadilla" })]);

    renderAt("/routines/tpl-1");
    await screen.findByText("Día 1 - Pecho");

    fireEvent.change(screen.getByLabelText("Buscar ejercicio para el Día 1"), {
      target: { value: "sent" },
    });
    fireEvent.click(await screen.findByText("Sentadilla"));

    expect(await screen.findByText(/Base: 3 × 10 · 0 kg/)).toBeInTheDocument();
  });

  it("edita la base de un ejercicio del día en el borrador y la manda en el guardado", async () => {
    const template = makeTemplate({});
    mockGet(template);
    vi.mocked(api.put).mockImplementation(() => jsonResponse(template));

    renderAt("/routines/tpl-1");
    await screen.findByText("Press banca");

    fireEvent.click(screen.getByRole("button", { name: "Editar base" }));

    const dialog = await screen.findByRole("dialog", { hidden: true });
    const [setsInput, repsInput, weightInput] = within(dialog).getAllByRole("spinbutton");
    fireEvent.change(setsInput, { target: { value: "5" } });
    fireEvent.change(repsInput, { target: { value: "6" } });
    fireEvent.change(weightInput, { target: { value: "50" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));

    expect(await screen.findByText(/Base: 5 × 6 · 50 kg/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Guardar configuración/ }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith("/routines/templates/tpl-1/days", {
        days: [
          {
            day_id: "day-1",
            muscle_groups: ["Pecho", "Tríceps"],
            exercises: [
              { exercise_id: "ex-1", strategy: "constant", base: { sets: 5, reps: 6, weight_kg: 50 } },
            ],
          },
        ],
      });
    });
  });

  it("avisa que hay cambios sin guardar al intentar volver a Rutinas", async () => {
    const template = makeTemplate({});
    mockGet(template);

    renderAt("/routines/tpl-1");
    await screen.findByText("Día 1 - Pecho/Tríceps");

    fireEvent.click(screen.getByRole("button", { name: "Agregar día" }));
    fireEvent.click(screen.getByRole("button", { name: /Volver a Rutinas/ }));

    expect(await screen.findByText("Tenés cambios sin guardar")).toBeInTheDocument();
    expect(screen.queryByText("Listado de plantillas")).toBeNull();
  });

  it("descarta el borrador y deja la plantilla como estaba", async () => {
    const template = makeTemplate({});
    mockGet(template);

    renderAt("/routines/tpl-1");
    await screen.findByText("Día 1 - Pecho/Tríceps");

    fireEvent.click(screen.getByRole("button", { name: "Agregar día" }));
    expect(await screen.findByText("Día 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Descartar/ }));

    expect(screen.queryByText("Día 2")).toBeNull();
    expect(screen.getByText("Día 1 - Pecho/Tríceps")).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });
});
