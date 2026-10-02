// In-memory rate limit for the internal portals' auth endpoints. Callers
// namespace their own keys ("view:", "lead:", "devex:") so the portals cannot
// exhaust each other's budget. Resets on cold start and is per-instance; that is
// acceptable for shared-password internal tools.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const attempts = new Map<string, { count: number; resetAt: number }>();

/** Returns true if this key is allowed another attempt (and records it). */
export function allowAttempt(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : "") || "unknown";
}
