import { NextResponse } from "next/server";
import { isUnavailable, listImports, saveImport, StorageError } from "@/app/lib/dev/exhibition/storage";
import type { ParseIssue } from "@/app/lib/exhibition-map/schema";
import { requireDevEx } from "@/app/lib/dev/exhibition/route-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireDevEx(); if (denied) return denied;
  try {
    return NextResponse.json({ imports: await listImports() });
  } catch (e) {
    if (isUnavailable(e)) return NextResponse.json({ error: (e as StorageError).message }, { status: 503 });
    return NextResponse.json({ error: "Could not list imports." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = await requireDevEx(); if (denied) return denied;
  let body: { map?: unknown; errors?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.map === undefined) {
    return NextResponse.json({ error: "Send { map, errors } from a parse." }, { status: 400 });
  }

  // Warnings are expected on a partial import and must not block saving; the
  // blocking check lives in saveImport, against the one schema.
  const errors = Array.isArray(body.errors) ? (body.errors as ParseIssue[]) : [];

  try {
    return NextResponse.json({ id: await saveImport(body.map, errors) }, { status: 201 });
  } catch (e) {
    // A misconfigured store is not the caller's fault, so it must not look like
    // a rejected document.
    if (isUnavailable(e)) return NextResponse.json({ error: (e as StorageError).message }, { status: 503 });
    if (e instanceof StorageError) return NextResponse.json({ error: e.message }, { status: 422 });
    return NextResponse.json({ error: "Could not save the import." }, { status: 500 });
  }
}
