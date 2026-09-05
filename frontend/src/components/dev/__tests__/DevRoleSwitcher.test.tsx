import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/http";
import { useSessionStore } from "@/stores/session";

import DevRoleSwitcher from "../DevRoleSwitcher";
import { fireEvent, renderWithProviders, screen } from "../../../test/renderWithProviders";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../../test/apiMock");
  return createApiMock();
});

const COLLAPSED_KEY = "dev_role_switcher_collapsed";
const PREVIOUS_TOKEN = "token-de-la-sesion-anterior";

// Sembrar en el `beforeEach` propio del archivo, nunca dentro del `it` (regla de
// `frontend/AGENTS.md`): a esa altura el store ya rehidrató y el componente ya
// leyó su selector / su inicializador lazy de `useState`.
function seedCoachSession() {
  localStorage.setItem("access_token", PREVIOUS_TOKEN);
  localStorage.setItem("user_role", "coach");
  localStorage.setItem("user_name", "Coach Previo");
}

function getUserButtons() {
  return {
    owner: screen.getByRole("button", { name: /dueño/i }),
    coach: screen.getByRole("button", { name: /^coach/i }),
    member: screen.getByRole("button", { name: /miembro/i }),
  };
}

describe("DevRoleSwitcher - opciones", () => {
  it("muestra exactamente tres opciones: Dueño, Coach y Miembro", () => {
    renderWithProviders(<DevRoleSwitcher />, { route: "/login" });

    const { owner, coach, member } = getUserButtons();
    expect(owner).toBeInTheDocument();
    expect(coach).toBeInTheDocument();
    expect(member).toBeInTheDocument();
    // Sin sesión, el encabezado lo dice.
    expect(screen.getByText(/sin sesión/i)).toBeInTheDocument();
  });

  it("colapsar escribe dev_role_switcher_collapsed y oculta las opciones", () => {
    renderWithProviders(<DevRoleSwitcher />, { route: "/login" });

    fireEvent.click(screen.getByRole("button", { name: /colapsar selector/i }));

    expect(localStorage.getItem(COLLAPSED_KEY)).toBe("1");
    const collapsedToggle = screen.getByRole("button", { name: /abrir selector/i });
    expect(collapsedToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /dueño/i })).toBeNull();
  });
});

describe("DevRoleSwitcher - estado colapsado persistido", () => {
  beforeEach(() => {
    localStorage.setItem(COLLAPSED_KEY, "1");
  });

  it("con la key sembrada monta colapsado, como tras recargar la página", () => {
    renderWithProviders(<DevRoleSwitcher />, { route: "/login" });

    const collapsedToggle = screen.getByRole("button", { name: /abrir selector/i });
    expect(collapsedToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /dueño/i })).toBeNull();

    fireEvent.click(collapsedToggle);
    expect(localStorage.getItem(COLLAPSED_KEY)).toBe("0");
    expect(screen.getByRole("button", { name: /dueño/i })).toBeInTheDocument();
  });
});

describe("DevRoleSwitcher - cambio de usuario", () => {
  beforeEach(() => {
    seedCoachSession();
  });

  it("con /auth/token en 400 muestra el mensaje con make seed-dev y deja la sesión previa intacta", async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 400 } });

    renderWithProviders(<DevRoleSwitcher />, { route: "/dashboard" });
    expect(useSessionStore.getState().token).toBe(PREVIOUS_TOKEN);

    fireEvent.click(getUserButtons().member);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/usuario de desarrollo no encontrado/i);
    expect(alert).toHaveTextContent(/make seed-dev/);
    // Invariante 3: primero la red, después el switch de sesión. Un 400 no
    // mueve nada: mismo token, mismo rol.
    expect(useSessionStore.getState().token).toBe(PREVIOUS_TOKEN);
    expect(useSessionStore.getState().role).toBe("coach");
    // Y las opciones vuelven a estar habilitadas para reintentar.
    expect(getUserButtons().member).not.toBeDisabled();
  });

  it("con otro error muestra el mensaje genérico de backend caído", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Network Error"));

    renderWithProviders(<DevRoleSwitcher />, { route: "/dashboard" });
    fireEvent.click(getUserButtons().owner);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/no se pudo cambiar de usuario/i);
    expect(useSessionStore.getState().token).toBe(PREVIOUS_TOKEN);
  });

  it("mientras /auth/token está pendiente deshabilita las tres opciones y muestra carga", async () => {
    // Promesa que nunca resuelve: el cambio queda "en curso" durante todo el test.
    vi.mocked(api.post).mockReturnValueOnce(new Promise(() => {}) as never);

    renderWithProviders(<DevRoleSwitcher />, { route: "/dashboard" });
    fireEvent.click(getUserButtons().owner);

    const { owner, coach, member } = getUserButtons();
    expect(owner).toBeDisabled();
    expect(coach).toBeDisabled();
    expect(member).toBeDisabled();
    expect(owner).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/cambiando a dueño/i)).toBeInTheDocument();

    // Un segundo click (aunque el DOM lo dejara pasar) no dispara otro login.
    fireEvent.click(member);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().token).toBe(PREVIOUS_TOKEN);
  });
});
