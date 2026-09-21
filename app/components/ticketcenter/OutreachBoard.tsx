"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CLOSED_STATUSES,
  OUTREACH_STATUSES,
  PRIORITIES,
  isNextActionOverdue,
  orgKey,
  type DashboardFields,
  type DashboardOrg,
  type DirectoryFields,
  type DirectoryOrg,
  type OrgWriteResult,
  type OutreachStatus,
  type Priority,
} from "@/app/lib/ticketcenter/outreach";
import { PRIORITY_COLORS, STATUS_COLORS } from "./typeColors";
import { mergeWithRoster } from "./people";
import Avatar from "./Avatar";
import LeadUnlock from "./LeadUnlock";
import TicketCenterHeader from "./TicketCenterHeader";
import OrgCard from "./OrgCard";
import OrgDrawer from "./OrgDrawer";
import NewOrgForm from "./NewOrgForm";
import { Pill } from "./OrgPickers";

type SortKey = "name" | "city" | "priority" | "status" | "owner";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "city", label: "City" },
  { key: "priority", label: "Priority" },
  { key: "status", label: "Status" },
  { key: "owner", label: "Owner" },
];
const PRIORITY_RANK: Record<Priority | "", number> = { High: 0, Medium: 1, Low: 2, "": 3 };

const chip = (active: boolean) =>
  `flex shrink-0 items-center gap-1.5 border text-xs transition ${
    active ? "border-[#3F3A36] bg-[#3F3A36] text-[#FFFAF6]" : "border-[#3F3A36]/25 bg-white hover:border-[#3F3A36]"
  }`;

async function send(url: string, method: string, body?: unknown): Promise<OrgWriteResult> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    window.location.href = "/ticketcenter/login";
    throw new Error("Signed out");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Update failed");
  return data as OrgWriteResult;
}

