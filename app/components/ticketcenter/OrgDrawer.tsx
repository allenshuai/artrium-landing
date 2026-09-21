"use client";

import { useEffect, useState } from "react";
import { isIsoDate } from "@/app/lib/ticketcenter/types";
import {
  OUTREACH_STATUSES,
  PRIORITIES,
  formatOutreachDate,
  isNextActionOverdue,
  type DashboardFields,
  type DashboardOrg,
  type DirectoryFields,
  type DirectoryOrg,
  type OutreachStatus,
  type Priority,
} from "@/app/lib/ticketcenter/outreach";
import { PRIORITY_COLORS, STATUS_COLORS } from "./typeColors";
import { LinkOrText, OwnerPicker, Pill, TypePicker } from "./OrgPickers";
import Avatar from "./Avatar";

const inputCls =
  "mt-1 w-full border border-[#3F3A36]/25 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#3F3A36]";
const dtCls = "text-xs uppercase tracking-wide text-[#3F3A36]/50";
const saveBtnCls =
  "mt-3 border border-[#3F3A36] bg-[#3F3A36] px-3 py-1.5 text-xs font-medium text-[#FFFAF6] disabled:opacity-40";

function pickDirectory(d: DirectoryOrg): DirectoryFields {
  const { types, city, website, social, fit, priority, owners, status, notes } = d;
  return { types, city, website, social, fit, priority, owners, status, notes };
}
function pickDashboard(d: DashboardOrg): DashboardFields {
  const { name: _n, updated: _u, updatedBy: _b, ...fields } = d; // eslint-disable-line @typescript-eslint/no-unused-vars
  return fields;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className={dtCls}>{label}</dt>
      {children}
    </div>
  );
}

function Text({ value }: { value: string }) {
  return <dd className="mt-0.5 whitespace-pre-wrap">{value || "—"}</dd>;
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <input type="date" value={isIsoDate(value) ? value : ""} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      {value && !isIsoDate(value) && (
        <p className="mt-1 text-xs text-[#3F3A36]/50">Sheet says “{value}” — pick a date to replace it.</p>
      )}
    </>
  );
}

function Owners({ names }: { names: string[] }) {
  return (
    <dd className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {names.length > 0 ? (
        names.map((n) => (
          <span key={n} className="inline-flex items-center gap-1.5">
            <Avatar name={n} size={22} />
            {n}
          </span>
        ))
      ) : (
        <span className="text-[#3F3A36]/40">No owner</span>
      )}
    </dd>
  );
}

function Types({ types }: { types: string[] }) {
  return (
    <dd className="mt-1 flex flex-wrap gap-1">
      {types.length > 0 ? (
        types.map((t) => (
          <span key={t} className="border border-[#3F3A36]/15 px-2 py-0.5 text-[11px] text-[#3F3A36]/80">
            {t}
          </span>
        ))
      ) : (
        <span className="text-[#3F3A36]/40">—</span>
      )}
    </dd>
  );
}

function Stamp({ rec }: { rec: { updated: string; updatedBy: string } }) {
  if (!rec.updated) return null;
  return (
    <p className="mt-2 text-xs text-[#3F3A36]/50">
      Updated {rec.updated.slice(0, 10)}
      {rec.updatedBy ? ` by ${rec.updatedBy}` : ""}
    </p>
  );
}

