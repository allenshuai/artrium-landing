import { NextResponse } from "next/server";
import { currentLead } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ lead: await currentLead() });
}
