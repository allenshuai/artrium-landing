import { NextResponse } from "next/server";
import { createDirectoryOrg } from "@/app/lib/ticketcenter/outreach-sheets";
import { validateDirectory, validateOrgName } from "@/app/lib/ticketcenter/validate";
import { errorResponse, readJsonObject, requireLead } from "@/app/lib/ticketcenter/route-helpers";
import type { DirectoryFields } from "@/app/lib/ticketcenter/outreach";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const lead = await requireLead();
  if (lead instanceof NextResponse) return lead;

  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;

  const name = validateOrgName(body.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  const result = validateDirectory(body, false);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    const out = await createDirectoryOrg(
      name.name,
      result.fields as DirectoryFields,
      lead,
      body.addToDashboard === true
    );
    return NextResponse.json(out);
  } catch (err) {
    return errorResponse(err);
  }
}
