import { describe, expect, it } from "vitest";

import { normalizeThemeMode } from "../theme";

describe("normalizeThemeMode", () => {
  it("deja pasar los modos vigentes tal cual", () => {
    expect(normalizeThemeMode("dark")).toBe("dark");
    expect(normalizeThemeMode("light")).toBe("light");
  });

  it("resuelve los 3 ids legacy a dark (todos eran variaciones dark)", () => {
    expect(normalizeThemeMode("dark-gold")).toBe("dark");
    expect(normalizeThemeMode("dark-copper")).toBe("dark");
    expect(normalizeThemeMode("dark-olive")).toBe("dark");
  });

  it("cae al default (dark) ante null, string vacio o un valor basura", () => {
    expect(normalizeThemeMode(null)).toBe("dark");
    expect(normalizeThemeMode("")).toBe("dark");
    expect(normalizeThemeMode("valor-que-no-existe")).toBe("dark");
  });
});
