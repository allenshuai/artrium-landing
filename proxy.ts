import { NextResponse, type NextRequest } from "next/server";
import { verifyViewToken, VIEW_COOKIE } from "@/app/lib/ticketcenter/auth";
import { verifyDevExToken, DEV_EX_COOKIE } from "@/app/lib/dev/exhibition/auth";

type Portal = {
  prefixes: string[];
  authApi: string;
  login: string;
  home: string;
  cookie: string;
  verify: (token: string | undefined) => Promise<boolean>;
};

// Each portal carries its own cookie and its own login path. Dispatch happens
// before any token is verified, so one portal's cookie can never satisfy the
// other's gate and an unauthenticated visitor is never bounced to the wrong
// login (which would make /dev/exhibition/login unreachable).
const PORTALS: Portal[] = [
  {
    prefixes: ["/ticketcenter", "/api/ticketcenter"],
    authApi: "/api/ticketcenter/auth",
    login: "/ticketcenter/login",
    home: "/ticketcenter",
    cookie: VIEW_COOKIE,
    verify: verifyViewToken,
  },
  {
    prefixes: ["/dev/exhibition", "/api/dev/exhibition"],
    authApi: "/api/dev/exhibition/auth",
    login: "/dev/exhibition/login",
    home: "/dev/exhibition",
    cookie: DEV_EX_COOKIE,
    verify: verifyDevExToken,
  },
];

function portalFor(pathname: string): Portal | undefined {
  return PORTALS.find((p) =>
    p.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))
  );
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const portal = portalFor(pathname);
  if (!portal) return NextResponse.next();

  // Auth endpoints are always reachable (they do their own rate limiting).
  if (pathname === portal.authApi || pathname.startsWith(portal.authApi + "/")) {
    return NextResponse.next();
  }

  const authed = await portal.verify(req.cookies.get(portal.cookie)?.value);

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
