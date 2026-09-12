import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import MembershipPlans from "../MembershipPlans";
import {
  fireEvent,
  getRowByText,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "../../test/renderWithProviders";
import type { MembershipPlan } from "@/types";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

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
    members_count: 3,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    ...overrides,
  };
}

function jsonResponse(data: unknown, total?: number) {
  return Promise.resolve({
    data,
    status: 200,
    statusText: "OK",
    headers: total !== undefined ? { "x-total-count": String(total) } : {},
    config: {},
  } as any);
}

describe("vista de Planes", () => {
  it("muestra los planes con su precio vigente y filtra por activos", async () => {
    const plans = [makePlan({})];
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/membership-plans/") {
        return jsonResponse(plans, plans.length);
      }
      return jsonResponse({});
    });

    renderWithProviders(<MembershipPlans />, { route: "/plans" });

    expect(await screen.findByText("Estudiante")).toBeInTheDocument();
    expect(screen.getByText("ARS 20.000")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por estado" })).toBeInTheDocument();
  });

  it("abre el dialogo de nuevo precio y lo envia", async () => {
    const plan = makePlan({});
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/membership-plans/") {
        return jsonResponse([plan], 1);
      }
      if (url === "/membership-plans/plan-1") {
        return jsonResponse({ ...plan, price_history: [plan.current_price] });
      }
      return jsonResponse({});
    });
    vi.mocked(api.post).mockImplementation((url: string) => {
      if (url === "/membership-plans/plan-1/prices") {
        return jsonResponse({
          id: "price-2",
          amount: 25000,
          effective_from: "2026-02-01",
          created_at: "2026-02-01T00:00:00",
          created_by_user_id: null,
        });
      }
      return jsonResponse({});
    });

    renderWithProviders(<MembershipPlans />, { route: "/plans" });
    await screen.findByText("Estudiante");

    const row = getRowByText(plan.name);
    fireEvent.click(within(row).getByRole("button", { name: "Agregar precio" }));
    const heading = await screen.findByRole("heading", { name: `Agregar precio a ${plan.name}` });
    const dialog = heading.closest("dialog") as HTMLElement;
    const amountInput = dialog.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "25000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Agregar precio" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/membership-plans/plan-1/prices",
        expect.objectContaining({ amount: 25000 })
      );
    });
  });

  it("deshabilita desactivar cuando es el unico plan activo", async () => {
    const plan = makePlan({});
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/membership-plans/") {
        return jsonResponse([plan], 1);
      }
      return jsonResponse({});
    });

    renderWithProviders(<MembershipPlans />, { route: "/plans" });
    await screen.findByText("Estudiante");

    const row = getRowByText("Estudiante");
    const deactivateButton = within(row).getByRole("button", { name: "Desactivar" });
    expect(deactivateButton).toBeDisabled();
    expect(deactivateButton).toHaveAttribute(
      "title",
      "No se puede desactivar el último plan activo"
    );
  });

  it("muestra Reactivar en vez de Desactivar en la fila de un plan inactivo", async () => {
    const plan = makePlan({ is_active: false });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/membership-plans/") {
        return jsonResponse([plan], 1);
      }
      return jsonResponse({});
    });

    renderWithProviders(<MembershipPlans />, { route: "/plans" });
    await screen.findByText("Estudiante");

    const row = getRowByText("Estudiante");
    expect(within(row).getByRole("button", { name: "Reactivar" })).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Desactivar" })).toBeNull();
  });

  it("habilita desactivar con dos planes activos aunque falte X-Total-Count (hallazgo 9)", async () => {
    // Sin el header, `readTotalCount` cae al fallback `items.length`. Con
    // `limit: 1` ese fallback quedaba pegado en 1 y deshabilitaba
    // "Desactivar" para siempre; con `limit: 200` coincide con el conteo
    // real salvo un gimnasio con más de 200 planes activos.
    const planA = makePlan({ id: "plan-1", name: "Estudiante" });
    const planB = makePlan({ id: "plan-2", name: "Full" });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/membership-plans/") {
        return jsonResponse([planA, planB]); // sin x-total-count
      }
      return jsonResponse({});
    });

    renderWithProviders(<MembershipPlans />, { route: "/plans" });
    await screen.findByText("Estudiante");

    const deactivateButtons = await screen.findAllByRole("button", { name: "Desactivar" });
    expect(deactivateButtons).toHaveLength(2);
    for (const button of deactivateButtons) {
      expect(button).not.toBeDisabled();
    }
  });
});
