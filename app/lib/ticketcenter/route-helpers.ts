import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LEAD_COOKIE, verifyLeadToken } from "./auth";
import { MeetingNotFoundError, TicketNotFoundError } from "./sheets";
import { OrgExistsError, OrgNotFoundError, OutreachNotConfiguredError } from "./outreach-sheets";

/** Returns the unlocked lead's name, or null. */
export async function currentLead(): Promise<string | null> {
  const store = await cookies();
  return verifyLeadToken(store.get(LEAD_COOKIE)?.value);
}

/** Returns the lead name, or a 403 response to return as-is. */
export async function requireLead(): Promise<string | NextResponse> {
  const lead = await currentLead();
  if (!lead) {
    return NextResponse.json({ error: "Lead mode required" }, { status: 403 });
  }
  return lead;
}

export function errorResponse(err: unknown): NextResponse {
  if (
    err instanceof TicketNotFoundError ||
    err instanceof MeetingNotFoundError ||
    err instanceof OrgNotFoundError
  ) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  if (err instanceof OrgExistsError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  if (err instanceof OutreachNotConfiguredError) {
    return NextResponse.json({ error: "Outreach sheet is not configured." }, { status: 503 });
  }
  console.error("[ticketcenter]", err);
  return NextResponse.json(
    { error: "Could not reach the ticket sheet. Try again in a moment." },
    { status: 502 }
  );
}
