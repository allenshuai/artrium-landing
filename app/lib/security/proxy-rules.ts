// Pure request rules for proxy.ts: which portal owns a path, which paths are
// public auth endpoints, and whether a write came from this origin. Kept free of
// cookies, secrets and next/server so they can be unit-tested.

export type PortalId = "ticketcenter" | "devex";

export interface Portal {
  id: PortalId;
  prefixes: readonly string[];
  /**
   * The exact paths reachable without the portal cookie. Each one does its own
   * rate limiting or auth check; anything added later under the same folder is
   * gated until it is listed here.
   */
  authPaths: readonly string[];
  login: string;
  home: string;
}

// Each portal carries its own cookie and its own login path. Dispatch happens
// before any token is verified, so one portal's cookie can never satisfy the
// other's gate and an unauthenticated visitor is never bounced to the wrong
// login (which would make /dev/exhibition/login unreachable).
export const PORTALS: readonly Portal[] = [
  {
    id: "ticketcenter",
    prefixes: ["/ticketcenter", "/api/ticketcenter"],
    authPaths: [
      "/api/ticketcenter/auth/view",
      "/api/ticketcenter/auth/lead", // re-checks the view cookie itself
      "/api/ticketcenter/auth/logout",
    ],
    login: "/ticketcenter/login",
    home: "/ticketcenter",
  },
  {
    id: "devex",
    prefixes: ["/dev/exhibition", "/api/dev/exhibition"],
    authPaths: ["/api/dev/exhibition/auth", "/api/dev/exhibition/auth/logout"],
    login: "/dev/exhibition/login",
    home: "/dev/exhibition",
  },
];

export function portalFor(pathname: string): Portal | undefined {
  return PORTALS.find((p) =>
    p.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))
  );
}

export function isAuthPath(portal: Portal, pathname: string): boolean {
  return portal.authPaths.includes(pathname);
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type HeaderReader = { get(name: string): string | null };

/** The first value of a header that proxies may append to ("https, http"). */
function firstValue(headers: HeaderReader, name: string): string | undefined {
  return headers.get(name)?.split(",")[0].trim() || undefined;
}

/**
 * The origin the browser addressed. Behind TLS termination the request URL is
 * the internal `http://host` while the browser sends `Origin: https://host`, so
 * the scheme comes from `X-Forwarded-Proto` and the host from
 * `X-Forwarded-Host`, then `Host`, each falling back to the request URL. A page
 * cannot forge these cross-site: Host is set by the browser, and a custom
 * header makes the request preflighted, which nothing here answers.
 */
export function expectedOrigin(headers: HeaderReader, requestUrl: string): string {
  const url = new URL(requestUrl);
  const proto = firstValue(headers, "x-forwarded-proto")?.toLowerCase();
  const scheme = proto === "http" || proto === "https" ? proto : url.protocol.slice(0, -1);
  const host = firstValue(headers, "x-forwarded-host") ?? firstValue(headers, "host") ?? url.host;
  return new URL(`${scheme}://${host}`).origin;
}

/**
 * True for reads, and for writes the browser says came from this origin:
 * `Sec-Fetch-Site: same-origin` (or `none`, a user-initiated request), or an
 * `Origin` equal to the one the browser addressed (expectedOrigin).
 * SameSite=Lax already withholds the cookies cross-site; this also refuses
 * same-site callers such as script on another artrium.space host.
 */
export function isSameOriginWrite(method: string, headers: HeaderReader, requestUrl: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;

  const site = headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return true;

  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === expectedOrigin(headers, requestUrl);
  } catch {
    return false;
  }
}
