export type AppThemeId = "dark-gold" | "dark-copper" | "dark-olive";

export type AppThemeDefinition = {
  id: AppThemeId;
  name: string;
  shortName: string;
  description: string;
  preview: {
    start: string;
    mid: string;
    end: string;
  };
};

export const THEME_STORAGE_KEY = "app_theme";

export const APP_THEMES: AppThemeDefinition[] = [
  {
    id: "dark-gold",
    name: "Dark Gold",
    shortName: "Gold",
    description: "La paleta actual: carbon, dorado tibio y naranja.",
    preview: {
      start: "#facc15",
      mid: "#fff7ed",
      end: "#f97316",
    },
  },
  {
    id: "dark-copper",
    name: "Dark Copper",
    shortName: "Copper",
    description: "Mas sobria y premium, con cobre, crema y ambar suave.",
    preview: {
      start: "#fb923c",
      mid: "#f5ebdc",
      end: "#b45309",
    },
  },
  {
    id: "dark-olive",
    name: "Dark Olive",
    shortName: "Olive",
    description: "Mas deportiva, con oliva oscuro, arena y dorado apagado.",
    preview: {
      start: "#a3e635",
      mid: "#f5f5dc",
      end: "#d97706",
    },
  },
];

export const DEFAULT_THEME_ID: AppThemeId = "dark-gold";

export function isAppThemeId(value: string | null): value is AppThemeId {
  return APP_THEMES.some((theme) => theme.id === value);
}

export function getStoredTheme(): AppThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isAppThemeId(value) ? value : DEFAULT_THEME_ID;
}

export function applyTheme(themeId: AppThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = themeId;
  window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
  window.dispatchEvent(new Event("app-theme:updated"));
}

export function syncThemeFromSettings() {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;

  const raw = window.localStorage.getItem("app_settings");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { theme_preference?: string | null };
      if (isAppThemeId(parsed.theme_preference ?? null)) {
        applyTheme(parsed.theme_preference);
        return parsed.theme_preference;
      }
    } catch {
      // ignore malformed local settings
    }
  }

  const storedTheme = getStoredTheme();
  applyTheme(storedTheme);
  return storedTheme;
}
