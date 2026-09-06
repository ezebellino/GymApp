import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import MemberTemplatesCard from "../MemberTemplatesCard";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../../test/renderWithProviders";
import type { RoutineAssignment, User } from "@/types";

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

function makeAssignment(overrides: Partial<RoutineAssignment> = {}): RoutineAssignment {
  return {
    id: "assign-1",
    user_id: "u-1",
    template_id: "tpl-1",
    template_name: "Fuerza 4 días",
    template_tag: "FUERZA",
    status: "active",
    starts_on: "2026-01-01",
    created_at: "2026-01-01T00:00:00",
    adjustments_count: 0,
    last_adjustment: null,
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

function mockAssignments(assignments: RoutineAssignment[]) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/routines/users/u-1/templates") {
      return jsonResponse(assignments);
    }
    return jsonResponse([]);
  });
}

describe("card de plantillas asignadas en la ficha del usuario", () => {
  it("lista las plantillas asignadas con su estado", async () => {
    mockAssignments([
      makeAssignment({ id: "a-1", status: "active", template_name: "Fuerza 4 días" }),
      makeAssignment({
        id: "a-2",
        status: "alternative",
        template_name: "Hipertrofia",
        adjustments_count: 1,
        last_adjustment: { by_name: "Coach Eze", at: "2026-01-05T00:00:00" },
      }),
    ]);

    renderWithProviders(<MemberTemplatesCard user={makeUser({})} canManage />);

    expect(await screen.findByText("Fuerza 4 días")).toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(screen.getByText("Hipertrofia")).toBeInTheDocument();
    expect(screen.getByText("Alternativa")).toBeInTheDocument();
    expect(screen.getByText("Sin ajustes")).toBeInTheDocument();
    expect(screen.getByText(/Ajustada por Coach Eze el/)).toBeInTheDocument();
  });

  it("no ofrece asignar plantilla a un miembro sin membresia activa", async () => {
    mockAssignments([makeAssignment({})]);

    renderWithProviders(
      <MemberTemplatesCard user={makeUser({ membership_status: "cancelled" })} canManage />
    );

    await screen.findByText("Fuerza 4 días");
    expect(screen.queryByRole("button", { name: "+ Asignar plantilla" })).toBeNull();
  });

  it("sigue listando las plantillas de un miembro sin membresia activa", async () => {
    mockAssignments([makeAssignment({ template_name: "Fuerza 4 días" })]);

    renderWithProviders(
      <MemberTemplatesCard user={makeUser({ membership_status: "cancelled" })} canManage />
    );

    expect(await screen.findByText("Fuerza 4 días")).toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
  });

  it("pide confirmacion antes de quitar una asignacion", async () => {
    mockAssignments([makeAssignment({ id: "a-1", template_name: "Fuerza 4 días" })]);
    vi.mocked(api.delete).mockImplementation((url: string) => {
      if (url === "/routines/users/u-1/templates/a-1") {
        return jsonResponse({});
      }
      return jsonResponse({});
    });

    renderWithProviders(<MemberTemplatesCard user={makeUser({})} canManage />);

    await screen.findByText("Fuerza 4 días");
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));

    const dialog = await screen.findByRole("dialog", { hidden: true });
    expect(within(dialog).getByText(/vas a quitar/i)).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Quitar asignación" }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/routines/users/u-1/templates/a-1");
    });
  });
});
