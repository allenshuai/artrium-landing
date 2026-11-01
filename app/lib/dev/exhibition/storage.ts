import "server-only";

import { get, list, put } from "@vercel/blob";
import { hasBlockingError, validateMap, type ExhibitionMap } from "../../exhibition-map/schema";
import {
  asStoredImport,
  issuesToStore,
  isValidImportId,
  newImportId,
  summarize,
  type ImportSummary,
  type StoredImport,
} from "./imports";
import { chooseStore, isNotFound, isUnavailable, readEnv, StorageError, storeFailure } from "./storeConfig";

export { isUnavailable, StorageError, type StorageFailure } from "./storeConfig";

// Vercel Blob is the production store. The repo filesystem is not an option:
// it is read-only on Vercel apart from an ephemeral per-invocation /tmp, so
// writing JSON under content/ would pass in `next dev` and fail in production.
//
// `next dev` uses a local directory instead, so the portal is testable offline
// and a local session never writes to the store the deployed portal reads.
// Which one applies, and when a missing store throws, is chooseStore's call
// (storeConfig.ts): a production build uses the Blob store without needing
// VERCEL=1, unless VERCEL_ENV is "development". So a local production build run
// after `vercel env pull --environment=production` WILL talk to the production
// store; that is what pulling production means.
//
// Credentials: see blobAuth() below.

const PREFIX = "dev-exhibition-imports/";
const LOCAL_DIR = ".local-imports";
const LOG = "[dev-exhibition]";

// The store was created private, and a store's access mode cannot be changed
// afterwards. put() must name the same mode, and documents are read through
// the SDK rather than fetched by URL, so a saved import is never readable by
// anyone outside the password gate.
const ACCESS = "private";

function localStoreActive(): boolean {
  return chooseStore(process.env) === "local";
}

/**
 * The `token` option for every SDK call: BLOB_READ_WRITE_TOKEN (trimmed) when it
 * is set, and nothing otherwise.
 *
 * Without a `token` option the SDK tries VERCEL_OIDC_TOKEN + BLOB_STORE_ID
 * before BLOB_READ_WRITE_TOKEN (resolveBlobAuth in @vercel/blob). On an
 * opted-in local run, `vercel env pull` may have left a stale OIDC token and a
 * BLOB_STORE_ID in .env.local, which would then shadow a valid read-write token.
 * Passing the token when it is set keeps an explicit token first; leaving the
 * option out when it is not lets a deployment that has only BLOB_STORE_ID
 * authenticate with the OIDC token Vercel injects, which the SDK refreshes.
 */
function blobAuth(): { token?: string } {
  const token = readEnv(process.env, "BLOB_READ_WRITE_TOKEN");
  return token ? { token } : {};
}

/** Logs a store failure in full and returns what the routes answer it with. */
function failed(what: string, e: unknown): StorageError {
  console.error(`${LOG} ${what} failed:`, e);
  return storeFailure(e);
}

/**
 * A stored document's text as an import, or null when it is not one. A corrupt
 * document is logged and skipped, never thrown: one bad file must not take the
 * hub or the detail page down.
 */
function parseStored(text: string, label: string): StoredImport | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    value = undefined;
  }
  const doc = asStoredImport(value);
  if (!doc) console.error(`${LOG} ${label} is not a readable import; skipping it.`);
  return doc;
}

// --- local dev backend -----------------------------------------------------

async function localPaths() {
  const { join } = await import("node:path");
  const dir = join(process.cwd(), LOCAL_DIR);
  return { dir, file: (id: string) => join(dir, `${id}.json`) };
}

const isMissing = (e: unknown) => (e as NodeJS.ErrnoException | null)?.code === "ENOENT";

async function localSave(doc: StoredImport): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dir, file } = await localPaths();
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(file(doc.id), JSON.stringify(doc, null, 2), "utf-8");
  } catch (e) {
    throw failed(`writing ${LOCAL_DIR}/${doc.id}.json`, e);
  }
}

async function localGet(id: string): Promise<StoredImport | null> {
  const { readFile } = await import("node:fs/promises");
  const { file } = await localPaths();
  let text: string;
  try {
    text = await readFile(file(id), "utf-8");
  } catch (e) {
    if (isMissing(e)) return null;
    throw failed(`reading ${LOCAL_DIR}/${id}.json`, e);
  }
  return parseStored(text, `${LOCAL_DIR}/${id}.json`);
}

async function localIds(): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const { dir } = await localPaths();
  try {
    return (await readdir(dir)).filter((n) => n.endsWith(".json")).map((n) => n.replace(/\.json$/, ""));
  } catch (e) {
    if (isMissing(e)) return [];
    throw failed(`listing ${LOCAL_DIR}/`, e);
  }
}

