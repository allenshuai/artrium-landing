// In-memory rate limit for the internal portals' auth endpoints and the public
// waitlist. Callers namespace their own keys ("view:", "lead:", "devex:",
// "waitlist:") so one endpoint cannot exhaust another's budget, and may pass a
// budget of their own. Resets on cold start and is per-instance; that is
// acceptable for shared-password internal tools and as a brake on a sign-up form.

export type Budget = { max: number; windowMs: number };

/** The portal logins' budget: 10 attempts per 15 minutes. */
export const DEFAULT_BUDGET: Budget = { max: 10, windowMs: 15 * 60 * 1000 };

// Expired entries are dropped when a new key would take the map past this size,
// and again each time it doubles past what the last sweep kept, so a public
// endpoint cannot grow it without bound and a sweep costs O(1) per insert
// amortised even when most entries are still live.
const SWEEP_AT = 1000;

export type RateLimiter = {
  /** Returns true if this key is allowed another attempt (and records it). */
  allow(key: string, budget?: Partial<Budget>): boolean;
  /** Keys held, expired ones included until they are overwritten or swept. */
  readonly size: number;
};

export function createRateLimiter({ sweepAt = SWEEP_AT }: { sweepAt?: number } = {}): RateLimiter {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  let nextSweepAt = sweepAt;

  function sweep(now: number) {
    for (const [key, entry] of attempts) {
      if (now > entry.resetAt) attempts.delete(key);
    }
    nextSweepAt = Math.max(sweepAt, attempts.size * 2);
  }

  return {
    allow(key, { max = DEFAULT_BUDGET.max, windowMs = DEFAULT_BUDGET.windowMs } = {}) {
      const now = Date.now();
      const entry = attempts.get(key);
      if (!entry || now > entry.resetAt) {
        if (!entry && attempts.size >= nextSweepAt) sweep(now);
        attempts.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= max;
    },
    get size() {
      return attempts.size;
    },
  };
}

const limiter = createRateLimiter();

/** Returns true if this key is allowed another attempt (and records it). */
export function allowAttempt(key: string, budget?: Partial<Budget>): boolean {
  return limiter.allow(key, budget);
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : "") || "unknown";
}
