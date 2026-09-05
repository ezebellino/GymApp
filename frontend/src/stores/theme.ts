import { create } from "zustand";
import { persist, subscribeWithSelector, type PersistStorage, type StorageValue } from "zustand/middleware";
import { applyThemeMode, normalizeThemeMode, DEFAULT_THEME_MODE, type ThemeMode } from "@/lib/theme";
import type { AppSettings } from "@/types";

export type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const THEME_STORAGE_KEY = "app_theme";
const LEGACY_SETTINGS_STORAGE_KEY = "app_settings";

// Lectura legacy de un solo tiro: el navegador de alguien que ya uso la app
// puede tener el tema solo dentro del objeto de ajustes (`app_settings`,
// version anterior de este diseno), nunca en la clave plana nueva. Solo se
// consulta cuando `app_theme` no existe todavia (dec. 5 y 7 de
// `openspec/changes/adopt-kinetic-obsidian-theme/design.md`).
function readLegacySettingsTheme(): ThemeMode | null {
  try {
    const raw = localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return parsed.theme_preference ? normalizeThemeMode(parsed.theme_preference) : null;
  } catch {
    return null;
  }
}

// PersistStorage a medida sobre la clave plana ya existente `app_theme` (mismo
// patron que `session.ts`/`settings.ts`): el valor persistido es el string
// plano del modo, sin el envoltorio `{state,version}` del `createJSONStorage`
// default, para que siga siendo compatible con lo que ya escribia el
// `lib/theme.ts` viejo.
const themePersistStorage: PersistStorage<ThemeState> = {
  getItem: (): StorageValue<ThemeState> | null => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const mode = stored ? normalizeThemeMode(stored) : (readLegacySettingsTheme() ?? DEFAULT_THEME_MODE);
    return { state: { mode }, version: 0 };
  },
  setItem: (_name, value) => {
    localStorage.setItem(THEME_STORAGE_KEY, value.state.mode);
  },
  removeItem: () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
  },
};

export const useThemeStore = create<ThemeState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        mode: DEFAULT_THEME_MODE,
        setMode: (mode) => set({ mode }),
      }),
      {
        name: "theme",
        storage: themePersistStorage,
        // Sin `skipHydration`: la rehidratacion tiene que ser sincronica y
        // ocurrir antes del primer render (el apply de abajo lee el estado ya
        // rehidratado).
      },
    ),
  ),
);

// Aplicacion sincronica en el scope del modulo (antes de que React monte
// nada) + suscripcion a los cambios posteriores, calcado de
// `stores/settings.ts`. Se importa desde `main.jsx` antes del `createRoot`
// para garantizar que esta linea corra siempre.
applyThemeMode(useThemeStore.getState().mode);
useThemeStore.subscribe(
  (state) => state.mode,
  (mode) => applyThemeMode(mode),
);
