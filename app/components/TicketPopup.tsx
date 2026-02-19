"use client";

import html2canvas from "html2canvas";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const MOBILE_BREAKPOINT_PX = 768;

function useIsSmallScreen() {
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    setIsSmall(mq.matches);
    const listener = () => setIsSmall(mq.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);
  return isSmall;
}

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
  const [submitHovered, setSubmitHovered] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<null | "success" | "invalid" | "error">(null);
  const [submitting, setSubmitting] = useState(false);
  const [todayLong, setTodayLong] = useState("");
  const [todayShort, setTodayShort] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const ticketDownloadRef = useRef<HTMLDivElement>(null);
  const [submittedData, setSubmittedData] = useState<{ name: string; email: string } | null>(null);

  const captureAndDownloadTicket = useCallback(() => {
    const el = ticketDownloadRef.current;
    if (!el || !submittedData) return;
    html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#F8F5EE",
      logging: false,
    })
      .then((canvas) => {
        const link = document.createElement("a");
        link.download = "artrium-testing-user-ticket.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      })
      .catch((err) => console.error("Ticket capture failed:", err));
  }, [submittedData]);

  useEffect(() => {
    const now = new Date();
    setTodayLong(formatTodayLong(now));
    setTodayShort(formatTodayShort(now));
  }, []);
  useEffect(() => {
    if (open) setSubmitStatus(null);
    if (!open) setSubmittedData(null);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  useEffect(() => {
    if (submitStatus !== "invalid" && submitStatus !== "error") return;
    const t = setTimeout(() => setSubmitStatus(null), 2000);
    return () => clearTimeout(t);
  }, [submitStatus]);

  useEffect(() => {
    if (!submittedData) return;
    const t = setTimeout(captureAndDownloadTicket, 400);
    return () => clearTimeout(t);
  }, [submittedData, captureAndDownloadTicket]);

  const isSmallScreen = useIsSmallScreen();

  if (!open) return null;

  const submitHandler = async () => {
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
        setSubmittedData({ name, email });
        setSubmitStatus("success");
      } else {
        setSubmitStatus("error");
      }
    } catch {
      setSubmitStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    color: TICKET_COLOR,
    borderBottom: `1px solid ${TICKET_COLOR}`,
  };

  return (
    <div
      className="fixed inset-0 z-1100 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Artrium Admission"
    >
      {/* Off-screen ticket for image capture (name/email underlined, no button, no status) */}
      {submittedData && (
        <div
          ref={ticketDownloadRef}
          className="fixed left-[-9999px] top-0 w-full max-w-3xl"
          aria-hidden
        >
          <div
            className="flex w-full overflow-hidden bg-[#F8F5EE]"
            style={{
              border: `4px solid ${TICKET_COLOR}`,
              padding: "1.5rem",
            }}
          >
            <div className="flex flex-1 flex-col">
              <header className="shrink-0">
                <h2
                  className="text-6xl font-extralight tracking-tight"
                  style={{ color: TICKET_COLOR }}
                >
                  Artrium Admission
                </h2>
                <p className="mt-1 text-lg" style={{ color: TICKET_COLOR }}>
                  {todayLong || "\u00A0"}
                </p>
                <div className="mt-4 flex items-end gap-8">
                  <span
                    className="shrink-0 text-base"
                    style={{
                      color: TICKET_COLOR,
                      borderBottom: `1px solid ${TICKET_COLOR}`,
                      minWidth: "10rem",
                    }}
                  >
                    {submittedData.name}
                  </span>
                  <span
                    className="shrink-0 text-base"
                    style={{
                      color: TICKET_COLOR,
                      borderBottom: `1px solid ${TICKET_COLOR}`,
                      minWidth: "10rem",
                    }}
                  >
                    {submittedData.email}
                  </span>
                </div>
              </header>
              <footer className="mt-auto flex items-stretch gap-4 pt-5">
                <div
                  className="flex w-20 shrink-0 items-end justify-center"
                  style={{ backgroundColor: TICKET_COLOR }}
                >
                  <img
                    src="/Ticket_Logo.png"
                    alt=""
                    width={80}
                    height={56}
                    className="object-contain object-left"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-end">
                  <p
                    className="min-w-0 text-[11px] leading-snug tracking-tight"
                    style={{ color: TICKET_COLOR }}
                  >
                    Creativity is undefinable, and never fixed to one medium, style, or
                    identity. It&apos;s a space of becoming, where people speak, shape,
                    share, and connect. But that space is too often closed off. Access is
                    limited, language is coded, and opportunities become privileges instead
                    of shared possibilities.
                  </p>
                </div>
              </footer>
            </div>
            <div
              className="mx-4 w-px shrink-0 border-l border-dashed"
              style={{ borderColor: TICKET_COLOR }}
            />
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
                  alt=""
                  width={136}
                  height={136}
                  className="object-contain"
                />
              </div>
            </aside>
          </div>
        </div>
      )}

      <div
        className="absolute inset-0 bg-[#3F3A36]/40 backdrop-blur-sm cursor-default"
        style={{ pointerEvents: "auto" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`relative flex overflow-hidden bg-[#F8F5EE] shadow-xl ${isSmallScreen ? "w-full max-w-[340px]" : "w-full max-w-3xl"}`}
        style={{
          border: `4px solid ${TICKET_COLOR}`,
          padding: isSmallScreen ? "1rem 1rem 0 1rem" : "1.5rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isSmallScreen ? (
          /* Mobile / small screen: vertical ticket layout */
          <div className="flex w-full flex-col">
            {/* Top: logo, ARTRIUM ADMISSION, QR - same height for all three, larger */}
            <header className="flex items-stretch justify-between gap-2" style={{ height: 84 }}>
              <div
                className="flex shrink-0 items-center justify-center mt-2"
                style={{ width: 64, height: 64, backgroundColor: TICKET_COLOR }}
              >
                <Image src="/Ticket_Logo.png" alt="" width={54} height={54} className="object-contain" />
              </div>
              <h2
                className="flex min-w-0 flex-1 items-center justify-center text-left text-3xl font-extralight uppercase tracking-tight leading-tight"
                style={{ color: TICKET_COLOR }}
              >
                Artrium
                <br />
                Admission
              </h2>
              <div className="flex shrink-0 items-center justify-center mt-2" style={{ width: 64, height: 64 }}>
                <Image src="/Ticket_QR_Code.svg" alt="" width={64} height={64} className="object-contain" />
              </div>
            </header>
            {/* Order date + Artrium Admission $0.00 */}
            <div className="mt-3 flex justify-between">
              <div>
                <p className="text-xs" style={{ color: TICKET_COLOR }}>Order Date</p>
                <p className="text-sm font-medium" style={{ color: TICKET_COLOR }}>{todayShort || "–"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: TICKET_COLOR }}>Artrium Admission</p>
                <p className="text-sm font-medium" style={{ color: TICKET_COLOR }}>$0.00</p>
              </div>
            </div>
            {/* Name + Email: underline shorter, only as long as text */}
            <div className="mt-4 flex flex-col gap-3">
              <input
                ref={nameInputRef}
                type="text"
                placeholder="Type your name"
                className="bg-transparent text-base outline-none placeholder:opacity-70"
                style={{ ...inputStyle, width: "14ch", minWidth: "14ch" }}
              />
              <input
                ref={emailInputRef}
                type="email"
                placeholder="Type your email"
                className="bg-transparent text-base outline-none placeholder:opacity-70"
                style={{ ...inputStyle, width: "20ch", minWidth: "20ch" }}
              />
            </div>
            {/* Dashed line full width */}
            <div
              className="mt-4 border-b border-dashed"
              style={{ borderColor: TICKET_COLOR, marginLeft: "-1rem", marginRight: "-1rem", width: "calc(100% + 2rem)" }}
            />
            {/* Paragraph: equal spacing top and bottom */}
            <p className="my-3 min-w-0 text-[11px] leading-snug tracking-tight" style={{ color: TICKET_COLOR }}>
              Creativity is undefinable, and never fixed to one medium, style, or identity. It&apos;s a space of
              becoming, where people speak, shape, share, and connect. But that space is too often closed off. Access
              is limited, language is coded, and opportunities become privileges instead of shared possibilities.
            </p>
            {/* Solid line full width; bottom box with equal spacing, shorter */}
            <div
              className="border-t py-0"
              style={{
                borderColor: TICKET_COLOR,
                marginLeft: "-1rem",
                marginRight: "-1rem",
                width: "calc(100% + 2rem)",
                paddingLeft: "1rem",
                paddingRight: "0rem",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <p
                  className="min-w-0 text-xs"
                  style={{
                    color:
                      submitStatus === "success" ? "#16a34a" : submitStatus === "invalid" || submitStatus === "error" ? "#dc2626" : TICKET_COLOR,
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
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submitHandler}
                  className="shrink-0 px-4 py-2 text-base font-medium text-[#3F3A36] disabled:opacity-60"
                  style={{ backgroundColor: "#A2DEF8", borderLeft: `1px solid ${TICKET_COLOR}` }}
                >
                  {submitting ? "…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop: two-column layout */}
            <div className="flex flex-1 flex-col">
              <header className="shrink-0">
                <h2 className="text-6xl font-extralight tracking-tight" style={{ color: TICKET_COLOR }}>
                  Artrium Admission
                </h2>
                <p className="mt-1 text-lg" style={{ color: TICKET_COLOR }}>
                  {todayLong || "\u00A0"}
                </p>
                <div className="mt-4 flex items-end gap-8">
                  <div className="flex min-w-0 flex-1 gap-8">
                    <input
                      ref={nameInputRef}
                      type="text"
                      placeholder="Type your name"
                      className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:opacity-70"
                      style={inputStyle}
                    />
                    <input
                      ref={emailInputRef}
                      type="email"
                      placeholder="Type your email"
                      className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:opacity-70"
                      style={inputStyle}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={submitHandler}
                    onMouseDown={() => setSubmitActive(true)}
                    onMouseUp={() => setSubmitActive(false)}
                    onMouseEnter={() => setSubmitHovered(true)}
                    onMouseLeave={() => {
                      setSubmitActive(false);
                      setSubmitHovered(false);
                    }}
                    className="shrink-0 px-3 py-1 text-base leading-normal transition-colors disabled:opacity-60"
                    style={{
                      cursor: submitting ? "default" : 'url("/Vector.svg") 12 20, pointer',
                      color: submitActive ? CREAM : TICKET_COLOR,
                      backgroundColor:
                        submitActive ? TICKET_COLOR : submitHovered ? "rgba(63, 58, 54, 0.06)" : "transparent",
                      border: `1px solid ${TICKET_COLOR}`,
                    }}
                  >
                    {submitting ? "…" : "Submit"}
                  </button>
                </div>
                <div className="mt-1.5 flex justify-end">
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
              <footer className="mt-auto flex items-stretch gap-4 pt-5">
                <div
                  className="flex w-20 shrink-0 items-end justify-center"
                  style={{ backgroundColor: TICKET_COLOR }}
                >
                  <Image src="/Ticket_Logo.png" alt="Artrium" width={80} height={56} className="object-contain object-left" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-end">
                  <p className="min-w-0 text-[11px] leading-snug tracking-tight" style={{ color: TICKET_COLOR }}>
                    Creativity is undefinable, and never fixed to one medium, style, or identity. It&apos;s a space of
                    becoming, where people speak, shape, share, and connect. But that space is too often closed off.
                    Access is limited, language is coded, and opportunities become privileges instead of shared
                    possibilities.
                  </p>
                </div>
              </footer>
            </div>
            <div className="mx-4 w-px shrink-0 border-l border-dashed" style={{ borderColor: TICKET_COLOR }} />
            <aside className="flex w-[140px] shrink-0 flex-col justify-between">
              <div>
                <p className="text-base" style={{ color: TICKET_COLOR }}>Order Date</p>
                <p className="text-base font-medium" style={{ color: TICKET_COLOR }}>{todayShort || "–"}</p>
                <p className="mt-2 text-base" style={{ color: TICKET_COLOR }}>Artrium Admission</p>
                <p className="text-base font-medium" style={{ color: TICKET_COLOR }}>$0.00</p>
              </div>
              <div className="mt-4 flex justify-center">
                <img src="/Ticket_QR_Code.svg" alt="Ticket QR code" width={136} height={136} className="object-contain" />
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
