"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  TICKET_STATUSES,
  TICKET_TYPES,
  projectsOf,
  type Ticket,
  type TicketStatus,
  type TicketType,
} from "@/app/lib/ticketcenter/types";
import { TYPE_COLORS } from "./typeColors";
import { mergeProjects, mergeWithRoster } from "./people";
import Avatar from "./Avatar";
import ProgressBar from "./ProgressBar";
import TicketCard from "./TicketCard";
import TicketDrawer from "./TicketDrawer";
import NewTicketForm from "./NewTicketForm";
import LeadUnlock from "./LeadUnlock";
import BacklogModal from "./BacklogModal";

export default function Board({
  initialTickets,
  initialLead,
  initialError,
}: {
  initialTickets: Ticket[];
  initialLead: string | null;
  initialError: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [lead, setLead] = useState<string | null>(initialLead);
  const [loadError, setLoadError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [openTicketNumber, setOpenTicketNumber] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showBacklogModal, setShowBacklogModal] = useState(false);
  const [toast, setToast] = useState("");
  const [dragOverStatus, setDragOverStatus] = useState<TicketStatus | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── URL-synced filters ──
  const projectFilter = searchParams.get("project") ?? "All";
  const typeFilter = (searchParams.get("types") ?? "")
    .split(",")
    .filter((t): t is TicketType => (TICKET_TYPES as readonly string[]).includes(t));
  const assigneeFilter = (searchParams.get("who") ?? "").split(",").filter(Boolean);
  const query = searchParams.get("q") ?? "";

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }

  // ── Data fetching ──
  const refetch = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ticketcenter/tickets");
      if (res.status === 401) {
        window.location.href = "/ticketcenter/login";
        return;
      }
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setTickets(data.tickets);
      setLoadError(false);
    } catch {
      // Keep showing the last good data; only surface the error state when empty.
      setLoadError((prev) => (tickets.length === 0 ? true : prev));
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets.length]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refetch();
    }, 60_000);
    return () => clearInterval(id);
  }, [refetch]);

  // ── Derived data ──
  const projects = useMemo(() => mergeProjects(projectsOf(tickets)), [tickets]);
  const assignees = useMemo(() => {
    const seen: string[] = [];
    for (const t of tickets) {
      for (const name of t.assignedTo) {
        if (!seen.includes(name)) seen.push(name);
      }
    }
    return mergeWithRoster(seen);
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
      if (projectFilter !== "All" && t.project !== projectFilter) return false;
      if (typeFilter.length > 0 && !t.types.some((x) => typeFilter.includes(x))) return false;
      if (
        assigneeFilter.length > 0 &&
        !t.assignedTo.some((name) => assigneeFilter.includes(name))
      )
        return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.number.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [tickets, projectFilter, typeFilter, assigneeFilter, query]);

  const openTicket = openTicketNumber
    ? tickets.find((t) => t.number === openTicketNumber) ?? null
    : null;

  // ── Writes (optimistic) ──
  async function changeStatus(ticket: Ticket, status: TicketStatus) {
    if (ticket.status === status) return;
    const before = tickets;
    setTickets((prev) =>
      prev.map((t) => (t.number === ticket.number ? { ...t, status } : t))
    );
    try {
      const res = await fetch(
        `/api/ticketcenter/tickets/${encodeURIComponent(ticket.number)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Update failed");
      }
      const { ticket: updated } = await res.json();
      setTickets((prev) => prev.map((t) => (t.number === updated.number ? updated : t)));
    } catch (err) {
      setTickets(before);
      showToast(err instanceof Error ? err.message : "Could not move the ticket");
    }
  }

  async function changeAssignees(ticket: Ticket, assignedTo: string[]): Promise<boolean> {
    const before = tickets;
    setTickets((prev) =>
      prev.map((t) => (t.number === ticket.number ? { ...t, assignedTo } : t))
    );
    try {
      const res = await fetch(
        `/api/ticketcenter/tickets/${encodeURIComponent(ticket.number)}/assignees`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignedTo }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Update failed");
      }
      const { ticket: updated } = await res.json();
      setTickets((prev) => prev.map((t) => (t.number === updated.number ? updated : t)));
      return true;
    } catch (err) {
      setTickets(before);
      showToast(err instanceof Error ? err.message : "Could not update assignees");
      return false;
    }
  }

  async function changeDueDate(ticket: Ticket, dueDate: string): Promise<boolean> {
    const before = tickets;
    setTickets((prev) =>
      prev.map((t) => (t.number === ticket.number ? { ...t, dueDate } : t))
    );
    try {
      const res = await fetch(
        `/api/ticketcenter/tickets/${encodeURIComponent(ticket.number)}/due`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dueDate }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Update failed");
      }
      const { ticket: updated } = await res.json();
      setTickets((prev) => prev.map((t) => (t.number === updated.number ? updated : t)));
      return true;
    } catch (err) {
      setTickets(before);
      showToast(err instanceof Error ? err.message : "Could not update the due date");
      return false;
    }
  }

  async function saveNotes(ticket: Ticket, notes: string): Promise<boolean> {
    const before = tickets;
    setTickets((prev) =>
      prev.map((t) => (t.number === ticket.number ? { ...t, notes } : t))
    );
    try {
      const res = await fetch(
        `/api/ticketcenter/tickets/${encodeURIComponent(ticket.number)}/notes`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      const { ticket: updated } = await res.json();
      setTickets((prev) => prev.map((t) => (t.number === updated.number ? updated : t)));
      showToast("Notes saved");
      return true;
    } catch (err) {
      setTickets(before);
      showToast(err instanceof Error ? err.message : "Could not save notes");
      return false;
    }
  }

  function onCreated(ticket: Ticket) {
    setTickets((prev) => [...prev, ticket]);
    showToast(`${ticket.number} created`);
  }

  // ── Render ──
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Artrium Ticket Center</h1>
        <div className="flex items-center gap-2">
          {lead && (
            <button
              onClick={() => setShowNewForm(true)}
              className="border border-[#3F3A36] bg-[#3F3A36] px-3 py-1 text-sm font-medium text-[#FFFAF6] transition hover:bg-[#3F3A36]/85"
            >
              + New ticket
            </button>
          )}
          <LeadUnlock lead={lead} onUnlock={setLead} onLock={() => setLead(null)} />
        </div>
      </header>

      {/* Project tabs */}
      <nav className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {["All", ...projects].map((p) => {
          const inProject = p === "All" ? tickets : tickets.filter((t) => t.project === p);
          const done = inProject.filter((t) => t.status === "Done").length;
          const active = projectFilter === p;
          return (
            <button
              key={p}
              onClick={() => setParams({ project: p === "All" ? "" : p })}
              className={`flex shrink-0 items-center gap-2 border px-3 py-1.5 text-sm transition ${
                active
                  ? "border-[#3F3A36] bg-[#3F3A36] text-[#FFFAF6] shadow-[3px_3px_0_rgba(63,58,54,0.25)]"
                  : "border-[#3F3A36]/25 bg-white hover:border-[#3F3A36]"
              }`}
            >
              <span>{p}</span>
              <ProgressBar done={done} total={inProject.length} />
              <span className={`text-xs ${active ? "text-[#FFFAF6]/70" : "text-[#3F3A36]/50"}`}>
                {done}/{inProject.length}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Filters: types + search on one row, people below */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {TICKET_TYPES.map((t) => {
          const active = typeFilter.includes(t);
          return (
            <button
              key={t}
              onClick={() =>
                setParams({
                  types: (active
                    ? typeFilter.filter((x) => x !== t)
                    : [...typeFilter, t]
                  ).join(","),
                })
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
          onChange={(e) => setParams({ q: e.target.value })}
          placeholder="Search title or ART-#"
          className="ml-auto w-full border border-[#3F3A36]/25 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#3F3A36] sm:w-56"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {assignees.map((name) => {
          const active = assigneeFilter.includes(name);
          return (
            <button
              key={name}
              onClick={() =>
                setParams({
                  who: (active
                    ? assigneeFilter.filter((x) => x !== name)
                    : [...assigneeFilter, name]
                  ).join(","),
                })
              }
              className={`flex items-center gap-1.5 border py-0.5 pl-1 pr-2.5 text-xs transition ${
                active
                  ? "border-[#3F3A36] bg-[#3F3A36] text-[#FFFAF6]"
                  : "border-[#3F3A36]/25 bg-white hover:border-[#3F3A36]"
              }`}
            >
              <Avatar name={name} size={20} />
              {name}
            </button>
          );
        })}
      </div>

      {/* Error state */}
      {loadError && tickets.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <p className="text-lg font-medium">Couldn&apos;t reach the ticket sheet.</p>
          <p className="text-sm text-[#3F3A36]/60">
            The Google Sheet may be briefly unavailable. Nothing is lost.
          </p>
          <button
            onClick={refetch}
            disabled={refreshing}
            className="border border-[#3F3A36] bg-[#3F3A36] px-4 py-1.5 text-sm font-medium text-[#FFFAF6] disabled:opacity-50"
          >
            {refreshing ? "Retrying…" : "Retry"}
          </button>
        </div>
      ) : (
        /* Board columns: horizontal snap scroll on mobile, 5-up grid on desktop.
           Fixed height; each column scrolls internally when it overflows. */
        <div className="relative">
          <div className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 lg:grid lg:grid-cols-5 lg:overflow-visible">
            {TICKET_STATUSES.map((status) => {
              const inColumn = filtered.filter((t) => t.status === status);
              return (
                <section
                  key={status}
                  onDragOver={(e) => {
                    if (lead) {
                      e.preventDefault();
                      setDragOverStatus(status);
                    }
                  }}
                  onDragLeave={() => setDragOverStatus((s) => (s === status ? null : s))}
                  onDrop={(e) => {
                    setDragOverStatus(null);
                    if (!lead) return;
                    e.preventDefault();
                    const num = e.dataTransfer.getData("text/plain");
                    const ticket = tickets.find((t) => t.number === num);
                    if (ticket) changeStatus(ticket, status);
                  }}
                  className={`flex h-[62vh] min-h-[340px] w-[80vw] max-w-[300px] shrink-0 snap-start flex-col border transition lg:w-auto lg:max-w-none ${
                    dragOverStatus === status
                      ? "border-[#3F3A36] bg-[#EFE8E1]"
                      : "border-[#3F3A36]/15 bg-[#FFFAF6]"
                  }`}
                >
                  <h3 className="flex items-center justify-between border-b border-[#3F3A36]/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#3F3A36]/60">
                    {status}
                    <span className="flex items-center gap-1">
                      <span className="border border-[#3F3A36]/15 bg-white px-1.5 py-0.5 font-mono text-[10px]">
                        {inColumn.length}
                      </span>
                      {status === "Backlog" && (
                        <button
                          type="button"
                          onClick={() => setShowBacklogModal(true)}
                          aria-label="View full backlog"
                          title="View full backlog"
                          className="border border-[#3F3A36]/15 bg-white px-1 py-0.5 text-[10px] leading-none transition hover:border-[#3F3A36] hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
                        >
                          ⛶
                        </button>
                      )}
                    </span>
                  </h3>
                  <div className="flex-1 space-y-2 overflow-y-auto p-2">
                    {inColumn.map((t) => (
                      <TicketCard
                        key={t.number}
                        ticket={t}
                        lead={lead}
                        onOpen={(tk) => setOpenTicketNumber(tk.number)}
                        onStatusChange={changeStatus}
                      />
                    ))}
                    {inColumn.length === 0 && (
                      <p className="px-1.5 py-3 text-center text-xs text-[#3F3A36]/40">Empty</p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="border border-[#3F3A36]/30 bg-white px-5 py-3 text-sm shadow-[4px_4px_0_rgba(63,58,54,0.12)]">
                {tickets.length === 0
                  ? "No tickets yet."
                  : "No tickets match the current tab and filters."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Overlays */}
      {openTicket && (
        <TicketDrawer
          ticket={openTicket}
          lead={lead}
          roster={assignees}
          onClose={() => setOpenTicketNumber(null)}
          onStatusChange={changeStatus}
          onAssigneesChange={changeAssignees}
          onDueDateChange={changeDueDate}
          onSaveNotes={saveNotes}
        />
      )}
      {showNewForm && lead && (
        <NewTicketForm
          projects={projects}
          onClose={() => setShowNewForm(false)}
          onCreated={onCreated}
        />
      )}
      {showBacklogModal && (
        <BacklogModal
          tickets={tickets.filter((t) => t.status === "Backlog")}
          lead={lead}
          roster={assignees}
          onClose={() => setShowBacklogModal(false)}
          onOpen={(t) => setOpenTicketNumber(t.number)}
          onStatusChange={changeStatus}
        />
      )}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 bg-[#3F3A36] px-4 py-2 text-sm text-[#FFFAF6] shadow-[4px_4px_0_rgba(63,58,54,0.25)]">
          {toast}
        </div>
      )}
    </main>
  );
}
