import {
  TICKET_STATUSES,
  TICKET_TYPES,
  type NewTicketInput,
  type TicketStatus,
  type TicketType,
} from "./types";

export function isValidStatus(s: unknown): s is TicketStatus {
  return typeof s === "string" && (TICKET_STATUSES as readonly string[]).includes(s);
}

export function isValidType(t: unknown): t is TicketType {
  return typeof t === "string" && (TICKET_TYPES as readonly string[]).includes(t);
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

  if (!isValidType(body.type)) return { ok: false, error: "Invalid type" };

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
    input: { title, type: body.type, project, status, assignedTo, dueDate, description, link },
  };
}
