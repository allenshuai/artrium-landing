import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cookieOptions, hmacHex, signScopedToken, timingSafeEqual, verifyScopedToken } from "./token";

const SECRET = "test-secret";
const DAY = 24 * 60 * 60;
const T0 = new Date("2026-10-01T12:00:00Z");

describe("hmacHex", () => {
  it("matches the RFC 4231 HMAC-SHA256 vector", async () => {
    // RFC 4231 test case 2.
    expect(await hmacHex("Jefe", "what do ya want for nothing?")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
    );
  });

  it("depends on both the secret and the message", async () => {
    const base = await hmacHex(SECRET, "a");
    expect(await hmacHex(SECRET, "b")).not.toBe(base);
    expect(await hmacHex("other", "a")).not.toBe(base);
  });
});

describe("timingSafeEqual", () => {
  it("is true only for identical strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("", "")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
    expect(timingSafeEqual("ab", "abc")).toBe(false);
    expect(timingSafeEqual("", "a")).toBe(false);
  });

  it("does not treat a prefix padded with NUL bytes as equal", () => {
    expect(timingSafeEqual("ab\u0000", "ab")).toBe(false);
  });

  it("compares the UTF-8 bytes, not code units", () => {
    expect(timingSafeEqual("café", "café")).toBe(true);
    expect(timingSafeEqual("café", "cafe")).toBe(false);
  });
});

describe("cookieOptions", () => {
  it("is httpOnly, Lax, path=/ with the given max age", () => {
    expect(cookieOptions(60)).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 });
  });

  it("is Secure only in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(cookieOptions(60).secure).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    expect(cookieOptions(60).secure).toBe(false);
  });
});

describe("signScopedToken / verifyScopedToken", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips and carries the issued-at in seconds", async () => {
    const token = await signScopedToken(SECRET, "scope");
    expect(token).toMatch(/^\d+\.[0-9a-f]{64}$/);
    expect(Number(token.split(".")[0])).toBe(Math.floor(T0.getTime() / 1000));
    expect(await verifyScopedToken(SECRET, "scope", token, DAY)).toBe(true);
  });

  it("rejects a token for another scope or signed with another secret", async () => {
    const token = await signScopedToken(SECRET, "scope");
    expect(await verifyScopedToken(SECRET, "other", token, DAY)).toBe(false);
    expect(await verifyScopedToken("other-secret", "scope", token, DAY)).toBe(false);
  });

  it("accepts up to the max age and rejects past it", async () => {
    const token = await signScopedToken(SECRET, "scope");
    vi.setSystemTime(T0.getTime() + DAY * 1000);
    expect(await verifyScopedToken(SECRET, "scope", token, DAY)).toBe(true);
    vi.setSystemTime(T0.getTime() + (DAY + 1) * 1000);
    expect(await verifyScopedToken(SECRET, "scope", token, DAY)).toBe(false);
  });

  it("tolerates 60 s of future skew and no more", async () => {
    vi.setSystemTime(T0.getTime() + 60_000);
    const token = await signScopedToken(SECRET, "scope");
    vi.setSystemTime(T0);
    expect(await verifyScopedToken(SECRET, "scope", token, DAY)).toBe(true);

    vi.setSystemTime(T0.getTime() + 61_000);
    const tooEarly = await signScopedToken(SECRET, "scope");
    vi.setSystemTime(T0);
    expect(await verifyScopedToken(SECRET, "scope", tooEarly, DAY)).toBe(false);
  });

  it("rejects a tampered signature or issued-at", async () => {
    const token = await signScopedToken(SECRET, "scope");
    const [iat, sig] = token.split(".");
    const flipped = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
    expect(await verifyScopedToken(SECRET, "scope", `${iat}.${flipped}`, DAY)).toBe(false);
    expect(await verifyScopedToken(SECRET, "scope", `${Number(iat) - 1}.${sig}`, DAY)).toBe(false);
    expect(await verifyScopedToken(SECRET, "scope", `${iat}.${sig}00`, DAY)).toBe(false);
  });

  it("rejects malformed values", async () => {
    for (const bad of [undefined, "", ".", "abc", "123", ".abc", "12a.abc", "-1.abc", "12345678901.abc"]) {
      expect(await verifyScopedToken(SECRET, "scope", bad, DAY)).toBe(false);
    }
  });
});
