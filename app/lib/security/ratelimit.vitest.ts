import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allowAttempt, clientKey } from "./ratelimit";

const WINDOW_MS = 15 * 60 * 1000;
const T0 = new Date("2026-10-01T12:00:00Z").getTime();

// The limiter's Map lives for the module, so every test uses its own keys.
const attempts = (key: string, n: number) => Array.from({ length: n }, () => allowAttempt(key));

describe("allowAttempt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows 10 attempts per window and refuses the rest", () => {
    expect(attempts("view:limit", 10).every(Boolean)).toBe(true);
    expect(allowAttempt("view:limit")).toBe(false);
    expect(allowAttempt("view:limit")).toBe(false);
  });

  it("keeps refusing until the window has passed, then starts a new one", () => {
    attempts("view:window", 11);
    vi.setSystemTime(T0 + WINDOW_MS);
    expect(allowAttempt("view:window")).toBe(false);
    vi.setSystemTime(T0 + WINDOW_MS + 1);
    expect(allowAttempt("view:window")).toBe(true);
    expect(attempts("view:window", 9).every(Boolean)).toBe(true);
    expect(allowAttempt("view:window")).toBe(false);
  });

  it("does not extend the window on refused attempts", () => {
    attempts("view:fixed", 10);
    vi.setSystemTime(T0 + WINDOW_MS - 1);
    expect(allowAttempt("view:fixed")).toBe(false);
    vi.setSystemTime(T0 + WINDOW_MS + 1);
    expect(allowAttempt("view:fixed")).toBe(true);
  });

  it("keeps namespaced keys apart, so one portal cannot exhaust another", () => {
    attempts("view:203.0.113.7", 11);
    expect(allowAttempt("view:203.0.113.7")).toBe(false);
    expect(allowAttempt("lead:203.0.113.7")).toBe(true);
    expect(allowAttempt("devex:203.0.113.7")).toBe(true);
    expect(allowAttempt("view:203.0.113.8")).toBe(true);
  });
});

describe("clientKey", () => {
  const req = (headers: Record<string, string> = {}) => new Request("https://artrium.space/api/x", { headers });

  it("uses the first x-forwarded-for hop, trimmed", () => {
    expect(clientKey(req({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientKey(req({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("falls back to 'unknown'", () => {
    expect(clientKey(req())).toBe("unknown");
    expect(clientKey(req({ "x-forwarded-for": " , 10.0.0.1" }))).toBe("unknown");
  });
});
