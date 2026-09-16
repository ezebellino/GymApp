import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import Exercises from "../Exercises";
import {
  fireEvent,
  getRowByText,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "../../test/renderWithProviders";
import type { Exercise, ExerciseMeta } from "@/types";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "custom-1",
    name: "Press de banca",
    description: null,
    muscle_group: "Pecho",
    training_types: ["Fuerza", "Hipertrofia"],
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

const META: ExerciseMeta = {
  muscle_groups: ["Pecho", "Espalda", "Cuádriceps"],
  training_types: ["Fuerza", "Hipertrofia", "Movilidad"],
};

function jsonResponse(data: unknown, total?: number) {
  return Promise.resolve({
    data,
    status: 200,
    statusText: "OK",
    headers: total !== undefined ? { "x-total-count": String(total) } : {},
    config: {},
  } as any);
}

function mockGet(exercises: Exercise[], meta: ExerciseMeta = META) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/exercises/") return jsonResponse(exercises, exercises.length);
    if (url === "/exercises/meta") return jsonResponse(meta);
    return jsonResponse({});
  });
}

describe("vista de Ejercicios", () => {
  it("muestra el listado con grupo muscular y tipos de entrenamiento", async () => {
    mockGet([makeExercise({})]);

    renderWithProviders(<Exercises />, { route: "/exercises" });

    expect(await screen.findByText("Press de banca")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Pecho")).toBeInTheDocument();
    expect(within(table).getByText("Fuerza")).toBeInTheDocument();
    expect(within(table).getByText("Hipertrofia")).toBeInTheDocument();
  });

  it("filtra por grupo muscular al elegirlo en el selector", async () => {
    mockGet([makeExercise({})]);

    renderWithProviders(<Exercises />, { route: "/exercises" });
    await screen.findByText("Press de banca");

    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por grupo muscular" }), {
      target: { value: "Cuádriceps" },
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/exercises/",
        expect.objectContaining({
          params: expect.objectContaining({ muscle_group: "Cuádriceps" }),
        })
      );
    });
  });

  it("crea un ejercicio y sube el archivo de media en la misma confirmación", async () => {
    mockGet([]);
    const created = makeExercise({ id: "custom-2", name: "Sentadilla" });
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === "/exercises/") return jsonResponse(created);
      if (url === "/exercises/custom-2/media") {
        return jsonResponse({ ...created, media_kind: "file" });
      }
      return jsonResponse({});
    });

    renderWithProviders(<Exercises />, { route: "/exercises" });
    await screen.findByText("Catálogo vacío");

    // El estado vacío también ofrece un botón "Crear ejercicio" (D6): se
    // toma el primero en el DOM, que es el de la cabecera de la lista.
    const [createButton] = screen.getAllByRole("button", { name: "Crear ejercicio" });
    fireEvent.click(createButton);
    const dialog = await screen.findByRole("dialog", { hidden: true });

    fireEvent.change(within(dialog).getByPlaceholderText("Press de banca"), {
      target: { value: "Sentadilla" },
    });

    const file = new File(["contenido"], "demo.mp4", { type: "video/mp4" });
    const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Crear ejercicio" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/exercises/", expect.objectContaining({ name: "Sentadilla" }));
    });
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/exercises/custom-2/media", expect.any(FormData));
    });
  });

  it("muestra el archivo propio cuando el ejercicio tiene archivo y URL externa", async () => {
    mockGet([
      makeExercise({
        media_kind: "file",
        media_content_type: "video/mp4",
        media_file_url: "https://storage.example/demo.mp4",
        external_media_url: "https://youtube.com/watch?v=abc",
      }),
    ]);

    renderWithProviders(<Exercises />, { route: "/exercises" });
    await screen.findByText("Press de banca");

    const row = getRowByText("Press de banca");
    fireEvent.click(within(row).getByRole("button", { name: "Editar" }));
    // `CreateExerciseDialog` queda montado (cerrado) en simultáneo (patrón del
    // repo), así que `findByRole("dialog", { hidden: true })` sin más
    // encontraría dos: se ubica el diálogo abierto por su título.
    const heading = await screen.findByRole("heading", { name: "Editar ejercicio" });
    const dialog = heading.closest("dialog") as HTMLElement;

    // El preview lee `media_kind` del backend (design D3/D6): archivo propio
    // gana, la UI no reimplementa la prioridad.
    expect(within(dialog).getByRole("button", { name: "Quitar archivo" })).toBeInTheDocument();
    expect(
      within(dialog).queryByText(/Se muestra la URL externa como demostración/)
    ).not.toBeInTheDocument();
  });

  it("ofrece desactivar en vez de borrar cuando el ejercicio está en uso", async () => {
    mockGet([makeExercise({})]);
    vi.mocked(api.delete).mockImplementation((url: string) => {
      if (url === "/exercises/custom-1") {
        return Promise.reject({
          response: {
            status: 409,
            data: { detail: "El ejercicio está en uso (plantillas o registros de entrenamiento). Desactivalo en su lugar." },
          },
        });
      }
      return jsonResponse({});
    });
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === "/exercises/custom-1/deactivate") {
        return jsonResponse(makeExercise({ is_active: false }));
      }
      return jsonResponse({});
    });

    renderWithProviders(<Exercises />, { route: "/exercises" });
    await screen.findByText("Press de banca");

    const row = getRowByText("Press de banca");
    fireEvent.click(within(row).getByRole("button", { name: "Borrar" }));
    const heading = await screen.findByRole("heading", { name: "Borrar ejercicio" });
    const dialog = heading.closest("dialog") as HTMLElement;
    fireEvent.click(within(dialog).getByRole("button", { name: "Borrar" }));

    const desactivarButton = await within(dialog).findByRole("button", {
      name: "Desactivar en su lugar",
    });
    expect(
      within(dialog).getByText(/está en uso/)
    ).toBeInTheDocument();

    fireEvent.click(desactivarButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/exercises/custom-1/deactivate", {});
    });
  });

  it("muestra las tres acciones de fila como icon-buttons sin texto", async () => {
    mockGet([makeExercise({})]);

    renderWithProviders(<Exercises />, { route: "/exercises" });
    await screen.findByText("Press de banca");

    const row = getRowByText("Press de banca");
    const editButton = within(row).getByRole("button", { name: "Editar" });
    const deactivateButton = within(row).getByRole("button", { name: "Desactivar" });
    const deleteButton = within(row).getByRole("button", { name: "Borrar" });

    expect(editButton.textContent).toBe("");
    expect(deactivateButton.textContent).toBe("");
    expect(deleteButton.textContent).toBe("");
  });

  it("muestra el estado vacío de catálogo con la acción de crear ejercicio cuando no hay ninguno", async () => {
    mockGet([]);

    renderWithProviders(<Exercises />, { route: "/exercises" });

    expect(await screen.findByText("Catálogo vacío")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Todavía no cargaste ningún ejercicio. Cargá el primero para empezar a armar tus plantillas de rutina."
      )
    ).toBeInTheDocument();

    // Dos botones "Crear ejercicio": el de la cabecera y el del estado vacío
    // (D6) — el mismo handler que abre `CreateExerciseDialog`.
    const buttons = screen.getAllByRole("button", { name: "Crear ejercicio" });
    expect(buttons.length).toBe(2);

    fireEvent.click(buttons[1]);
    expect(await screen.findByRole("dialog", { hidden: true })).toBeInTheDocument();
  });

  it("ofrece la acción de crear ejercicio del estado vacío también a un Coach", async () => {
    localStorage.setItem("user_role", "coach");
    mockGet([]);

    renderWithProviders(<Exercises />, { route: "/exercises" });

    await screen.findByText("Catálogo vacío");
    const buttons = screen.getAllByRole("button", { name: "Crear ejercicio" });
    expect(buttons.length).toBe(2);
  });

  it("mantiene el mensaje de sin resultados y no ofrece crear cuando la búsqueda no matchea", async () => {
    mockGet([]);

    renderWithProviders(<Exercises />, { route: "/exercises" });
    await screen.findByText("Catálogo vacío");

    fireEvent.change(screen.getByRole("textbox", { name: "Buscar ejercicios" }), {
      target: { value: "inexistente" },
    });

    expect(await screen.findByText("Sin resultados")).toBeInTheDocument();
    expect(screen.getByText(/No encontramos ejercicios que coincidan con/)).toBeInTheDocument();
    expect(screen.getByText('"inexistente"')).toBeInTheDocument();

    // Solo queda el botón "Crear ejercicio" de la cabecera: el estado vacío
    // de búsqueda no ofrece la acción (escenario explícito de la spec).
    const buttons = screen.getAllByRole("button", { name: "Crear ejercicio" });
    expect(buttons.length).toBe(1);
  });

  it("mantiene el mensaje de sin resultados y no ofrece crear cuando el filtro de grupo no matchea", async () => {
    // Rama de **filtro** sobre un catálogo lleno: la spec limita "Catálogo
    // vacío" a "sin ningún filtro ni búsqueda aplicada".
    vi.mocked(api.get).mockImplementation((url: string, config?: any) => {
      if (url === "/exercises/") {
        const rows = config?.params?.muscle_group ? [] : [makeExercise({})];
        return jsonResponse(rows, rows.length);
      }
      if (url === "/exercises/meta") return jsonResponse(META);
      return jsonResponse({});
    });

    renderWithProviders(<Exercises />, { route: "/exercises" });
    await screen.findByText("Press de banca");

    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por grupo muscular" }), {
      target: { value: "Espalda" },
    });

    expect(await screen.findByText("Sin resultados")).toBeInTheDocument();
    expect(screen.queryByText("Catálogo vacío")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Crear ejercicio" }).length).toBe(1);
  });
});
