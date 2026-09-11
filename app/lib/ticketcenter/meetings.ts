import { formatDue, isIsoDate, parseDueDate } from "./types";

export const MEETING_STATUSES = ["Scheduling", "Scheduled", "Done"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

/** Editable columns B..H of the Meetings tab. */
export interface MeetingFields {
  title: string;
  status: MeetingStatus;
  date: string; // "YYYY-MM-DD" when parseable, "" when blank, else raw sheet text
  time: string; // "HH:MM" (24h) when parseable, "" when blank, else raw sheet text
  link: string; // meeting URL or when2meet URL
  location: string;
  notes: string;
}

export interface Meeting extends MeetingFields {
  id: string; // "MTG-001"
  created: string;
  updated: string;
  updatedBy: string;
}

const HHMM_RE = /^\d{2}:\d{2}$/;
const pad = (n: number) => String(n).padStart(2, "0");

/** "12 pm", "12:00 PM", "3:30pm", "15:00", "noon" -> "HH:MM"; anything else -> "". */
export function parseTime(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/\./g, "");
  if (!s) return "";
  if (s === "noon") return "12:00";
  if (s === "midnight") return "00:00";
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return "";
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  if (min > 59) return "";
  if (m[3]) {
    if (h < 1 || h > 12) return "";
    if (m[3] === "pm" && h !== 12) h += 12;
    if (m[3] === "am" && h === 12) h = 0;
  } else if (h > 23) {
    return "";
  }
  return `${pad(h)}:${pad(min)}`;
}

/** "15:00" -> "3:00 PM"; non-HH:MM text passes through. */
export function formatTime(t: string): string {
  if (!HHMM_RE.test(t)) return t;
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}

/** Normalizes hand-typed date/time; keeps unreadable text so nothing is silently lost. */
export function normalizeDate(raw: string): string {
  const s = raw.trim();
  return parseDueDate(s) || (/^tbd$/i.test(s) ? "" : s);
}
export function normalizeTime(raw: string): string {
  const s = raw.trim();
  return parseTime(s) || (/^tbd$/i.test(s) ? "" : s);
}

/** One line for cards: "Sep 16 · 12:00 PM", "Finding a time", or "TBD". */
export function formatWhen(m: Pick<Meeting, "status" | "date" | "time">): string {
  if (!m.date && !m.time) return m.status === "Scheduling" ? "Finding a time" : "TBD";
  const parts = [];
  if (m.date) parts.push(formatDue(m.date));
  if (m.time) parts.push(formatTime(m.time));
  return parts.join(" · ");
}

/**
 * Hidden from the board once it's over: Done, or a real date that has passed
 * (2h after start when a time is known, otherwise once the day is over).
 * Uses the viewer's local clock.
 */
export function isPastMeeting(m: Meeting, now: Date = new Date()): boolean {
  if (m.status === "Done") return true;
  if (!isIsoDate(m.date)) return false;
  const [y, mo, d] = m.date.split("-").map(Number);
  if (HHMM_RE.test(m.time)) {
    const [h, mi] = m.time.split(":").map(Number);
    return now.getTime() > new Date(y, mo - 1, d, h, mi).getTime() + 2 * 3600_000;
  }
  return now.getTime() >= new Date(y, mo - 1, d + 1).getTime();
}

/** Dated meetings soonest first, then undated (scheduling) ones. */
export function sortMeetings(list: Meeting[]): Meeting[] {
  const key = (m: Meeting) =>
    isIsoDate(m.date) ? `0${m.date} ${HHMM_RE.test(m.time) ? m.time : "99:99"}` : `1${m.id}`;
  return [...list].sort((a, b) => key(a).localeCompare(key(b)));
}

/** Sheet row (columns A..K) -> Meeting. */
export function rowToMeeting(row: string[]): Meeting | null {
  const cell = (i: number) => (row[i] ?? "").toString().trim();
  const id = cell(0);
  if (!id) return null;
  let status = cell(2) as MeetingStatus;
  if (!MEETING_STATUSES.includes(status)) status = "Scheduling";
  return {
    id,
    title: cell(1),
    status,
    date: normalizeDate(cell(3)),
    time: normalizeTime(cell(4)),
    link: cell(5),
    location: cell(6),
    notes: cell(7),
    created: cell(8),
    updated: cell(9),
    updatedBy: cell(10),
  };
}

/** Editable fields -> columns B..H, with times written back in 12h form for the sheet. */
export function fieldsToCells(f: MeetingFields): string[] {
  return [f.title, f.status, f.date, formatTime(f.time), f.link, f.location, f.notes];
}
