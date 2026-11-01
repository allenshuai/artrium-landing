import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// The handler-level checks, run as if the proxy were bypassed: nothing here
// goes through proxy.ts.

const jar = new Map<string, string>();
vi.mock("server-only", () => ({}));
vi.mock("googleapis", () => ({ google: { auth: { JWT: class {} }, sheets: () => ({}) } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

const { readJsonObject, requireLead, requireView, requireViewPage } = await import("./route-helpers");
const { LEAD_COOKIE, VIEW_COOKIE, makeLeadToken, makeViewToken } = await import("./auth");
const viewRoute = await import("@/app/api/ticketcenter/auth/view/route");
const leadRoute = await import("@/app/api/ticketcenter/auth/lead/route");

const ORIGIN = "https://artrium.space";
const SAME = { "sec-fetch-site": "same-origin" };
const CROSS = { "sec-fetch-site": "cross-site", origin: "https://evil.example" };
const SIBLING = { "sec-fetch-site": "same-site", origin: "https://app.artrium.space" };

let ip = 0;
const post = (path: string, headers: Record<string, string>, body: unknown = {}) =>
  new Request(ORIGIN + path, {
    method: "POST",
    // A fresh client per request, so the login rate limit never decides a test.
    headers: { ...headers, "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ip}` },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jar.clear();
  vi.stubEnv("TICKETCENTER_COOKIE_SECRET", "tc-secret");
  vi.stubEnv("TICKETCENTER_PASSWORD", "open-sesame");
  vi.stubEnv("TICKETCENTER_LEADS", "Allen:pass1");
});

async function signIn(lead = true) {
  jar.set(VIEW_COOKIE, await makeViewToken());
  if (lead) jar.set(LEAD_COOKIE, await makeLeadToken("Allen"));
}

describe("requireLead", () => {
  it("returns the lead for a same-origin write with both cookies", async () => {
    await signIn();
    expect(await requireLead(post("/api/ticketcenter/tickets", SAME))).toBe("Allen");
    expect(await requireLead(post("/api/ticketcenter/tickets", { origin: ORIGIN }))).toBe("Allen");
  });

  it.each([
    ["cross-site", CROSS],
    ["a sibling host", SIBLING],
    ["no origin headers", {}],
  ])("refuses a write from %s with a 403 even with valid cookies", async (_label, headers) => {
    await signIn();
    const res = await requireLead(post("/api/ticketcenter/tickets", headers));
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(403);
    expect(await (res as NextResponse).json()).toEqual({ error: "Cross-site request refused" });
  });

  it("still needs the view and lead cookies", async () => {
    expect(((await requireLead(post("/api/ticketcenter/tickets", SAME))) as NextResponse).status).toBe(401);
    await signIn(false);
    const res = (await requireLead(post("/api/ticketcenter/tickets", SAME))) as NextResponse;
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Lead mode required" });
  });
});

describe("requireView and requireViewPage", () => {
  it("use the Ticket Center guard", async () => {
    expect((await requireView())?.status).toBe(401);
    await expect(requireViewPage()).rejects.toThrow("redirect:/ticketcenter/login");
    await signIn(false);
    expect(await requireView()).toBeNull();
    await expect(requireViewPage()).resolves.toBeUndefined();
  });
});

it("re-exports readJsonObject", async () => {
  expect(await readJsonObject(post("/api/x", SAME, { a: 1 }))).toEqual({ a: 1 });
});

describe("POST /api/ticketcenter/auth/view", () => {
  it("logs in from this origin", async () => {
    const res = await viewRoute.POST(post("/api/ticketcenter/auth/view", SAME, { password: "open-sesame" }));
    expect(res.status).toBe(200);
    expect(res.cookies.get(VIEW_COOKIE)?.value).toBeTruthy();
  });

  it.each([
    ["cross-site", CROSS],
    ["a sibling host", SIBLING],
  ])("refuses a login from %s before checking the password", async (_label, headers) => {
    const res = await viewRoute.POST(post("/api/ticketcenter/auth/view", headers, { password: "open-sesame" }));
    expect(res.status).toBe(403);
    expect(res.cookies.get(VIEW_COOKIE)).toBeUndefined();
  });
});

describe("POST /api/ticketcenter/auth/lead", () => {
  it("unlocks lead mode from this origin", async () => {
    await signIn(false);
    const res = await leadRoute.POST(post("/api/ticketcenter/auth/lead", SAME, { name: "Allen", passcode: "pass1" }));
    expect(res.status).toBe(200);
    expect(res.cookies.get(LEAD_COOKIE)?.value).toBeTruthy();
  });

  it("refuses a cross-site unlock even with the view cookie", async () => {
    await signIn(false);
    const res = await leadRoute.POST(post("/api/ticketcenter/auth/lead", CROSS, { name: "Allen", passcode: "pass1" }));
    expect(res.status).toBe(403);
    expect(res.cookies.get(LEAD_COOKIE)).toBeUndefined();
  });
});
