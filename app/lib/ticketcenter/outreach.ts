// Outreach tracker: types + row mapping for the Directory and Dashboard tabs
// of the partnership spreadsheet (OUTREACH_SHEET_ID). Column layouts mirror
// the sheet exactly so it stays pleasant to edit by hand; the app only adds
// two audit columns (Updated, Updated By) at the end of each tab.

import { formatDue, isIsoDate, parseAssignees } from "./types";
import { normalizeDate } from "./meetings";

// Same pipeline as the sheet's Status dropdown, with the two typos corrected
// ("Contaced", "Actiev Partner"). parseStatus() still reads the old spellings.
export const OUTREACH_STATUSES = [
  "Not Started",
  "Drafting Outreach",
  "Contacted",
  "Follow-up Sent",
  "Replied - Discussing",
  "Meeting Scheduled",
  "Partnership Agreed",
  "Active Partner",
  "Declined",
  "No Response",
] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

/** Statuses where the conversation is over; next actions stop counting as overdue. */
export const CLOSED_STATUSES: readonly OutreachStatus[] = ["Declined", "No Response"];

export const PRIORITIES = ["High", "Medium", "Low"] as const;
export type Priority = (typeof PRIORITIES)[number];

// Org type taxonomy from the sheet's README / dropdown. Cells may hold extras.
export const ORG_TYPES = [
  "artist collectives",
  "artist-run spaces",
  "small galleries",
  "studio buildings",
  "community arts organizations",
  "makerspaces",
  "workshop providers",
  "pop-up organizers",
  "art markets",
  "small music/event organizers",
  "creative communities",
  "ceramics/print/photo studios",
  "independent theaters",
  "dance groups",
  "literary groups",
  "cultural organizations",
  "residencies",
  "youth arts organizations",
  "college groups",
  "cafes/bookstores with regular programming",
  "small local nonprofits",
] as const;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

const STATUS_LOOKUP: Record<string, OutreachStatus> = Object.fromEntries(
  OUTREACH_STATUSES.map((s) => [squash(s), s])
);
// Historic spellings still present in the sheet.
STATUS_LOOKUP.contaced = "Contacted";
STATUS_LOOKUP.actievpartner = "Active Partner";

export function isOutreachStatus(s: unknown): s is OutreachStatus {
  return typeof s === "string" && (OUTREACH_STATUSES as readonly string[]).includes(s);
}

/** Lenient: accepts the sheet's typos and casing; blank/unknown -> "Not Started". */
export function parseStatus(raw: string): OutreachStatus {
  const s = raw.trim();
  if (!s) return "Not Started";
  const hit = STATUS_LOOKUP[squash(s)];
  if (!hit) console.warn(`[outreach] unrecognized status "${s}", treating as Not Started`);
  return hit ?? "Not Started";
}

export function parsePriority(raw: string): Priority | "" {
  const s = raw.trim().toLowerCase();
  return (PRIORITIES.find((p) => p.toLowerCase() === s) as Priority | undefined) ?? "";
}

