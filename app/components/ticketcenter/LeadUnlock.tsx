"use client";

import { useState } from "react";

export default function LeadUnlock({
  lead,
  onUnlock,
  onLock,
}: {
  lead: string | null;
  onUnlock: (name: string) => void;
  onLock: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ticketcenter/auth/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, passcode }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.name) {
        onUnlock(data.name);
        setOpen(false);
        setName("");
        setPasscode("");
      } else {
        setError(
          res.status === 429 ? "Too many attempts. Try again later." : "Wrong name or passcode"
        );
      }
    } catch {
      setError("Something went wrong. Try again.");
    }
    setBusy(false);
  }

  async function lock() {
    await fetch("/api/ticketcenter/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "lead" }),
    }).catch(() => {});
    onLock();
  }

  if (lead) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="border border-[#3F3A36]/30 bg-[#B7E4C7] px-3 py-1 font-medium">
          Editing as {lead}
        </span>
        <button onClick={lock} className="text-[#3F3A36]/60 underline hover:text-[#3F3A36]">
          Lock
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="border border-[#3F3A36]/30 px-3 py-1 text-sm transition hover:bg-[#3F3A36] hover:text-[#FFFAF6]"
      >
        Edit mode
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="absolute right-0 top-full z-30 mt-2 w-60 border border-[#3F3A36]/30 bg-white p-3 shadow-[4px_4px_0_rgba(63,58,54,0.15)]"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            autoFocus
            className="w-full border border-[#3F3A36]/25 bg-[#FFFAF6] px-2.5 py-1.5 text-sm outline-none focus:border-[#3F3A36]"
          />
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode"
            className="mt-2 w-full border border-[#3F3A36]/25 bg-[#FFFAF6] px-2.5 py-1.5 text-sm outline-none focus:border-[#3F3A36]"
          />
          {error && <p className="mt-1.5 text-xs text-[#C0392B]">{error}</p>}
          <button
            type="submit"
            disabled={busy || !name || !passcode}
            className="mt-2 w-full border border-[#3F3A36] bg-[#3F3A36] px-2.5 py-1.5 text-sm font-medium text-[#FFFAF6] disabled:opacity-50"
          >
            {busy ? "Checking…" : "Unlock"}
          </button>
        </form>
      )}
    </div>
  );
}
