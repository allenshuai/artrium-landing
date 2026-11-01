import { NextResponse } from "next/server";
import { allowAttempt, clientKey, type Budget } from "@/app/lib/security/ratelimit";
import { validateWaitlistInput } from "@/app/lib/waitlist/validation";

// Looser than the portal logins' 10: a class or a venue on one network shares
// an address, and a sign-up form is not a password guess.
const WAITLIST_BUDGET: Budget = { max: 60, windowMs: 15 * 60 * 1000 };

const UPSTREAM_FAILED = "Could not join the waitlist. Please try again.";

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const scriptUrl = process.env.WAITLIST_SCRIPT_URL;
  if (!scriptUrl) return fail(503, "Waitlist is not configured.");

  if (!allowAttempt("waitlist:" + clientKey(request), WAITLIST_BUDGET)) {
    return fail(429, "Too many attempts. Try again in a few minutes.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid request.");
  }
  // The same rules as the form, so a 400 here carries the reason the popup shows.
  const input = validateWaitlistInput(body);
  if (!input.ok) return fail(400, input.error);
  const { name, email } = input;

  // Lets the script refuse posts that did not come through this route. It goes
  // in the body because an Apps Script doPost(e) cannot read request headers.
  const secret = process.env.WAITLIST_SHARED_SECRET;

  // Upstream details are logged here and never returned to the caller.
  try {
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ name, email, source: "artrium.space", ...(secret ? { secret } : {}) }),
    });
    const text = await res.text();

    if (!res.ok) {
      console.error(`waitlist: script responded HTTP ${res.status}: ${text.slice(0, 300)}`);
      return fail(502, UPSTREAM_FAILED);
    }

    let data: { ok?: unknown; error?: unknown } | null;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`waitlist: script returned non-JSON: ${text.slice(0, 300)}`);
      return fail(502, UPSTREAM_FAILED);
    }

    if (data?.ok !== true) {
      console.error("waitlist: script reported an error:", data?.error);
      return fail(502, UPSTREAM_FAILED);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("waitlist: request to script failed:", err);
    return fail(502, UPSTREAM_FAILED);
  }
}
