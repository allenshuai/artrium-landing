"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const TICKET_COLOR = "#3F3A36";
const CREAM = "#FFF8F2";

function formatTodayLong(date: Date): string {
  const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
  const monthName = date.toLocaleDateString("en-US", { month: "long" });
  const day = date.getDate();
  const ord = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return `${dayName}, ${monthName} ${ord(day)}, ${date.getFullYear()}`;
}

function formatTodayShort(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const y = String(date.getFullYear()).slice(-2);
  return `${m}/${d}/${y}`;
}

export function TicketPopup({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [submitActive, setSubmitActive] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<null | "success" | "invalid" | "error">(null);
  const [submitting, setSubmitting] = useState(false);
  const [todayLong, setTodayLong] = useState("");
  const [todayShort, setTodayShort] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const now = new Date();
    setTodayLong(formatTodayLong(now));
    setTodayShort(formatTodayShort(now));
  }, []);
  useEffect(() => {
    if (open) setSubmitStatus(null);
  }, [open]);
  useEffect(() => {
    if (submitStatus !== "invalid" && submitStatus !== "error") return;
    const t = setTimeout(() => setSubmitStatus(null), 2000);
    return () => clearTimeout(t);
  }, [submitStatus]);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-1100 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Artrium Admission"
    >
      <div
        className="absolute inset-0 bg-[#3F3A36]/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative flex w-full max-w-3xl overflow-hidden bg-[#F8F5EE] shadow-xl"
        style={{
          border: `2px solid ${TICKET_COLOR}`,
          padding: "1.5rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left column: top = title/date/inputs, bottom = logo + paragraph */}
        <div className="flex flex-1 flex-col">
          <header className="shrink-0">
            <h2
              className="text-5xl font-extralight tracking-tight"
              style={{ color: TICKET_COLOR }}
            >
              Artrium Admission
            </h2>
            <p
              className="mt-1 text-lg"
              style={{ color: TICKET_COLOR }}
            >
              {todayLong || "\u00A0"}
            </p>
            <div className="mt-4 flex items-end gap-4">
              <input
                ref={nameInputRef}
                type="text"
                placeholder="Type your name"
                className="w-36 shrink-0 bg-transparent text-base outline-none placeholder:opacity-70"
                style={{
                  color: TICKET_COLOR,
                  borderBottom: `1px solid ${TICKET_COLOR}`,
                }}
              />
              <input
                ref={emailInputRef}
                type="email"
                placeholder="Type your email"
                className="w-36 shrink-0 bg-transparent text-base outline-none placeholder:opacity-70"
                style={{
                  color: TICKET_COLOR,
                  borderBottom: `1px solid ${TICKET_COLOR}`,
                }}
              />
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  const name = nameInputRef.current?.value?.trim() ?? "";
                  const email = emailInputRef.current?.value?.trim() ?? "";
                  
                  if (!name) {
                    setSubmitStatus("invalid");
                    return;
                  }
                  if (!isValidEmail(email)) {
                    setSubmitStatus("invalid");
                    return;
                  }
                  setSubmitting(true);
                  setSubmitStatus(null);
                  try {
                    const res = await fetch("/api/waitlist", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name, email }),
                    });
                    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
                    if (data?.ok === true) {
                      setSubmitStatus("success");
                    } else {
                      console.error("waitlist error:", data?.error);
                      setSubmitStatus("error");
                    }

                  } catch {
                    setSubmitStatus("error");
                  } finally {
                    setSubmitting(false);
                  }
                }}
                onMouseDown={() => setSubmitActive(true)}
                onMouseUp={() => setSubmitActive(false)}
                onMouseLeave={() => setSubmitActive(false)}
                className="shrink-0 px-3 py-1 text-base leading-normal transition-colors disabled:opacity-60"
                style={{
                  color: submitActive ? CREAM : TICKET_COLOR,
                  backgroundColor: submitActive ? TICKET_COLOR : "transparent",
                  border: `1px solid ${TICKET_COLOR}`,
                }}
              >
                {submitting ? "…" : "Submit"}
              </button>
            </div>
            <div className="mt-1.5 flex">
              <div className="w-[calc(9rem+9rem+2rem)] shrink-0" aria-hidden />
              <p
                className="text-xs"
                style={{
                  color:
                    submitStatus === "success"
                      ? "#16a34a"
                      : submitStatus === "invalid" || submitStatus === "error"
                        ? "#dc2626"
                        : TICKET_COLOR,
                  opacity: submitStatus ? 1 : 0.8,
                }}
              >
                {submitStatus === "success"
                  ? "success!!!"
                  : submitStatus === "invalid"
                    ? "invalid email"
                    : submitStatus === "error"
                      ? "submission failed, try again"
                      : "(to become testing user)"}
              </p>
            </div>
          </header>
          <footer className="mt-auto flex gap-4 pt-5">
            <Image
              src="/Ticket_Logo.png"
              alt="Artrium"
              width={80}
              height={56}
              className="shrink-0 object-contain object-left"
            />
            <p
              className="min-w-0 text-[11px] leading-relaxed"
              style={{ color: TICKET_COLOR }}
            >
              Creativity is undefinable, and never fixed to one medium, style, or
              identity. It&apos;s a space of becoming, where people speak, shape,
              share, and connect. But that space is too often closed off. Access is
              limited, language is coded, and opportunities become privileges instead
              of shared possibilities.
            </p>
          </footer>
        </div>

        <div
          className="mx-4 w-px shrink-0 border-l border-dashed"
          style={{ borderColor: TICKET_COLOR }}
        />

        {/* Right column: width so left/right gap around QR = bottom gap (ticket padding 1.5rem = 24px) */}
        <aside className="flex w-[140px] shrink-0 flex-col justify-between">
          <div>
            <p className="text-base" style={{ color: TICKET_COLOR }}>
              Order Date
            </p>
            <p className="text-base font-medium" style={{ color: TICKET_COLOR }}>
              {todayShort || "–"}
            </p>
            <p className="mt-2 text-base" style={{ color: TICKET_COLOR }}>
              Artrium Admission
            </p>
            <p className="text-base font-medium" style={{ color: TICKET_COLOR }}>
              $0.00
            </p>
          </div>
          <div className="mt-4 flex justify-center">
            <img
              src="/Ticket_QR_Code.svg"
              alt="Ticket QR code"
              width={120}
              height={120}
              className="object-contain"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
