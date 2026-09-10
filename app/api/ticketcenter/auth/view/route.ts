import { NextResponse } from "next/server";
import {
  VIEW_COOKIE,
  cookieOptions,
  makeViewToken,
  timingSafeEqual,
} from "@/app/lib/ticketcenter/auth";
import { allowAttempt, clientKey } from "@/app/lib/ticketcenter/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!allowAttempt("view:" + clientKey(req))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const expected = process.env.TICKETCENTER_PASSWORD;
  if (!expected || !timingSafeEqual(password, expected)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(VIEW_COOKIE, await makeViewToken(), cookieOptions());
  return res;
}
