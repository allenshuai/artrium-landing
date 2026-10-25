import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertSameOriginWrite, PORTAL_GUARDS } from "@/app/lib/security/portal-guard";
import { LEAD_COOKIE, verifyLeadToken } from "./auth";
import { MeetingNotFoundError, TicketNotFoundError } from "./sheets";
import { OrgExistsError, OrgNotFoundError, OutreachNotConfiguredError } from "./outreach-sheets";
import { RowMovedError } from "./sheet-rows";

export { isPlainObject, readJsonObject } from "@/app/lib/security/json";

// proxy.ts gates the whole portal, but handlers and pages check the view cookie
// again, with the same guard, and lead writes re-apply the proxy's same-origin
// rule, so that a proxy bypass or a matcher mistake does not expose the Sheets.

const view = PORTAL_GUARDS.ticketcenter;

/** Null when the view cookie is valid, otherwise a 401 to return as-is. */
export function requireView(): Promise<NextResponse | null> {
  return view.require();
}

/** For server pages: redirects to the login unless the view cookie is valid. */
export function requireViewPage(): Promise<void> {
  return view.requirePage();
}

/** Returns the unlocked lead's name, or null. */
export async function currentLead(): Promise<string | null> {
  const store = await cookies();
  return verifyLeadToken(store.get(LEAD_COOKIE)?.value);
}

/**
 * Returns the lead name, or a response to return as-is: 403 for a write from
 * another origin, 401 without the view cookie, 403 without the lead cookie.
 */
export async function requireLead(req: Request): Promise<string | NextResponse> {
  const refused = assertSameOriginWrite(req);
  if (refused) return refused;
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
  if (err instanceof OrgExistsError || err instanceof RowMovedError) {
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
