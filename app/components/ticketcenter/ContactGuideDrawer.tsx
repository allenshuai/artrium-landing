"use client";

import { useEffect, useState } from "react";
import { splitGuideBody, type ContactGuide } from "@/app/lib/ticketcenter/outreach";

// Module-level cache so reopening the drawer is instant; the server caches too.
let cached: ContactGuide | null = null;

/** Read-only slide-in showing the Contact Guide tab (who we are, what we offer, how to pitch). */
export default function ContactGuideDrawer({ onClose }: { onClose: () => void }) {
  const [guide, setGuide] = useState<ContactGuide | null>(cached);
  const [error, setError] = useState("");

  useEffect(() => {
    if (cached) return;
    let alive = true;
    fetch("/api/ticketcenter/outreach/guide")
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/ticketcenter/login";
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not load the guide");
        cached = data as ContactGuide;
        if (alive) setGuide(cached);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not load the guide");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[#3F3A36]/30" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-[55] flex w-full max-w-xl flex-col overflow-y-auto border-l border-[#3F3A36]/25 bg-[#FFFAF6] p-6 shadow-[-6px_0_0_rgba(63,58,54,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs text-[#3F3A36]/50">Outreach reference</span>
            <h2 className="mt-0.5 text-lg font-semibold leading-snug">Contact Guide</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="border border-[#3F3A36]/25 px-2.5 py-1 text-sm hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
          >
            ✕
          </button>
        </div>

        {guide && (
          <p className="mt-2 text-xs text-[#3F3A36]/60">
            Read-only here.{" "}
            <a href={guide.sheetUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#3F3A36]">
              Edit the Contact Guide tab in Google Sheets
            </a>
            {" "}and it shows up here within a few minutes.
          </p>
        )}

        {!guide && !error && <p className="mt-6 text-sm text-[#3F3A36]/60">Loading…</p>}
        {error && <p className="mt-6 text-sm text-[#C0392B]">{error}</p>}

        {guide && (
          <div className="mt-5 space-y-3 text-sm">
            {guide.blocks.length === 0 && <p className="text-[#3F3A36]/60">The Contact Guide tab is empty.</p>}
            {guide.blocks.map((b, i) => {
              if (b.kind === "section") {
                return (
                  <h3 key={i} className={`${i > 0 ? "mt-8" : ""} bg-[#3F3A36] px-3 py-1.5 text-sm font-semibold text-[#FFFAF6]`}>
                    {b.text}
                  </h3>
                );
              }
              if (b.kind === "heading") {
                return (
                  <h4 key={i} className="mt-4 inline-block bg-[#F69C9F] px-2 py-0.5 text-xs font-semibold text-[#3F3A36]">
                    {b.text}
                  </h4>
                );
              }
              return (
                <div key={i} className="space-y-2 border border-[#3F3A36]/15 bg-white p-3 leading-relaxed">
                  {splitGuideBody(b.text).map((part, j) =>
                    part.kind === "ul" ? (
                      <ul key={j} className="list-disc space-y-1 pl-5">
                        {part.lines.map((l, k) => (
                          <li key={k}>{l}</li>
                        ))}
                      </ul>
                    ) : (
                      <p key={j}>{part.lines[0]}</p>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </>
  );
}
