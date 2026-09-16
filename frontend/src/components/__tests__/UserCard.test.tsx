import { describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import UserCard from "../UserCard";
import { fireEvent, renderWithProviders, screen, waitFor } from "../../test/renderWithProviders";
import { useSettingsStore } from "@/stores/settings";
import type { User, UserProgressSummary } from "@/types";

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

function makeProgressSummary(overrides: Partial<UserProgressSummary> = {}): UserProgressSummary {
  return {
    user_id: "user-1",
    user_name: "Ana Gomez",
    gym_name: "Gym App",
    log_count: 0,
    attendance_count: 0,
    session_count: 0,
    unique_exercises: 0,
    total_volume: 0,
    score: 42,
    last_training: null,
    best_exercise_name: null,
    best_weight_kg: null,
    top_improvement: null,
    motivation: "Seguí así",
    active_assignment: null,
    ...overrides,
  };
}

// D14 (corrección del gate): el puntaje del PDF lo calcula el servidor —
// `UserCard.tsx` deja de reimplementar `Math.min(log_count * 3, 40) + ...`.
describe("UserCard - PDF de progreso", () => {
  it("usa el puntaje que calcula el servidor en el PDF de progreso", async () => {
    // Con `log_count: 0`, `attendance_count: 0` y sin `top_improvement`, la
    // fórmula vieja del cliente daría `Math.max(10, 0) = 10`: un `score` de
    // 42 del servidor solo puede llegar al PDF si `UserCard` lo consume tal
    // cual, sin recalcularlo.
    let capturedBlob: Blob | null = null;
    window.URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:mock";
    }) as unknown as typeof window.URL.createObjectURL;
    window.URL.revokeObjectURL = vi.fn();

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/routines/users/user-1/progress-summary") {
        return Promise.resolve({
          data: makeProgressSummary(),
          status: 200,
          statusText: "OK",
          headers: {},
          config: {},
        } as any);
      }
      return Promise.resolve({
        data: {},
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      } as any);
    });

    useSettingsStore.getState().setSettings({ allow_cash: true, allow_transfer: true });
    renderWithProviders(<UserCard viewerRole="owner" client={makeUser()} />);

    fireEvent.click(await screen.findByRole("button", { name: "PDF progreso" }));

    await waitFor(() => expect(capturedBlob).not.toBeNull());
    const text = await (capturedBlob as unknown as Blob).text();
    expect(text).toContain("42/100");
  });
});
