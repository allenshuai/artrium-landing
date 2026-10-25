// The checks every portal request goes through, defined once: each portal's
// cookie bound to its verifier (used by proxy.ts and again by the route helpers
// in handlers and server pages), and the same-origin write rule for handlers to
// re-apply. The path rules themselves live in proxy-rules.ts.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { DEV_EX_COOKIE, verifyDevExToken } from "@/app/lib/dev/exhibition/auth";
import { VIEW_COOKIE, verifyViewToken } from "@/app/lib/ticketcenter/auth";
import { isSameOriginWrite, PORTALS, type PortalId } from "./proxy-rules";

/** Where cookies are read from: next/headers' cookie store, or a NextRequest's `cookies`. */
export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

export interface PortalGuardConfig {
  cookie: string;
  verify: (token: string | undefined) => Promise<boolean>;
  /** Where requirePage sends a visitor without a valid cookie. */
  loginPath: string;
}

export interface PortalGuard {
  /** Whether the portal cookie verifies, read from a request (proxy.ts) or a cookie store. */
  has(source: CookieReader | { cookies: CookieReader }): Promise<boolean>;
  /** For route handlers: null when this request's cookie verifies, otherwise a 401 to return as-is. */
  require(): Promise<NextResponse | null>;
  /** For server pages: redirects to the login unless this request's cookie verifies. */
  requirePage(): Promise<void>;
}

export function portalGuard({ cookie, verify, loginPath }: PortalGuardConfig): PortalGuard {
  const has: PortalGuard["has"] = (source) => {
    const jar = "get" in source ? source : source.cookies;
    return verify(jar.get(cookie)?.value);
  };
  return {
    has,
    async require() {
      if (await has(await cookies())) return null;
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    },
    async requirePage() {
      if (!(await has(await cookies()))) redirect(loginPath);
    },
  };
}

function loginOf(id: PortalId): string {
  const portal = PORTALS.find((p) => p.id === id);
  if (!portal) throw new Error(`Unknown portal: ${id}`);
  return portal.login;
}

/**
 * Each portal's guard. One portal's cookie can never satisfy the other's, and
 * the login paths are the ones proxy-rules.ts dispatches on.
 */
export const PORTAL_GUARDS: Record<PortalId, PortalGuard> = {
  ticketcenter: portalGuard({ cookie: VIEW_COOKIE, verify: verifyViewToken, loginPath: loginOf("ticketcenter") }),
  devex: portalGuard({ cookie: DEV_EX_COOKIE, verify: verifyDevExToken, loginPath: loginOf("devex") }),
};

/**
 * The proxy's same-origin write rule (isSameOriginWrite), for handlers to
 * apply themselves so it still holds if the proxy is bypassed or its matcher
 * misses a route. Null when the request may go on, otherwise a 403 to return
 * as-is.
 */
export function assertSameOriginWrite(req: Request): NextResponse | null {
  if (isSameOriginWrite(req.method, req.headers, req.url)) return null;
  return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
}
