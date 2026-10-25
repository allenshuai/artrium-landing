import { NextResponse } from "next/server";
import { allowAttempt, clientKey } from "@/app/lib/security/ratelimit";
import { validateWaitlistInput } from "@/app/lib/waitlist/validation";

const UPSTREAM_FAILED = "Could not join the waitlist. Please try again.";

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const scriptUrl = process.env.WAITLIST_SCRIPT_URL;
  if (!scriptUrl) return fail(503, "Waitlist is not configured.");

  if (!allowAttempt("waitlist:" + clientKey(request))) {
    return fail(429, "Too many attempts. Try again later.");
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

  // Upstream details are logged here and never returned to the caller.
  try {
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ name, email, source: "artrium.space" }),
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
