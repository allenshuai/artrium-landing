// In-memory rate limit for the auth endpoints. Resets on cold start; that is
// acceptable for a shared-password internal tool.

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
