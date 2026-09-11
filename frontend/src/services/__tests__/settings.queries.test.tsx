import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/http";
import { useSyncSettings } from "../settings.queries";
import { renderWithProviders, waitFor } from "../../test/renderWithProviders";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

// Componente sonda minimo: `useSyncSettings` no renderiza nada, asi que un
// componente vacio alcanza para montarlo con `renderWithProviders`.
function Probe() {
  useSyncSettings();
  return null;
}

function seedSession() {
  localStorage.setItem("access_token", "test-token");
  localStorage.setItem("user_role", "owner");
}

describe("useSettingsQuery / useSyncSettings - gateo por sesion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no pide GET /settings cuando no hay sesion", async () => {
    renderWithProviders(<Probe />);

    // Le doy una vuelta de microtask para confirmar que nunca sale el request.
    await Promise.resolve();

    expect(api.get).not.toHaveBeenCalledWith("/settings");
  });

  it("pide GET /settings cuando hay token en la sesion", async () => {
    seedSession();
    renderWithProviders(<Probe />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/settings");
    });
  });
});
