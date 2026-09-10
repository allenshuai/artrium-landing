import { NextResponse } from "next/server";
import { updateTicketNotes } from "@/app/lib/ticketcenter/sheets";
import { errorResponse, requireLead } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  const lead = await requireLead();
  if (lead instanceof NextResponse) return lead;

  const { number } = await params;

  let notes: unknown;
  try {
    ({ notes } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (typeof notes !== "string" || notes.length > 5000) {
    return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
  }

  try {
    const ticket = await updateTicketNotes(decodeURIComponent(number), notes, lead);
    return NextResponse.json({ ticket });
  } catch (err) {
    return errorResponse(err);
  }
}
