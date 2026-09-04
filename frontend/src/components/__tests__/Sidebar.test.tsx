import { beforeEach, describe, expect, it } from "vitest";

import Sidebar from "../Sidebar";
import { renderWithProviders, screen } from "../../test/renderWithProviders";

// jwt-decode solo le pide al token el formato `header.payload.firma` en
// base64url; no valida la firma. Alcanza con un payload fabricado a mano para
// que `useSessionStore` pueda leer el claim `email` (ver `stores/session.ts`).
function base64Url(payload: Record<string, unknown>): string {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fakeToken(email: string): string {
  const header = base64Url({ alg: "none", typ: "JWT" });
  // exp bien a futuro para que el auto-logout por expiracion no se dispare
  // durante el test.
  const payload = base64Url({ email, exp: 9999999999 });
  return `${header}.${payload}.signature`;
}

function seedRole(role: "owner" | "coach") {
  // `useSessionStore` sólo rehidrata `role` si hay `access_token` (ver
  // `sessionPersistStorage.getItem` en `stores/session.ts`). Sembrar acá, en
  // el `beforeEach` del propio archivo, nunca dentro del `it` (regla de
  // `frontend/AGENTS.md`).
  localStorage.setItem("access_token", fakeToken("dueno@miniespacio.test"));
  localStorage.setItem("user_name", "Ana Dueña");
  localStorage.setItem("user_role", role);
}

describe("Sidebar", () => {
  describe("con rol owner", () => {
    beforeEach(() => {
      seedRole("owner");
    });

    it("no muestra Atajos, Gestionar clientes ni Ir a rutinas, y sí el badge de rol + la identidad", () => {
      renderWithProviders(<Sidebar />);

      expect(screen.queryByText("Atajos")).toBeNull();
      expect(screen.queryByText("Gestionar clientes")).toBeNull();
      expect(screen.queryByText("Ir a rutinas")).toBeNull();
      // El badge sigue diciendo "Vista Dueño" en su textContent (las
      // mayúsculas del mockup se logran por CSS, no reescribiendo el texto).
      expect(screen.getByText("Vista Dueño")).toBeInTheDocument();
      // Card de identidad: nombre + email del usuario logueado, en reemplazo
      // de la vieja sección "Contexto".
      expect(screen.getByText("Ana Dueña")).toBeInTheDocument();
      expect(screen.getByText("dueno@miniespacio.test")).toBeInTheDocument();
      expect(screen.queryByText("Contexto")).toBeNull();
    });
  });

  describe("con rol coach", () => {
    beforeEach(() => {
      seedRole("coach");
    });

    it("no muestra Atajos, Gestionar clientes ni Ir a rutinas, y sí el badge de rol + la identidad", () => {
      renderWithProviders(<Sidebar />);

      expect(screen.queryByText("Atajos")).toBeNull();
      expect(screen.queryByText("Gestionar clientes")).toBeNull();
      expect(screen.queryByText("Ir a rutinas")).toBeNull();
      expect(screen.getByText("Vista Coach")).toBeInTheDocument();
      expect(screen.getByText("Ana Dueña")).toBeInTheDocument();
      expect(screen.getByText("dueno@miniespacio.test")).toBeInTheDocument();
      expect(screen.queryByText("Contexto")).toBeNull();
    });
  });
});
