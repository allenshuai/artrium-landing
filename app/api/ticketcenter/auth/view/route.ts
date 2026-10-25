import { NextResponse } from "next/server";
import {
  VIEW_COOKIE,
  cookieOptions,
  makeViewToken,
} from "@/app/lib/ticketcenter/auth";
import { assertSameOriginWrite } from "@/app/lib/security/portal-guard";
import { allowAttempt, clientKey } from "@/app/lib/security/ratelimit";
import { timingSafeEqual } from "@/app/lib/security/token";
import { readJsonObject } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // The proxy already refuses cross-site writes; this holds without it.
  const refused = assertSameOriginWrite(req);
  if (refused) return refused;

  if (!allowAttempt("view:" + clientKey(req))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const password = typeof body.password === "string" ? body.password : "";

  const expected = process.env.TICKETCENTER_PASSWORD;
  if (!expected || !timingSafeEqual(password, expected)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(VIEW_COOKIE, await makeViewToken(), cookieOptions());
  return res;
}
