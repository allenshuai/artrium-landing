import "server-only";

import { get, list, put } from "@vercel/blob";
import {
  hasBlockingError,
  validateMap,
  type ExhibitionMap,
  type ParseIssue,
} from "../../exhibition-map/schema";
import {
  isValidImportId,
  newImportId,
  summarize,
  type ImportSummary,
  type StoredImport,
} from "./imports";

// Vercel Blob is the production store. The repo filesystem is not an option:
// it is read-only on Vercel apart from an ephemeral per-invocation /tmp, so
// writing JSON under content/ would pass in `next dev` and fail in production.
//
// Without a connected store, `next dev` falls back to a local directory so the
// portal is testable offline. Production without one throws rather than silently
// accepting writes that go nowhere.

const PREFIX = "dev-exhibition-imports/";
const LOCAL_DIR = ".local-imports";

// The store was created private, and a store's access mode cannot be changed
// afterwards. put() must name the same mode, and documents are read through
// the SDK rather than fetched by URL, so a saved import is never readable by
// anyone outside the password gate.
const ACCESS = "private";

/**
 * `invalid` = the submitted document cannot be stored (the caller's problem).
 * `unavailable` = the store is unconfigured or down (not the caller's problem).
 *
 * One class with an explicit kind rather than two classes: the routes need to
 * tell these apart to pick 503 vs 422, and a discriminant field says so at the
 * throw site instead of encoding it in a type hierarchy.
 */
export type StorageFailure = "invalid" | "unavailable";

export class StorageError extends Error {
  readonly kind: StorageFailure;
  constructor(message: string, kind: StorageFailure = "invalid") {
    super(message);
    this.name = "StorageError";
    this.kind = kind;
  }
}

export function isUnavailable(e: unknown): boolean {
  return e instanceof StorageError && e.kind === "unavailable";
}

/**
 * An explicit long-lived token, or undefined so the SDK resolves credentials
 * itself. On Vercel that is OIDC: connecting a store sets BLOB_STORE_ID, and the
 * platform injects a short-lived VERCEL_OIDC_TOKEN at runtime that the SDK reads
 * and refreshes. BLOB_READ_WRITE_TOKEN is only for code running outside Vercel.
 */
function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN || undefined;
}

function blobConfigured(): boolean {
  return Boolean(blobToken() || process.env.BLOB_STORE_ID);
}

function localStoreActive(): boolean {
  if (blobConfigured()) return false;
  if (process.env.NODE_ENV === "production") {
    throw new StorageError(
      "No Blob store is connected: neither BLOB_STORE_ID (set when a Vercel Blob store is connected to this project) nor BLOB_READ_WRITE_TOKEN is present. Connect a store and redeploy; imports cannot be persisted without it.",
      "unavailable"
    );
  }
  return true;
}

// --- local dev backend -----------------------------------------------------

async function localPaths() {
  const { join } = await import("node:path");
  const dir = join(process.cwd(), LOCAL_DIR);
  return { dir, file: (id: string) => join(dir, `${id}.json`) };
}

async function localSave(doc: StoredImport): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dir, file } = await localPaths();
  await mkdir(dir, { recursive: true });
  await writeFile(file(doc.id), JSON.stringify(doc, null, 2), "utf-8");
}

async function localGet(id: string): Promise<StoredImport | null> {
  const { readFile } = await import("node:fs/promises");
  const { file } = await localPaths();
  try {
    return JSON.parse(await readFile(file(id), "utf-8")) as StoredImport;
  } catch {
    return null;
  }
}

async function localList(): Promise<StoredImport[]> {
  const { readdir } = await import("node:fs/promises");
  const { dir } = await localPaths();
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const docs = await Promise.all(
    names.filter((n) => n.endsWith(".json")).map((n) => localGet(n.replace(/\.json$/, "")))
  );
  return docs.filter((d): d is StoredImport => d !== null);
}

// --- blob backend ----------------------------------------------------------

/** One stored document by pathname, or null when there is no such blob. */
async function readBlob(pathname: string): Promise<StoredImport | null> {
  const result = await get(pathname, { access: ACCESS, token: blobToken() });
  if (!result || result.statusCode !== 200) return null;
  return (await new Response(result.stream).json()) as StoredImport;
}

async function blobGet(id: string): Promise<StoredImport | null> {
  return readBlob(`${PREFIX}${id}.json`);
}

// --- public API ------------------------------------------------------------

/**
 * Persists a parse result. Revalidates through the one schema first: with
 * client-side parsing, a posted document is untrusted no matter who posted it.
 */
export async function saveImport(map: unknown, errors: ParseIssue[]): Promise<string> {
  const issues = validateMap(map);
  if (hasBlockingError(issues)) {
    throw new StorageError(
      `Refusing to save a malformed map: ${issues.map((i) => i.code).join(", ")}`
    );
  }

  const id = newImportId();
  const doc: StoredImport = {
    id,
    savedAt: new Date().toISOString(),
    map: { ...(map as ExhibitionMap), id },
    errors,
  };

  if (localStoreActive()) {
    await localSave(doc);
    return id;
  }

  await put(`${PREFIX}${id}.json`, JSON.stringify(doc), {
    access: ACCESS,
    contentType: "application/json",
    token: blobToken(),
    addRandomSuffix: false,
  });
  return id;
}

export async function getImport(id: string): Promise<StoredImport | null> {
  if (!isValidImportId(id)) return null;
  return localStoreActive() ? localGet(id) : blobGet(id);
}

/** Newest first. Reads each document; fine at this scale, and there is no index to corrupt. */
export async function listImports(): Promise<ImportSummary[]> {
  let docs: StoredImport[];

  if (localStoreActive()) {
    docs = await localList();
  } else {
    const { blobs } = await list({ prefix: PREFIX, token: blobToken() });
    const fetched = await Promise.all(blobs.map((b) => readBlob(b.pathname)));
    docs = fetched.filter((d): d is StoredImport => d !== null);
  }

  return docs
    .map(summarize)
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
}