export default function OutreachBoard({
  initialDirectory,
  initialDashboard,
  initialLead,
  initialError,
}: {
  initialDirectory: DirectoryOrg[];
  initialDashboard: DashboardOrg[];
  initialLead: string | null;
  initialError: boolean;
}) {
  const [directory, setDirectory] = useState<DirectoryOrg[]>(initialDirectory);
  const [dashboard, setDashboard] = useState<DashboardOrg[]>(initialDashboard);
  const [lead, setLead] = useState<string | null>(initialLead);
  const [loadError, setLoadError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [toast, setToast] = useState("");
  const [dragOverStatus, setDragOverStatus] = useState<OutreachStatus | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters (shared: owners + search; directory-only: city, priority, not-on-dashboard, sort)
  const [who, setWho] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState<(Priority | "")[]>([]);
  const [notOnDashboard, setNotOnDashboard] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }

  // ── Data fetching ──
  const isEmpty = directory.length === 0 && dashboard.length === 0;
  const refetch = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/ticketcenter/outreach");
      if (res.status === 401) {
        window.location.href = "/ticketcenter/login";
        return;
      }
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setDirectory(data.directory);
      setDashboard(data.dashboard);
      setLoadError(false);
    } catch {
      setLoadError((prev) => (isEmpty ? true : prev));
    } finally {
      setRefreshing(false);
    }
  }, [isEmpty]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refetch();
    }, 60_000);
    return () => clearInterval(id);
  }, [refetch]);

  // ── Derived ──
  const dashByKey = useMemo(() => new Map(dashboard.map((d) => [orgKey(d.name), d])), [dashboard]);
  const dirByKey = useMemo(() => new Map(directory.map((d) => [orgKey(d.name), d])), [directory]);

  const roster = useMemo(() => {
    const seen: string[] = [];
    for (const list of [directory, dashboard]) {
      for (const o of list) for (const n of o.owners) if (!seen.includes(n)) seen.push(n);
    }
    return mergeWithRoster(seen);
  }, [directory, dashboard]);
  const ownersInUse = useMemo(
    () => roster.filter((n) => directory.some((d) => d.owners.includes(n)) || dashboard.some((d) => d.owners.includes(n))),
    [roster, directory, dashboard]
  );
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of directory) if (d.city) counts.set(d.city, (counts.get(d.city) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [directory]);

  const q = query.trim().toLowerCase();
  const matchesShared = (name: string, owners: string[]) =>
    (who.length === 0 || owners.some((n) => who.includes(n))) && (!q || name.toLowerCase().includes(q));

  const pipeline = useMemo(
    () => dashboard.filter((d) => matchesShared(d.name, d.owners)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dashboard, who, q]
  );

  const rows = useMemo(() => {
    const list = directory.filter((d) => {
      if (!matchesShared(d.name, d.owners)) return false;
      if (city !== "All" && d.city !== city) return false;
      if (priorityFilter.length > 0 && !priorityFilter.includes(d.priority)) return false;
      if (notOnDashboard && dashByKey.has(orgKey(d.name))) return false;
      return true;
    });
    const statusOf = (d: DirectoryOrg) => dashByKey.get(orgKey(d.name))?.status ?? d.status;
    const cmp: Record<SortKey, (a: DirectoryOrg, b: DirectoryOrg) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      city: (a, b) => a.city.localeCompare(b.city),
      priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      status: (a, b) => OUTREACH_STATUSES.indexOf(statusOf(a)) - OUTREACH_STATUSES.indexOf(statusOf(b)),
      owner: (a, b) => {
        const an = a.owners[0] ?? "";
        const bn = b.owners[0] ?? "";
        if (!an !== !bn) return an ? -1 : 1;
        return an.localeCompare(bn);
      },
    };
    return list.sort((a, b) => sortDir * cmp[sortKey](a, b) || a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directory, dashByKey, who, q, city, priorityFilter, notOnDashboard, sortKey, sortDir]);

  const stats = useMemo(() => {
    const partners = dashboard.filter((d) => d.status === "Partnership Agreed" || d.status === "Active Partner").length;
    const overdue = dashboard.filter(isNextActionOverdue).length;
    const open = dashboard.filter((d) => !CLOSED_STATUSES.includes(d.status)).length;
    return { partners, overdue, open };
  }, [dashboard]);

  const openDirectory = openKey ? dirByKey.get(openKey) ?? null : null;
  const openDashboard = openKey ? dashByKey.get(openKey) ?? null : null;

  // ── Writes ──
  function applyResult(r: OrgWriteResult) {
    if (r.directory) {
      const d = r.directory;
      setDirectory((prev) =>
        prev.some((x) => orgKey(x.name) === orgKey(d.name))
          ? prev.map((x) => (orgKey(x.name) === orgKey(d.name) ? d : x))
          : [...prev, d]
      );
    }
    if (r.dashboard) {
      const d = r.dashboard;
      setDashboard((prev) =>
        prev.some((x) => orgKey(x.name) === orgKey(d.name))
          ? prev.map((x) => (orgKey(x.name) === orgKey(d.name) ? d : x))
          : [...prev, d]
      );
    }
  }

  async function changeStatus(org: DashboardOrg, status: OutreachStatus) {
    if (org.status === status) return;
    const beforeDash = dashboard;
    const beforeDir = directory;
    const k = orgKey(org.name);
    setDashboard((prev) => prev.map((d) => (orgKey(d.name) === k ? { ...d, status } : d)));
    setDirectory((prev) => prev.map((d) => (orgKey(d.name) === k ? { ...d, status } : d)));
    try {
      applyResult(await send(`/api/ticketcenter/outreach/dashboard/${encodeURIComponent(org.name)}`, "PATCH", { status }));
    } catch (err) {
      setDashboard(beforeDash);
      setDirectory(beforeDir);
      showToast(err instanceof Error ? err.message : "Could not update status");
    }
  }

  async function saveDirectory(name: string, patch: Partial<DirectoryFields>): Promise<boolean> {
    try {
      applyResult(await send(`/api/ticketcenter/outreach/directory/${encodeURIComponent(name)}`, "PATCH", patch));
      showToast("Directory saved");
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save");
      return false;
    }
  }

  async function saveDashboard(name: string, patch: Partial<DashboardFields>): Promise<boolean> {
    try {
      applyResult(await send(`/api/ticketcenter/outreach/dashboard/${encodeURIComponent(name)}`, "PATCH", patch));
      showToast("Outreach saved");
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save");
      return false;
    }
  }

  async function promote(name: string): Promise<boolean> {
    try {
      applyResult(await send(`/api/ticketcenter/outreach/directory/${encodeURIComponent(name)}/promote`, "POST"));
      showToast(`${name} moved to the dashboard`);
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not move to dashboard");
      return false;
    }
  }

  function onCreated(r: OrgWriteResult) {
    applyResult(r);
    showToast(`${r.directory?.name ?? "Org"} added${r.dashboard ? " to directory + dashboard" : ""}`);
  }

  // ── Render ──
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <TicketCenterHeader active="outreach">
        {lead && (
          <button
            onClick={() => setShowNewForm(true)}
            className="border border-[#3F3A36] bg-[#3F3A36] px-3 py-1 text-sm font-medium text-[#FFFAF6] transition hover:bg-[#3F3A36]/85"
          >
            + Add org
          </button>
        )}
        <LeadUnlock lead={lead} onUnlock={setLead} onLock={() => setLead(null)} />
      </TicketCenterHeader>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "In directory", value: directory.length },
          { label: "In progress", value: stats.open },
          { label: "Partners", value: stats.partners },
          { label: "Overdue next actions", value: stats.overdue, warn: stats.overdue > 0 },
        ].map((s) => (
          <div key={s.label} className="border border-[#3F3A36]/20 bg-white px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[#3F3A36]/50">{s.label}</p>
            <p className={`text-xl font-semibold ${s.warn ? "text-[#C0392B]" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Shared filters: owners + search */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {ownersInUse.map((name) => {
          const active = who.includes(name);
          return (
            <button
              key={name}
              onClick={() => setWho((prev) => (active ? prev.filter((x) => x !== name) : [...prev, name]))}
              className={`${chip(active)} py-0.5 pl-1 pr-2.5`}
            >
              <Avatar name={name} size={20} />
              {name}
            </button>
          );
        })}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search orgs"
          className="ml-auto w-full border border-[#3F3A36]/25 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#3F3A36] sm:w-56"
        />
      </div>

      {loadError && isEmpty ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <p className="text-lg font-medium">Couldn&apos;t reach the outreach sheet.</p>
          <p className="text-sm text-[#3F3A36]/60">
            The Google Sheet may be briefly unavailable, or OUTREACH_SHEET_ID isn&apos;t set. Nothing is lost.
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
        <>
          {/* Pipeline (Dashboard tab) */}
          <section className="mt-6">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-semibold">Pipeline</h2>
              <span className="text-xs text-[#3F3A36]/50">
                {pipeline.length === dashboard.length ? `${dashboard.length} on the dashboard` : `${pipeline.length} of ${dashboard.length}`}
                {lead ? " · drag cards to change status" : ""}
              </span>
            </div>
            <div className="relative">
              <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-4">
                {OUTREACH_STATUSES.map((status) => {
                  const inColumn = pipeline.filter((d) => d.status === status);
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
                        const name = e.dataTransfer.getData("text/plain");
                        const org = dashByKey.get(orgKey(name));
                        if (org) changeStatus(org, status);
                      }}
                      className={`flex h-[52vh] min-h-[320px] w-[78vw] max-w-[250px] shrink-0 snap-start flex-col border transition ${
                        dragOverStatus === status ? "border-[#3F3A36] bg-[#EFE8E1]" : "border-[#3F3A36]/15 bg-[#FFFAF6]"
                      }`}
                    >
                      <h3 className="flex items-center justify-between gap-2 border-b border-[#3F3A36]/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#3F3A36]/60">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: STATUS_COLORS[status] }} />
                          {status}
                        </span>
                        <span className="border border-[#3F3A36]/15 bg-white px-1.5 py-0.5 font-mono text-[10px]">{inColumn.length}</span>
                      </h3>
                      <div className="flex-1 space-y-2 overflow-y-auto p-2">
                        {inColumn.map((d) => (
                          <OrgCard
                            key={d.name}
                            org={d}
                            priority={dirByKey.get(orgKey(d.name))?.priority ?? ""}
                            lead={lead}
                            onOpen={(o) => setOpenKey(orgKey(o.name))}
                            onStatusChange={changeStatus}
                          />
                        ))}
                        {inColumn.length === 0 && <p className="px-1.5 py-3 text-center text-xs text-[#3F3A36]/40">Empty</p>}
                      </div>
                    </section>
                  );
                })}
              </div>
              {pipeline.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <p className="border border-[#3F3A36]/30 bg-white px-5 py-3 text-sm shadow-[4px_4px_0_rgba(63,58,54,0.12)]">
                    {dashboard.length === 0
                      ? "Nothing on the dashboard yet. Move an org up from the directory below."
                      : "No dashboard orgs match the current filters."}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Directory tab */}
          <section className="mt-6">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-semibold">Directory</h2>
              <span className="text-xs text-[#3F3A36]/50">
                {rows.length === directory.length ? `${directory.length} org${directory.length === 1 ? "" : "s"}` : `${rows.length} of ${directory.length}`}
              </span>
            </div>

            <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {["All", ...cities].map((c) => {
                const count = c === "All" ? directory.length : directory.filter((d) => d.city === c).length;
                const active = city === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCity(c)}
                    className={`flex shrink-0 items-center gap-2 border px-3 py-1.5 text-sm transition ${
                      active
                        ? "border-[#3F3A36] bg-[#3F3A36] text-[#FFFAF6] shadow-[3px_3px_0_rgba(63,58,54,0.25)]"
                        : "border-[#3F3A36]/25 bg-white hover:border-[#3F3A36]"
                    }`}
                  >
                    <span>{c}</span>
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

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {[...PRIORITIES, "" as const].map((p) => {
                const active = priorityFilter.includes(p);
                return (
                  <button
                    key={p || "unset"}
                    onClick={() => setPriorityFilter((prev) => (active ? prev.filter((x) => x !== p) : [...prev, p]))}
                    className={`border px-2.5 py-1 text-xs font-medium transition ${
                      active ? "border-[#3F3A36] shadow-[2px_2px_0_#3F3A36]" : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: PRIORITY_COLORS[p] }}
                  >
                    {p || "No priority"}
                  </button>
                );
              })}
              <button onClick={() => setNotOnDashboard((v) => !v)} className={`${chip(notOnDashboard)} px-2.5 py-1`}>
                Not on dashboard
                <span className="font-mono text-[10px] opacity-70">
                  {directory.filter((d) => !dashByKey.has(orgKey(d.name))).length}
                </span>
              </button>
              <span className="ml-auto mr-1 text-xs uppercase tracking-wide text-[#3F3A36]/50">Sort</span>
              {SORTS.map(({ key, label }) => {
                const active = sortKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (active) setSortDir((d) => (d === 1 ? -1 : 1));
                      else {
                        setSortKey(key);
                        setSortDir(1);
                      }
                    }}
                    className={`${chip(active)} px-2.5 py-1`}
                  >
                    {label}
                    {active && <span className="text-[10px]">{sortDir === 1 ? "↑" : "↓"}</span>}
                  </button>
                );
              })}
            </div>

            {rows.length === 0 ? (
              <div className="mt-4 flex justify-center py-10">
                <p className="border border-[#3F3A36]/30 bg-white px-5 py-3 text-sm shadow-[4px_4px_0_rgba(63,58,54,0.12)]">
                  {directory.length === 0 ? "The directory is empty." : "No orgs match these filters."}
                </p>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {rows.map((d) => {
                  const dash = dashByKey.get(orgKey(d.name));
                  const status = dash?.status ?? d.status;
                  return (
                    <li
                      key={d.name}
                      onClick={() => setOpenKey(orgKey(d.name))}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setOpenKey(orgKey(d.name));
                      }}
                      style={{ "--tc": PRIORITY_COLORS[d.priority] } as React.CSSProperties}
                      className="grid cursor-pointer grid-cols-1 gap-x-4 gap-y-2 border border-[#3F3A36]/20 bg-white p-3 shadow-[3px_3px_0_var(--tc)] transition hover:-translate-y-0.5 hover:shadow-[4px_5px_0_var(--tc)] md:grid-cols-[minmax(0,1fr)_120px_150px_150px_130px] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-medium leading-snug">{d.name}</p>
                          {d.priority && <Pill label={d.priority} color={PRIORITY_COLORS[d.priority]} />}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {d.types.map((t) => (
                            <span key={t} className="border border-[#3F3A36]/15 px-1.5 py-0.5 text-[10px] text-[#3F3A36]/70">
                              {t}
                            </span>
                          ))}
                        </div>
                        {d.fit && <p className="mt-1 line-clamp-1 text-xs text-[#3F3A36]/60">{d.fit}</p>}
                      </div>

                      <span className="truncate text-xs text-[#3F3A36]/70" title={d.city}>
                        {d.city || "—"}
                      </span>

                      {d.owners.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {d.owners.map((n) => (
                            <span key={n} className="inline-flex items-center gap-1 text-xs">
                              <Avatar name={n} size={18} />
                              {n}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-[#3F3A36]/40">No owner</span>
                      )}

                      <div>
                        <Pill label={status} color={STATUS_COLORS[status]} />
                        {dash && <p className="mt-0.5 text-[10px] text-[#3F3A36]/50">On dashboard</p>}
                      </div>

                      <div onClick={(e) => e.stopPropagation()}>
                        {lead && !dash ? (
                          <button
                            type="button"
                            onClick={() => promote(d.name)}
                            className="w-full border border-[#3F3A36]/30 px-2.5 py-1 text-xs transition hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
                          >
                            Move to dashboard →
                          </button>
                        ) : dash && lead ? (
                          <select
                            value={dash.status}
                            onChange={(e) => changeStatus(dash, e.target.value as OutreachStatus)}
                            className="w-full border border-[#3F3A36]/20 bg-[#FFFAF6] px-1.5 py-1 text-[11px] outline-none"
                          >
                            {OUTREACH_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {/* Overlays */}
      {openKey && (openDirectory || openDashboard) && (
        <OrgDrawer
          directory={openDirectory}
          dashboard={openDashboard}
          lead={lead}
          roster={roster}
          onClose={() => setOpenKey(null)}
          onStatusChange={changeStatus}
          onSaveDirectory={saveDirectory}
          onSaveDashboard={saveDashboard}
          onPromote={promote}
        />
      )}
      {showNewForm && lead && (
        <NewOrgForm cities={cities} roster={roster} onClose={() => setShowNewForm(false)} onCreated={onCreated} />
      )}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 bg-[#3F3A36] px-4 py-2 text-sm text-[#FFFAF6] shadow-[4px_4px_0_rgba(63,58,54,0.25)]">
          {toast}
        </div>
      )}
    </main>
  );
}
