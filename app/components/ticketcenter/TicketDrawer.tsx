"use client";

import { useEffect, useState } from "react";
import {
  TICKET_STATUSES,
  formatDue,
  isIsoDate,
  type Ticket,
  type TicketStatus,
} from "@/app/lib/ticketcenter/types";
import { TYPE_COLORS } from "./typeColors";
import { splitLinks } from "@/app/lib/ticketcenter/validate";
import { isOverdue } from "./TicketCard";
import Avatar from "./Avatar";

export default function TicketDrawer({
  ticket,
  lead,
  roster,
  onClose,
  onStatusChange,
  onAssigneesChange,
  onDueDateChange,
  onSaveNotes,
}: {
  ticket: Ticket;
  lead: string | null;
  roster: string[];
  onClose: () => void;
  onStatusChange: (ticket: Ticket, status: TicketStatus) => void;
  onAssigneesChange: (ticket: Ticket, assignedTo: string[]) => Promise<boolean>;
  onDueDateChange: (ticket: Ticket, dueDate: string) => Promise<boolean>;
  onSaveNotes: (ticket: Ticket, notes: string) => Promise<boolean>;
}) {
  const [notes, setNotes] = useState(ticket.notes);
  const [saving, setSaving] = useState(false);
  const [savingAssignees, setSavingAssignees] = useState(false);
  const [savingDue, setSavingDue] = useState(false);
  const [newAssignee, setNewAssignee] = useState("");

  useEffect(() => {
    setNotes(ticket.notes);
  }, [ticket.number, ticket.notes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const overdue = isOverdue(ticket);

  async function saveNotes() {
    setSaving(true);
    await onSaveNotes(ticket, notes);
    setSaving(false);
  }

  async function toggleAssignee(name: string) {
    if (savingAssignees) return;
    const active = ticket.assignedTo.includes(name);
    const next = active
      ? ticket.assignedTo.filter((n) => n !== name)
      : [...ticket.assignedTo, name];
    setSavingAssignees(true);
    await onAssigneesChange(ticket, next);
    setSavingAssignees(false);
  }

  async function changeDue(value: string) {
    if (savingDue || value === ticket.dueDate) return;
    setSavingDue(true);
    await onDueDateChange(ticket, value);
    setSavingDue(false);
  }

  async function addAssignee() {
    const name = newAssignee.trim();
    if (!name || ticket.assignedTo.includes(name) || savingAssignees) return;
    setSavingAssignees(true);
    const ok = await onAssigneesChange(ticket, [...ticket.assignedTo, name]);
    setSavingAssignees(false);
    if (ok) setNewAssignee("");
  }

  return (
    <>
      {/* Sits above the Backlog modal (z-40) so opening a ticket from it doesn't lose the list. */}
      <div className="fixed inset-0 z-50 bg-[#3F3A36]/30" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-[55] flex w-full max-w-md flex-col overflow-y-auto border-l border-[#3F3A36]/25 bg-[#FFFAF6] p-6 shadow-[-6px_0_0_rgba(63,58,54,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-mono text-xs text-[#3F3A36]/50">{ticket.number}</span>
            <h2 className="mt-0.5 text-lg font-semibold leading-snug">{ticket.title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="border border-[#3F3A36]/25 px-2.5 py-1 text-sm hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {ticket.types.map((t) => (
            <span
              key={t}
              className="px-2.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: TYPE_COLORS[t] }}
            >
              {t}
            </span>
          ))}
          <span className="border border-[#3F3A36]/25 px-2.5 py-0.5 text-xs">
            {ticket.project}
          </span>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#3F3A36]/50">Status</dt>
            {lead ? (
              <select
                value={ticket.status}
                onChange={(e) => onStatusChange(ticket, e.target.value as TicketStatus)}
                className="mt-1 w-full border border-[#3F3A36]/25 bg-white px-2.5 py-1.5 text-sm outline-none"
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <dd className="mt-0.5">{ticket.status}</dd>
            )}
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#3F3A36]/50">Assigned to</dt>
            {lead ? (
              <>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {roster.map((name) => {
                    const active = ticket.assignedTo.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        disabled={savingAssignees}
                        onClick={() => toggleAssignee(name)}
                        className={`flex items-center gap-1.5 border py-0.5 pl-1 pr-2.5 text-xs transition disabled:opacity-50 ${
                          active
                            ? "border-[#3F3A36] bg-[#3F3A36] text-[#FFFAF6]"
                            : "border-[#3F3A36]/20 bg-white hover:border-[#3F3A36]/50"
                        }`}
                      >
                        <Avatar name={name} size={20} />
                        {name}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <input
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addAssignee();
                      }
                    }}
                    placeholder="Add someone not listed…"
                    className="w-full border border-[#3F3A36]/25 bg-white px-2.5 py-1 text-xs outline-none focus:border-[#3F3A36]"
                  />
                  <button
                    type="button"
                    onClick={addAssignee}
                    disabled={!newAssignee.trim() || savingAssignees}
                    className="shrink-0 border border-[#3F3A36] bg-[#3F3A36] px-2.5 py-1 text-xs font-medium text-[#FFFAF6] disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </>
            ) : (
              <dd className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {ticket.assignedTo.length > 0 ? (
                  ticket.assignedTo.map((name) => (
                    <span key={name} className="inline-flex items-center gap-1.5">
                      <Avatar name={name} size={22} />
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="text-[#3F3A36]/40">TBD</span>
                )}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#3F3A36]/50">Due date</dt>
            {lead ? (
              <>
                <div className="mt-1 flex gap-1.5">
                  <input
                    type="date"
                    value={isIsoDate(ticket.dueDate) ? ticket.dueDate : ""}
                    disabled={savingDue}
                    onChange={(e) => changeDue(e.target.value)}
                    className="w-full border border-[#3F3A36]/25 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#3F3A36] disabled:opacity-50"
                  />
                  {ticket.dueDate && (
                    <button
                      type="button"
                      onClick={() => changeDue("")}
                      disabled={savingDue}
                      className="shrink-0 border border-[#3F3A36]/25 px-2.5 py-1 text-xs hover:border-[#3F3A36] disabled:opacity-40"
                    >
                      Set TBD
                    </button>
                  )}
                </div>
                {ticket.dueDate && !isIsoDate(ticket.dueDate) && (
                  <p className="mt-1 text-xs text-[#3F3A36]/50">
                    Sheet says “{ticket.dueDate}” — pick a date above to replace it.
                  </p>
                )}
                {overdue && <p className="mt-1 text-xs font-semibold text-[#C0392B]">Overdue</p>}
              </>
            ) : (
              <dd
                className={`mt-0.5 ${
                  overdue ? "font-semibold text-[#C0392B]" : ticket.dueDate ? "" : "text-[#3F3A36]/40"
                }`}
              >
                {formatDue(ticket.dueDate)}
                {overdue ? " (overdue)" : ""}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#3F3A36]/50">
              {splitLinks(ticket.link).length > 1 ? "Links" : "Link"}
            </dt>
            <dd className="mt-0.5 break-all">
              {ticket.link ? (
                <span className="flex flex-col gap-1">
                  {splitLinks(ticket.link).map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-[#3F3A36]/70"
                    >
                      {url}
                    </a>
                  ))}
                </span>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#3F3A36]/50">Description</dt>
            <dd className="mt-0.5 whitespace-pre-wrap">{ticket.description || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#3F3A36]/50">Notes</dt>
            {lead ? (
              <>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  className="mt-1 w-full border border-[#3F3A36]/25 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#3F3A36]"
                />
                <button
                  onClick={saveNotes}
                  disabled={saving || notes === ticket.notes}
                  className="mt-1.5 border border-[#3F3A36] bg-[#3F3A36] px-3 py-1.5 text-xs font-medium text-[#FFFAF6] disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save notes"}
                </button>
              </>
            ) : (
              <dd className="mt-0.5 whitespace-pre-wrap">{ticket.notes || "—"}</dd>
            )}
          </div>
          {(ticket.created || ticket.updated) && (
            <div className="border-t border-[#3F3A36]/10 pt-3 text-xs text-[#3F3A36]/50">
              {ticket.created && <p>Created {ticket.created.slice(0, 10)}</p>}
              {ticket.updated && (
                <p>
                  Updated {ticket.updated.slice(0, 10)}
                  {ticket.updatedBy ? ` by ${ticket.updatedBy}` : ""}
                </p>
              )}
            </div>
          )}
        </dl>
      </aside>
    </>
  );
}
