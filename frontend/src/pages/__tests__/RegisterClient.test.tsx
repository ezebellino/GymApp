import { describe, expect, it, vi } from "vitest";

import RegisterClient from "../RegisterClient";
import { renderWithProviders, screen } from "../../test/renderWithProviders";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

// RegisterClient tampoco hace fetch en montaje.
describe("vista de registro de cliente", () => {
  it("muestra el header de marca, los campos de password y el volver al login", () => {
    renderWithProviders(<RegisterClient />, { route: "/register-client" });

    expect(screen.getByAltText("Gym App")).toBeInTheDocument();
    expect(screen.getByText("Gym App")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/contrase[nñ]a \(m[ií]nimo 6\)/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/repetir contrase[nñ]a/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /volver al login/i }),
    ).toBeInTheDocument();
  });

  it("no muestra el eyebrow ni el titulo que la spec dio de baja", () => {
    renderWithProviders(<RegisterClient />, { route: "/register-client" });

    expect(screen.queryByText(/registro de cliente/i)).toBeNull();
    expect(screen.queryByText(/crear acceso personal/i)).toBeNull();
  });
});
