import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { useSessionStore } from "@/stores/session";
import { DEFAULT_SETTINGS, useSettingsStore } from "@/stores/settings";
import { useThemeStore } from "@/stores/theme";
import { DEFAULT_THEME_MODE } from "@/lib/theme";

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

// jsdom tampoco implementa showModal/close/show de <dialog> (solo refleja el
// atributo `open`), y Dialog/AlertDialog (components/ui/dialog.tsx,
// alert-dialog.tsx) los llaman directo desde un <dialog> nativo desde que se
// dejó de usar @radix-ui/react-dialog/react-alert-dialog. Sin este polyfill
// cualquier test que monte una de esas vistas con el diálogo abierto explota
// con "showModal is not a function".
if (!window.HTMLDialogElement.prototype.showModal) {
  window.HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  window.HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  window.HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new window.Event("close"));
  };
}

afterEach(() => {
  cleanup();
  // El store de sesión también es estado compartido entre tests: sin este
  // reset, un test que hizo login (o cuyo test anterior sembró localStorage)
  // dejaría la sesión pegada para el próximo. Se usa `logout()` en vez de un
  // `setState` directo porque también cancela el `logoutTimer` agendado por
  // `setSession`/la rehidratación — un `setState` a mano lo deja corriendo y
  // se fuga entre tests.
  useSessionStore.getState().logout();
  // Mismo tratamiento para el store de ajustes (dec. 14): sin resetear, los
  // ajustes que un test dejó guardados (o el tema aplicado) quedarían pegados
  // para el próximo.
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS });
  // Mismo tratamiento para el store de tema: sin resetear, el modo que un test
  // dejó aplicado (y persistido en `app_theme`) quedaría pegado para el
  // próximo, incluido el `data-theme` del `documentElement`.
  useThemeStore.setState({ mode: DEFAULT_THEME_MODE });
  // localStorage es estado compartido real: ProtectedRoute, Dashboard y Settings
  // leen user_role / app_settings / access_token de ahi. Va DESPUÉS de resetear
  // los stores: ambos usan `persist` y un `setState`/`logout()` dispara su
  // `setItem`, así que limpiar antes dejaría ese barrido pisado por la
  // reescritura del adaptador.
  localStorage.clear();
  vi.clearAllMocks();
});

// `persist` rehidrata una sola vez, al importar el módulo del store. Los tests
// que siembran localStorage (p. ej. Dashboard.test.tsx) lo hacen en su propio
// beforeEach, así que hay que forzar una rehidratación para que esa siembra
// llegue al store antes de cada test.
beforeEach(() => {
  useSessionStore.persist.rehydrate();
  useSettingsStore.persist.rehydrate();
  useThemeStore.persist.rehydrate();
});
