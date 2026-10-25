// Which store saved imports go to, and how its failures are reported. The pure
// half of storage.ts: no `server-only` and no I/O, so `npm test` can load it.

import { BlobNotFoundError } from "@vercel/blob";

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
  constructor(message: string, kind: StorageFailure = "invalid", options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageError";
    this.kind = kind;
  }
}

export function isUnavailable(e: unknown): boolean {
  return e instanceof StorageError && e.kind === "unavailable";
}

type Env = Record<string, string | undefined>;

/**
 * An environment value, trimmed, with whitespace-only treated as unset. This is
 * the rule @vercel/blob's own readEnv applies to BLOB_STORE_ID and
 * BLOB_READ_WRITE_TOKEN, so "configured" here means what the SDK will see.
 */
export function readEnv(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

/**
 * Either credential the SDK can authenticate with. On Vercel, connecting a store
 * sets BLOB_STORE_ID and the platform injects a short-lived VERCEL_OIDC_TOKEN,
 * which the SDK reads and refreshes itself; BLOB_READ_WRITE_TOKEN is for code
 * running outside Vercel.
 */
export function blobConfigured(env: Env): boolean {
  return Boolean(readEnv(env, "BLOB_STORE_ID") || readEnv(env, "BLOB_READ_WRITE_TOKEN"));
}

/**
 * A deployed Vercel function. VERCEL alone does not say so: `vercel env pull`
 * can write VERCEL="1", with VERCEL_ENV="development", into .env.local, which
 * `next dev` loads. A deployment is always a production build.
 */
function onVercelDeployment(env: Env): boolean {
  return env.VERCEL === "1" && env.NODE_ENV === "production" && env.VERCEL_ENV !== "development";
}

const NO_STORE =
  "No Blob store is connected: neither BLOB_STORE_ID (set when a Vercel Blob store is connected to this project) nor BLOB_READ_WRITE_TOKEN is present. Connect a store and redeploy; imports cannot be persisted without it.";

const PRODUCTION_OFF_VERCEL =
  "This production build is not running on Vercel, so it has no import store. Set DEV_EXHIBITION_USE_BLOB=1 with BLOB_READ_WRITE_TOKEN to use the Blob store.";

export type StoreChoice = "blob" | "local";

/**
 * The Blob store on a Vercel deployment, or anywhere DEV_EXHIBITION_USE_BLOB=1
 * asks for it. Otherwise `next dev` uses the gitignored .local-imports/, even
 * when `vercel env pull` has put BLOB_STORE_ID and an OIDC token in .env.local:
 * a local session must not write to the store the deployed portal reads.
 *
 * Throws StorageError("unavailable") when the Blob store is wanted but has no
 * credentials, and for a production build off Vercel without the opt-in, rather
 * than silently accepting writes that go nowhere.
 */
export function chooseStore(env: Env): StoreChoice {
  if (readEnv(env, "DEV_EXHIBITION_USE_BLOB") === "1" || onVercelDeployment(env)) {
    if (blobConfigured(env)) return "blob";
    throw new StorageError(NO_STORE, "unavailable");
  }
  if (env.NODE_ENV === "production") throw new StorageError(PRODUCTION_OFF_VERCEL, "unavailable");
  return "local";
}

/** A Blob SDK 404. get() answers a missing blob with null instead, so this is the rarer path. */
export function isNotFound(e: unknown): boolean {
  return e instanceof BlobNotFoundError;
}

const UNAVAILABLE =
  "The import store could not be reached or refused the request. Try again; if it keeps failing, the cause is in the server log.";

/**
 * Anything a store call threw, as the StorageError a route answers 503 with.
 *
 * The SDK throws BlobError for a 403, a suspended or missing store, a 5xx after
 * its retries, and "No blob credentials found"; fetch throws TypeError for a
 * network failure. None of it is the caller's fault, and its text (store ids,
 * credential hints) is not for the client, so the message is fixed and the
 * original rides on `cause` for the log. A StorageError passes through as is.
 */
export function storeFailure(e: unknown): StorageError {
  if (e instanceof StorageError) return e;
  return new StorageError(UNAVAILABLE, "unavailable", { cause: e });
}
