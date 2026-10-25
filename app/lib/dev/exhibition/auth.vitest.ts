import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signScopedToken } from "@/app/lib/security/token";
import { devExCookieOptions, makeDevExToken, verifyDevExToken } from "./auth";

const SECRET = "dev-secret";
const WEEK = 7 * 24 * 60 * 60;
const T0 = new Date("2026-10-01T12:00:00Z");

beforeEach(() => {
  vi.stubEnv("DEV_EXHIBITION_COOKIE_SECRET", SECRET);
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("dev exhibition token", () => {
  it("round-trips", async () => {
    expect(await verifyDevExToken(await makeDevExToken())).toBe(true);
  });

  it("ages out after seven days", async () => {
    const token = await makeDevExToken();
    vi.setSystemTime(T0.getTime() + WEEK * 1000);
    expect(await verifyDevExToken(token)).toBe(true);
    vi.setSystemTime(T0.getTime() + (WEEK + 1) * 1000);
    expect(await verifyDevExToken(token)).toBe(false);
  });

  it("does not accept a Ticket Center cookie signed with the same secret", async () => {
    expect(await verifyDevExToken(await signScopedToken(SECRET, "tc_view"))).toBe(false);
  });

  it("rejects missing and malformed values", async () => {
    for (const bad of [undefined, "", "abc", "1.abc"]) {
      expect(await verifyDevExToken(bad)).toBe(false);
    }
  });

  it("refuses to sign without a secret and fails closed when verifying", async () => {
    const token = await makeDevExToken();
    vi.stubEnv("DEV_EXHIBITION_COOKIE_SECRET", "");
    await expect(makeDevExToken()).rejects.toThrow("DEV_EXHIBITION_COOKIE_SECRET is not set");
    expect(await verifyDevExToken(token)).toBe(false);
  });

  it("uses a seven-day cookie", () => {
    expect(devExCookieOptions().maxAge).toBe(WEEK);
  });
});
