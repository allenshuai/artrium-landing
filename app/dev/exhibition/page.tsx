"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GALLERY_ROUTE_SLUG } from "@/app/lib/gallery-config";
import type { ImportSummary } from "@/app/lib/dev/exhibition/schema";

export default function DevExhibitionHub() {
  const [busy, setBusy] = useState(false);
  const [imports, setImports] = useState<ImportSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dev/exhibition/imports")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
        setImports(data.imports as ImportSummary[]);
      })
      .catch((e: Error) => setListError(e.message));
  }, []);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/dev/exhibition/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/dev/exhibition/login";
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Exhibition Dev</h1>
        <button
          onClick={logout}
          disabled={busy}
          className="text-sm text-[#3F3A36]/60 underline underline-offset-4 hover:text-[#3F3A36] disabled:opacity-50"
        >
          Log out
        </button>
      </div>

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#3F3A36]/50">Tools</h2>
        <ul className="mt-3 border border-[#3F3A36]/20 bg-white">
          <li className="border-b border-[#3F3A36]/10 px-4 py-3">
            <Link href="/dev/exhibition/parser" className="font-medium underline underline-offset-4">
              GLB parser
            </Link>
            <p className="mt-0.5 text-sm text-[#3F3A36]/60">
              Parse an exhibition .glb in the browser, or by CDN URL, and preview the extracted map JSON.
            </p>
          </li>
          <li className="px-4 py-3">
            <Link href={`/exhibition/${GALLERY_ROUTE_SLUG}`} className="font-medium underline underline-offset-4">
              Visitor gallery
            </Link>
            <p className="mt-0.5 text-sm text-[#3F3A36]/60">The live 3D exhibition this tooling feeds.</p>
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#3F3A36]/50">Recent imports</h2>

        {listError && (
          <p className="mt-3 border-l-2 border-[#C0392B] pl-3 text-sm text-[#C0392B]">{listError}</p>
        )}

        {!listError && imports === null && (
          <p className="mt-3 text-sm text-[#3F3A36]/50">Loading…</p>
        )}

        {imports?.length === 0 && (
          <p className="mt-3 border border-dashed border-[#3F3A36]/25 px-4 py-6 text-sm text-[#3F3A36]/50">
            Nothing saved yet. Parse a .glb, then save it.
          </p>
        )}

        {imports && imports.length > 0 && (
          <ul className="mt-3 border border-[#3F3A36]/20 bg-white">
            {imports.map((item) => (
              <li key={item.id} className="border-b border-[#3F3A36]/10 px-4 py-3 last:border-b-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <Link href={`/dev/exhibition/${item.id}`} className="font-mono text-sm underline underline-offset-4">
                    {item.id}
                  </Link>
                  <span className="text-xs text-[#3F3A36]/50">{new Date(item.savedAt).toLocaleString()}</span>
                </div>
                <p className="mt-0.5 text-sm text-[#3F3A36]/60">
                  {item.filename ?? "unnamed source"} · {item.rooms} rooms · {item.artworks} artworks · {item.spawns} spawns
                  {item.errorCount > 0 && <span className="text-[#C0392B]"> · {item.errorCount} errors</span>}
                  {item.warningCount > 0 && <span className="text-[#D98C1F]"> · {item.warningCount} warnings</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
