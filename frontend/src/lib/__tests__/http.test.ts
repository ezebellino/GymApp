import { afterEach, describe, expect, it, vi } from "vitest";
import { handleResponseError } from "../http";
import { toastError } from "../toast";
import { useSessionStore } from "@/stores/session";

vi.mock("../toast", () => ({
  toastError: vi.fn(),
}));

function setPath(pathname: string) {
  window.history.pushState({}, "", pathname);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("handleResponseError", () => {
  it("un 401 en una vista publica no toastea sesion expirada ni cierra la sesion", async () => {
    setPath("/login");
    useSessionStore.getState().setSession("un-token-cualquiera");

    await expect(
      handleResponseError({ response: { status: 401 } })
    ).rejects.toBeDefined();

    expect(toastError).not.toHaveBeenCalled();
    expect(useSessionStore.getState().token).toBe("un-token-cualquiera");
  });

  it("un 401 en una vista protegida toastea sesion expirada y cierra la sesion", async () => {
    setPath("/payments");
    useSessionStore.getState().setSession("un-token-cualquiera");

    await expect(
      handleResponseError({ response: { status: 401 } })
    ).rejects.toBeDefined();

    expect(toastError).toHaveBeenCalledWith("Sesión expirada", "Volvé a iniciar sesión.");
    expect(useSessionStore.getState().token).toBeNull();
  });
});
