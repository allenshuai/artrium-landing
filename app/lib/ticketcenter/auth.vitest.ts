import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hmacHex, signScopedToken } from "@/app/lib/security/token";
import {
  COOKIE_MAX_AGE,
  cookieOptions,
  makeLeadToken,
  makeViewToken,
  parseLeads,
  verifyLeadToken,
  verifyViewToken,
} from "./auth";

const SECRET = "tc-secret";
const T0 = new Date("2026-10-01T12:00:00Z");

beforeEach(() => {
  vi.stubEnv("TICKETCENTER_COOKIE_SECRET", SECRET);
  vi.stubEnv("TICKETCENTER_LEADS", "Allen:pass1, Alison:pass2,O.Brien:pass3");
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("view token", () => {
  it("round-trips", async () => {
    expect(await verifyViewToken(await makeViewToken())).toBe(true);
  });

  it("is a scoped token that ages out after COOKIE_MAX_AGE", async () => {
    const token = await makeViewToken();
    expect(token).toMatch(/^\d+\.[0-9a-f]{64}$/);
    vi.setSystemTime(T0.getTime() + COOKIE_MAX_AGE * 1000);
    expect(await verifyViewToken(token)).toBe(true);
    vi.setSystemTime(T0.getTime() + (COOKIE_MAX_AGE + 1) * 1000);
    expect(await verifyViewToken(token)).toBe(false);
  });

  it("rejects the old constant-string cookie", async () => {
    expect(await verifyViewToken(await hmacHex(SECRET, "view"))).toBe(false);
  });

  it("rejects a token from another scope or secret", async () => {
    expect(await verifyViewToken(await signScopedToken(SECRET, "dev_ex_view"))).toBe(false);
    expect(await verifyViewToken(await signScopedToken("other", "tc_view"))).toBe(false);
    expect(await verifyViewToken(undefined)).toBe(false);
  });
});

describe("lead token", () => {
  it("carries the name, an issued-at and a signature", async () => {
    const token = await makeLeadToken("Allen");
    expect(token).toMatch(/^Allen\.\d+\.[0-9a-f]{64}$/);
    expect(await verifyLeadToken(token)).toBe("Allen");
  });

  it("round-trips names that need encoding or contain dots", async () => {
    vi.stubEnv("TICKETCENTER_LEADS", "Zoë Ann:p,O.Brien:q");
    expect(await verifyLeadToken(await makeLeadToken("Zoë Ann"))).toBe("Zoë Ann");
    expect(await verifyLeadToken(await makeLeadToken("O.Brien"))).toBe("O.Brien");
  });

  it("stops working as soon as the lead is removed from TICKETCENTER_LEADS", async () => {
    const token = await makeLeadToken("Alison");
    expect(await verifyLeadToken(token)).toBe("Alison");
    vi.stubEnv("TICKETCENTER_LEADS", "Allen:pass1");
    expect(await verifyLeadToken(token)).toBeNull();
  });

  it("ages out after COOKIE_MAX_AGE", async () => {
    const token = await makeLeadToken("Allen");
    vi.setSystemTime(T0.getTime() + (COOKIE_MAX_AGE + 1) * 1000);
    expect(await verifyLeadToken(token)).toBeNull();
  });

  it("cannot be re-pointed at another lead", async () => {
    const token = await makeLeadToken("Allen");
    expect(await verifyLeadToken(token.replace(/^Allen/, "Alison"))).toBeNull();
  });

  it("rejects the old unstamped format, a view token and malformed values", async () => {
    const old = `Allen.${await hmacHex(SECRET, "lead:Allen")}`;
    expect(await verifyLeadToken(old)).toBeNull();
    expect(await verifyLeadToken(await makeViewToken())).toBeNull();
    for (const bad of [undefined, "", "Allen", ".1.abc", "Allen..abc", "%E0%A4%A.1.abc"]) {
      expect(await verifyLeadToken(bad)).toBeNull();
    }
  });
});

describe("missing secret", () => {
  beforeEach(() => {
    vi.stubEnv("TICKETCENTER_COOKIE_SECRET", "");
  });

  it("refuses to sign", async () => {
    await expect(makeViewToken()).rejects.toThrow("TICKETCENTER_COOKIE_SECRET is not set");
    await expect(makeLeadToken("Allen")).rejects.toThrow("TICKETCENTER_COOKIE_SECRET is not set");
  });

  it("fails closed when verifying", async () => {
    vi.stubEnv("TICKETCENTER_COOKIE_SECRET", SECRET);
    const view = await makeViewToken();
    const lead = await makeLeadToken("Allen");
    vi.stubEnv("TICKETCENTER_COOKIE_SECRET", "");
    expect(await verifyViewToken(view)).toBe(false);
    expect(await verifyLeadToken(lead)).toBeNull();
  });
});

describe("parseLeads", () => {
  it("parses name:passcode pairs, trimming and skipping malformed ones", () => {
    vi.stubEnv("TICKETCENTER_LEADS", " Allen : pass1 ,Alison:pa:ss, :nobody,NoPass:,junk");
    expect([...parseLeads()]).toEqual([
      ["Allen", "pass1"],
      ["Alison", "pa:ss"],
    ]);
  });

  it("is empty when unset", () => {
    vi.stubEnv("TICKETCENTER_LEADS", undefined);
    expect(parseLeads().size).toBe(0);
  });
});

it("cookieOptions uses the 30-day max age", () => {
  expect(cookieOptions().maxAge).toBe(COOKIE_MAX_AGE);
  expect(COOKIE_MAX_AGE).toBe(30 * 24 * 60 * 60);
});
