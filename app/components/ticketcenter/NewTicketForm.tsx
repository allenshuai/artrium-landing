"use client";

import { useState } from "react";
import {
  TICKET_STATUSES,
  TICKET_TYPES,
  type Ticket,
  type TicketStatus,
  type TicketType,
} from "@/app/lib/ticketcenter/types";
import { PEOPLE } from "./people";
import { TYPE_COLORS } from "./typeColors";
import Avatar from "./Avatar";

const NEW_PROJECT = "__new__";

export default function NewTicketForm({
  projects,
  onClose,
  onCreated,
}: {
  projects: string[];
  onClose: () => void;
  onCreated: (ticket: Ticket) => void;
}) {
  const [title, setTitle] = useState("");
  const [types, setTypes] = useState<TicketType[]>(["design"]);
  const [projectChoice, setProjectChoice] = useState(projects[0] ?? NEW_PROJECT);
  const [newProject, setNewProject] = useState("");
  const [status, setStatus] = useState<TicketStatus>("Backlog");
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const project = projectChoice === NEW_PROJECT ? newProject.trim() : projectChoice;
  const needsAssignee = status !== "Backlog" && assignedTo.length === 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ticketcenter/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          types,
          project,
          status,
          assignedTo: assignedTo.join(", "),
          dueDate,
          description,
          link: link.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ticket) {
        onCreated(data.ticket);
        onClose();
      } else {
        setError(data.error ?? "Could not create the ticket");
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
          <h2 className="text-lg font-semibold">New ticket</h2>
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

        <label className={labelCls}>Type * <span className="normal-case text-[#3F3A36]/40">(pick one or more)</span></label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {TICKET_TYPES.map((t) => {
            const active = types.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setTypes((prev) => (active ? prev.filter((x) => x !== t) : [...prev, t]))
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
        </div>

        <label className={labelCls}>Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TicketStatus)}
          className={inputCls}
        >
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className={labelCls}>Project *</label>
        <select
          value={projectChoice}
          onChange={(e) => setProjectChoice(e.target.value)}
          className={inputCls}
        >
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value={NEW_PROJECT}>+ New project…</option>
        </select>
        {projectChoice === NEW_PROJECT && (
          <input
            value={newProject}
            onChange={(e) => setNewProject(e.target.value)}
            placeholder="New project name"
            className={`${inputCls} mt-2`}
          />
        )}

        <label className={labelCls}>
          Assigned to {status !== "Backlog" && <span className="normal-case text-[#3F3A36]/40">(required)</span>}
        </label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {PEOPLE.map((name) => {
            const active = assignedTo.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() =>
                  setAssignedTo((prev) =>
                    active ? prev.filter((n) => n !== name) : [...prev, name]
                  )
                }
                className={`flex items-center gap-1.5 border py-0.5 pl-1 pr-2.5 text-xs transition ${
                  active
                    ? "border-[#3F3A36] bg-[#3F3A36] text-[#FFFAF6]"
                    : "border-[#3F3A36]/20 bg-[#FFFAF6] hover:border-[#3F3A36]/50"
                }`}
              >
                <Avatar name={name} size={20} />
                {name}
              </button>
            );
          })}
        </div>

        <label className={labelCls}>Due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputCls}
        />

        <label className={labelCls}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={inputCls}
        />

        <label className={labelCls}>Link</label>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://…  (separate multiple links with spaces)"
          className={inputCls}
        />

        {needsAssignee && (
          <p className="mt-3 text-xs text-[#3F3A36]/60">
            Pick at least one assignee, or set status back to Backlog to leave it unassigned.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-[#C0392B]">{error}</p>}

        <button
          type="submit"
          disabled={busy || !title.trim() || !project || types.length === 0 || needsAssignee}
          className="mt-5 w-full border border-[#3F3A36] bg-[#3F3A36] px-3 py-2 text-sm font-medium text-[#FFFAF6] disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create ticket"}
        </button>
      </form>
    </div>
  );
}