export default function OrgDrawer({
  directory,
  dashboard,
  lead,
  roster,
  onClose,
  onStatusChange,
  onSaveDirectory,
  onSaveDashboard,
  onPromote,
}: {
  directory: DirectoryOrg | null;
  dashboard: DashboardOrg | null;
  lead: string | null;
  roster: string[];
  onClose: () => void;
  onStatusChange: (org: DashboardOrg, status: OutreachStatus) => void;
  onSaveDirectory: (name: string, patch: Partial<DirectoryFields>) => Promise<boolean>;
  onSaveDashboard: (name: string, patch: Partial<DashboardFields>) => Promise<boolean>;
  onPromote: (name: string) => Promise<boolean>;
}) {
  const rec = dashboard ?? directory;
  const name = rec?.name ?? "";
  const status: OutreachStatus = dashboard?.status ?? directory?.status ?? "Not Started";

  const [dir, setDir] = useState<DirectoryFields | null>(directory ? pickDirectory(directory) : null);
  const [dash, setDash] = useState<DashboardFields | null>(dashboard ? pickDashboard(dashboard) : null);
  const [savingDir, setSavingDir] = useState(false);
  const [savingDash, setSavingDash] = useState(false);
  const [promoting, setPromoting] = useState(false);

  // Re-seed the forms when the underlying rows change (after a save or a poll),
  // using the adjust-state-during-render pattern instead of an effect.
  const [seedDir, setSeedDir] = useState(directory);
  const [seedDash, setSeedDash] = useState(dashboard);
  if (directory !== seedDir) {
    setSeedDir(directory);
    setDir(directory ? pickDirectory(directory) : null);
  }
  if (dashboard !== seedDash) {
    setSeedDash(dashboard);
    setDash(dashboard ? pickDashboard(dashboard) : null);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!rec) return null;

  const dirDirty = !!directory && !!dir && !same(dir, pickDirectory(directory));
  const dashDirty = !!dashboard && !!dash && !same(dash, pickDashboard(dashboard));
  const overdue = dashboard ? isNextActionOverdue(dashboard) : false;

  async function saveDir() {
    if (!directory || !dir) return;
    setSavingDir(true);
    await onSaveDirectory(directory.name, dir);
    setSavingDir(false);
  }
  async function saveDash() {
    if (!dashboard || !dash) return;
    setSavingDash(true);
    await onSaveDashboard(dashboard.name, dash);
    setSavingDash(false);
  }
  async function promote() {
    setPromoting(true);
    await onPromote(name);
    setPromoting(false);
  }
  function changeStatus(s: OutreachStatus) {
    if (dashboard) onStatusChange(dashboard, s);
    else if (directory) onSaveDirectory(directory.name, { status: s });
  }

  const upDir = <K extends keyof DirectoryFields>(k: K, v: DirectoryFields[K]) =>
    setDir((f) => (f ? { ...f, [k]: v } : f));
  const upDash = <K extends keyof DashboardFields>(k: K, v: DashboardFields[K]) =>
    setDash((f) => (f ? { ...f, [k]: v } : f));

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[#3F3A36]/30" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-[55] flex w-full max-w-lg flex-col overflow-y-auto border-l border-[#3F3A36]/25 bg-[#FFFAF6] p-6 shadow-[-6px_0_0_rgba(63,58,54,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs text-[#3F3A36]/50">{dashboard ? "On dashboard" : "Directory only"}</span>
            <h2 className="mt-0.5 text-lg font-semibold leading-snug">{name}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="border border-[#3F3A36]/25 px-2.5 py-1 text-sm hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Pill label={status} color={STATUS_COLORS[status]} className="!text-xs" />
          {directory?.priority && <Pill label={`${directory.priority} priority`} color={PRIORITY_COLORS[directory.priority]} className="!text-xs" />}
          {directory?.city && <span className="border border-[#3F3A36]/25 px-2.5 py-0.5 text-xs">{directory.city}</span>}
        </div>

        {/* Status + move */}
        <dl className="mt-5 space-y-3 text-sm">
          <Field label="Status">
            {lead ? (
              <select value={status} onChange={(e) => changeStatus(e.target.value as OutreachStatus)} className={inputCls}>
                {OUTREACH_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <Text value={status} />
            )}
          </Field>
          {lead && !dashboard && directory && (
            <div className="border border-[#3F3A36]/20 bg-white p-3">
              <p className="text-xs text-[#3F3A36]/70">
                Not on the dashboard yet. Moving it there starts tracking contacts, next actions and progress.
              </p>
              <button
                type="button"
                onClick={promote}
                disabled={promoting}
                className="mt-2 border border-[#3F3A36] bg-[#3F3A36] px-3 py-1.5 text-xs font-medium text-[#FFFAF6] disabled:opacity-40"
              >
                {promoting ? "Moving…" : "Move to dashboard →"}
              </button>
            </div>
          )}
        </dl>

        {/* Outreach (Dashboard tab) */}
        {dashboard && (
          <section className="mt-6 border-t border-[#3F3A36]/15 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#3F3A36]/60">Outreach</h3>
            <dl className="mt-3 space-y-3 text-sm">
              {lead && dash ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Contact name">
                      <input value={dash.contactName} onChange={(e) => upDash("contactName", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Role / title">
                      <input value={dash.role} onChange={(e) => upDash("role", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Email">
                      <input value={dash.email} onChange={(e) => upDash("email", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Phone">
                      <input value={dash.phone} onChange={(e) => upDash("phone", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Website">
                      <input value={dash.website} onChange={(e) => upDash("website", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Social">
                      <input value={dash.social} onChange={(e) => upDash("social", e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Relationship">
                    <input
                      value={dash.relationship}
                      onChange={(e) => upDash("relationship", e.target.value)}
                      placeholder="Met at Boston Art Fair, warm intro, cold…"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Connection owner">
                    <OwnerPicker value={dash.owners} onChange={(v) => upDash("owners", v)} roster={roster} />
                  </Field>
                  <Field label="Partnership angle">
                    <input value={dash.angle} onChange={(e) => upDash("angle", e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="What we offer">
                    <textarea value={dash.offer} onChange={(e) => upDash("offer", e.target.value)} rows={2} className={inputCls} />
                  </Field>
                  <Field label="What we want">
                    <textarea value={dash.want} onChange={(e) => upDash("want", e.target.value)} rows={2} className={inputCls} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First contact">
                      <DateInput value={dash.firstContact} onChange={(v) => upDash("firstContact", v)} />
                    </Field>
                    <Field label="Last contact">
                      <DateInput value={dash.lastContact} onChange={(v) => upDash("lastContact", v)} />
                    </Field>
                  </div>
                  <Field label="Next action">
                    <textarea value={dash.nextAction} onChange={(e) => upDash("nextAction", e.target.value)} rows={2} className={inputCls} />
                  </Field>
                  <Field label="Next action date">
                    <DateInput value={dash.nextActionDate} onChange={(v) => upDash("nextActionDate", v)} />
                    {overdue && <p className="mt-1 text-xs font-semibold text-[#C0392B]">Overdue</p>}
                  </Field>
                  <Field label="Org type">
                    <TypePicker value={dash.types} onChange={(v) => upDash("types", v)} />
                  </Field>
                  <Field label="Notes">
                    <textarea value={dash.notes} onChange={(e) => upDash("notes", e.target.value)} rows={4} className={inputCls} />
                  </Field>
                  <button type="button" onClick={saveDash} disabled={savingDash || !dashDirty} className={saveBtnCls}>
                    {savingDash ? "Saving…" : "Save outreach"}
                  </button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Contact"><Text value={[dashboard.contactName, dashboard.role].filter(Boolean).join(" · ")} /></Field>
                    <Field label="Email"><dd className="mt-0.5 break-all">{dashboard.email ? <a href={`mailto:${dashboard.email}`} className="underline">{dashboard.email}</a> : "—"}</dd></Field>
                    <Field label="Phone"><Text value={dashboard.phone} /></Field>
                    <Field label="Relationship"><Text value={dashboard.relationship} /></Field>
                    <Field label="Website"><dd className="mt-0.5"><LinkOrText value={dashboard.website} /></dd></Field>
                    <Field label="Social"><dd className="mt-0.5"><LinkOrText value={dashboard.social} /></dd></Field>
                  </div>
                  <Field label="Connection owner"><Owners names={dashboard.owners} /></Field>
                  <Field label="Partnership angle"><Text value={dashboard.angle} /></Field>
                  <Field label="What we offer"><Text value={dashboard.offer} /></Field>
                  <Field label="What we want"><Text value={dashboard.want} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First contact"><Text value={formatOutreachDate(dashboard.firstContact)} /></Field>
                    <Field label="Last contact"><Text value={formatOutreachDate(dashboard.lastContact)} /></Field>
                  </div>
                  <Field label="Next action">
                    <Text value={dashboard.nextAction} />
                    <dd className={`mt-0.5 text-xs ${overdue ? "font-semibold text-[#C0392B]" : "text-[#3F3A36]/60"}`}>
                      {dashboard.nextActionDate ? `By ${formatOutreachDate(dashboard.nextActionDate)}${overdue ? " (overdue)" : ""}` : "No date"}
                    </dd>
                  </Field>
                  <Field label="Org type"><Types types={dashboard.types} /></Field>
                  <Field label="Notes"><Text value={dashboard.notes} /></Field>
                </>
              )}
            </dl>
            <Stamp rec={dashboard} />
          </section>
        )}

        {/* Directory tab */}
        {directory && (
          <section className="mt-6 border-t border-[#3F3A36]/15 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#3F3A36]/60">Directory</h3>
            <dl className="mt-3 space-y-3 text-sm">
              {lead && dir ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City / Area">
                      <input value={dir.city} onChange={(e) => upDir("city", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Priority">
                      <select value={dir.priority} onChange={(e) => upDir("priority", e.target.value as Priority | "")} className={inputCls}>
                        <option value="">Unset</option>
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Website">
                      <input value={dir.website} onChange={(e) => upDir("website", e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Social">
                      <input value={dir.social} onChange={(e) => upDir("social", e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Org type">
                    <TypePicker value={dir.types} onChange={(v) => upDir("types", v)} />
                  </Field>
                  <Field label="Connection owner">
                    <OwnerPicker value={dir.owners} onChange={(v) => upDir("owners", v)} roster={roster} />
                  </Field>
                  <Field label="Why interesting / fit">
                    <textarea value={dir.fit} onChange={(e) => upDir("fit", e.target.value)} rows={3} className={inputCls} />
                  </Field>
                  <Field label="Notes">
                    <textarea value={dir.notes} onChange={(e) => upDir("notes", e.target.value)} rows={3} className={inputCls} />
                  </Field>
                  <button type="button" onClick={saveDir} disabled={savingDir || !dirDirty} className={saveBtnCls}>
                    {savingDir ? "Saving…" : "Save directory"}
                  </button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City / Area"><Text value={directory.city} /></Field>
                    <Field label="Priority"><Text value={directory.priority || "Unset"} /></Field>
                    <Field label="Website"><dd className="mt-0.5"><LinkOrText value={directory.website} /></dd></Field>
                    <Field label="Social"><dd className="mt-0.5"><LinkOrText value={directory.social} /></dd></Field>
                  </div>
                  <Field label="Org type"><Types types={directory.types} /></Field>
                  <Field label="Connection owner"><Owners names={directory.owners} /></Field>
                  <Field label="Why interesting / fit"><Text value={directory.fit} /></Field>
                  <Field label="Notes"><Text value={directory.notes} /></Field>
                </>
              )}
            </dl>
            <Stamp rec={directory} />
          </section>
        )}

        {!directory && dashboard && (
          <p className="mt-6 border-t border-[#3F3A36]/15 pt-4 text-xs text-[#3F3A36]/50">
            This org is on the Dashboard tab but has no Directory row. Add it in the sheet to track city and priority.
          </p>
        )}
      </aside>
    </>
  );
}
