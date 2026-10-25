import { NextResponse } from "next/server";
import { updateTicketAssignees } from "@/app/lib/ticketcenter/sheets";
import { cleanAssignees, isValidAssignees } from "@/app/lib/ticketcenter/validate";
import { errorResponse, readJsonObject, requireLead } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  const lead = await requireLead();
  if (lead instanceof NextResponse) return lead;

  const { number } = await params;

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const { assignedTo } = body;
  if (!isValidAssignees(assignedTo)) {
    return NextResponse.json({ error: "Invalid assignees" }, { status: 400 });
  }

  const cleaned = cleanAssignees(assignedTo);

  try {
    const ticket = await updateTicketAssignees(decodeURIComponent(number), cleaned, lead);
    return NextResponse.json({ ticket });
  } catch (err) {
    return errorResponse(err);
  }
}
