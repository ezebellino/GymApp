import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import CreateRoutineTemplateDialog from "../CreateRoutineTemplateDialog";
import { fireEvent, renderWithProviders, screen, waitFor } from "../../test/renderWithProviders";

// `template-owned-routine-days` (design D6): la creación de plantilla pide
// solo nombre y etiqueta — sin selección de días, que el backend crea (Día 1)
// en el mismo request.

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function jsonResponse(data: unknown) {
  return Promise.resolve({
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  } as any);
}

describe("CreateRoutineTemplateDialog", () => {
  it("crea una plantilla pidiendo solo nombre y etiqueta", async () => {
    vi.mocked(api.post).mockImplementation((_url: string, body: any) =>
      jsonResponse({
        id: "tpl-new",
        name: body.name,
        tag: body.tag,
        created_at: "2026-01-01T00:00:00",
        updated_at: "2026-01-01T00:00:00",
        days: [{ day_id: "day-1", name: "Día 1", muscle_groups: [], position: 1, exercises: [] }],
      })
    );

    renderWithProviders(<CreateRoutineTemplateDialog open onOpenChange={() => {}} />);

    // Sin selección de días: ningún checkbox/radio de día en el formulario.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);

    fireEvent.change(screen.getByPlaceholderText("Fuerza 4 días"), {
      target: { value: "Full body inicial" },
    });
    fireEvent.change(screen.getByPlaceholderText("FUERZA"), { target: { value: "INICIO" } });

    fireEvent.click(screen.getByRole("button", { name: "Crear plantilla" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/routines/templates", {
        name: "Full body inicial",
        tag: "INICIO",
      });
    });
  });
});
