import {
  TICKET_STATUSES,
  TICKET_TYPES,
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

/** Accepts one or more http(s) URLs separated by spaces, commas, or newlines. */
export function isValidLink(l: unknown): l is string {
  if (typeof l !== "string") return false;
  if (l.trim() === "") return true;
  return splitLinks(l).every((part) => {
    try {
      const u = new URL(part);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  });
}

export function splitLinks(l: string): string[] {
  return l.split(/[\s,]+/).filter(Boolean);
}

/** Accepts an array of non-empty name strings under 60 chars each, deduped. */
export function isValidAssignees(a: unknown): a is string[] {
  if (!Array.isArray(a)) return false;
  if (a.length > 20) return false;
  return a.every((n) => typeof n === "string" && n.trim().length > 0 && n.length < 60);
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

  let status: TicketStatus = "Backlog";
  if (body.status !== undefined && body.status !== "") {
    if (!isValidStatus(body.status)) return { ok: false, error: "Invalid status" };
    status = body.status;
  }

  const dueDate = typeof body.dueDate === "string" ? body.dueDate.trim() : "";
  if (!isValidDueDate(dueDate)) return { ok: false, error: "Due date must be YYYY-MM-DD" };

  const link = typeof body.link === "string" ? body.link.trim() : "";
  if (!isValidLink(link)) return { ok: false, error: "Link must be an http(s) URL" };

  const assignedTo = typeof body.assignedTo === "string" ? body.assignedTo.trim() : "";
  if (status !== "Backlog" && !assignedTo) {
    return { ok: false, error: "Assignee is required unless the ticket is in Backlog" };
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";

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
