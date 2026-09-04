import { vi } from "vitest";

// Todas las vistas importan el mismo singleton axios `@/lib/http` (default export):
// hay exactamente un seam HTTP y se stubea el modulo entero. No usar
// `vi.spyOn(api, "get")`: con spy, cualquier llamada no prevista se va a XHR real de
// jsdom y dispara los interceptores de lib/http (el 401 hace
// window.location.href = "/login") y SweetAlert2.

type AxiosLikeResponse = {
  data: unknown;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: Record<string, unknown>;
};

const EMPTY_LIST_ROUTES = ["/clients", "/payments", "/attendance"];

/** Payload por defecto segun la ruta pedida. */
export function defaultPayloadFor(url: string): unknown {
  if (url.startsWith("/settings")) {
    return {
      gym_name: "Mini Espacio",
      admin_name: "Admin de Test",
      default_fee: 30000,
    };
  }
  // Los endpoints de reportes/KPIs devuelven un objeto, no una lista.
  if (url.includes("/reports")) {
    return {};
  }
  // Listados: si devolviera `undefined`, los useEffect de montaje de Dashboard y
  // Settings revientan haciendo `.map`.
  if (EMPTY_LIST_ROUTES.some((route) => url.startsWith(route))) {
    return [];
  }
  return {};
}

function respond(url: string, overrides: Record<string, unknown>): AxiosLikeResponse {
  const data = url in overrides ? overrides[url] : defaultPayloadFor(url);
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: { "x-total-count": "0" },
    config: {},
  };
}

/**
 * Modulo de reemplazo para `vi.mock("@/lib/http", ...)`.
 *
 * Uso en un test:
 *
 *   vi.mock("@/lib/http", async () => {
 *     const { createApiMock } = await import("@/test/apiMock");
 *     return createApiMock();
 *   });
 */
export function createApiMock(overrides: Record<string, unknown> = {}) {
  const api = {
    get: vi.fn((url: string) => Promise.resolve(respond(url, overrides))),
    post: vi.fn((url: string) => Promise.resolve(respond(url, overrides))),
    put: vi.fn((url: string) => Promise.resolve(respond(url, overrides))),
    patch: vi.fn((url: string) => Promise.resolve(respond(url, overrides))),
    delete: vi.fn((url: string) => Promise.resolve(respond(url, overrides))),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return { default: api, __esModule: true };
}
