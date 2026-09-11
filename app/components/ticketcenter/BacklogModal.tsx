"use client";

import { useMemo, useState } from "react";
import {
  TICKET_STATUSES,
  TICKET_TYPES,
  formatDue,
  isIsoDate,
  projectsOf,
  type Ticket,
  type TicketStatus,
  type TicketType,
} from "@/app/lib/ticketcenter/types";
import { TYPE_COLORS } from "./typeColors";
import { mergeProjects } from "./people";
import { isOverdue } from "./TicketCard";
import Avatar from "./Avatar";

type SortKey = "number" | "title" | "due" | "assignee" | "project" | "type";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "number", label: "Number" },
  { key: "title", label: "Title" },
  { key: "due", label: "Due date" },
  { key: "assignee", label: "Assignee" },
  { key: "project", label: "Project" },
  { key: "type", label: "Type" },
];

function ticketNum(t: Ticket): number {
  const m = t.number.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

// Real dates first (soonest first), then free-text dates, then TBD.
function dueRank(t: Ticket): number {
  if (!t.dueDate) return 2;
  return isIsoDate(t.dueDate) ? 0 : 1;
}

const COMPARE: Record<SortKey, (a: Ticket, b: Ticket) => number> = {
  number: (a, b) => ticketNum(a) - ticketNum(b),
  title: (a, b) => a.title.localeCompare(b.title),
  due: (a, b) => dueRank(a) - dueRank(b) || a.dueDate.localeCompare(b.dueDate),
  assignee: (a, b) => {
    const an = a.assignedTo[0] ?? "";
    const bn = b.assignedTo[0] ?? "";
    if (!an !== !bn) return an ? -1 : 1;
    return an.localeCompare(bn);
  },
  project: (a, b) => a.project.localeCompare(b.project),
  type: (a, b) => a.types[0].localeCompare(b.types[0]),
};

export default function BacklogModal({
  tickets,
  lead,
  roster,
  onClose,
  onOpen,
  onStatusChange,
}: {
  tickets: Ticket[]; // every Backlog ticket, regardless of board filters
  lead: string | null;
  roster: string[];
  onClose: () => void;
  onOpen: (ticket: Ticket) => void;
  onStatusChange: (ticket: Ticket, status: TicketStatus) => void;
}) {
  const [project, setProject] = useState("All");
  const [typeFilter, setTypeFilter] = useState<TicketType[]>([]);
  const [who, setWho] = useState<string[]>([]);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("number");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const projects = useMemo(() => mergeProjects(projectsOf(tickets)), [tickets]);
  // Only people who actually appear in the backlog, in roster order.
  const people = useMemo(
    () => roster.filter((name) => tickets.some((t) => t.assignedTo.includes(name))),
    [roster, tickets]
  );
  const unassignedCount = tickets.filter((t) => t.assignedTo.length === 0).length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tickets.filter((t) => {
      if (project !== "All" && t.project !== project) return false;
      if (typeFilter.length > 0 && !t.types.some((x) => typeFilter.includes(x))) return false;
      if (unassignedOnly && t.assignedTo.length > 0) return false;
      if (who.length > 0 && !t.assignedTo.some((n) => who.includes(n))) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.number.toLowerCase().includes(q))
        return false;
      return true;
    });
    return list.sort((a, b) => sortDir * COMPARE[sortKey](a, b) || ticketNum(a) - ticketNum(b));
  }, [tickets, project, typeFilter, who, unassignedOnly, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
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
            <h2 className="text-lg font-semibold sm:text-xl">Backlog</h2>
            <span className="text-xs text-[#3F3A36]/50">
              {rows.length === tickets.length
                ? `${tickets.length} ticket${tickets.length === 1 ? "" : "s"}`
                : `${rows.length} of ${tickets.length}`}
              {unassignedCount > 0 && ` · ${unassignedCount} unassigned`}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="border border-[#3F3A36]/25 px-2.5 py-1 text-sm hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
          >
            ✕
          </button>
        </header>

        {/* Filters — same shape as the board: project tabs, types + search, people, then sort */}
        <div className="border-b border-[#3F3A36]/10 px-4 pb-3 pt-3 sm:px-6">
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {["All", ...projects].map((p) => {
              const count = p === "All" ? tickets.length : tickets.filter((t) => t.project === p).length;
              const active = project === p;
              return (
                <button
                  key={p}
                  onClick={() => setProject(p)}
                  className={`flex shrink-0 items-center gap-2 border px-3 py-1.5 text-sm transition ${
                    active
                      ? "border-[#3F3A36] bg-[#3F3A36] text-[#FFFAF6] shadow-[3px_3px_0_rgba(63,58,54,0.25)]"
                      : "border-[#3F3A36]/25 bg-white hover:border-[#3F3A36]"
                  }`}
                >
                  <span>{p}</span>
                  <span
                    className={`border px-1.5 py-0.5 font-mono text-[10px] ${
                      active ? "border-[#FFFAF6]/30 text-[#FFFAF6]/80" : "border-[#3F3A36]/15 bg-[#FFFAF6] text-[#3F3A36]/60"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {TICKET_TYPES.map((t) => {
              const active = typeFilter.includes(t);
              return (
                <button
                  key={t}
                  onClick={() =>
                    setTypeFilter((prev) => (active ? prev.filter((x) => x !== t) : [...prev, t]))
                  }
                  className={`border px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? "border-[#3F3A36] shadow-[2px_2px_0_#3F3A36]"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: TYPE_COLORS[t] }}
                >
                  {t}
                </button>
              );
            })}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title or ART-#"
              className="ml-auto w-full border border-[#3F3A36]/25 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#3F3A36] sm:w-56"
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setUnassignedOnly((v) => !v)}
              className={`${chip(unassignedOnly)} px-2.5 py-1`}
            >
              Unassigned
              <span className="font-mono text-[10px] opacity-70">{unassignedCount}</span>
            </button>
            {people.map((name) => {
              const active = who.includes(name);
              return (
                <button
                  key={name}
                  onClick={() =>
                    setWho((prev) => (active ? prev.filter((x) => x !== name) : [...prev, name]))
                  }
                  className={`${chip(active)} py-0.5 pl-1 pr-2.5`}
                >
                  <Avatar name={name} size={20} />
                  {name}
                </button>
              );
            })}
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
                {tickets.length === 0 ? "Backlog is empty." : "No backlog tickets match these filters."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((t) => {
                const overdue = isOverdue(t);
                return (
                  <li
                    key={t.number}
                    onClick={() => onOpen(t)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onOpen(t);
                    }}
                    style={{ "--tc": TYPE_COLORS[t.types[0]] } as React.CSSProperties}
                    className="grid cursor-pointer grid-cols-1 gap-x-4 gap-y-2 border border-[#3F3A36]/20 bg-white p-3 shadow-[3px_3px_0_var(--tc)] transition hover:-translate-y-0.5 hover:shadow-[4px_5px_0_var(--tc)] md:grid-cols-[minmax(0,1fr)_150px_170px_90px] md:items-center lg:grid-cols-[minmax(0,1fr)_170px_200px_100px_150px]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-[11px] text-[#3F3A36]/50">{t.number}</span>
                        {t.types.map((x) => (
                          <span
                            key={x}
                            className="px-2 py-0.5 text-[10px] font-medium text-[#3F3A36]"
                            style={{ backgroundColor: TYPE_COLORS[x] }}
                          >
                            {x}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1 text-sm font-medium leading-snug">{t.title}</p>
                    </div>

                    <span className="truncate text-xs text-[#3F3A36]/70" title={t.project}>
                      {t.project}
                    </span>

                    {t.assignedTo.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {t.assignedTo.map((name) => (
                          <span key={name} className="inline-flex items-center gap-1 text-xs">
                            <Avatar name={name} size={18} />
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-[#3F3A36]/40">TBD</span>
                    )}

                    <span
                      className={`text-xs ${
                        overdue
                          ? "font-semibold text-[#C0392B]"
                          : t.dueDate
                            ? "text-[#3F3A36]/60"
                            : "text-[#3F3A36]/40"
                      }`}
                    >
                      {overdue ? "⚠ " : ""}
                      {formatDue(t.dueDate)}
                    </span>

                    {lead && (
                      <select
                        value={t.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onStatusChange(t, e.target.value as TicketStatus)}
                        className="w-full border border-[#3F3A36]/20 bg-[#FFFAF6] px-1.5 py-1 text-[11px] outline-none md:col-span-4 lg:col-span-1"
                      >
                        {TICKET_STATUSES.map((s) => (
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
