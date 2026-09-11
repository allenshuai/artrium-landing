export const TICKET_STATUSES = [
  "Backlog",
  "To Do",
  "In Progress",
  "Under Review",
  "Done",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_TYPES = [
  "design",
  "frontend",
  "backend",
  "outreach",
  "marketing",
  "admin",
] as const;

export type TicketType = (typeof TICKET_TYPES)[number];

export interface Ticket {
  number: string; // "ART-001"
  title: string;
  types: TicketType[]; // parsed from comma-separated cell; always at least one
  project: string;
  status: TicketStatus;
  assignedTo: string[]; // parsed from comma-separated names; empty = TBD
  dueDate: string; // "YYYY-MM-DD" when parseable, "" when blank/TBD, else the raw sheet text
  description: string;
  notes: string;
  link: string;
  created: string; // ISO timestamp or ""
  updated: string;
  updatedBy: string;
}

export interface NewTicketInput {
  title: string;
  types: TicketType[];
  project: string;
  status?: TicketStatus;
  assignedTo?: string;
  dueDate?: string;
  description?: string;
  link?: string;
}

const TBD_RE = /^tbd$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function isIsoDate(s: string): boolean {
  return ISO_RE.test(s);
}

function buildIso(y: number, m: number, d: number): string {
  if (m < 1 || m > 12 || d < 1 || d > 31) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function fullYear(s: string | undefined): number {
  if (!s) return new Date().getFullYear();
  const n = parseInt(s, 10);
  return s.length <= 2 ? 2000 + n : n;
}

/**
 * Lenient parser for hand-typed sheet dates. Accepts "2026-09-16", "9/16",
 * "9/16/26", "Sep 16th", "September 16, 2026", "16 Sep". A missing year means
 * the current year. Returns "" for blank, "TBD", or anything it can't read.
 */
export function parseDueDate(raw: string): string {
  const s = raw.trim();
  if (!s || TBD_RE.test(s)) return "";

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return buildIso(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (m) return buildIso(fullYear(m[3]), +m[1], +m[2]);

  m = s.match(/^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{2,4}))?$/i);
  if (m) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mo >= 0) return buildIso(fullYear(m[3]), mo + 1, +m[2]);
  }

  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?(?:,?\s+(\d{2,4}))?$/i);
  if (m) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mo >= 0) return buildIso(fullYear(m[3]), mo + 1, +m[1]);
  }

  return "";
}

/** Display label for a Ticket.dueDate: "TBD" when blank, "Sep 16" for ISO, raw text otherwise. */
export function formatDue(dueDate: string): string {
  if (!dueDate) return "TBD";
  if (!isIsoDate(dueDate)) return dueDate;
  const [y, m, d] = dueDate.split("-").map(Number);
  const label = `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${d}`;
  return y === new Date().getFullYear() ? label : `${label}, ${y}`;
}

export function parseTypes(cell: string): TicketType[] {
  const out: TicketType[] = [];
  for (const part of cell.split(",")) {
    const t = part.trim().toLowerCase() as TicketType;
    if ((TICKET_TYPES as readonly string[]).includes(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

export function parseAssignees(cell: string): string[] {
  return cell
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !TBD_RE.test(s));
}

/** Sheet row (columns A..M) -> Ticket. Trims every cell; unknown Status falls back to Backlog. */
export function rowToTicket(row: string[]): Ticket | null {
  const cell = (i: number) => (row[i] ?? "").toString().trim();
  const number = cell(0);
  if (!number) return null;

  let status = cell(4) as TicketStatus;
  if (!TICKET_STATUSES.includes(status)) {
    console.warn(
      `[ticketcenter] ${number}: unrecognized status "${cell(4)}", treating as Backlog`
    );
    status = "Backlog";
  }

  let types = parseTypes(cell(2));
  if (types.length === 0) {
    console.warn(
      `[ticketcenter] ${number}: unrecognized type "${cell(2)}", treating as admin`
    );
    types = ["admin"];
  }

  const rawDue = cell(6);
  const parsedDue = parseDueDate(rawDue);
  const dueDate = parsedDue || (TBD_RE.test(rawDue) ? "" : rawDue);

  return {
    number,
    title: cell(1),
    types,
    project: cell(3),
    status,
    assignedTo: parseAssignees(cell(5)),
    dueDate,
    description: cell(7),
    notes: cell(8),
    link: cell(9),
    created: cell(10),
    updated: cell(11),
    updatedBy: cell(12),
  };
}

/** Ticket -> sheet row (columns A..M). */
export function ticketToRow(t: Ticket): string[] {
  return [
    t.number,
    t.title,
    t.types.join(", "),
    t.project,
    t.status,
    t.assignedTo.join(", "),
    t.dueDate,
    t.description,
    t.notes,
    t.link,
    t.created,
    t.updated,
    t.updatedBy,
  ];
}

/** Distinct project names in order of first appearance. */
export function projectsOf(tickets: Ticket[]): string[] {
  const seen: string[] = [];
  for (const t of tickets) {
    if (t.project && !seen.includes(t.project)) seen.push(t.project);
  }
  return seen;
}
