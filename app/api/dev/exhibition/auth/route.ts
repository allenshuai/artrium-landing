import { NextResponse } from "next/server";
import {
  DEV_EX_COOKIE,
  devExCookieOptions,
  makeDevExToken,
} from "@/app/lib/dev/exhibition/auth";
import { allowAttempt, clientKey } from "@/app/lib/security/ratelimit";
import { timingSafeEqual } from "@/app/lib/security/token";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!allowAttempt("devex:" + clientKey(req))) {
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

  const expected = process.env.DEV_EXHIBITION_PASSWORD;
  if (!expected || !timingSafeEqual(password, expected)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_EX_COOKIE, await makeDevExToken(), devExCookieOptions());
  return res;
}
