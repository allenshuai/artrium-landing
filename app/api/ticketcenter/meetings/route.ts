import { NextResponse } from "next/server";
import { createMeeting, getMeetings } from "@/app/lib/ticketcenter/sheets";
import { validateMeeting } from "@/app/lib/ticketcenter/validate";
import { errorResponse, requireLead } from "@/app/lib/ticketcenter/route-helpers";
import type { MeetingFields } from "@/app/lib/ticketcenter/meetings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const meetings = await getMeetings();
    return NextResponse.json({ meetings, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  const lead = await requireLead();
  if (lead instanceof NextResponse) return lead;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = validateMeeting(body, false);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    const meeting = await createMeeting(result.fields as MeetingFields, lead);
    return NextResponse.json({ meeting });
  } catch (err) {
    return errorResponse(err);
  }
}
