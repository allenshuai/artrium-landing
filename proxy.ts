import { NextResponse, type NextRequest } from "next/server";
import { verifyViewToken, VIEW_COOKIE } from "@/app/lib/ticketcenter/auth";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Auth endpoints are always reachable (they do their own rate limiting).
  if (pathname.startsWith("/api/ticketcenter/auth/")) {
    return NextResponse.next();
  }

  const hasView = await verifyViewToken(req.cookies.get(VIEW_COOKIE)?.value);

  if (pathname === "/ticketcenter/login") {
    if (hasView) {
      return NextResponse.redirect(new URL("/ticketcenter", req.url));
    }
    return NextResponse.next();
  }

  if (hasView) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/ticketcenter/login", req.url));
}

export const config = {
  matcher: ["/ticketcenter/:path*", "/api/ticketcenter/:path*"],
};
