import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import UserDetail from "../UserDetail";
import { renderWithProviders, screen } from "../../test/renderWithProviders";
import type { User } from "@/types";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u-1",
    first_name: "Ana",
    last_name: "Gomez",
    full_name: "Ana Gomez",
    age: 30,
    birth_date: "1996-01-01",
    weight_kg: 60,
    height_cm: 165,
    email: "ana@example.com",
    email_verified: true,
    phone: "1155555555",
    phone_verified: true,
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

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/users/:id" element={<UserDetail />} />
    </Routes>,
    { route }
  );
}

describe("ficha de detalle de un usuario", () => {
  it("muestra el perfil, el rol y el estado de membresia del usuario", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/users/u-1") {
        return Promise.resolve({
          data: makeUser({}),
          status: 200,
          statusText: "OK",
          headers: {},
          config: {},
        } as any);
      }
      return Promise.resolve({ data: {}, status: 200, statusText: "OK", headers: {}, config: {} } as any);
    });

    renderAt("/users/u-1");

    expect(await screen.findByRole("heading", { name: "Ana Gomez" })).toBeInTheDocument();
    expect(screen.getByText("Miembro")).toBeInTheDocument();
    expect(screen.getByText("Perfil")).toBeInTheDocument();
    expect(screen.getByText("Membresía")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByText("Invitación al portal")).toBeInTheDocument();
    expect(screen.getByText("Acceso activo")).toBeInTheDocument();
  });

  it("no muestra la seccion de invitacion para un usuario que no es Miembro", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/users/u-2") {
        return Promise.resolve({
          data: makeUser({
            id: "u-2",
            role: "coach",
            membership_status: "none",
            membership_indicator: "none",
            membership_start_date: null,
            invitation_status: "none",
          }),
          status: 200,
          statusText: "OK",
          headers: {},
          config: {},
        } as any);
      }
      return Promise.resolve({ data: {}, status: 200, statusText: "OK", headers: {}, config: {} } as any);
    });

    renderAt("/users/u-2");

    expect(await screen.findByRole("heading", { name: "Ana Gomez" })).toBeInTheDocument();
    expect(screen.getByText("Coach")).toBeInTheDocument();
    expect(screen.queryByText("Invitación al portal")).toBeNull();
  });
});
