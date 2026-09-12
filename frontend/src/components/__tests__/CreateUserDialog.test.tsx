import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import CreateUserDialog from "../CreateUserDialog";
import { fireEvent, renderWithProviders, screen, waitFor } from "../../test/renderWithProviders";
import { useSessionStore } from "@/stores/session";
import type { MembershipPlan } from "@/types";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function jsonResponse(data: unknown, total?: number) {
  return Promise.resolve({
    data,
    status: 200,
    statusText: "OK",
    headers: total !== undefined ? { "x-total-count": String(total) } : {},
    config: {},
  } as any);
}

function makePlan(overrides: Partial<MembershipPlan> = {}): MembershipPlan {
  return {
    id: "plan-1",
    name: "Estudiante",
    description: null,
    is_active: true,
    current_price: {
      id: "price-1",
      amount: 20000,
      effective_from: "2026-01-01",
      created_at: "2026-01-01T00:00:00",
      created_by_user_id: null,
    },
    members_count: 0,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    ...overrides,
  };
}

function base64Url(payload: Record<string, unknown>): string {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fakeToken(email: string): string {
  const header = base64Url({ alg: "none", typ: "JWT" });
  const payload = base64Url({ email, exp: 9999999999 });
  return `${header}.${payload}.signature`;
}

function seedOwner() {
  localStorage.setItem("access_token", fakeToken("owner@miniespacio.test"));
  localStorage.setItem("user_name", "Owner de Test");
  localStorage.setItem("user_role", "owner");
}

describe("CreateUserDialog", () => {
  it("bloquea el alta de un Miembro cuando no hay planes activos", async () => {
    seedOwner();
    useSessionStore.persist.rehydrate();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/membership-plans/") {
        return jsonResponse([], 0);
      }
      return jsonResponse({});
    });

    renderWithProviders(<CreateUserDialog open onOpenChange={() => {}} />, { route: "/users" });

    expect(await screen.findByText(/No hay planes activos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir a Planes" })).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText("Nombre");
    fireEvent.change(nameInput, { target: { value: "Juan" } });
    expect(screen.getByRole("button", { name: "Crear usuario" })).toBeDisabled();
  });

  it("envia el plan elegido al crear un Miembro", async () => {
    seedOwner();
    useSessionStore.persist.rehydrate();
    const plan = makePlan({});
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/membership-plans/") {
        return jsonResponse([plan], 1);
      }
      return jsonResponse({});
    });
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === "/users") {
        return jsonResponse({ id: "u-1", full_name: "Juan Perez" });
      }
      return jsonResponse({});
    });

    renderWithProviders(<CreateUserDialog open onOpenChange={() => {}} />, { route: "/users" });

    const nameInput = await screen.findByPlaceholderText("Nombre");
    fireEvent.change(nameInput, { target: { value: "Juan" } });

    const planSelect = await screen.findByDisplayValue("Elegí un plan");
    fireEvent.change(planSelect, { target: { value: plan.id } });

    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/users",
        expect.objectContaining({ membership_plan_id: plan.id })
      );
    });
  });
});
