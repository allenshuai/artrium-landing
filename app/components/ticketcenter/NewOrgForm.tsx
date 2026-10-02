"use client";

import { useState } from "react";
import { PRIORITIES, type OrgWriteResult, type Priority } from "@/app/lib/ticketcenter/outreach";
import { OwnerPicker, TypePicker } from "./OrgPickers";

export default function NewOrgForm({
  cities,
  roster,
  onClose,
  onCreated,
}: {
  cities: string[];
  roster: string[];
  onClose: () => void;
  onCreated: (result: OrgWriteResult) => void;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [priority, setPriority] = useState<Priority | "">("");
  const [owners, setOwners] = useState<string[]>([]);
  const [website, setWebsite] = useState("");
  const [social, setSocial] = useState("");
  const [fit, setFit] = useState("");
  const [notes, setNotes] = useState("");
  const [addToDashboard, setAddToDashboard] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ticketcenter/outreach/directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          city: city.trim(),
          types,
          priority,
          owners,
          website: website.trim(),
          social: social.trim(),
          fit,
          notes,
          status: "Not Started",
          addToDashboard,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.directory) {
        onCreated(data as OrgWriteResult);
        onClose();
      } else {
        setError(data.error ?? "Could not add the org");
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
          <h2 className="text-lg font-semibold">Add to directory</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="border border-[#3F3A36]/25 px-2.5 py-1 text-sm hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
          >
            ✕
          </button>
        </div>

        <label className={labelCls}>Org name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus />

        <label className={labelCls}>City / Area *</label>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          list="outreach-cities"
          placeholder="Somerville, Malden, Boston, MA…"
          className={inputCls}
        />
        <datalist id="outreach-cities">
          {cities.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <label className={labelCls}>Org type</label>
        <TypePicker value={types} onChange={setTypes} />

        <label className={labelCls}>Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")} className={inputCls}>
          <option value="">Unset</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <label className={labelCls}>Connection owner</label>
        <OwnerPicker value={owners} onChange={setOwners} roster={roster} />

        <label className={labelCls}>Website</label>
        <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className={inputCls} />

        <label className={labelCls}>Social</label>
        <input value={social} onChange={(e) => setSocial(e.target.value)} placeholder="https://instagram.com/…" className={inputCls} />

        <label className={labelCls}>Why interesting / fit</label>
        <textarea value={fit} onChange={(e) => setFit(e.target.value)} rows={3} className={inputCls} />

        <label className={labelCls}>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={addToDashboard}
            onChange={(e) => setAddToDashboard(e.target.checked)}
            className="h-4 w-4 accent-[#3F3A36]"
          />
          Also add to the dashboard (start outreach now)
        </label>

        {error && <p className="mt-3 text-sm text-[#C0392B]">{error}</p>}

        <button
          type="submit"
          disabled={busy || !name.trim() || !city.trim()}
          className="mt-5 w-full border border-[#3F3A36] bg-[#3F3A36] px-3 py-2 text-sm font-medium text-[#FFFAF6] disabled:opacity-50"
        >
          {busy ? "Adding…" : addToDashboard ? "Add to directory + dashboard" : "Add to directory"}
        </button>
      </form>
    </div>
  );
}
