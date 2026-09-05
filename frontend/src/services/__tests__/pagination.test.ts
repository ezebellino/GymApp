import { describe, expect, it } from "vitest";
import { getPageRange } from "../pagination";

describe("getPageRange", () => {
  it("total=0: una sola página, sin rango", () => {
    expect(getPageRange({ total: 0, limit: 10, offset: 0 })).toEqual({
      page: 1,
      pages: 1,
      from: 0,
      to: 0,
    });
  });

  it("última página parcial: `to` se recorta al total, no al límite", () => {
    // total=25, limit=10: 3 páginas, la última con 5 items (offset 20-24).
    expect(getPageRange({ total: 25, limit: 10, offset: 20 })).toEqual({
      page: 3,
      pages: 3,
      from: 21,
      to: 25,
    });
  });

  it("offset fuera de rango: no explota, devuelve el cálculo tal cual", () => {
    // total=5, limit=10, offset=20: más allá de la única página existente.
    expect(getPageRange({ total: 5, limit: 10, offset: 20 })).toEqual({
      page: 3,
      pages: 1,
      from: 21,
      to: 5,
    });
  });
});
