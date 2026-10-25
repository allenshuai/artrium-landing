import { NextResponse } from "next/server";
import { createTicket, getTickets } from "@/app/lib/ticketcenter/sheets";
import { projectsOf } from "@/app/lib/ticketcenter/types";
import { validateNewTicket } from "@/app/lib/ticketcenter/validate";
import { errorResponse, readJsonObject, requireLead, requireView } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireView();
  if (denied) return denied;
  try {
    const tickets = await getTickets();
    return NextResponse.json({
      tickets,
      projects: projectsOf(tickets),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  const lead = await requireLead();
  if (lead instanceof NextResponse) return lead;

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;

  const result = validateNewTicket(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const ticket = await createTicket(result.input, lead);
    return NextResponse.json({ ticket });
  } catch (err) {
    return errorResponse(err);
  }
}
