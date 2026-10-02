import { NextResponse } from "next/server";
import { getDashboard, getDirectory } from "@/app/lib/ticketcenter/outreach-sheets";
import { errorResponse } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

/** Both tabs in one round-trip; the client joins them by org name. */
export async function GET() {
  try {
    const [directory, dashboard] = await Promise.all([getDirectory(), getDashboard()]);
    return NextResponse.json({ directory, dashboard, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return errorResponse(err);
  }
}
