import { describe, expect, it, vi } from "vitest";

import Login from "../Login";
import { renderWithProviders, screen } from "../../test/renderWithProviders";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

// Login no hace fetch en montaje: los getBy*/queryBy* sincronicos alcanzan.
describe("vista de login", () => {
  it("muestra la marca, los campos y las acciones que promete la spec", () => {
    renderWithProviders(<Login />, { route: "/login" });

    expect(screen.getByAltText("Gym App")).toBeInTheDocument();
    expect(screen.getByText("Gym App")).toBeInTheDocument();
    expect(screen.getByText("Usuario")).toBeInTheDocument();
    // La UI escribe "Contrasena" sin tilde; la spec la nombra "Contraseña".
    expect(screen.getByText(/contrase[nñ]a/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /registrar cuenta/i }),
    ).toBeInTheDocument();
  });

  it("no muestra banner de demo, contador de conexion ni aviso de backend", () => {
    renderWithProviders(<Login />, { route: "/login" });

    expect(screen.queryByText(/demo/i)).toBeNull();
    expect(screen.queryByText(/conexi[oó]n/i)).toBeNull();
    expect(screen.queryByText(/reactiv/i)).toBeNull();
    expect(screen.queryByText(/backend/i)).toBeNull();
  });
});
