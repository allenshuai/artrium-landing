// Signing primitives shared by the internal portals (Ticket Center,
// /dev/exhibition). Web Crypto only, so the same code runs in proxy.ts and in
// Node route handlers. Nothing here may import from app features.

export async function hmacHex(secret: string, message: string): Promise<string> {
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

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

// Tolerance for a client/server clock skew on the issued-at stamp.
const FUTURE_SKEW_SECONDS = 60;

// "<issuedAt>.<hmac(secret, scope:issuedAt)>". Signing the issued-at rather
// than a constant string means the cookie ages out server-side, so a leaked
// value stops working on its own instead of staying valid until the secret is
// rotated.
export async function signScopedToken(secret: string, scope: string): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  return `${issuedAt}.${await hmacHex(secret, `${scope}:${issuedAt}`)}`;
}

export async function verifyScopedToken(
  secret: string,
  scope: string,
  token: string | undefined,
  maxAgeSeconds: number
): Promise<boolean> {
  if (!token) return false;

  const dot = token.indexOf(".");
  if (dot <= 0) return false;

  const issuedAtRaw = token.slice(0, dot);
  if (!/^\d{1,10}$/.test(issuedAtRaw)) return false;

  const issuedAt = Number(issuedAtRaw);
  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now + FUTURE_SKEW_SECONDS) return false;
  if (now - issuedAt > maxAgeSeconds) return false;

  const expected = await hmacHex(secret, `${scope}:${issuedAt}`);
  return timingSafeEqual(token.slice(dot + 1), expected);
}
