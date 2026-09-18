import { NextResponse } from "next/server";
import { DEV_EX_COOKIE } from "@/app/lib/dev/exhibition/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(DEV_EX_COOKIE);
  return res;
}
