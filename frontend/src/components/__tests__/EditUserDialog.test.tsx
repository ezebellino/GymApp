import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import EditUserDialog from "../EditUserDialog";
import { fireEvent, renderWithProviders, screen } from "../../test/renderWithProviders";
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

describe("EditUserDialog (achicado a solo perfil)", () => {
  it("no ofrece acciones de membresia", () => {
    renderWithProviders(
      <EditUserDialog open onOpenChange={() => {}} user={makeUser()} />
    );

    expect(screen.queryByText("Membresía")).toBeNull();
    expect(screen.queryByRole("button", { name: "Dar de baja la membresía" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Activar membresía" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reactivar membresía" })).toBeNull();
  });

  it("no ofrece acciones de invitacion al portal", () => {
    renderWithProviders(
      <EditUserDialog
        open
        onOpenChange={() => {}}
        user={makeUser({ invitation_status: "none" })}
      />
    );

    expect(screen.queryByText("Invitación al portal")).toBeNull();
    expect(screen.queryByRole("button", { name: "Invitar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reenviar invitación" })).toBeNull();
  });

  it("guarda solo los datos de perfil", async () => {
    vi.mocked(api.patch).mockResolvedValue({
      data: makeUser({ first_name: "Ana María" }),
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    } as any);

    renderWithProviders(
      <EditUserDialog open onOpenChange={() => {}} user={makeUser()} />
    );

    fireEvent.change(screen.getByPlaceholderText("Nombre"), {
      target: { value: "Ana María" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await screen.findByRole("button", { name: "Guardar cambios" });
    expect(api.patch).toHaveBeenCalledWith(
      "/users/u-1",
      expect.objectContaining({ first_name: "Ana María" })
    );
    expect(api.post).not.toHaveBeenCalled();
  });
});
