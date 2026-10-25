import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// This request's cookies, as next/headers' cookies() would return them.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

const { assertSameOriginWrite, PORTAL_GUARDS, portalGuard } = await import("./portal-guard");
const { PORTALS } = await import("./proxy-rules");
const { makeViewToken } = await import("@/app/lib/ticketcenter/auth");
const { makeDevExToken } = await import("@/app/lib/dev/exhibition/auth");

beforeEach(() => {
  jar.clear();
  vi.stubEnv("TICKETCENTER_COOKIE_SECRET", "tc-secret");
  vi.stubEnv("DEV_EXHIBITION_COOKIE_SECRET", "dev-secret");
});

describe("portalGuard", () => {
  const verify = vi.fn(async (token: string | undefined) => token === "good");
  const guard = portalGuard({ cookie: "c", verify, loginPath: "/portal/login" });

  it("has() reads its own cookie from a request or a cookie store", async () => {
    const req = (cookie: string) => new NextRequest("https://artrium.space/portal", { headers: { cookie } });
    expect(await guard.has(req("c=good"))).toBe(true);
    expect(await guard.has(req("c=bad"))).toBe(false);
    expect(await guard.has(req("other=good"))).toBe(false);
    expect(await guard.has({ get: () => ({ value: "good" }) })).toBe(true);
    expect(await guard.has({ get: () => undefined })).toBe(false);
    expect(verify).toHaveBeenLastCalledWith(undefined);
  });

  it("require() is null with a valid cookie and a 401 otherwise", async () => {
    expect((await guard.require())?.status).toBe(401);
    jar.set("c", "bad");
    const res = await guard.require();
    expect(res).toBeInstanceOf(NextResponse);
    expect(res?.status).toBe(401);
    expect(await res?.json()).toEqual({ error: "Unauthorized" });
    jar.set("c", "good");
    expect(await guard.require()).toBeNull();
  });

  it("requirePage() redirects to the login unless the cookie is valid", async () => {
    await expect(guard.requirePage()).rejects.toThrow("redirect:/portal/login");
    jar.set("c", "good");
    await expect(guard.requirePage()).resolves.toBeUndefined();
  });
});

describe("PORTAL_GUARDS", () => {
  it("accept each portal's own token and never the other's", async () => {
    const view = await makeViewToken();
    const dev = await makeDevExToken();
    const { ticketcenter, devex } = PORTAL_GUARDS;
    expect(await ticketcenter.has({ get: (n) => (n === "tc_view" ? { value: view } : undefined) })).toBe(true);
    expect(await devex.has({ get: (n) => (n === "dev_ex_view" ? { value: dev } : undefined) })).toBe(true);
    // The other portal's cookie name, or its token under this portal's name.
    expect(await devex.has({ get: (n) => (n === "tc_view" ? { value: view } : undefined) })).toBe(false);
    expect(await devex.has({ get: () => ({ value: view }) })).toBe(false);
    expect(await ticketcenter.has({ get: () => ({ value: dev }) })).toBe(false);
  });

  it("send each portal to the login proxy-rules dispatches on", async () => {
    for (const portal of PORTALS) {
      await expect(PORTAL_GUARDS[portal.id].requirePage()).rejects.toThrow(`redirect:${portal.login}`);
    }
  });
});

describe("assertSameOriginWrite", () => {
  const URL_ = "https://artrium.space/api/ticketcenter/tickets";
  const req = (method: string, headers: Record<string, string>, url = URL_) => new Request(url, { method, headers });

  it("lets reads and same-origin writes through", () => {
    expect(assertSameOriginWrite(req("GET", { "sec-fetch-site": "cross-site", origin: "https://evil.example" }))).toBeNull();
    expect(assertSameOriginWrite(req("POST", { "sec-fetch-site": "same-origin" }))).toBeNull();
    expect(assertSameOriginWrite(req("PATCH", { origin: "https://artrium.space" }))).toBeNull();
  });

  it("answers a cross-site or unmarked write with the proxy's 403", async () => {
    const refused: Record<string, string>[] = [
      { "sec-fetch-site": "cross-site", origin: "https://evil.example" },
      { origin: "https://app.artrium.space" },
      {},
    ];
    for (const headers of refused) {
      const res = assertSameOriginWrite(req("POST", headers));
      expect(res?.status).toBe(403);
      expect(await res?.json()).toEqual({ error: "Cross-site request refused" });
    }
  });

  it("accepts the browser's https Origin behind TLS termination", () => {
    const fwd = { "x-forwarded-proto": "https", "x-forwarded-host": "artrium.space", origin: "https://artrium.space" };
    expect(assertSameOriginWrite(req("POST", fwd, "http://10.0.0.5:3000/api/ticketcenter/auth/view"))).toBeNull();
  });
});
