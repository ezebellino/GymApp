import { describe, expect, it, vi } from "vitest";

import UserCard from "../UserCard";
import { renderWithProviders, screen } from "../../test/renderWithProviders";
import { useSettingsStore } from "@/stores/settings";
import type { User } from "@/types";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    first_name: "Ana",
    last_name: "Gomez",
    full_name: "Ana Gomez",
    email: "ana@example.com",
    email_verified: true,
    phone: "1155555555",
    phone_verified: true,
    role: "member",
    is_active: true,
    membership_status: "active",
    membership_indicator: "up_to_date",
    invitation_status: "none",
    created_at: "2026-01-01T00:00:00",
    membership_plan: { id: "plan-1", name: "Full", current_amount: 34000 },
    plan_since: "2026-01-01",
    ...overrides,
  };
}

describe("UserCard - cobro rapido", () => {
  it("ofrece los dos metodos cuando estan habilitados en Configuracion", async () => {
    useSettingsStore.getState().setSettings({ allow_cash: true, allow_transfer: true });
    renderWithProviders(<UserCard viewerRole="owner" client={makeUser()} />);

    expect(await screen.findByRole("button", { name: "Efectivo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transferencia" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cobro rapido (precio del plan)" })
    ).toBeEnabled();
  });

  it("ofrece solo el metodo habilitado en Configuracion (verification.md hallazgo 2)", async () => {
    useSettingsStore.getState().setSettings({ allow_cash: false, allow_transfer: true });
    renderWithProviders(<UserCard viewerRole="owner" client={makeUser()} />);

    await screen.findByRole("button", { name: "Cobro rapido (Transferencia)" });
    expect(screen.queryByRole("button", { name: "Efectivo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transferencia" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cobro rapido (Transferencia)" })
    ).toBeEnabled();
  });

  it("nombra el medio de cobro en el CTA cuando solo hay un metodo habilitado (verification.md hallazgo 7)", async () => {
    useSettingsStore.getState().setSettings({ allow_cash: true, allow_transfer: false });
    renderWithProviders(<UserCard viewerRole="owner" client={makeUser()} />);

    expect(
      await screen.findByRole("button", { name: "Cobro rapido (Efectivo)" })
    ).toBeEnabled();
  });

  it("no ofrece el cobro rapido si no hay ningun metodo habilitado", async () => {
    useSettingsStore.getState().setSettings({ allow_cash: false, allow_transfer: false });
    renderWithProviders(<UserCard viewerRole="owner" client={makeUser()} />);

    await screen.findByText("Editar datos");
    expect(
      screen.queryByRole("button", { name: /Cobro rapido/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Efectivo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transferencia" })).not.toBeInTheDocument();
  });
});
