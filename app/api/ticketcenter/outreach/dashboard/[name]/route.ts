import { NextResponse } from "next/server";
import { updateDashboardOrg } from "@/app/lib/ticketcenter/outreach-sheets";
import { validateDashboard } from "@/app/lib/ticketcenter/validate";
import { errorResponse, requireLead } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const lead = await requireLead();
  if (lead instanceof NextResponse) return lead;
  const { name } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const result = validateDashboard(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    const out = await updateDashboardOrg(decodeURIComponent(name), result.fields, lead);
    return NextResponse.json(out);
  } catch (err) {
    return errorResponse(err);
  }
}
