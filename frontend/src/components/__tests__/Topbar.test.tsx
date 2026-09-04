import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import Topbar from "../Topbar";
import { fireEvent, renderWithProviders, screen, waitFor } from "../../test/renderWithProviders";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

// `Topbar` sólo monta el toggle de tema con sesión (`isAuthed`). Sembrar en el
// `beforeEach` propio del archivo, nunca dentro del `it` (regla de
// `frontend/AGENTS.md`): a esa altura el store ya rehidrató y el componente ya
// leyó su selector.
function seedSession() {
  localStorage.setItem("access_token", "test-token");
  localStorage.setItem("user_role", "owner");
}

describe("Topbar - toggle de modo", () => {
  beforeEach(() => {
    seedSession();
  });

  it("el click cambia data-theme, persiste en app_theme y dispara el PATCH", async () => {
    renderWithProviders(<Topbar />);

    // Default del store de tema es "dark" (DEFAULT_THEME_MODE), así que el
    // botón ofrece pasar a "claro".
    const toggle = screen.getByRole("button", { name: /cambiar a modo claro/i });

    fireEvent.click(toggle);

    // setMode aplica + persiste de forma sincrónica (dec. 7); el PATCH lo
    // dispara la mutación de react-query, que resuelve en un microtask
    // posterior al click.
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("app_theme")).toBe("light");
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/auth/me/theme", {
        theme_preference: "light",
      });
    });
  });
});
