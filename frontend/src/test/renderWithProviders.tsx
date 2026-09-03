import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";

// No hace falta AuthProvider (App.jsx no lo monta), ni react-query (no esta
// instalado), ni theme provider (el tema se aplica por
// document.documentElement.dataset), ni el Toaster de sileo (los toasts salen en
// submit, no en render).
export function renderWithProviders(
  ui: ReactElement,
  { route = "/" }: { route?: string } = {},
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    ),
  });
}

export * from "@testing-library/react";
