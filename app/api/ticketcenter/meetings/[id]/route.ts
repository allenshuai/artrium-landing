import { NextResponse } from "next/server";
import { updateMeeting } from "@/app/lib/ticketcenter/sheets";
import { validateMeeting } from "@/app/lib/ticketcenter/validate";
import { errorResponse, readJsonObject, requireLead } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const lead = await requireLead();
  if (lead instanceof NextResponse) return lead;

  const { id } = await params;

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;

  const result = validateMeeting(body, true);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  if (Object.keys(result.fields).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const meeting = await updateMeeting(decodeURIComponent(id), result.fields, lead);
    return NextResponse.json({ meeting });
  } catch (err) {
    return errorResponse(err);
  }
}
