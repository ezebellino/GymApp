// Modulo puro: tipos + normalizacion + aplicacion al DOM. No lee ni escribe
// `localStorage` (eso vive en `stores/theme.ts`) ni conoce la sesion del
// usuario (dec. 1 y 5 de `openspec/changes/adopt-kinetic-obsidian-theme`).
export type ThemeMode = "dark" | "light";

export type ThemeModeDefinition = {
  id: ThemeMode;
  label: string;
  description: string;
};

export const THEME_MODES: ThemeModeDefinition[] = [
  {
    id: "dark",
    label: "Oscuro",
    description: "Kinetic Obsidian: el estado operativo por defecto.",
  },
  {
    id: "light",
    label: "Claro",
    description: "Crisp Slate: la misma identidad, en modo claro.",
  },
];

export const DEFAULT_THEME_MODE: ThemeMode = "dark";

// Los 3 ids del sistema de temas viejo (`dark-gold`/`dark-copper`/`dark-olive`):
// lista cerrada, no va a aparecer un cuarto (dec. 7).
const LEGACY_DARK_IDS = new Set(["dark-gold", "dark-copper", "dark-olive"]);

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "dark" || value === "light";
}

// Blinda la lectura de cualquier valor persistido o que venga del servidor:
// "dark"/"light" pasan tal cual, los 3 ids legacy caen a "dark" (todos eran
// variaciones dark), y cualquier otra cosa (null, vacio, basura) cae al
// default.
export function normalizeThemeMode(raw: unknown): ThemeMode {
  if (isThemeMode(raw)) return raw;
  if (typeof raw === "string" && LEGACY_DARK_IDS.has(raw)) return "dark";
  return DEFAULT_THEME_MODE;
}

// Unico aplicador al DOM: setea `data-theme` (interruptor del `@custom-variant
// dark` y de las vars semanticas por modo de `index.css`) y `color-scheme`
// (para que los controles nativos del UA -- popups de <select>, autofill,
// scrollbars -- se pinten correctos en light mode). No toca `localStorage`:
// eso es responsabilidad de quien llama (store de tema, snippet de pre-paint).
export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}
