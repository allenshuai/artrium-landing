import { NextResponse, type NextRequest } from "next/server";
import { verifyViewToken, VIEW_COOKIE } from "@/app/lib/ticketcenter/auth";
import { verifyDevExToken, DEV_EX_COOKIE } from "@/app/lib/dev/exhibition/auth";
import { isAuthPath, isSameOriginWrite, portalFor, type PortalId } from "@/app/lib/security/proxy-rules";

// The path rules live in proxy-rules.ts; only the cookie and its verifier are
// bound here. Route handlers and server pages re-check the cookie themselves
// (requireView / requireDevEx), so this is not the only gate.
const GATES: Record<PortalId, { cookie: string; verify: (token: string | undefined) => Promise<boolean> }> = {
  ticketcenter: { cookie: VIEW_COOKIE, verify: verifyViewToken },
  devex: { cookie: DEV_EX_COOKIE, verify: verifyDevExToken },
};

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const portal = portalFor(pathname);
  if (!portal) return NextResponse.next();

  // Writes, including logins, must come from this origin.
  if (!isSameOriginWrite(req.method, req.headers, req.url)) {
    return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  }

  // Auth endpoints are always reachable (they do their own rate limiting).
  if (isAuthPath(portal, pathname)) return NextResponse.next();

  const gate = GATES[portal.id];
  const authed = await gate.verify(req.cookies.get(gate.cookie)?.value);

  if (pathname === portal.login) {
    if (authed) return NextResponse.redirect(new URL(portal.home, req.url));
    return NextResponse.next();
  }

  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL(portal.login, req.url));
}

export const config = {
  matcher: [
    "/ticketcenter/:path*",
    "/api/ticketcenter/:path*",
    "/dev/exhibition/:path*",
    "/api/dev/exhibition/:path*",
  ],
};
