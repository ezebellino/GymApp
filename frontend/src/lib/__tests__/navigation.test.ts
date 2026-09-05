import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "../navigation";
import { routeImporters } from "../routePreload";

describe("drift entre NAV_ITEMS y routeImporters", () => {
  it("toda entrada de NAV_ITEMS tiene su `to` presente en routeImporters", () => {
    for (const item of NAV_ITEMS) {
      expect(routeImporters).toHaveProperty(item.to);
    }
  });
});
