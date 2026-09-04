import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import Login from "../Login";
import { fireEvent, renderWithProviders, screen, waitFor } from "../../test/renderWithProviders";

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

function fillAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText("manga_aguirre"), {
    target: { value: "usuario" },
  });
  fireEvent.change(screen.getByPlaceholderText("Tu contrasena"), {
    target: { value: "secreta" },
  });
  fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
}

// Login pide `/auth/me` para pasarle `{name, role, email}` a `setSession` y
// empujar `theme_preference` al store de tema (dec. 5.2 y 12 de
// `openspec/changes/adopt-kinetic-obsidian-theme/design.md`). El mock de
// `/auth/me` tiene que devolver ese campo para que el flujo de login real no
// se rompa, incluido el caso `theme_preference: null`.
describe("vista de login - theme_preference de /auth/me", () => {
  it("aplica el theme_preference que devuelve /auth/me al loguearse", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { access_token: "test-token", token_type: "bearer" },
    } as any);
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        id: "1",
        full_name: "Test User",
        email: "test@test.com",
        role: "owner",
        email_verified: true,
        theme_preference: "light",
      },
    } as any);

    renderWithProviders(<Login />, { route: "/login" });
    fillAndSubmit();

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
    });
  });

  it("theme_preference null no rompe el login y cae al modo por defecto", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { access_token: "test-token", token_type: "bearer" },
    } as any);
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        id: "1",
        full_name: "Test User",
        email: "test@test.com",
        role: "owner",
        email_verified: true,
        theme_preference: null,
      },
    } as any);

    renderWithProviders(<Login />, { route: "/login" });
    fillAndSubmit();

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
  });
});
