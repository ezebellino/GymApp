import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "../../test/renderWithProviders";

vi.mock("@/lib/http", async () => {
  const { createApiMock } = await import("../../test/apiMock");
  return createApiMock();
});

// La guarda del widget es un ternario `import.meta.env.DEV` **a nivel de módulo**
// en `App.jsx` (dec. 1 de `add-dev-role-switcher`): se evalúa al importar, no al
// renderizar. Por eso cada caso stubea el env, limpia el registro de módulos y
// vuelve a importar `App` de cero. Este test simula el modo, no ejecuta el
// build: la ausencia real en `dist/` se verifica con `npm run build` + grep.
async function importAppFresh() {
  vi.resetModules();
  const mod = await import("@/App");
  return mod.default;
}

const DEV_USER_LABELS = ["Dueño", "Coach", "Miembro"];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("App - widget de cambio de rol según modo de build", () => {
  it("en modo desarrollo renderiza el widget de cambio de rol", async () => {
    vi.stubEnv("DEV", true);
    const App = await importAppFresh();

    renderWithProviders(<App />, { route: "/login" });

    expect(await screen.findByTestId("dev-role-switcher")).toBeInTheDocument();
    for (const label of DEV_USER_LABELS) {
      expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeInTheDocument();
    }
  });

  it("en modo producción no renderiza el widget ni sus tres usuarios", async () => {
    vi.stubEnv("DEV", false);
    const App = await importAppFresh();

    renderWithProviders(<App />, { route: "/login" });

    // Esperar a que la vista (lazy) haya montado antes de afirmar la ausencia:
    // si no, un `queryBy*` sobre un árbol todavía vacío pasaría trivialmente.
    await screen.findByRole("button", { name: /entrar/i });
    expect(screen.queryByTestId("dev-role-switcher")).toBeNull();
    for (const label of DEV_USER_LABELS) {
      expect(screen.queryByRole("button", { name: new RegExp(label, "i") })).toBeNull();
    }
  });
});
