"use client";

import { useEffect, useState } from "react";
import {
  MEETING_STATUSES,
  formatWhen,
  formatTime,
  type Meeting,
  type MeetingFields,
  type MeetingStatus,
} from "@/app/lib/ticketcenter/meetings";
import { isIsoDate } from "@/app/lib/ticketcenter/types";
import { MEETING_COLORS } from "./typeColors";

export function linkLabel(url: string): string {
  return /when2meet\.com/i.test(url) ? "Pick a time on When2meet" : "Join meeting";
}

export default function MeetingDrawer({
  meeting,
  lead,
  onClose,
  onSave,
}: {
  meeting: Meeting;
  lead: string | null;
  onClose: () => void;
  onSave: (meeting: Meeting, patch: Partial<MeetingFields>) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<MeetingFields>(pick(meeting));
  const [saving, setSaving] = useState(false);

  // Re-seed the form when a different meeting opens or a refetch changes it.
  const seed = `${meeting.id}|${meeting.updated}`;
  const [seeded, setSeeded] = useState(seed);
  if (seeded !== seed) {
    setSeeded(seed);
    setDraft(pick(meeting));
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dirty = (Object.keys(draft) as (keyof MeetingFields)[]).some(
    (k) => draft[k] !== meeting[k]
  );

  async function save() {
    if (!dirty || saving) return;
    const patch: Partial<MeetingFields> = {};
    for (const k of Object.keys(draft) as (keyof MeetingFields)[]) {
      if (draft[k] !== meeting[k]) (patch as Record<string, string>)[k] = draft[k];
    }
    setSaving(true);
    await onSave(meeting, patch);
    setSaving(false);
  }

  const set = <K extends keyof MeetingFields>(k: K, v: MeetingFields[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const inputCls =
    "mt-1 w-full border border-[#3F3A36]/25 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#3F3A36]";
  const labelCls = "text-xs uppercase tracking-wide text-[#3F3A36]/50";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[#3F3A36]/30" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-[55] flex w-full max-w-md flex-col overflow-y-auto border-l border-[#3F3A36]/25 bg-[#FFFAF6] p-6 shadow-[-6px_0_0_rgba(63,58,54,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-mono text-xs text-[#3F3A36]/50">{meeting.id}</span>
            {lead ? (
              <input
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                className="mt-0.5 w-full border border-[#3F3A36]/25 bg-white px-2.5 py-1.5 text-lg font-semibold leading-snug outline-none focus:border-[#3F3A36]"
              />
            ) : (
              <h2 className="mt-0.5 text-lg font-semibold leading-snug">{meeting.title}</h2>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="border border-[#3F3A36]/25 px-2.5 py-1 text-sm hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div>
            <p className={labelCls}>Status</p>
            {lead ? (
              <select
                value={draft.status}
                onChange={(e) => set("status", e.target.value as MeetingStatus)}
                className={inputCls}
              >
                {MEETING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <span
                className="mt-1 inline-block px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: MEETING_COLORS[meeting.status] }}
              >
                {meeting.status}
              </span>
            )}
            {lead && draft.status === "Done" && (
              <p className="mt-1 text-xs text-[#3F3A36]/50">
                Done meetings disappear from the board but stay in the sheet.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelCls}>Date</p>
              {lead ? (
                <>
                  <input
                    type="date"
                    value={isIsoDate(draft.date) ? draft.date : ""}
                    onChange={(e) => set("date", e.target.value)}
                    className={inputCls}
                  />
                  {draft.date && !isIsoDate(draft.date) && (
                    <p className="mt-1 text-xs text-[#3F3A36]/50">Sheet says “{draft.date}”</p>
                  )}
                </>
              ) : (
                <p className="mt-0.5">{formatWhen({ ...meeting, time: "" })}</p>
              )}
            </div>
            <div>
              <p className={labelCls}>Time</p>
              {lead ? (
                <input
                  value={draft.time}
                  onChange={(e) => set("time", e.target.value)}
                  placeholder="e.g. 12 pm"
                  className={inputCls}
                />
              ) : (
                <p className="mt-0.5">{meeting.time ? formatTime(meeting.time) : "TBD"}</p>
              )}
            </div>
          </div>

          <div>
            <p className={labelCls}>Location</p>
            {lead ? (
              <input
                value={draft.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Room, address, or “Zoom”"
                className={inputCls}
              />
            ) : (
              <p className="mt-0.5">{meeting.location || "—"}</p>
            )}
          </div>

          <div>
            <p className={labelCls}>Link</p>
            {lead ? (
              <input
                value={draft.link}
                onChange={(e) => set("link", e.target.value)}
                placeholder="Meeting link or when2meet link"
                className={inputCls}
              />
            ) : null}
            {meeting.link ? (
              <a
                href={meeting.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-block border border-[#3F3A36] bg-[#3F3A36] px-3 py-1.5 text-xs font-medium text-[#FFFAF6] transition hover:bg-[#3F3A36]/85"
              >
                {linkLabel(meeting.link)} →
              </a>
            ) : (
              !lead && <p className="mt-0.5 text-[#3F3A36]/40">No link yet</p>
            )}
          </div>

          <div>
            <p className={labelCls}>Notes</p>
            {lead ? (
              <textarea
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={6}
                className={inputCls}
              />
            ) : (
              <p className="mt-0.5 whitespace-pre-wrap">{meeting.notes || "—"}</p>
            )}
          </div>

          {lead && (
            <button
              onClick={save}
              disabled={!dirty || saving || !draft.title.trim()}
              className="w-full border border-[#3F3A36] bg-[#3F3A36] px-3 py-2 text-sm font-medium text-[#FFFAF6] disabled:opacity-40"
            >
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          )}

          {(meeting.created || meeting.updated) && (
            <div className="border-t border-[#3F3A36]/10 pt-3 text-xs text-[#3F3A36]/50">
              {meeting.created && <p>Created {meeting.created.slice(0, 10)}</p>}
              {meeting.updated && (
                <p>
                  Updated {meeting.updated.slice(0, 10)}
                  {meeting.updatedBy ? ` by ${meeting.updatedBy}` : ""}
                </p>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function pick(m: Meeting): MeetingFields {
  return {
    title: m.title,
    status: m.status,
    date: m.date,
    time: m.time,
    link: m.link,
    location: m.location,
    notes: m.notes,
  };
}
