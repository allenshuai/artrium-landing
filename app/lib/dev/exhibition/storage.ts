import "server-only";

import { get, list, put } from "@vercel/blob";
import {
  hasBlockingError,
  isIssueList,
  MAX_ISSUES,
  validateMap,
  type ExhibitionMap,
} from "../../exhibition-map/schema";
import {
  asStoredImport,
  isValidImportId,
  newImportId,
  summarize,
  type ImportSummary,
  type StoredImport,
} from "./imports";
import { chooseStore, isNotFound, isUnavailable, StorageError, storeFailure } from "./storeConfig";

export { isUnavailable, StorageError, type StorageFailure } from "./storeConfig";

// Vercel Blob is the production store. The repo filesystem is not an option:
// it is read-only on Vercel apart from an ephemeral per-invocation /tmp, so
// writing JSON under content/ would pass in `next dev` and fail in production.
//
// `next dev` uses a local directory instead, so the portal is testable offline
// and a local session never writes to the store the deployed portal reads.
// Which one applies, and when a missing store throws, is chooseStore's call
// (storeConfig.ts).
//
// Credentials are left to the SDK: with no `token` option it resolves
// VERCEL_OIDC_TOKEN + BLOB_STORE_ID, then BLOB_READ_WRITE_TOKEN, trimming both
// and ignoring blanks (resolveBlobAuth / readEnv in @vercel/blob).

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
    const result = await get(pathname, { access: ACCESS });
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
      const page = await list({ prefix: PREFIX, cursor });
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
 * That covers the issue list too, which every hub listing reads back.
 */
export async function saveImport(map: unknown, errors: unknown): Promise<string> {
  const issues = validateMap(map);
  if (hasBlockingError(issues)) {
    throw new StorageError(
      `Refusing to save a malformed map: ${issues.map((i) => i.code).join(", ")}`
    );
  }
  if (!isIssueList(errors)) {
    throw new StorageError(
      `errors must be an array of at most ${MAX_ISSUES} issues, each { level: "error" | "warning", code, message, object? }.`
    );
  }

  const id = newImportId();
  const doc: StoredImport = {
    id,
    savedAt: new Date().toISOString(),
    map: { ...(map as ExhibitionMap), id },
    // Only the ParseIssue fields are kept, so the list cannot carry anything else.
    errors: errors.map(({ level, code, message, object }) =>
      object === undefined ? { level, code, message } : { level, code, message, object }
    ),
  };

  await (localStoreActive() ? localSave(doc) : blobSave(doc));
  return id;
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
      // A store failure was already logged in full where it was caught.
      const reason = result.reason instanceof StorageError ? result.reason.message : result.reason;
      console.error(`${LOG} skipping ${keys[i]}:`, reason);
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
