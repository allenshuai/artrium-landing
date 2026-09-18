// Edge-safe auth for the /dev/exhibition portal. Signing lives in
// app/lib/security/token.ts, shared with the Ticket Center — the cookie name,
// secret and lifetime below are the only portal-specific parts.

import { cookieOptions, signScopedToken, verifyScopedToken } from "@/app/lib/security/token";

export const DEV_EX_COOKIE = "dev_ex_view";

const SCOPE = "dev_ex_view";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function requireSecret(): string {
  const s = process.env.DEV_EXHIBITION_COOKIE_SECRET;
  if (!s) throw new Error("DEV_EXHIBITION_COOKIE_SECRET is not set");
  return s;
}

export async function makeDevExToken(): Promise<string> {
  return signScopedToken(requireSecret(), SCOPE);
}

// Fails closed rather than throwing: this runs in proxy.ts for every request
// under the portal, and a missing secret should lock the portal down, not turn
// every page into a 500. The login route surfaces the misconfiguration instead.
export async function verifyDevExToken(token: string | undefined): Promise<boolean> {
  const secret = process.env.DEV_EXHIBITION_COOKIE_SECRET;
  if (!secret) return false;
  return verifyScopedToken(secret, SCOPE, token, MAX_AGE);
}

export function devExCookieOptions() {
  return cookieOptions(MAX_AGE);
}
