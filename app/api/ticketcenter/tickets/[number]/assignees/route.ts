import { NextResponse } from "next/server";
import { updateTicketAssignees } from "@/app/lib/ticketcenter/sheets";
import { isValidAssignees } from "@/app/lib/ticketcenter/validate";
import { errorResponse, requireLead } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  const lead = await requireLead();
  if (lead instanceof NextResponse) return lead;

  const { number } = await params;

  let assignedTo: unknown;
  try {
    ({ assignedTo } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!isValidAssignees(assignedTo)) {
    return NextResponse.json({ error: "Invalid assignees" }, { status: 400 });
  }

  const cleaned = [...new Set(assignedTo.map((n) => n.trim()))];

  try {
    const ticket = await updateTicketAssignees(decodeURIComponent(number), cleaned, lead);
    return NextResponse.json({ ticket });
  } catch (err) {
    return errorResponse(err);
  }
}