/** Comma-separated cell -> trimmed, deduped list. */
export function parseList(cell: string): string[] {
  const out: string[] = [];
  for (const part of cell.split(",")) {
    const t = part.trim();
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}

/** Org names are the join key between tabs; compare trimmed + case-insensitive. */
export function orgKey(name: string): string {
  return name.trim().toLowerCase();
}

// ── Directory tab (A..J editable, K..L audit) ──

export interface DirectoryFields {
  types: string[];
  city: string;
  website: string;
  social: string;
  fit: string;
  priority: Priority | "";
  owners: string[];
  status: OutreachStatus;
  notes: string;
}

export interface DirectoryOrg extends DirectoryFields {
  name: string;
  updated: string;
  updatedBy: string;
}

export function rowToDirectory(row: string[]): DirectoryOrg | null {
  const cell = (i: number) => (row[i] ?? "").toString().trim();
  const name = cell(0);
  if (!name) return null;
  return {
    name,
    types: parseList(cell(1)),
    city: cell(2),
    website: cell(3),
    social: cell(4),
    fit: cell(5),
    priority: parsePriority(cell(6)),
    owners: parseAssignees(cell(7)),
    status: parseStatus(cell(8)),
    notes: cell(9),
    updated: cell(10),
    updatedBy: cell(11),
  };
}

/** Editable fields -> columns B..J. */
export function directoryFieldsToCells(f: DirectoryFields): string[] {
  return [
    f.types.join(", "),
    f.city,
    f.website,
    f.social,
    f.fit,
    f.priority,
    f.owners.join(", "),
    f.status,
    f.notes,
  ];
}

// ── Dashboard tab (A..S editable, T..U audit) ──

export interface DashboardFields {
  types: string[];
  contactName: string;
  role: string;
  email: string;
  phone: string;
  social: string;
  website: string;
  relationship: string;
  owners: string[];
  angle: string;
  offer: string;
  want: string;
  status: OutreachStatus;
  firstContact: string; // "YYYY-MM-DD", "" or raw sheet text
  lastContact: string;
  nextAction: string;
  nextActionDate: string;
  notes: string;
}

export interface DashboardOrg extends DashboardFields {
  name: string;
  updated: string;
  updatedBy: string;
}

export function rowToDashboard(row: string[]): DashboardOrg | null {
  const cell = (i: number) => (row[i] ?? "").toString().trim();
  const name = cell(0);
  if (!name) return null;
  return {
    name,
    types: parseList(cell(1)),
    contactName: cell(2),
    role: cell(3),
    email: cell(4),
    phone: cell(5),
    social: cell(6),
    website: cell(7),
    relationship: cell(8),
    owners: parseAssignees(cell(9)),
    angle: cell(10),
    offer: cell(11),
    want: cell(12),
    status: parseStatus(cell(13)),
    firstContact: normalizeDate(cell(14)),
    lastContact: normalizeDate(cell(15)),
    nextAction: cell(16),
    nextActionDate: normalizeDate(cell(17)),
    notes: cell(18),
    updated: cell(19),
    updatedBy: cell(20),
  };
}

/** Editable fields -> columns B..S. */
export function dashboardFieldsToCells(f: DashboardFields): string[] {
  return [
    f.types.join(", "),
    f.contactName,
    f.role,
    f.email,
    f.phone,
    f.social,
    f.website,
    f.relationship,
    f.owners.join(", "),
    f.angle,
    f.offer,
    f.want,
    f.status,
    f.firstContact,
    f.lastContact,
    f.nextAction,
    f.nextActionDate,
    f.notes,
  ];
}

/** What every write returns: the affected row from each tab (null = no row there). */
export interface OrgWriteResult {
  directory: DirectoryOrg | null;
  dashboard: DashboardOrg | null;
}

/** Fields a Dashboard row starts with when an org is moved over from the Directory. */
export function dashboardFromDirectory(d: DirectoryOrg): DashboardFields {
  return {
    types: d.types,
    contactName: "",
    role: "",
    email: "",
    phone: "",
    social: d.social,
    website: d.website,
    relationship: "",
    owners: d.owners,
    angle: "",
    offer: "",
    want: "",
    status: d.status,
    firstContact: "",
    lastContact: "",
    nextAction: "",
    nextActionDate: "",
    notes: d.notes,
  };
}

function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
    t.getDate()
  ).padStart(2, "0")}`;
}

export function isNextActionOverdue(o: Pick<DashboardOrg, "nextActionDate" | "status">): boolean {
  if (!isIsoDate(o.nextActionDate) || CLOSED_STATUSES.includes(o.status)) return false;
  return o.nextActionDate < todayIso();
}

/** "Sep 16", raw text, or "—" for blank (dates here are optional, not TBD). */
export function formatOutreachDate(d: string): string {
  return d ? formatDue(d) : "—";
}

export function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}
