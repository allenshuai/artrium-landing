import { NextResponse } from "next/server";
import { createMeeting, getMeetings } from "@/app/lib/ticketcenter/sheets";
import { validateMeeting } from "@/app/lib/ticketcenter/validate";
import { errorResponse, readJsonObject, requireLead, requireView } from "@/app/lib/ticketcenter/route-helpers";
import type { MeetingFields } from "@/app/lib/ticketcenter/meetings";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireView();
  if (denied) return denied;
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

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;

  const result = validateMeeting(body, false);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    const meeting = await createMeeting(result.fields as MeetingFields, lead);
    return NextResponse.json({ meeting });
  } catch (err) {
    return errorResponse(err);
  }
}
