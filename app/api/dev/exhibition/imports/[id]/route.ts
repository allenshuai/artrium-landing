import { NextResponse } from "next/server";
import { getImport, isUnavailable, type StorageError } from "@/app/lib/dev/exhibition/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const doc = await getImport(id);
    if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(doc);
  } catch (e) {
    if (isUnavailable(e)) return NextResponse.json({ error: (e as StorageError).message }, { status: 503 });
    return NextResponse.json({ error: "Could not read the import." }, { status: 500 });
  }
}
