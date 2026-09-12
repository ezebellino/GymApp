import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import Payments from "../Payments";
import {
  fireEvent,
  getRowByText,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "../../test/renderWithProviders";
import type { Payment } from "@/types";
import { defaultPayloadFor } from "../../test/apiMock";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1",
    user_id: "user-1",
    user: {
      id: "user-1",
      first_name: "Ana",
      last_name: "Gomez",
      full_name: "Ana Gomez",
      email: "ana@example.com",
      phone: "1155555555",
      role: "member",
    },
    amount: 34000,
    method: "cash",
    method_channel: null,
    note: null,
    period_month: 9,
    period_year: 2026,
    created_at: "2026-09-02T00:00:00",
    plan: { id: "plan-1", name: "Full", reference_amount: 34000 },
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

function seedRole(role: "owner" | "coach") {
  localStorage.setItem("access_token", fakeToken("viewer@miniespacio.test"));
  localStorage.setItem("user_name", "Viewer de Test");
  localStorage.setItem("user_role", role);
}

function renderPayments() {
  return renderWithProviders(
    <Routes>
      <Route path="/payments" element={<Payments />} />
      <Route path="/plans" element={<div>Vista de Planes</div>} />
    </Routes>,
    { route: "/payments" }
  );
}

describe("vista de Pagos", () => {
  beforeEach(() => {
    seedRole("owner");
  });

  it("ofrece un boton Planes que navega a la vista de planes", async () => {
    renderPayments();

    expect(await screen.findByText("Pagos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Planes" }));

    expect(await screen.findByText("Vista de Planes")).toBeInTheDocument();
  });

  it("muestra el plan y el monto de cada pago en la tabla", async () => {
    // Monto pagado distinto de la referencia (D5.1): permite comprobar que
    // la tabla distingue la columna "Precio de referencia" de "Monto".
    const payment = makePayment({
      amount: 30000,
      plan: { id: "plan-1", name: "Full", reference_amount: 34000 },
    });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/payments") return jsonResponse([payment], 1);
      return jsonResponse(defaultPayloadFor(url));
    });

    renderPayments();

    expect(await screen.findByText("Ana Gomez")).toBeInTheDocument();
    expect(screen.getByText("Full")).toBeInTheDocument();
    expect(screen.getByText("ARS 34.000")).toBeInTheDocument();
    expect(screen.getByText("ARS 30.000")).toBeInTheDocument();
    expect(screen.getByText("editado")).toBeInTheDocument();
  });

  it("muestra Sin plan en un pago sin plan de referencia", async () => {
    const payment = makePayment({ plan: null });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/payments") return jsonResponse([payment], 1);
      return jsonResponse(defaultPayloadFor(url));
    });

    renderPayments();

    expect(await screen.findByText("Ana Gomez")).toBeInTheDocument();
    expect(screen.getByText("Sin plan")).toBeInTheDocument();
  });

  it("muestra los indicadores del periodo seleccionado", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/payments") return jsonResponse([], 0);
      if (url === "/payments/summary") {
        return jsonResponse({
          period_year: 2026,
          period_month: 9,
          payments_count: 12,
          amount_sum: 408000,
          members_active: 15,
          members_paid: 12,
          members_pending: 3,
        });
      }
      return jsonResponse(defaultPayloadFor(url));
    });

    renderPayments();

    expect(await screen.findByText("ARS 408.000")).toBeInTheDocument();
    expect(screen.getByText("Pagos registrados:")).toBeInTheDocument();
    expect(screen.getByText("12 / 15")).toBeInTheDocument();
  });

  it("filtra por periodo y por metodo", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/payments") return jsonResponse([], 0);
      return jsonResponse(defaultPayloadFor(url));
    });

    renderPayments();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/payments", expect.anything()));

    fireEvent.change(screen.getByRole("combobox", { name: "Mes" }), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por método" }), {
      target: { value: "transfer" },
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/payments",
        expect.objectContaining({
          params: expect.objectContaining({ period_month: 3, method: "transfer" }),
        })
      );
    });
  });

  it("oculta la accion de anular para un Coach", async () => {
    seedRole("coach");
    const payment = makePayment({});
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/payments") return jsonResponse([payment], 1);
      return jsonResponse(defaultPayloadFor(url));
    });

    renderPayments();

    expect(await screen.findByText("Ana Gomez")).toBeInTheDocument();
    const row = getRowByText("Ana Gomez");
    expect(within(row).queryByRole("button", { name: "Anular" })).toBeNull();
  });

  it("anula un pago como Dueno tras confirmar", async () => {
    const payment = makePayment({});
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/payments") return jsonResponse([payment], 1);
      return jsonResponse(defaultPayloadFor(url));
    });
    vi.mocked(api.delete).mockImplementation(() => jsonResponse(null));

    renderPayments();

    await screen.findByText("Ana Gomez");
    const row = getRowByText("Ana Gomez");
    fireEvent.click(within(row).getByRole("button", { name: "Anular" }));

    const dialogHeading = await screen.findByRole("heading", { name: "Anular pago" });
    const dialog = dialogHeading.closest("dialog") as HTMLElement;
    fireEvent.click(within(dialog).getByRole("button", { name: "Anular" }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith(`/payments/${payment.id}`);
    });
  });
});
