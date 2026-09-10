import { NextResponse } from "next/server";
import { updateTicketStatus } from "@/app/lib/ticketcenter/sheets";
import { isValidStatus } from "@/app/lib/ticketcenter/validate";
import { errorResponse, requireLead } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  const lead = await requireLead();
  if (lead instanceof NextResponse) return lead;

  const { number } = await params;

  let status: unknown;
  try {
    ({ status } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!isValidStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const ticket = await updateTicketStatus(decodeURIComponent(number), status, lead);
    return NextResponse.json({ ticket });
  } catch (err) {
    return errorResponse(err);
  }
}
