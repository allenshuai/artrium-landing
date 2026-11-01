// Edge-safe auth helpers for the Ticket Center. Signing primitives live in
// app/lib/security/token.ts and are shared with the /dev/exhibition portal;
// only the cookie names, secret and token payloads are specific to this portal.

import {
  cookieOptions as baseCookieOptions,
  signScopedToken,
  verifyScopedToken,
} from "@/app/lib/security/token";

export const VIEW_COOKIE = "tc_view";
export const LEAD_COOKIE = "tc_lead";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const VIEW_SCOPE = "tc_view";
const leadScope = (name: string) => `tc_lead:${name}`;

function requireSecret(): string {
  const s = process.env.TICKETCENTER_COOKIE_SECRET;
  if (!s) throw new Error("TICKETCENTER_COOKIE_SECRET is not set");
  return s;
}

// Verification fails closed rather than throwing: it runs in proxy.ts on every
// portal request, and a missing secret should lock the portal down, not turn
// every page into a 500. Signing (the login routes) still throws.
function secretOrNull(): string | null {
  return process.env.TICKETCENTER_COOKIE_SECRET || null;
}

// Both cookies are scoped tokens with a signed issued-at, so they age out
// server-side after COOKIE_MAX_AGE; this change invalidates every existing
// tc_view and tc_lead cookie once.
export async function makeViewToken(): Promise<string> {
  return signScopedToken(requireSecret(), VIEW_SCOPE);
}

export async function verifyViewToken(token: string | undefined): Promise<boolean> {
  const secret = secretOrNull();
  if (!secret) return false;
  return verifyScopedToken(secret, VIEW_SCOPE, token, COOKIE_MAX_AGE);
}

/** "<encodeURIComponent(name)>.<issuedAt>.<hmac(secret, "tc_lead:<name>:<issuedAt>")>" */
export async function makeLeadToken(name: string): Promise<string> {
  return `${encodeURIComponent(name)}.${await signScopedToken(requireSecret(), leadScope(name))}`;
}

/**
 * Returns the lead name if the token is valid, unexpired, and the name is still
 * in TICKETCENTER_LEADS; otherwise null. The list is checked on every call, so
 * removing someone from the env var revokes their write access at once.
 */
export async function verifyLeadToken(token: string | undefined): Promise<string | null> {
  const secret = secretOrNull();
  if (!secret || !token) return null;

  // encodeURIComponent leaves "." alone, so the name may contain dots: split
  // from the right, where the signature and the issued-at never do.
  const sigDot = token.lastIndexOf(".");
  if (sigDot <= 0) return null;
  const iatDot = token.lastIndexOf(".", sigDot - 1);
  if (iatDot <= 0) return null;

  let name: string;
  try {
    name = decodeURIComponent(token.slice(0, iatDot));
  } catch {
    return null;
  }
  if (!(await verifyScopedToken(secret, leadScope(name), token.slice(iatDot + 1), COOKIE_MAX_AGE))) {
    return null;
  }
  return parseLeads().has(name) ? name : null;
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
