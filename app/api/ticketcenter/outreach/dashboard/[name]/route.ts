import { NextResponse } from "next/server";
import { updateDashboardOrg } from "@/app/lib/ticketcenter/outreach-sheets";
import { validateDashboard } from "@/app/lib/ticketcenter/validate";
import { errorResponse, readJsonObject, requireLead } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const lead = await requireLead(req);
  if (lead instanceof NextResponse) return lead;
  const { name } = await params;

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const result = validateDashboard(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    const out = await updateDashboardOrg(decodeURIComponent(name), result.fields, lead);
    return NextResponse.json(out);
  } catch (err) {
    return errorResponse(err);
  }
}
