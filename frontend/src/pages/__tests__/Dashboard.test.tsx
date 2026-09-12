import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/http";

import Dashboard from "../Dashboard";
import { renderWithProviders, screen, fireEvent, waitFor } from "../../test/renderWithProviders";
import { defaultPayloadFor } from "../../test/apiMock";
import { useSettingsStore } from "@/stores/settings";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

beforeEach(() => {
  // La vista lee user_role en el efecto de montaje: hay que sembrarlo antes.
  localStorage.setItem("user_role", "owner");
  localStorage.setItem("user_name", "Duenio de Test");
});

describe("vista de dashboard", () => {
  it("muestra las cards de KPI que promete la spec", async () => {
    renderWithProviders(<Dashboard />, { route: "/dashboard" });

    // Son labels de estado derivado: aparecen recien cuando resuelven los efectos
    // de montaje, asi que el assert tiene que ser asincrono.
    expect(await screen.findByText("Clientes activos")).toBeInTheDocument();
    expect(await screen.findByText("Rutina base")).toBeInTheDocument();
    expect(await screen.findByText("Check-ins de hoy")).toBeInTheDocument();
  });

  it("no muestra una seccion de alertas de negocio", async () => {
    renderWithProviders(<Dashboard />, { route: "/dashboard" });

    // El assert negativo va DESPUES de esperar el render final: hacerlo antes
    // pasaria en verde por accidente.
    await screen.findByText("Clientes activos");

    expect(screen.queryByText(/alertas de negocio/i)).toBeNull();
  });

  it("sigue mostrando la facturacion del mes con pagos que traen plan", async () => {
    // `rebuild-payments-with-plan-pricing`: `Payment.plan` es un campo
    // aditivo — el Dashboard no debería romperse ni cambiar sus números al
    // recibir pagos con foto de plan (I1).
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/payments") {
        return Promise.resolve({
          data: [
            {
              id: "payment-1",
              user_id: "user-1",
              user: {
                id: "user-1",
                first_name: "Ana",
                last_name: "Gomez",
                full_name: "Ana Gomez",
                email: "ana@example.com",
                phone: null,
                role: "member",
              },
              amount: 34000,
              method: "cash",
              method_channel: null,
              note: null,
              period_month: new Date().getMonth() + 1,
              period_year: new Date().getFullYear(),
              created_at: new Date().toISOString(),
              plan: { id: "plan-1", name: "Full", reference_amount: 34000 },
            },
          ],
          status: 200,
          statusText: "OK",
          headers: { "x-total-count": "1" },
          config: {},
        } as any);
      }
      return Promise.resolve({
        data: defaultPayloadFor(url),
        status: 200,
        statusText: "OK",
        headers: { "x-total-count": "0" },
        config: {},
      } as any);
    });

    renderWithProviders(<Dashboard />, { route: "/dashboard" });

    expect(await screen.findByText("Últimos movimientos registrados en el sistema.")).toBeInTheDocument();
    expect(await screen.findByText("Ana Gomez")).toBeInTheDocument();
    expect(screen.getByText(/34\.000/)).toBeInTheDocument();
  });

  describe("cobro rapido del bloque Cobrar cuota (verification.md hallazgo 2)", () => {
    function mockUsersSearch(user: Record<string, unknown>) {
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/users") {
          return Promise.resolve({
            data: [user],
            status: 200,
            statusText: "OK",
            headers: { "x-total-count": "1" },
            config: {},
          } as any);
        }
        return Promise.resolve({
          data: defaultPayloadFor(url),
          status: 200,
          statusText: "OK",
          headers: { "x-total-count": "0" },
          config: {},
        } as any);
      });
    }

    it("usa el precio vigente del plan del miembro, no default_fee", async () => {
      mockUsersSearch({
        id: "user-9",
        first_name: "Bruno",
        last_name: "Diaz",
        full_name: "Bruno Diaz",
        email: "bruno@example.com",
        phone: "1122334455",
        role: "member",
        membership_status: "active",
        membership_plan: { id: "plan-9", name: "Full", current_amount: 45000 },
      });

      renderWithProviders(<Dashboard />, { route: "/dashboard" });

      const input = await screen.findByPlaceholderText("Buscá por nombre o teléfono");
      fireEvent.change(input, { target: { value: "Bruno" } });

      const option = await screen.findByText("Bruno Diaz");
      fireEvent.click(option);

      // $45.000 (precio del plan), no $30.000 (default_fee del mock de Ajustes).
      expect(await screen.findByText(/45\.000/)).toBeInTheDocument();
      expect(screen.queryByText(/\$\s?30\.000/)).not.toBeInTheDocument();

      vi.mocked(api.post).mockImplementation((url: string, body: any) => {
        if (url === "/payments") {
          return Promise.resolve({
            data: { id: "payment-9", ...body },
            status: 201,
            statusText: "Created",
            headers: {},
            config: {},
          } as any);
        }
        return Promise.resolve({ data: {}, status: 200, statusText: "OK", headers: {}, config: {} } as any);
      });

      fireEvent.click(screen.getByRole("button", { name: "Cobrar cuota" }));

      await waitFor(() => expect(api.post).toHaveBeenCalled());
      const [, payload] = vi.mocked(api.post).mock.calls[0] as [string, { amount?: number }];
      // El monto no viaja en el payload (igual que el cobro rápido de
      // `UserCard`): el backend cobra el precio vigente del plan.
      expect(payload.amount).toBeUndefined();
    });

    it("solo ofrece los metodos habilitados en Configuracion", async () => {
      useSettingsStore.getState().setSettings({ allow_cash: false, allow_transfer: true });
      mockUsersSearch({
        id: "user-9",
        first_name: "Bruno",
        last_name: "Diaz",
        full_name: "Bruno Diaz",
        email: "bruno@example.com",
        phone: "1122334455",
        role: "member",
        membership_status: "active",
        membership_plan: { id: "plan-9", name: "Full", current_amount: 45000 },
      });

      renderWithProviders(<Dashboard />, { route: "/dashboard" });

      const input = await screen.findByPlaceholderText("Buscá por nombre o teléfono");
      fireEvent.change(input, { target: { value: "Bruno" } });
      fireEvent.click(await screen.findByText("Bruno Diaz"));

      await screen.findByText(/45\.000/);
      expect(screen.queryByRole("button", { name: "Efectivo" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Transferencia" })).toBeInTheDocument();
    });

    it("no ofrece el cobro rapido si el miembro no tiene plan", async () => {
      mockUsersSearch({
        id: "user-9",
        first_name: "Bruno",
        last_name: "Diaz",
        full_name: "Bruno Diaz",
        email: "bruno@example.com",
        phone: "1122334455",
        role: "member",
        membership_status: "active",
        membership_plan: null,
      });

      renderWithProviders(<Dashboard />, { route: "/dashboard" });

      const input = await screen.findByPlaceholderText("Buscá por nombre o teléfono");
      fireEvent.change(input, { target: { value: "Bruno" } });
      fireEvent.click(await screen.findByText("Bruno Diaz"));

      expect(
        await screen.findByText("Este cliente no tiene un plan asignado.")
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cobrar cuota" })).toBeDisabled();
    });
  });
});
