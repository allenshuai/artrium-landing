import Link from "next/link";
import { notFound } from "next/navigation";
import IssueList from "../IssueList";
import { getImport } from "@/app/lib/dev/exhibition/storage";
import { summarize } from "@/app/lib/dev/exhibition/schema";

export const dynamic = "force-dynamic";

export default async function ImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getImport(id);
  if (!doc) notFound();

  const summary = summarize(doc);

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-mono text-2xl font-semibold">{doc.id}</h1>
        <Link href="/dev/exhibition" className="text-sm text-[#3F3A36]/60 underline underline-offset-4 hover:text-[#3F3A36]">
          Back to hub
        </Link>
      </div>

      <p className="mt-1 text-sm text-[#3F3A36]/60">
        {summary.filename ?? "unnamed source"} · saved {new Date(doc.savedAt).toLocaleString()}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 border border-[#3F3A36]/20 bg-white p-4 text-sm sm:grid-cols-4">
        {([
          ["Rooms", summary.rooms],
          ["Artworks", summary.artworks],
          ["Spawns", summary.spawns],
          ["Walls", doc.map.walls.length],
        ] as const).map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wider text-[#3F3A36]/50">{label}</dt>
            <dd className="text-lg font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-[#3F3A36]/50">Asset URL</dt>
          <dd className="break-all">{doc.map.assetUrl ?? "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-[#3F3A36]/50">Source bytes</dt>
          <dd>{doc.map.source.bytes?.toLocaleString() ?? "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-[#3F3A36]/50">Parser</dt>
          <dd>v{doc.map.parserVersion}</dd>
        </div>
      </dl>

      <IssueList title={`Issues at import (${doc.errors.length})`} issues={doc.errors} />
      {doc.errors.length === 0 && (
        <p className="mt-4 text-sm text-[#3F3A36]/60">No issues — this export satisfied the naming contract.</p>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-[#3F3A36]/50">Map JSON</h2>
      <pre className="mt-2 max-h-96 overflow-auto border border-[#3F3A36]/20 bg-white p-4 text-xs leading-relaxed">
        {JSON.stringify(doc.map, null, 2)}
      </pre>
    </main>
  );
}
