import { NextResponse } from "next/server";
import { createTicket, getTickets } from "@/app/lib/ticketcenter/sheets";
import { projectsOf } from "@/app/lib/ticketcenter/types";
import { validateNewTicket } from "@/app/lib/ticketcenter/validate";
import { errorResponse, requireLead } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

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
