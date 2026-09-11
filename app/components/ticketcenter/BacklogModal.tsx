"use client";

import { useMemo, useState } from "react";
import type { Ticket, TicketStatus } from "@/app/lib/ticketcenter/types";
import { TICKET_STATUSES } from "@/app/lib/ticketcenter/types";
import { TYPE_COLORS } from "./typeColors";
import { isOverdue } from "./TicketCard";
import Avatar from "./Avatar";

type SortKey = "number" | "title" | "type" | "project" | "assignee" | "due";

function ticketNum(t: Ticket): number {
  const m = t.number.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

export default function BacklogModal({
  tickets,
  lead,
  onClose,
  onOpen,
  onStatusChange,
}: {
  tickets: Ticket[]; // full, unfiltered backlog
  lead: string | null;
  onClose: () => void;
  onOpen: (ticket: Ticket) => void;
  onStatusChange: (ticket: Ticket, status: TicketStatus) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("number");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const rows = useMemo(() => {
    const list = unassignedOnly
      ? tickets.filter((t) => t.assignedTo.length === 0)
      : tickets.slice();

    const cmp: Record<SortKey, (a: Ticket, b: Ticket) => number> = {
      number: (a, b) => ticketNum(a) - ticketNum(b),
      title: (a, b) => a.title.localeCompare(b.title),
      type: (a, b) => a.type.localeCompare(b.type),
      project: (a, b) => a.project.localeCompare(b.project),
      assignee: (a, b) => {
        const an = a.assignedTo[0] ?? "";
        const bn = b.assignedTo[0] ?? "";
        if (!an && bn) return 1;
        if (an && !bn) return -1;
        return an.localeCompare(bn);
      },
      due: (a, b) => {
        if (!a.dueDate && b.dueDate) return 1;
        if (a.dueDate && !b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      },
    };

    return list.sort((a, b) => sortDir * cmp[sortKey](a, b));
  }, [tickets, sortKey, sortDir, unassignedOnly]);

  const unassignedCount = tickets.filter((t) => t.assignedTo.length === 0).length;

  const headerCls = (key: SortKey, extra = "") =>
    `cursor-pointer select-none px-3 py-2 text-left hover:bg-[#EFE8E1] ${extra} ${
      sortKey === key ? "text-[#3F3A36]" : "text-[#3F3A36]/50"
    }`;

  function arrow(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === 1 ? " ↑" : " ↓";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3F3A36]/30 p-4">
      <div className="flex h-full w-full max-w-6xl flex-col border border-[#3F3A36]/30 bg-white shadow-[6px_6px_0_rgba(63,58,54,0.15)]">
        <div className="flex items-center justify-between gap-3 border-b border-[#3F3A36]/15 px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold">Backlog</h2>
            <p className="text-xs text-[#3F3A36]/50">
              {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
              {unassignedCount > 0 ? ` · ${unassignedCount} unassigned` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUnassignedOnly((v) => !v)}
              className={`border px-2.5 py-1 text-xs transition ${
                unassignedOnly
                  ? "border-[#3F3A36] bg-[#3F3A36] text-[#FFFAF6]"
                  : "border-[#3F3A36]/25 bg-white hover:border-[#3F3A36]"
              }`}
            >
              Unassigned only
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="border border-[#3F3A36]/25 px-2.5 py-1 text-sm hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-[#3F3A36]/50">
              {unassignedOnly ? "No unassigned backlog tickets." : "Backlog is empty."}
            </p>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-white text-xs font-semibold uppercase tracking-wide shadow-[0_1px_0_rgba(63,58,54,0.15)]">
                <tr>
                  <th className={headerCls("number", "w-24")} onClick={() => sortBy("number")}>
                    Ticket{arrow("number")}
                  </th>
                  <th className={headerCls("title")} onClick={() => sortBy("title")}>
                    Title{arrow("title")}
                  </th>
                  <th className={headerCls("type", "w-28")} onClick={() => sortBy("type")}>
                    Type{arrow("type")}
                  </th>
                  <th className={headerCls("project", "w-40")} onClick={() => sortBy("project")}>
                    Project{arrow("project")}
                  </th>
                  <th className={headerCls("assignee", "w-40")} onClick={() => sortBy("assignee")}>
                    Assigned to{arrow("assignee")}
                  </th>
                  <th className={headerCls("due", "w-28")} onClick={() => sortBy("due")}>
                    Due{arrow("due")}
                  </th>
                  {lead && <th className="w-36 px-3 py-2 text-left text-[#3F3A36]/50">Move to</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const overdue = isOverdue(t);
                  return (
                    <tr
                      key={t.number}
                      className="cursor-pointer border-t border-[#3F3A36]/10 hover:bg-[#FFFAF6]"
                      onClick={() => onOpen(t)}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-[#3F3A36]/50">
                        {t.number}
                      </td>
                      <td className="px-3 py-2 font-medium">{t.title}</td>
                      <td className="px-3 py-2">
                        <span
                          className="px-2 py-0.5 text-[10px] font-medium text-[#3F3A36]"
                          style={{ backgroundColor: TYPE_COLORS[t.type] }}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">{t.project}</td>
                      <td className="px-3 py-2">
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
                          <span className="text-xs text-[#3F3A36]/40">Unassigned</span>
                        )}
                      </td>
                      <td
                        className={`px-3 py-2 text-xs ${
                          overdue ? "font-semibold text-[#C0392B]" : "text-[#3F3A36]/60"
                        }`}
                      >
                        {t.dueDate || "—"}
                      </td>
                      {lead && (
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={t.status}
                            onChange={(e) =>
                              onStatusChange(t, e.target.value as TicketStatus)
                            }
                            className="w-full border border-[#3F3A36]/20 bg-[#FFFAF6] px-1.5 py-1 text-xs outline-none"
                          >
                            {TICKET_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
