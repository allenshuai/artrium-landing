"use client";

import Link from "next/link";
import { useState } from "react";
import { GALLERY_ROUTE_SLUG } from "@/app/lib/gallery-config";

export default function DevExhibitionHub() {
  const [busy, setBusy] = useState(false);

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
        <p className="mt-3 border border-dashed border-[#3F3A36]/25 px-4 py-6 text-sm text-[#3F3A36]/50">
          Saved imports appear here once persistence lands (M3).
        </p>
      </section>
    </main>
  );
}
