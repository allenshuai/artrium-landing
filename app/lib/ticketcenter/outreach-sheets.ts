import "server-only";
import { getSheets } from "./sheets";
import {
  dashboardFieldsToCells,
  dashboardFromDirectory,
  directoryFieldsToCells,
  orgKey,
  rowToDashboard,
  rowToDirectory,
  type DashboardFields,
  type DashboardOrg,
  type DirectoryFields,
  type DirectoryOrg,
  type OrgWriteResult,
} from "./outreach";

const DIRECTORY_RANGE = "Directory!A2:L";
const DASHBOARD_RANGE = "Dashboard!A2:U";
const CACHE_TTL_MS = 20_000;

export class OutreachNotConfiguredError extends Error {
  constructor() {
    super("OUTREACH_SHEET_ID is not set");
  }
}
export class OrgNotFoundError extends Error {
  constructor(name: string) {
    super(`"${name}" is not in the sheet`);
  }
}
export class OrgExistsError extends Error {
  constructor(name: string, where: string) {
    super(`"${name}" is already in the ${where}`);
  }
}

function sheetId(): string {
  const id = process.env.OUTREACH_SHEET_ID;
  if (!id) throw new OutreachNotConfiguredError();
  return id;
}

let directoryCache: { rows: DirectoryOrg[]; at: number } | null = null;
let dashboardCache: { rows: DashboardOrg[]; at: number } | null = null;

function bust(): void {
  directoryCache = null;
  dashboardCache = null;
}

export async function getDirectory(): Promise<DirectoryOrg[]> {
  if (directoryCache && Date.now() - directoryCache.at < CACHE_TTL_MS) return directoryCache.rows;
  const rows = await readDirectory();
  directoryCache = { rows, at: Date.now() };
  return rows;
}

export async function getDashboard(): Promise<DashboardOrg[]> {
  if (dashboardCache && Date.now() - dashboardCache.at < CACHE_TTL_MS) return dashboardCache.rows;
  const rows = await readDashboard();
  dashboardCache = { rows, at: Date.now() };
  return rows;
}

async function readDirectory(): Promise<DirectoryOrg[]> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: DIRECTORY_RANGE,
  });
  const out: DirectoryOrg[] = [];
  for (const row of (res.data.values ?? []) as string[][]) {
    const d = rowToDirectory(row);
    if (d) out.push(d);
  }
  return out;
}

async function readDashboard(): Promise<DashboardOrg[]> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: DASHBOARD_RANGE,
  });
  const out: DashboardOrg[] = [];
  for (const row of (res.data.values ?? []) as string[][]) {
    const d = rowToDashboard(row);
    if (d) out.push(d);
  }
  return out;
}

/**
 * Rows are located by org name at write time (never by cached index), so
 * people sorting or inserting rows in the Sheet can't make us write to the
 * wrong line. Row numbers are 1-based with the header on row 1.
 */
async function findDirectoryRow(name: string): Promise<{ rowNumber: number; org: DirectoryOrg } | null> {
  const rows = await readDirectory();
  const idx = rows.findIndex((r) => orgKey(r.name) === orgKey(name));
  return idx === -1 ? null : { rowNumber: idx + 2, org: rows[idx] };
}

async function findDashboardRow(name: string): Promise<{ rowNumber: number; org: DashboardOrg } | null> {
  const rows = await readDashboard();
  const idx = rows.findIndex((r) => orgKey(r.name) === orgKey(name));
  return idx === -1 ? null : { rowNumber: idx + 2, org: rows[idx] };
}

/** Best-effort audit trail in a "Log" tab; a missing tab must never block a save. */
async function appendLog(org: string, action: string, from: string, to: string, by: string): Promise<void> {
  try {
    await getSheets().spreadsheets.values.append({
      spreadsheetId: sheetId(),
      range: "Log!A:F",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[new Date().toISOString(), org, action, from, to, by]] },
    });
  } catch (err) {
    console.warn("[outreach] could not append to Log tab:", err instanceof Error ? err.message : err);
  }
}

export async function createDirectoryOrg(
  name: string,
  fields: DirectoryFields,
  leadName: string,
  alsoDashboard: boolean
): Promise<OrgWriteResult> {
  if (await findDirectoryRow(name)) throw new OrgExistsError(name, "Directory");
  const now = new Date().toISOString();
  const directory: DirectoryOrg = { name, ...fields, updated: now, updatedBy: leadName };
  await getSheets().spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: "Directory!A:L",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[name, ...directoryFieldsToCells(fields), now, leadName]] },
  });
  await appendLog(name, "directory:created", "", fields.status, leadName);
  bust();
  if (!alsoDashboard) return { directory, dashboard: null };
  return promoteToDashboard(name, leadName);
}

