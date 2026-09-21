"use client";

import Image from "next/image";
import Link from "next/link";

const VIEWS = [
  { key: "general", label: "General", href: "/ticketcenter" },
  { key: "outreach", label: "Outreach", href: "/ticketcenter/outreach" },
] as const;

export type TicketCenterView = (typeof VIEWS)[number]["key"];

/** Logo · "Ticket Center" · General/Outreach switch, with page actions on the right. */
export default function TicketCenterHeader({
  active,
  children,
}: {
  active: TicketCenterView;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" aria-label="Artrium home" className="shrink-0">
          <Image src="/newLogo.svg" alt="Artrium" width={151} height={26} priority className="h-[26px] w-auto" />
        </Link>
        <span aria-hidden className="h-6 w-px bg-[#3F3A36]/25" />
        <h1 className="text-xl font-semibold sm:text-2xl">Ticket Center</h1>
        <nav aria-label="Ticket Center views" className="flex gap-1.5">
          {VIEWS.map((v) => {
            const isActive = v.key === active;
            return (
              <Link
                key={v.key}
                href={v.href}
                aria-current={isActive ? "page" : undefined}
                className={`border px-3 py-1 text-sm transition ${
                  isActive
                    ? "border-[#3F3A36] bg-[#3F3A36] font-medium text-[#FFFAF6]"
                    : "border-transparent text-[#3F3A36]/60 hover:border-[#3F3A36]/30 hover:text-[#3F3A36]"
                }`}
              >
                {v.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}
