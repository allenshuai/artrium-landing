import "server-only";
import { google, type sheets_v4 } from "googleapis";
import { locateRows, RowMovedError, type Located } from "./sheet-rows";
import {
  rowToTicket,
  type NewTicketInput,
  type Ticket,
  type TicketStatus,
} from "./types";
import { isValidStatus } from "./validate";
import {
  fieldsToCells,
  rowToMeeting,
  type Meeting,
  type MeetingFields,
} from "./meetings";

const TICKETS_RANGE = "Tickets!A2:M";
const MEETINGS_RANGE = "Meetings!A2:K";
const CACHE_TTL_MS = 20_000;

let sheetsClient: sheets_v4.Sheets | null = null;

/** Shared, lazily-built Sheets client (also used by outreach-sheets.ts). */
export function getSheets(): sheets_v4.Sheets {
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

export interface KeyCheck {
  tab: string;
  sheetRow: number;
  key: string;
  /** Whether the trimmed key cell still names this record; exact match by default. */
  matches?: (cell: string) => boolean;
}

/**
 * Re-reads column A of every row about to be written and throws RowMovedError
 * unless each still holds the record's key, then writes. Someone sorting,
 * inserting or deleting rows in the Sheet between our read and our write would
 * otherwise make us overwrite a neighbour. This narrows that window to the gap
 * between the two calls below; it cannot close it.
 */
export async function guardedBatchUpdate(
  spreadsheetId: string,
  checks: KeyCheck[],
  data: sheets_v4.Schema$ValueRange[]
): Promise<void> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: checks.map((c) => `${c.tab}!A${c.sheetRow}`),
  });
  checks.forEach((c, i) => {
    const cell = String(res.data.valueRanges?.[i]?.values?.[0]?.[0] ?? "").trim();
    if (!(c.matches ? c.matches(cell) : cell === c.key)) throw new RowMovedError(c.tab, c.key);
  });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data },
  });
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

/** Uncached read, each ticket with the sheet row it came from. Also used by writes. */
async function readTicketRows(): Promise<Located<Ticket>[]> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: TICKETS_RANGE,
  });
  return locateRows((res.data.values ?? []) as string[][], rowToTicket);
}

async function readTickets(): Promise<Ticket[]> {
  return (await readTicketRows()).map((r) => r.item);
}

/** The ticket and its row number in the sheet (1-based, header on row 1). */
async function findTicketRow(
  ticketNumber: string
): Promise<{ rowNumber: number; ticket: Ticket }> {
  const hit = (await readTicketRows()).find((r) => r.item.number === ticketNumber);
  if (!hit) throw new TicketNotFoundError(ticketNumber);
  return { rowNumber: hit.sheetRow, ticket: hit.item };
}

const ticketCheck = (sheetRow: number, ticket: Ticket): KeyCheck => ({
  tab: "Tickets",
  sheetRow,
  key: ticket.number,
});

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
  await guardedBatchUpdate(sheetId(), [ticketCheck(rowNumber, ticket)], [
    { range: `Tickets!E${rowNumber}`, values: [[newStatus]] },
    { range: `Tickets!L${rowNumber}:M${rowNumber}`, values: [[now, leadName]] },
  ]);
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
  await guardedBatchUpdate(sheetId(), [ticketCheck(rowNumber, ticket)], [
    { range: `Tickets!F${rowNumber}`, values: [[joined]] },
    { range: `Tickets!L${rowNumber}:M${rowNumber}`, values: [[now, leadName]] },
  ]);
  await appendLog(ticketNumber, "assignees", ticket.assignedTo.join(", "), joined, leadName);
  bustCache();
  return { ...ticket, assignedTo: assignees, updated: now, updatedBy: leadName };
}

/** dueDate is "YYYY-MM-DD" or "" (TBD). */
export async function updateTicketDueDate(
  ticketNumber: string,
  dueDate: string,
  leadName: string
): Promise<Ticket> {
  const { rowNumber, ticket } = await findTicketRow(ticketNumber);
  const now = new Date().toISOString();
  await guardedBatchUpdate(sheetId(), [ticketCheck(rowNumber, ticket)], [
    { range: `Tickets!G${rowNumber}`, values: [[dueDate]] },
    { range: `Tickets!L${rowNumber}:M${rowNumber}`, values: [[now, leadName]] },
  ]);
  await appendLog(ticketNumber, "due", ticket.dueDate, dueDate, leadName);
  bustCache();
  return { ...ticket, dueDate, updated: now, updatedBy: leadName };
}

