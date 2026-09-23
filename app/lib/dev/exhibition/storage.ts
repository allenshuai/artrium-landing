import "server-only";

import { list, put } from "@vercel/blob";
import {
  hasBlockingError,
  isValidImportId,
  newImportId,
  summarize,
  validateMap,
  type ExhibitionMap,
  type ImportSummary,
  type ParseIssue,
  type StoredImport,
} from "./schema";

// Vercel Blob is the production store. The repo filesystem is not an option:
// it is read-only on Vercel apart from an ephemeral per-invocation /tmp, so
// writing JSON under content/ would pass in `next dev` and fail in production.
//
// Without a Blob token, `next dev` falls back to a local directory so the portal
// is testable offline. Production without a token throws rather than silently
// accepting writes that go nowhere.

const PREFIX = "dev-exhibition-imports/";
const LOCAL_DIR = ".local-imports";

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

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN || undefined;
}

function localStoreActive(): boolean {
  if (blobToken()) return false;
  if (process.env.NODE_ENV === "production") {
    throw new StorageError(
      "BLOB_READ_WRITE_TOKEN is not set. Add a Vercel Blob store to this project and set the token; imports cannot be persisted without it.",
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

async function blobGet(id: string): Promise<StoredImport | null> {
  const { blobs } = await list({ prefix: `${PREFIX}${id}.json`, token: blobToken(), limit: 1 });
  const blob = blobs[0];
  if (!blob) return null;
  const res = await fetch(blob.url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as StoredImport;
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
    access: "public",
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
    const fetched = await Promise.all(
      blobs.map(async (b) => {
        const res = await fetch(b.url, { cache: "no-store" });
        return res.ok ? ((await res.json()) as StoredImport) : null;
      })
    );
    docs = fetched.filter((d): d is StoredImport => d !== null);
  }

  return docs
    .map(summarize)
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
}
