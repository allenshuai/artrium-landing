import { NextResponse } from "next/server";
import { GlbFormatError, parseGlb } from "@/app/lib/dev/exhibition/parseGlb";
import { AssetFetchError, readRemoteGlbHead } from "@/app/lib/dev/exhibition/remoteGlb";
import { validateMap } from "@/app/lib/exhibition-map/schema";
import { requireDevEx } from "@/app/lib/dev/exhibition/route-helpers";

export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const denied = await requireDevEx(); if (denied) return denied;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request body.");
  }
  if (typeof body !== "object" || body === null) return bad("Invalid request body.");
  const { url, map } = body as { url?: unknown; map?: unknown };

  // Path (b): parse an asset already published to the CDN, from two range
  // requests (see remoteGlb.ts).
  if (typeof url === "string" && url.trim()) {
    try {
      return NextResponse.json(parseGlb(await readRemoteGlbHead(url.trim())));
    } catch (e) {
      // A malformed file is the caller's to fix, and its message is ours.
      if (e instanceof GlbFormatError) return bad(e.message, 422);
      // Anything else is logged in full and answered generically: fetch errors
      // can name internal hosts, and upstream text is not ours to relay.
      console.error("[dev-exhibition] parse by URL failed:", e);
      return bad(e instanceof AssetFetchError ? e.message : "Could not parse the asset.", 502);
    }
  }

  // Path (a): validate a map the browser parsed from a local file. The client
  // does the parsing, so this validation is the only gate on the document.
  if (map !== undefined) {
    return NextResponse.json({ map, errors: validateMap(map) });
  }

  return bad('Send either { url } for a published asset or { map } to validate a client-side parse.');
}
