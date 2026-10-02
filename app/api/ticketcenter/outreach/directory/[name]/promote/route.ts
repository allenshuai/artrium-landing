import { NextResponse } from "next/server";
import { promoteToDashboard } from "@/app/lib/ticketcenter/outreach-sheets";
import { errorResponse, requireLead } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

/** Copies a Directory org onto the Dashboard tab. */
export async function POST(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const lead = await requireLead();
  if (lead instanceof NextResponse) return lead;
  const { name } = await params;
  try {
    const out = await promoteToDashboard(decodeURIComponent(name), lead);
    return NextResponse.json(out);
  } catch (err) {
    return errorResponse(err);
  }
}
