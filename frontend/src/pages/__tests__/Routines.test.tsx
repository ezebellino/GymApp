import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import Routines from "../Routines";
import {
  fireEvent,
  getRowByText,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "../../test/renderWithProviders";
import type { RoutineTemplateSummary } from "@/types";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function makeTemplate(overrides: Partial<RoutineTemplateSummary> = {}): RoutineTemplateSummary {
  return {
    id: "tpl-1",
    name: "Fuerza 4 días",
    tag: "FUERZA",
    day_count: 2,
    assignment_count: 3,
    created_at: "2026-01-01T00:00:00",
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

function mockGet(overrides: Record<string, unknown>) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    for (const [route, data] of Object.entries(overrides)) {
      if (url === route || url.startsWith(route)) return jsonResponse(data);
    }
    return jsonResponse([]);
  });
}

describe("vista de Rutinas", () => {
  it("lista las plantillas con su etiqueta y su cantidad de dias", async () => {
    mockGet({
      "/routines/templates": [makeTemplate({})],
    });

    renderWithProviders(<Routines />, { route: "/routines" });

    expect(await screen.findByText("Fuerza 4 días")).toBeInTheDocument();
    expect(screen.getByText("FUERZA")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("2")).toBeInTheDocument();
  });

  it("abre el detalle de la plantilla al hacer click en la fila", async () => {
    mockGet({
      "/routines/templates": [makeTemplate({})],
    });

    renderWithProviders(
      <Routes>
        <Route path="/routines" element={<Routines />} />
        <Route path="/routines/:templateId" element={<div>Detalle de tpl-1</div>} />
      </Routes>,
      { route: "/routines" }
    );

    await screen.findByText("Fuerza 4 días");
    const row = getRowByText("Fuerza 4 días");
    fireEvent.click(row);

    expect(await screen.findByText("Detalle de tpl-1")).toBeInTheDocument();
  });

  it("abre el detalle desde el boton Ver de la fila", async () => {
    mockGet({
      "/routines/templates": [makeTemplate({})],
    });

    renderWithProviders(
      <Routes>
        <Route path="/routines" element={<Routines />} />
        <Route path="/routines/:templateId" element={<div>Detalle de tpl-1</div>} />
      </Routes>,
      { route: "/routines" }
    );

    await screen.findByText("Fuerza 4 días");
    const row = getRowByText("Fuerza 4 días");
    fireEvent.click(within(row).getByRole("button", { name: "Ver" }));

    expect(await screen.findByText("Detalle de tpl-1")).toBeInTheDocument();
  });

  it("muestra la accion Ver de la fila como icon-button sin texto", async () => {
    mockGet({
      "/routines/templates": [makeTemplate({})],
    });

    renderWithProviders(<Routines />, { route: "/routines" });

    await screen.findByText("Fuerza 4 días");
    const row = getRowByText("Fuerza 4 días");
    const button = within(row).getByRole("button", { name: "Ver" });

    expect(button).toHaveAccessibleName("Ver");
    expect(button.textContent).toBe("");
  });

  it("ofrece la entrada a Ejercicios desde el header", async () => {
    mockGet({
      "/routines/templates": [makeTemplate({})],
    });

    renderWithProviders(
      <Routes>
        <Route path="/routines" element={<Routines />} />
        <Route path="/exercises" element={<div>Catálogo de ejercicios</div>} />
      </Routes>,
      { route: "/routines" }
    );

    await screen.findByText("Fuerza 4 días");
    fireEvent.click(screen.getByRole("link", { name: "Ejercicios" }));

    expect(await screen.findByText("Catálogo de ejercicios")).toBeInTheDocument();
  });

  it("muestra el error del backend cuando el nombre de plantilla ya esta en uso", async () => {
    mockGet({
      "/routines/templates": [makeTemplate({})],
    });
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === "/routines/templates") {
        return Promise.reject({
          response: { data: { detail: "Ya existe una plantilla con ese nombre" } },
        });
      }
      return jsonResponse({});
    });

    renderWithProviders(<Routines />, { route: "/routines" });

    await screen.findByText("Fuerza 4 días");
    fireEvent.click(screen.getByRole("button", { name: /crear plantilla/i }));

    const dialog = await screen.findByRole("dialog", { hidden: true });
    fireEvent.change(within(dialog).getByPlaceholderText("Fuerza 4 días"), {
      target: { value: "FUERZA 4 DIAS" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Crear plantilla" }));

    expect(
      await within(dialog).findByRole("alert")
    ).toHaveTextContent("Ya existe una plantilla con ese nombre");
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/routines/templates", expect.anything());
    });
  });
});
