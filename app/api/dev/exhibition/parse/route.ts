import { NextResponse } from "next/server";
import { GALLERY_MODEL_URL } from "@/app/lib/gallery-config";
import { glbJsonChunkRange, GlbFormatError, parseGlb } from "@/app/lib/dev/exhibition/parseGlb";
import { validateMap, type ParseResult } from "@/app/lib/dev/exhibition/schema";

export const dynamic = "force-dynamic";

// A GLB's JSON chunk is tens of KiB in practice (19.9 KiB for the live 244.5 MB
// asset). This cap keeps a hostile or corrupt header from making us allocate.
const MAX_JSON_CHUNK = 32 * 1024 * 1024;

/** Only assets we publish. Prevents this route being used to fetch arbitrary URLs. */
function allowedHosts(): Set<string> {
  const hosts = new Set(["assets.artrium.space"]);
  try {
    hosts.add(new URL(GALLERY_MODEL_URL).host);
  } catch {
    // GALLERY_MODEL_URL misconfigured; the default host above still applies.
  }
  return hosts;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function range(url: string, from: number, to: number): Promise<Response> {
  return fetch(url, { headers: { Range: `bytes=${from}-${to}` }, cache: "no-store" });
}

/**
 * Reads only the header and JSON chunk of a published GLB. Two small range
 * requests, never the whole asset — the live exhibition is 244.5 MB and would
 * blow the function's memory and time budget.
 */
async function parseByUrl(rawUrl: string): Promise<ParseResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new GlbFormatError("Not a valid URL.");
  }
  if (url.protocol !== "https:") throw new GlbFormatError("Asset URL must be https.");
  if (!allowedHosts().has(url.host)) {
    throw new GlbFormatError(
      `Host "${url.host}" is not an Artrium asset host. Allowed: ${[...allowedHosts()].join(", ")}.`
    );
  }

  const head = await range(url.toString(), 0, 19);
  if (head.status !== 206) {
    // A 200 means the host ignored Range and is about to stream the entire file.
    throw new GlbFormatError(
      `Asset host does not support range requests (status ${head.status}); refusing to download the whole file.`
    );
  }

  const totalBytes = Number(head.headers.get("content-range")?.split("/")[1]) || null;
  const { length } = glbJsonChunkRange(await head.arrayBuffer());
  if (length > MAX_JSON_CHUNK) {
    throw new GlbFormatError(`JSON chunk of ${length} bytes exceeds the ${MAX_JSON_CHUNK} byte cap.`);
  }

  const body = await range(url.toString(), 0, 19 + length);
  if (!body.ok) throw new GlbFormatError(`Could not read the JSON chunk (status ${body.status}).`);

  return parseGlb({
    bytes: await body.arrayBuffer(),
    filename: decodeURIComponent(url.pathname.split("/").pop() ?? "") || null,
    url: url.toString(),
    totalBytes,
  });
}

export async function POST(req: Request) {
  let body: { url?: unknown; map?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request body.");
  }

  // Path (b): parse an asset already published to the CDN.
  if (typeof body.url === "string" && body.url) {
    try {
      const result = await parseByUrl(body.url);
      return NextResponse.json(result);
    } catch (e) {
      if (e instanceof GlbFormatError) return bad(e.message, 422);
      return bad(e instanceof Error ? e.message : "Could not fetch the asset.", 502);
    }
  }

  // Path (a): validate a map the browser parsed from a local file. The client
  // does the parsing, so this validation is the only gate on the document.
  if (body.map !== undefined) {
    const errors = validateMap(body.map);
    return NextResponse.json({ map: body.map, errors });
  }

  return bad('Send either { url } for a published asset or { map } to validate a client-side parse.');
}
