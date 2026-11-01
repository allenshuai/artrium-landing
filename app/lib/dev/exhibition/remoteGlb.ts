// Reads the header and JSON chunk of a GLB already published to the CDN.
//
// Kept apart from the parse route, and handed its fetch, so the network rules
// can be tested without a network: two small range requests, both answered 206,
// no redirects followed, and exactly the bytes asked for: never more than the JSON
// chunk needs, and fewer only where the file itself ends. The live
// exhibition is 244.5 MB, and downloading it would blow the function's memory and
// time budget.

import { ASSET_ORIGIN, isAssetUrl } from "../../exhibition-map/schema";
import { glbJsonChunkRange, GlbFormatError } from "./parseGlb";

/**
 * A GLB's JSON chunk is tens of KiB in practice (19.9 KiB for the live 244.5 MB
 * asset). This cap keeps a hostile or corrupt header from making us allocate.
 */
export const MAX_JSON_CHUNK = 32 * 1024 * 1024;

const HEADER_BYTES = 20;

/**
 * The asset host did not give us what we asked for: a redirect, a network
 * failure, an answer other than 206, or more or fewer bytes than requested. The message
 * is always ours and carries at most a status code; the underlying error rides
 * on `cause` for the server log and is never sent to the client.
 */
export class AssetFetchError extends Error {}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type RemoteGlbHead = {
  /** Header plus complete JSON chunk, ready for parseGlb. */
  bytes: ArrayBuffer;
  url: string;
  filename: string | null;
  /** Full asset size from Content-Range, when the host reports one. */
  totalBytes: number | null;
};

function checkedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new GlbFormatError("Not a valid URL.");
  }
  if (url.protocol !== "https:") throw new GlbFormatError("Asset URL must be https.");
  // Only the host we publish to, by the same rule the map's URL fields follow,
  // so this route cannot be pointed at arbitrary URLs. Checked on the normalised
  // href, which also refuses a port or credentials.
  if (!isAssetUrl(url.href)) {
    throw new GlbFormatError(`Only ${ASSET_ORIGIN}/… URLs can be parsed.`);
  }
  return url;
}

/**
 * True when Content-Range says the file ends after `length` bytes from `from`:
 * `bytes <from>-<from + length - 1>/<from + length>`. That is the one honest
 * short 206, for a range that runs past the end of the file.
 */
function reachesEndOfFile(contentRange: string | null, from: number, length: number): boolean {
  const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange?.trim() ?? "");
  if (!m || length === 0) return false;
  const [start, end, total] = m.slice(1).map(Number);
  return start === from && end === from + length - 1 && total === end + 1;
}

/**
 * Reads a 206 body of exactly `max` bytes, refusing to buffer more whatever the
 * headers claim.
 *
 * Fewer is the host's failure too (an empty or cut-off body), not a malformed
 * file, so it is not left for the format checks to report as the caller's 422.
 * The exception is a range that runs past the end of the file, which
 * Content-Range then says: those bytes are the whole file, and a GLB that short
 * is the file's problem, reported as truncated.
 */
async function readExactly(res: Response, from: number, max: number): Promise<ArrayBuffer> {
  const declared = Number(res.headers.get("content-length"));
  if (declared > max) {
    await res.body?.cancel();
    throw new AssetFetchError("Asset host sent more bytes than were requested.");
  }
  if (!res.body) throw new AssetFetchError("Asset host sent fewer bytes than were requested.");

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new AssetFetchError("Asset host sent more bytes than were requested.");
    }
    chunks.push(value);
  }

  if (size < max && !reachesEndOfFile(res.headers.get("content-range"), from, size)) {
    throw new AssetFetchError("Asset host sent fewer bytes than were requested.");
  }

  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out.buffer;
}

async function range(
  fetchImpl: FetchLike,
  url: string,
  from: number,
  to: number
): Promise<{ bytes: ArrayBuffer; contentRange: string | null }> {
  let res: Response;
  try {
    // redirect: "error" because the allowlist only checked the URL we were
    // given. A redirect served by the CDN would otherwise send this request,
    // Range header and all, to whatever host it named.
    res = await fetchImpl(url, {
      headers: { Range: `bytes=${from}-${to}` },
      cache: "no-store",
      redirect: "error",
    });
  } catch (e) {
    // DNS, TLS, connection and redirect failures all land here. Their text can
    // name internal hosts and addresses, so it stays on `cause`.
    throw new AssetFetchError("Could not read from the asset host.", { cause: e });
  }

  // Checked on both requests: a 200 means the host ignored Range and is about to
  // stream the entire file.
  if (res.status !== 206) {
    await res.body?.cancel();
    throw new AssetFetchError(
      res.status === 200
        ? "Asset host ignored the Range header (status 200); refusing to download the whole file."
        : `Asset host answered ${res.status}; expected 206 Partial Content.`
    );
  }

  return { bytes: await readExactly(res, from, to - from + 1), contentRange: res.headers.get("content-range") };
}

function totalFrom(contentRange: string | null): number | null {
  const total = Number(contentRange?.split("/")[1]);
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

function filenameOf(url: URL): string | null {
  const last = url.pathname.split("/").pop() ?? "";
  try {
    return decodeURIComponent(last) || null;
  } catch {
    // A malformed %-escape is still a usable label.
    return last || null;
  }
}

/** Reads only the header and JSON chunk of a published GLB, in two range requests. */
export async function readRemoteGlbHead(rawUrl: string, fetchImpl: FetchLike = fetch): Promise<RemoteGlbHead> {
  const url = checkedUrl(rawUrl);
  const href = url.toString();

  const head = await range(fetchImpl, href, 0, HEADER_BYTES - 1);
  const { length } = glbJsonChunkRange(head.bytes);
  if (length > MAX_JSON_CHUNK) {
    throw new GlbFormatError(`JSON chunk of ${length} bytes exceeds the ${MAX_JSON_CHUNK} byte cap.`);
  }

  const body = await range(fetchImpl, href, 0, HEADER_BYTES - 1 + length);
  return { bytes: body.bytes, url: href, filename: filenameOf(url), totalBytes: totalFrom(head.contentRange) };
}
