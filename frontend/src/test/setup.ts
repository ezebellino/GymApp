import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom no implementa matchMedia ni ResizeObserver, y los necesitan el Drawer (vaul)
// y el SpotlightSearch (cmdk/Radix) que monta Dashboard. Sin estos polyfills el test
// de dashboard falla por infraestructura y no por la vista.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof window.ResizeObserver;
}

afterEach(() => {
  cleanup();
  // localStorage es estado compartido real: ProtectedRoute, Dashboard y Settings
  // leen user_role / app_settings / access_token de ahi.
  localStorage.clear();
  vi.clearAllMocks();
});
