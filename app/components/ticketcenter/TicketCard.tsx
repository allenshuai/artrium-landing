"use client";

import { TICKET_STATUSES, type Ticket, type TicketStatus } from "@/app/lib/ticketcenter/types";
import { TYPE_COLORS } from "./typeColors";
import Avatar from "./Avatar";

export function isOverdue(t: Ticket): boolean {
  if (!t.dueDate || t.status === "Done") return false;
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  return t.dueDate < iso;
}

export default function TicketCard({
  ticket,
  lead,
  onOpen,
  onStatusChange,
}: {
  ticket: Ticket;
  lead: string | null;
  onOpen: (ticket: Ticket) => void;
  onStatusChange: (ticket: Ticket, status: TicketStatus) => void;
}) {
  const overdue = isOverdue(ticket);
  return (
    <div
      draggable={!!lead}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", ticket.number);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpen(ticket)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(ticket);
      }}
      style={{ "--tc": TYPE_COLORS[ticket.type] } as React.CSSProperties}
      className={`cursor-pointer border bg-white p-3 shadow-[3px_3px_0_var(--tc)] transition hover:-translate-y-0.5 hover:shadow-[4px_5px_0_var(--tc)] ${
        overdue ? "border-[#C0392B]/60" : "border-[#3F3A36]/20"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-[#3F3A36]/50">{ticket.number}</span>
        <span
          className="px-2 py-0.5 text-[10px] font-medium text-[#3F3A36]"
          style={{ backgroundColor: TYPE_COLORS[ticket.type] }}
        >
          {ticket.type}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-medium leading-snug">{ticket.title}</p>
      {(ticket.assignedTo.length > 0 || ticket.dueDate) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex -space-x-1.5">
            {ticket.assignedTo.map((name) => (
              <Avatar key={name} name={name} size={20} />
            ))}
          </div>
          {ticket.dueDate && (
            <span
              className={`text-[11px] ${
                overdue ? "font-semibold text-[#C0392B]" : "text-[#3F3A36]/50"
              }`}
            >
              {overdue ? "⚠ " : ""}
              {ticket.dueDate}
            </span>
          )}
        </div>
      )}
      {lead && (
        <select
          value={ticket.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onStatusChange(ticket, e.target.value as TicketStatus)}
          className="mt-2 w-full border border-[#3F3A36]/20 bg-[#FFFAF6] px-1.5 py-1 text-[11px] outline-none"
        >
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
