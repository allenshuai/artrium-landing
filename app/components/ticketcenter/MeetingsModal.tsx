"use client";

import { useMemo, useState } from "react";
import {
  MEETING_STATUSES,
  formatWhen,
  isPastMeeting,
  type Meeting,
  type MeetingStatus,
} from "@/app/lib/ticketcenter/meetings";
import { isIsoDate } from "@/app/lib/ticketcenter/types";
import { MEETING_COLORS } from "./typeColors";
import { linkLabel } from "./MeetingDrawer";

type When = "All" | "Upcoming" | "Past";
const WHENS: When[] = ["All", "Upcoming", "Past"];

type SortKey = "date" | "title" | "number" | "status";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "title", label: "Title" },
  { key: "number", label: "Number" },
  { key: "status", label: "Status" },
];

function meetingNum(m: Meeting): number {
  const match = m.id.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

// Real dates first, then free-text dates, then undated.
function dateRank(m: Meeting): number {
  if (!m.date) return 2;
  return isIsoDate(m.date) ? 0 : 1;
}

function dateKey(m: Meeting): string {
  return `${m.date} ${/^\d{2}:\d{2}$/.test(m.time) ? m.time : "99:99"}`;
}

const COMPARE: Record<SortKey, (a: Meeting, b: Meeting) => number> = {
  date: (a, b) => dateRank(a) - dateRank(b) || dateKey(a).localeCompare(dateKey(b)),
  title: (a, b) => a.title.localeCompare(b.title),
  number: (a, b) => meetingNum(a) - meetingNum(b),
  status: (a, b) => MEETING_STATUSES.indexOf(a.status) - MEETING_STATUSES.indexOf(b.status),
};

export default function MeetingsModal({
  meetings,
  now,
  lead,
  onClose,
  onOpen,
  onStatusChange,
  onNew,
}: {
  meetings: Meeting[]; // every meeting, past and upcoming
  now: Date;
  lead: string | null;
  onClose: () => void;
  onOpen: (meeting: Meeting) => void;
  onStatusChange: (meeting: Meeting, status: MeetingStatus) => void;
  onNew?: () => void;
}) {
  const [when, setWhen] = useState<When>("All");
  const [statusFilter, setStatusFilter] = useState<MeetingStatus[]>([]);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  // Latest first by default so upcoming meetings sit on top and past ones trail off below.
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const past = useMemo(
    () => new Set(meetings.filter((m) => isPastMeeting(m, now)).map((m) => m.id)),
    [meetings, now]
  );
  const pastCount = past.size;
  const upcomingCount = meetings.length - pastCount;
  const whenCount = (w: When) =>
    w === "All" ? meetings.length : w === "Past" ? pastCount : upcomingCount;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = meetings.filter((m) => {
      if (when === "Upcoming" && past.has(m.id)) return false;
      if (when === "Past" && !past.has(m.id)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(m.status)) return false;
      if (q && !m.title.toLowerCase().includes(q) && !m.id.toLowerCase().includes(q)) return false;
      return true;
    });
    return list.sort(
      (a, b) => sortDir * COMPARE[sortKey](a, b) || meetingNum(b) - meetingNum(a)
    );
  }, [meetings, past, when, statusFilter, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(key === "date" ? -1 : 1);
    }
  }

  const chip = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 border text-xs transition ${
      active
        ? "border-[#3F3A36] bg-[#3F3A36] text-[#FFFAF6]"
        : "border-[#3F3A36]/25 bg-white hover:border-[#3F3A36]"
    }`;

  return (
    <div className="fixed inset-0 z-40 bg-[#3F3A36]/30 p-3 sm:p-6">
      <div className="flex h-full flex-col border border-[#3F3A36]/30 bg-[#FFFAF6] shadow-[6px_6px_0_rgba(63,58,54,0.15)]">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-[#3F3A36]/15 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold sm:text-xl">Meetings</h2>
            <span className="text-xs text-[#3F3A36]/50">
              {rows.length === meetings.length
                ? `${meetings.length} meeting${meetings.length === 1 ? "" : "s"}`
                : `${rows.length} of ${meetings.length}`}
              {pastCount > 0 && ` · ${pastCount} past`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {lead && onNew && (
              <button
                onClick={onNew}
                className="border border-[#3F3A36]/30 px-3 py-1 text-xs font-medium transition hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
              >
                + New meeting
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="border border-[#3F3A36]/25 px-2.5 py-1 text-sm hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Filters — same shape as the backlog: when tabs, status chips + search, then sort */}
        <div className="border-b border-[#3F3A36]/10 px-4 pb-3 pt-3 sm:px-6">
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {WHENS.map((w) => {
              const active = when === w;
              return (
                <button
                  key={w}
                  onClick={() => setWhen(w)}
                  className={`flex shrink-0 items-center gap-2 border px-3 py-1.5 text-sm transition ${
                    active
                      ? "border-[#3F3A36] bg-[#3F3A36] text-[#FFFAF6] shadow-[3px_3px_0_rgba(63,58,54,0.25)]"
                      : "border-[#3F3A36]/25 bg-white hover:border-[#3F3A36]"
                  }`}
                >
                  <span>{w}</span>
                  <span
                    className={`border px-1.5 py-0.5 font-mono text-[10px] ${
                      active
                        ? "border-[#FFFAF6]/30 text-[#FFFAF6]/80"
                        : "border-[#3F3A36]/15 bg-[#FFFAF6] text-[#3F3A36]/60"
                    }`}
                  >
                    {whenCount(w)}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {MEETING_STATUSES.map((s) => {
              const active = statusFilter.includes(s);
              return (
                <button
                  key={s}
                  onClick={() =>
                    setStatusFilter((prev) => (active ? prev.filter((x) => x !== s) : [...prev, s]))
                  }
                  className={`border px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? "border-[#3F3A36] shadow-[2px_2px_0_#3F3A36]"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: MEETING_COLORS[s] }}
                >
                  {s}
                </button>
              );
            })}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or MTG-#"
              className="ml-auto w-full border border-[#3F3A36]/25 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#3F3A36] sm:w-56"
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs uppercase tracking-wide text-[#3F3A36]/50">Sort</span>
            {SORTS.map(({ key, label }) => {
              const active = sortKey === key;
              return (
                <button
                  key={key}
                  onClick={() => toggleSort(key)}
                  className={`${chip(active)} px-2.5 py-1`}
                >
                  {label}
                  {active && <span className="text-[10px]">{sortDir === 1 ? "↑" : "↓"}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6">
          {rows.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="border border-[#3F3A36]/30 bg-white px-5 py-3 text-sm shadow-[4px_4px_0_rgba(63,58,54,0.12)]">
                {meetings.length === 0 ? "No meetings yet." : "No meetings match these filters."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((m) => {
                const isPast = past.has(m.id);
                return (
                  <li
                    key={m.id}
                    onClick={() => onOpen(m)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onOpen(m);
                    }}
                    style={{ "--mc": MEETING_COLORS[m.status] } as React.CSSProperties}
                    className={`grid cursor-pointer grid-cols-1 gap-x-4 gap-y-2 border border-[#3F3A36]/20 bg-white p-3 shadow-[3px_3px_0_var(--mc)] transition hover:-translate-y-0.5 hover:shadow-[4px_5px_0_var(--mc)] md:grid-cols-[minmax(0,1fr)_190px_170px] md:items-center lg:grid-cols-[minmax(0,1fr)_200px_180px_190px_130px] ${
                      isPast ? "opacity-70 hover:opacity-100" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-[11px] text-[#3F3A36]/50">{m.id}</span>
                        <span
                          className="px-2 py-0.5 text-[10px] font-medium text-[#3F3A36]"
                          style={{ backgroundColor: MEETING_COLORS[m.status] }}
                        >
                          {m.status}
                        </span>
                        {isPast && (
                          <span className="border border-[#3F3A36]/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#3F3A36]/50">
                            Past
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium leading-snug">{m.title}</p>
                    </div>

                    <span
                      className={`text-xs ${
                        m.date || m.time ? "text-[#3F3A36]/70" : "italic text-[#3F3A36]/45"
                      }`}
                    >
                      {formatWhen(m)}
                    </span>

                    <span
                      className={`truncate text-xs ${
                        m.location ? "text-[#3F3A36]/70" : "text-[#3F3A36]/40"
                      }`}
                      title={m.location}
                    >
                      {m.location || "No location"}
                    </span>

                    <div className="md:col-span-2 lg:col-span-1">
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

                    {lead && (
                      <select
                        value={m.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onStatusChange(m, e.target.value as MeetingStatus)}
                        className="w-full border border-[#3F3A36]/20 bg-[#FFFAF6] px-1.5 py-1 text-[11px] outline-none md:col-span-3 lg:col-span-1"
                      >
                        {MEETING_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
