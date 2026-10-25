import { NextResponse } from "next/server";
import { allowAttempt, clientKey } from "@/app/lib/security/ratelimit";

const NAME_MAX = 100;
const EMAIL_MAX = 254;
// One @, no whitespace, and a domain of non-empty dot-separated labels.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
// C0 and C1 control characters, DEL included.
const CONTROL_CHARS = /\p{Cc}/gu;
// The Apps Script writes these values into a sheet, where a cell starting with
// one of these characters is read as a formula.
const FORMULA_PREFIX = /^[=+\-@]/;

const UPSTREAM_FAILED = "Could not join the waitlist. Please try again.";

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

/** The value without control characters and surrounding space, or "" if not a string. */
function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(CONTROL_CHARS, "").trim() : "";
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
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail(400, "Invalid request.");
  }

  const fields = body as Record<string, unknown>;
  const name = clean(fields.name);
  const email = clean(fields.email);
  if (!name || !email) return fail(400, "Missing name or email.");
  if (name.length > NAME_MAX) return fail(400, `Name must be ${NAME_MAX} characters or fewer.`);
  if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
    return fail(400, "Enter a valid email address.");
  }
  if (FORMULA_PREFIX.test(name) || FORMULA_PREFIX.test(email)) {
    return fail(400, "Name and email cannot start with =, +, - or @.");
  }

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
