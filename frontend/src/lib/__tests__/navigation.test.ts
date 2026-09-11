import { describe, expect, it } from "vitest";
import { NAV_ITEMS, isPublicPath } from "../navigation";
import { routeImporters } from "../routePreload";

describe("drift entre NAV_ITEMS y routeImporters", () => {
  it("toda entrada de NAV_ITEMS tiene su `to` presente en routeImporters", () => {
    for (const item of NAV_ITEMS) {
      expect(routeImporters).toHaveProperty(item.to);
    }
  });
});

describe("isPublicPath", () => {
  it("isPublicPath reconoce /login y /invitacion/:channel/:token como publicas", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/invitacion/email/un-token")).toBe(true);
  });

  it("isPublicPath no marca publica una ruta protegida", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/payments")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
  });
});
