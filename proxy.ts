import { NextResponse, type NextRequest } from "next/server";
import { assertSameOriginWrite, PORTAL_GUARDS } from "@/app/lib/security/portal-guard";
import { isAuthPath, portalFor } from "@/app/lib/security/proxy-rules";

// The path rules live in proxy-rules.ts and each portal's cookie and verifier in
// portal-guard.ts. Route handlers and server pages re-check with the same guards
// (requireView / requireDevEx), and lead writes and the Ticket Center logins
// re-apply the same-origin rule, so this is not the only gate.

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const portal = portalFor(pathname);
  if (!portal) return NextResponse.next();

  // Writes, including logins, must come from this origin.
  const refused = assertSameOriginWrite(req);
  if (refused) return refused;

  // Auth endpoints are always reachable (they do their own rate limiting).
  if (isAuthPath(portal, pathname)) return NextResponse.next();

  const authed = await PORTAL_GUARDS[portal.id].has(req);

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
