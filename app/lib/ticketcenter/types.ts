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
  type: TicketType;
  project: string;
  status: TicketStatus;
  assignedTo: string[]; // parsed from comma-separated names
  dueDate: string; // "YYYY-MM-DD" or ""
  description: string;
  notes: string;
  link: string;
  created: string; // ISO timestamp or ""
  updated: string;
  updatedBy: string;
}

export interface NewTicketInput {
  title: string;
  type: TicketType;
  project: string;
  status?: TicketStatus;
  assignedTo?: string;
  dueDate?: string;
  description?: string;
  link?: string;
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

  let type = cell(2).toLowerCase() as TicketType;
  if (!TICKET_TYPES.includes(type)) {
    console.warn(
      `[ticketcenter] ${number}: unrecognized type "${cell(2)}", treating as admin`
    );
    type = "admin";
  }

  return {
    number,
    title: cell(1),
    type,
    project: cell(3),
    status,
    assignedTo: cell(5)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    dueDate: cell(6),
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
    t.type,
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
