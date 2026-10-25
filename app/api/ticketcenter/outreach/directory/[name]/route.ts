import { NextResponse } from "next/server";
import { updateDirectoryOrg } from "@/app/lib/ticketcenter/outreach-sheets";
import { validateDirectory } from "@/app/lib/ticketcenter/validate";
import { errorResponse, readJsonObject, requireLead } from "@/app/lib/ticketcenter/route-helpers";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const lead = await requireLead(req);
  if (lead instanceof NextResponse) return lead;
  const { name } = await params;

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const result = validateDirectory(body, true);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    const out = await updateDirectoryOrg(decodeURIComponent(name), result.fields, lead);
    return NextResponse.json(out);
  } catch (err) {
    return errorResponse(err);
  }
}
