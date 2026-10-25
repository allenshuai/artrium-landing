// The waitlist's input rules, used by /api/waitlist and by TicketPopup so the
// form accepts exactly what the route accepts and both give the same reason.
// Pure and client-safe: no Node or Next imports.

export const NAME_MAX = 100;
export const EMAIL_MAX = 254;
/** One @, no whitespace, and a domain of non-empty dot-separated labels. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
/**
 * The Apps Script writes these values into a sheet, where a cell starting with
 * one of these characters is read as a formula.
 */
export const FORMULA_PREFIX = /^[=+\-@]/;
// C0 and C1 control characters, DEL included.
const CONTROL_CHARS = /\p{Cc}/gu;

export type WaitlistInput =
  | { ok: true; name: string; email: string }
  | { ok: false; error: string };

/** The value without control characters and surrounding space, or "" if not a string. */
export function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(CONTROL_CHARS, "").trim() : "";
}

/** True when an already-cleaned email is within the cap and matches the pattern. */
export function isValidEmail(email: string): boolean {
  return email.length <= EMAIL_MAX && EMAIL_PATTERN.test(email);
}

/**
 * The cleaned name and email from a request body, or the reason it is refused.
 * The reasons are written for the person filling in the form.
 */
export function validateWaitlistInput(body: unknown): WaitlistInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Invalid request." };
  }
  const fields = body as Record<string, unknown>;
  const name = clean(fields.name);
  const email = clean(fields.email);
  if (!name || !email) return { ok: false, error: "Missing name or email." };
  if (name.length > NAME_MAX) {
    return { ok: false, error: `Name must be ${NAME_MAX} characters or fewer.` };
  }
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (FORMULA_PREFIX.test(name) || FORMULA_PREFIX.test(email)) {
    return { ok: false, error: "Name and email cannot start with =, +, - or @." };
  }
  return { ok: true, name, email };
}