export async function updateDirectoryOrg(
  name: string,
  patch: Partial<DirectoryFields>,
  leadName: string
): Promise<OrgWriteResult> {
  const hit = await findDirectoryRow(name);
  if (!hit) throw new OrgNotFoundError(name);
  const { rowNumber, org } = hit;
  const now = new Date().toISOString();
  const next: DirectoryFields = {
    types: patch.types ?? org.types,
    city: patch.city ?? org.city,
    website: patch.website ?? org.website,
    social: patch.social ?? org.social,
    fit: patch.fit ?? org.fit,
    priority: patch.priority ?? org.priority,
    owners: patch.owners ?? org.owners,
    status: patch.status ?? org.status,
    notes: patch.notes ?? org.notes,
  };
  const data = [
    { range: `Directory!B${rowNumber}:J${rowNumber}`, values: [directoryFieldsToCells(next)] },
    { range: `Directory!K${rowNumber}:L${rowNumber}`, values: [[now, leadName]] },
  ];

  // Status lives on both tabs; keep the Dashboard row in step when there is one.
  let dashboard: DashboardOrg | null = null;
  const dash = await findDashboardRow(name);
  if (dash) {
    dashboard = dash.org;
    if (next.status !== dash.org.status) {
      data.push(
        { range: `Dashboard!N${dash.rowNumber}`, values: [[next.status]] },
        { range: `Dashboard!T${dash.rowNumber}:U${dash.rowNumber}`, values: [[now, leadName]] }
      );
      dashboard = { ...dash.org, status: next.status, updated: now, updatedBy: leadName };
    }
  }

  await getSheets().spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: { valueInputOption: "RAW", data },
  });
  const changed = (Object.keys(patch) as (keyof DirectoryFields)[]).filter(
    (k) => patch[k] !== undefined && JSON.stringify(patch[k]) !== JSON.stringify(org[k])
  );
  await appendLog(name, "directory:" + (changed.join(",") || "touch"), org.status, next.status, leadName);
  bust();
  return { directory: { ...org, ...next, updated: now, updatedBy: leadName }, dashboard };
}

/** Copies a Directory org onto the Dashboard. The Directory row stays (it's the master list). */
export async function promoteToDashboard(name: string, leadName: string): Promise<OrgWriteResult> {
  const hit = await findDirectoryRow(name);
  if (!hit) throw new OrgNotFoundError(name);
  if (await findDashboardRow(name)) throw new OrgExistsError(name, "Dashboard");
  const now = new Date().toISOString();
  const fields = dashboardFromDirectory(hit.org);
  await getSheets().spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: "Dashboard!A:U",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[hit.org.name, ...dashboardFieldsToCells(fields), now, leadName]] },
  });
  await appendLog(name, "dashboard:added", "", fields.status, leadName);
  bust();
  return {
    directory: hit.org,
    dashboard: { name: hit.org.name, ...fields, updated: now, updatedBy: leadName },
  };
}

export async function updateDashboardOrg(
  name: string,
  patch: Partial<DashboardFields>,
  leadName: string
): Promise<OrgWriteResult> {
  const hit = await findDashboardRow(name);
  if (!hit) throw new OrgNotFoundError(name);
  const { rowNumber, org } = hit;
  const now = new Date().toISOString();
  const next: DashboardFields = {
    types: patch.types ?? org.types,
    contactName: patch.contactName ?? org.contactName,
    role: patch.role ?? org.role,
    email: patch.email ?? org.email,
    phone: patch.phone ?? org.phone,
    social: patch.social ?? org.social,
    website: patch.website ?? org.website,
    relationship: patch.relationship ?? org.relationship,
    owners: patch.owners ?? org.owners,
    angle: patch.angle ?? org.angle,
    offer: patch.offer ?? org.offer,
    want: patch.want ?? org.want,
    status: patch.status ?? org.status,
    firstContact: patch.firstContact ?? org.firstContact,
    lastContact: patch.lastContact ?? org.lastContact,
    nextAction: patch.nextAction ?? org.nextAction,
    nextActionDate: patch.nextActionDate ?? org.nextActionDate,
    notes: patch.notes ?? org.notes,
  };
  const data = [
    { range: `Dashboard!B${rowNumber}:S${rowNumber}`, values: [dashboardFieldsToCells(next)] },
    { range: `Dashboard!T${rowNumber}:U${rowNumber}`, values: [[now, leadName]] },
  ];

  let directory: DirectoryOrg | null = null;
  const dir = await findDirectoryRow(name);
  if (dir) {
    directory = dir.org;
    if (next.status !== dir.org.status) {
      data.push(
        { range: `Directory!I${dir.rowNumber}`, values: [[next.status]] },
        { range: `Directory!K${dir.rowNumber}:L${dir.rowNumber}`, values: [[now, leadName]] }
      );
      directory = { ...dir.org, status: next.status, updated: now, updatedBy: leadName };
    }
  }

  await getSheets().spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: { valueInputOption: "RAW", data },
  });
  const changed = (Object.keys(patch) as (keyof DashboardFields)[]).filter(
    (k) => patch[k] !== undefined && JSON.stringify(patch[k]) !== JSON.stringify(org[k])
  );
  await appendLog(name, "dashboard:" + (changed.join(",") || "touch"), org.status, next.status, leadName);
  bust();
  return { directory, dashboard: { ...org, ...next, updated: now, updatedBy: leadName } };
}
