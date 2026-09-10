// Edge-safe auth helpers for the Ticket Center. Uses Web Crypto only, so the
// same code runs in proxy.ts and in Node route handlers. No Node imports here.

export const VIEW_COOKIE = "tc_view";
export const LEAD_COOKIE = "tc_lead";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const s = process.env.TICKETCENTER_COOKIE_SECRET;
  if (!s) throw new Error("TICKETCENTER_COOKIE_SECRET is not set");
  return s;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length === bb.length ? 0 : 1;
  for (let i = 0; i < ab.length; i++) {
    diff |= ab[i] ^ (i < bb.length ? bb[i] : 0);
  }
  return diff === 0;
}

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
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}
