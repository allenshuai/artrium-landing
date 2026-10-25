import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { LEAD_COOKIE, VIEW_COOKIE, verifyLeadToken, verifyViewToken } from "./auth";
import { MeetingNotFoundError, TicketNotFoundError } from "./sheets";
import { OrgExistsError, OrgNotFoundError, OutreachNotConfiguredError } from "./outreach-sheets";

// proxy.ts gates the whole portal, but handlers and pages check the view cookie
// again so that a proxy bypass or a matcher mistake does not expose the Sheets.

async function hasView(): Promise<boolean> {
  const store = await cookies();
  return verifyViewToken(store.get(VIEW_COOKIE)?.value);
}

/** Null when the view cookie is valid, otherwise a 401 to return as-is. */
export async function requireView(): Promise<NextResponse | null> {
  if (await hasView()) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** For server pages: redirects to the login unless the view cookie is valid. */
export async function requireViewPage(): Promise<void> {
  if (!(await hasView())) redirect("/ticketcenter/login");
}

/** Returns the unlocked lead's name, or null. */
export async function currentLead(): Promise<string | null> {
  const store = await cookies();
  return verifyLeadToken(store.get(LEAD_COOKIE)?.value);
}

/** Returns the lead name, or a 401 (no view cookie) / 403 (no lead cookie) to return as-is. */
export async function requireLead(): Promise<string | NextResponse> {
  const denied = await requireView();
  if (denied) return denied;
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
