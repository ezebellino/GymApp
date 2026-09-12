import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import ActivateMembershipDialog from "../ActivateMembershipDialog";
import { fireEvent, renderWithProviders, screen, waitFor } from "../../test/renderWithProviders";
import { useSessionStore } from "@/stores/session";
import type { MembershipPlan, User } from "@/types";

// D2.2, verification.md (segunda pasada, hallazgo bloqueante 1): antes de este
// arreglo, `UserDetail.test.tsx:360` solo afirmaba que el boton "Activar
// membresia" existia, con `api.post` mockeado a exito para cualquier URL — un
// ciclo verde en falso que no distinguia una sola llamada atomica de dos
// llamadas encadenadas (ni de ninguna llamada en absoluto). Este archivo
// afirma sobre la URL y el body reales.

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

function rejectWith(detail: string) {
  return Promise.reject({ response: { data: { detail } } });
}

function makePlan(overrides: Partial<MembershipPlan> = {}): MembershipPlan {
  return {
    id: "plan-1",
    name: "General",
    description: null,
    is_active: true,
    current_price: {
      id: "price-1",
      amount: 15000,
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

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u-1",
    first_name: "Juan",
    last_name: "Perez",
    full_name: "Juan Perez",
    age: 30,
    birth_date: "1996-01-01",
    weight_kg: null,
    height_cm: null,
    email: "juan@example.com",
    email_verified: true,
    phone: null,
    phone_verified: false,
    role: "coach",
    is_active: true,
    membership_status: "none",
    membership_start_date: null,
    membership_cancelled_at: null,
    membership_indicator: "none",
    invitation_status: "none",
    created_at: "2026-01-01T00:00:00",
    membership_plan: null,
    plan_since: null,
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

describe("ActivateMembershipDialog", () => {
  it("activa la membresia de quien nunca fue miembro mandando el plan en una sola llamada", async () => {
    seedOwner();
    useSessionStore.persist.rehydrate();
    const plan = makePlan();
    const user = makeUser({ membership_status: "none" });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/membership-plans/") {
        return jsonResponse([plan]);
      }
      return jsonResponse({});
    });
    vi.mocked(api.post).mockImplementation(() => jsonResponse(makeUser({ membership_status: "active" })));

    renderWithProviders(
      <ActivateMembershipDialog open onOpenChange={() => {}} user={user} />,
      { route: "/users/u-1" }
    );

    await screen.findByRole("option", { name: "General" });
    const planSelect = screen.getByDisplayValue("Elegí un plan");
    fireEvent.change(planSelect, { target: { value: plan.id } });

    fireEvent.click(screen.getByRole("button", { name: "Activar membresía" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/users/u-1/membership/activate",
        expect.objectContaining({ membership_plan_id: plan.id })
      );
    });
    // La regresión que cerró D2.2: no debe existir ninguna llamada encadenada
    // al endpoint de cambio de plan.
    expect(api.post).not.toHaveBeenCalledWith(
      "/users/u-1/plan",
      expect.anything()
    );
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("muestra el error del backend cuando la activacion falla", async () => {
    seedOwner();
    useSessionStore.persist.rehydrate();
    const plan = makePlan();
    const user = makeUser({ membership_status: "none" });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/membership-plans/") {
        return jsonResponse([plan]);
      }
      return jsonResponse({});
    });
    vi.mocked(api.post).mockImplementation(() => rejectWith("Plan no encontrado"));

    renderWithProviders(
      <ActivateMembershipDialog open onOpenChange={() => {}} user={user} />,
      { route: "/users/u-1" }
    );

    await screen.findByRole("option", { name: "General" });
    const planSelect = screen.getByDisplayValue("Elegí un plan");
    fireEvent.change(planSelect, { target: { value: plan.id } });

    fireEvent.click(screen.getByRole("button", { name: "Activar membresía" }));

    expect(await screen.findByText("Plan no encontrado")).toBeInTheDocument();
  });
});
