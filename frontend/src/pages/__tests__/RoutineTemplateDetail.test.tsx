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
            rir: null,
            rest_seconds: null,
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
    // D13 (corrección del gate): la carga inicial siembra la caché de
    // previsualización con los `planned_sets` del detalle (`RESET`), así que
    // en la mayoría de los casos esto no se llega a pedir; un ejercicio
    // recién agregado (base 3×10·0kg, sin seed) sí lo dispara.
    if (url === "/routines/progression/preview") return jsonResponse({ planned_sets: [] });
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
              {
                exercise_id: "ex-1",
                strategy: "constant",
                base: { sets: 4, reps: 8, weight_kg: 45 },
                rir: null,
                rest_seconds: null,
              },
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
              {
                exercise_id: "ex-1",
                strategy: "constant",
                base: { sets: 5, reps: 6, weight_kg: 50 },
                rir: null,
                rest_seconds: null,
              },
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

  // D13 (corrección del gate, `verification.md`): el editor pide la
  // previsualización al servidor en vez de dejar el plan mostrado
  // desactualizado hasta guardar.

  function mockGetWithPreview(
    template: RoutineTemplateDetailType,
    previewFor: Record<string, { index: number; weight_kg: number; reps: number; note: null }[]>
  ) {
    vi.mocked(api.get).mockImplementation((url: string, config?: any) => {
      if (url === "/routines/templates/tpl-1") return jsonResponse(template);
      if (url === "/exercises/") return jsonResponse([], { "x-total-count": "0" });
      if (url === "/exercises/meta") {
        return jsonResponse({ muscle_groups: [], training_types: [] });
      }
      if (url === "/routines/progression/preview") {
        const params = config?.params ?? {};
        const key = `${params.strategy}-${params.sets}-${params.reps}-${params.weight_kg}`;
        return jsonResponse({ planned_sets: previewFor[key] ?? [] });
      }
      return jsonResponse([]);
    });
  }

  it("recalcula el plan mostrado al cambiar la estrategia, sin guardar", async () => {
    const template = makeTemplate({});
    // Plan distinguible del inicial (45 kg): si el editor no llamara al
    // endpoint de previsualización, este texto nunca aparecería.
    mockGetWithPreview(template, {
      "rest_pause-4-8-45": [{ index: 1, weight_kg: 999, reps: 8, note: null }],
    });

    renderAt("/routines/tpl-1");
    await screen.findByText("Press banca");

    fireEvent.click(screen.getByRole("button", { name: "Rest-pause" }));

    expect(await screen.findByText(/999 kg × 8/)).toBeInTheDocument();
    // Sin guardar: la previsualización no dispara ningún `PUT`.
    expect(api.put).not.toHaveBeenCalled();
  });

  it("deja guardar aunque la previsualización falle", async () => {
    const template = makeTemplate({});
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/templates/tpl-1") return jsonResponse(template);
      if (url === "/exercises/") return jsonResponse([], { "x-total-count": "0" });
      if (url === "/exercises/meta") {
        return jsonResponse({ muscle_groups: [], training_types: [] });
      }
      if (url === "/routines/progression/preview") {
        return Promise.reject(new Error("network error"));
      }
      return jsonResponse([]);
    });
    vi.mocked(api.put).mockImplementation(() => jsonResponse(template));

    renderAt("/routines/tpl-1");
    await screen.findByText("Press banca");

    fireEvent.click(screen.getByRole("button", { name: "Rest-pause" }));

    expect(
      await screen.findByText("No pudimos recalcular la previsualización.")
    ).toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: /Guardar configuración/ });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith("/routines/templates/tpl-1/days", {
        days: [
          {
            day_id: "day-1",
            muscle_groups: ["Pecho", "Tríceps"],
            exercises: [
              {
                exercise_id: "ex-1",
                strategy: "rest_pause",
                base: { sets: 4, reps: 8, weight_kg: 45 },
                rir: null,
                rest_seconds: null,
              },
            ],
          },
        ],
      });
    });
  });

  // I19 (corrección del gate, restringida a offline): `networkMode: "online"`
  // (default de `queryClient.ts`) deja la query de previsualización en
  // `fetchStatus: "paused"` sin conexión — ni `isFetching` ni `isError` se
  // prenden, así que sin el fix el plan de la tupla anterior queda mostrado
  // en silencio como si fuera el vigente.
  it("avisa 'Sin conexión' en vez de mostrar en silencio el plan de la tupla vieja", async () => {
    const template = makeTemplate({});
    mockGet(template);

    renderAt("/routines/tpl-1");
    await screen.findByText("Press banca");
    // Plan inicial (constant, sembrado en caché desde el detalle, D13): la
    // base sobre la que después afirmamos que no cambió en silencio.
    expect((await screen.findAllByText(/45 kg × 8/)).length).toBeGreaterThan(0);

    const originalOnLine = window.navigator.onLine;
    Object.defineProperty(window.navigator, "onLine", {
      value: false,
      configurable: true,
    });
    window.dispatchEvent(new Event("offline"));

    try {
      // La tupla cambia (constant -> rest_pause) y no está en caché: dispara
      // un fetch que la query pausa por falta de conexión.
      fireEvent.click(screen.getByRole("button", { name: "Rest-pause" }));

      expect(
        await screen.findByText(/Sin conexión: no pudimos recalcular/)
      ).toBeInTheDocument();
      // Sigue viéndose el plan viejo (atenuado, con el aviso), pero
      // explícitamente marcado como no vigente en vez de en silencio.
      expect(screen.getAllByText(/45 kg × 8/).length).toBeGreaterThan(0);
      // Guardar nunca se bloquea por el estado de la previsualización.
      expect(screen.getByRole("button", { name: /Guardar configuración/ })).toBeEnabled();
    } finally {
      Object.defineProperty(window.navigator, "onLine", {
        value: originalOnLine,
        configurable: true,
      });
      window.dispatchEvent(new Event("online"));
    }
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

  // --- RIR/pausa (`routine-exercise-intensity`) ------------------------------

  it("edita el RIR y la pausa de un ejercicio y los manda en el guardado", async () => {
    const template = makeTemplate({});
    mockGet(template);
    vi.mocked(api.put).mockImplementation(() => jsonResponse(template));

    renderAt("/routines/tpl-1");
    await screen.findByText("Press banca");

    fireEvent.change(screen.getByLabelText("RIR del ejercicio"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Pausa entre series, en segundos"), {
      target: { value: "90" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Guardar configuración/ }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith("/routines/templates/tpl-1/days", {
        days: [
          {
            day_id: "day-1",
            muscle_groups: ["Pecho", "Tríceps"],
            exercises: [
              {
                exercise_id: "ex-1",
                strategy: "constant",
                base: { sets: 4, reps: 8, weight_kg: 45 },
                rir: 2,
                rest_seconds: 90,
              },
            ],
          },
        ],
      });
    });
  });

  it("anotar en RPE guarda el RIR equivalente", async () => {
    const template = makeTemplate({});
    mockGet(template);
    vi.mocked(api.put).mockImplementation(() => jsonResponse(template));

    renderAt("/routines/tpl-1");
    await screen.findByText("Press banca");

    // La etiqueta del campo es el toggle de escala: RPE 8 es RIR 2, y lo que
    // viaja al servidor es SIEMPRE el RIR.
    fireEvent.click(screen.getByRole("button", { name: /Escala de intensidad: RIR/ }));
    fireEvent.change(screen.getByLabelText("RPE del ejercicio"), { target: { value: "8" } });

    fireEvent.click(screen.getByRole("button", { name: /Guardar configuración/ }));

    await waitFor(() => {
      const [, body] = vi.mocked(api.put).mock.calls[0];
      expect((body as any).days[0].exercises[0].rir).toBe(2);
    });
  });

  it("vaciar el campo borra la prescripción en vez de dejar el valor anterior", async () => {
    const template = makeTemplate({});
    template.days[0].exercises[0].rir = 3;
    template.days[0].exercises[0].rest_seconds = 60;
    mockGet(template);
    vi.mocked(api.put).mockImplementation(() => jsonResponse(template));

    renderAt("/routines/tpl-1");
    await screen.findByText("Press banca");

    fireEvent.change(screen.getByLabelText("RIR del ejercicio"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Pausa entre series, en segundos"), {
      target: { value: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Guardar configuración/ }));

    await waitFor(() => {
      const [, body] = vi.mocked(api.put).mock.calls[0];
      expect((body as any).days[0].exercises[0].rir).toBeNull();
      expect((body as any).days[0].exercises[0].rest_seconds).toBeNull();
    });
  });

  it("un RIR fuera de la escala no se aplica al borrador", async () => {
    const template = makeTemplate({});
    template.days[0].exercises[0].rir = 2;
    mockGet(template);
    vi.mocked(api.put).mockImplementation(() => jsonResponse(template));

    renderAt("/routines/tpl-1");
    await screen.findByText("Press banca");

    const input = screen.getByLabelText("RIR del ejercicio");
    fireEvent.change(input, { target: { value: "11" } });

    // El input deja ver lo tipeado (no se pelea con quien escribe), pero el
    // borrador no se toca: sin cambio real no hay nada que guardar.
    expect(input).toHaveValue(11);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Guardar configuración/ })).toBeDisabled();
    });
    expect(api.put).not.toHaveBeenCalled();
  });
});
