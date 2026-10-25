import {
  TICKET_STATUSES,
  TICKET_TYPES,
  normalizeAssignees,
  type NewTicketInput,
  type TicketStatus,
  type TicketType,
} from "./types";
import {
  MEETING_STATUSES,
  normalizeDate,
  normalizeTime,
  type MeetingFields,
  type MeetingStatus,
} from "./meetings";
import {
  PRIORITIES,
  isOutreachStatus,
  parseList,
  type DashboardFields,
  type DirectoryFields,
  type Priority,
} from "./outreach";

export const PROJECT_MAX = 80;
export const DESCRIPTION_MAX = 5000;
export const NAME_MAX = 60;
export const ASSIGNEES_MAX = 20;

/** A JSON body the routes can read fields from: an object, not null, an array or a scalar. */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isValidStatus(s: unknown): s is TicketStatus {
  return typeof s === "string" && (TICKET_STATUSES as readonly string[]).includes(s);
}

export function isValidType(t: unknown): t is TicketType {
  return typeof t === "string" && (TICKET_TYPES as readonly string[]).includes(t);
}

/** Non-empty array of distinct valid types. */
export function isValidTypes(a: unknown): a is TicketType[] {
  return (
    Array.isArray(a) && a.length > 0 && a.every(isValidType) && new Set(a).size === a.length
  );
}

