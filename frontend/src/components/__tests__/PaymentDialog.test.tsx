import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import PaymentDialog from "../PaymentDialog";
import { fireEvent, renderWithProviders, screen, waitFor } from "../../test/renderWithProviders";
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

function jsonResponse(data: unknown) {
  return Promise.resolve({
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  } as any);
}

function amountInput(): HTMLInputElement {
  return document.querySelector('input[type="number"]') as HTMLInputElement;
}

beforeEach(() => {
  useSettingsStore.getState().setSettings({ allow_cash: true, allow_transfer: true });
});

describe("PaymentDialog", () => {
  it("precarga el monto con el precio vigente del plan del miembro", async () => {
    const user = makeUser({});
    renderWithProviders(<PaymentDialog open onOpenChange={() => {}} user={user} />);

    await waitFor(() => expect(amountInput()).not.toBeNull());
    expect(amountInput().value).toBe("34000");
  });

  it("precarga el precio vigente al registrar y no el del periodo cubierto", async () => {
    const user = makeUser({});
    renderWithProviders(<PaymentDialog open onOpenChange={() => {}} user={user} />);

    await waitFor(() => expect(amountInput()).not.toBeNull());
    const monthInput = screen
      .getAllByRole("spinbutton")
      .find((el) => (el as HTMLInputElement).min === "1" && (el as HTMLInputElement).max === "12") as HTMLInputElement;
    fireEvent.change(monthInput, { target: { value: "8" } });

    // El monto sigue siendo el precio vigente HOY (34000), sin importar el
    // período que se cubre (D2: no el que regía en 08/2026).
    expect(amountInput().value).toBe("34000");
  });

  it("bloquea el alta y ofrece asignar plan si el miembro no tiene plan", async () => {
    const user = makeUser({ membership_plan: null });
    renderWithProviders(<PaymentDialog open onOpenChange={() => {}} user={user} />);

    expect(
      await screen.findByText("Este miembro no tiene un plan asignado.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Asignar plan" })).toHaveAttribute(
      "href",
      "/users/user-1"
    );
    expect(screen.getByRole("button", { name: "Registrar pago" })).toBeDisabled();
  });

  it("solo ofrece los metodos habilitados en Configuracion", async () => {
    useSettingsStore.getState().setSettings({ allow_cash: false, allow_transfer: true });
    const user = makeUser({});
    renderWithProviders(<PaymentDialog open onOpenChange={() => {}} user={user} />);

    const select = (await screen.findByLabelText("Método")) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(["transfer"]);
  });

  it("conserva el monto editado si la prop user cambia de identidad con el dialogo abierto", async () => {
    // verification.md hallazgo 1: `amountEdited` y `amount` se reseteaban en
    // efectos con dependencias distintas. Si `user` llega con un objeto nuevo
    // (mismo id) mientras el diálogo está abierto y el monto ya fue editado,
    // el payload tiene que seguir llevando ese monto editado.
    const user = makeUser({});
    vi.mocked(api.post).mockImplementation((url: string, body: any) => {
      if (url === "/payments") return jsonResponse({ id: "payment-1", ...body });
      return jsonResponse({});
    });

    const { rerender } = renderWithProviders(
      <PaymentDialog open onOpenChange={() => {}} user={user} />
    );

    await waitFor(() => expect(amountInput()).not.toBeNull());
    fireEvent.change(amountInput(), { target: { value: "30000" } });
    expect(amountInput().value).toBe("30000");

    // Misma persona (mismo id), objeto nuevo: simula lo que devuelve
    // react-query tras un refetch (`refetchOnWindowFocus`, por ejemplo).
    rerender(<PaymentDialog open onOpenChange={() => {}} user={{ ...user }} />);

    expect(amountInput().value).toBe("30000");
    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, payload] = vi.mocked(api.post).mock.calls[0] as [string, { amount?: number }];
    expect(payload.amount).toBe(30000);
  });

  it("avisa si el miembro tiene plan pero sin precio vigente", async () => {
    const user = makeUser({
      membership_plan: { id: "plan-1", name: "Full", current_amount: null },
    });
    renderWithProviders(<PaymentDialog open onOpenChange={() => {}} user={user} />);

    expect(
      await screen.findByText("El plan de este miembro no tiene un precio vigente.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar plan" })).toHaveAttribute(
      "href",
      "/users/user-1"
    );
    expect(screen.getByRole("button", { name: "Registrar pago" })).toBeDisabled();
  });

  it("no busca miembros si el miembro ya viene por prop", async () => {
    const user = makeUser({});
    renderWithProviders(<PaymentDialog open onOpenChange={() => {}} user={user} />);

    await waitFor(() => expect(amountInput()).not.toBeNull());
    expect(api.get).not.toHaveBeenCalledWith("/users", expect.anything());
  });

  it("siempre manda el amount en el payload, editado o no (verification.md hallazgo 1, segunda pasada)", async () => {
    // El arreglo anterior omitía `amount` cuando el usuario no editaba el
    // campo, y ataba el reset de `amountEdited` a la identidad del
    // miembro: si cambiaba `membership_plan.current_amount` con el diálogo
    // abierto, el payload seguía omitiendo `amount` y el backend cobraba el
    // precio nuevo sin que la pantalla lo mostrara. El cierre robusto es
    // mandar SIEMPRE `Number(amount)`: `canSubmit` ya garantiza que el input
    // tiene un valor numérico antes de permitir el submit.
    const user = makeUser({});
    vi.mocked(api.post).mockImplementation((url: string, body: any) => {
      if (url === "/payments") return jsonResponse({ id: "payment-1", ...body });
      return jsonResponse({});
    });

    renderWithProviders(<PaymentDialog open onOpenChange={() => {}} user={user} />);

    // Caso 1: monto SIN editar (34000, el precargado desde el plan).
    await waitFor(() => expect(amountInput()).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, unEditedPayload] = vi.mocked(api.post).mock.calls[0] as [string, { amount?: number }];
    expect(unEditedPayload.amount).toBe(34000);

    vi.mocked(api.post).mockClear();

    // Caso 2: monto EDITADO.
    fireEvent.change(amountInput(), { target: { value: "30000" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, editedPayload] = vi.mocked(api.post).mock.calls[0] as [string, { amount?: number }];
    expect(editedPayload.amount).toBe(30000);
  });
});
