"use client";

import { useState } from "react";
import type { Meeting, MeetingStatus } from "@/app/lib/ticketcenter/meetings";

export default function MeetingForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (meeting: Meeting) => void;
}) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<MeetingStatus>("Scheduling");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [link, setLink] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ticketcenter/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), status, date, time, link: link.trim(), location, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.meeting) {
        onCreated(data.meeting);
        onClose();
      } else {
        setError(data.error ?? "Could not create the meeting");
      }
    } catch {
      setError("Something went wrong. Try again.");
    }
    setBusy(false);
  }

  const inputCls =
    "w-full border border-[#3F3A36]/25 bg-[#FFFAF6] px-2.5 py-1.5 text-sm outline-none focus:border-[#3F3A36]";
  const labelCls = "mt-3 block text-xs font-medium uppercase tracking-wide text-[#3F3A36]/60";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3F3A36]/30 p-4">
      <form
        onSubmit={submit}
        className="max-h-full w-full max-w-lg overflow-y-auto border border-[#3F3A36]/30 bg-white p-6 shadow-[6px_6px_0_rgba(63,58,54,0.15)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New meeting</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="border border-[#3F3A36]/25 px-2.5 py-1 text-sm hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
          >
            ✕
          </button>
        </div>

        <label className={labelCls}>Title *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} autoFocus />

        <label className={labelCls}>Status</label>
        <div className="mt-1 flex gap-1.5">
          {(["Scheduling", "Scheduled"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`border px-3 py-1 text-xs transition ${
                status === s
                  ? "border-[#3F3A36] bg-[#3F3A36] text-[#FFFAF6]"
                  : "border-[#3F3A36]/25 bg-white hover:border-[#3F3A36]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Time</label>
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="e.g. 12 pm"
              className={inputCls}
            />
          </div>
        </div>

        <label className={labelCls}>Link</label>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Meeting link or when2meet link"
          className={inputCls}
        />

        <label className={labelCls}>Location</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Room, address, or “Zoom”"
          className={inputCls}
        />

        <label className={labelCls}>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />

        {error && <p className="mt-3 text-sm text-[#C0392B]">{error}</p>}

        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="mt-5 w-full border border-[#3F3A36] bg-[#3F3A36] px-3 py-2 text-sm font-medium text-[#FFFAF6] disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create meeting"}
        </button>
      </form>
    </div>
  );
}
