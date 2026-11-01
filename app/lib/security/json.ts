// Reading a JSON request body safely. Depends on next/server only, so any
// route can use it without pulling in a portal's modules.

import { NextResponse } from "next/server";

/** A JSON body the routes can read fields from: an object, not null, an array or a scalar. */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * The request's JSON body when it is an object, otherwise a 400 to return
 * as-is. A body of null, an array or a scalar would otherwise throw on the first
 * field read, outside any try, and surface as a 500.
 */
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  if (isPlainObject(body)) return body;
  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
