import { NextResponse } from "next/server";
import { getContactGuide } from "@/app/lib/ticketcenter/outreach-sheets";
import { errorResponse } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getContactGuide());
  } catch (err) {
    return errorResponse(err);
  }
}
