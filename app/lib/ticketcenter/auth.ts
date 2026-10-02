// Edge-safe auth helpers for the Ticket Center. Signing primitives live in
// app/lib/security/token.ts and are shared with the /dev/exhibition portal;
// only the cookie names, secret and token payloads are specific to this portal.

import { cookieOptions as baseCookieOptions, hmacHex, timingSafeEqual } from "@/app/lib/security/token";

export const VIEW_COOKIE = "tc_view";
export const LEAD_COOKIE = "tc_lead";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const s = process.env.TICKETCENTER_COOKIE_SECRET;
  if (!s) throw new Error("TICKETCENTER_COOKIE_SECRET is not set");
  return s;
}

// These two sign a constant string, so the value never ages out server-side and
// can only be revoked by rotating the secret. Kept as-is deliberately: changing
// the payload would invalidate every live tc_view/tc_lead cookie and force the
// whole team to log in again. New portals use signScopedToken instead.
export async function makeViewToken(): Promise<string> {
  return hmacHex(getSecret(), "view");
}

export async function verifyViewToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await hmacHex(getSecret(), "view");
  return timingSafeEqual(token, expected);
}

export async function makeLeadToken(name: string): Promise<string> {
  const sig = await hmacHex(getSecret(), "lead:" + name);
  return `${encodeURIComponent(name)}.${sig}`;
}

/** Returns the lead name if the token is valid, otherwise null. */
export async function verifyLeadToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  let name: string;
  try {
    name = decodeURIComponent(token.slice(0, dot));
  } catch {
    return null;
  }
  const sig = token.slice(dot + 1);
  const expected = await hmacHex(getSecret(), "lead:" + name);
  return timingSafeEqual(sig, expected) ? name : null;
}

/** Parses TICKETCENTER_LEADS ("Allen:pass1,Alison:pass2") into name -> passcode. */
export function parseLeads(): Map<string, string> {
  const raw = process.env.TICKETCENTER_LEADS ?? "";
  const map = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const idx = pair.indexOf(":");
    if (idx <= 0) continue;
    const name = pair.slice(0, idx).trim();
    const passcode = pair.slice(idx + 1).trim();
    if (name && passcode) map.set(name, passcode);
  }
  return map;
}

export function cookieOptions() {
  return baseCookieOptions(COOKIE_MAX_AGE);
}
