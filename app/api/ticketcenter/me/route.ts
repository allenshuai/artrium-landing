import { NextResponse } from "next/server";
import { currentLead, requireView } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireView();
  if (denied) return denied;
  return NextResponse.json({ lead: await currentLead() });
}
