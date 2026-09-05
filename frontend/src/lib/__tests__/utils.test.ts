import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cn } from "../utils";

// Base real de `TableHead` (`ui/table.tsx`), copiada acá para reproducir
// exactamente el bug que reportó el gate (hallazgo 1 de verification.md):
// `cn(base, STICKY_HEAD_CLASS)` perdía `text-label-caps` porque tailwind-merge
// stock no conoce ese tamaño y lo clasifica junto con `text-muted-foreground`
// en el grupo de color, que gana por ir después en el string.
const TABLE_HEAD_BASE =
  "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]";
const STICKY_HEAD_CLASS =
  "sticky top-0 z-10 bg-table-head px-4 font-bold text-label-caps uppercase text-muted-foreground shadow-[inset_0_-1px_0_var(--border-hairline)]";

describe("cn", () => {
  it("conserva un tamaño custom (text-label-caps) junto a un color (text-muted-foreground)", () => {
    const result = cn("text-label-caps", "text-muted-foreground");
    expect(result).toContain("text-label-caps");
    expect(result).toContain("text-muted-foreground");
  });

  it("cn(base de TableHead, STICKY_HEAD_CLASS) conserva text-label-caps (hallazgo 1, dec. 20)", () => {
    const result = cn(TABLE_HEAD_BASE, STICKY_HEAD_CLASS);
    expect(result).toContain("text-label-caps");
    expect(result).toContain("text-muted-foreground");
  });

  it("dos tamaños custom en el mismo cn() colapsan a uno solo (el último gana)", () => {
    const result = cn("text-body-md", "text-label-caps");
    expect(result).toContain("text-label-caps");
    expect(result).not.toContain("text-body-md");
  });
});

// Test de drift (mismo patrón que NAV_ITEMS ↔ routeImporters, dec. 3): lee
// los tamaños `--text-<nombre>` que declara `index.css` y confirma que `cn`
// los conserva frente a un color — si alguien agrega un `--text-*` nuevo acá
// sin declararlo en `lib/utils.ts`, este test lo detecta.
describe("drift entre los tamaños de index.css y la config de cn", () => {
  // `process.cwd()` es `frontend/` cuando corre via `make test-frontend` /
  // `npm run test` (vitest.config.js no fija `root`, así que toma el cwd de
  // invocación).
  const cssPath = path.resolve(process.cwd(), "src/index.css");
  const cssText = readFileSync(cssPath, "utf-8");

  // Nombres base: `--text-headline-hero: 36px;` sí, pero no sus modificadores
  // (`--text-headline-hero--line-height: 44px;`, que tienen un segundo `--`
  // después del nombre).
  const fullNames = [...cssText.matchAll(/(--text-[a-zA-Z0-9-]+):/g)].map((m) => m[1]);
  const baseNames = [
    ...new Set(
      fullNames
        .map((n) => n.replace(/^--text-/, ""))
        .filter((rest) => !rest.includes("--"))
    ),
  ];

  it("index.css declara al menos los nueve tamaños custom conocidos", () => {
    expect(baseNames.length).toBeGreaterThanOrEqual(9);
  });

  it.each(baseNames)("cn conserva text-%s frente a un color en conflicto", (name) => {
    const result = cn(`text-${name}`, "text-red-500");
    expect(result).toContain(`text-${name}`);
  });
});
