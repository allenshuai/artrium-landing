import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  LEAD_COOKIE,
  VIEW_COOKIE,
  cookieOptions,
  makeLeadToken,
  parseLeads,
  verifyViewToken,
} from "@/app/lib/ticketcenter/auth";
import { allowAttempt, clientKey } from "@/app/lib/security/ratelimit";
import { timingSafeEqual } from "@/app/lib/security/token";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Proxy lets /auth/* through, so enforce the view tier here.
  const store = await cookies();
  if (!(await verifyViewToken(store.get(VIEW_COOKIE)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!allowAttempt("lead:" + clientKey(req))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  let name = "";
  let passcode = "";
  try {
    const body = await req.json();
    name = typeof body.name === "string" ? body.name.trim() : "";
    passcode = typeof body.passcode === "string" ? body.passcode : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const expected = parseLeads().get(name);
  if (!expected || !timingSafeEqual(passcode, expected)) {
    return NextResponse.json({ error: "Wrong name or passcode" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, name });
  res.cookies.set(LEAD_COOKIE, await makeLeadToken(name), cookieOptions());
  return res;
}
