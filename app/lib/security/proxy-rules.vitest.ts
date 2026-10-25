import { describe, expect, it } from "vitest";
import { isAuthPath, isSameOriginWrite, PORTALS, portalFor } from "./proxy-rules";

const URL_ = "https://artrium.space/api/ticketcenter/tickets";
const h = (init: Record<string, string> = {}) => new Headers(init);

describe("portalFor", () => {
  it.each([
    ["/ticketcenter", "ticketcenter"],
    ["/ticketcenter/login", "ticketcenter"],
    ["/ticketcenter/outreach", "ticketcenter"],
    ["/api/ticketcenter", "ticketcenter"],
    ["/api/ticketcenter/tickets/ART-001/status", "ticketcenter"],
    ["/dev/exhibition", "devex"],
    ["/dev/exhibition/login", "devex"],
    ["/api/dev/exhibition/imports/abc", "devex"],
  ])("%s belongs to %s", (path, id) => {
    expect(portalFor(path)?.id).toBe(id);
  });

  it.each(["/", "/map", "/exhibition", "/ticketcenterx", "/api/ticketcenterx/tickets", "/dev", "/dev/exhibitions", "/api/waitlist"])(
    "%s belongs to no portal",
    (path) => {
      expect(portalFor(path)).toBeUndefined();
    }
  );
});

describe("isAuthPath", () => {
  const tc = PORTALS.find((p) => p.id === "ticketcenter")!;
  const dev = PORTALS.find((p) => p.id === "devex")!;

  it("lists exactly the auth endpoints", () => {
    expect(tc.authPaths).toEqual([
      "/api/ticketcenter/auth/view",
      "/api/ticketcenter/auth/lead",
      "/api/ticketcenter/auth/logout",
    ]);
    expect(dev.authPaths).toEqual(["/api/dev/exhibition/auth", "/api/dev/exhibition/auth/logout"]);
    for (const p of [...tc.authPaths, ...dev.authPaths]) {
      expect(isAuthPath(portalFor(p)!, p)).toBe(true);
    }
  });

  it("does not open other paths under the auth folders", () => {
    expect(isAuthPath(tc, "/api/ticketcenter/auth")).toBe(false);
    expect(isAuthPath(tc, "/api/ticketcenter/auth/new")).toBe(false);
    expect(isAuthPath(tc, "/api/ticketcenter/auth/view/x")).toBe(false);
    expect(isAuthPath(dev, "/api/dev/exhibition/auth/other")).toBe(false);
  });

  it("does not let one portal's auth path through another's gate", () => {
    expect(isAuthPath(tc, "/api/dev/exhibition/auth")).toBe(false);
    expect(isAuthPath(dev, "/api/ticketcenter/auth/view")).toBe(false);
  });

  it("never lists the login page or home", () => {
    for (const p of PORTALS) {
      expect(isAuthPath(p, p.login)).toBe(false);
      expect(isAuthPath(p, p.home)).toBe(false);
    }
  });
});

describe("isSameOriginWrite", () => {
  it.each(["GET", "HEAD", "OPTIONS", "get"])("always allows %s", (method) => {
    expect(isSameOriginWrite(method, h({ "sec-fetch-site": "cross-site", origin: "https://evil.example" }), URL_)).toBe(true);
  });

  describe.each(["POST", "PATCH", "PUT", "DELETE"])("%s", (method) => {
    it("is allowed with Sec-Fetch-Site same-origin or none", () => {
      expect(isSameOriginWrite(method, h({ "sec-fetch-site": "same-origin" }), URL_)).toBe(true);
      expect(isSameOriginWrite(method, h({ "sec-fetch-site": "none" }), URL_)).toBe(true);
    });

    it("is refused from a sibling host or another site", () => {
      expect(isSameOriginWrite(method, h({ "sec-fetch-site": "same-site", origin: "https://app.artrium.space" }), URL_)).toBe(false);
      expect(isSameOriginWrite(method, h({ "sec-fetch-site": "cross-site", origin: "https://evil.example" }), URL_)).toBe(false);
    });

    it("falls back to Origin when Sec-Fetch-Site is absent", () => {
      expect(isSameOriginWrite(method, h({ origin: "https://artrium.space" }), URL_)).toBe(true);
      expect(isSameOriginWrite(method, h({ origin: "https://app.artrium.space" }), URL_)).toBe(false);
      expect(isSameOriginWrite(method, h({ origin: "http://artrium.space" }), URL_)).toBe(false);
      expect(isSameOriginWrite(method, h({ origin: "https://artrium.space:8443" }), URL_)).toBe(false);
      expect(isSameOriginWrite(method, h({ origin: "null" }), URL_)).toBe(false);
    });

    it("accepts a matching Origin even when Sec-Fetch-Site disagrees", () => {
      expect(isSameOriginWrite(method, h({ "sec-fetch-site": "same-site", origin: "https://artrium.space" }), URL_)).toBe(true);
    });

    it("is refused with neither header", () => {
      expect(isSameOriginWrite(method, h(), URL_)).toBe(false);
    });
  });

  it("compares against the request's own origin, including dev ports", () => {
    expect(isSameOriginWrite("POST", h({ origin: "http://localhost:3000" }), "http://localhost:3000/api/ticketcenter/auth/view")).toBe(true);
    expect(isSameOriginWrite("POST", h({ origin: "http://localhost:3001" }), "http://localhost:3000/api/ticketcenter/auth/view")).toBe(false);
  });
});
