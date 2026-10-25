import assert from "node:assert/strict";
import test from "node:test";

import { BlobAccessError, BlobError, BlobNotFoundError, BlobServiceNotAvailable, BlobStoreSuspendedError } from "@vercel/blob";

import {
  blobConfigured,
  chooseStore,
  isNotFound,
  isUnavailable,
  readEnv,
  StorageError,
  storeFailure,
} from "./storeConfig";
import { asStoredImport } from "./imports";

// Every case passes its own environment, so nothing here reads or mutates the
// real process.env.

/** What `next dev` sees after `vercel env pull` wrote the project's variables into .env.local. */
const PULLED = {
  NODE_ENV: "development",
  VERCEL: "1",
  VERCEL_ENV: "development",
  VERCEL_OIDC_TOKEN: "eyJ.pulled.token",
  BLOB_STORE_ID: "store_abc123",
};

/** A deployed function with a connected store. */
const DEPLOYED = { NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production", BLOB_STORE_ID: "store_abc123" };

function unavailable(fn: () => unknown, label: string) {
  assert.throws(fn, (e: unknown) => {
    assert.ok(isUnavailable(e), `${label}: expected StorageError("unavailable"), got ${String(e)}`);
    return true;
  });
}

test("env values are trimmed and a blank one is unset, as the Blob SDK reads them", () => {
  assert.equal(readEnv({ X: "  store_abc  " }, "X"), "store_abc");
  assert.equal(readEnv({ X: "   " }, "X"), undefined);
  assert.equal(readEnv({ X: "" }, "X"), undefined);
  assert.equal(readEnv({}, "X"), undefined);

  assert.equal(blobConfigured({ BLOB_STORE_ID: " \n" }), false);
  assert.equal(blobConfigured({ BLOB_STORE_ID: " ", BLOB_READ_WRITE_TOKEN: "\t" }), false);
  assert.equal(blobConfigured({ BLOB_STORE_ID: " store_abc " }), true);
  assert.equal(blobConfigured({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_abc_xyz" }), true);
});

test("next dev keeps .local-imports/ even with pulled Vercel variables", () => {
  assert.equal(chooseStore({ NODE_ENV: "development" }), "local");
  assert.equal(chooseStore(PULLED), "local");
  assert.equal(chooseStore({ ...PULLED, BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_abc_xyz" }), "local");
  // Only an explicit "1" opts in.
  for (const flag of ["0", "true", "yes", "", " "]) {
    assert.equal(chooseStore({ ...PULLED, DEV_EXHIBITION_USE_BLOB: flag }), "local", `flag ${JSON.stringify(flag)}`);
  }
});

test("DEV_EXHIBITION_USE_BLOB=1 opts a local run into the Blob store, and needs credentials", () => {
  assert.equal(chooseStore({ ...PULLED, DEV_EXHIBITION_USE_BLOB: "1" }), "blob");
  assert.equal(chooseStore({ NODE_ENV: "development", DEV_EXHIBITION_USE_BLOB: " 1 ", BLOB_READ_WRITE_TOKEN: "rw" }), "blob");
  unavailable(() => chooseStore({ NODE_ENV: "development", DEV_EXHIBITION_USE_BLOB: "1" }), "opted in, no store");
  unavailable(
    () => chooseStore({ NODE_ENV: "development", DEV_EXHIBITION_USE_BLOB: "1", BLOB_STORE_ID: "  " }),
    "opted in, blank store id"
  );
});

test("a Vercel deployment uses the Blob store, and throws without one as before", () => {
  assert.equal(chooseStore(DEPLOYED), "blob");
  assert.equal(chooseStore({ ...DEPLOYED, VERCEL_ENV: "preview" }), "blob");
  assert.equal(
    chooseStore({ NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production", BLOB_READ_WRITE_TOKEN: "rw" }),
    "blob"
  );
  unavailable(() => chooseStore({ NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production" }), "no store");
  unavailable(() => chooseStore({ ...DEPLOYED, BLOB_STORE_ID: "   " }), "blank store id");
});

test("a production build off Vercel has no default store", () => {
  // `next start` on a laptop, with or without pulled variables.
  unavailable(() => chooseStore({ NODE_ENV: "production" }), "bare next start");
  unavailable(() => chooseStore({ ...PULLED, NODE_ENV: "production" }), "next start after env pull");
  unavailable(() => chooseStore({ NODE_ENV: "production", BLOB_READ_WRITE_TOKEN: "rw" }), "token, no opt-in");
  assert.equal(chooseStore({ NODE_ENV: "production", BLOB_READ_WRITE_TOKEN: "rw", DEV_EXHIBITION_USE_BLOB: "1" }), "blob");
});

test("every store failure but a 404 becomes a 503 with a fixed message", () => {
  const sdkErrors: unknown[] = [
    new BlobAccessError(),
    new BlobStoreSuspendedError(),
    new BlobServiceNotAvailable(),
    new BlobError("Failed to fetch blob: 403 Forbidden"),
    new BlobError(
      "No blob credentials found. Pass a `token` option, set `BLOB_READ_WRITE_TOKEN`, or use `oidcToken` (or `VERCEL_OIDC_TOKEN`) with `storeId` or `BLOB_STORE_ID`."
    ),
    new TypeError("fetch failed"),
    "a thrown string",
  ];
  const messages = new Set<string>();
  for (const e of sdkErrors) {
    const failure = storeFailure(e);
    assert.ok(failure instanceof StorageError && failure.kind === "unavailable", String(e));
    assert.equal(failure.cause, e, "the original rides on cause, for the log");
    assert.ok(!/token|BLOB_|403|fetch failed/i.test(failure.message), `leaks SDK text: ${failure.message}`);
    messages.add(failure.message);
  }
  assert.equal(messages.size, 1, "one safe message for every store failure");

  // A StorageError already says what happened.
  const invalid = new StorageError("Refusing to save a malformed map: map.bounds");
  assert.equal(storeFailure(invalid), invalid);

  assert.equal(isNotFound(new BlobNotFoundError()), true);
  assert.equal(isNotFound(new BlobError("Failed to fetch blob: 404 Not Found")), false);
  assert.equal(isNotFound(new Error("not found")), false);
});

test("a stored document is read back only when it has the shape the hub and detail page use", () => {
  const map = { source: { filename: "a.glb" }, rooms: [], artworks: [], spawns: [], walls: [] };
  const doc = { id: "abcdef1234567890", savedAt: "2026-09-23T00:00:00.000Z", map, errors: [] };

  assert.deepEqual(asStoredImport(doc), doc);
  assert.deepEqual(asStoredImport({ ...doc, errors: "oops" })?.errors, [], "a non-array issue list reads as empty");
  assert.deepEqual(asStoredImport({ ...doc, errors: undefined })?.errors, []);

  for (const bad of [
    null,
    "{}",
    [],
    { ...doc, id: 7 },
    { ...doc, savedAt: undefined },
    { ...doc, map: null },
    { ...doc, map: { ...map, source: null } },
    { ...doc, map: { ...map, rooms: {} } },
    { ...doc, map: { ...map, walls: undefined } },
  ]) {
    assert.equal(asStoredImport(bad), null, JSON.stringify(bad));
  }
});