export async function updateTicketNotes(
  ticketNumber: string,
  notes: string,
  leadName: string
): Promise<Ticket> {
  const { rowNumber, ticket } = await findTicketRow(ticketNumber);
  const now = new Date().toISOString();
  await guardedBatchUpdate(sheetId(), [ticketCheck(rowNumber, ticket)], [
    { range: `Tickets!I${rowNumber}`, values: [[notes]] },
    { range: `Tickets!L${rowNumber}:M${rowNumber}`, values: [[now, leadName]] },
  ]);
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
    types: input.types,
    project: input.project,
    status,
    assignedTo: input.assignedTo ?? [],
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
          ticket.types.join(", "),
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

// ── Meetings tab ──

let meetingCache: { meetings: Meeting[]; at: number } | null = null;

export async function getMeetings(): Promise<Meeting[]> {
  if (meetingCache && Date.now() - meetingCache.at < CACHE_TTL_MS) return meetingCache.meetings;
  const meetings = await readMeetings();
  meetingCache = { meetings, at: Date.now() };
  return meetings;
}

async function readMeetingRows(): Promise<Located<Meeting>[]> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: MEETINGS_RANGE,
  });
  return locateRows((res.data.values ?? []) as string[][], rowToMeeting);
}

async function readMeetings(): Promise<Meeting[]> {
  return (await readMeetingRows()).map((r) => r.item);
}

export class MeetingNotFoundError extends Error {
  constructor(id: string) {
    super(`Meeting ${id} not found`);
  }
}

async function findMeetingRow(id: string): Promise<{ rowNumber: number; meeting: Meeting }> {
  const hit = (await readMeetingRows()).find((r) => r.item.id === id);
  if (!hit) throw new MeetingNotFoundError(id);
  return { rowNumber: hit.sheetRow, meeting: hit.item };
}

export async function createMeeting(fields: MeetingFields, leadName: string): Promise<Meeting> {
  const meetings = await readMeetings();
  let max = 0;
  for (const m of meetings) {
    const hit = m.id.match(/^MTG-(\d+)$/);
    if (hit) max = Math.max(max, parseInt(hit[1], 10));
  }
  const now = new Date().toISOString();
  const meeting: Meeting = {
    id: "MTG-" + String(max + 1).padStart(3, "0"),
    ...fields,
    created: now,
    updated: now,
    updatedBy: leadName,
  };
  await getSheets().spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: "Meetings!A:K",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[meeting.id, ...fieldsToCells(fields), now, now, leadName]] },
  });
  await appendLog(meeting.id, "meeting:created", "", fields.status, leadName);
  meetingCache = null;
  return meeting;
}

export async function updateMeeting(
  id: string,
  patch: Partial<MeetingFields>,
  leadName: string
): Promise<Meeting> {
  const { rowNumber, meeting } = await findMeetingRow(id);
  const now = new Date().toISOString();
  const next: MeetingFields = {
    title: patch.title ?? meeting.title,
    status: patch.status ?? meeting.status,
    date: patch.date ?? meeting.date,
    time: patch.time ?? meeting.time,
    link: patch.link ?? meeting.link,
    location: patch.location ?? meeting.location,
    notes: patch.notes ?? meeting.notes,
  };
  await guardedBatchUpdate(sheetId(), [{ tab: "Meetings", sheetRow: rowNumber, key: meeting.id }], [
    { range: `Meetings!B${rowNumber}:H${rowNumber}`, values: [fieldsToCells(next)] },
    { range: `Meetings!J${rowNumber}:K${rowNumber}`, values: [[now, leadName]] },
  ]);
  const changed = (Object.keys(patch) as (keyof MeetingFields)[]).filter(
    (k) => patch[k] !== undefined && patch[k] !== meeting[k]
  );
  await appendLog(id, "meeting:" + (changed.join(",") || "touch"), meeting.status, next.status, leadName);
  meetingCache = null;
  return { ...meeting, ...next, updated: now, updatedBy: leadName };
}