// --- blob backend ----------------------------------------------------------

/** One stored document by pathname, or null when there is no such blob or it is not an import. */
async function readBlob(pathname: string): Promise<StoredImport | null> {
  let text: string;
  try {
    const result = await get(pathname, { access: ACCESS, ...blobAuth() });
    if (!result || result.statusCode !== 200) return null;
    text = await new Response(result.stream).text();
  } catch (e) {
    if (isNotFound(e)) return null;
    throw failed(`Blob get ${pathname}`, e);
  }
  return parseStored(text, pathname);
}

/** Every document pathname under the prefix, following the cursor to the last page. */
async function blobPathnames(): Promise<string[]> {
  const pathnames: string[] = [];
  let cursor: string | undefined;
  try {
    do {
      const page = await list({ prefix: PREFIX, cursor, ...blobAuth() });
      pathnames.push(...page.blobs.map((b) => b.pathname).filter((p) => p.endsWith(".json")));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } catch (e) {
    throw failed(`Blob list ${PREFIX}`, e);
  }
  return pathnames;
}

async function blobSave(doc: StoredImport): Promise<void> {
  const pathname = `${PREFIX}${doc.id}.json`;
  try {
    await put(pathname, JSON.stringify(doc), {
      access: ACCESS,
      contentType: "application/json",
      addRandomSuffix: false,
      ...blobAuth(),
    });
  } catch (e) {
    // The SDK has no error class for an access-mode mismatch: the API's answer
    // surfaces as a plain BlobError. So every failed put names the mode it sent,
    // which must equal the one the store was created with.
    throw failed(`Blob put ${pathname} (access: "${ACCESS}")`, e);
  }
}

// --- public API ------------------------------------------------------------

/**
 * Persists a parse result. Revalidates through the one schema first: with
 * client-side parsing, a posted document is untrusted no matter who posted it.
 * That covers the issue list too, which every hub listing reads back. A list
 * over MAX_ISSUES is truncated, not refused (issuesToStore); `droppedIssues`
 * says how many were left out, so the parser page can tell the user.
 */
export async function saveImport(map: unknown, errors: unknown): Promise<{ id: string; droppedIssues: number }> {
  const issues = validateMap(map);
  if (hasBlockingError(issues)) {
    throw new StorageError(
      `Refusing to save a malformed map: ${issues.map((i) => i.code).join(", ")}`
    );
  }
  const stored = issuesToStore(errors);
  if (!stored) {
    throw new StorageError(
      `errors must be an array of issues, each { level: "error" | "warning" | "info", code, message, object? }.`
    );
  }

  const id = newImportId();
  const doc: StoredImport = {
    id,
    savedAt: new Date().toISOString(),
    map: { ...(map as ExhibitionMap), id },
    errors: stored.issues,
  };

  await (localStoreActive() ? localSave(doc) : blobSave(doc));
  return { id, droppedIssues: stored.dropped };
}

/** The import, or null when there is none (or it is not readable). Store failures throw StorageError("unavailable"). */
export async function getImport(id: string): Promise<StoredImport | null> {
  if (!isValidImportId(id)) return null;
  return localStoreActive() ? localGet(id) : readBlob(`${PREFIX}${id}.json`);
}

/**
 * Newest first. Reads each document; fine at this scale, and there is no index
 * to corrupt. A document that cannot be read or parsed is logged and left out,
 * so one bad blob does not empty the hub.
 */
export async function listImports(): Promise<ImportSummary[]> {
  const local = localStoreActive();
  const keys = local ? await localIds() : await blobPathnames();

  const settled = await Promise.allSettled(
    keys.map(async (key) => {
      const doc = local ? await localGet(key) : await readBlob(key);
      return doc ? summarize(doc) : null;
    })
  );

  const summaries: ImportSummary[] = [];
  const failures: unknown[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      if (result.value) summaries.push(result.value);
    } else {
      // A StorageError came through failed(), which logged it in full with its
      // key where it was caught. Anything else has not been logged yet.
      if (!(result.reason instanceof StorageError)) console.error(`${LOG} reading ${keys[i]} failed:`, result.reason);
      failures.push(result.reason);
    }
  });

  // Every read failing on the store is an outage, not bad documents: report it
  // rather than show an empty hub that reads as "nothing saved yet".
  if (summaries.length === 0 && failures.length > 0 && failures.every(isUnavailable)) {
    throw failures[0];
  }

  return summaries.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
}
