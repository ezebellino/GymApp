import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";

// No hace falta AuthProvider (App.jsx no lo monta), ni theme provider (el tema
// se aplica por document.documentElement.dataset), ni el Toaster de sileo (los
// toasts salen en submit, no en render). react-query si hace falta: los hooks
// de `src/services/*.queries.ts` requieren un QueryClientProvider en el arbol.
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  {
    route = "/",
    queryClient = createTestQueryClient(),
  }: { route?: string; queryClient?: QueryClient } = {},
) {
  // `setup.ts` llama a `useSessionStore.persist.rehydrate()` (y su equivalente
  // de ajustes) en un `beforeEach` global, pero los setupFiles se registran (y
  // por lo tanto corren) antes que los `beforeEach` propios del archivo de
  // test: si un test siembra localStorage en SU PROPIO `beforeEach` (p. ej.
  // Dashboard.test.tsx), ese beforeEach corre DESPUÉS del de setup.ts, y la
  // siembra nunca llega al store. Rehidratar de nuevo acá, dentro del cuerpo
  // del `it()` y justo antes de renderizar, es lo único con orden garantizado
  // después de cualquier beforeEach del test.
  useSessionStore.persist.rehydrate();
  useSettingsStore.persist.rehydrate();
  useThemeStore.persist.rehydrate();

  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[route]}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MemoryRouter>
    ),
  });
}

export * from "@testing-library/react";
