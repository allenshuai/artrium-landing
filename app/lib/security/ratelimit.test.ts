import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { DEFAULT_BUDGET, allowAttempt, createRateLimiter, type Budget } from "./ratelimit";

// Date.now() is mocked so windows pass instantly and exactly.
beforeEach(() => mock.timers.enable({ apis: ["Date"], now: 1_000_000 }));
afterEach(() => mock.timers.reset());

const SHORT: Budget = { max: 10, windowMs: 1000 };
const LONG: Budget = { max: 10, windowMs: 60 * 60 * 1000 };

/** How many of `tries` attempts on `key` are allowed. */
function allowedOf(allow: (key: string) => boolean, key: string, tries: number): number {
  let allowed = 0;
  for (let i = 0; i < tries; i++) if (allow(key)) allowed++;
  return allowed;
}

test("without a budget a key gets 10 attempts per 15 minutes, as before", () => {
  assert.deepEqual(DEFAULT_BUDGET, { max: 10, windowMs: 15 * 60 * 1000 });
  const limiter = createRateLimiter();
  assert.equal(allowedOf((k) => limiter.allow(k), "view:1.2.3.4", 11), 10);
  mock.timers.tick(DEFAULT_BUDGET.windowMs);
  assert.equal(limiter.allow("view:1.2.3.4"), false, "the window is still open at its last millisecond");
  mock.timers.tick(1);
  assert.equal(limiter.allow("view:1.2.3.4"), true, "a new window starts once it has passed");
});

test("a budget sets the count and window for that key only", () => {
  const limiter = createRateLimiter();
  const waitlist: Budget = { max: 60, windowMs: 15 * 60 * 1000 };
  assert.equal(allowedOf((k) => limiter.allow(k, waitlist), "waitlist:1.2.3.4", 61), 60);
  assert.equal(allowedOf((k) => limiter.allow(k), "view:1.2.3.4", 11), 10, "the same address keeps the default elsewhere");
});

test("a budget may set only max or only windowMs; the other comes from the default", () => {
  const limiter = createRateLimiter();
  assert.equal(allowedOf((k) => limiter.allow(k, { max: 3 }), "a", 5), 3);
  mock.timers.tick(DEFAULT_BUDGET.windowMs + 1);
  assert.equal(limiter.allow("a", { max: 3 }), true, "max: 3 used the default window");

  assert.equal(allowedOf((k) => limiter.allow(k, { windowMs: 1000 }), "b", 12), 10);
  mock.timers.tick(1001);
  assert.equal(limiter.allow("b", { windowMs: 1000 }), true, "windowMs: 1000 used the default max");
});

test("allowAttempt passes the budget to the shared limiter", () => {
  assert.equal(allowAttempt("test:shared", { max: 1, windowMs: 1000 }), true);
  assert.equal(allowAttempt("test:shared", { max: 1, windowMs: 1000 }), false);
  mock.timers.tick(1001);
  assert.equal(allowAttempt("test:shared", { max: 1, windowMs: 1000 }), true);
});

test("an expired key is overwritten in place", () => {
  const limiter = createRateLimiter();
  assert.equal(allowedOf((k) => limiter.allow(k, { max: 1, windowMs: 1000 }), "a", 2), 1);
  mock.timers.tick(1001);
  assert.equal(limiter.allow("a", { max: 1, windowMs: 1000 }), true);
  assert.equal(limiter.size, 1);
});

test("expired entries are swept once a new key would take the map past 1,000", () => {
  const limiter = createRateLimiter();
  for (let i = 0; i < 1000; i++) limiter.allow(`ip:${i}`, SHORT);
  assert.equal(limiter.size, 1000);
  mock.timers.tick(SHORT.windowMs + 1);
  limiter.allow("ip:new", SHORT);
  assert.equal(limiter.size, 1, "the thousand expired entries are gone");
});

test("below the threshold expired entries wait to be overwritten or swept", () => {
  const limiter = createRateLimiter({ sweepAt: 4 });
  for (const key of ["a", "b", "c"]) limiter.allow(key, SHORT);
  mock.timers.tick(SHORT.windowMs + 1);
  limiter.allow("d", SHORT);
  assert.equal(limiter.size, 4);
  limiter.allow("e", SHORT);
  assert.equal(limiter.size, 2, "d and e; a, b and c were swept");
});

test("a sweep keeps live entries and their counts", () => {
  const limiter = createRateLimiter({ sweepAt: 4 });
  assert.equal(allowedOf((k) => limiter.allow(k, { max: 2, windowMs: LONG.windowMs }), "live", 3), 2);
  for (const key of ["x", "y", "z"]) limiter.allow(key, SHORT);
  mock.timers.tick(SHORT.windowMs + 1);
  limiter.allow("new", SHORT);
  assert.equal(limiter.size, 2, "live and new");
  assert.equal(limiter.allow("live", { max: 2, windowMs: LONG.windowMs }), false, "still over its budget");
});

test("when a sweep frees little, the next waits until the map has doubled", () => {
  const limiter = createRateLimiter({ sweepAt: 4 });
  for (const key of ["l1", "l2", "l3", "l4"]) limiter.allow(key, LONG);
  limiter.allow("s1", SHORT); // sweeps at 4, frees nothing: the next sweep is at 8
  limiter.allow("s2", SHORT);
  limiter.allow("s3", SHORT);
  assert.equal(limiter.size, 7);
  mock.timers.tick(SHORT.windowMs + 1);
  limiter.allow("n1", LONG);
  assert.equal(limiter.size, 8, "7 < 8: no sweep yet, so s1-s3 are still held");
  limiter.allow("n2", LONG);
  assert.equal(limiter.size, 6, "at 8 the sweep drops s1-s3, then n2 is added");
});
