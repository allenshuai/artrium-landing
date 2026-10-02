"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatWhen,
  isPastMeeting,
  sortMeetings,
  type Meeting,
  type MeetingFields,
} from "@/app/lib/ticketcenter/meetings";
import { MEETING_COLORS } from "./typeColors";
import MeetingDrawer, { linkLabel } from "./MeetingDrawer";
import MeetingForm from "./MeetingForm";
import MeetingsModal from "./MeetingsModal";

export default function MeetingsSection({
  initialMeetings,
  lead,
  onToast,
}: {
  initialMeetings: Meeting[];
  lead: string | null;
  onToast: (message: string) => void;
}) {
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showModal, setShowModal] = useState(false);
  // Ticks each minute so a meeting drops off the row once it's over.
  const [now, setNow] = useState(() => new Date());

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/ticketcenter/meetings");
      if (!res.ok) return;
      const data = await res.json();
      setMeetings(data.meetings);
    } catch {
      // keep last good data
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      if (document.visibilityState === "visible") refetch();
    }, 60_000);
    return () => clearInterval(id);
  }, [refetch]);

  const upcoming = useMemo(
    () => sortMeetings(meetings.filter((m) => !isPastMeeting(m, now))),
    [meetings, now]
  );
  const open = openId ? meetings.find((m) => m.id === openId) ?? null : null;

  async function save(meeting: Meeting, patch: Partial<MeetingFields>): Promise<boolean> {
    const before = meetings;
    setMeetings((prev) => prev.map((m) => (m.id === meeting.id ? { ...m, ...patch } : m)));
    try {
      const res = await fetch(`/api/ticketcenter/meetings/${encodeURIComponent(meeting.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      const { meeting: updated } = await res.json();
      setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      onToast("Meeting saved");
      return true;
    } catch (err) {
      setMeetings(before);
      onToast(err instanceof Error ? err.message : "Could not save the meeting");
      return false;
    }
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#3F3A36]/60">
          Meetings
          <span className="border border-[#3F3A36]/15 bg-white px-1.5 py-0.5 font-mono text-[10px]">
            {upcoming.length}
          </span>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            aria-label="View all meetings"
            title="View all meetings, including past ones"
            className="border border-[#3F3A36]/15 bg-white px-1 py-0.5 text-[10px] leading-none transition hover:border-[#3F3A36] hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
          >
            ⛶
          </button>
        </h2>
        {lead && (
          <button
            onClick={() => setShowForm(true)}
            className="border border-[#3F3A36]/30 px-3 py-1 text-xs font-medium transition hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
          >
            + New meeting
          </button>
        )}
      </div>

      {upcoming.length === 0 ? (
        <p className="mt-2 border border-dashed border-[#3F3A36]/20 px-4 py-5 text-center text-xs text-[#3F3A36]/40">
          No upcoming meetings.
          {meetings.length > 0 && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="underline underline-offset-2 hover:text-[#3F3A36]"
              >
                View past meetings
              </button>
            </>
          )}
        </p>
      ) : (
        <div className="mt-2 flex snap-x gap-3 overflow-x-auto pb-3">
          {upcoming.map((m) => (
            <div
              key={m.id}
              onClick={() => setOpenId(m.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") setOpenId(m.id);
              }}
              style={{ "--mc": MEETING_COLORS[m.status] } as React.CSSProperties}
              className="flex w-[260px] shrink-0 snap-start cursor-pointer flex-col border border-[#3F3A36]/20 bg-white p-3 shadow-[3px_3px_0_var(--mc)] transition hover:-translate-y-0.5 hover:shadow-[4px_5px_0_var(--mc)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-[#3F3A36]/50">{m.id}</span>
                <span
                  className="px-2 py-0.5 text-[10px] font-medium text-[#3F3A36]"
                  style={{ backgroundColor: MEETING_COLORS[m.status] }}
                >
                  {m.status}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-medium leading-snug">{m.title}</p>
              <p
                className={`mt-1.5 text-xs ${
                  m.date || m.time ? "text-[#3F3A36]/70" : "italic text-[#3F3A36]/45"
                }`}
              >
                {formatWhen(m)}
                {m.location ? ` · ${m.location}` : ""}
              </p>
              <div className="mt-auto pt-2.5">
                {m.link ? (
                  <a
                    href={m.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-block border border-[#3F3A36] bg-[#3F3A36] px-2.5 py-1 text-[11px] font-medium text-[#FFFAF6] transition hover:bg-[#3F3A36]/85"
                  >
                    {linkLabel(m.link)} →
                  </a>
                ) : (
                  <span className="text-[11px] text-[#3F3A36]/40">No link yet</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <MeetingsModal
          meetings={meetings}
          now={now}
          lead={lead}
          onClose={() => setShowModal(false)}
          onOpen={(m) => setOpenId(m.id)}
          onStatusChange={(m, status) => {
            if (status !== m.status) save(m, { status });
          }}
          onNew={() => setShowForm(true)}
        />
      )}
      {open && (
        <MeetingDrawer meeting={open} lead={lead} onClose={() => setOpenId(null)} onSave={save} />
      )}
      {showForm && lead && (
        <MeetingForm
          onClose={() => setShowForm(false)}
          onCreated={(m) => {
            setMeetings((prev) => [...prev, m]);
            onToast(`${m.id} created`);
          }}
        />
      )}
    </section>
  );
}
