import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import Users from "../Users";
import { fireEvent, renderWithProviders, screen, within } from "../../test/renderWithProviders";
import type { User } from "@/types";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function makeUser(overrides: Partial<User>): User {
  return {
    id: "u-1",
    first_name: "Ana",
    last_name: "Gomez",
    full_name: "Ana Gomez",
    age: null,
    birth_date: null,
    weight_kg: null,
    height_cm: null,
    email: "ana@example.com",
    email_verified: true,
    phone: "1155555555",
    phone_verified: false,
    role: "member",
    is_active: true,
    membership_status: "active",
    membership_start_date: "2026-01-01T00:00:00",
    membership_cancelled_at: null,
    membership_indicator: "up_to_date",
    invitation_status: "access_active",
    created_at: "2026-01-01T00:00:00",
    ...overrides,
  };
}

describe("vista de Usuarios", () => {
  it("muestra las columnas de la spec: nombre completo, rol, fecha de alta y comienzo en el gimnasio", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith("/users/")) {
        return Promise.resolve({
          data: [makeUser({})],
          status: 200,
          statusText: "OK",
          headers: { "x-total-count": "1" },
          config: {},
        } as any);
      }
      return Promise.resolve({ data: [], status: 200, statusText: "OK", headers: {}, config: {} } as any);
    });

    renderWithProviders(<Users />, { route: "/users" });

    expect(await screen.findByText("Nombre completo")).toBeInTheDocument();
    expect(screen.getByText("Rol")).toBeInTheDocument();
    expect(screen.getByText("Fecha de alta")).toBeInTheDocument();
    expect(screen.getByText("Comienzo en el gimnasio")).toBeInTheDocument();
    expect(screen.getByText("Acciones")).toBeInTheDocument();
    expect(await screen.findByText("Ana Gomez")).toBeInTheDocument();
    // "Miembro" tambien aparece en la leyenda de roles del hero: se escopea a
    // la tabla para afirmar sobre la fila real, no sobre la leyenda.
    const table = screen.getByRole("table");
    expect(within(table).getByText("Miembro")).toBeInTheDocument();
  });

  it("muestra el circulo verde para up_to_date, con texto accesible (no solo color)", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith("/users/")) {
        return Promise.resolve({
          data: [makeUser({ membership_indicator: "up_to_date" })],
          status: 200,
          statusText: "OK",
          headers: { "x-total-count": "1" },
          config: {},
        } as any);
      }
      return Promise.resolve({ data: [], status: 200, statusText: "OK", headers: {}, config: {} } as any);
    });

    renderWithProviders(<Users />, { route: "/users" });

    expect(await screen.findByRole("img", { name: "Al día con la cuota" })).toBeInTheDocument();
  });

  it("muestra el circulo naranja para overdue, con texto accesible", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith("/users/")) {
        return Promise.resolve({
          data: [makeUser({ membership_indicator: "overdue" })],
          status: 200,
          statusText: "OK",
          headers: { "x-total-count": "1" },
          config: {},
        } as any);
      }
      return Promise.resolve({ data: [], status: 200, statusText: "OK", headers: {}, config: {} } as any);
    });

    renderWithProviders(<Users />, { route: "/users" });

    expect(await screen.findByRole("img", { name: "En mora" })).toBeInTheDocument();
  });

  it("muestra el circulo rojo para suspended, con texto accesible", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith("/users/")) {
        return Promise.resolve({
          data: [makeUser({ membership_indicator: "suspended", membership_status: "cancelled" })],
          status: 200,
          statusText: "OK",
          headers: { "x-total-count": "1" },
          config: {},
        } as any);
      }
      return Promise.resolve({ data: [], status: 200, statusText: "OK", headers: {}, config: {} } as any);
    });

    renderWithProviders(<Users />, { route: "/users" });

    expect(await screen.findByRole("img", { name: "Membresía dada de baja" })).toBeInTheDocument();
  });

  it("no muestra ningun circulo cuando el usuario nunca fue miembro (indicator none)", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith("/users/")) {
        return Promise.resolve({
          data: [
            makeUser({
              role: "coach",
              membership_indicator: "none",
              membership_status: "none",
              membership_start_date: null,
            }),
          ],
          status: 200,
          statusText: "OK",
          headers: { "x-total-count": "1" },
          config: {},
        } as any);
      }
      return Promise.resolve({ data: [], status: 200, statusText: "OK", headers: {}, config: {} } as any);
    });

    renderWithProviders(<Users />, { route: "/users" });

    await screen.findByText("Ana Gomez");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("el boton Crear usuario abre el modal de alta", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith("/users/")) {
        return Promise.resolve({
          data: [makeUser({})],
          status: 200,
          statusText: "OK",
          headers: { "x-total-count": "1" },
          config: {},
        } as any);
      }
      return Promise.resolve({ data: [], status: 200, statusText: "OK", headers: {}, config: {} } as any);
    });

    renderWithProviders(<Users />, { route: "/users" });

    await screen.findByText("Ana Gomez");
    fireEvent.click(screen.getByRole("button", { name: /crear usuario/i }));

    expect(await screen.findByRole("heading", { name: "Crear usuario" })).toBeInTheDocument();
  });

  it("el boton Ver de una fila navega a la ficha del usuario", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith("/users/")) {
        return Promise.resolve({
          data: [makeUser({})],
          status: 200,
          statusText: "OK",
          headers: { "x-total-count": "1" },
          config: {},
        } as any);
      }
      return Promise.resolve({ data: [], status: 200, statusText: "OK", headers: {}, config: {} } as any);
    });

    renderWithProviders(
      <Routes>
        <Route path="/users" element={<Users />} />
        <Route path="/users/:id" element={<div>Ficha de u-1</div>} />
      </Routes>,
      { route: "/users" }
    );

    await screen.findByText("Ana Gomez");
    fireEvent.click(screen.getByRole("button", { name: /^ver$/i }));

    expect(await screen.findByText("Ficha de u-1")).toBeInTheDocument();
  });
});
