import { NextResponse } from "next/server";
import { updateTicketDueDate } from "@/app/lib/ticketcenter/sheets";
import { isValidDueDate } from "@/app/lib/ticketcenter/validate";
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
  const { dueDate } = body;
  if (!isValidDueDate(dueDate)) {
    return NextResponse.json({ error: "Due date must be YYYY-MM-DD or blank" }, { status: 400 });
  }

  try {
    const ticket = await updateTicketDueDate(decodeURIComponent(number), dueDate, lead);
    return NextResponse.json({ ticket });
  } catch (err) {
    return errorResponse(err);
  }
}
