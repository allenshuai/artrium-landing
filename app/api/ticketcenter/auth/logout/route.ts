import { NextResponse } from "next/server";
import { LEAD_COOKIE, VIEW_COOKIE } from "@/app/lib/ticketcenter/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let scope = "all";
  try {
    const body = await req.json();
    if (body?.scope === "lead") scope = "lead";
  } catch {
    // no body: clear everything
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(LEAD_COOKIE);
  if (scope === "all") res.cookies.delete(VIEW_COOKIE);
  return res;
}