export function isValidDueDate(d: unknown): d is string {
  if (typeof d !== "string") return false;
  if (d === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return !Number.isNaN(new Date(d + "T00:00:00Z").getTime());
}

/**
 * One http(s) URL. Whitespace anywhere is refused: `new URL` would encode the
 * space in "https://a.example/x https://b.example" and accept two values typed
 * into one cell as a single URL.
 */
export function isHttpUrl(s: string): boolean {
  if (/\s/.test(s)) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Accepts one or more http(s) URLs, separated as splitLinks reads them, or blank. */
export function isValidLink(l: unknown): l is string {
  if (typeof l !== "string") return false;
  if (l.trim() === "") return true;
  return splitLinks(l).every(isHttpUrl);
}

/**
 * Where one URL in a link cell ends and the next begins: whitespace (including
 * newlines), or a comma followed by whitespace, the end of the cell or the next
 * "http". Any other comma is part of the URL, as in a Google Maps
 * "@42.36,-71.05,17z" or a Zoom "?pwd=a,b".
 */
const LINK_SEPARATOR = /\s+|,(?=\s|$|https?:\/\/)/i;

export function splitLinks(l: string): string[] {
  return l.split(LINK_SEPARATOR).filter(Boolean);
}

/**
 * The distinct parts of a link cell that are http(s) URLs. Cells can be typed
 * straight into the Sheet, so anything read back goes through this before it
 * reaches an href.
 */
export function safeLinks(l: string): string[] {
  return [...new Set(splitLinks(l).filter(isHttpUrl))];
}

/** An http(s) URL inside free text, ending where splitLinks would end it. */
const URL_IN_TEXT = /https?:\/\/(?:[^\s,]|,(?!\s|$|https?:\/\/))+/gi;

/** Drops sentence punctuation after a URL, and a ")" or "]" the URL did not open. */
function trimUrlEnd(url: string): string {
  const count = (s: string, c: string) => s.split(c).length - 1;
  let u = url;
  for (;;) {
    const last = u[u.length - 1];
    if (".,;:!?'\"".includes(last)) u = u.slice(0, -1);
    else if (last === ")" && count(u, "(") < count(u, ")")) u = u.slice(0, -1);
    else if (last === "]" && count(u, "[") < count(u, "]")) u = u.slice(0, -1);
    else return u;
  }
}

export interface TextPart {
  text: string;
  /** Set when this part is an http(s) URL; it is then also `text`. */
  href?: string;
}

/**
 * A cell typed in the Sheet, cut into text and the http(s) URLs inside it, in
 * order, so the words around a URL ("Instagram: … (DM only)") are kept. Only
 * parts with `href` may go in an href; they have passed isHttpUrl.
 */
export function linkParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  for (const m of text.matchAll(URL_IN_TEXT)) {
    const url = trimUrlEnd(m[0]);
    const start = m.index ?? 0;
    if (!isHttpUrl(url)) continue;
    if (start > at) parts.push({ text: text.slice(at, start) });
    parts.push({ text: url, href: url });
    at = start + url.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

/**
 * An address that can follow "mailto:" verbatim: letters, digits and ._+- before
 * the @, dot-separated labels after it. Nothing a mailto URL would read as a
 * header ("?", "&"), an escape ("%") or a fragment ("#"). The write side checks
 * emails, but a cell typed in the Sheet is not checked, so anything else is
 * shown as text rather than linked.
 */
const PLAIN_EMAIL =
  /^[A-Za-z0-9._+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export function isPlainEmail(s: string): boolean {
  return s.length <= 254 && PLAIN_EMAIL.test(s);
}

/**
 * Accepts up to 20 names, each non-empty and at most 60 characters once
 * trimmed, with no commas (the Sheet stores them comma-separated).
 */
export function isValidAssignees(a: unknown): a is string[] {
  if (!Array.isArray(a)) return false;
  if (a.length > ASSIGNEES_MAX) return false;
  return a.every((n) => {
    if (typeof n !== "string") return false;
    const t = n.trim();
    return t.length > 0 && t.length <= NAME_MAX && !t.includes(",");
  });
}

/**
 * The list to check rules against and to write: trimmed, without blanks or the
 * "TBD" placeholder, deduped, exactly as the cell will be read back. Call after
 * isValidAssignees.
 */
export function cleanAssignees(a: string[]): string[] {
  return normalizeAssignees(a);
}

/** Validates a create-ticket body. Returns a clean input or an error message. */
export function validateNewTicket(
  body: Record<string, unknown>
): { ok: true; input: NewTicketInput } | { ok: false; error: string } {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { ok: false, error: "Title is required" };
  if (title.length >= 200) return { ok: false, error: "Title must be under 200 characters" };

  if (!isValidTypes(body.types)) return { ok: false, error: "Pick at least one type" };

  const project = typeof body.project === "string" ? body.project.trim() : "";
  if (!project) return { ok: false, error: "Project is required" };
  if (project.length > PROJECT_MAX) {
    return { ok: false, error: `Project must be ${PROJECT_MAX} characters or fewer` };
  }

  let status: TicketStatus = "Backlog";
  if (body.status !== undefined && body.status !== "") {
    if (!isValidStatus(body.status)) return { ok: false, error: "Invalid status" };
    status = body.status;
  }

  const dueDate = typeof body.dueDate === "string" ? body.dueDate.trim() : "";
  if (!isValidDueDate(dueDate)) return { ok: false, error: "Due date must be YYYY-MM-DD" };

  const link = typeof body.link === "string" ? body.link.trim() : "";
  if (!isValidLink(link)) return { ok: false, error: "Link must be an http(s) URL" };

  // Same shape as PATCH /tickets/[number]/assignees: an array of names. The
  // Backlog rule runs on the normalised list, which is also the one written, so
  // ["TBD"] counts as no assignee.
  let assignedTo: string[] = [];
  if (body.assignedTo !== undefined) {
    if (!isValidAssignees(body.assignedTo)) return { ok: false, error: "Invalid assignees" };
    assignedTo = cleanAssignees(body.assignedTo);
  }
  if (status !== "Backlog" && assignedTo.length === 0) {
    return { ok: false, error: "Assignee is required unless the ticket is in Backlog" };
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > DESCRIPTION_MAX) {
    return { ok: false, error: `Description must be ${DESCRIPTION_MAX} characters or fewer` };
  }

  return {
    ok: true,
    input: { title, types: body.types, project, status, assignedTo, dueDate, description, link },
  };
}

/**
 * Validates meeting fields from a request body. With `partial`, missing keys
 * are left undefined (PATCH); otherwise title is required and the rest default
 * to blank / "Scheduling".
 */
export function validateMeeting(
  body: Record<string, unknown>,
  partial: boolean
): { ok: true; fields: Partial<MeetingFields> } | { ok: false; error: string } {
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : undefined);
  const out: Partial<MeetingFields> = {};

  const title = str("title");
  if (title !== undefined) {
    if (!title) return { ok: false, error: "Title is required" };
    if (title.length >= 200) return { ok: false, error: "Title must be under 200 characters" };
    out.title = title;
  } else if (!partial) {
    return { ok: false, error: "Title is required" };
  }

  if (body.status !== undefined) {
    if (!(MEETING_STATUSES as readonly string[]).includes(body.status as string)) {
      return { ok: false, error: "Invalid status" };
    }
    out.status = body.status as MeetingStatus;
  } else if (!partial) {
    out.status = "Scheduling";
  }

  const date = str("date");
  if (date !== undefined) {
    if (date.length > 40) return { ok: false, error: "Date is too long" };
    out.date = normalizeDate(date);
  } else if (!partial) out.date = "";

  const time = str("time");
  if (time !== undefined) {
    if (time.length > 20) return { ok: false, error: "Time is too long" };
    out.time = normalizeTime(time);
  } else if (!partial) out.time = "";

  const link = str("link");
  if (link !== undefined) {
    if (!isValidLink(link)) return { ok: false, error: "Link must be an http(s) URL" };
    out.link = link;
  } else if (!partial) out.link = "";

  const location = str("location");
  if (location !== undefined) {
    if (location.length > 120) return { ok: false, error: "Location is too long" };
    out.location = location;
  } else if (!partial) out.location = "";

  const notes = str("notes");
  if (notes !== undefined) {
    if (notes.length > 5000) return { ok: false, error: "Notes are too long" };
    out.notes = notes;
  } else if (!partial) out.notes = "";

  return { ok: true, fields: out };
}

// ── Outreach (Directory / Dashboard tabs) ──


type Ok<T> = { ok: true; fields: T };
type Bad = { ok: false; error: string };

/** Accepts an array of strings or one comma-separated string; trims, dedupes, caps. */
function readList(v: unknown, label: string): string[] | string {
  if (v === undefined) return "";
  const list = Array.isArray(v)
    ? parseList(v.filter((x) => typeof x === "string").join(","))
    : typeof v === "string"
      ? parseList(v)
      : null;
  if (list === null) return `${label} must be a list`;
  if (list.length > 20) return `Too many ${label.toLowerCase()}`;
  if (list.some((x) => x.length > 80)) return `${label} entries must be under 80 characters`;
  return list;
}

const STRING_CAPS: Record<string, number> = {
  city: 120,
  website: 300,
  social: 300,
  fit: 2000,
  notes: 5000,
  contactName: 120,
  role: 120,
  email: 200,
  phone: 60,
  relationship: 200,
  angle: 1000,
  offer: 2000,
  want: 2000,
  nextAction: 1000,
};

/**
 * Website and social hold one URL each, so the whole (trimmed) value must be
 * one http(s) URL. They are never split, so a comma inside the URL is kept.
 */
function checkUrls(f: { website?: string; social?: string }): string | null {
  if (f.website && !isHttpUrl(f.website)) return "Website must be an http(s) URL";
  if (f.social && !isHttpUrl(f.social)) return "Social must be an http(s) URL";
  return null;
}

/**
 * Directory fields from a request body. With `partial`, missing keys stay
 * undefined (PATCH); otherwise city is required and the rest default to blank.
 * The org name is validated separately by the caller (create only).
 */
export function validateDirectory(body: Record<string, unknown>, partial: boolean): Ok<Partial<DirectoryFields>> | Bad {
  const out: Partial<DirectoryFields> = {};
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : undefined);

  for (const k of ["city", "website", "social", "fit", "notes"] as const) {
    const v = str(k);
    if (v !== undefined) {
      if (v.length > STRING_CAPS[k]) return { ok: false, error: `${k} is too long` };
      out[k] = v;
    } else if (!partial) out[k] = "";
  }
  if (!partial && !out.city) return { ok: false, error: "City / Area is required" };
  const badUrl = checkUrls(out);
  if (badUrl) return { ok: false, error: badUrl };

  const types = readList(body.types, "Org types");
  if (typeof types === "string") {
    if (types) return { ok: false, error: types };
    if (!partial) out.types = [];
  } else out.types = types;

  const owners = readList(body.owners, "Owners");
  if (typeof owners === "string") {
    if (owners) return { ok: false, error: owners };
    if (!partial) out.owners = [];
  } else out.owners = owners;

  if (body.priority !== undefined) {
    const p = typeof body.priority === "string" ? body.priority.trim() : null;
    if (p === null || (p !== "" && !(PRIORITIES as readonly string[]).includes(p))) {
      return { ok: false, error: "Priority must be High, Medium, Low or blank" };
    }
    out.priority = p as Priority | "";
  } else if (!partial) out.priority = "";

  if (body.status !== undefined) {
    if (!isOutreachStatus(body.status)) return { ok: false, error: "Invalid status" };
    out.status = body.status;
  } else if (!partial) out.status = "Not Started";

  return { ok: true, fields: out };
}

/** Dashboard fields from a request body (always PATCH-style: missing keys stay undefined). */
export function validateDashboard(body: Record<string, unknown>): Ok<Partial<DashboardFields>> | Bad {
  const out: Partial<DashboardFields> = {};
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : undefined);

  for (const k of [
    "contactName", "role", "email", "phone", "social", "website",
    "relationship", "angle", "offer", "want", "nextAction", "notes",
  ] as const) {
    const v = str(k);
    if (v !== undefined) {
      if (v.length > STRING_CAPS[k]) return { ok: false, error: `${k} is too long` };
      out[k] = v;
    }
  }
  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) {
    return { ok: false, error: "Email doesn't look right" };
  }
  const badUrl = checkUrls(out);
  if (badUrl) return { ok: false, error: badUrl };

  for (const k of ["firstContact", "lastContact", "nextActionDate"] as const) {
    const v = str(k);
    if (v !== undefined) {
      if (v.length > 40) return { ok: false, error: `${k} is too long` };
      out[k] = normalizeDate(v);
    }
  }

  const types = readList(body.types, "Org types");
  if (typeof types === "string") {
    if (types) return { ok: false, error: types };
  } else out.types = types;

  const owners = readList(body.owners, "Owners");
  if (typeof owners === "string") {
    if (owners) return { ok: false, error: owners };
  } else out.owners = owners;

  if (body.status !== undefined) {
    if (!isOutreachStatus(body.status)) return { ok: false, error: "Invalid status" };
    out.status = body.status;
  }

  return { ok: true, fields: out };
}

export function validateOrgName(v: unknown): { ok: true; name: string } | Bad {
  const name = typeof v === "string" ? v.trim() : "";
  if (!name) return { ok: false, error: "Org name is required" };
  if (name.length > 120) return { ok: false, error: "Org name must be under 120 characters" };
  return { ok: true, name };
}
