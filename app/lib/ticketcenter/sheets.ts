import "server-only";
import { google, type sheets_v4 } from "googleapis";
import {
  rowToTicket,
  type NewTicketInput,
  type Ticket,
  type TicketStatus,
} from "./types";
import { isValidStatus } from "./validate";

const TICKETS_RANGE = "Tickets!A2:M";
const CACHE_TTL_MS = 20_000;

let sheetsClient: sheets_v4.Sheets | null = null;

function getSheets(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error("Google service account env vars are not set");
  }
  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

function sheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID is not set");
  return id;
}

let cache: { tickets: Ticket[]; at: number } | null = null;

export function bustCache(): void {
  cache = null;
}

export async function getTickets(): Promise<Ticket[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.tickets;
  const tickets = await readTickets();
  cache = { tickets, at: Date.now() };
  return tickets;
}

/** Uncached read. Also used internally by writes to locate rows. */
async function readTickets(): Promise<Ticket[]> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: TICKETS_RANGE,
  });
  const rows = (res.data.values ?? []) as string[][];
  const tickets: Ticket[] = [];
  for (const row of rows) {
    const t = rowToTicket(row);
    if (t) tickets.push(t);
  }
  return tickets;
}

/** Row number in the sheet (1-based, header on row 1, data from row 2). */
async function findTicketRow(
  ticketNumber: string
): Promise<{ rowNumber: number; ticket: Ticket }> {
  const tickets = await readTickets();
  const idx = tickets.findIndex((t) => t.number === ticketNumber);
  if (idx === -1) throw new TicketNotFoundError(ticketNumber);
  return { rowNumber: idx + 2, ticket: tickets[idx] };
}

export class TicketNotFoundError extends Error {
  constructor(number: string) {
    super(`Ticket ${number} not found`);
  }
}

async function appendLog(
  ticketNumber: string,
  action: string,
  from: string,
  to: string,
  by: string
): Promise<void> {
  await getSheets().spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: "Log!A:F",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[new Date().toISOString(), ticketNumber, action, from, to, by]],
    },
  });
}

export async function updateTicketStatus(
  ticketNumber: string,
  newStatus: TicketStatus,
  leadName: string
): Promise<Ticket> {
  if (!isValidStatus(newStatus)) throw new Error(`Invalid status: ${newStatus}`);
  const { rowNumber, ticket } = await findTicketRow(ticketNumber);
  const now = new Date().toISOString();
  await getSheets().spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `Tickets!E${rowNumber}`, values: [[newStatus]] },
        { range: `Tickets!L${rowNumber}:M${rowNumber}`, values: [[now, leadName]] },
      ],
    },
  });
  await appendLog(ticketNumber, "status", ticket.status, newStatus, leadName);
  bustCache();
  return { ...ticket, status: newStatus, updated: now, updatedBy: leadName };
}

export async function updateTicketAssignees(
  ticketNumber: string,
  assignees: string[],
  leadName: string
): Promise<Ticket> {
  const { rowNumber, ticket } = await findTicketRow(ticketNumber);
  const now = new Date().toISOString();
  const joined = assignees.join(", ");
  await getSheets().spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `Tickets!F${rowNumber}`, values: [[joined]] },
        { range: `Tickets!L${rowNumber}:M${rowNumber}`, values: [[now, leadName]] },
      ],
    },
  });
  await appendLog(ticketNumber, "assignees", ticket.assignedTo.join(", "), joined, leadName);
  bustCache();
  return { ...ticket, assignedTo: assignees, updated: now, updatedBy: leadName };
}

export async function updateTicketNotes(
  ticketNumber: string,
  notes: string,
  leadName: string
): Promise<Ticket> {
  const { rowNumber, ticket } = await findTicketRow(ticketNumber);
  const now = new Date().toISOString();
  await getSheets().spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `Tickets!I${rowNumber}`, values: [[notes]] },
        { range: `Tickets!L${rowNumber}:M${rowNumber}`, values: [[now, leadName]] },
      ],
    },
  });
  await appendLog(ticketNumber, "notes", "", "", leadName);
  bustCache();
  return { ...ticket, notes, updated: now, updatedBy: leadName };
}

export async function createTicket(
  input: NewTicketInput,
  leadName: string
): Promise<Ticket> {
  const tickets = await readTickets();
  let max = 0;
  for (const t of tickets) {
    const m = t.number.match(/^ART-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const number = "ART-" + String(max + 1).padStart(3, "0");
  const now = new Date().toISOString();
  const status = input.status ?? "Backlog";
  const ticket: Ticket = {
    number,
    title: input.title,
    type: input.type,
    project: input.project,
    status,
    assignedTo: (input.assignedTo ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    dueDate: input.dueDate ?? "",
    description: input.description ?? "",
    notes: "",
    link: input.link ?? "",
    created: now,
    updated: now,
    updatedBy: leadName,
  };
  await getSheets().spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: "Tickets!A:M",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          ticket.number,
          ticket.title,
          ticket.type,
          ticket.project,
          ticket.status,
          ticket.assignedTo.join(", "),
          ticket.dueDate,
          ticket.description,
          ticket.notes,
          ticket.link,
          ticket.created,
          ticket.updated,
          ticket.updatedBy,
        ],
      ],
    },
  });
  await appendLog(number, "created", "", status, leadName);
  bustCache();
  return ticket;
}
