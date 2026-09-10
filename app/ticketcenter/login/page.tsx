"use client";

import { useState } from "react";

export default function TicketCenterLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ticketcenter/auth/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/ticketcenter";
        return;
      }
      setError(res.status === 429 ? "Too many attempts. Try again later." : "Wrong password");
    } catch {
      setError("Something went wrong. Try again.");
    }
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm border border-[#3F3A36]/30 bg-white p-8 shadow-[6px_6px_0_rgba(63,58,54,0.12)]"
      >
        <h1 className="text-xl font-semibold">Artrium Ticket Center</h1>
        <p className="mt-1 text-sm text-[#3F3A36]/60">Enter the team password to continue.</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mt-5 w-full border border-[#3F3A36]/25 bg-[#FFFAF6] px-3 py-2 text-sm outline-none focus:border-[#3F3A36]"
        />
        {error && <p className="mt-2 text-sm text-[#C0392B]">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-4 w-full border border-[#3F3A36] bg-[#3F3A36] px-3 py-2 text-sm font-medium text-[#FFFAF6] transition hover:bg-[#3F3A36]/85 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
