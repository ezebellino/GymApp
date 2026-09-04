import { beforeEach, describe, expect, it } from "vitest";

import Sidebar from "../Sidebar";
import { renderWithProviders, screen } from "../../test/renderWithProviders";

function seedRole(role: "owner" | "coach") {
  // `useSessionStore` sólo rehidrata `role` si hay `access_token` (ver
  // `sessionPersistStorage.getItem` en `stores/session.ts`): el valor del
  // token no importa (falla el decode en un try/catch y `exp` cae a null),
  // pero tiene que existir. Sembrar acá, en el `beforeEach` del propio
  // archivo, nunca dentro del `it` (regla de `frontend/AGENTS.md`).
  localStorage.setItem("access_token", "test-token");
  localStorage.setItem("user_role", role);
}

describe("Sidebar", () => {
  describe("con rol owner", () => {
    beforeEach(() => {
      seedRole("owner");
    });

    it("no muestra Atajos, Gestionar clientes ni Ir a rutinas, y sí muestra Contexto", () => {
      renderWithProviders(<Sidebar />);

      expect(screen.queryByText("Atajos")).toBeNull();
      expect(screen.queryByText("Gestionar clientes")).toBeNull();
      expect(screen.queryByText("Ir a rutinas")).toBeNull();
      expect(screen.getByText("Contexto")).toBeInTheDocument();
      expect(screen.getByText("Vista Dueño")).toBeInTheDocument();
    });
  });

  describe("con rol coach", () => {
    beforeEach(() => {
      seedRole("coach");
    });

    it("no muestra Atajos, Gestionar clientes ni Ir a rutinas, y sí muestra Contexto", () => {
      renderWithProviders(<Sidebar />);

      expect(screen.queryByText("Atajos")).toBeNull();
      expect(screen.queryByText("Gestionar clientes")).toBeNull();
      expect(screen.queryByText("Ir a rutinas")).toBeNull();
      expect(screen.getByText("Contexto")).toBeInTheDocument();
      expect(screen.getByText("Vista Coach")).toBeInTheDocument();
    });
  });
});
