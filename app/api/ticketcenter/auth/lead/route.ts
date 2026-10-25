import { NextResponse } from "next/server";
import {
  LEAD_COOKIE,
  cookieOptions,
  makeLeadToken,
  parseLeads,
} from "@/app/lib/ticketcenter/auth";
import { allowAttempt, clientKey } from "@/app/lib/security/ratelimit";
import { timingSafeEqual } from "@/app/lib/security/token";
import { readJsonObject, requireView } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // The proxy lets the auth paths through, so enforce the view tier here.
  const denied = await requireView();
  if (denied) return denied;

  if (!allowAttempt("lead:" + clientKey(req))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const passcode = typeof body.passcode === "string" ? body.passcode : "";

  const expected = parseLeads().get(name);
  if (!expected || !timingSafeEqual(passcode, expected)) {
    return NextResponse.json({ error: "Wrong name or passcode" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, name });
  res.cookies.set(LEAD_COOKIE, await makeLeadToken(name), cookieOptions());
  return res;
}
